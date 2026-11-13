import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Share2, X, QrCode, IdCard, Download, Contact, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { pageUrl } from '../../lib/site';
import {
  makeQrSvg,
  makeQrPngDataUrl,
  downloadPng,
  downloadSvg,
} from '../../lib/qr';
import {
  downloadVCard,
  downloadBusinessCardPng,
  generateBusinessCardPng,
  dataUrlToBlob,
  isLightColor,
} from '../../lib/businessCard';
import { VIBES } from '../../lib/vibes';
import { TrackedLinkSection } from './TrackedLinkSection';
import { LinkPreviewSection } from './LinkPreviewSection';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  vibeId?: string;
  isPublished?: boolean;
}

const QR_COLORS = [
  { label: 'Onyx', value: '#0A0A0A' },
  { label: 'Indigo', value: '#4F46E5' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Rose', value: '#E11D48' },
  { label: 'Amber', value: '#D97706' },
  { label: 'Violet', value: '#7C3AED' },
];

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  bio,
  avatarUrl,
  vibeId,
  isPublished = true,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'share' | 'card'>('share');
  const [copied, setCopied] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#0A0A0A');
  const [showBrandedFrame, setShowBrandedFrame] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const fullUrl = pageUrl(username);
  const qrUrl = pageUrl(username, { src: 'qr' });
  const displayAddress = `iveo.site/${username}`;
  const activeVibe = VIBES.find((v) => v.id === vibeId) || VIBES[0];
  const cardTheme = {
    bg: activeVibe.tokens.bg,
    text: activeVibe.tokens.text,
    muted: activeVibe.tokens.muted,
    accent: activeVibe.tokens.buttonBg,
    buttonBg: activeVibe.tokens.buttonBg,
  };
  const cardBgIsLight = isLightColor(cardTheme.bg);

  // Generate QR lazily when opened or when color changes
  useEffect(() => {
    if (!isOpen || !username) return;

    let isMounted = true;
    setIsGenerating(true);
    setQrError(false);

    Promise.all([
      makeQrSvg(qrUrl, { darkColor: selectedColor }),
      makeQrPngDataUrl(qrUrl, { darkColor: selectedColor }),
    ])
      .then(([svg, png]) => {
        if (!isMounted) return;
        setQrSvg(svg);
        setQrPngDataUrl(png);
        setIsGenerating(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setQrError(true);
        setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, username, qrUrl, selectedColor]);

  // Trap focus and lock body scroll
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link copied');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Failed to copy');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: displayName || `@${username}`,
        text: 'My page on iveo',
        url: fullUrl,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignored silently
        return;
      }
      showToast("Couldn't share. Try again.");
    }
  };

  const handleDownloadPng = () => {
    if (qrPngDataUrl) {
      downloadPng(qrPngDataUrl, username);
    }
  };

  const handleDownloadSvg = () => {
    if (qrSvg) {
      downloadSvg(qrSvg, username);
    }
  };

  const handleSaveContactVcf = () => {
    downloadVCard({
      displayName: displayName || username,
      username,
      bio,
      pageUrl: fullUrl,
      avatarUrl,
    });
    showToast('Contact card (.vcf) downloaded');
  };

  const handleDownloadBusinessCard = async () => {
    setIsDownloadingCard(true);
    try {
      await downloadBusinessCardPng({
        displayName: displayName || username,
        username,
        bio,
        pageUrl: fullUrl,
        avatarUrl,
        qrDataUrl: qrPngDataUrl,
        theme: cardTheme,
      });
      showToast('Business card (1920×1080 PNG) downloaded');
    } catch {
      showToast('Could not generate card PNG. Try downloading the QR or .vcf.');
    } finally {
      setIsDownloadingCard(false);
    }
  };

  const handleShareCard = async () => {
    const cardText = `Digital Business Card: ${displayName || username} (@${username})\n${bio ? `${bio}\n` : ''}Connect: ${fullUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const pngDataUrl = await generateBusinessCardPng({
          displayName: displayName || username,
          username,
          bio,
          pageUrl: fullUrl,
          avatarUrl,
          qrDataUrl: qrPngDataUrl,
          theme: cardTheme,
        });
        const blob = dataUrlToBlob(pngDataUrl);
        const file = new File([blob], `iveo-card-${username}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${displayName || username}'s Business Card`,
            text: cardText,
            files: [file],
          });
          return;
        }
      } catch {}

      try {
        await navigator.share({
          title: `${displayName || username}'s Business Card`,
          text: cardText,
          url: fullUrl,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(cardText);
      setCopiedCard(true);
      showToast('Business card info copied');
      setTimeout(() => setCopiedCard(false), 1800);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[440px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Visual drag indicator for mobile sheet */}
        <div className="sm:hidden flex justify-center -mt-2 mb-4">
          <div className="w-[36px] h-[5px] rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between">
          <h2
            id="share-dialog-title"
            className="text-[20px] font-semibold text-ink leading-tight"
          >
            Share your page
          </h2>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-120"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 p-1 bg-surface-2 rounded-[10px] border border-border flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`flex-1 h-8 rounded-[7px] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'share'
                ? 'bg-surface text-ink shadow-2xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <QrCode size={14} />
            <span>Share &amp; QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`flex-1 h-8 rounded-[7px] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'card'
                ? 'bg-surface text-ink shadow-2xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <IdCard size={14} />
            <span>Business Card</span>
          </button>
        </div>

        {activeTab === 'card' ? (
          <div className="mt-5 flex flex-col gap-4">
            <div
              className={`w-full rounded-[16px] p-5 shadow-md relative overflow-hidden flex flex-col justify-between aspect-[1.7/1] select-none border ${
                cardBgIsLight ? 'border-black/10' : 'border-white/15'
              }`}
              style={{
                backgroundColor: cardTheme.bg,
                color: cardTheme.text,
              }}
            >
              <div
                className={`absolute w-40 h-40 rounded-full pointer-events-none blur-2xl ${
                  cardBgIsLight ? '-bottom-16 -left-16 opacity-[0.06]' : '-top-14 -right-14 opacity-20'
                }`}
                style={{ backgroundColor: cardTheme.accent }}
              />
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName || username}
                      className={`w-12 h-12 rounded-full object-cover border-2 shrink-0 ${
                        cardBgIsLight ? 'border-black/10' : 'border-white/25'
                      }`}
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-[18px] shrink-0 border ${
                        cardBgIsLight ? 'bg-black/5 border-black/10' : 'bg-white/15 border-white/20'
                      }`}
                    >
                      {(displayName || username).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-[16px] font-bold leading-tight truncate">
                      {displayName || username}
                    </h4>
                    <span className="text-[12px] opacity-75 font-mono">@{username}</span>
                  </div>
                </div>
                {qrPngDataUrl && (
                  <div className="w-12 h-12 bg-white p-0.5 rounded-lg shrink-0 shadow-xs border border-black/5">
                    <img src={qrPngDataUrl} alt="" className="w-full h-full object-contain rounded" />
                  </div>
                )}
              </div>

              {bio && (
                <p className="text-[12px] opacity-80 line-clamp-2 leading-relaxed my-2 relative z-10">
                  {bio}
                </p>
              )}

              <div
                className={`pt-2 border-t flex items-center justify-between text-[11px] opacity-70 font-mono relative z-10 ${
                  cardBgIsLight ? 'border-black/10' : 'border-white/15'
                }`}
              >
                <span>iveo</span>
                <span>{displayAddress}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleDownloadBusinessCard}
                disabled={isDownloadingCard}
                fullWidth
              >
                <Download size={15} />
                <span>{isDownloadingCard ? 'Rendering 1920×1080 PNG...' : 'Download HD Business Card (.png)'}</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="md" onClick={handleSaveContactVcf} fullWidth>
                  <Contact size={15} />
                  <span>Contact (.vcf)</span>
                </Button>
                <Button variant="secondary" size="md" onClick={handleShareCard} fullWidth>
                  {copiedCard ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
                  <span>{copiedCard ? 'Copied!' : 'Share Card'}</span>
                </Button>
              </div>
            </div>

            <p className="text-center text-[12px] text-muted leading-relaxed">
              Full HD 1920×1080 business card matched to your active Vibe with an embedded scannable QR code.
            </p>
          </div>
        ) : (
        <div className="mt-5 flex flex-col gap-5">
          {/* 1. Link row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 px-3.5 bg-surface-2 border border-border rounded-[10px] flex items-center overflow-hidden">
              <span className="font-mono text-[14px] sm:text-[15px] text-ink truncate select-all">
                {displayAddress}
              </span>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleCopyLink}
              className="shrink-0 min-w-[96px]"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          {/* 2. Native Share button (if supported) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleNativeShare}
              fullWidth
            >
              <Share2 size={16} strokeWidth={1.5} />
              <span>More sharing options...</span>
            </Button>
          )}

          {/* 3. QR Code Studio */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">QR Code Studio</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted">Card frame</span>
                <button
                  type="button"
                  onClick={() => setShowBrandedFrame((prev) => !prev)}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    showBrandedFrame ? 'bg-ink' : 'bg-border'
                  }`}
                  aria-label="Toggle branded card frame"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-surface shadow-xs transition-transform ${
                      showBrandedFrame ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Color palette selector */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {QR_COLORS.map((c) => {
                const isActive = selectedColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    title={c.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer shrink-0 ${
                      isActive ? 'ring-2 ring-offset-2 ring-ink scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* QR Card Container */}
            <div className="w-full flex flex-col items-center justify-center bg-white border border-border rounded-[14px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center">
              {showBrandedFrame && (
                <div className="flex flex-col items-center mb-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName || username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs mb-1.5"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center font-bold text-ink text-[16px] mb-1.5 shadow-xs">
                      {(displayName || username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[14px] font-semibold text-ink leading-tight">
                    {displayName || `@${username}`}
                  </span>
                  <span className="text-[11px] text-muted mt-0.5">
                    Scan to view my profile
                  </span>
                </div>
              )}

              <div className="w-[200px] h-[200px] flex items-center justify-center bg-white">
                {qrSvg ? (
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
                    alt={`QR code that opens ${fullUrl}`}
                    width={200}
                    height={200}
                    className="w-[200px] h-[200px] block object-contain"
                  />
                ) : qrError ? (
                  <div className="flex flex-col items-center text-center p-4">
                    <p className="text-[13px] text-muted">
                      We couldn't create the QR code. Try again.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setQrError(false);
                        setIsGenerating(true);
                        Promise.all([
                          makeQrSvg(qrUrl, { darkColor: selectedColor }),
                          makeQrPngDataUrl(qrUrl, { darkColor: selectedColor }),
                        ])
                          .then(([svg, png]) => {
                            setQrSvg(svg);
                            setQrPngDataUrl(png);
                            setIsGenerating(false);
                          })
                          .catch(() => {
                            setQrError(true);
                            setIsGenerating(false);
                          });
                      }}
                      className="mt-2"
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] bg-surface-2 rounded-[8px] animate-pulse" />
                )}
              </div>

              {showBrandedFrame && (
                <div className="mt-3 pt-2.5 border-t border-border/60 w-full flex items-center justify-center gap-1.5">
                  <span className="text-[11px] font-semibold text-ink tracking-tight font-sans">iveo</span>
                  <span className="text-[10px] text-muted">· iveo.site/{username}</span>
                </div>
              )}
            </div>

            <div className="w-full grid grid-cols-2 gap-2.5">
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadPng}
                disabled={!qrPngDataUrl || isGenerating}
                fullWidth
              >
                Download PNG
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadSvg}
                disabled={!qrSvg || isGenerating}
                fullWidth
              >
                Download SVG
              </Button>
            </div>

            <p className="text-center text-[12px] text-muted leading-relaxed">
              Scans directly to iveo.site/{username}. High resolution for print & signage.
            </p>
          </div>

          {/* 4. Tracked links section */}
          <TrackedLinkSection username={username} />

          {/* 5. Link preview section */}
          <LinkPreviewSection
            username={username}
            displayName={displayName}
            bio={bio}
            avatarUrl={avatarUrl}
            vibeId={vibeId}
          />

          {/* 6. Notice if page is unpublished/hidden */}
          {!isPublished && (
            <div className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-[10px] p-3 text-[14px] text-muted">
              <span>Your page is hidden, so visitors will see an unavailable message.</span>
              <Button
                as={Link}
                to="/dashboard/settings"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onClose}
              >
                Open settings
              </Button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

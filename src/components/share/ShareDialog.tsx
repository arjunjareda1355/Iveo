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
} from '../../lib/businessCard';
import {
  BusinessCardConfig,
  DEFAULT_BUSINESS_CARD_CONFIG,
} from '../../lib/businessCardConfig';
import { ButtonColors, resolveEffectiveTokens } from '../../lib/colors';
import { FontSettings } from '../../lib/fonts';
import { VIBES } from '../../lib/vibes';
import { TrackedLinkSection } from './TrackedLinkSection';
import { LinkPreviewSection } from './LinkPreviewSection';
import { BusinessCardPreview } from './BusinessCardPreview';
import { BusinessCardCustomizer } from './BusinessCardCustomizer';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  vibeId?: string;
  fontSettings?: FontSettings | null;
  buttonColors?: ButtonColors | null;
  businessCard?: BusinessCardConfig | null;
  onSaveCardConfig?: (cfg: BusinessCardConfig) => Promise<void> | void;
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
  fontSettings,
  buttonColors,
  businessCard,
  onSaveCardConfig,
  isPublished = true,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'share' | 'card'>('share');
  const [copied, setCopied] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#0A0A0A');
  const [showBrandedFrame, setShowBrandedFrame] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [cardConfig, setCardConfig] = useState<BusinessCardConfig>(() => ({
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    fontId: fontSettings?.nameFont || null,
    ...(businessCard || {}),
  }));

  useEffect(() => {
    setCardConfig({
      ...DEFAULT_BUSINESS_CARD_CONFIG,
      fontId: fontSettings?.nameFont || null,
      ...(businessCard || {}),
    });
  }, [businessCard, fontSettings?.nameFont]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const fullUrl = pageUrl(username);
  const qrUrl = pageUrl(username, { src: 'qr' });
  const displayAddress = `iveo.site/${username}`;
  const activeVibe = VIBES.find((v) => v.id === vibeId) || VIBES[0];
  const effectiveTokens = resolveEffectiveTokens(activeVibe.tokens, buttonColors);
  const cardTheme = {
    bg: effectiveTokens.bg,
    text: effectiveTokens.text,
    muted: effectiveTokens.muted,
    accent: effectiveTokens.buttonBg,
    buttonBg: effectiveTokens.buttonBg,
  };

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
      cardConfig,
    });
    showToast('Contact card (.vcf) downloaded');
  };

  const handleSaveCardDesign = async (next: BusinessCardConfig) => {
    if (!onSaveCardConfig) return;
    setIsSavingCard(true);
    try {
      await onSaveCardConfig(next);
      showToast('Business card design saved');
    } catch {
      showToast("Couldn't save business card design");
    } finally {
      setIsSavingCard(false);
    }
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
        cardConfig,
      });
      showToast('Business card (2040×1200 HD PNG) downloaded');
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
          cardConfig,
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
            <BusinessCardPreview
              username={username}
              displayName={displayName || username}
              bio={bio}
              avatarUrl={avatarUrl}
              qrDataUrl={qrPngDataUrl}
              vibeTheme={cardTheme}
              config={cardConfig}
            />

            <BusinessCardCustomizer
              value={cardConfig}
              onChange={setCardConfig}
              onSave={onSaveCardConfig ? handleSaveCardDesign : undefined}
              isSaving={isSavingCard}
            />

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleDownloadBusinessCard}
                disabled={isDownloadingCard}
                fullWidth
              >
                <Download size={15} />
                <span>
                  {isDownloadingCard
                    ? 'Rendering 2040×1200 PNG...'
                    : 'Download HD Business Card (.png)'}
                </span>
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
              Exports a pixel-true 2040×1200 HD PNG matching your card preview with an embedded scannable QR code.
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
                      referrerPolicy="no-referrer"
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

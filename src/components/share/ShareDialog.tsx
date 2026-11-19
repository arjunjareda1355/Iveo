import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Share2,
  X,
  QrCode,
  IdCard,
  Download,
  Contact,
  Check,
  ArrowLeftRight,
  AlertTriangle,
  Code2,
  ChevronDown,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Link2,
  Eye,
  Save,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import { pageUrl } from '../../lib/site';
import {
  makeQrSvg,
  makeQrPngDataUrl,
  downloadPng,
  downloadSvg,
  getHexContrastRatio,
  QrErrorCorrectionLevel,
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
import {
  buildProfileEmbedIframeCode,
  buildProfileEmbedUrl,
  ProfileEmbedStyle,
  ProfileEmbedTheme,
} from '../../lib/profileEmbed';
import { ButtonColors, resolveEffectiveTokens, normalizeHexColor } from '../../lib/colors';
import { FontSettings } from '../../lib/fonts';
import { VIBES } from '../../lib/vibes';
import { TrackedLinkSection } from './TrackedLinkSection';
import { LinkPreviewSection } from './LinkPreviewSection';
import { BusinessCardPreview } from './BusinessCardPreview';
import { BusinessCardCustomizer } from './BusinessCardCustomizer';
import { ProfileEmbedSection } from './ProfileEmbedSection';

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
  socials?: Record<string, string> | null;
  onSaveCardConfig?: (cfg: BusinessCardConfig) => Promise<void> | void;
  isPro?: boolean;
  isPublished?: boolean;
}

const QR_PRESETS = [
  { label: 'Classic', fg: '#0A0A0A', bg: '#FFFFFF' },
  { label: 'Indigo', fg: '#4F46E5', bg: '#FFFFFF' },
  { label: 'Emerald', fg: '#059669', bg: '#ECFDF5' },
  { label: 'Rose', fg: '#E11D48', bg: '#FFF1F2' },
  { label: 'Midnight', fg: '#FAFAFA', bg: '#09090B' },
  { label: 'Amber', fg: '#B45309', bg: '#FFFBEB' },
];

type LinkAccordionSection = 'qr' | 'tracked' | 'preview';

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
  socials,
  onSaveCardConfig,
  isPro = false,
  isPublished = true,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'share' | 'card' | 'embed'>('share');
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [openLinkSection, setOpenLinkSection] = useState<LinkAccordionSection | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);

  // Arbitrary foreground + background QR customization
  const [qrFgColor, setQrFgColor] = useState('#0A0A0A');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');
  const [qrEcc, setQrEcc] = useState<QrErrorCorrectionLevel>('M');
  const [showBrandedFrame, setShowBrandedFrame] = useState(false);
  const [qrCaption, setQrCaption] = useState('Scan to view my profile');
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Embed tab state (shared with sticky action footer)
  const [embedStyle, setEmbedStyle] = useState<ProfileEmbedStyle>('card');
  const [embedTheme, setEmbedTheme] = useState<ProfileEmbedTheme>('auto');

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

  const cleanUsername = (username || 'creator').replace(/^@+/, '').toLowerCase().trim();
  const fullUrl = pageUrl(username);
  const qrUrl = pageUrl(username, { src: 'qr' });
  const displayAddress = `iveo.site/@${username}`;
  const activeVibe = VIBES.find((v) => v.id === vibeId) || VIBES[0];
  const effectiveTokens = resolveEffectiveTokens(activeVibe.tokens, buttonColors);
  const cardTheme = {
    bg: effectiveTokens.bg,
    text: effectiveTokens.text,
    muted: effectiveTokens.muted,
    accent: effectiveTokens.buttonBg,
    buttonBg: effectiveTokens.buttonBg,
  };

  const contrastRatio = getHexContrastRatio(qrFgColor, qrBgColor);
  const lowContrast = contrastRatio < 3.0;

  const embedSrc = buildProfileEmbedUrl(cleanUsername, {
    style: embedStyle,
    theme: embedTheme,
  });
  const embedIframeSnippet = buildProfileEmbedIframeCode(cleanUsername, {
    style: embedStyle,
    theme: embedTheme,
    displayName: displayName || `@${cleanUsername}`,
    origin: 'https://iveo.site',
  });

  useEffect(() => {
    if (!isOpen || !username) return;

    let isMounted = true;
    setIsGenerating(true);
    setQrError(false);

    Promise.all([
      makeQrSvg(qrUrl, { darkColor: qrFgColor, lightColor: qrBgColor, errorCorrectionLevel: qrEcc }),
      makeQrPngDataUrl(qrUrl, { darkColor: qrFgColor, lightColor: qrBgColor, errorCorrectionLevel: qrEcc }),
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
  }, [isOpen, username, qrUrl, qrFgColor, qrBgColor, qrEcc]);

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
      if (err instanceof Error && err.name === 'AbortError') return;
      showToast("Couldn't share. Try again.");
    }
  };

  const handleDownloadPng = () => {
    if (qrPngDataUrl) downloadPng(qrPngDataUrl, username);
  };

  const handleDownloadSvg = () => {
    if (qrSvg) downloadSvg(qrSvg, username);
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

  const handleDownloadBusinessCard = async (exportSide: 'front' | 'back' | 'both' = cardSide) => {
    setIsDownloadingCard(true);
    try {
      await downloadBusinessCardPng({
        displayName: displayName || username,
        username,
        bio,
        pageUrl: fullUrl,
        avatarUrl,
        socials,
        isPro,
        qrDataUrl: qrPngDataUrl,
        side: exportSide,
        theme: cardTheme,
        cardConfig,
      });
      const label =
        exportSide === 'both'
          ? '2-sided studio sheet PNG downloaded'
          : `${exportSide === 'front' ? 'Front' : 'Back'} card (2040×1200 HD PNG) downloaded`;
      showToast(label);
    } catch {
      showToast('Could not generate card PNG. Try downloading the QR or .vcf.');
    } finally {
      setIsDownloadingCard(false);
    }
  };

  const handleShareCard = async () => {
    const cardText = `Digital business card: ${displayName || username} (@${username})\n${bio ? `${bio}\n` : ''}Connect: ${fullUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const pngDataUrl = await generateBusinessCardPng({
          displayName: displayName || username,
          username,
          bio,
          pageUrl: fullUrl,
          avatarUrl,
          socials,
          isPro,
          qrDataUrl: qrPngDataUrl,
          side: cardSide,
          theme: cardTheme,
          cardConfig,
        });
        const blob = dataUrlToBlob(pngDataUrl);
        const file = new File([blob], `iveo-card-${username}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${displayName || username}'s business card`,
            text: cardText,
            files: [file],
          });
          return;
        }
      } catch {}

      try {
        await navigator.share({
          title: `${displayName || username}'s business card`,
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

  const handleCopyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedIframeSnippet);
      setCopiedEmbed(true);
      showToast('Embed code copied');
      setTimeout(() => setCopiedEmbed(false), 1800);
    } catch {
      showToast('Failed to copy embed code');
    }
  };

  const toggleLinkSection = (sec: LinkAccordionSection) => {
    setOpenLinkSection((prev) => (prev === sec ? null : sec));
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
        className="w-full sm:max-w-[460px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Fixed Header & Top Tabs */}
        <div className="px-6 pt-5 pb-3.5 border-b border-border/60 shrink-0">
          <div className="sm:hidden flex justify-center -mt-2 mb-3">
            <div className="w-[36px] h-[5px] rounded-full bg-border" />
          </div>

          <div className="flex items-center justify-between">
            <h2 id="share-dialog-title" className="text-[20px] font-semibold text-ink leading-tight">
              Share your page
            </h2>
            <button
              onClick={onClose}
              aria-label="Close share dialog"
              className="w-9 h-9 -mr-1.5 rounded-[10px] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-120 cursor-pointer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-3.5 p-1 bg-surface-2 rounded-[10px] border border-border flex items-center gap-1">
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
              <span>Link &amp; QR</span>
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
              <span>Card</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('embed')}
              className={`flex-1 h-8 rounded-[7px] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'embed'
                  ? 'bg-surface text-ink shadow-2xs border border-border/60'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Code2 size={14} />
              <span>Embed</span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'embed' ? (
            <ProfileEmbedSection
              username={username}
              displayName={displayName}
              bio={bio}
              avatarUrl={avatarUrl}
              vibeId={vibeId}
              isPro={isPro}
              embedStyle={embedStyle}
              onEmbedStyleChange={setEmbedStyle}
              embedTheme={embedTheme}
              onEmbedThemeChange={setEmbedTheme}
              hideActions
            />
          ) : activeTab === 'card' ? (
            <div className="flex flex-col gap-4">
              <BusinessCardPreview
                username={username}
                displayName={displayName || username}
                bio={bio}
                avatarUrl={avatarUrl}
                socials={socials}
                isPro={isPro}
                qrDataUrl={qrPngDataUrl}
                side={cardSide}
                onSideChange={setCardSide}
                vibeTheme={cardTheme}
                config={cardConfig}
              />

              <BusinessCardCustomizer
                value={cardConfig}
                onChange={setCardConfig}
                onSelectSide={setCardSide}
                onSave={onSaveCardConfig ? handleSaveCardDesign : undefined}
                isSaving={isSavingCard}
                hideSave
              />

              {/* Secondary export/share utilities */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadBusinessCard('both')}
                  disabled={isDownloadingCard}
                  fullWidth
                >
                  <Download size={13} />
                  <span>Both sides</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSaveContactVcf} fullWidth>
                  <Contact size={13} />
                  <span>Contact</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleShareCard} fullWidth>
                  {copiedCard ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Share2 size={13} />
                  )}
                  <span>{copiedCard ? 'Copied' : 'Share'}</span>
                </Button>
              </div>

              <p className="text-center text-[12px] text-muted leading-relaxed">
                Exports 2040×1200 HD PNG for front &amp; back with your selected finish and QR code.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 1. Link display */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-11 px-3.5 bg-surface-2 border border-border rounded-[10px] flex items-center overflow-hidden">
                  <span className="font-mono text-[14px] sm:text-[15px] text-ink truncate select-all">
                    {displayAddress}
                  </span>
                </div>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleNativeShare}
                    aria-label="Share via device"
                    title="Share via device"
                    className="shrink-0"
                  >
                    <Share2 size={16} strokeWidth={1.5} />
                  </Button>
                )}
              </div>

              {!isPublished && (
                <div className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-[10px] p-3 text-[13px] text-muted">
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

              {/* 2. QR Code Preview Card */}
              <div
                className="w-full flex flex-col items-center justify-center border border-border rounded-[14px] p-5 text-center transition-colors"
                style={{ backgroundColor: showBrandedFrame ? '#FFFFFF' : qrBgColor }}
              >
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
                    <span className="text-[12px] text-muted mt-0.5">
                      {qrCaption || 'Scan to view my profile'}
                    </span>
                  </div>
                )}

                <div
                  className="w-[200px] h-[200px] flex items-center justify-center rounded-xl overflow-hidden"
                  style={{ backgroundColor: qrBgColor }}
                >
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
                            makeQrSvg(qrUrl, {
                              darkColor: qrFgColor,
                              lightColor: qrBgColor,
                              errorCorrectionLevel: qrEcc,
                            }),
                            makeQrPngDataUrl(qrUrl, {
                              darkColor: qrFgColor,
                              lightColor: qrBgColor,
                              errorCorrectionLevel: qrEcc,
                            }),
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
                    <span className="text-[12px] font-semibold text-ink tracking-tight font-sans">
                      iveo
                    </span>
                    <span className="text-[12px] text-muted">· iveo.site/@{username}</span>
                  </div>
                )}
              </div>

              <p className="text-center text-[12px] text-muted leading-relaxed">
                Scans directly to iveo.site/@{username}.
              </p>

              {/* 3. Secondary Options Accordions */}
              <div className="flex flex-col gap-2">
                {/* Customize QR Accordion */}
                <div className="rounded-xl border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLinkSection('qr')}
                    aria-expanded={openLinkSection === 'qr'}
                    className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal size={15} className="text-muted shrink-0" />
                      <span>Customize QR</span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform duration-150 ${
                        openLinkSection === 'qr' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openLinkSection === 'qr' && (
                    <div className="px-3.5 pb-4 pt-3 border-t border-border/70 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-ink">Card frame</span>
                        <Toggle
                          checked={showBrandedFrame}
                          onChange={() => setShowBrandedFrame((prev) => !prev)}
                          ariaLabel="Toggle branded card frame"
                        />
                      </div>

                      {showBrandedFrame && (
                        <input
                          type="text"
                          value={qrCaption}
                          onChange={(e) => setQrCaption(e.target.value.slice(0, 48))}
                          placeholder="Frame caption (e.g. Scan to connect)"
                          className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
                        />
                      )}

                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        {QR_PRESETS.map((c) => {
                          const isActive = qrFgColor === c.fg && qrBgColor === c.bg;
                          return (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => {
                                setQrFgColor(c.fg);
                                setQrBgColor(c.bg);
                              }}
                              title={c.label}
                              aria-label={`${c.label} QR preset`}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer shrink-0 border border-border ${
                                isActive
                                  ? 'ring-2 ring-offset-2 ring-ink scale-105'
                                  : 'hover:scale-105 opacity-85 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: c.fg }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/15"
                                style={{ backgroundColor: c.bg }}
                              />
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[12px] font-medium text-muted">QR dots color</span>
                          <div className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border bg-surface min-w-0">
                            <input
                              type="color"
                              aria-label="QR foreground color picker"
                              value={qrFgColor}
                              onChange={(e) => setQrFgColor(e.target.value.toUpperCase())}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                            />
                            <input
                              type="text"
                              aria-label="QR foreground hex"
                              defaultValue={qrFgColor}
                              key={`fg-${qrFgColor}`}
                              onBlur={(e) => {
                                const norm = normalizeHexColor(e.target.value);
                                if (norm) setQrFgColor(norm);
                              }}
                              className="w-full min-w-0 text-[12px] font-mono text-ink bg-transparent outline-none uppercase"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const prevFg = qrFgColor;
                            setQrFgColor(qrBgColor);
                            setQrBgColor(prevFg);
                          }}
                          title="Swap QR colors"
                          aria-label="Swap QR colors"
                          className="h-9 w-9 rounded-lg border border-border bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-ink cursor-pointer shrink-0"
                        >
                          <ArrowLeftRight size={14} />
                        </button>

                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[12px] font-medium text-muted">QR background</span>
                          <div className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border bg-surface min-w-0">
                            <input
                              type="color"
                              aria-label="QR background color picker"
                              value={qrBgColor}
                              onChange={(e) => setQrBgColor(e.target.value.toUpperCase())}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                            />
                            <input
                              type="text"
                              aria-label="QR background hex"
                              defaultValue={qrBgColor}
                              key={`bg-${qrBgColor}`}
                              onBlur={(e) => {
                                const norm = normalizeHexColor(e.target.value);
                                if (norm) setQrBgColor(norm);
                              }}
                              className="w-full min-w-0 text-[12px] font-mono text-ink bg-transparent outline-none uppercase"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[12px] text-muted">Error correction</span>
                        <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border">
                          {(
                            [
                              { id: 'M', label: 'Standard (M)' },
                              { id: 'H', label: 'Print high (H)' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setQrEcc(opt.id)}
                              className={`px-2 py-0.5 rounded text-[12px] font-medium cursor-pointer ${
                                qrEcc === opt.id
                                  ? 'bg-ink text-surface'
                                  : 'text-muted hover:text-ink'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {lowContrast && (
                        <div className="flex items-center gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>
                            Low contrast ({contrastRatio}:1). Increase difference between dots &amp;
                            background for reliable scans.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tracked Links Accordion */}
                <div className="rounded-xl border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLinkSection('tracked')}
                    aria-expanded={openLinkSection === 'tracked'}
                    className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Link2 size={15} className="text-muted shrink-0" />
                      <span>Tracked link</span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform duration-150 ${
                        openLinkSection === 'tracked' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openLinkSection === 'tracked' && (
                    <div className="px-3.5 pb-4 pt-3 border-t border-border/70">
                      <TrackedLinkSection username={username} />
                    </div>
                  )}
                </div>

                {/* Link Preview Accordion */}
                <div className="rounded-xl border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLinkSection('preview')}
                    aria-expanded={openLinkSection === 'preview'}
                    className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Eye size={15} className="text-muted shrink-0" />
                      <span>Link preview</span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform duration-150 ${
                        openLinkSection === 'preview' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openLinkSection === 'preview' && (
                    <div className="px-3.5 pb-4 pt-3 border-t border-border/70">
                      <LinkPreviewSection
                        username={username}
                        displayName={displayName}
                        bio={bio}
                        avatarUrl={avatarUrl}
                        vibeId={vibeId}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="shrink-0 border-t border-border bg-surface px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
          {activeTab === 'share' ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleCopyLink}
                className="flex-1 min-w-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy link'}</span>
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadPng}
                disabled={!qrPngDataUrl || isGenerating}
                className="shrink-0"
              >
                <Download size={14} />
                <span>PNG</span>
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadSvg}
                disabled={!qrSvg || isGenerating}
                className="shrink-0"
              >
                <Download size={14} />
                <span>SVG</span>
              </Button>
            </div>
          ) : activeTab === 'card' ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => handleDownloadBusinessCard(cardSide)}
                disabled={isDownloadingCard}
                className="flex-1 min-w-0"
              >
                <Download size={14} />
                <span>
                  {isDownloadingCard
                    ? 'Rendering...'
                    : `Download ${cardSide === 'front' ? 'front' : 'back'}`}
                </span>
              </Button>
              {onSaveCardConfig && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleSaveCardDesign(cardConfig)}
                  disabled={isSavingCard}
                  className="shrink-0"
                >
                  <Save size={14} />
                  <span>{isSavingCard ? 'Saving...' : 'Save'}</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleCopyEmbedCode}
                className="flex-1 min-w-0"
              >
                {copiedEmbed ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedEmbed ? 'Copied' : 'Copy embed code'}</span>
              </Button>
              <Button
                as="a"
                href={embedSrc}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="md"
                className="shrink-0"
              >
                <ExternalLink size={14} />
                <span>Live preview</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

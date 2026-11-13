import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  MessageCircle,
  Send,
  Linkedin,
  Mail,
  MessageSquare,
  Download,
  Contact,
  IdCard,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { makeQrPngDataUrl } from '../../lib/qr';
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
import { pageUrl as buildCanonicalPageUrl } from '../../lib/site';
import { BusinessCardPreview } from '../share/BusinessCardPreview';
import { BusinessCardCustomizer } from '../share/BusinessCardCustomizer';
import type { Vibe } from '../../lib/vibes';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  vibe?: Vibe;
  businessCard?: BusinessCardConfig | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  bio,
  avatarUrl,
  vibe,
  businessCard,
}) => {
  const [activeTab, setActiveTab] = useState<'share' | 'card'>('share');
  const [copied, setCopied] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [downloadedCard, setDownloadedCard] = useState(false);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardConfig, setCardConfig] = useState<BusinessCardConfig>(() => ({
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(businessCard || {}),
  }));

  useEffect(() => {
    setCardConfig({
      ...DEFAULT_BUSINESS_CARD_CONFIG,
      ...(businessCard || {}),
    });
  }, [businessCard]);

  const cleanUsername = (username || '').toLowerCase().trim();
  const pageUrl = buildCanonicalPageUrl(cleanUsername);

  const shareText = `Check out ${displayName || cleanUsername}'s page on iveo`;

  // Generate QR code on mount/open
  useEffect(() => {
    if (!isOpen || !cleanUsername) return;
    let isMounted = true;

    makeQrPngDataUrl(pageUrl, {
      darkColor: vibe?.tokens?.text || '#0A0A0A',
      lightColor: '#FFFFFF',
    })
      .then((dataUrl) => {
        if (isMounted) setQrPngUrl(dataUrl);
      })
      .catch(() => {
        // Fallback to external reliable QR image
        if (isMounted) {
          setQrPngUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pageUrl)}&margin=8`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cleanUsername, pageUrl, vibe]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${displayName} (@${cleanUsername}) | iveo`,
          text: bio || `Check out ${displayName}'s page on iveo`,
          url: pageUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!qrPngUrl) return;
    const a = document.createElement('a');
    a.href = qrPngUrl;
    a.download = `iveo-${cleanUsername}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveContact = () => {
    downloadVCard({
      displayName: displayName || cleanUsername,
      username: cleanUsername,
      bio,
      pageUrl,
      avatarUrl,
      cardConfig,
    });
  };

  const cardTheme = {
    bg: vibe?.tokens?.bg || '#0F172A',
    text: vibe?.tokens?.text || '#FFFFFF',
    muted: vibe?.tokens?.muted || 'rgba(255, 255, 255, 0.72)',
    accent: vibe?.tokens?.buttonBg || '#4F46E5',
    buttonBg: vibe?.tokens?.buttonBg || '#4F46E5',
  };

  const handleDownloadCardPng = async () => {
    setIsGeneratingCard(true);
    setCardError(null);
    try {
      await downloadBusinessCardPng({
        displayName: displayName || cleanUsername,
        username: cleanUsername,
        bio,
        pageUrl,
        avatarUrl,
        qrDataUrl: qrPngUrl,
        theme: cardTheme,
        cardConfig,
      });
      setDownloadedCard(true);
      setTimeout(() => setDownloadedCard(false), 2200);
    } catch (err) {
      console.warn('Failed to generate business card image:', err);
      setCardError('Could not export image. Try Save to Phone Contacts (.vcf) above.');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const handleShareBusinessCard = async () => {
    const cardText = `Digital Business Card: ${displayName} (@${cleanUsername})\n${bio ? `${bio}\n` : ''}Connect: ${pageUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const pngDataUrl = await generateBusinessCardPng({
          displayName: displayName || cleanUsername,
          username: cleanUsername,
          bio,
          pageUrl,
          avatarUrl,
          qrDataUrl: qrPngUrl,
          theme: cardTheme,
          cardConfig,
        });
        const blob = dataUrlToBlob(pngDataUrl);
        const cardFile = new File([blob], `iveo-card-${cleanUsername}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [cardFile] })) {
          await navigator.share({
            title: `${displayName}'s Business Card`,
            text: cardText,
            files: [cardFile],
          });
          return;
        }
      } catch {}

      try {
        await navigator.share({
          title: `${displayName}'s Business Card`,
          text: cardText,
          url: pageUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(cardText);
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2000);
    } catch {}
  };

  const shareLinks = [
    {
      name: 'WhatsApp',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}: ${pageUrl}`)}`,
      icon: MessageCircle,
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100',
    },
    {
      name: 'X / Twitter',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`,
      icon: Share2,
      bg: 'bg-stone-50 text-stone-900 border-stone-200 hover:bg-stone-100',
    },
    {
      name: 'Telegram',
      url: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`,
      icon: Send,
      bg: 'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100',
    },
    {
      name: 'LinkedIn',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
      icon: Linkedin,
      bg: 'bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-100',
    },
    {
      name: 'Email',
      url: `mailto:?subject=${encodeURIComponent(`${displayName} on iveo`)}&body=${encodeURIComponent(`${shareText}\n\n${pageUrl}`)}`,
      icon: Mail,
      bg: 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100',
    },
    {
      name: 'SMS',
      url: `sms:?&body=${encodeURIComponent(`${shareText}: ${pageUrl}`)}`,
      icon: MessageSquare,
      bg: 'bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share options and business card"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[480px] bg-surface border-t sm:border border-border rounded-t-[28px] sm:rounded-b-[28px] shadow-2xl p-5 sm:p-6 flex flex-col max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className="w-10 h-1.5 rounded-full bg-border mx-auto -mt-1 mb-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || cleanUsername}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-border shadow-2xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ink/5 border border-border flex items-center justify-center font-bold text-ink text-[15px]">
                {(displayName || cleanUsername).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-[16px] font-semibold text-ink leading-tight">
                {displayName || cleanUsername}
              </h3>
              <p className="text-[12px] font-mono text-muted">iveo.site/{cleanUsername}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Tab Switcher: Share Page vs Business Card */}
        <div className="mt-3.5 p-1 bg-surface-2 rounded-xl flex items-center gap-1 border border-border/50">
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'share'
                ? 'bg-surface text-ink shadow-xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Share2 size={14} />
            <span>Share Page</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'card'
                ? 'bg-surface text-ink shadow-xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            <IdCard size={14} />
            <span>Business Card</span>
          </button>
        </div>

        {/* TAB 1: SHARE PAGE */}
        {activeTab === 'share' && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Link Copy Bar */}
            <div className="flex items-center gap-2 p-1.5 pl-3.5 bg-surface-2 border border-border rounded-xl">
              <span className="text-[13px] font-mono text-ink truncate flex-1 select-all">
                {pageUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-ink text-white hover:bg-ink/90 active:scale-95'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={2.5} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Social Share Grid */}
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted block mb-2">
                Share directly via
              </span>
              <div className="grid grid-cols-3 gap-2">
                {shareLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.name}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`py-2.5 px-2 rounded-xl border flex flex-col items-center gap-1 text-[12px] font-medium transition-all duration-150 active:scale-95 cursor-pointer ${item.bg}`}
                    >
                      <Icon size={18} strokeWidth={2} />
                      <span className="truncate">{item.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Native Share button if supported */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-2.5 px-4 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-[13px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 size={15} />
                <span>More sharing options...</span>
              </button>
            )}

            {/* QR Code Container */}
            <div className="p-3.5 bg-surface-2 border border-border rounded-2xl flex items-center gap-4">
              <div className="w-24 h-24 bg-white p-1 rounded-xl border border-border/80 shadow-2xs shrink-0 flex items-center justify-center">
                {qrPngUrl ? (
                  <img
                    src={qrPngUrl}
                    alt={`QR code for ${cleanUsername}`}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-100 rounded-lg animate-pulse" />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <span className="text-[13px] font-semibold text-ink leading-snug">
                  Scannable QR Code
                </span>
                <span className="text-[11px] text-muted mt-0.5">
                  Point camera to open iveo.site/{cleanUsername}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={!qrPngUrl}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
                >
                  <Download size={13} />
                  <span>Download QR image</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIGITAL BUSINESS CARD */}
        {activeTab === 'card' && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Visual Card Preview matching PNG output */}
            <BusinessCardPreview
              username={cleanUsername}
              displayName={displayName || cleanUsername}
              bio={bio}
              avatarUrl={avatarUrl}
              qrDataUrl={qrPngUrl}
              vibeTheme={cardTheme}
              config={cardConfig}
            />

            {/* Optional visitor personalization before downloading */}
            <BusinessCardCustomizer
              value={cardConfig}
              onChange={setCardConfig}
            />

            {/* Business Card Actions */}
            <div className="flex flex-col gap-2">
              {/* 1. Save Contact to Phone (.vcf) */}
              <button
                type="button"
                onClick={handleSaveContact}
                className="w-full py-2.5 px-4 rounded-xl bg-ink text-white font-medium text-[13px] flex items-center justify-center gap-2 hover:bg-ink/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
              >
                <Contact size={16} />
                <span>Save to Phone Contacts (.vcf)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* 2. Download Card Image (PNG 2040x1200) */}
                <button
                  type="button"
                  onClick={handleDownloadCardPng}
                  disabled={isGeneratingCard}
                  className="py-2.5 px-3 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {downloadedCard ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span>Downloaded HD PNG</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>{isGeneratingCard ? 'Rendering HD...' : 'Download HD PNG'}</span>
                    </>
                  )}
                </button>

                {/* 3. Share Card Details / Image */}
                <button
                  type="button"
                  onClick={handleShareBusinessCard}
                  className="py-2.5 px-3 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedCard ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span>Copied info</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span>Share Card</span>
                    </>
                  )}
                </button>
              </div>

              {cardError && (
                <p className="text-center text-[11px] text-red-600 font-medium">{cardError}</p>
              )}

              <p className="text-center text-[11px] text-muted mt-1 leading-normal">
                Exports a pixel-true 2040×1200 PNG card matching your preview with a scannable QR code.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

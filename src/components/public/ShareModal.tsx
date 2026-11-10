import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Send } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const pageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${username}`
    : `https://iveo.site/${username}`;

  const shareText = `Check out ${displayName}'s page on Iveo`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareLinks = [
    {
      name: 'WhatsApp',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}: ${pageUrl}`)}`,
      icon: MessageCircle,
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100',
    },
    {
      name: 'X (Twitter)',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`,
      icon: Share2,
      bg: 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100',
    },
    {
      name: 'Telegram',
      url: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`,
      icon: Send,
      bg: 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100',
    },
  ];

  // Simple QR code using public reliable QR service SVG
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}&margin=8`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share page"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-5 flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-ink leading-tight">
                Share this page
              </h3>
              <p className="text-[12px] text-muted">iveo.site/{username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* QR Code */}
        <div className="mt-4 p-2 bg-white rounded-xl border border-border shadow-xs flex flex-col items-center">
          <img
            src={qrSvgUrl}
            alt={`QR code for ${username}`}
            width={160}
            height={160}
            className="w-40 h-40 object-contain rounded-lg"
          />
          <span className="text-[11px] text-stone-500 font-mono mt-1">Scan with phone camera</span>
        </div>

        {/* Link Copy Box */}
        <div className="w-full mt-4 flex items-center gap-2 p-1.5 pl-3 bg-surface-2 border border-border rounded-xl">
          <span className="text-[13px] font-mono text-ink truncate flex-1">
            {pageUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-ink text-white hover:bg-ink/90'
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

        {/* Social Share Buttons */}
        <div className="w-full grid grid-cols-3 gap-2 mt-4">
          {shareLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`py-2 px-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-medium transition-all duration-150 ${item.bg}`}
              >
                <Icon size={16} />
                <span className="truncate">{item.name}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

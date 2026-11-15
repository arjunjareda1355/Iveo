import React from 'react';
import { Copy } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { VerifiedTick } from '../ui/VerifiedTick';
import { pageUrl } from '../../lib/site';
import { copy } from '../../content/copy';

interface AddressPillProps {
  username: string;
  isPro?: boolean;
}

export const AddressPill: React.FC<AddressPillProps> = ({ username, isPro = false }) => {
  const { showToast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl(username));
      showToast(copy.toasts.linkCopied);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex items-center gap-1.5 select-none">
      {/* Desktop pill */}
      <a
        href={pageUrl(username)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open your public page in a new tab"
        className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-surface border border-border px-3 text-[13px] font-mono text-ink shadow-xs hover:border-ink transition-colors cursor-pointer"
      >
        <span>iveo.site/{username}</span>
        {isPro && <VerifiedTick size={13} />}
      </a>

      {/* Copy icon button (both desktop and mobile) */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy page link"
        className="w-9 h-9 flex items-center justify-center rounded-[10px] text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink cursor-pointer border sm:border-transparent border-border"
      >
        <Copy size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
};

import React from 'react';
import { Copy } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { pageUrl } from '../../lib/site';
import { copy } from '../../content/copy';

interface AddressPillProps {
  username: string;
}

export const AddressPill: React.FC<AddressPillProps> = ({ username }) => {
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
      <div className="hidden sm:flex h-9 items-center rounded-full bg-surface border border-border px-3 text-[13px] font-mono text-ink shadow-xs">
        {username}.iveo.site
      </div>

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

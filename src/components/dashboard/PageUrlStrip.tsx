import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { pageDisplayUrl, pageUrl } from '../../lib/site';

interface PageUrlStripProps {
  username?: string | null;
  className?: string;
}

export const PageUrlStrip: React.FC<PageUrlStripProps> = ({ username, className = '' }) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const clean = (username || '').replace(/^[@/]+/, '').trim().toLowerCase();
  const href = clean ? pageUrl(clean) : 'https://iveo.site';
  const display = clean ? pageDisplayUrl(clean) : 'iveo.site';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      showToast('Page link copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Couldn't copy link");
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-2 min-h-[48px] px-3.5 py-1.5 rounded-[14px] bg-surface border border-border ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[12px] font-medium text-muted shrink-0 hidden sm:inline">
          Your page
        </span>
        <span className="text-border hidden sm:inline" aria-hidden="true">
          /
        </span>
        <span
          className="font-mono text-[13px] sm:text-[14px] font-medium text-ink truncate select-all"
          title={href}
        >
          {display}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy your page link"
          title="Copy link"
          className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[10px] text-ink hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
        >
          {copied ? (
            <Check size={18} strokeWidth={1.75} className="text-[color:var(--success,#047857)]" />
          ) : (
            <Copy size={18} strokeWidth={1.5} />
          )}
        </button>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open your public page in a new tab"
          title="Open page"
          className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[10px] text-ink hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
        >
          <ExternalLink size={18} strokeWidth={1.5} />
        </a>
      </div>
    </div>
  );
};

import React from 'react';
import { pageUrl } from '../../lib/site';

interface AddressPillProps {
  username: string;
  isPro?: boolean;
}

export const AddressPill: React.FC<AddressPillProps> = ({ username }) => {
  return (
    <div className="flex items-center select-none min-w-0">
      <a
        href={pageUrl(username)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open your public page in a new tab"
        className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-surface border border-border px-3 text-[13px] font-mono text-ink shadow-xs hover:border-ink transition-colors cursor-pointer max-w-[240px]"
      >
        <span className="truncate">iveo.site/@{username}</span>
      </a>
    </div>
  );
};

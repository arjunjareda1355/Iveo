import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { pageUrl } from '../../lib/site';
import { TrackSource } from '../../lib/analytics/sources';
import { copy } from '../../content/copy';

interface TrackedLinkSectionProps {
  username: string;
}

const TRACKED_OPTIONS: Array<{ value: TrackSource; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'threads', label: 'Threads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'discord', label: 'Discord' },
  { value: 'github', label: 'GitHub' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export const TrackedLinkSection: React.FC<TrackedLinkSectionProps> = ({ username }) => {
  const { showToast } = useToast();
  const [selectedSource, setSelectedSource] = useState<TrackSource>('instagram');

  const trackedUrl = pageUrl(username, { src: selectedSource });
  const displayUrl = trackedUrl.replace(/^https?:\/\//i, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackedUrl);
      showToast(copy.dashboard.analytics.trackedLinks.copiedToast);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="border border-border rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor="tracked-source-select"
          className="text-[14px] font-medium text-ink leading-tight"
        >
          {copy.dashboard.analytics.trackedLinks.title}
        </label>
        <p className="text-[13px] text-muted leading-normal">
          {copy.dashboard.analytics.trackedLinks.helper}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tracked-source-select" className="sr-only">
          {copy.dashboard.analytics.trackedLinks.sourceLabel}
        </label>
        <select
          id="tracked-source-select"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value as TrackSource)}
          className="w-full h-12 rounded-[10px] bg-surface border border-border px-3.5 text-[14px] text-ink transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
        >
          {TRACKED_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-surface-2 border border-border overflow-hidden">
        <span className="font-mono text-[13px] text-muted truncate flex-1 select-all">
          {displayUrl}
        </span>
      </div>

      <Button
        variant="secondary"
        size="md"
        fullWidth
        onClick={handleCopy}
        className="flex items-center justify-center gap-2"
      >
        <Copy size={14} strokeWidth={1.5} />
        <span>{copy.dashboard.analytics.trackedLinks.copyButton}</span>
      </Button>
    </div>
  );
};

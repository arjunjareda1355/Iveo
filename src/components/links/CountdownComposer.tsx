import React, { useState } from 'react';
import { Timer } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CountdownConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface CountdownComposerProps {
  onAdd: (data: {
    title: string;
    url: string | null;
    countdown: CountdownConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string | null;
    countdown?: CountdownConfig | null;
  };
  isEditing?: boolean;
}

function defaultFutureDatetimeLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return defaultFutureDatetimeLocal();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultFutureDatetimeLocal();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const CountdownComposer: React.FC<CountdownComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialValues?.title || 'New Launch Dropping Soon');
  const [targetLocal, setTargetLocal] = useState(isoToLocalInput(initialValues?.countdown?.targetAt));
  const [venueOrSubtitle, setVenueOrSubtitle] = useState(
    initialValues?.countdown?.venueOrSubtitle || 'Limited drop · Reserve early access'
  );
  const [expiredLabel, setExpiredLabel] = useState(
    initialValues?.countdown?.expiredLabel || 'Out Now!'
  );
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.countdown?.buttonLabel || 'Notify Me'
  );
  const [url, setUrl] = useState(initialValues?.url || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Event or launch title is required.');
      return;
    }
    const parsedDate = new Date(targetLocal);
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Choose a valid target date and time.');
      return;
    }

    try {
      await onAdd({
        title: title.trim(),
        url: url.trim() ? formatExternalUrl(url) : null,
        countdown: {
          targetAt: parsedDate.toISOString(),
          venueOrSubtitle: venueOrSubtitle.trim() || null,
          expiredLabel: expiredLabel.trim() || 'Live Now',
          buttonLabel: url.trim() ? buttonLabel.trim() || 'Open Link' : null,
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save countdown block.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-700 flex items-center justify-center shrink-0">
          <Timer size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Live Countdown' : 'Add Live Event / Drop Countdown'}
          </h3>
          <p className="text-[12px] text-muted">
            Display a real-time ticking countdown for drops, tours, livestreams, or launches
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-title" className="text-[13px] font-medium text-ink">
              Launch / Event Title
            </label>
            <input
              id="cd-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Album Release"
              maxLength={60}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-date" className="text-[13px] font-medium text-ink">
              Target Date &amp; Time
            </label>
            <input
              id="cd-date"
              type="datetime-local"
              value={targetLocal}
              onChange={(e) => setTargetLocal(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-sub" className="text-[13px] font-medium text-ink">
              Subtitle / Venue (Optional)
            </label>
            <input
              id="cd-sub"
              type="text"
              value={venueOrSubtitle}
              onChange={(e) => setVenueOrSubtitle(e.target.value)}
              placeholder="e.g. Doors open at 8 PM IST"
              maxLength={60}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-expired" className="text-[13px] font-medium text-ink">
              Message When Complete
            </label>
            <input
              id="cd-expired"
              type="text"
              value={expiredLabel}
              onChange={(e) => setExpiredLabel(e.target.value)}
              placeholder="Out Now!"
              maxLength={32}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-url" className="text-[13px] font-medium text-ink">
              Destination URL (Optional)
            </label>
            <input
              id="cd-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tickets.example.com"
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-cta" className="text-[13px] font-medium text-ink">
              Button Text (If URL added)
            </label>
            <input
              id="cd-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Notify Me"
              maxLength={24}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Countdown'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

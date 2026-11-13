import React, { useState } from 'react';
import { CalendarClock, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { BookingConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface BookingCardComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    booking: BookingConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    booking?: BookingConfig | null;
  };
  isEditing?: boolean;
}

export const BookingCardComposer: React.FC<BookingCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialValues?.title || '1:1 Strategy Call');
  const [url, setUrl] = useState(initialValues?.url || '');
  const [duration, setDuration] = useState(initialValues?.booking?.duration || '30 min');
  const [priceLabel, setPriceLabel] = useState(initialValues?.booking?.priceLabel || 'Free');
  const [platform, setPlatform] = useState(initialValues?.booking?.platform || 'Google Meet');
  const [description, setDescription] = useState(
    initialValues?.booking?.description || 'Pick a time slot that works for you'
  );
  const [buttonLabel, setButtonLabel] = useState(initialValues?.booking?.buttonLabel || 'Book Slot');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Session title is required.');
      return;
    }
    if (!url.trim()) {
      setError('Booking link (Calendly, Cal.com, Topmate, etc.) is required.');
      return;
    }

    try {
      await onAdd({
        title: title.trim(),
        url: formatExternalUrl(url),
        booking: {
          duration: duration.trim() || '30 min',
          priceLabel: priceLabel.trim() || null,
          platform: platform.trim() || null,
          description: description.trim() || null,
          buttonLabel: buttonLabel.trim() || 'Book Slot',
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save booking card.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-700 flex items-center justify-center shrink-0">
          <CalendarClock size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit 1:1 Booking Card' : 'Add 1:1 Booking Card'}
          </h3>
          <p className="text-[12px] text-muted">
            Connect Cal.com, Calendly, Topmate, or Google Appointment slots with duration &amp; rate
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
            <label htmlFor="book-title" className="text-[13px] font-medium text-ink">
              Session Title
            </label>
            <input
              id="book-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Portfolio Review"
              maxLength={60}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="book-url" className="text-[13px] font-medium text-ink">
              Calendar / Booking URL
            </label>
            <input
              id="book-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="cal.com/yourname/30min"
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="book-duration" className="text-[13px] font-medium text-ink">
              Duration
            </label>
            <input
              id="book-duration"
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30 min"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="book-price" className="text-[13px] font-medium text-ink">
              Fee
            </label>
            <input
              id="book-price"
              type="text"
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              placeholder="Free or $50"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="book-platform" className="text-[13px] font-medium text-ink">
              Call App
            </label>
            <input
              id="book-platform"
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Google Meet"
              maxLength={24}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="book-cta" className="text-[13px] font-medium text-ink">
              Button Text
            </label>
            <input
              id="book-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Book Slot"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="book-desc" className="text-[13px] font-medium text-ink">
            Session Summary (Optional)
          </label>
          <input
            id="book-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you'll cover during the session"
            maxLength={80}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Preview */}
        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <CalendarClock size={19} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">{title || '1:1 Call'}</div>
              <div className="text-[11px] text-muted truncate">
                {[duration, priceLabel, platform].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[12px] font-semibold shrink-0 inline-flex items-center gap-1">
            <span>{buttonLabel || 'Book'}</span>
            <ExternalLink size={11} />
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Booking Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

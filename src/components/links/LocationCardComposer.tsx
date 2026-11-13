import React, { useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LocationConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface LocationCardComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    location: LocationConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string | null;
    location?: LocationConfig | null;
  };
  isEditing?: boolean;
}

export const LocationCardComposer: React.FC<LocationCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [placeName, setPlaceName] = useState(
    initialValues?.location?.placeName || initialValues?.title || ''
  );
  const [address, setAddress] = useState(initialValues?.location?.address || '');
  const [hours, setHours] = useState(initialValues?.location?.hours || '');
  const [url, setUrl] = useState(initialValues?.url || '');
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.location?.buttonLabel || 'Open in Maps'
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!placeName.trim()) {
      setError('Place or studio name is required.');
      return;
    }
    if (!address.trim()) {
      setError('Street address or city is required.');
      return;
    }

    const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${placeName.trim()} ${address.trim()}`
    )}`;
    const resolvedUrl = url.trim() ? formatExternalUrl(url) : fallbackMapsUrl;

    try {
      await onAdd({
        title: placeName.trim(),
        url: resolvedUrl,
        location: {
          placeName: placeName.trim(),
          address: address.trim(),
          hours: hours.trim() || null,
          buttonLabel: buttonLabel.trim() || 'Open in Maps',
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save location card.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-700 flex items-center justify-center shrink-0">
          <MapPin size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Location & Hours' : 'Add Studio / Store Location'}
          </h3>
          <p className="text-[12px] text-muted">
            Share your physical studio, pop-up, café, or office address with a 1-tap Maps link
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
            <label htmlFor="loc-name" className="text-[13px] font-medium text-ink">
              Place / Studio Name
            </label>
            <input
              id="loc-name"
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="e.g. Iveo Design Studio"
              maxLength={60}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="loc-hours" className="text-[13px] font-medium text-ink">
              Hours (Optional)
            </label>
            <input
              id="loc-hours"
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Mon–Sat · 10 AM – 7 PM"
              maxLength={40}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="loc-addr" className="text-[13px] font-medium text-ink">
            Street Address / Area
          </label>
          <input
            id="loc-addr"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="42 Studio Lane, Bandra West, Mumbai"
            maxLength={100}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="loc-url" className="text-[13px] font-medium text-ink">
              Maps URL (Auto-generated if empty)
            </label>
            <input
              id="loc-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="maps.app.goo.gl/..."
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="loc-cta" className="text-[13px] font-medium text-ink">
              Button Label
            </label>
            <input
              id="loc-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Open in Maps"
              maxLength={24}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
              <MapPin size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">
                {placeName || 'Studio Location'}
              </div>
              <div className="text-[11px] text-muted truncate">
                {address || 'Street address'} {hours ? `· ${hours}` : ''}
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-sky-600 text-white text-[11px] font-semibold shrink-0 inline-flex items-center gap-1">
            <span>{buttonLabel || 'Maps'}</span>
            <ExternalLink size={10} />
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Location Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

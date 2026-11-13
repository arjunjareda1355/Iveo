import React, { useState } from 'react';
import { Ticket, Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { PromoConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface PromoCodeComposerProps {
  onAdd: (data: {
    title: string;
    url: string | null;
    promo: PromoConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string | null;
    promo?: PromoConfig | null;
  };
  isEditing?: boolean;
}

export const PromoCodeComposer: React.FC<PromoCodeComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialValues?.title || '20% Off Storewide');
  const [code, setCode] = useState(initialValues?.promo?.code || 'IVEO20');
  const [discountLabel, setDiscountLabel] = useState(initialValues?.promo?.discountLabel || '20% OFF');
  const [merchant, setMerchant] = useState(initialValues?.promo?.merchant || '');
  const [expiresLabel, setExpiresLabel] = useState(initialValues?.promo?.expiresLabel || '');
  const [url, setUrl] = useState(initialValues?.url || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Offer headline is required.');
      return;
    }
    if (!code.trim()) {
      setError('Promo code is required.');
      return;
    }

    try {
      await onAdd({
        title: title.trim(),
        url: url.trim() ? formatExternalUrl(url) : null,
        promo: {
          code: code.trim().toUpperCase(),
          discountLabel: discountLabel.trim() || null,
          merchant: merchant.trim() || null,
          expiresLabel: expiresLabel.trim() || null,
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save promo code card.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-pink-500/15 text-pink-700 flex items-center justify-center shrink-0">
          <Ticket size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Promo / Discount Code' : 'Add Promo / Coupon Code'}
          </h3>
          <p className="text-[12px] text-muted">
            Visitors can copy your affiliate or creator coupon code with 1 tap
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
            <label htmlFor="promo-title" className="text-[13px] font-medium text-ink">
              Deal Headline
            </label>
            <input
              id="promo-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Save 20% on Camera Gear"
              maxLength={60}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-code" className="text-[13px] font-medium text-ink">
              Coupon Code
            </label>
            <input
              id="promo-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="IVEO20"
              maxLength={28}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] font-mono uppercase text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-badge" className="text-[13px] font-medium text-ink">
              Discount Badge
            </label>
            <input
              id="promo-badge"
              type="text"
              value={discountLabel}
              onChange={(e) => setDiscountLabel(e.target.value)}
              placeholder="20% OFF"
              maxLength={18}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-brand" className="text-[13px] font-medium text-ink">
              Brand / Store (Optional)
            </label>
            <input
              id="promo-brand"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Moment Store"
              maxLength={32}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="promo-exp" className="text-[13px] font-medium text-ink">
              Expiry Note (Optional)
            </label>
            <input
              id="promo-exp"
              type="text"
              value={expiresLabel}
              onChange={(e) => setExpiresLabel(e.target.value)}
              placeholder="Ends Sunday"
              maxLength={28}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="promo-url" className="text-[13px] font-medium text-ink">
            Shop / Partner Link (Optional)
          </label>
          <input
            id="promo-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://store.example.com"
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="p-3 rounded-xl border border-dashed border-pink-400/50 bg-pink-500/5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {discountLabel && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-pink-600 text-white">
                  {discountLabel}
                </span>
              )}
              <span className="text-[13px] font-semibold text-ink truncate">{title || 'Deal Headline'}</span>
            </div>
            {(merchant || expiresLabel) && (
              <span className="text-[11px] text-muted">
                {[merchant, expiresLabel].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-ink/30 bg-surface font-mono text-[12px] font-bold text-ink shrink-0">
            <span>{code || 'CODE'}</span>
            <Copy size={12} />
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Promo Code'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

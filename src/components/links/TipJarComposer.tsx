import React, { useState } from 'react';
import { Heart, Sparkles, DollarSign } from 'lucide-react';
import { TipJarConfig } from '../../data/types';
import { Button } from '../ui/Button';

interface TipJarComposerProps {
  onAdd: (config: TipJarConfig, title: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: TipJarConfig | null;
  initialTitle?: string;
  isEditing?: boolean;
}

const PRESET_OPTIONS = [
  { label: '$3, $5, $10, $25', amounts: [3, 5, 10, 25] },
  { label: '$5, $10, $20, $50', amounts: [5, 10, 20, 50] },
  { label: '₹50, ₹100, ₹250, ₹500', amounts: [50, 100, 250, 500] },
  { label: '€3, €5, €10, €20', amounts: [3, 5, 10, 20] },
];

export const TipJarComposer: React.FC<TipJarComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  initialTitle,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialTitle || initialValues?.buttonText || 'Support My Work');
  const [paymentUrl, setPaymentUrl] = useState(initialValues?.paymentUrl || '');
  const [currency, setCurrency] = useState(initialValues?.currency || '$');
  const [description, setDescription] = useState(initialValues?.description || 'If you enjoy what I do, consider leaving a small tip!');
  const [amounts, setAmounts] = useState<number[]>(initialValues?.amounts?.length ? initialValues.amounts : [3, 5, 10, 25]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUrl = paymentUrl.trim();
    if (!cleanUrl) {
      setError('Please provide a payment or donation link (PayPal, UPI, Buy Me a Coffee, Ko-fi, etc.)');
      return;
    }

    try {
      await onAdd(
        {
          amounts,
          currency,
          buttonText: title.trim() || 'Support My Work',
          paymentUrl: cleanUrl,
          description: description.trim() || null,
        },
        title.trim() || 'Support My Work'
      );
    } catch (err: any) {
      setError(err?.message || "Couldn't create tip jar. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 bg-surface border border-border rounded-xl shadow-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Heart size={18} className="text-red-500 fill-red-500" />
        <h3 className="text-sm font-semibold text-ink">Add Support / Tip Jar Block</h3>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink/80">Heading / Button Label</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Support My Work, Buy Me a Coffee"
          maxLength={40}
          className="text-xs px-3 py-2 bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>

      {/* Payment Link */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink/80">Payment / Donation Destination URL</label>
        <input
          type="text"
          value={paymentUrl}
          onChange={(e) => setPaymentUrl(e.target.value)}
          placeholder="https://paypal.me/yourname or buymeacoffee.com/user or UPI link"
          className="text-xs px-3 py-2 bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <p className="text-[11px] text-muted">
          Works with PayPal.me, Buy Me a Coffee, Ko-fi, Razorpay, Stripe Payment Links, CashApp, or direct UPI.
        </p>
      </div>

      {/* Currency & Preset Amounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink/80">Currency Symbol</label>
          <div className="flex gap-1.5">
            {['$', '₹', '€', '£', 'C$'].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => setCurrency(sym)}
                className={`flex-1 py-1 text-xs rounded-lg border font-semibold cursor-pointer ${
                  currency === sym
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface text-ink/80 border-border'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink/80">Preset Amounts</label>
          <select
            value={amounts.join(',')}
            onChange={(e) => setAmounts(e.target.value.split(',').map((n) => parseInt(n, 10)))}
            className="text-xs px-2.5 py-1.5 bg-surface border border-border rounded-lg text-ink"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.amounts.join(',')}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink/80">Short Message (Optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Any support helps keep my content free!"
          maxLength={100}
          className="text-xs px-3 py-2 bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add Tip Jar'}
        </Button>
      </div>
    </form>
  );
};

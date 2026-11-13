import React, { useState } from 'react';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProductConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface ProductCardComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    product: ProductConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    product?: ProductConfig | null;
  };
  isEditing?: boolean;
}

export const ProductCardComposer: React.FC<ProductCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [url, setUrl] = useState(initialValues?.url || '');
  const [price, setPrice] = useState(initialValues?.product?.price || '$29');
  const [compareAtPrice, setCompareAtPrice] = useState(initialValues?.product?.compareAtPrice || '');
  const [tag, setTag] = useState(initialValues?.product?.tag || 'Digital Product');
  const [imageUrl, setImageUrl] = useState(initialValues?.product?.imageUrl || '');
  const [description, setDescription] = useState(initialValues?.product?.description || '');
  const [buttonLabel, setButtonLabel] = useState(initialValues?.product?.buttonLabel || 'Buy Now');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!url.trim()) {
      setError('Checkout or product URL is required.');
      return;
    }
    if (!price.trim()) {
      setError('Price is required (e.g. $29 or Free).');
      return;
    }

    try {
      await onAdd({
        title: title.trim(),
        url: formatExternalUrl(url),
        product: {
          price: price.trim(),
          compareAtPrice: compareAtPrice.trim() || null,
          tag: tag.trim() || null,
          imageUrl: imageUrl.trim() ? formatExternalUrl(imageUrl) : null,
          description: description.trim() || null,
          buttonLabel: buttonLabel.trim() || 'Buy Now',
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save product card.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
          <ShoppingBag size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Product / Merch Card' : 'Add Product / Merch Card'}
          </h3>
          <p className="text-[12px] text-muted">
            Feature a digital product, course, print, or merch item with price &amp; checkout CTA
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
            <label htmlFor="prod-title" className="text-[13px] font-medium text-ink">
              Product Title
            </label>
            <input
              id="prod-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Creator Notion Kit"
              maxLength={64}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-url" className="text-[13px] font-medium text-ink">
              Checkout / Store URL
            </label>
            <input
              id="prod-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="gumroad.com/l/notion-kit"
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-price" className="text-[13px] font-medium text-ink">
              Price
            </label>
            <input
              id="prod-price"
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$29"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-compare" className="text-[13px] font-medium text-ink">
              Compare Price (Optional)
            </label>
            <input
              id="prod-compare"
              type="text"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              placeholder="$49"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label htmlFor="prod-cta" className="text-[13px] font-medium text-ink">
              Button Label
            </label>
            <input
              id="prod-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Buy Now"
              maxLength={24}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-tag" className="text-[13px] font-medium text-ink">
              Tag / Category (Optional)
            </label>
            <input
              id="prod-tag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Bestseller · Instant Download"
              maxLength={32}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-image" className="text-[13px] font-medium text-ink">
              Cover Image URL (Optional)
            </label>
            <input
              id="prod-image"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="prod-desc" className="text-[13px] font-medium text-ink">
            Short Description (Optional)
          </label>
          <input
            id="prod-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="40+ templates & workflow checklists"
            maxLength={90}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Preview */}
        <div className="p-3.5 rounded-xl border border-border bg-surface-2/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {imageUrl.trim() ? (
              <img
                src={formatExternalUrl(imageUrl)}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} />
              </div>
            )}
            <div className="min-w-0">
              {tag && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  {tag}
                </span>
              )}
              <div className="text-[14px] font-semibold text-ink truncate">
                {title || 'Your Product Name'}
              </div>
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="font-bold text-ink">{price || '$29'}</span>
                {compareAtPrice && (
                  <span className="line-through text-muted">{compareAtPrice}</span>
                )}
                {description && <span className="text-muted truncate">· {description}</span>}
              </div>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-ink text-surface text-[12px] font-semibold shrink-0 inline-flex items-center gap-1">
            <span>{buttonLabel || 'Buy Now'}</span>
            <ExternalLink size={11} />
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Product Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

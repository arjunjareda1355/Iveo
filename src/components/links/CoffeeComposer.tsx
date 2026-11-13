import React, { useState } from 'react';
import { Coffee, Heart } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface CoffeeComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    badge?: string;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    badge?: string;
  };
  isEditing?: boolean;
}

export const CoffeeComposer: React.FC<CoffeeComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [title, setTitle] = useState(initialValues?.title || 'Buy Me a Coffee');
  const [caption, setCaption] = useState(initialValues?.badge || 'Support my work · $3, $5, $10');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Please enter your Buy Me a Coffee or Ko-fi link.');
      return;
    }

    try {
      await onAdd({
        title: title.trim() || 'Buy Me a Coffee',
        url: cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`,
        badge: caption.trim() || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save coffee block. Try again.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
          <Coffee size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Buy Me a Coffee Block' : 'Add Buy Me a Coffee Block'}
          </h3>
          <p className="text-[12px] text-muted">
            Let supporters tip or buy you a coffee to help fuel your projects
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="coffee-url" className="text-[13px] font-medium text-ink">
            Tipping / Coffee Page URL
          </label>
          <input
            id="coffee-url"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="buymeacoffee.com/yourname or ko-fi.com/yourname"
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="coffee-title" className="text-[13px] font-medium text-ink">
            Block Title
          </label>
          <input
            id="coffee-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Buy Me a Coffee or Support my Work"
            maxLength={60}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="coffee-caption" className="text-[13px] font-medium text-ink">
            Subtitle / Price Note (Optional)
          </label>
          <input
            id="coffee-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Any support helps me keep making art!"
            maxLength={70}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Preview */}
        <div className="pt-2">
          <span className="text-[12px] font-medium text-muted block mb-1.5">Live Preview</span>
          <div className="w-full p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Coffee size={20} strokeWidth={2} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[14px] text-ink truncate leading-tight">
                  {title || 'Buy Me a Coffee'}
                </span>
                <span className="text-[12px] text-muted truncate">
                  {caption || 'Support with a coffee'}
                </span>
              </div>
            </div>

            <span className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500 text-white shrink-0">
              Support ☕
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !url.trim()}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Coffee Block'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

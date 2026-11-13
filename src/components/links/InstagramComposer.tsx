import React, { useState } from 'react';
import { Instagram, Sparkles, Check, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface InstagramComposerProps {
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

export const InstagramComposer: React.FC<InstagramComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  // Extract handle if url was provided
  const rawUrl = initialValues?.url || '';
  const initialHandle = rawUrl.replace(/https?:\/\/(www\.)?instagram\.com\/?/, '').replace(/\/$/, '');

  const [handle, setHandle] = useState(initialHandle || '');
  const [title, setTitle] = useState(initialValues?.title || 'Instagram');
  const [caption, setCaption] = useState(initialValues?.badge || 'Follow for stories & updates');
  const [buttonLabel, setButtonLabel] = useState('Follow');
  const [error, setError] = useState<string | null>(null);

  const cleanHandle = handle.replace(/^@/, '').trim();
  const finalUrl = cleanHandle
    ? (cleanHandle.startsWith('http') ? cleanHandle : `https://instagram.com/${cleanHandle}`)
    : 'https://instagram.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cleanHandle) {
      setError('Please enter your Instagram username or profile link.');
      return;
    }

    try {
      await onAdd({
        title: title.trim() || `@${cleanHandle}`,
        url: finalUrl,
        badge: caption.trim() || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save Instagram block. Try again.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
          <Instagram size={17} strokeWidth={2.2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit Instagram Card' : 'Add Instagram Showcase Card'}
          </h3>
          <p className="text-[12px] text-muted">
            Showcase your Instagram profile with a branded gradient card and direct Follow action
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Instagram Handle Input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ig-handle" className="text-[13px] font-medium text-ink">
            Instagram Username or URL
          </label>
          <div className="flex items-center rounded-lg border border-border bg-surface px-3 h-10 focus-within:border-ink">
            <span className="text-[14px] text-muted font-medium select-none mr-1">@</span>
            <input
              id="ig-handle"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (error) setError(null);
                if (!title || title === 'Instagram' || title.startsWith('@')) {
                  const cleaned = e.target.value.replace(/^@/, '').replace(/https?:\/\/(www\.)?instagram\.com\/?/, '').trim();
                  if (cleaned) setTitle(`@${cleaned}`);
                }
              }}
              placeholder="username (e.g. mayaellis or instagram.com/mayaellis)"
              className="flex-1 text-[14px] text-ink bg-transparent outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Card Title */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ig-title" className="text-[13px] font-medium text-ink">
            Display Title / Name
          </label>
          <input
            id="ig-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Maya Ellis or @mayaellis"
            maxLength={60}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Subtitle / Bio note */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ig-caption" className="text-[13px] font-medium text-ink">
            Subtitle / Tagline (Optional)
          </label>
          <input
            id="ig-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Follow for daily prints & stories"
            maxLength={70}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Preview Card */}
        <div className="pt-2">
          <span className="text-[12px] font-medium text-muted block mb-1.5">Live Preview</span>
          <div className="w-full p-3.5 rounded-xl border border-border/80 bg-surface-2 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Instagram size={20} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[14px] text-ink truncate leading-tight">
                  {title || (cleanHandle ? `@${cleanHandle}` : 'Instagram')}
                </span>
                <span className="text-[12px] text-muted truncate">
                  {caption || 'Follow for stories & updates'}
                </span>
              </div>
            </div>

            <span className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-ink text-white shrink-0">
              Follow
            </span>
          </div>
        </div>

        {/* Buttons */}
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
            disabled={isSubmitting || !cleanHandle}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Instagram Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

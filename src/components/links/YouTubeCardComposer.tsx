import React, { useState } from 'react';
import { Youtube, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { normalizeYouTubeUrl } from '../../lib/urls';

interface YouTubeCardComposerProps {
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

export const YouTubeCardComposer: React.FC<YouTubeCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [title, setTitle] = useState(initialValues?.title || 'YouTube Channel');
  const [caption, setCaption] = useState(initialValues?.badge || 'Subscribe for weekly videos & tutorials');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedUrl = normalizeYouTubeUrl(url);
    if (!normalizedUrl) {
      setError('Please enter your YouTube handle, channel, or video link.');
      return;
    }

    try {
      await onAdd({
        title: title.trim() || 'YouTube Channel',
        url: normalizedUrl,
        badge: caption.trim() || undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save YouTube block. Try again.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
          <Youtube size={18} strokeWidth={2.2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit YouTube Showcase' : 'Add YouTube Showcase Card'}
          </h3>
          <p className="text-[12px] text-muted">
            Feature your YouTube channel or latest video with an official red YouTube badge and Subscribe button
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
          <label htmlFor="yt-url" className="text-[13px] font-medium text-ink">
            YouTube Channel or Video URL
          </label>
          <input
            id="yt-url"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="youtube.com/@channel or youtu.be/video_id"
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="yt-title" className="text-[13px] font-medium text-ink">
            Channel or Video Title
          </label>
          <input
            id="yt-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Maya Ellis Art or Latest VLOG"
            maxLength={60}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="yt-caption" className="text-[13px] font-medium text-ink">
            Subtitle / Tagline (Optional)
          </label>
          <input
            id="yt-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. 50k subscribers · New videos every Friday"
            maxLength={70}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Preview */}
        <div className="pt-2">
          <span className="text-[12px] font-medium text-muted block mb-1.5">Live Preview</span>
          <div className="w-full p-3.5 rounded-xl border border-red-600/20 bg-red-600/5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Youtube size={20} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[14px] text-ink truncate leading-tight">
                  {title || 'YouTube Channel'}
                </span>
                <span className="text-[12px] text-muted truncate">
                  {caption || 'Subscribe for updates'}
                </span>
              </div>
            </div>

            <span className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-600 text-white shrink-0">
              Subscribe
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
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add YouTube Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseEmbedUrl, ParsedEmbed } from '../../lib/embeds';

interface EmbedComposerProps {
  onAdd: (data: {
    url: string;
    caption: string;
    provider: 'youtube' | 'spotify' | 'soundcloud';
  }) => Promise<void>;
  onCancel: () => void;
}

export const EmbedComposer: React.FC<EmbedComposerProps> = ({
  onAdd,
  onCancel,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [parsed, setParsed] = useState<ParsedEmbed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced URL parsing
  useEffect(() => {
    if (!urlInput.trim()) {
      setParsed(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = parseEmbedUrl(urlInput);
      setParsed(result);
      if (result) {
        setError(null);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [urlInput]);

  const validateAndGetError = (): string | null => {
    const raw = urlInput.trim();
    if (!raw) return 'Paste a link.';

    const lower = raw.toLowerCase();
    if (lower.includes('youtube.com/playlist') || lower.includes('list=')) {
      return 'Paste a link to a single video.';
    }
    if (lower.includes('youtube.com/@')) {
      return 'Paste a link to a single video.';
    }
    if (lower.startsWith('spotify:track:') || lower.includes('spotify.link')) {
      return 'Paste the full link to a track, album or set.';
    }
    if (lower.includes('on.soundcloud.com')) {
      return 'Paste the full link to a track, album or set.';
    }

    const res = parseEmbedUrl(raw);
    if (!res) {
      if (lower.includes('soundcloud.com') && lower.split('/').filter(Boolean).length <= 3) {
        return 'Paste the full link to a track, album or set.';
      }
      return 'Use a YouTube, Spotify or SoundCloud link.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateAndGetError();
    if (validationError) {
      setError(validationError);
      return;
    }

    const res = parseEmbedUrl(urlInput);
    if (!res) {
      setError('Use a YouTube, Spotify or SoundCloud link.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        url: res.canonicalUrl,
        caption: captionInput.trim(),
        provider: res.provider,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'pro_required') {
        // Handled by parent opening UpgradeDialog
      } else {
        setError("Couldn't add embed. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-[0_2px_8px_rgba(10,10,10,0.06)]">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="flex flex-col gap-3.5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="embed-link" className="text-[14px] font-medium text-ink">
            Link
          </label>
          <input
            id="embed-link"
            ref={inputRef}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste a YouTube, Spotify or SoundCloud link"
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />

          {parsed && !error && (
            <div
              className="flex items-center gap-1.5 text-[13px] text-ink font-medium mt-0.5"
              role="status"
            >
              <Check size={14} className="text-ink" />
              <span>{parsed.label}</span>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-error mt-0.5" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="embed-caption" className="text-[14px] font-medium text-ink">
            Caption
          </label>
          <input
            id="embed-caption"
            type="text"
            maxLength={60}
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder="Optional"
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            Add embed
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

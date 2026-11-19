import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, Play, Music, Headphones } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseEmbedUrl, ParsedEmbed } from '../../lib/embeds';
import { EmbedLookStyle, EmbedMetaData, EmbedProvider } from '../../data/types';
import { EmbedLookSelector } from './EmbedLookSelector';
import { EmbedBlock } from '../page/EmbedBlock';
import { VIBES } from '../../lib/vibes';

type MediaProvider = 'youtube' | 'spotify' | 'soundcloud';

interface EmbedComposerProps {
  initialProvider?: MediaProvider;
  onAdd: (data: {
    url: string;
    caption: string;
    provider: EmbedProvider;
    embedMeta?: EmbedMetaData | null;
  }) => Promise<void>;
  onCancel: () => void;
}

const MEDIA_PROVIDERS = new Set<EmbedProvider>(['youtube', 'spotify', 'soundcloud']);

const MEDIA_PROVIDER_COPY: Record<
  MediaProvider,
  { title: string; subtitle: string; placeholder: string }
> = {
  youtube: {
    title: 'YouTube embed',
    subtitle: 'Paste a YouTube video or Shorts link to embed a playable card.',
    placeholder: 'https://www.youtube.com/watch?v=...',
  },
  spotify: {
    title: 'Spotify embed',
    subtitle: 'Paste an open.spotify.com track, album, or playlist link.',
    placeholder: 'https://open.spotify.com/track/...',
  },
  soundcloud: {
    title: 'SoundCloud embed',
    subtitle: 'Paste a soundcloud.com track, album, or set link.',
    placeholder: 'https://soundcloud.com/artist/track',
  },
};

export const EmbedComposer: React.FC<EmbedComposerProps> = ({
  initialProvider,
  onAdd,
  onCancel,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [parsed, setParsed] = useState<ParsedEmbed | null>(null);
  const [embedMeta, setEmbedMeta] = useState<EmbedMetaData | null>(null);
  const [lookStyle, setLookStyle] = useState<EmbedLookStyle>('signature');
  const [ctaLabel, setCtaLabel] = useState('');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced URL parsing + media oEmbed metadata fetch (YouTube, Spotify, SoundCloud only)
  useEffect(() => {
    const clean = urlInput.trim();
    if (!clean) {
      setParsed(null);
      setEmbedMeta(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = parseEmbedUrl(clean);
      if (!result || !MEDIA_PROVIDERS.has(result.provider)) {
        setParsed(result && !MEDIA_PROVIDERS.has(result.provider) ? null : result);
        setEmbedMeta(null);
        return;
      }

      setParsed(result);
      setError(null);
      setIsFetchingMeta(true);
      try {
        const res = await fetch(
          `/api/integrations/embed?url=${encodeURIComponent(result.canonicalUrl)}`
        );
        const data = await res.json().catch(() => null);
        const resolvedMeta = data?.embed || data?.embedMeta;
        if (!cancelled && res.ok && data?.ok && resolvedMeta) {
          setEmbedMeta(resolvedMeta);
          if (!captionInput.trim() && resolvedMeta.title) {
            setCaptionInput(String(resolvedMeta.title).slice(0, 60));
          }
        }
      } catch {
        // Non-blocking fallback
      } finally {
        if (!cancelled) setIsFetchingMeta(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInput]);

  const validateAndGetError = (): string | null => {
    const raw = urlInput.trim();
    if (!raw) return 'Paste a YouTube, Spotify, or SoundCloud link.';

    const lower = raw.toLowerCase();
    if (lower.includes('youtube.com/playlist') || lower.includes('list=')) {
      return 'Paste a link to a single video.';
    }
    if (lower.includes('youtube.com/@')) {
      return 'For channels, use the YouTube showcase block; here paste a video or Shorts link.';
    }
    if (lower.startsWith('spotify:track:') || lower.includes('spotify.link')) {
      return 'Paste the full open.spotify.com link to a track, album, or playlist.';
    }
    if (lower.includes('on.soundcloud.com')) {
      return 'Paste the full soundcloud.com link to a track or set.';
    }

    const res = parseEmbedUrl(raw);
    if (!res) {
      if (lower.includes('soundcloud.com') && lower.split('/').filter(Boolean).length <= 3) {
        return 'Paste the full link to a track, album or set.';
      }
      return 'Use a YouTube, Spotify, or SoundCloud link.';
    }

    if (!MEDIA_PROVIDERS.has(res.provider)) {
      return 'For social accounts, open the Profiles tab or pick the platform card in "+ Add". Here paste a YouTube, Spotify, or SoundCloud link.';
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
    if (!res || !MEDIA_PROVIDERS.has(res.provider)) {
      setError('Use a supported playable media link (YouTube, Spotify, or SoundCloud).');
      return;
    }

    const finalMeta: EmbedMetaData = {
      ...(embedMeta || { provider: res.provider, title: res.label }),
      provider: res.provider,
      lookStyle,
      ctaLabel: ctaLabel.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await onAdd({
        url: res.canonicalUrl,
        caption: captionInput.trim() || embedMeta?.title || '',
        provider: res.provider,
        embedMeta: finalMeta,
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

  const activeProvider: EmbedProvider =
    parsed && MEDIA_PROVIDERS.has(parsed.provider)
      ? parsed.provider
      : initialProvider || 'youtube';

  const headerCopy = initialProvider
    ? MEDIA_PROVIDER_COPY[initialProvider]
    : {
        title: 'Audio & video embed',
        subtitle: 'YouTube videos, Spotify tracks/playlists, or SoundCloud audio.',
        placeholder: 'Paste a YouTube, Spotify, or SoundCloud link',
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
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-purple-50 text-purple-700 text-[12px] font-semibold">
              <Play size={12} fill="currentColor" />
              <Music size={12} />
              <Headphones size={12} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-ink leading-tight">
                {headerCopy.title}
              </h3>
              <p className="text-[12px] text-muted">
                {headerCopy.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="embed-link" className="text-[14px] font-medium text-ink">
            Media link
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
            placeholder={headerCopy.placeholder}
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />

          {parsed && MEDIA_PROVIDERS.has(parsed.provider) && !error && (
            <div
              className="flex items-center gap-1.5 text-[13px] text-ink font-medium mt-0.5"
              role="status"
            >
              {isFetchingMeta ? (
                <Loader2 size={14} className="animate-spin text-muted" />
              ) : (
                <Check size={14} className="text-ink" />
              )}
              <span>{parsed.label}</span>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-[color:var(--error,#B3261E)] mt-0.5" role="alert">
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
            placeholder="Optional title or caption"
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <EmbedLookSelector
          provider={activeProvider}
          subtype={parsed?.subtype}
          lookStyle={lookStyle}
          ctaLabel={ctaLabel}
          onChange={(patch) => {
            if (patch.lookStyle !== undefined) setLookStyle(patch.lookStyle);
            if (patch.ctaLabel !== undefined) setCtaLabel(patch.ctaLabel ?? '');
          }}
        />

        {parsed && MEDIA_PROVIDERS.has(parsed.provider) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">Preview on page</span>
            <div className="p-3 rounded-[12px] border border-border bg-surface-2/40">
              <EmbedBlock
                block={{
                  id: 'preview-media',
                  kind: 'embed',
                  title: captionInput.trim() || embedMeta?.title || parsed.label,
                  url: parsed.canonicalUrl,
                  icon: null,
                  thumbnailPath: null,
                  thumbnailUrl: null,
                  layout: 'classic',
                  embedProvider: parsed.provider,
                  embedMeta: {
                    ...(embedMeta || { provider: parsed.provider }),
                    lookStyle,
                    ctaLabel: ctaLabel.trim() || null,
                  },
                }}
                vibe={VIBES[0]}
                effectiveRadius={16}
                embedMode="placeholder"
                activeEmbedId={null}
                onActivate={() => {}}
                scale={0.92}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add media embed'}
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

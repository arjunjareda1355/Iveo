import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, Play, Music, Headphones, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseEmbedUrl, ParsedEmbed } from '../../lib/embeds';
import { EmbedLookStyle, EmbedMetaData, EmbedProvider } from '../../data/types';
import { EmbedLookSelector } from './EmbedLookSelector';
import { EmbedBlock } from '../page/EmbedBlock';
import { VIBES } from '../../lib/vibes';
import { normalizeEmbedLookStyle } from '../../lib/embedLooks';
import { formatExternalUrl } from '../../lib/urls';

type MediaProvider = 'youtube' | 'spotify' | 'soundcloud';

interface EmbedComposerProps {
  initialProvider?: MediaProvider;
  isEditing?: boolean;
  initialValues?: {
    url?: string;
    caption?: string;
    embedMeta?: EmbedMetaData | null;
  };
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
  { title: string; editTitle: string; subtitle: string; placeholder: string }
> = {
  youtube: {
    title: 'YouTube embed',
    editTitle: 'Edit YouTube embed',
    subtitle: 'Paste a YouTube video or Shorts link to embed a playable card.',
    placeholder: 'https://www.youtube.com/watch?v=...',
  },
  spotify: {
    title: 'Spotify embed',
    editTitle: 'Edit Spotify embed',
    subtitle: 'Connect Spotify via OAuth or paste an open.spotify.com track, album, artist, or playlist link.',
    placeholder: 'https://open.spotify.com/track/...',
  },
  soundcloud: {
    title: 'SoundCloud embed',
    editTitle: 'Edit SoundCloud embed',
    subtitle: 'Paste a soundcloud.com track, album, or set link.',
    placeholder: 'https://soundcloud.com/artist/track',
  },
};

export const EmbedComposer: React.FC<EmbedComposerProps> = ({
  initialProvider,
  isEditing = false,
  initialValues,
  onAdd,
  onCancel,
}) => {
  const [urlInput, setUrlInput] = useState(initialValues?.url || '');
  const [captionInput, setCaptionInput] = useState(initialValues?.caption || '');
  const [parsed, setParsed] = useState<ParsedEmbed | null>(() =>
    initialValues?.url ? parseEmbedUrl(initialValues.url) : null
  );
  const [embedMeta, setEmbedMeta] = useState<EmbedMetaData | null>(
    initialValues?.embedMeta || null
  );
  const [lookStyle, setLookStyle] = useState<EmbedLookStyle>(() =>
    normalizeEmbedLookStyle(initialValues?.embedMeta?.lookStyle, 'signature')
  );
  const [ctaLabel, setCtaLabel] = useState(initialValues?.embedMeta?.ctaLabel || '');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchedUrlRef = useRef<string>(
    initialValues?.url ? parseEmbedUrl(initialValues.url)?.canonicalUrl || initialValues.url : ''
  );

  useEffect(() => {
    if (!isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  // Listen for Spotify OAuth popup results
  useEffect(() => {
    const applySpotifyPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.provider && payload.provider !== 'spotify') return;

      const rawEmbed =
        payload.embed ||
        (payload.connection?.embedMeta
          ? {
              ...payload.connection.embedMeta,
              url: payload.connection.url,
              title: payload.connection.title,
            }
          : null);

      if (payload.type === 'IVEO_SOCIAL_OAUTH_SUCCESS' && rawEmbed) {
        const em = rawEmbed as EmbedMetaData & { url?: string };
        const nextUrl = em.url || '';
        if (nextUrl) {
          setUrlInput(nextUrl);
          lastFetchedUrlRef.current = nextUrl;
          setParsed(parseEmbedUrl(nextUrl));
        }
        setEmbedMeta({
          provider: 'spotify',
          title: em.title,
          subtitle: em.subtitle || null,
          description: em.description || null,
          avatarUrl: em.avatarUrl || null,
          coverUrl: em.coverUrl || em.avatarUrl || null,
          statsLabel: em.statsLabel || null,
          badgeText: em.badgeText || null,
          handle: em.handle || null,
          accentColor: '#1DB954',
          connectedViaOAuth: true,
          fetchedAt: em.fetchedAt || new Date().toISOString(),
        });
        if (!captionInput.trim() && em.title) {
          setCaptionInput(em.title.slice(0, 60));
        }
        setError(null);
        setIsConnectingSpotify(false);
      } else if (payload.type === 'IVEO_SOCIAL_OAUTH_ERROR') {
        setError(payload.error || 'Spotify connection was cancelled or failed.');
        setIsConnectingSpotify(false);
      }
    };

    const handleMessage = (event: MessageEvent) => applySpotifyPayload(event.data);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'iveo_social_oauth_result' && event.newValue) {
        try {
          applySpotifyPayload(JSON.parse(event.newValue));
          localStorage.removeItem('iveo_social_oauth_result');
        } catch {}
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('iveo_social_oauth');
        bc.onmessage = (e) => applySpotifyPayload(e.data);
      }
    } catch {}

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [captionInput]);

  // Debounced URL parsing + media metadata lookup (YouTube, Spotify Web API/oEmbed, SoundCloud)
  useEffect(() => {
    const clean = urlInput.trim();
    if (!clean) {
      setParsed(null);
      if (!isEditing) setEmbedMeta(null);
      lastFetchedUrlRef.current = '';
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = parseEmbedUrl(clean);
      if (!result || !MEDIA_PROVIDERS.has(result.provider)) {
        setParsed(result && !MEDIA_PROVIDERS.has(result.provider) ? null : result);
        if (!embedMeta?.connectedViaOAuth) {
          setEmbedMeta(null);
        }
        return;
      }

      setParsed(result);
      setError(null);
      if (lastFetchedUrlRef.current === result.canonicalUrl && embedMeta) {
        return;
      }

      setIsFetchingMeta(true);
      try {
        const res = await fetch(
          `/api/integrations/embed?url=${encodeURIComponent(result.canonicalUrl)}`
        );
        const data = await res.json().catch(() => null);
        const resolvedMeta = data?.embed || data?.embedMeta;
        if (!cancelled && res.ok && data?.ok && resolvedMeta) {
          lastFetchedUrlRef.current = result.canonicalUrl;
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

  const handleConnectSpotify = async () => {
    setError(null);
    setIsConnectingSpotify(true);
    try {
      const res = await fetch(
        `/api/oauth/spotify/url?origin=${encodeURIComponent(window.location.origin)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setError(data?.message || 'Spotify connection is unavailable right now.');
        setIsConnectingSpotify(false);
        return;
      }

      const popup = window.open(
        data.url,
        'iveo_oauth_spotify',
        'width=540,height=680,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        setError('Please allow popups in your browser to connect Spotify.');
        setIsConnectingSpotify(false);
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnectingSpotify(false);
        }
      }, 600);
    } catch {
      setError('Could not launch Spotify OAuth popup right now.');
      setIsConnectingSpotify(false);
    }
  };

  const isConnectedSpotifyProfile = Boolean(
    embedMeta?.connectedViaOAuth &&
      embedMeta.provider === 'spotify' &&
      /^https?:\/\/open\.spotify\.com\/user\//i.test(urlInput.trim())
  );

  const validateAndGetError = (): string | null => {
    const raw = urlInput.trim();
    if (!raw) return 'Paste a YouTube, Spotify, or SoundCloud link.';

    if (isConnectedSpotifyProfile) {
      return null;
    }

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
    const targetProvider: EmbedProvider | null =
      res && MEDIA_PROVIDERS.has(res.provider)
        ? res.provider
        : isConnectedSpotifyProfile
          ? 'spotify'
          : null;

    if (!targetProvider) {
      setError('Use a supported playable media link (YouTube, Spotify, or SoundCloud).');
      return;
    }

    const canonicalUrl = res?.canonicalUrl || formatExternalUrl(urlInput.trim());

    const finalMeta: EmbedMetaData = {
      ...(embedMeta || { provider: targetProvider, title: res?.label || 'Spotify Profile' }),
      provider: targetProvider,
      lookStyle,
      ctaLabel: ctaLabel.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await onAdd({
        url: canonicalUrl,
        caption: captionInput.trim() || embedMeta?.title || '',
        provider: targetProvider,
        embedMeta: finalMeta,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'pro_required') {
        // Handled by parent opening UpgradeDialog
      } else {
        setError("Couldn't save embed. Try again.");
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
        editTitle: 'Edit media embed',
        subtitle: 'YouTube videos, Spotify tracks/playlists, or SoundCloud audio.',
        placeholder: 'Paste a YouTube, Spotify, or SoundCloud link',
      };

  const showPreview =
    (parsed && MEDIA_PROVIDERS.has(parsed.provider)) || isConnectedSpotifyProfile;

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
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-semibold ${
                activeProvider === 'spotify'
                  ? 'bg-emerald-50 text-[#1DB954]'
                  : 'bg-purple-50 text-purple-700'
              }`}
            >
              {activeProvider === 'spotify' ? (
                <Music size={14} />
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  <Music size={12} />
                  <Headphones size={12} />
                </>
              )}
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-ink leading-tight">
                {isEditing ? headerCopy.editTitle : headerCopy.title}
              </h3>
              <p className="text-[12px] text-muted">{headerCopy.subtitle}</p>
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

        {(initialProvider === 'spotify' || activeProvider === 'spotify') && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleConnectSpotify}
              disabled={isConnectingSpotify || isSubmitting}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 bg-[#1DB954] hover:bg-[#1AA34A] text-black"
            >
              {isConnectingSpotify ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Music size={15} />
              )}
              <span>
                {isConnectingSpotify
                  ? 'Connecting Spotify...'
                  : embedMeta?.connectedViaOAuth
                    ? 'Reconnect Spotify'
                    : 'Connect Spotify'}
              </span>
              {!isConnectingSpotify && <ExternalLink size={12} className="opacity-80" />}
            </button>

            {embedMeta?.connectedViaOAuth && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                <Sparkles size={11} />
                <span>Spotify connected</span>
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="embed-link" className="text-[14px] font-medium text-ink">
            {activeProvider === 'spotify' ? 'Or paste Spotify link' : 'Media link'}
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

          {((parsed && MEDIA_PROVIDERS.has(parsed.provider)) || isConnectedSpotifyProfile) &&
            !error && (
              <div
                className="flex items-center gap-1.5 text-[13px] text-ink font-medium mt-0.5"
                role="status"
              >
                {isFetchingMeta ? (
                  <Loader2 size={14} className="animate-spin text-muted" />
                ) : (
                  <Check size={14} className="text-emerald-600" />
                )}
                <span>
                  {parsed?.label || embedMeta?.title || 'Connected Spotify profile'}
                </span>
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

        {showPreview && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted">Preview on page</span>
            <div className="p-3 rounded-[12px] border border-border bg-surface-2/40">
              <EmbedBlock
                block={{
                  id: 'preview-media',
                  kind: 'embed',
                  title:
                    captionInput.trim() ||
                    embedMeta?.title ||
                    parsed?.label ||
                    'Spotify Profile',
                  url: parsed?.canonicalUrl || formatExternalUrl(urlInput.trim()),
                  icon: null,
                  thumbnailPath: null,
                  thumbnailUrl: null,
                  layout: 'classic',
                  embedProvider: activeProvider,
                  embedMeta: {
                    ...(embedMeta || { provider: activeProvider }),
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
            {isSubmitting
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : activeProvider === 'spotify'
                  ? 'Add Spotify card'
                  : 'Add media embed'}
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

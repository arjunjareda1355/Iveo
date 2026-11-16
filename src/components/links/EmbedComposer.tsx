import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseEmbedUrl, ParsedEmbed } from '../../lib/embeds';
import { EmbedMetaData, EmbedProvider } from '../../data/types';

interface EmbedComposerProps {
  onAdd: (data: {
    url: string;
    caption: string;
    provider: EmbedProvider;
    embedMeta?: EmbedMetaData | null;
  }) => Promise<void>;
  onCancel: () => void;
}

type OAuthSocialProvider = 'discord' | 'github' | 'linkedin' | 'x';

const SOCIAL_OAUTH_PROVIDERS: { id: OAuthSocialProvider; label: string }[] = [
  { id: 'discord', label: 'Discord' },
  { id: 'github', label: 'GitHub' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
];

export const EmbedComposer: React.FC<EmbedComposerProps> = ({
  onAdd,
  onCancel,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [parsed, setParsed] = useState<ParsedEmbed | null>(null);
  const [embedMeta, setEmbedMeta] = useState<EmbedMetaData | null>(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<OAuthSocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Listen for OAuth popup results (postMessage + BroadcastChannel + storage fallback)
  useEffect(() => {
    const applySocialPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'IVEO_SOCIAL_OAUTH_SUCCESS' && payload.embed) {
        const em = payload.embed as EmbedMetaData & { url?: string; badge?: string | null };
        const nextUrl = em.url || '';
        if (nextUrl) {
          setUrlInput(nextUrl);
          const p = parseEmbedUrl(nextUrl);
          setParsed(p);
        }
        setEmbedMeta({
          provider: em.provider,
          title: em.title,
          subtitle: em.subtitle || null,
          description: em.description || null,
          avatarUrl: em.avatarUrl || null,
          statsLabel: em.statsLabel || null,
          badgeText: em.badgeText || em.badge || null,
          handle: em.handle || null,
          connectedViaOAuth: true,
          fetchedAt: em.fetchedAt || new Date().toISOString(),
        });
        if (!captionInput.trim() && em.title) {
          setCaptionInput(em.title.slice(0, 60));
        }
        setError(null);
        setConnectingProvider(null);
      } else if (payload.type === 'IVEO_SOCIAL_OAUTH_ERROR') {
        setError(payload.error || 'Account connection was cancelled or failed.');
        setConnectingProvider(null);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      applySocialPayload(event.data);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'iveo_social_oauth_result' && event.newValue) {
        try {
          applySocialPayload(JSON.parse(event.newValue));
          localStorage.removeItem('iveo_social_oauth_result');
        } catch {}
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('iveo_social_oauth');
        bc.onmessage = (e) => applySocialPayload(e.data);
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

  // Debounced URL parsing + server metadata fetch
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
      setParsed(result);
      if (!result) {
        setEmbedMeta(null);
        return;
      }
      setError(null);

      // Avoid overwriting already-OAuth-connected metadata for identical URL
      if (embedMeta?.connectedViaOAuth && embedMeta.provider === result.provider) {
        return;
      }

      setIsFetchingMeta(true);
      try {
        const res = await fetch(
          `/api/integrations/embed?url=${encodeURIComponent(result.canonicalUrl)}`
        );
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.ok && data?.embed) {
          setEmbedMeta(data.embed);
          if (!captionInput.trim() && data.embed.title) {
            setCaptionInput(String(data.embed.title).slice(0, 60));
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

  const handleConnectProvider = async (provider: OAuthSocialProvider) => {
    setError(null);
    setConnectingProvider(provider);
    try {
      const res = await fetch(
        `/api/oauth/${provider}/url?origin=${encodeURIComponent(window.location.origin)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setError(data?.message || `${provider} connection is unavailable right now.`);
        setConnectingProvider(null);
        return;
      }

      const popup = window.open(
        data.url,
        `iveo_oauth_${provider}`,
        'width=540,height=680,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        setError('Please allow popups in your browser to connect your account.');
        setConnectingProvider(null);
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnectingProvider(null);
        }
      }, 600);
    } catch {
      setError('Could not launch OAuth popup right now.');
      setConnectingProvider(null);
    }
  };

  const validateAndGetError = (): string | null => {
    const raw = urlInput.trim();
    if (!raw) return 'Paste a link or connect a social profile below.';

    const lower = raw.toLowerCase();
    if (lower.includes('youtube.com/playlist') || lower.includes('list=')) {
      return 'Paste a link to a single video.';
    }
    if (lower.includes('youtube.com/@')) {
      return 'For channels, use the YouTube Showcase block; here paste a video/short link.';
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
      return 'Use a YouTube, Spotify, SoundCloud, Discord, GitHub, LinkedIn, or X link.';
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
      setError('Use a supported embed link (YouTube, Spotify, SoundCloud, Discord, GitHub, LinkedIn, or X).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        url: res.canonicalUrl,
        caption: captionInput.trim() || embedMeta?.title || '',
        provider: res.provider,
        embedMeta,
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
            placeholder="Paste YouTube, Spotify, SoundCloud, Discord, GitHub, LinkedIn, or X link"
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />

          {parsed && !error && (
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
              {embedMeta?.connectedViaOAuth && (
                <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  <Sparkles size={10} />
                  Connected
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="text-[13px] text-error mt-0.5" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Rich preview card when metadata is resolved */}
        {embedMeta && (
          <div className="p-3 rounded-[10px] border border-border bg-surface-2/60 flex items-center gap-3">
            {embedMeta.avatarUrl && (
              <img
                src={embedMeta.avatarUrl}
                alt={embedMeta.title || 'Embed profile avatar'}
                className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-ink truncate">
                  {embedMeta.title}
                </span>
                {embedMeta.badgeText && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                    {embedMeta.badgeText}
                  </span>
                )}
              </div>
              {embedMeta.subtitle && (
                <p className="text-[12px] text-muted truncate">{embedMeta.subtitle}</p>
              )}
              {embedMeta.description && (
                <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                  {embedMeta.description}
                </p>
              )}
            </div>
            {embedMeta.statsLabel && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface border border-border text-ink shrink-0">
                {embedMeta.statsLabel}
              </span>
            )}
          </div>
        )}

        {/* Quick-Connect Social OAuth Buttons */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[12px] font-medium text-muted">
            Or connect directly via account OAuth
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {SOCIAL_OAUTH_PROVIDERS.map((p) => {
              const busy = connectingProvider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleConnectProvider(p.id)}
                  disabled={busy || isSubmitting}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border border-border bg-surface-2 hover:border-ink/40 hover:bg-surface text-[12px] font-medium text-ink transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ExternalLink size={12} className="text-muted" />
                  )}
                  <span>Connect {p.label}</span>
                </button>
              );
            })}
          </div>
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
            {isSubmitting ? 'Adding...' : 'Add embed'}
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

import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, Sparkles, ExternalLink, Github, Linkedin, Instagram } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { parseEmbedUrl, ParsedEmbed } from '../../lib/embeds';
import { EmbedLookStyle, EmbedMetaData, EmbedProvider } from '../../data/types';
import { EmbedLookSelector } from './EmbedLookSelector';
import { EmbedBlock, DiscordGlyph, XMarkGlyph, FacebookGlyph, ThreadsGlyph } from '../page/EmbedBlock';
import { VIBES } from '../../lib/vibes';
import { normalizeEmbedLookStyle } from '../../lib/embedLooks';

export type SocialEmbedProvider =
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads';

interface SocialEmbedComposerProps {
  initialProvider: SocialEmbedProvider;
  onAdd: (data: {
    url: string;
    caption: string;
    provider: EmbedProvider;
    embedMeta?: EmbedMetaData | null;
  }) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  initialValues?: {
    url?: string;
    caption?: string;
    embedMeta?: EmbedMetaData | null;
  };
}

const PROVIDER_META: Record<
  SocialEmbedProvider,
  {
    name: string;
    oauthLabel: string;
    placeholder: string;
    hint: string;
    accentBg: string;
    accentText: string;
  }
> = {
  discord: {
    name: 'Discord',
    oauthLabel: 'Connect Discord',
    placeholder: 'https://discord.gg/your-invite or https://discord.com/users/123456...',
    hint: 'Connect your Discord profile via OAuth or paste a server invite / user link.',
    accentBg: 'bg-[#5865F2] hover:bg-[#4752C4]',
    accentText: 'text-white',
  },
  github: {
    name: 'GitHub',
    oauthLabel: 'Connect GitHub',
    placeholder: 'https://github.com/username or https://github.com/owner/repo',
    hint: 'Connect your GitHub account via OAuth or paste a profile or repository URL.',
    accentBg: 'bg-[#24292F] hover:bg-[#1B1F23]',
    accentText: 'text-white',
  },
  linkedin: {
    name: 'LinkedIn',
    oauthLabel: 'Connect LinkedIn',
    placeholder: 'https://www.linkedin.com/in/your-name or /company/name',
    hint: 'Connect your LinkedIn account via OAuth or paste a profile or company link.',
    accentBg: 'bg-[#0A66C2] hover:bg-[#004182]',
    accentText: 'text-white',
  },
  x: {
    name: 'X (Twitter)',
    oauthLabel: 'Connect X',
    placeholder: 'https://x.com/handle or https://x.com/handle/status/123...',
    hint: 'Connect your X account via OAuth or paste a profile or post link.',
    accentBg: 'bg-black hover:bg-neutral-800',
    accentText: 'text-white',
  },
  instagram: {
    name: 'Instagram',
    oauthLabel: 'Connect Instagram',
    placeholder: 'https://www.instagram.com/username/ or /reel/...',
    hint: 'Connect Instagram via Meta OAuth or paste a profile, reel, or post URL.',
    accentBg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95',
    accentText: 'text-white',
  },
  facebook: {
    name: 'Facebook',
    oauthLabel: 'Connect Facebook',
    placeholder: 'https://www.facebook.com/yourpage or /groups/...',
    hint: 'Connect your Facebook account via Meta OAuth or paste a profile, page, or group link.',
    accentBg: 'bg-[#1877F2] hover:bg-[#1464D0]',
    accentText: 'text-white',
  },
  threads: {
    name: 'Threads',
    oauthLabel: 'Connect Threads',
    placeholder: 'https://www.threads.net/@username or /post/...',
    hint: 'Connect your Threads account via OAuth or paste a profile or thread link.',
    accentBg: 'bg-[#101010] hover:bg-neutral-800',
    accentText: 'text-white',
  },
};

export const SocialEmbedComposer: React.FC<SocialEmbedComposerProps> = ({
  initialProvider,
  onAdd,
  onCancel,
  isEditing = false,
  initialValues,
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
  const [showStats, setShowStats] = useState<boolean>(
    initialValues?.embedMeta?.showStats !== false
  );
  const [showDescription, setShowDescription] = useState<boolean>(
    initialValues?.embedMeta?.showDescription !== false
  );
  const [ctaLabel, setCtaLabel] = useState<string>(
    initialValues?.embedMeta?.ctaLabel || ''
  );

  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchedUrlRef = useRef<string>(
    initialValues?.url ? parseEmbedUrl(initialValues.url)?.canonicalUrl || '' : ''
  );

  const info = PROVIDER_META[initialProvider];

  useEffect(() => {
    if (!isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  // Listen for OAuth popup results (postMessage + BroadcastChannel + storage fallback)
  useEffect(() => {
    const applySocialPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.provider && payload.provider !== initialProvider) return;

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
        const em = rawEmbed as EmbedMetaData & { url?: string; badge?: string | null };
        const nextUrl = em.url || '';
        if (nextUrl) {
          setUrlInput(nextUrl);
          const p = parseEmbedUrl(nextUrl);
          setParsed(p);
          if (p) lastFetchedUrlRef.current = p.canonicalUrl;
        }
        setEmbedMeta({
          provider: em.provider || initialProvider,
          title: em.title,
          subtitle: em.subtitle || null,
          description: em.description || null,
          avatarUrl: em.avatarUrl || null,
          statsLabel: em.statsLabel || null,
          badgeText: em.badgeText || em.badge || null,
          handle: em.handle || null,
          accentColor: em.accentColor || null,
          connectedViaOAuth: true,
          fetchedAt: em.fetchedAt || new Date().toISOString(),
        });
        if (!captionInput.trim() && em.title) {
          setCaptionInput(em.title.slice(0, 60));
        }
        setError(null);
        setIsConnecting(false);
      } else if (payload.type === 'IVEO_SOCIAL_OAUTH_ERROR') {
        setError(payload.error || `${info.name} connection was cancelled or failed.`);
        setIsConnecting(false);
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
  }, [captionInput, info.name, initialProvider]);

  // Debounced URL parsing + metadata lookup
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
      setParsed(result);
      if (!result || result.provider !== initialProvider) {
        return;
      }
      setError(null);

      if (
        lastFetchedUrlRef.current === result.canonicalUrl ||
        (embedMeta?.connectedViaOAuth &&
          embedMeta.provider === result.provider &&
          lastFetchedUrlRef.current === result.canonicalUrl)
      ) {
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
  }, [urlInput, initialProvider]);

  const handleConnectOAuth = async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const res = await fetch(
        `/api/oauth/${initialProvider}/url?origin=${encodeURIComponent(window.location.origin)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setError(data?.message || `${info.name} connection is unavailable right now.`);
        setIsConnecting(false);
        return;
      }

      const popup = window.open(
        data.url,
        `iveo_oauth_${initialProvider}`,
        'width=540,height=680,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        setError('Please allow popups in your browser to connect your account.');
        setIsConnecting(false);
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
        }
      }, 600);
    } catch {
      setError(`Could not launch ${info.name} OAuth popup right now.`);
      setIsConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = urlInput.trim();
    if (!raw) {
      setError(`Click "${info.oauthLabel}" or paste a ${info.name} URL.`);
      return;
    }

    const res = parseEmbedUrl(raw);
    if (!res || res.provider !== initialProvider) {
      setError(`Paste a valid ${info.name} URL (e.g. ${info.placeholder.split(' ')[0]}).`);
      return;
    }

    const mergedMeta: EmbedMetaData = {
      ...(embedMeta || {
        provider: initialProvider,
        title: captionInput.trim() || res.label,
      }),
      provider: initialProvider,
      lookStyle,
      showStats,
      showDescription,
      ctaLabel: ctaLabel.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await onAdd({
        url: res.canonicalUrl,
        caption: captionInput.trim() || mergedMeta.title || '',
        provider: initialProvider,
        embedMeta: mergedMeta,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'pro_required') {
        // Parent handles upgrade dialog
      } else {
        setError(`Couldn't save ${info.name} embed. Try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProviderIcon = (size = 16) => {
    switch (initialProvider) {
      case 'discord':
        return <DiscordGlyph size={size} />;
      case 'github':
        return <Github size={size} />;
      case 'linkedin':
        return <Linkedin size={size} />;
      case 'x':
        return <XMarkGlyph size={size - 1} />;
      case 'instagram':
        return <Instagram size={size} />;
      case 'facebook':
        return <FacebookGlyph size={size - 1} />;
      case 'threads':
        return <ThreadsGlyph size={size - 1} />;
    }
  };

  const previewMeta: EmbedMetaData = {
    ...(embedMeta || {
      provider: initialProvider,
      title: captionInput.trim() || `${info.name} Profile`,
      subtitle: parsed?.identifier ? `@${parsed.identifier}` : `@your_${initialProvider}`,
      description: info.hint,
    }),
    provider: initialProvider,
    lookStyle,
    showStats,
    showDescription,
    ctaLabel: ctaLabel.trim() || null,
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
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-[10px] ${info.accentBg} ${info.accentText} flex items-center justify-center shrink-0`}
            >
              {renderProviderIcon(17)}
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink leading-tight truncate">
                {isEditing ? `Edit ${info.name} embed` : `${info.name} embed`}
              </h3>
              <p className="text-[12px] text-muted truncate">{info.hint}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Dedicated OAuth Connect Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleConnectOAuth}
            disabled={isConnecting || isSubmitting}
            className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${info.accentBg} ${info.accentText}`}
          >
            {isConnecting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              renderProviderIcon(15)
            )}
            <span>
              {isConnecting
                ? `Connecting ${info.name}...`
                : embedMeta?.connectedViaOAuth
                  ? `Reconnect ${info.name}`
                  : info.oauthLabel}
            </span>
            {!isConnecting && <ExternalLink size={12} className="opacity-80" />}
          </button>

          {embedMeta?.connectedViaOAuth && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              <Sparkles size={11} />
              <span>Account connected</span>
            </span>
          )}
        </div>

        {/* Or paste URL */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`social-embed-url-${initialProvider}`}
            className="text-[13px] font-medium text-ink"
          >
            Or paste {info.name} link
          </label>
          <input
            id={`social-embed-url-${initialProvider}`}
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
            placeholder={info.placeholder}
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />

          {parsed && parsed.provider === initialProvider && !error && (
            <div className="flex items-center gap-1.5 text-[12px] text-ink font-medium" role="status">
              {isFetchingMeta ? (
                <Loader2 size={13} className="animate-spin text-muted" />
              ) : (
                <Check size={13} className="text-emerald-600" />
              )}
              <span>{parsed.label}</span>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`social-embed-caption-${initialProvider}`}
            className="text-[13px] font-medium text-ink"
          >
            Card title / caption
          </label>
          <input
            id={`social-embed-caption-${initialProvider}`}
            type="text"
            maxLength={60}
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder={`Optional (defaults to ${info.name} name)`}
            className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Look Customization */}
        <EmbedLookSelector
          provider={initialProvider}
          subtype={parsed?.subtype}
          lookStyle={lookStyle}
          showStats={showStats}
          showDescription={showDescription}
          ctaLabel={ctaLabel}
          onChange={(patch) => {
            if (patch.lookStyle !== undefined) setLookStyle(patch.lookStyle);
            if (patch.showStats !== undefined) setShowStats(patch.showStats);
            if (patch.showDescription !== undefined) setShowDescription(patch.showDescription);
            if (patch.ctaLabel !== undefined) setCtaLabel(patch.ctaLabel ?? '');
          }}
        />

        {/* Live Card Look Preview */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted">
            Live look preview
          </span>
          <div className="p-3 rounded-[12px] border border-border bg-surface-2/40">
            <EmbedBlock
              block={{
                id: `preview-${initialProvider}`,
                kind: 'embed',
                title: captionInput.trim() || previewMeta.title || info.name,
                url: parsed?.canonicalUrl || urlInput.trim() || `https://${initialProvider}.com`,
                icon: null,
                thumbnailPath: null,
                thumbnailUrl: null,
                layout: 'classic',
                embedProvider: initialProvider,
                embedMeta: previewMeta,
              }}
              vibe={VIBES[0]}
              effectiveRadius={16}
              embedMode="placeholder"
              activeEmbedId={null}
              onActivate={() => {}}
              scale={0.94}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save changes' : `Add ${info.name} card`}
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

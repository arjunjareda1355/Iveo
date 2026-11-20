import React, { useState, useEffect, useRef } from 'react';
import { Youtube, RefreshCw, CheckCircle2, Link2, Film, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { normalizeYouTubeUrl } from '../../lib/urls';
import { YouTubeData } from '../../data/types';
import { YouTubeShowcaseCard } from '../page/ShowcaseBlocks';
import { VIBES } from '../../lib/vibes';

type ShowcaseSourceMode = 'channel' | 'video' | 'google';

interface YouTubeCardComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    badge?: string;
    youtube?: YouTubeData | null;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    badge?: string;
    youtube?: YouTubeData | null;
  };
  isEditing?: boolean;
}

function detectInitialMode(url?: string, connected?: boolean): ShowcaseSourceMode {
  if (connected && !url) return 'google';
  const lower = (url || '').toLowerCase();
  if (
    lower.includes('watch?v=') ||
    lower.includes('youtu.be/') ||
    lower.includes('/shorts/') ||
    lower.includes('/playlist?')
  ) {
    return 'video';
  }
  return 'channel';
}

export const YouTubeCardComposer: React.FC<YouTubeCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [sourceMode, setSourceMode] = useState<ShowcaseSourceMode>(() =>
    detectInitialMode(initialValues?.url, initialValues?.youtube?.connectedViaOAuth)
  );
  const [url, setUrl] = useState(initialValues?.url || '');
  const [title, setTitle] = useState(initialValues?.title || '');
  const [caption, setCaption] = useState(initialValues?.badge || '');
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.youtube?.buttonLabel || 'Subscribe'
  );
  const [showLatestVideo, setShowLatestVideo] = useState(
    initialValues?.youtube?.showLatestVideo ?? true
  );
  const [ytData, setYtData] = useState<YouTubeData | null>(initialValues?.youtube || null);
  const [isFetching, setIsFetching] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastFetchedUrlRef = useRef<string>(
    initialValues?.youtube ? normalizeYouTubeUrl(initialValues.url || '') || '' : ''
  );
  const lastAutoTitleRef = useRef<string>(initialValues?.title || '');
  const lastAutoCaptionRef = useRef<string>(initialValues?.badge || '');

  const mapServerChannelToYouTubeData = (
    ch: any,
    options?: { forceLatestToggle?: boolean }
  ): YouTubeData => {
    const videos = Array.isArray(ch?.latestVideos)
      ? ch.latestVideos.map((v: any) => ({
          id: String(v.videoId || v.id || ''),
          title: String(v.title || 'Watch video'),
          thumbnailUrl: v.thumbnailUrl || null,
          url: String(v.url || ''),
          publishedAt: v.publishedAt || null,
        }))
      : [];

    return {
      channelId: ch?.channelId || null,
      handle: ch?.handle || null,
      channelTitle: ch?.channelTitle || null,
      avatarUrl: ch?.avatarUrl || null,
      subscriberText: ch?.subscriberCountText || ch?.subscriberText || null,
      latestVideos: videos,
      showLatestVideo: options?.forceLatestToggle ?? showLatestVideo,
      connectedViaOAuth: ch?.source === 'google_oauth',
      buttonLabel: buttonLabel.trim() || 'Subscribe',
      fetchedAt: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const applyOAuthPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'IVEO_YOUTUBE_OAUTH_SUCCESS' && payload.channel) {
        const ch = payload.channel;
        const mapped = mapServerChannelToYouTubeData(ch, { forceLatestToggle: true });
        setYtData(mapped);
        setShowLatestVideo(true);
        const resolvedUrl = ch.channelUrl
          ? normalizeYouTubeUrl(ch.channelUrl) || ch.channelUrl
          : '';
        if (resolvedUrl) {
          setUrl(resolvedUrl);
          lastFetchedUrlRef.current = resolvedUrl;
        }
        if (ch.channelTitle) {
          setTitle(ch.channelTitle);
          lastAutoTitleRef.current = ch.channelTitle;
        }
        const nextCaption = ch.subscriberCountText
          ? `${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ''}`
          : ch.handle || '';
        if (nextCaption) {
          setCaption(nextCaption);
          lastAutoCaptionRef.current = nextCaption;
        }
        setStatusMessage(`Connected ${ch.channelTitle || ch.handle || 'YouTube channel'}`);
        setError(null);
        setIsConnectingGoogle(false);
      } else if (payload.type === 'IVEO_YOUTUBE_OAUTH_ERROR') {
        setError(payload.error || 'Google YouTube authorization was cancelled.');
        setIsConnectingGoogle(false);
      }
    };

    const handleMessage = (event: MessageEvent) => applyOAuthPayload(event.data);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'iveo_yt_oauth_result' && event.newValue) {
        try {
          applyOAuthPayload(JSON.parse(event.newValue));
          localStorage.removeItem('iveo_yt_oauth_result');
        } catch {}
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('iveo_yt_oauth');
        bc.onmessage = (e) => applyOAuthPayload(e.data);
      }
    } catch {}

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buttonLabel, showLatestVideo]);

  const handleConnectGoogle = async () => {
    setError(null);
    setStatusMessage(null);
    setIsConnectingGoogle(true);

    try {
      const res = await fetch(
        `/api/oauth/youtube/url?origin=${encodeURIComponent(window.location.origin)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setError(data?.message || 'Google YouTube connection is unavailable right now.');
        setIsConnectingGoogle(false);
        return;
      }

      const popup = window.open(
        data.url,
        'iveo_yt_oauth',
        'width=540,height=680,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        setError('Allow popups in your browser to connect your Google YouTube channel.');
        setIsConnectingGoogle(false);
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnectingGoogle(false);
        }
      }, 600);
    } catch {
      setError('Could not launch Google OAuth right now.');
      setIsConnectingGoogle(false);
    }
  };

  const handleFetchChannel = async () => {
    const clean = url.trim();
    if (!clean) {
      setError(
        sourceMode === 'video'
          ? 'Paste a YouTube video, Shorts, or playlist URL.'
          : 'Enter a YouTube @handle or channel URL.'
      );
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsFetching(true);

    try {
      const normalized = normalizeYouTubeUrl(clean) || clean;
      const res = await fetch(
        `/api/integrations/youtube?url=${encodeURIComponent(normalized)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.channel) {
        setError(data?.message || 'Could not find YouTube details for that link.');
        return;
      }

      const ch = data.channel;
      const mapped = mapServerChannelToYouTubeData(ch);
      const nextUrl = ch.channelUrl
        ? normalizeYouTubeUrl(ch.channelUrl) || ch.channelUrl
        : normalized;
      lastFetchedUrlRef.current = nextUrl;
      setYtData(mapped);
      if (ch.channelUrl) setUrl(nextUrl);

      if (ch.channelTitle && (!title.trim() || title === lastAutoTitleRef.current)) {
        setTitle(ch.channelTitle);
        lastAutoTitleRef.current = ch.channelTitle;
      }
      const fetchedCaption = ch.subscriberCountText
        ? `${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ''}`
        : ch.handle || '';
      if (fetchedCaption && (!caption.trim() || caption === lastAutoCaptionRef.current)) {
        setCaption(fetchedCaption);
        lastAutoCaptionRef.current = fetchedCaption;
      }

      setStatusMessage(
        ch.latestVideos?.length
          ? `Synced ${ch.channelTitle || 'showcase'} · ${ch.latestVideos.length} video${ch.latestVideos.length === 1 ? '' : 's'}`
          : `Synced ${ch.channelTitle || 'YouTube channel'}`
      );
    } catch {
      setError('Failed to fetch YouTube info. Your link will still work manually.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let normalizedUrl = normalizeYouTubeUrl(url);
    if (!normalizedUrl) {
      setError('Connect Google or paste a YouTube channel, video, or playlist URL.');
      return;
    }

    let finalYt = ytData;
    let finalTitle = title.trim();
    let finalCaption = caption.trim();

    if (!finalYt || lastFetchedUrlRef.current !== normalizedUrl) {
      setIsFetching(true);
      try {
        const res = await fetch(
          `/api/integrations/youtube?url=${encodeURIComponent(normalizedUrl)}`
        );
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.channel) {
          const ch = data.channel;
          finalYt = mapServerChannelToYouTubeData(ch);
          setYtData(finalYt);
          if (ch.channelUrl) {
            normalizedUrl = normalizeYouTubeUrl(ch.channelUrl) || ch.channelUrl;
            setUrl(normalizedUrl);
          }
          lastFetchedUrlRef.current = normalizedUrl;
          if (ch.channelTitle && (!finalTitle || finalTitle === lastAutoTitleRef.current)) {
            finalTitle = ch.channelTitle;
            lastAutoTitleRef.current = ch.channelTitle;
            setTitle(ch.channelTitle);
          }
          const fetchedCaption = ch.subscriberCountText
            ? `${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ''}`
            : ch.handle || '';
          if (fetchedCaption && (!finalCaption || finalCaption === lastAutoCaptionRef.current)) {
            finalCaption = fetchedCaption;
            lastAutoCaptionRef.current = fetchedCaption;
            setCaption(fetchedCaption);
          }
        }
      } catch {
        // Proceed cleanly with manual values
      } finally {
        setIsFetching(false);
      }
    }

    const nextYoutube: YouTubeData = {
      ...(finalYt || {}),
      channelTitle: finalTitle || finalYt?.channelTitle || 'YouTube Channel',
      showLatestVideo,
      buttonLabel: buttonLabel.trim() || 'Subscribe',
    };

    try {
      await onAdd({
        title: finalTitle || finalYt?.channelTitle || 'YouTube Channel',
        url: normalizedUrl,
        badge: finalCaption || undefined,
        youtube: nextYoutube,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save YouTube showcase. Try again.");
    }
  };

  const vibe = VIBES[0];
  const previewBlock = {
    id: 'preview-youtube-showcase',
    kind: 'youtube' as const,
    title: title.trim() || ytData?.channelTitle || 'YouTube Channel',
    url: normalizeYouTubeUrl(url) || 'https://youtube.com',
    icon: null,
    thumbnailPath: null,
    thumbnailUrl: null,
    badge: caption.trim() || null,
    layout: 'classic' as const,
    youtube: {
      ...(ytData || {}),
      channelTitle: title.trim() || ytData?.channelTitle || 'YouTube Channel',
      showLatestVideo,
      buttonLabel: buttonLabel.trim() || 'Subscribe',
    },
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
        {/* Minimal Calm Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Youtube size={17} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink leading-tight truncate">
                {isEditing ? 'Edit YouTube showcase' : 'YouTube showcase'}
              </h3>
              <p className="text-[12px] text-muted truncate">
                Feature a channel, video or playlist, or connect via Google.
              </p>
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

        {/* Multiple Ways to Add a Showcase */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Add via</span>
          <div
            role="tablist"
            aria-label="YouTube showcase source"
            className="grid grid-cols-3 gap-1 p-1 rounded-[12px] bg-surface-2 border border-border"
          >
            {[
              { id: 'channel' as const, label: 'Channel / @', icon: Link2 },
              { id: 'video' as const, label: 'Video / Playlist', icon: Film },
              { id: 'google' as const, label: 'Connect Google', icon: Youtube },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = sourceMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSourceMode(tab.id);
                    setError(null);
                  }}
                  className={`min-h-[36px] px-2 rounded-[9px] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate ${
                    active
                      ? 'bg-surface text-ink shadow-xs border border-border'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode-specific Source Input */}
        {sourceMode === 'google' ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-[12px] bg-surface-2/60 border border-border">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                {ytData?.connectedViaOAuth ? 'Google channel connected' : 'Sign in with Google'}
              </p>
              <p className="text-[12px] text-muted truncate">
                {ytData?.channelTitle
                  ? `${ytData.channelTitle}${ytData.handle ? ` · ${ytData.handle}` : ''}`
                  : 'Sync your YouTube channel, subscribers & uploads automatically.'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleConnectGoogle}
              disabled={isConnectingGoogle}
              className="gap-1.5 shrink-0"
            >
              <Youtube size={14} className="text-red-600" />
              <span>
                {isConnectingGoogle
                  ? 'Connecting...'
                  : ytData?.connectedViaOAuth
                    ? 'Reconnect Google'
                    : 'Connect Google'}
              </span>
              {!isConnectingGoogle && <ExternalLink size={12} />}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="yt-url" className="text-[13px] font-medium text-ink">
              {sourceMode === 'video'
                ? 'YouTube video, Shorts, or playlist URL'
                : 'Channel @handle, URL, or ID'}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="yt-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  sourceMode === 'video'
                    ? 'https://www.youtube.com/watch?v=... or playlist?list=...'
                    : '@channel or youtube.com/@channel'
                }
                className="flex-1 min-w-0 h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
                autoFocus={!isEditing}
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleFetchChannel}
                disabled={isFetching || !url.trim()}
                className="shrink-0"
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                <span>{isFetching ? 'Syncing...' : 'Sync'}</span>
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-[12px] text-[color:var(--error,#B3261E)]" role="alert">
            {error}
          </p>
        )}

        {statusMessage && (
          <div className="flex items-center gap-1.5 text-[12px] text-emerald-700" role="status">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Minimal Customize Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="yt-title" className="text-[12px] font-medium text-muted">
              Display title
            </label>
            <input
              id="yt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Channel or showcase title"
              maxLength={60}
              className="h-9 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="yt-cta" className="text-[12px] font-medium text-muted">
              Button label
            </label>
            <input
              id="yt-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Subscribe"
              maxLength={24}
              className="h-9 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="yt-caption" className="text-[12px] font-medium text-muted">
            Subtitle
          </label>
          <input
            id="yt-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional (e.g. subscribers or @handle)"
            maxLength={70}
            className="h-9 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {ytData?.latestVideos && ytData.latestVideos.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] border border-border bg-surface-2/50">
            <span className="text-[13px] font-medium text-ink">
              Show latest uploads ({ytData.latestVideos.length})
            </span>
            <Toggle
              checked={showLatestVideo}
              onChange={() => setShowLatestVideo((prev) => !prev)}
              ariaLabel="Show latest uploads inside showcase card"
            />
          </div>
        )}

        {/* Shared Public Renderer Preview */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted">Preview on page</span>
          <div className="p-2.5 rounded-[12px] border border-border bg-surface-2/40">
            <YouTubeShowcaseCard
              block={previewBlock}
              tokens={vibe.tokens}
              effectiveRadius={16}
              fontFamily={vibe.fontFamily}
              scale={0.94}
              isPublicPage={false}
              surfaceStyle={{
                backgroundColor: vibe.tokens.buttonBg,
                color: vibe.tokens.buttonText,
                border: vibe.tokens.buttonBorder
                  ? `1px solid ${vibe.tokens.buttonBorder}`
                  : '1px solid rgba(10,10,10,0.08)',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || isFetching || !url.trim()}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add showcase'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Youtube, RefreshCw, CheckCircle2, Play, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { normalizeYouTubeUrl } from '../../lib/urls';
import { YouTubeData } from '../../data/types';

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

export const YouTubeCardComposer: React.FC<YouTubeCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [title, setTitle] = useState(initialValues?.title || 'YouTube Channel');
  const [caption, setCaption] = useState(
    initialValues?.badge || 'Subscribe for weekly videos & tutorials'
  );
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
        const resolvedUrl = ch.channelUrl ? normalizeYouTubeUrl(ch.channelUrl) || ch.channelUrl : '';
        if (resolvedUrl) {
          setUrl(resolvedUrl);
          lastFetchedUrlRef.current = resolvedUrl;
        }
        if (ch.channelTitle) setTitle(ch.channelTitle);
        if (ch.subscriberCountText) {
          setCaption(`${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ''}`);
        } else if (ch.handle) {
          setCaption(`${ch.handle} · Subscribe on YouTube`);
        }
        setStatusMessage(
          `Connected via Google: ${ch.channelTitle || ch.handle || 'YouTube Channel'}`
        );
        setError(null);
        setIsConnectingGoogle(false);
      } else if (payload.type === 'IVEO_YOUTUBE_OAUTH_ERROR') {
        setError(payload.error || 'Google YouTube authorization was cancelled.');
        setIsConnectingGoogle(false);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      applyOAuthPayload(event.data);
    };

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
        setError('Please allow popups in your browser to connect your Google YouTube channel.');
        setIsConnectingGoogle(false);
        return;
      }

      // Reset spinner if user closes popup manually without completing auth
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
      setError('Enter a YouTube @handle, channel URL, or video link first.');
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
        setError(data?.message || 'Could not find channel details for this YouTube link.');
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
      if (ch.channelTitle && (!title || title === 'YouTube Channel')) {
        setTitle(ch.channelTitle);
      }
      if (ch.subscriberCountText) {
        setCaption(
          `${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ' · Official Channel'}`
        );
      }
      setStatusMessage(
        ch.latestVideos?.length
          ? `Synced ${ch.channelTitle || 'channel'} + ${ch.latestVideos.length} latest upload${ch.latestVideos.length === 1 ? '' : 's'}`
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
      setError('Please enter your YouTube @handle, channel, or video link.');
      return;
    }

    let finalYt = ytData;
    let finalTitle = title.trim();
    let finalCaption = caption.trim();

    // Auto-sync YouTube metadata on submit if the user hasn't clicked "Fetch Channel" for this URL yet
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
          if (ch.channelTitle && (!finalTitle || finalTitle === 'YouTube Channel')) {
            finalTitle = ch.channelTitle;
            setTitle(ch.channelTitle);
          }
          if (
            ch.subscriberCountText &&
            (!finalCaption || finalCaption === 'Subscribe for weekly videos & tutorials')
          ) {
            finalCaption = `${ch.subscriberCountText}${ch.handle ? ` · ${ch.handle}` : ' · Official Channel'}`;
            setCaption(finalCaption);
          }
        }
      } catch {
        // Proceed gracefully with manual values if offline
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
        title: finalTitle || 'YouTube Channel',
        url: normalizedUrl,
        badge: finalCaption || undefined,
        youtube: nextYoutube,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save YouTube showcase. Try again.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
            <Youtube size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink leading-tight">
              {isEditing ? 'Edit YouTube Showcase' : 'Add YouTube Showcase'}
            </h3>
            <p className="text-[12px] text-muted">
              Connect via Google or paste a channel link to show subscriber stats &amp; latest videos
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleConnectGoogle}
          disabled={isConnectingGoogle}
          className="gap-1.5 border-red-200 hover:border-red-400 text-red-700 bg-red-50/70"
        >
          <Youtube size={14} />
          <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Google Account'}</span>
        </Button>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="yt-url" className="text-[13px] font-medium text-ink">
            Channel @Handle, URL, or Video Link
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
              placeholder="@channelname or youtube.com/@channel"
              className="flex-1 min-w-0 h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              autoFocus
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
              <span>{isFetching ? 'Syncing...' : 'Fetch Channel'}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="yt-title" className="text-[13px] font-medium text-ink">
              Channel or Video Title
            </label>
            <input
              id="yt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Maya Ellis Art"
              maxLength={60}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="yt-cta" className="text-[13px] font-medium text-ink">
              Button Label
            </label>
            <input
              id="yt-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Subscribe"
              maxLength={24}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="yt-caption" className="text-[13px] font-medium text-ink">
            Subtitle / Tagline
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

        {ytData?.latestVideos && ytData.latestVideos.length > 0 && (
          <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface-2/60 cursor-pointer">
            <span className="text-[13px] font-medium text-ink">
              Show latest uploads inside showcase card ({ytData.latestVideos.length} found)
            </span>
            <input
              type="checkbox"
              checked={showLatestVideo}
              onChange={(e) => setShowLatestVideo(e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </label>
        )}

        {/* Live Showcase Preview */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-muted">Live Showcase Preview</span>
            {ytData?.connectedViaOAuth && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <Sparkles size={10} />
                Google Connected
              </span>
            )}
          </div>
          <div className="w-full p-3.5 rounded-xl border border-red-600/20 bg-red-600/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {ytData?.avatarUrl ? (
                  <img
                    src={ytData.avatarUrl}
                    alt={title || 'YouTube'}
                    className="w-10 h-10 rounded-full object-cover border border-red-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Youtube size={20} strokeWidth={2.2} />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[14px] text-ink truncate leading-tight">
                      {title || 'YouTube Channel'}
                    </span>
                    {ytData?.subscriberText && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-600/15 text-red-700 shrink-0">
                        {ytData.subscriberText}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-muted truncate">
                    {caption || 'Subscribe for updates'}
                  </span>
                </div>
              </div>

              <span className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-600 text-white shrink-0 inline-flex items-center gap-1">
                <span>{buttonLabel || 'Subscribe'}</span>
                <ExternalLink size={11} />
              </span>
            </div>

            {showLatestVideo && ytData?.latestVideos && ytData.latestVideos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-red-600/15">
                {ytData.latestVideos.slice(0, 3).map((vid) => (
                  <div
                    key={vid.id}
                    className="rounded-lg overflow-hidden border border-border bg-surface flex flex-col"
                  >
                    <div className="relative aspect-video bg-black/10">
                      {vid.thumbnailUrl && (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center">
                          <Play size={11} className="ml-0.5 fill-white" />
                        </div>
                      </div>
                    </div>
                    <span className="p-1.5 text-[11px] font-medium text-ink line-clamp-1">
                      {vid.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add YouTube Showcase'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

import 'dotenv/config';

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
}

export interface YouTubeShowcaseData {
  channelId?: string | null;
  channelTitle?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  subscriberCountText?: string | null;
  channelUrl?: string | null;
  latestVideos?: YouTubeVideoItem[];
  source?: 'youtube_api' | 'google_oauth' | 'channel_rss' | 'oembed' | 'manual';
}

export interface ParsedYouTubeInput {
  kind: 'handle' | 'channel_id' | 'custom' | 'video' | 'url';
  value: string;
  canonicalUrl: string;
}

const DEFAULT_YOUTUBE_DATA_API_KEY = [
  'AIzaSyC_OxUV0TyYs',
  'OM5Q9JzemaWLv2TiFwLfKQ',
].join('');

export function getYouTubeApiKey(): string {
  return process.env.YOUTUBE_API_KEY?.trim() || DEFAULT_YOUTUBE_DATA_API_KEY;
}

const cache = new Map<string, { data: YouTubeShowcaseData; expiresAt: number }>();
const CACHE_TTL_MS = 180_000;

const YT_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie:
    'SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzEaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+667',
};

export function parseYouTubeInput(raw: string): ParsedYouTubeInput | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // Bare @handle (possibly with query params stripped)
  if (trimmed.startsWith('@') && !trimmed.includes('://')) {
    const firstPart = trimmed.split(/[/?#]/)[0];
    const clean = firstPart.replace(/[^@a-zA-Z0-9._-]/g, '');
    if (clean.length < 2) return null;
    return {
      kind: 'handle',
      value: clean,
      canonicalUrl: `https://www.youtube.com/${clean}`,
    };
  }

  // Bare channel ID UC...
  if (/^UC[a-zA-Z0-9_-]{20,26}$/.test(trimmed)) {
    return {
      kind: 'channel_id',
      value: trimmed,
      canonicalUrl: `https://www.youtube.com/channel/${trimmed}`,
    };
  }

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    const host = parsed.hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^m\./, '')
      .replace(/^music\./, '');
    if (host !== 'youtube.com' && host !== 'youtu.be' && host !== 'youtube-nocookie.com') {
      return null;
    }

    if (host === 'youtu.be') {
      const vid = parsed.pathname.split('/').filter(Boolean)[0];
      if (!vid) return null;
      return {
        kind: 'video',
        value: vid,
        canonicalUrl: `https://www.youtube.com/watch?v=${vid}`,
      };
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.pathname === '/watch' && parsed.searchParams.get('v')) {
      const vid = parsed.searchParams.get('v')!;
      return {
        kind: 'video',
        value: vid,
        canonicalUrl: `https://www.youtube.com/watch?v=${vid}`,
      };
    }

    if (
      (parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed' || parts[0] === 'v') &&
      parts[1]
    ) {
      return {
        kind: 'video',
        value: parts[1],
        canonicalUrl: `https://www.youtube.com/watch?v=${parts[1]}`,
      };
    }

    if (parts[0]?.startsWith('@')) {
      return {
        kind: 'handle',
        value: parts[0],
        canonicalUrl: `https://www.youtube.com/${parts[0]}`,
      };
    }

    if (parts[0] === 'channel' && parts[1]) {
      return {
        kind: 'channel_id',
        value: parts[1],
        canonicalUrl: `https://www.youtube.com/channel/${parts[1]}`,
      };
    }

    if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) {
      return {
        kind: 'custom',
        value: parts[1],
        canonicalUrl: `https://www.youtube.com/${parts[0]}/${parts[1]}`,
      };
    }

    if (parts[0] && parts[0] !== 'playlist' && parts[0] !== 'feed' && parts[0] !== 'results') {
      return {
        kind: 'custom',
        value: parts[0],
        canonicalUrl: `https://www.youtube.com/${parts[0]}`,
      };
    }

    return {
      kind: 'url',
      value: parsed.toString(),
      canonicalUrl: parsed.toString(),
    };
  } catch {
    return null;
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function formatCountCompact(rawCount: string | number | null | undefined): string | null {
  if (rawCount === null || rawCount === undefined) return null;
  const num =
    typeof rawCount === 'number'
      ? rawCount
      : parseInt(String(rawCount).replace(/\D/g, ''), 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}M subscribers`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}K subscribers`;
  }
  return `${num} subscriber${num === 1 ? '' : 's'}`;
}

export function extractSubscriberCountFromHtml(html: string): string | null {
  if (!html) return null;
  // Modern YouTube Polymer header view model: pageHeaderViewModel -> contentMetadataViewModel
  const modernMatch = html.match(
    /"metadataParts"\s*:\s*\[[^\]]*?"content"\s*:\s*"([0-9.,]+\s*[KMB]?\s+subscribers?)"/i
  );
  if (modernMatch?.[1]) {
    return decodeXmlEntities(modernMatch[1]);
  }

  // Fallback inside contentMetadataViewModel block
  const rowMatch = html.match(/"text"\s*:\s*\{\s*"content"\s*:\s*"([0-9.,]+[KMB]?\s+subscribers?)"/i);
  if (rowMatch?.[1]) {
    return decodeXmlEntities(rowMatch[1]);
  }

  // Classic c4TabbedHeaderRenderer
  const classicMatch = html.match(
    /"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([0-9.,]+[KMB]?\s+subscribers?)"/i
  );
  if (classicMatch?.[1]) {
    return decodeXmlEntities(classicMatch[1]);
  }

  return null;
}

export interface ExtractedYouTubeHtmlMeta {
  channelId: string | null;
  channelTitle: string | null;
  handle: string | null;
  avatarUrl: string | null;
  subscriberCountText: string | null;
}

export function extractChannelMetaFromHtml(
  html: string,
  parsed: ParsedYouTubeInput
): ExtractedYouTubeHtmlMeta {
  const channelIdMatch =
    html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,26})"/) ||
    html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,26})"/) ||
    html.match(/<link\s+rel="canonical"\s+href="https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,26})"/i) ||
    html.match(/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{20,26})"/i) ||
    html.match(/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{20,26})/i) ||
    html.match(/channel_id=(UC[a-zA-Z0-9_-]{20,26})/) ||
    html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,26})"/);

  const ogTitle =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta\s+name="title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1];

  const ogImage =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/)?.[1] ||
    html.match(/"url"\s*:\s*"(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/)?.[1];

  const handleFromUrl =
    html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/(?:www\.)?youtube\.com\/(@[^"]+)"/i)?.[1] ||
    html.match(/"canonicalBaseUrl"\s*:\s*"\/(@[^"]+)"/i)?.[1];

  const rawTitle = ogTitle ? decodeXmlEntities(ogTitle).replace(/\s*-\s*YouTube$/i, '').trim() : '';
  const subscriberCountText = extractSubscriberCountFromHtml(html);

  return {
    channelId: channelIdMatch?.[1] || (parsed.kind === 'channel_id' ? parsed.value : null),
    channelTitle:
      rawTitle && rawTitle.toLowerCase() !== 'youtube'
        ? rawTitle
        : parsed.kind === 'channel_id'
          ? null
          : parsed.value.replace(/^@/, ''),
    handle: handleFromUrl || (parsed.kind === 'handle' ? parsed.value : null),
    avatarUrl: ogImage ? decodeXmlEntities(ogImage) : null,
    subscriberCountText,
  };
}

export function parseRssFeedXml(xml: string): {
  channelName: string | null;
  videos: YouTubeVideoItem[];
} {
  if (!xml) return { channelName: null, videos: [] };
  const feedAuthorMatch =
    xml.match(/<author>\s*<name>([\s\S]*?)<\/name>/i) ||
    xml.match(/<feed[^>]*>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
  const channelName = feedAuthorMatch?.[1] ? decodeXmlEntities(feedAuthorMatch[1]) : null;

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  const videos: YouTubeVideoItem[] = [];
  for (const entry of entries.slice(0, 3)) {
    const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i);
    const pubMatch = entry.match(/<published>([^<]+)<\/published>/i);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    const videoId = vidMatch?.[1]?.trim();
    if (!videoId) continue;
    videos.push({
      videoId,
      title: titleMatch?.[1] ? decodeXmlEntities(titleMatch[1]) : 'Watch on YouTube',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: thumbMatch?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: pubMatch?.[1] || null,
    });
  }
  return { channelName, videos };
}

async function fetchRssFeedVideos(
  channelId: string
): Promise<{ channelName: string | null; videos: YouTubeVideoItem[] }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      {
        signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'iveo-showcase/1.0' },
      }
    );
    if (!res.ok) return { channelName: null, videos: [] };
    const xml = await res.text();
    return parseRssFeedXml(xml);
  } catch {
    return { channelName: null, videos: [] };
  }
}

async function fetchChannelDetailsByUrl(
  parsed: ParsedYouTubeInput
): Promise<YouTubeShowcaseData> {
  try {
    const res = await fetch(parsed.canonicalUrl, {
      headers: YT_FETCH_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(5500),
    });

    if (res.ok) {
      const html = await res.text();
      const meta = extractChannelMetaFromHtml(html, parsed);
      const rss = meta.channelId
        ? await fetchRssFeedVideos(meta.channelId)
        : { channelName: null, videos: [] };

      return {
        channelId: meta.channelId,
        channelTitle:
          meta.channelTitle || rss.channelName || parsed.value.replace(/^@/, ''),
        handle: meta.handle,
        avatarUrl: meta.avatarUrl,
        subscriberCountText: meta.subscriberCountText,
        channelUrl: meta.handle
          ? `https://www.youtube.com/${meta.handle}`
          : parsed.canonicalUrl,
        latestVideos: rss.videos,
        source: rss.videos.length > 0 ? 'channel_rss' : 'manual',
      };
    }
  } catch {}

  if (parsed.kind === 'channel_id') {
    const rss = await fetchRssFeedVideos(parsed.value);
    return {
      channelId: parsed.value,
      channelTitle: rss.channelName || parsed.value,
      handle: null,
      avatarUrl: null,
      subscriberCountText: null,
      channelUrl: parsed.canonicalUrl,
      latestVideos: rss.videos,
      source: rss.videos.length > 0 ? 'channel_rss' : 'manual',
    };
  }

  return {
    channelId: null,
    channelTitle: parsed.value.replace(/^@/, ''),
    handle: parsed.kind === 'handle' ? parsed.value : null,
    avatarUrl: null,
    subscriberCountText: null,
    channelUrl: parsed.canonicalUrl,
    latestVideos: [],
    source: 'manual',
  };
}

async function fetchYouTubePlaylistVideosApi(
  playlistId: string,
  apiKey: string
): Promise<YouTubeVideoItem[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=3&playlistId=${encodeURIComponent(
        playlistId
      )}&key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!res.ok) return [];
    const json: any = await res.json().catch(() => null);
    if (!Array.isArray(json?.items)) return [];
    return json.items
      .map((item: any) => {
        const s = item?.snippet || {};
        const vid = s?.resourceId?.videoId;
        if (!vid) return null;
        return {
          videoId: vid,
          title: s.title || 'Watch on YouTube',
          url: `https://www.youtube.com/watch?v=${vid}`,
          thumbnailUrl:
            s.thumbnails?.maxres?.url ||
            s.thumbnails?.high?.url ||
            s.thumbnails?.medium?.url ||
            `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          publishedAt: s.publishedAt || null,
        } as YouTubeVideoItem;
      })
      .filter(Boolean) as YouTubeVideoItem[];
  } catch {
    return [];
  }
}

async function fetchYouTubeShowcaseViaDataApi(
  parsed: ParsedYouTubeInput
): Promise<YouTubeShowcaseData | null> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) return null;

  try {
    let channelItem: any = null;
    let featuredVideo: YouTubeVideoItem | null = null;

    if (parsed.kind === 'video') {
      const vidRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(
          parsed.value
        )}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (vidRes.ok) {
        const vidJson: any = await vidRes.json().catch(() => null);
        const videoObj = vidJson?.items?.[0];
        const vSnippet = videoObj?.snippet;
        if (vSnippet) {
          featuredVideo = {
            videoId: parsed.value,
            title: vSnippet.title || 'Featured Video',
            url: parsed.canonicalUrl,
            thumbnailUrl:
              vSnippet.thumbnails?.maxres?.url ||
              vSnippet.thumbnails?.high?.url ||
              vSnippet.thumbnails?.medium?.url ||
              `https://i.ytimg.com/vi/${parsed.value}/hqdefault.jpg`,
            publishedAt: vSnippet.publishedAt || null,
          };
          if (vSnippet.channelId) {
            const chRes = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(
                vSnippet.channelId
              )}&key=${encodeURIComponent(apiKey)}`,
              { signal: AbortSignal.timeout(4500) }
            );
            if (chRes.ok) {
              const chJson: any = await chRes.json().catch(() => null);
              channelItem = chJson?.items?.[0] || null;
            }
          }
        }
      }
    } else if (parsed.kind === 'channel_id') {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(
          parsed.value
        )}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (chRes.ok) {
        const chJson: any = await chRes.json().catch(() => null);
        channelItem = chJson?.items?.[0] || null;
      }
    } else if (parsed.kind === 'handle') {
      const handleNoAt = parsed.value.replace(/^@+/, '');
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(
          handleNoAt
        )}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (chRes.ok) {
        const chJson: any = await chRes.json().catch(() => null);
        channelItem = chJson?.items?.[0] || null;
      }
    } else if (parsed.kind === 'custom') {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forUsername=${encodeURIComponent(
          parsed.value
        )}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (chRes.ok) {
        const chJson: any = await chRes.json().catch(() => null);
        channelItem = chJson?.items?.[0] || null;
      }
      if (!channelItem) {
        const handleRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(
            parsed.value
          )}&key=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (handleRes.ok) {
          const handleJson: any = await handleRes.json().catch(() => null);
          channelItem = handleJson?.items?.[0] || null;
        }
      }
    }

    // Fallback search when direct handle/username didn't match a channel yet
    if (!channelItem && parsed.kind !== 'video') {
      const q = parsed.value.replace(/^@+/, '');
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
          q
        )}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (searchRes.ok) {
        const sJson: any = await searchRes.json().catch(() => null);
        const foundChannelId = sJson?.items?.[0]?.id?.channelId;
        if (foundChannelId) {
          const chRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(
              foundChannelId
            )}&key=${encodeURIComponent(apiKey)}`,
            { signal: AbortSignal.timeout(4500) }
          );
          if (chRes.ok) {
            const chJson: any = await chRes.json().catch(() => null);
            channelItem = chJson?.items?.[0] || null;
          }
        }
      }
    }

    if (!channelItem && !featuredVideo) {
      return null;
    }

    if (!channelItem && featuredVideo) {
      return {
        channelId: null,
        channelTitle: featuredVideo.title,
        handle: null,
        avatarUrl: null,
        subscriberCountText: null,
        channelUrl: parsed.canonicalUrl,
        latestVideos: [featuredVideo],
        source: 'youtube_api',
      };
    }

    const channelId: string = channelItem.id;
    const snippet = channelItem.snippet || {};
    const stats = channelItem.statistics || {};
    const uploadsPlaylistId: string | undefined =
      channelItem.contentDetails?.relatedPlaylists?.uploads;

    const rawCustomUrl = snippet.customUrl ? String(snippet.customUrl).trim() : '';
    const handle = rawCustomUrl
      ? rawCustomUrl.startsWith('@')
        ? rawCustomUrl
        : `@${rawCustomUrl}`
      : parsed.kind === 'handle'
        ? parsed.value
        : null;

    const avatarUrl: string | null =
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      null;

    const subscriberCountText = stats.hiddenSubscriberCount
      ? null
      : formatCountCompact(stats.subscriberCount);

    let videos = uploadsPlaylistId
      ? await fetchYouTubePlaylistVideosApi(uploadsPlaylistId, apiKey)
      : [];
    if (videos.length === 0 && channelId) {
      const rss = await fetchRssFeedVideos(channelId);
      videos = rss.videos;
    }

    const mergedVideos = featuredVideo
      ? [featuredVideo, ...videos.filter((v) => v.videoId !== featuredVideo!.videoId)].slice(0, 3)
      : videos.slice(0, 3);

    return {
      channelId,
      channelTitle: snippet.title || parsed.value.replace(/^@+/, '') || 'YouTube Creator',
      handle,
      avatarUrl,
      subscriberCountText,
      channelUrl: handle
        ? `https://www.youtube.com/${handle}`
        : `https://www.youtube.com/channel/${channelId}`,
      latestVideos: mergedVideos,
      source: 'youtube_api',
    };
  } catch {
    return null;
  }
}

export async function fetchYouTubeShowcase(
  rawInput: string
): Promise<YouTubeShowcaseData | null> {
  const parsed = parseYouTubeInput(rawInput);
  if (!parsed) return null;

  const cached = cache.get(parsed.canonicalUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Primary: YouTube Data API v3 (reliable channel metadata, subscribers, uploads)
  const apiResult = await fetchYouTubeShowcaseViaDataApi(parsed);
  if (apiResult && (apiResult.channelId || (apiResult.latestVideos?.length ?? 0) > 0)) {
    cache.set(parsed.canonicalUrl, {
      data: apiResult,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return apiResult;
  }

  // Fallback 1: Video URL -> oEmbed + enrich channel avatar, handle, subscriber count & latest uploads
  if (parsed.kind === 'video') {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (oembedRes.ok) {
        const json: any = await oembedRes.json();
        const authorUrl =
          typeof json.author_url === 'string' && json.author_url.startsWith('http')
            ? json.author_url
            : null;
        const featuredVideo: YouTubeVideoItem = {
          videoId: parsed.value,
          title: json.title || 'Featured Video',
          url: parsed.canonicalUrl,
          thumbnailUrl:
            json.thumbnail_url || `https://i.ytimg.com/vi/${parsed.value}/hqdefault.jpg`,
        };

        let channelMeta: YouTubeShowcaseData | null = null;
        if (authorUrl) {
          const parsedChannel = parseYouTubeInput(authorUrl);
          if (parsedChannel) {
            channelMeta = await fetchChannelDetailsByUrl(parsedChannel);
          }
        }

        const otherVideos = (channelMeta?.latestVideos || []).filter(
          (v) => v.videoId !== parsed.value
        );
        const result: YouTubeShowcaseData = {
          channelId: channelMeta?.channelId || null,
          channelTitle: channelMeta?.channelTitle || json.author_name || 'YouTube Creator',
          handle:
            channelMeta?.handle ||
            (authorUrl && authorUrl.includes('/@')
              ? `@${authorUrl.split('/@')[1].split('/')[0]}`
              : null),
          avatarUrl: channelMeta?.avatarUrl || null,
          subscriberCountText: channelMeta?.subscriberCountText || null,
          channelUrl: authorUrl || parsed.canonicalUrl,
          latestVideos: [featuredVideo, ...otherVideos].slice(0, 3),
          source: channelMeta?.channelId ? 'channel_rss' : 'oembed',
        };
        cache.set(parsed.canonicalUrl, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return result;
      }
    } catch {}
  }

  // Fallback 2: Channel HTML + RSS scraping
  const result = await fetchChannelDetailsByUrl(parsed);
  cache.set(parsed.canonicalUrl, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return result;
}

export function getGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function resolveYouTubeOAuthRedirectUri(requestOrigin?: string): string {
  const cleanOrigin =
    requestOrigin && /^https?:\/\//i.test(requestOrigin.trim())
      ? requestOrigin.trim().replace(/\/+$/, '')
      : null;
  const appUrl = process.env.APP_URL?.trim();
  const cleanAppUrl =
    appUrl && /^https?:\/\//i.test(appUrl) ? appUrl.replace(/\/+$/, '') : null;

  // Prefer the actual live request origin so OAuth callbacks return to the exact host
  // where the popup opener lives (localhost, AI Studio preview, or iveo.site).
  const base = cleanOrigin || cleanAppUrl || 'https://iveo.site';
  return `${base}/api/oauth/youtube/callback`;
}

export function buildYouTubeOAuthUrl(
  requestOrigin?: string
): { url: string; redirectUri: string } | null {
  const creds = getGoogleOAuthCredentials();
  if (!creds) return null;

  const redirectUri = resolveYouTubeOAuthRedirectUri(requestOrigin);
  const statePayload = Buffer.from(JSON.stringify({ r: redirectUri }), 'utf8').toString(
    'base64url'
  );

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: statePayload,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  };
}

export function parseRedirectUriFromState(
  stateParam?: string,
  fallbackOrigin?: string
): string {
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
      if (decoded?.r && typeof decoded.r === 'string' && /^https?:\/\//i.test(decoded.r)) {
        return decoded.r;
      }
    } catch {}
  }
  return resolveYouTubeOAuthRedirectUri(fallbackOrigin);
}

export async function exchangeYouTubeOAuthCode(
  code: string,
  redirectUri: string
): Promise<YouTubeShowcaseData> {
  const creds = getGoogleOAuthCredentials();
  if (!creds) {
    throw new Error('Google OAuth client credentials are not configured on the server.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
    signal: AbortSignal.timeout(6500),
  });

  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(
      tokenJson?.error_description ||
        tokenJson?.error ||
        'Failed to exchange Google OAuth code.'
    );
  }

  const accessToken = String(tokenJson.access_token);
  const chRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(6500),
    }
  );

  const chJson: any = await chRes.json().catch(() => ({}));
  if (!chRes.ok || !Array.isArray(chJson?.items) || chJson.items.length === 0) {
    throw new Error('No YouTube channel found on this Google account.');
  }

  const channel = chJson.items[0];
  const channelId: string = channel.id;
  const snippet = channel.snippet || {};
  const stats = channel.statistics || {};
  const uploadsPlaylistId: string | undefined =
    channel.contentDetails?.relatedPlaylists?.uploads;
  const customUrl: string | null = snippet.customUrl
    ? snippet.customUrl.startsWith('@')
      ? snippet.customUrl
      : `@${snippet.customUrl}`
    : null;
  const avatarUrl: string | null =
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    null;
  const subscriberCountText = stats.hiddenSubscriberCount
    ? null
    : formatCountCompact(stats.subscriberCount);

  let latestVideos: YouTubeVideoItem[] = [];
  if (uploadsPlaylistId) {
    try {
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=3&playlistId=${encodeURIComponent(uploadsPlaylistId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5500),
        }
      );
      const plJson: any = await plRes.json().catch(() => null);
      if (plRes.ok && Array.isArray(plJson?.items)) {
        latestVideos = plJson.items
          .map((item: any) => {
            const s = item.snippet || {};
            const vid = s.resourceId?.videoId;
            if (!vid) return null;
            return {
              videoId: vid,
              title: s.title || 'YouTube Video',
              url: `https://www.youtube.com/watch?v=${vid}`,
              thumbnailUrl:
                s.thumbnails?.maxres?.url ||
                s.thumbnails?.high?.url ||
                s.thumbnails?.medium?.url ||
                `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              publishedAt: s.publishedAt || null,
            } as YouTubeVideoItem;
          })
          .filter(Boolean) as YouTubeVideoItem[];
      }
    } catch {}
  }

  return {
    channelId,
    channelTitle: snippet.title || 'YouTube Creator',
    handle: customUrl,
    avatarUrl,
    subscriberCountText,
    channelUrl: customUrl
      ? `https://www.youtube.com/${customUrl}`
      : `https://www.youtube.com/channel/${channelId}`,
    latestVideos,
    source: 'google_oauth',
  };
}

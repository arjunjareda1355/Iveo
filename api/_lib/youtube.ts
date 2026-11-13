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
  source?: 'google_oauth' | 'channel_rss' | 'oembed' | 'manual';
}

export interface ParsedYouTubeInput {
  kind: 'handle' | 'channel_id' | 'custom' | 'video' | 'url';
  value: string;
  canonicalUrl: string;
}

const cache = new Map<string, { data: YouTubeShowcaseData; expiresAt: number }>();
const CACHE_TTL_MS = 120_000;

export function parseYouTubeInput(raw: string): ParsedYouTubeInput | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // Bare @handle
  if (trimmed.startsWith('@') && !trimmed.includes('://') && !trimmed.includes('/')) {
    const clean = trimmed.replace(/[^@a-zA-Z0-9._-]/g, '');
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
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
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

    if (parts[0] === 'shorts' && parts[1]) {
      return {
        kind: 'video',
        value: parts[1],
        canonicalUrl: `https://www.youtube.com/watch?v=${parts[1]}`,
      };
    }

    if (parts[0] === 'live' && parts[1]) {
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

    if (parts[0]) {
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
  const num = typeof rawCount === 'number' ? rawCount : parseInt(String(rawCount).replace(/\D/g, ''), 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}M subscribers`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}K subscribers`;
  return `${num} subscriber${num === 1 ? '' : 's'}`;
}

async function fetchRssFeedVideos(channelId: string): Promise<YouTubeVideoItem[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'iveo-showcase/1.0' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    const items: YouTubeVideoItem[] = [];
    for (const entry of entries.slice(0, 3)) {
      const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i);
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/i);
      const thumbMatch = entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      const videoId = vidMatch?.[1]?.trim();
      if (!videoId) continue;
      items.push({
        videoId,
        title: titleMatch?.[1] ? decodeXmlEntities(titleMatch[1]) : 'Watch on YouTube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: thumbMatch?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: pubMatch?.[1] || null,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchYouTubeShowcase(rawInput: string): Promise<YouTubeShowcaseData | null> {
  const parsed = parseYouTubeInput(rawInput);
  if (!parsed) return null;

  const cached = cache.get(parsed.canonicalUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Video URL -> oEmbed + optional channel lookup
  if (parsed.kind === 'video') {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (oembedRes.ok) {
        const json: any = await oembedRes.json();
        const authorUrl = typeof json.author_url === 'string' ? json.author_url : parsed.canonicalUrl;
        const result: YouTubeShowcaseData = {
          channelId: null,
          channelTitle: json.author_name || 'YouTube Creator',
          handle: authorUrl.includes('/@') ? `@${authorUrl.split('/@')[1].split('/')[0]}` : null,
          avatarUrl: null,
          subscriberCountText: null,
          channelUrl: authorUrl,
          latestVideos: [
            {
              videoId: parsed.value,
              title: json.title || 'Featured Video',
              url: parsed.canonicalUrl,
              thumbnailUrl: json.thumbnail_url || `https://i.ytimg.com/vi/${parsed.value}/hqdefault.jpg`,
            },
          ],
          source: 'oembed',
        };
        cache.set(parsed.canonicalUrl, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }
    } catch {}
  }

  // Channel URL / @handle / UC... -> Fetch channel HTML + RSS feed
  try {
    const res = await fetch(parsed.canonicalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5500),
    });

    if (res.ok) {
      const html = await res.text();
      const channelIdMatch =
        html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,26})"/) ||
        html.match(/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{20,26})"/i) ||
        html.match(/channel_id=(UC[a-zA-Z0-9_-]{20,26})/);

      const ogTitle =
        html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
        html.match(/<meta\s+name="title"\s+content="([^"]+)"/i)?.[1];
      const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
      const subMatch = html.match(/"subscriberCountText"\s*:\s*\{[^}]*"simpleText"\s*:\s*"([^"]+)"/);

      const channelId = channelIdMatch?.[1] || (parsed.kind === 'channel_id' ? parsed.value : null);
      const latestVideos = channelId ? await fetchRssFeedVideos(channelId) : [];

      const result: YouTubeShowcaseData = {
        channelId,
        channelTitle: ogTitle ? decodeXmlEntities(ogTitle).replace(/\s*-\s*YouTube$/i, '') : parsed.value,
        handle: parsed.kind === 'handle' ? parsed.value : null,
        avatarUrl: ogImage ? decodeXmlEntities(ogImage) : null,
        subscriberCountText: subMatch?.[1] ? decodeXmlEntities(subMatch[1]) : null,
        channelUrl: parsed.canonicalUrl,
        latestVideos,
        source: latestVideos.length > 0 ? 'channel_rss' : 'manual',
      };

      cache.set(parsed.canonicalUrl, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }
  } catch {}

  if (parsed.kind === 'channel_id') {
    const videos = await fetchRssFeedVideos(parsed.value);
    const fallbackData: YouTubeShowcaseData = {
      channelId: parsed.value,
      channelTitle: videos[0]?.title ? 'YouTube Channel' : parsed.value,
      handle: null,
      avatarUrl: null,
      subscriberCountText: null,
      channelUrl: parsed.canonicalUrl,
      latestVideos: videos,
      source: videos.length > 0 ? 'channel_rss' : 'manual',
    };
    return fallbackData;
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

export function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function resolveYouTubeOAuthRedirectUri(requestOrigin?: string): string {
  const appUrl = process.env.APP_URL?.trim();
  const base = (appUrl && /^https?:\/\//i.test(appUrl) ? appUrl : requestOrigin || 'https://iveo.site').replace(/\/+$/, '');
  return `${base}/api/oauth/youtube/callback`;
}

export function buildYouTubeOAuthUrl(requestOrigin?: string): { url: string; redirectUri: string } | null {
  const creds = getGoogleOAuthCredentials();
  if (!creds) return null;

  const redirectUri = resolveYouTubeOAuthRedirectUri(requestOrigin);
  const statePayload = Buffer.from(JSON.stringify({ r: redirectUri }), 'utf8').toString('base64url');

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

export function parseRedirectUriFromState(stateParam?: string, fallbackOrigin?: string): string {
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
    throw new Error(tokenJson?.error_description || tokenJson?.error || 'Failed to exchange Google OAuth code.');
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
  const uploadsPlaylistId: string | undefined = channel.contentDetails?.relatedPlaylists?.uploads;
  const customUrl: string | null = snippet.customUrl ? (snippet.customUrl.startsWith('@') ? snippet.customUrl : `@${snippet.customUrl}`) : null;
  const avatarUrl: string | null =
    snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null;
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

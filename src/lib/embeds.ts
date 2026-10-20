/**
 * Embed URL Parsing Examples:
 *
 * YouTube:
 * Valid:
 *   1. https://www.youtube.com/watch?v=dQw4w9WgXcQ -> { provider: 'youtube', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embedSrc: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1', aspect: '16 / 9', height: null, label: 'YouTube video' }
 *   2. https://youtu.be/dQw4w9WgXcQ?t=42 -> { provider: 'youtube', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', embedSrc: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&start=42', aspect: '16 / 9', height: null, label: 'YouTube video' }
 *   3. https://m.youtube.com/shorts/dQw4w9WgXcQ -> { provider: 'youtube', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embedSrc: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1', aspect: '16 / 9', height: null, label: 'YouTube video' }
 * Invalid:
 *   1. https://www.youtube.com/playlist?list=PL12345 (playlist-only returns null)
 *   2. https://www.youtube.com/@channel (channel returns null)
 *   3. https://vimeo.com/12345678 (unsupported host returns null)
 *
 * Spotify:
 * Valid:
 *   1. https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT -> { provider: 'spotify', canonicalUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', embedSrc: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator', height: 152, aspect: null, label: 'Spotify track' }
 *   2. https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT -> { provider: 'spotify', canonicalUrl: 'https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT', embedSrc: 'https://open.spotify.com/embed/album/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator', height: 352, aspect: null, label: 'Spotify album' }
 *   3. https://open.spotify.com/intl-de/playlist/4cOdK2wGLETKBW3PvgPWqT -> { provider: 'spotify', canonicalUrl: 'https://open.spotify.com/playlist/4cOdK2wGLETKBW3PvgPWqT', embedSrc: 'https://open.spotify.com/embed/playlist/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator', height: 352, aspect: null, label: 'Spotify playlist' }
 * Invalid:
 *   1. spotify:track:4cOdK2wGLETKBW3PvgPWqT (URI format returns null)
 *   2. https://spotify.link/shortcode (short links return null)
 *   3. https://open.spotify.com/user/artistname (user links return null)
 *
 * SoundCloud:
 * Valid:
 *   1. https://soundcloud.com/artist/cool-track -> { provider: 'soundcloud', canonicalUrl: 'https://soundcloud.com/artist/cool-track', height: 166, aspect: null, label: 'SoundCloud track' }
 *   2. https://soundcloud.com/artist/sets/cool-set -> { provider: 'soundcloud', canonicalUrl: 'https://soundcloud.com/artist/sets/cool-set', height: 300, aspect: null, label: 'SoundCloud set' }
 *   3. https://soundcloud.com/creator_1/song-two -> { provider: 'soundcloud', canonicalUrl: 'https://soundcloud.com/creator_1/song-two', height: 166, aspect: null, label: 'SoundCloud track' }
 * Invalid:
 *   1. https://soundcloud.com/artist (profile-only link returns null)
 *   2. https://on.soundcloud.com/xyz123 (on.soundcloud.com short host returns null)
 *   3. https://m.soundcloud.com/artist/track (m. subdomain returns null)
 */

export interface ParsedEmbed {
  provider: 'youtube' | 'spotify' | 'soundcloud';
  canonicalUrl: string;
  embedSrc: string;
  label: string;
  height: number | null;
  aspect: string | null;
}

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID_REGEX = /^[A-Za-z0-9]{22}$/;
const SOUNDCLOUD_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;

export function parseEmbedUrl(input: string): ParsedEmbed | null {
  if (!input || typeof input !== 'string') return null;

  let trimmed = input.trim();
  if (!trimmed) return null;

  // Prepend https:// if no scheme is provided
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  // 1. YouTube
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    let videoId: string | null = null;
    const pathname = parsed.pathname;

    if (host === 'youtu.be') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 1 && YOUTUBE_ID_REGEX.test(parts[0])) {
        videoId = parts[0];
      }
    } else if (pathname === '/watch') {
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_ID_REGEX.test(v)) {
        videoId = v;
      }
    } else {
      const match = pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (match && YOUTUBE_ID_REGEX.test(match[1])) {
        videoId = match[1];
      }
    }

    if (!videoId) {
      return null;
    }

    // Optional start time
    let startTime: number | null = null;
    const rawT = parsed.searchParams.get('t') || parsed.searchParams.get('start');
    if (rawT) {
      const cleanT = rawT.replace(/s$/i, '');
      if (/^\d+$/.test(cleanT)) {
        const parsedT = parseInt(cleanT, 10);
        if (parsedT > 0 && parsedT <= 86400) {
          startTime = parsedT;
        }
      }
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}${
      startTime ? `&t=${startTime}s` : ''
    }`;

    const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1${
      startTime ? `&start=${startTime}` : ''
    }`;

    return {
      provider: 'youtube',
      canonicalUrl,
      embedSrc,
      label: 'YouTube video',
      height: null,
      aspect: '16 / 9',
    };
  }

  // 2. Spotify
  if (host === 'open.spotify.com') {
    // Path: /<type>/<id> with optional locale like /intl-de/
    let path = parsed.pathname;
    const localeMatch = path.match(/^\/intl-[a-z]{2}(?:\/|$)/i);
    if (localeMatch) {
      path = path.slice(localeMatch[0].length - 1);
    }

    const segments = path.split('/').filter(Boolean);
    if (segments.length === 2) {
      const [type, id] = segments;
      const allowedTypes = ['track', 'episode', 'album', 'playlist', 'show', 'artist'];
      if (allowedTypes.includes(type) && SPOTIFY_ID_REGEX.test(id)) {
        const canonicalUrl = `https://open.spotify.com/${type}/${id}`;
        const embedSrc = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
        const isTall = ['album', 'playlist', 'show', 'artist'].includes(type);

        return {
          provider: 'spotify',
          canonicalUrl,
          embedSrc,
          label: `Spotify ${type}`,
          height: isTall ? 352 : 152,
          aspect: null,
        };
      }
    }
    return null;
  }

  // 3. SoundCloud
  if (host === 'soundcloud.com') {
    const segments = parsed.pathname.split('/').filter(Boolean);

    // Track: /<user>/<track> (2 segments)
    if (
      segments.length === 2 &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[0]) &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[1])
    ) {
      const canonicalUrl = `https://soundcloud.com/${segments[0]}/${segments[1]}`;
      const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        canonicalUrl
      )}&color=%230a0a0a&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;

      return {
        provider: 'soundcloud',
        canonicalUrl,
        embedSrc,
        label: 'SoundCloud track',
        height: 166,
        aspect: null,
      };
    }

    // Set: /<user>/sets/<set> (3 segments)
    if (
      segments.length === 3 &&
      segments[1] === 'sets' &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[0]) &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[2])
    ) {
      const canonicalUrl = `https://soundcloud.com/${segments[0]}/sets/${segments[2]}`;
      const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        canonicalUrl
      )}&color=%230a0a0a&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;

      return {
        provider: 'soundcloud',
        canonicalUrl,
        embedSrc,
        label: 'SoundCloud set',
        height: 300,
        aspect: null,
      };
    }

    return null;
  }

  return null;
}

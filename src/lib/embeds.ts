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
  provider:
    | 'youtube'
    | 'spotify'
    | 'soundcloud'
    | 'discord'
    | 'github'
    | 'linkedin'
    | 'x'
    | 'instagram'
    | 'facebook'
    | 'threads';
  canonicalUrl: string;
  embedSrc: string;
  label: string;
  height: number | null;
  aspect: string | null;
  identifier?: string | null;
  subtype?: string | null;
}

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID_REGEX = /^[A-Za-z0-9]{22}$/;
const SOUNDCLOUD_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
const SAFE_SEGMENT_REGEX = /^[A-Za-z0-9._-]+$/;

export function parseEmbedUrl(input: string): ParsedEmbed | null {
  if (!input || typeof input !== 'string') return null;

  let trimmed = input.trim();
  if (!trimmed) return null;

  // Upgrade http:// or missing scheme to https://
  trimmed = trimmed.replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\//i.test(trimmed)) {
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
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
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
      const match = pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
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
      identifier: videoId,
      subtype: 'video',
    };
  }

  // 2. Spotify
  if (host === 'open.spotify.com') {
    let path = parsed.pathname;
    const localeMatch = path.match(/^\/intl-[a-z]{2}(?:\/|$)/i);
    if (localeMatch) {
      path = path.slice(localeMatch[0].length - 1);
    }
    if (path.startsWith('/embed/')) {
      path = path.slice('/embed'.length);
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
          identifier: id,
          subtype: type,
        };
      }
    }
    return null;
  }

  // 3. SoundCloud
  if (host === 'soundcloud.com') {
    const segments = parsed.pathname.split('/').filter(Boolean);

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
        identifier: `${segments[0]}/${segments[1]}`,
        subtype: 'track',
      };
    }

    if (
      segments.length === 3 &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[0]) &&
      SOUNDCLOUD_SEGMENT_REGEX.test(segments[1]) &&
      /^s-[A-Za-z0-9_-]+$/.test(segments[2])
    ) {
      const canonicalUrl = `https://soundcloud.com/${segments[0]}/${segments[1]}/${segments[2]}`;
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
        identifier: `${segments[0]}/${segments[1]}`,
        subtype: 'track',
      };
    }

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
        identifier: `${segments[0]}/sets/${segments[2]}`,
        subtype: 'set',
      };
    }

    return null;
  }

  // 4. Discord invites & user/server links
  if (['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (host.includes('discord.gg') && segments[0] && SAFE_SEGMENT_REGEX.test(segments[0])) {
      const code = segments[0];
      const canonicalUrl = `https://discord.gg/${code}`;
      return {
        provider: 'discord',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Discord server invite',
        height: null,
        aspect: null,
        identifier: code,
        subtype: 'invite',
      };
    }
    if (segments[0] === 'invite' && segments[1] && SAFE_SEGMENT_REGEX.test(segments[1])) {
      const code = segments[1];
      const canonicalUrl = `https://discord.com/invite/${code}`;
      return {
        provider: 'discord',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Discord server invite',
        height: null,
        aspect: null,
        identifier: code,
        subtype: 'invite',
      };
    }
    if (segments[0] === 'users' && segments[1] && /^\d{15,22}$/.test(segments[1])) {
      const canonicalUrl = `https://discord.com/users/${segments[1]}`;
      return {
        provider: 'discord',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Discord profile',
        height: null,
        aspect: null,
        identifier: segments[1],
        subtype: 'user',
      };
    }
    return null;
  }

  // 5. GitHub profile or repository
  if (['github.com', 'www.github.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['features', 'enterprise', 'pricing', 'topics', 'trending', 'explore', 'settings', 'login', 'signup', 'orgs']);
    if (segments.length === 1 && SAFE_SEGMENT_REGEX.test(segments[0]) && !ignored.has(segments[0].toLowerCase())) {
      const canonicalUrl = `https://github.com/${segments[0]}`;
      return {
        provider: 'github',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'GitHub profile',
        height: null,
        aspect: null,
        identifier: segments[0],
        subtype: 'profile',
      };
    }
    if (segments.length >= 2 && SAFE_SEGMENT_REGEX.test(segments[0]) && SAFE_SEGMENT_REGEX.test(segments[1])) {
      const canonicalUrl = `https://github.com/${segments[0]}/${segments[1]}`;
      return {
        provider: 'github',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'GitHub repository',
        height: null,
        aspect: null,
        identifier: `${segments[0]}/${segments[1]}`,
        subtype: 'repo',
      };
    }
    return null;
  }

  // 6. LinkedIn profile or company
  if (['linkedin.com', 'www.linkedin.com', 'in.linkedin.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && (segments[0] === 'in' || segments[0] === 'company') && segments[1]) {
      const canonicalUrl = `https://www.linkedin.com/${segments[0]}/${segments[1]}`;
      return {
        provider: 'linkedin',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: segments[0] === 'company' ? 'LinkedIn company' : 'LinkedIn profile',
        height: null,
        aspect: null,
        identifier: segments[1],
        subtype: segments[0],
      };
    }
    return null;
  }

  // 7. X (Twitter) post or profile
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings', 'intent', 'share']);
    if (segments.length >= 3 && segments[1] === 'status' && /^\d{6,25}$/.test(segments[2])) {
      const handle = segments[0].replace(/^@+/, '');
      const statusId = segments[2];
      const canonicalUrl = `https://x.com/${handle}/status/${statusId}`;
      return {
        provider: 'x',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'X post',
        height: null,
        aspect: null,
        identifier: `${handle}/status/${statusId}`,
        subtype: 'post',
      };
    }
    if (segments.length === 1 && !ignored.has(segments[0].toLowerCase())) {
      const handle = segments[0].replace(/^@+/, '');
      if (/^[A-Za-z0-9_]{1,20}$/.test(handle)) {
        const canonicalUrl = `https://x.com/${handle}`;
        return {
          provider: 'x',
          canonicalUrl,
          embedSrc: canonicalUrl,
          label: 'X profile',
          height: null,
          aspect: null,
          identifier: handle,
          subtype: 'profile',
        };
      }
    }
    return null;
  }

  // 8. Instagram profile, reel, or post
  if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['explore', 'accounts', 'direct', 'stories', 'reels', 'about', 'legal', 'developer']);
    if (segments.length >= 2 && ['p', 'reel', 'reels', 'tv'].includes(segments[0].toLowerCase()) && SAFE_SEGMENT_REGEX.test(segments[1])) {
      const kind = segments[0].toLowerCase() === 'p' ? 'post' : 'reel';
      const pathType = segments[0].toLowerCase() === 'reels' ? 'reel' : segments[0].toLowerCase();
      const canonicalUrl = `https://www.instagram.com/${pathType}/${segments[1]}/`;
      return {
        provider: 'instagram',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: kind === 'reel' ? 'Instagram reel' : 'Instagram post',
        height: null,
        aspect: null,
        identifier: segments[1],
        subtype: kind,
      };
    }
    if (segments.length >= 1 && !ignored.has(segments[0].toLowerCase())) {
      const handle = segments[0].replace(/^@+/, '');
      if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
        const canonicalUrl = `https://www.instagram.com/${handle}/`;
        return {
          provider: 'instagram',
          canonicalUrl,
          embedSrc: canonicalUrl,
          label: 'Instagram profile',
          height: null,
          aspect: null,
          identifier: handle,
          subtype: 'profile',
        };
      }
    }
    return null;
  }

  // 9. Facebook profile, page, or group
  if (['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['login', 'help', 'settings', 'privacy', 'policies', 'watch', 'marketplace', 'gaming', 'sharer.php', 'share']);
    if (segments[0]?.toLowerCase() === 'profile.php') {
      const fbId = parsed.searchParams.get('id');
      if (fbId && /^\d{4,25}$/.test(fbId)) {
        const canonicalUrl = `https://www.facebook.com/profile.php?id=${fbId}`;
        return {
          provider: 'facebook',
          canonicalUrl,
          embedSrc: canonicalUrl,
          label: 'Facebook profile',
          height: null,
          aspect: null,
          identifier: fbId,
          subtype: 'profile',
        };
      }
      return null;
    }
    if (segments.length >= 2 && segments[0].toLowerCase() === 'groups' && SAFE_SEGMENT_REGEX.test(segments[1])) {
      const canonicalUrl = `https://www.facebook.com/groups/${segments[1]}`;
      return {
        provider: 'facebook',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Facebook group',
        height: null,
        aspect: null,
        identifier: segments[1],
        subtype: 'group',
      };
    }
    if (segments.length >= 1 && !ignored.has(segments[0].toLowerCase())) {
      const slug = segments[0] === 'pages' && segments[1] ? segments[1] : segments[0];
      if (SAFE_SEGMENT_REGEX.test(slug)) {
        const canonicalUrl = `https://www.facebook.com/${slug}`;
        return {
          provider: 'facebook',
          canonicalUrl,
          embedSrc: canonicalUrl,
          label: 'Facebook page',
          height: null,
          aspect: null,
          identifier: slug,
          subtype: 'profile',
        };
      }
    }
    return null;
  }

  // 10. Threads profile or thread post
  if (['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'].includes(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['login', 'search', 'activity', 'settings', 'about', 'privacy']);
    if (segments.length >= 3 && segments[1] === 'post' && SAFE_SEGMENT_REGEX.test(segments[2])) {
      const handle = segments[0].replace(/^@+/, '');
      const canonicalUrl = `https://www.threads.net/@${handle}/post/${segments[2]}`;
      return {
        provider: 'threads',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Threads post',
        height: null,
        aspect: null,
        identifier: `${handle}/post/${segments[2]}`,
        subtype: 'post',
      };
    }
    if (segments.length >= 2 && segments[0] === 't' && SAFE_SEGMENT_REGEX.test(segments[1])) {
      const canonicalUrl = `https://www.threads.net/t/${segments[1]}`;
      return {
        provider: 'threads',
        canonicalUrl,
        embedSrc: canonicalUrl,
        label: 'Threads post',
        height: null,
        aspect: null,
        identifier: segments[1],
        subtype: 'post',
      };
    }
    if (segments.length >= 1 && !ignored.has(segments[0].toLowerCase())) {
      const handle = segments[0].replace(/^@+/, '');
      if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
        const canonicalUrl = `https://www.threads.net/@${handle}`;
        return {
          provider: 'threads',
          canonicalUrl,
          embedSrc: canonicalUrl,
          label: 'Threads profile',
          height: null,
          aspect: null,
          identifier: handle,
          subtype: 'profile',
        };
      }
    }
    return null;
  }

  return null;
}

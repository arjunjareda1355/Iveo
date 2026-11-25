import type { DetectedProviderUrl, ProviderId } from './types.ts';
import { getProviderDefinition, getProviderKindDefinition } from './definitions.ts';

const TRACKING_PARAMS = new Set([
  'si',
  'igshid',
  'igsh',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref_src',
  'ref_url',
  'feature',
]);

export function cleanUrlTracking(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^spotify:/i.test(trimmed)) return trimmed;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    u.hostname = u.hostname.toLowerCase();
    for (const key of Array.from(u.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

function normalizeHost(rawHost: string): string {
  return rawHost
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '')
    .replace(/^mobile\./, '')
    .replace(/^open\./, '')
    .replace(/^music\./, '');
}

function makeResult(
  provider: ProviderId,
  subtype: string,
  canonicalUrl: string,
  identifier: string,
  extra?: Partial<DetectedProviderUrl>
): DetectedProviderUrl {
  const def = getProviderDefinition(provider);
  const kindDef = getProviderKindDefinition(provider, subtype);
  return {
    provider,
    subtype,
    label: kindDef.label,
    contentKind: kindDef.contentKind,
    canonicalUrl,
    identifier,
    embedSrc: null,
    defaultDisplayAs: kindDef.capabilities.player ? def.defaultDisplayMode : 'card',
    ...extra,
  };
}

function detectHandleForProvider(
  trimmed: string,
  preferredProvider: ProviderId | string | null | undefined
): DetectedProviderUrl | null {
  if (!preferredProvider || preferredProvider === 'generic') return null;
  if (!trimmed || /\s/.test(trimmed) || /^https?:/i.test(trimmed)) return null;

  // Bluesky accepts DIDs, custom domains (alice.com), @handle, or bare handle
  if (preferredProvider === 'bluesky') {
    if (/^did:(plc|web):[a-zA-Z0-9._-]+$/i.test(trimmed)) {
      return makeResult('bluesky', 'profile', `https://bsky.app/profile/${trimmed}`, trimmed);
    }
    if (!trimmed.includes('/') && !trimmed.includes(':')) {
      const clean = trimmed.replace(/^@+/, '').trim().toLowerCase();
      if (!clean || !/^[a-z0-9._-]+$/i.test(clean)) return null;
      const fullHandle = clean.includes('.') ? clean : `${clean}.bsky.social`;
      return makeResult('bluesky', 'profile', `https://bsky.app/profile/${fullHandle}`, fullHandle);
    }
    return null;
  }

  // If input already contains a slash or dot or scheme, let standard URL/domain parsing handle it
  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes(':')) {
    return null;
  }

  const handle = trimmed.replace(/^@+/, '').trim();
  if (!handle || !/^[A-Za-z0-9._-]{1,64}$/.test(handle)) return null;

  switch (preferredProvider) {
    case 'youtube':
      if (/^UC[a-zA-Z0-9_-]{20,26}$/.test(handle)) {
        return makeResult('youtube', 'channel', `https://www.youtube.com/channel/${handle}`, handle);
      }
      return makeResult('youtube', 'channel', `https://www.youtube.com/@${handle}`, `@${handle}`);
    case 'instagram':
      return makeResult('instagram', 'profile', `https://www.instagram.com/${handle}/`, handle);
    case 'x':
      return makeResult('x', 'profile', `https://x.com/${handle}`, handle);
    case 'threads':
      return makeResult('threads', 'profile', `https://www.threads.net/@${handle}`, handle);
    case 'github':
      return makeResult('github', 'profile', `https://github.com/${handle}`, handle);
    case 'linkedin':
      return makeResult('linkedin', 'profile', `https://www.linkedin.com/in/${handle}`, handle);
    case 'facebook':
      return makeResult('facebook', 'profile', `https://www.facebook.com/${handle}`, handle);
    case 'pinterest':
      return makeResult('pinterest', 'profile', `https://www.pinterest.com/${handle}/`, handle);
    case 'linktree':
      return makeResult('linktree', 'profile', `https://linktr.ee/${handle}`, handle);
    case 'twitch':
      return makeResult('twitch', 'profile', `https://www.twitch.tv/${handle.toLowerCase()}`, handle.toLowerCase(), {
        embedSrc: `https://player.twitch.tv/?channel=${encodeURIComponent(handle.toLowerCase())}&autoplay=false`,
        aspect: '16/9',
        defaultDisplayAs: 'card',
      });
    case 'snapchat':
      return makeResult('snapchat', 'profile', `https://www.snapchat.com/add/${handle}`, handle);
    case 'coffee':
      return makeResult('coffee', 'profile', `https://www.buymeacoffee.com/${handle}`, handle);
    case 'discord':
      if (/^\d{15,22}$/.test(handle)) {
        return makeResult('discord', 'user', `https://discord.com/users/${handle}`, handle);
      }
      return makeResult('discord', 'invite', `https://discord.gg/${handle}`, handle);
    default:
      return null;
  }
}

/**
 * Pure URL detector mapping any pasted URL (including www., m., mobile., short links,
 * spotify: URIs, intl-* paths, bare domains, and optional provider handles) into a typed
 * provider + subtype + clean canonicalUrl.
 */
export function detectProviderUrl(
  rawUrl: string,
  preferredProvider?: ProviderId | string | null
): DetectedProviderUrl | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  // Reject dangerous schemes
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;

  // 1. Spotify URIs (spotify:track:..., spotify:playlist:...)
  const spotifyUriMatch = trimmed.match(
    /^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)/i
  );
  if (spotifyUriMatch) {
    const subtype = spotifyUriMatch[1].toLowerCase();
    const id = spotifyUriMatch[2];
    const canonicalUrl = `https://open.spotify.com/${subtype}/${id}`;
    return makeResult('spotify', subtype, canonicalUrl, id, {
      embedSrc: `https://open.spotify.com/embed/${subtype}/${id}?utm_source=generator`,
      height: subtype === 'track' || subtype === 'episode' ? 152 : 352,
    });
  }

  // 1b. Optional @username / bare username support when scoped to a provider
  const handleMatch = detectHandleForProvider(trimmed, preferredProvider);
  if (handleMatch) return handleMatch;

  // Reject explicit non-http(s) schemes (e.g. mailto:, tel:, ftp:) before cleanUrlTracking prepends https://
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return null;
  }

  // Require at least a domain dot or protocol
  const cleaned = cleanUrlTracking(trimmed);
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname.includes('.')) return null;

  const rawHost = url.hostname.toLowerCase();
  const host = normalizeHost(rawHost);
  const parts = url.pathname.split('/').filter(Boolean);

  // 2. YouTube (youtube.com, youtu.be, m.youtube.com, music.youtube.com, youtube-nocookie.com)
  if (host === 'youtu.be') {
    const id = (parts[0] || '').trim();
    if (!id) return null;
    return makeResult('youtube', 'video', `https://www.youtube.com/watch?v=${id}`, id, {
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      aspect: '16/9',
      isShortLink: true,
    });
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const listParam = url.searchParams.get('list');
    const vParam = url.searchParams.get('v');
    if (parts[0] === 'playlist' && listParam) {
      return makeResult('youtube', 'playlist', `https://www.youtube.com/playlist?list=${listParam}`, listParam, {
        embedSrc: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listParam)}`,
        aspect: '16/9',
      });
    }
    if (url.pathname === '/watch' && vParam) {
      return makeResult('youtube', 'video', `https://www.youtube.com/watch?v=${vParam}`, vParam, {
        embedSrc: `https://www.youtube-nocookie.com/embed/${vParam}?rel=0&modestbranding=1`,
        aspect: '16/9',
      });
    }
    if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') && parts[1]) {
      const id = parts[1];
      return makeResult('youtube', 'video', `https://www.youtube.com/watch?v=${id}`, id, {
        embedSrc: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        aspect: '16/9',
      });
    }
    if (parts[0]?.startsWith('@')) {
      const handle = parts[0];
      return makeResult('youtube', 'channel', `https://www.youtube.com/${handle}`, handle);
    }
    if ((parts[0] === 'channel' || parts[0] === 'c' || parts[0] === 'user') && parts[1]) {
      return makeResult('youtube', 'channel', `https://www.youtube.com/${parts[0]}/${parts[1]}`, parts[1]);
    }
    return makeResult('youtube', 'channel', url.toString(), parts[0] || 'youtube');
  }

  // 3. Spotify (open.spotify.com including /intl-xx/, spotify.link)
  if (rawHost === 'spotify.link' || rawHost === 'spotify.app.link') {
    return makeResult('spotify', 'track', url.toString(), parts[0] || 'spotify.link', {
      isShortLink: true,
    });
  }
  if (host === 'spotify.com') {
    const cleanParts = parts[0]?.toLowerCase().startsWith('intl-') ? parts.slice(1) : parts;
    const type = (cleanParts[0] || '').toLowerCase();
    const id = (cleanParts[1] || '').split('?')[0];
    if (['track', 'album', 'playlist', 'artist', 'show', 'episode'].includes(type) && id) {
      return makeResult('spotify', type, `https://open.spotify.com/${type}/${id}`, id, {
        embedSrc: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
        height: type === 'track' || type === 'episode' ? 152 : 352,
      });
    }
    return makeResult('spotify', 'track', url.toString(), id || 'spotify');
  }

  // 4. SoundCloud
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') {
    const canonical = url.toString().split('#')[0];
    return makeResult('soundcloud', 'track', canonical, parts.join('/'), {
      embedSrc: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
      height: 166,
      isShortLink: host === 'on.soundcloud.com',
    });
  }

  // 5. Discord
  if (host === 'discord.gg') {
    const code = (parts[0] || '').trim();
    if (!code) return null;
    return makeResult('discord', 'invite', `https://discord.gg/${code}`, code);
  }
  if (host === 'discord.com' || host === 'discordapp.com') {
    if (parts[0] === 'invite' && parts[1]) {
      return makeResult('discord', 'invite', `https://discord.gg/${parts[1]}`, parts[1]);
    }
    if (parts[0] === 'users' && parts[1]) {
      return makeResult('discord', 'user', `https://discord.com/users/${parts[1]}`, parts[1]);
    }
    return makeResult('discord', 'invite', url.toString(), parts[0] || 'discord');
  }

  // 6. GitHub
  if (host === 'github.com') {
    const blocked = new Set(['features', 'explore', 'marketplace', 'pricing', 'topics', 'login', 'signup', 'settings']);
    if (!parts[0] || blocked.has(parts[0].toLowerCase())) return null;
    if (parts.length >= 2) {
      const id = `${parts[0]}/${parts[1]}`;
      return makeResult('github', 'repo', `https://github.com/${id}`, id);
    }
    return makeResult('github', 'profile', `https://github.com/${parts[0]}`, parts[0]);
  }

  // 7. LinkedIn
  if (rawHost === 'lnkd.in') {
    return makeResult('linkedin', 'profile', url.toString(), parts[0] || 'linkedin', { isShortLink: true });
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    if ((parts[0] === 'company' || parts[0] === 'school') && parts[1]) {
      return makeResult('linkedin', 'company', `https://www.linkedin.com/${parts[0]}/${parts[1]}`, parts[1]);
    }
    if (parts[0] === 'in' && parts[1]) {
      return makeResult('linkedin', 'profile', `https://www.linkedin.com/in/${parts[1]}`, parts[1]);
    }
    return makeResult('linkedin', 'profile', `https://www.linkedin.com/${parts.join('/')}`, parts[0] || 'linkedin');
  }

  // 8. X / Twitter
  if (host === 'x.com' || host === 'twitter.com') {
    if (parts.length >= 3 && parts[1] === 'status' && /^\d+$/.test(parts[2])) {
      const id = `${parts[0]}/status/${parts[2]}`;
      return makeResult('x', 'post', `https://x.com/${id}`, id);
    }
    const handle = (parts[0] || '').replace(/^@+/, '');
    const reserved = new Set(['home', 'explore', 'search', 'messages', 'notifications', 'settings', 'i', 'login', 'signup']);
    if (!handle || reserved.has(handle.toLowerCase())) return null;
    return makeResult('x', 'profile', `https://x.com/${handle}`, handle);
  }

  // 9. Instagram
  if (host === 'instagram.com' || host === 'instagr.am') {
    if ((parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'reels' || parts[0] === 'tv') && parts[1]) {
      const isReel = parts[0] === 'reel' || parts[0] === 'reels';
      const pathType = isReel ? 'reel' : 'p';
      const canonical = `https://www.instagram.com/${pathType}/${parts[1]}/`;
      return makeResult('instagram', isReel ? 'reel' : 'post', canonical, parts[1], {
        embedSrc: `https://www.instagram.com/${pathType}/${parts[1]}/embed/`,
        height: 480,
      });
    }
    const reserved = new Set(['accounts', 'explore', 'direct', 'stories', 'about', 'developer']);
    if (!parts[0] || reserved.has(parts[0].toLowerCase())) return null;
    const handle = parts[0].replace(/^@+/, '');
    return makeResult('instagram', 'profile', `https://www.instagram.com/${handle}/`, handle);
  }

  // 10. Facebook
  if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.watch') {
    if (parts[0] === 'groups' && parts[1]) {
      return makeResult('facebook', 'group', `https://www.facebook.com/groups/${parts[1]}`, parts[1]);
    }
    const isPost =
      url.pathname.includes('/posts/') ||
      url.pathname.includes('/videos/') ||
      url.pathname.includes('/reel/') ||
      host === 'fb.watch';
    if (isPost) {
      return makeResult('facebook', 'post', url.toString(), parts.join('/'), {
        embedSrc: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url.toString())}&show_text=true&width=500`,
        height: 460,
      });
    }
    if (url.pathname === '/profile.php' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id')!;
      return makeResult('facebook', 'profile', `https://www.facebook.com/profile.php?id=${encodeURIComponent(id)}`, id);
    }
    if (parts[0]) {
      return makeResult('facebook', 'profile', `https://www.facebook.com/${parts[0]}`, parts[0]);
    }
  }

  // 11. Threads
  if (host === 'threads.net' || host === 'threads.com') {
    if (parts[0] && (parts[1] === 'post' || parts[1] === 't') && parts[2]) {
      const cleanHandle = parts[0].replace(/^@+/, '');
      const canonical = `https://www.threads.net/@${cleanHandle}/post/${parts[2]}`;
      return makeResult('threads', 'post', canonical, `${cleanHandle}/${parts[2]}`, {
        embedSrc: `${canonical}/embed`,
        height: 420,
      });
    }
    if (parts[0] === 't' && parts[1]) {
      const canonical = `https://www.threads.net/t/${parts[1]}`;
      return makeResult('threads', 'post', canonical, parts[1], {
        embedSrc: `${canonical}/embed`,
        height: 420,
      });
    }
    if (parts[0]) {
      const cleanHandle = parts[0].replace(/^@+/, '');
      return makeResult('threads', 'profile', `https://www.threads.net/@${cleanHandle}`, cleanHandle);
    }
  }

  // 12. Linktree
  if (host === 'linktr.ee' || host === 'linktree.com') {
    const slug = (parts[0] || '').replace(/^@+/, '');
    if (!slug) return null;
    return makeResult('linktree', 'profile', `https://linktr.ee/${slug}`, slug);
  }

  // 13. Pinterest
  if (rawHost === 'pin.it') {
    const code = (parts[0] || '').trim();
    if (!code) return null;
    return makeResult('pinterest', 'pin', `https://pin.it/${code}`, code, {
      isShortLink: true,
    });
  }
  if (host === 'pinterest.com' || /(?:^|\.)pinterest\./.test(host)) {
    if (parts[0] === 'pin' && parts[1]) {
      const pinId = parts[1].replace(/[^\w-]/g, '');
      if (!pinId) return null;
      return makeResult('pinterest', 'pin', `https://www.pinterest.com/pin/${pinId}/`, pinId);
    }
    const reserved = new Set(['ideas', 'today', 'explore', 'search', 'settings', 'business', 'login', '_']);
    if (parts[0] && !reserved.has(parts[0].toLowerCase())) {
      const uname = parts[0].replace(/^@+/, '');
      if (parts[1] && !parts[1].startsWith('_')) {
        return makeResult(
          'pinterest',
          'board',
          `https://www.pinterest.com/${uname}/${parts[1]}/`,
          `${uname}/${parts[1]}`
        );
      }
      return makeResult('pinterest', 'profile', `https://www.pinterest.com/${uname}/`, uname);
    }
  }

  // 14. Bluesky (AK-1 proof-of-architecture provider)
  if (host === 'bsky.app') {
    if (parts[0] === 'profile' && parts[1]) {
      return makeResult('bluesky', 'profile', `https://bsky.app/profile/${parts[1]}`, parts[1]);
    }
  }

  // 15. Twitch (channels, VODs/videos, clips)
  if (rawHost === 'clips.twitch.tv') {
    const slug = parts[0] === 'embed' ? url.searchParams.get('clip') || '' : parts[0] || '';
    if (!slug || !/^[A-Za-z0-9_-]+$/.test(slug)) return null;
    return makeResult('twitch', 'clip', `https://clips.twitch.tv/${slug}`, slug, {
      embedSrc: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&autoplay=false`,
      aspect: '16/9',
      defaultDisplayAs: 'player',
    });
  }
  if (host === 'twitch.tv') {
    if (parts[0] === 'videos' && parts[1] && /^\d+$/.test(parts[1])) {
      const videoId = parts[1];
      return makeResult('twitch', 'video', `https://www.twitch.tv/videos/${videoId}`, videoId, {
        embedSrc: `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&autoplay=false`,
        aspect: '16/9',
        defaultDisplayAs: 'player',
      });
    }
    if (parts[0] && parts[1] === 'clip' && parts[2] && /^[A-Za-z0-9_-]+$/.test(parts[2])) {
      const channel = parts[0].toLowerCase();
      const slug = parts[2];
      return makeResult('twitch', 'clip', `https://www.twitch.tv/${channel}/clip/${slug}`, slug, {
        embedSrc: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&autoplay=false`,
        aspect: '16/9',
        defaultDisplayAs: 'player',
      });
    }
    const reserved = new Set([
      'directory',
      'downloads',
      'jobs',
      'p',
      'settings',
      'subscriptions',
      'inventory',
      'wallet',
      'turbo',
      'videos',
      'search',
      'login',
      'signup',
      'friends',
      'messages',
      'store',
      'moderator',
      'popout',
    ]);
    const channelRaw = (parts[0] || '').replace(/^@+/, '').toLowerCase();
    if (!channelRaw || reserved.has(channelRaw) || !/^[a-z0-9_]{2,32}$/.test(channelRaw)) {
      return null;
    }
    return makeResult('twitch', 'profile', `https://www.twitch.tv/${channelRaw}`, channelRaw, {
      embedSrc: `https://player.twitch.tv/?channel=${encodeURIComponent(channelRaw)}&autoplay=false`,
      aspect: '16/9',
      defaultDisplayAs: 'card',
    });
  }

  // 16. Snapchat (profiles, spotlights, stories, t.snapchat.com shortlinks)
  if (rawHost === 't.snapchat.com') {
    const code = (parts[0] || '').trim();
    if (!code) return null;
    return makeResult('snapchat', 'profile', `https://t.snapchat.com/${code}`, code, {
      isShortLink: true,
    });
  }
  if (rawHost === 'story.snapchat.com') {
    const slug = parts[0] === 's' && parts[1] ? parts[1] : parts[0] || '';
    if (!slug) return null;
    return makeResult('snapchat', 'story', `https://story.snapchat.com/s/${slug}`, slug);
  }
  if (host === 'snapchat.com') {
    if (parts[0] === 'add' && parts[1]) {
      const username = parts[1].replace(/^@+/, '');
      if (!/^[A-Za-z0-9._-]{2,64}$/.test(username)) return null;
      return makeResult('snapchat', 'profile', `https://www.snapchat.com/add/${username}`, username);
    }
    if (parts[0] === 'spotlight' && parts[1]) {
      const id = parts[1];
      return makeResult('snapchat', 'spotlight', `https://www.snapchat.com/spotlight/${id}`, id);
    }
    if (parts[0] === 'p' && parts[1]) {
      const idPath = parts.slice(1, 3).join('/');
      return makeResult('snapchat', 'spotlight', `https://www.snapchat.com/p/${idPath}`, idPath);
    }
    if ((parts[0] === 's' || parts[0] === 'stories') && parts[1]) {
      return makeResult('snapchat', 'story', `https://www.snapchat.com/${parts[0]}/${parts[1]}`, parts[1]);
    }
    const reserved = new Set([
      'add',
      'p',
      's',
      'spotlight',
      'lens',
      'explore',
      'discover',
      'scan',
      'download',
      'privacy',
      'terms',
      'support',
      'creators',
      'business',
      'safety',
      'stories',
    ]);
    const rawUser = (parts[0] || '').replace(/^@+/, '');
    if (rawUser && !reserved.has(rawUser.toLowerCase()) && /^[A-Za-z0-9._-]{2,64}$/.test(rawUser)) {
      return makeResult('snapchat', 'profile', `https://www.snapchat.com/add/${rawUser}`, rawUser);
    }
    return null;
  }

  // 17. Buy Me a Coffee
  if (host === 'buymeacoffee.com' || host === 'coff.ee') {
    const reserved = new Set(['explore', 'about', 'faq', 'login', 'signup', 'privacy', 'terms']);
    const slug = (parts[0] || '').replace(/^@+/, '');
    if (slug && !reserved.has(slug.toLowerCase()) && /^[A-Za-z0-9._-]{2,64}$/.test(slug)) {
      return makeResult('coffee', 'profile', `https://www.buymeacoffee.com/${slug}`, slug);
    }
    return null;
  }

  // Fallback: any valid web URL becomes Generic link
  return makeResult('generic', 'link', url.toString(), rawHost.replace(/^www\./, ''));
}

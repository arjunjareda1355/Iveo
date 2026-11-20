export type FallbackLinkIconKind =
  | 'mail'
  | 'phone'
  | 'code'
  | 'video'
  | 'music'
  | 'shop'
  | 'social'
  | 'globe'
  | 'link';

export function extractDomainForFavicon(rawUrl: string | null | undefined): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  // Reject non-web schemes cleanly
  if (/^(mailto:|tel:|sms:|upi:|javascript:|data:|about:)/i.test(trimmed)) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
    if (!host || host === 'localhost' || !host.includes('.')) {
      return null;
    }
    // Skip raw IPv4 addresses
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function getFaviconUrl(rawUrl: string | null | undefined, size = 64): string | null {
  const domain = extractDomainForFavicon(rawUrl);
  if (!domain) return null;
  const clampedSize = Math.min(128, Math.max(16, Math.round(size)));
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${clampedSize}`;
}

export function inferLinkIconKind(rawUrl: string | null | undefined): FallbackLinkIconKind {
  const trimmed = (rawUrl || '').trim().toLowerCase();
  if (!trimmed) return 'link';
  if (trimmed.startsWith('mailto:')) return 'mail';
  if (trimmed.startsWith('tel:') || trimmed.startsWith('sms:') || trimmed.includes('wa.me/')) {
    return 'phone';
  }

  const domain = extractDomainForFavicon(rawUrl);
  if (!domain) return 'link';

  if (
    domain === 'github.com' ||
    domain.endsWith('.github.com') ||
    domain === 'gitlab.com' ||
    domain === 'codepen.io' ||
    domain === 'npmjs.com'
  ) {
    return 'code';
  }

  if (
    domain === 'youtube.com' ||
    domain === 'youtu.be' ||
    domain === 'vimeo.com' ||
    domain === 'twitch.tv'
  ) {
    return 'video';
  }

  if (
    domain === 'open.spotify.com' ||
    domain === 'spotify.com' ||
    domain === 'soundcloud.com' ||
    domain === 'music.apple.com' ||
    domain === 'bandcamp.com'
  ) {
    return 'music';
  }

  if (
    domain === 'gumroad.com' ||
    domain.endsWith('.gumroad.com') ||
    domain === 'shopify.com' ||
    domain.endsWith('.myshopify.com') ||
    domain === 'etsy.com' ||
    domain === 'amazon.com' ||
    domain === 'stan.store'
  ) {
    return 'shop';
  }

  return 'globe';
}

export interface DetectedPlatformInfo {
  id: string;
  name: string;
  handle: string | null;
}

export function detectPlatformFromUrl(
  rawUrl: string | null | undefined
): DetectedPlatformInfo | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    return { id: 'mail', name: 'Email', handle: trimmed.slice(7) || null };
  }
  if (trimmed.toLowerCase().startsWith('tel:') || trimmed.toLowerCase().startsWith('sms:')) {
    return { id: 'whatsapp', name: 'Phone', handle: trimmed.replace(/^(tel:|sms:)/i, '') || null };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const segs = parsed.pathname.split('/').filter(Boolean);
  const firstSeg = segs[0] ? decodeURIComponent(segs[0]) : null;

  const extractHandle = (): string | null => {
    if (!firstSeg) return null;
    if (host === 'linkedin.com' && (firstSeg === 'in' || firstSeg === 'company') && segs[1]) {
      return decodeURIComponent(segs[1]);
    }
    return firstSeg;
  };

  if (host === 'github.com' || host.endsWith('.github.com')) {
    return { id: 'github', name: 'GitHub', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'linkedin.com' || host === 'lnkd.in') {
    const h = extractHandle();
    return { id: 'linkedin', name: 'LinkedIn', handle: h ? `@${h.replace(/^@/, '')}` : null };
  }
  if (host === 'x.com' || host === 'twitter.com') {
    return { id: 'x', name: 'X', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'instagram.com' || host === 'instagr.am') {
    return { id: 'instagram', name: 'Instagram', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    return { id: 'youtube', name: 'YouTube', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'open.spotify.com' || host === 'spotify.com') {
    return { id: 'spotify', name: 'Spotify', handle: null };
  }
  if (host === 'soundcloud.com') {
    return { id: 'music', name: 'SoundCloud', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'discord.gg' || host === 'discord.com' || host === 'discordapp.com') {
    return { id: 'discord', name: 'Discord', handle: null };
  }
  if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
    return { id: 'tiktok', name: 'TikTok', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'threads.net' || host === 'threads.com') {
    return { id: 'threads', name: 'Threads', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.me') {
    return { id: 'facebook', name: 'Facebook', handle: firstSeg || null };
  }
  if (host === 'pin.it' || host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
    return { id: 'pinterest', name: 'Pinterest', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'twitch.tv') {
    return { id: 'twitch', name: 'Twitch', handle: firstSeg || null };
  }
  if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') {
    return { id: 'telegram', name: 'Telegram', handle: firstSeg ? `@${firstSeg.replace(/^@/, '')}` : null };
  }
  if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'whatsapp.com') {
    return { id: 'whatsapp', name: 'WhatsApp', handle: null };
  }
  if (host === 'patreon.com') {
    return { id: 'patreon', name: 'Patreon', handle: firstSeg || null };
  }
  if (host === 'substack.com' || host.endsWith('.substack.com')) {
    return { id: 'substack', name: 'Substack', handle: null };
  }

  return null;
}

/**
 * Normalizes a URL for duplicate comparison across links and social icons.
 * Ignores protocol, www./m. prefix, trailing slashes, and case.
 */
export function normalizeComparableDestination(rawUrl: string | null | undefined): string {
  const trimmed = (rawUrl || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('mailto:')) {
    return trimmed;
  }
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'twitter.com') host = 'x.com';
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}


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

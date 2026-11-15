/**
 * Sanitizes and ensures external URLs have a protocol (defaults to https://).
 * Prevents relative routing bugs where example.com opens as /username/example.com.
 */
export function formatExternalUrl(raw: string | null | undefined): string {
  if (!raw) return '#';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'javascript:void(0)') {
    return '#';
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isSafeHref(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return false;
  }
  return /^(https?:\/\/|mailto:|tel:)/i.test(trimmed);
}

export function normalizeYouTubeUrl(raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';
  if (/^UC[a-zA-Z0-9_-]{20,26}$/.test(clean)) {
    return `https://www.youtube.com/channel/${clean}`;
  }
  if (/^https?:\/\//i.test(clean)) return clean;
  if (/^(youtube\.com|www\.youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)\b/i.test(clean)) {
    return `https://${clean}`;
  }
  const handle = clean.split(/[/?#]/)[0].replace(/^@/, '');
  if (!clean.includes('/') && !clean.includes('.')) {
    return `https://www.youtube.com/@${handle}`;
  }
  return clean.startsWith('@')
    ? `https://www.youtube.com/${clean}`
    : `https://${clean}`;
}

const SOCIAL_BASE_URLS: Record<string, string> = {
  instagram: 'https://instagram.com/',
  youtube: 'https://youtube.com/@',
  twitter: 'https://x.com/',
  x: 'https://x.com/',
  tiktok: 'https://tiktok.com/@',
  threads: 'https://threads.net/@',
  github: 'https://github.com/',
  linkedin: 'https://linkedin.com/in/',
  twitch: 'https://twitch.tv/',
  telegram: 'https://t.me/',
  patreon: 'https://patreon.com/',
  substack: 'https://substack.com/@',
};

export function normalizeSocialUrl(platform: string, raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';

  if (platform === 'mail' || platform === 'email') {
    if (!clean.startsWith('mailto:') && clean.includes('@')) {
      return `mailto:${clean}`;
    }
    return clean;
  }

  if (/^https?:\/\//i.test(clean)) return clean;

  if (platform === 'whatsapp') {
    const digits = clean.replace(/[^\d]/g, '');
    if (digits && !clean.includes('.')) {
      return `https://wa.me/${digits}`;
    }
  }

  const base = SOCIAL_BASE_URLS[platform];
  if (base) {
    const isHandle = clean.startsWith('@') || (!clean.includes('.') && !clean.includes('/'));
    if (isHandle) {
      return `${base}${clean.replace(/^@/, '')}`;
    }
  }

  return formatExternalUrl(clean);
}

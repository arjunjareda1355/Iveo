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

const SOCIAL_ALLOWED_DOMAINS: Record<string, string[]> = {
  instagram: ['instagram.com', 'instagr.am'],
  youtube: ['youtube.com', 'youtu.be'],
  twitter: ['x.com', 'twitter.com'],
  x: ['x.com', 'twitter.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
  threads: ['threads.net', 'threads.com'],
  github: ['github.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  twitch: ['twitch.tv'],
  telegram: ['t.me', 'telegram.me', 'telegram.org'],
  discord: ['discord.gg', 'discord.com', 'discordapp.com'],
  spotify: ['open.spotify.com', 'spotify.com'],
  patreon: ['patreon.com'],
  substack: ['substack.com'],
  whatsapp: ['wa.me', 'api.whatsapp.com', 'whatsapp.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  snapchat: ['snapchat.com', 't.snapchat.com'],
  pinterest: ['pinterest.com', 'pin.it'],
};

function matchesAllowedDomain(hostname: string, allowed: string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

export function validateAndFormatSocialInput(
  platform: string,
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  const clean = (raw || '').trim();
  if (!clean) {
    return { ok: true, url: '' };
  }

  if (/^(javascript|data|vbscript):/i.test(clean)) {
    return { ok: false, error: 'Unsupported link scheme.' };
  }

  if (platform === 'mail' || platform === 'email') {
    const emailRaw = clean.replace(/^mailto:/i, '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return { ok: false, error: 'Enter a valid email address (e.g. you@example.com).' };
    }
    return { ok: true, url: `mailto:${emailRaw}` };
  }

  if (platform === 'whatsapp') {
    if (!clean.includes('.') && !clean.startsWith('http')) {
      const digits = clean.replace(/[^\d]/g, '');
      if (digits.length < 6) {
        return { ok: false, error: 'Enter a valid WhatsApp phone number or wa.me link.' };
      }
      return { ok: true, url: `https://wa.me/${digits}` };
    }
  }

  const allowed = SOCIAL_ALLOWED_DOMAINS[platform];
  const looksLikeUrlOrDomain =
    !clean.startsWith('@') && (/^https?:\/\//i.test(clean) || clean.includes('.'));

  if (looksLikeUrlOrDomain) {
    const normalizedCandidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    let parsed: URL;
    try {
      parsed = new URL(normalizedCandidate);
    } catch {
      return { ok: false, error: 'Enter a valid URL or @handle.' };
    }
    if (allowed && !matchesAllowedDomain(parsed.hostname, allowed)) {
      const expected = allowed[0];
      return {
        ok: false,
        error: `This looks like ${parsed.hostname}, not ${expected}. Use a ${expected} link or @handle.`,
      };
    }
    return { ok: true, url: normalizedCandidate };
  }

  const base = SOCIAL_BASE_URLS[platform];
  if (base) {
    const handle = clean.replace(/^@+/, '').trim();
    if (!handle || /\s/.test(handle)) {
      return { ok: false, error: 'Handle cannot contain spaces.' };
    }
    return { ok: true, url: `${base}${handle}` };
  }

  return { ok: true, url: formatExternalUrl(clean) };
}

export function normalizeSocialUrl(platform: string, raw: string): string {
  const res = validateAndFormatSocialInput(platform, raw);
  if (res.ok) return res.url;
  const clean = (raw || '').trim();
  return clean ? formatExternalUrl(clean) : '';
}

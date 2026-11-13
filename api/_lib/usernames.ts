// Keep in sync with src/lib/username-rules.ts and the database.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Subdomain RFC-compatible pattern: 3-30 chars, letters, digits, and hyphens.
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/;

export const RESERVED = new Set([
  'admin',
  'administrator',
  'analytics',
  'api',
  'app',
  'about',
  'account',
  'accounts',
  'auth',
  'billing',
  'blog',
  'checkout',
  'clerk',
  'contact',
  'dashboard',
  'demo',
  'dev',
  'developer',
  'discover',
  'docs',
  'explore',
  'healthz',
  '_health',
  'help',
  'home',
  'iveo',
  'ivio',
  'legal',
  'login',
  'logout',
  'mail',
  'onboarding',
  'pay',
  'pricing',
  'privacy',
  'robots',
  'robots.txt',
  'root',
  'seo',
  'settings',
  'signin',
  'signout',
  'signup',
  'sitemap',
  'sitemap.xml',
  'sso-callback',
  'ssocallback',
  'staging',
  'status',
  'supabase',
  'support',
  'terms',
  'test',
  'user',
  'users',
  'vercel',
  'verify',
  'webhook',
  'webhooks',
  'www',
  'null',
  'undefined',
]);

export const PRIVATE_ROUTES = ['login', 'signup', 'dashboard', 'onboarding', 'account', 'admin'];
export const PUBLIC_INFO_ROUTES = ['privacy', 'terms', 'pricing', 'legal', 'discover'];

export const OWNER_EMAILS_LIST = [
  'help@iveo.site',
  'arjunjareda2007@gmail.com',
  'arjunjareda1355@gmail.com',
  'arjunjared1355@gmail.com',
  'help@fanq.me',
];

export function isPrivilegedEmailServer(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  if (/^[^@\s]+@iveo\.site$/i.test(clean)) return true;
  return OWNER_EMAILS_LIST.includes(clean);
}

export function validateUsernameServer(
  input: string,
  options?: { allowReserved?: boolean }
): { ok: boolean; reason?: string; message?: string } {
  const clean = (input || '').trim().toLowerCase();
  if (clean.length < USERNAME_MIN) {
    return { ok: false, reason: 'too_short', message: 'Use 3 to 30 characters.' };
  }
  if (clean.length > USERNAME_MAX) {
    return { ok: false, reason: 'too_long', message: 'Maximum 30 characters allowed.' };
  }
  if (clean.includes('_') || clean.includes(' ')) {
    return { ok: false, reason: 'invalid_format', message: 'Use hyphens instead of underscores or spaces.' };
  }
  if (clean.startsWith('-') || clean.endsWith('-')) {
    return { ok: false, reason: 'invalid_format', message: 'Must start and end with a letter or number.' };
  }
  if (clean.includes('--')) {
    return { ok: false, reason: 'invalid_format', message: 'Cannot contain consecutive hyphens (--).' };
  }
  if (!/^[a-z0-9-]+$/.test(clean)) {
    return { ok: false, reason: 'invalid_format', message: 'Only lowercase letters, numbers, and hyphens allowed.' };
  }
  if (PRIVATE_ROUTES.includes(clean)) {
    return { ok: false, reason: 'reserved', message: 'That system route cannot be claimed.' };
  }
  if (!options?.allowReserved && (RESERVED.has(clean) || RESERVED.has(clean.replace(/-/g, '')))) {
    return { ok: false, reason: 'reserved', message: 'That name is reserved. Choose another.' };
  }
  return { ok: true };
}

export function normalizeUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return lower.slice(0, USERNAME_MAX);
}

export type SegmentKind = 'private' | 'info' | 'reserved' | 'username' | 'invalid';

export function classifySegment(segment: string): SegmentKind {
  const clean = (segment || '').trim().toLowerCase();
  if (!clean) return 'invalid';

  if (PRIVATE_ROUTES.includes(clean)) {
    return 'private';
  }
  if (PUBLIC_INFO_ROUTES.includes(clean)) {
    return 'info';
  }
  if (RESERVED.has(clean)) {
    return 'reserved';
  }
  if (USERNAME_PATTERN.test(clean) || /^[a-z0-9_-]{3,30}$/.test(clean)) {
    return 'username';
  }
  return 'invalid';
}

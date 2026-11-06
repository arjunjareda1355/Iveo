// Keep in sync with src/lib/username-rules.ts and the database.

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const RESERVED = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'about',
  'account',
  'accounts',
  'auth',
  'billing',
  'blog',
  'clerk',
  'contact',
  'dashboard',
  'help',
  'home',
  'iveo',
  'ivio',
  'legal',
  'login',
  'logout',
  'mail',
  'onboarding',
  'pricing',
  'privacy',
  'root',
  'settings',
  'signin',
  'signout',
  'signup',
  'sso-callback',
  'ssocallback',
  'status',
  'supabase',
  'support',
  'terms',
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

export const PRIVATE_ROUTES = ['login', 'signup', 'dashboard', 'onboarding', 'account'];
export const PUBLIC_INFO_ROUTES = ['privacy', 'terms', 'pricing'];

export function normalizeUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return USERNAME_PATTERN.test(lower) ? lower : null;
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
  if (USERNAME_PATTERN.test(clean)) {
    return 'username';
  }
  return 'invalid';
}

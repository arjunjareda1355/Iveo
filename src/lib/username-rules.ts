export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Subdomain-compatible pattern: 3-30 chars, lowercase letters, numbers, and hyphens.
// Must start and end with an alphanumeric character, no consecutive hyphens.
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/;

// Keep in sync with the router, server and database.
export const RESERVED_USERNAMES: readonly string[] = [
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
  'embed',
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
  'report',
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
] as const;

export const RESERVED_USERNAMES_SET = new Set(
  RESERVED_USERNAMES.map((name) => name.toLowerCase())
);

// Deprecated mock taken names; live server checks determine real claimed handles
export const SIMULATED_TAKEN_USERNAMES_SET = new Set<string>([]);

/**
 * Normalizes username by converting to lowercase, replacing underscores and spaces with hyphens,
 * stripping invalid characters, collapsing consecutive hyphens, and trimming hyphens from ends.
 */
export function normalizeUsername(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, USERNAME_MAX);
}

export type UsernameValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'too_short' | 'too_long' | 'invalid_chars' | 'reserved';
      message?: string;
    };

export const PRIVATE_ROUTES = new Set(['login', 'signup', 'dashboard', 'onboarding', 'account', 'admin']);
export const PUBLIC_INFO_ROUTES = new Set([
  'about',
  'discover',
  'help',
  'legal',
  'privacy',
  'terms',
  'pricing',
  'embed',
  'report',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
]);

export function validateUsername(
  input: string,
  options?: { allowReserved?: boolean }
): UsernameValidationResult {
  const lower = (input || '').toLowerCase().trim().replace(/^@+/, '');

  if (lower.length < USERNAME_MIN) {
    return { ok: false, reason: 'too_short', message: 'Use 3 to 30 characters.' };
  }

  if (lower.length > USERNAME_MAX) {
    return { ok: false, reason: 'too_long', message: 'Maximum 30 characters allowed.' };
  }

  // Must not contain underscores or spaces
  if (lower.includes('_') || lower.includes(' ')) {
    return { ok: false, reason: 'invalid_chars', message: 'Use hyphens instead of underscores or spaces.' };
  }

  // Must start and end with an alphanumeric character
  if (lower.startsWith('-') || lower.endsWith('-')) {
    return { ok: false, reason: 'invalid_chars', message: 'Must start and end with a letter or number.' };
  }

  // No consecutive hyphens
  if (lower.includes('--')) {
    return { ok: false, reason: 'invalid_chars', message: 'Cannot contain consecutive hyphens (--).' };
  }

  // Only lowercase English letters, numbers, and hyphens allowed
  if (!/^[a-z0-9-]+$/.test(lower)) {
    return { ok: false, reason: 'invalid_chars', message: 'Only lowercase letters, numbers, and hyphens allowed.' };
  }

  if (PRIVATE_ROUTES.has(lower)) {
    return { ok: false, reason: 'reserved', message: 'That system route cannot be claimed.' };
  }

  if (
    !options?.allowReserved &&
    (RESERVED_USERNAMES_SET.has(lower) || RESERVED_USERNAMES_SET.has(lower.replace(/-/g, '')))
  ) {
    return { ok: false, reason: 'reserved', message: 'That name is reserved. Choose another.' };
  }

  return { ok: true };
}

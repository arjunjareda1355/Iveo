export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

// Keep in sync with the router.
export const RESERVED_USERNAMES: readonly string[] = [
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
  'contact',
  'dashboard',
  'help',
  'home',
  'iveo',
  'ivio',
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
  'support',
  'terms',
  'user',
  'users',
  'verify',
  'www',
  'null',
  'undefined',
] as const;

export const RESERVED_USERNAMES_SET = new Set(
  RESERVED_USERNAMES.map((name) => name.toLowerCase())
);

// Simulated taken names on client for landing preview only
export const SIMULATED_TAKEN_USERNAMES_SET = new Set([
  'alex',
  'sam',
  'maya',
  'studio',
  'music',
  'art',
  'design',
  'travel',
  'food',
  'news',
]);

/**
 * Normalizes username by converting to lowercase, stripping any character
 * that is not a-z, 0-9 or underscore, and capping at USERNAME_MAX.
 */
export function normalizeUsername(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX);
}

export type UsernameValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'too_short' | 'too_long' | 'invalid_chars' | 'reserved';
    };

export function validateUsername(input: string): UsernameValidationResult {
  const lower = (input || '').toLowerCase();

  if (lower.length < USERNAME_MIN) {
    return { ok: false, reason: 'too_short' };
  }

  if (lower.length > USERNAME_MAX) {
    return { ok: false, reason: 'too_long' };
  }

  // Check invalid characters on raw input (hyphens, periods, spaces, etc.)
  if (!USERNAME_PATTERN.test(lower)) {
    return { ok: false, reason: 'invalid_chars' };
  }

  if (RESERVED_USERNAMES_SET.has(lower) || RESERVED_USERNAMES_SET.has(lower.replace(/-/g, ''))) {
    return { ok: false, reason: 'reserved' };
  }

  return { ok: true };
}

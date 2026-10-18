// Availability is mocked on the client. Replace with a real lookup when Firestore is added.

export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'help',
  'login',
  'signup',
  'privacy',
  'terms',
  'pricing',
  'about',
  'support',
  'settings',
  'dashboard',
  'ivio',
  'www',
  'mail',
  'blog',
  'status',
]);

export const SIMULATED_TAKEN_USERNAMES = new Set([
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
 * Lowercase everything as the user types.
 * Silently strip every character that is not a-z, 0-9 or underscore. Max length 24.
 */
export function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export type UsernameValidationResult =
  | { status: 'empty'; message: string }
  | { status: 'too_short'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'available'; message: string; username: string };

export function validateUsernameSync(raw: string): UsernameValidationResult {
  const sanitized = sanitizeUsername(raw);

  if (sanitized.length === 0) {
    return {
      status: 'empty',
      message: 'Use 3 to 24 letters, numbers or underscores.',
    };
  }

  if (sanitized.length < 3) {
    return {
      status: 'too_short',
      message: 'Use 3 to 24 letters, numbers or underscores.',
    };
  }

  if (RESERVED_USERNAMES.has(sanitized) || SIMULATED_TAKEN_USERNAMES.has(sanitized)) {
    return {
      status: 'unavailable',
      message: "That name isn't available. Try another.",
    };
  }

  return {
    status: 'available',
    message: `ivio.site/${sanitized} is available`,
    username: sanitized,
  };
}

/**
 * Async check with simulated network delay.
 */
export async function checkUsernameAvailability(raw: string, delayMs: number = 350): Promise<UsernameValidationResult> {
  const sanitized = sanitizeUsername(raw);
  if (sanitized.length < 3) {
    return validateUsernameSync(sanitized);
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return validateUsernameSync(sanitized);
}

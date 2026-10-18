// Availability is mocked on the client. Replace with a real lookup when Firestore is added.

import {
  USERNAME_MIN,
  USERNAME_MAX,
  RESERVED_USERNAMES_SET,
  SIMULATED_TAKEN_USERNAMES_SET,
  normalizeUsername,
  validateUsername as validateUsernameRule,
} from './username-rules.ts';

export {
  USERNAME_MIN,
  USERNAME_MAX,
  RESERVED_USERNAMES_SET as RESERVED_USERNAMES,
  SIMULATED_TAKEN_USERNAMES_SET as SIMULATED_TAKEN_USERNAMES,
  normalizeUsername as sanitizeUsername,
};

export type UsernameValidationResult =
  | { status: 'empty'; message: string }
  | { status: 'too_short'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'available'; message: string; username: string };

export function validateUsernameSync(raw: string): UsernameValidationResult {
  const lower = (raw || '').toLowerCase();

  if (lower.length === 0) {
    return {
      status: 'empty',
      message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers or underscores.`,
    };
  }

  const sanitized = normalizeUsername(raw);

  if (sanitized.length < USERNAME_MIN) {
    return {
      status: 'too_short',
      message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers or underscores.`,
    };
  }

  const ruleResult = validateUsernameRule(lower);
  if (
    !ruleResult.ok ||
    SIMULATED_TAKEN_USERNAMES_SET.has(sanitized) ||
    RESERVED_USERNAMES_SET.has(sanitized) ||
    RESERVED_USERNAMES_SET.has(lower)
  ) {
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
export async function checkUsernameAvailability(
  raw: string,
  delayMs: number = 350
): Promise<UsernameValidationResult> {
  const sanitized = normalizeUsername(raw);
  if (sanitized.length < USERNAME_MIN) {
    return validateUsernameSync(raw);
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return validateUsernameSync(raw);
}

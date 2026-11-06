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

  // Check client-side storage for existing users created in this browser session
  if (typeof window !== 'undefined') {
    try {
      const existingProfile =
        localStorage.getItem(`iveo_profile_${sanitized}`) ||
        localStorage.getItem(`ivio_profile_${sanitized}`);
      if (existingProfile) {
        return {
          status: 'unavailable',
          message: 'That name is already taken. Try another.',
        };
      }
    } catch {}
  }

  return {
    status: 'available',
    message: `iveo.site/${sanitized} is available`,
    username: sanitized,
  };
}

/**
 * Real async availability check: validates syntax, checks local existing profiles, and calls /api/check-username
 */
export async function checkUsernameAvailability(
  raw: string
): Promise<UsernameValidationResult> {
  const syncResult = validateUsernameSync(raw);
  if (syncResult.status !== 'available') {
    return syncResult;
  }

  const clean = syncResult.username;

  try {
    const res = await fetch(`/api/check-username?u=${encodeURIComponent(clean)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      if (!data.available) {
        return {
          status: 'unavailable',
          message: data.message || "That name isn't available. Try another.",
        };
      }
    }
  } catch {
    // If network fails, rely on sync check
  }

  return syncResult;
}

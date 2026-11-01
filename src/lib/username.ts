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
  const lower = (raw || '').toLowerCase().trim();

  if (lower.length === 0) {
    return {
      status: 'empty',
      message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers or hyphens.`,
    };
  }

  const sanitized = normalizeUsername(raw);

  if (sanitized.length < USERNAME_MIN) {
    return {
      status: 'too_short',
      message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} letters, numbers or hyphens.`,
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
      message: ruleResult.ok ? "That address isn't available. Try another." : (ruleResult.message || "That address isn't available. Try another."),
    };
  }

  return {
    status: 'available',
    message: `${sanitized}.iveo.site is available`,
    username: sanitized,
  };
}

/**
 * Real async availability check: validates syntax and calls centralized /api/check-username database endpoint
 */
export async function checkUsernameAvailability(
  raw: string,
  requestingUserId?: string
): Promise<UsernameValidationResult> {
  const syncResult = validateUsernameSync(raw);
  if (syncResult.status !== 'available') {
    return syncResult;
  }

  const clean = syncResult.username;
  const userParam = requestingUserId ? `&userId=${encodeURIComponent(requestingUserId)}` : '';

  try {
    const res = await fetch(`/api/check-username?u=${encodeURIComponent(clean)}${userParam}`, {
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
          message: data.message || "That address is already claimed. Try another.",
        };
      }
      return {
        status: 'available',
        message: data.message || `${clean}.iveo.site is available`,
        username: clean,
      };
    }
  } catch {
    // If network fails, rely on sync check
  }

  return syncResult;
}

/**
 * Firestore deep sanitizer and `/firestore.rules` boundary guardrails.
 * Pure functions usable in Node server routes, client sync, and unit tests.
 */

export function sanitizeForFirestore<T>(value: T): T {
  return sanitizeInner(value) as T;
}

function sanitizeInner(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = sanitizeInner(item, seen);
      if (cleaned !== undefined) {
        out.push(cleaned);
      }
    }
    return out;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return null;
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue;
      const cleaned = sanitizeInner(val, seen);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    seen.delete(obj);
    return out;
  }
  return null;
}

export function clampNullableString(val: unknown, maxLen: number): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function clampRequiredString(val: unknown, maxLen: number, fallback: string): string {
  const s = typeof val === 'string' ? val : val == null ? '' : String(val);
  const trimmed = s.length > 0 ? s : fallback;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Normalizes a `/users/{id}` profile payload to satisfy every constraint in `/firestore.rules`.
 */
export function enforceProfileRuleBounds(raw: Record<string, any>, fallbackUsername: string): Record<string, any> {
  const sanitized = (sanitizeForFirestore(raw) || {}) as Record<string, any>;
  const cleanUsername = clampRequiredString(
    String(sanitized.username || fallbackUsername).trim().replace(/^@+/, '').toLowerCase(),
    64,
    fallbackUsername.slice(0, 64)
  );
  const out: Record<string, any> = {
    ...sanitized,
    username: cleanUsername,
    userId: clampNullableString(sanitized.userId, 128) ?? 'owner',
    displayName: clampNullableString(sanitized.displayName, 128) ?? cleanUsername,
    bio: clampNullableString(sanitized.bio, 500) ?? '',
    avatarUrl: clampNullableString(sanitized.avatarUrl, 2048),
    primaryEmail: clampNullableString(sanitized.primaryEmail, 320),
    customSeoTitle: clampNullableString(sanitized.customSeoTitle, 160),
    customSeoDescription: clampNullableString(sanitized.customSeoDescription, 320),
    deletedAt: clampNullableString(sanitized.deletedAt, 64),
    purgeAt: clampNullableString(sanitized.purgeAt, 64),
    updatedAt: clampRequiredString(sanitized.updatedAt, 64, new Date().toISOString()),
  };

  if (typeof sanitized.avatarData === 'string') {
    if (sanitized.avatarData.length <= 350000) {
      out.avatarData = sanitized.avatarData;
    } else {
      delete out.avatarData;
    }
  } else if (sanitized.avatarData === null) {
    out.avatarData = null;
  } else {
    delete out.avatarData;
  }

  return out;
}

/**
 * Normalizes a `/users/{id}/blocks/{blockId}` document to satisfy `/firestore.rules`.
 */
export function enforceBlockRuleBounds(raw: Record<string, any>, fallbackId: string, username: string, userId: string): Record<string, any> {
  const sanitized = (sanitizeForFirestore(raw) || {}) as Record<string, any>;
  return {
    ...sanitized,
    id: clampRequiredString(sanitized.id, 128, fallbackId.slice(0, 128)),
    kind: clampRequiredString(sanitized.kind, 32, 'link'),
    userId: clampNullableString(sanitized.userId ?? userId, 128) ?? 'owner',
    username: clampNullableString(sanitized.username ?? username, 64),
    title: clampNullableString(sanitized.title, 256) ?? '',
    url: clampNullableString(sanitized.url, 2048),
    thumbnailUrl: clampNullableString(sanitized.thumbnailUrl, 2048),
    updatedAt: clampRequiredString(sanitized.updatedAt, 64, new Date().toISOString()),
  };
}

/**
 * Normalizes a `/users/{id}/contacts/{contactId}` document to satisfy `/firestore.rules`.
 */
export function enforceContactRuleBounds(raw: Record<string, any>, fallbackId: string, username: string): Record<string, any> {
  const sanitized = (sanitizeForFirestore(raw) || {}) as Record<string, any>;
  return {
    ...sanitized,
    id: clampRequiredString(sanitized.id, 128, fallbackId.slice(0, 128)),
    username: clampNullableString(sanitized.username ?? username, 64),
    email: clampNullableString(sanitized.email, 320),
    phone: clampNullableString(sanitized.phone, 32),
    createdAt: clampRequiredString(sanitized.createdAt, 64, new Date().toISOString()),
  };
}

/**
 * Normalizes a `/users/{id}/analytics/{eventId}` document to strictly match `hasOnly` in `/firestore.rules`.
 */
export function enforceAnalyticsRuleBounds(raw: Record<string, any>, safeId: string, cleanUsername: string): Record<string, any> {
  const allowedDevices = new Set(['mobile', 'tablet', 'desktop', 'other']);
  const device = typeof raw.device === 'string' && allowedDevices.has(raw.device) ? raw.device : 'desktop';
  const eventType = raw.eventType === 'link_click' ? 'link_click' : 'page_view';
  return {
    id: clampRequiredString(safeId, 128, 'ev'),
    username: clampRequiredString(cleanUsername, 64, 'unknown'),
    eventType,
    blockId: clampNullableString(raw.blockId, 128),
    country: clampNullableString(raw.country ?? 'Unknown', 120),
    referrer: clampNullableString(raw.referrer ?? 'direct', 120),
    device,
    createdAt: clampRequiredString(raw.createdAt, 64, new Date().toISOString()),
  };
}

/**
 * Normalizes a `/users/{id}/appearance/v2` document to satisfy `hasAll`, `hasOnly`, and `themes.size() <= 20`.
 */
export function enforceAppearanceRuleBounds(raw: {
  username: string;
  userId: string;
  appearance?: unknown;
  history?: unknown;
  themes?: unknown[];
  updatedAt?: string;
}): Record<string, any> {
  const themesArr = Array.isArray(raw.themes)
    ? (sanitizeForFirestore(raw.themes.slice(0, 20)) as unknown[])
    : [];
  return {
    username: clampRequiredString(raw.username, 64, 'owner'),
    userId: clampRequiredString(raw.userId, 128, 'owner'),
    appearance: sanitizeForFirestore(raw.appearance ?? null),
    history: sanitizeForFirestore(raw.history ?? { undoStack: [], redoStack: [] }),
    themes: themesArr,
    updatedAt: clampRequiredString(raw.updatedAt, 64, new Date().toISOString()),
  };
}

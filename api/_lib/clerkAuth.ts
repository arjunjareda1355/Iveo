import type { Request as ExpressReq } from 'express';
import { verifyToken } from '@clerk/backend';

export interface VerifiedClerkActor {
  enforced: boolean;
  userId: string | null;
  verifiedByJwt: boolean;
  error?: string;
}

/**
 * Verifies Clerk session JWT from `Authorization: Bearer <token>` when `CLERK_SECRET_KEY` is configured.
 * Strictly preserves Clerk authentication and user IDs without modifying Clerk config or routes.
 */
export async function verifyClerkRequest(req: ExpressReq): Promise<VerifiedClerkActor> {
  const secretKey = (process.env.CLERK_SECRET_KEY || '').trim();
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : '';

  const fallbackHeaderUserId = String(
    req.headers['x-user-id'] || req.headers['x-iveo-user-id'] || ''
  ).trim() || null;

  if (!secretKey) {
    return {
      enforced: false,
      userId: fallbackHeaderUserId,
      verifiedByJwt: false,
    };
  }

  if (!token) {
    return {
      enforced: true,
      userId: null,
      verifiedByJwt: false,
      error: 'missing_bearer_token',
    };
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
    if (!sub) {
      return {
        enforced: true,
        userId: null,
        verifiedByJwt: false,
        error: 'invalid_token_subject',
      };
    }
    return {
      enforced: true,
      userId: sub,
      verifiedByJwt: true,
    };
  } catch {
    return {
      enforced: true,
      userId: null,
      verifiedByJwt: false,
      error: 'invalid_bearer_token',
    };
  }
}

export interface ResolvedRequestActor {
  enforced: boolean;
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  verifiedByJwt: boolean;
  error?: string;
}

const clerkEmailCache = new Map<string, { email: string | null; expiresAt: number }>();

export function clearClerkActorCacheForTests(): void {
  clerkEmailCache.clear();
}

/**
 * Resolves the caller identity for both enforced Clerk JWT mode and local/dev fallback mode.
 * When CLERK_SECRET_KEY is configured, client-supplied email/adminEmail headers or query params
 * are NEVER trusted; the verified email is resolved directly from Clerk Backend API.
 */
export async function resolveVerifiedRequestActor(req: ExpressReq): Promise<ResolvedRequestActor> {
  const jwtActor = await verifyClerkRequest(req);
  if (!jwtActor.enforced) {
    const rawHeaderEmail = String(
      req.headers['x-user-email'] || req.query?.adminEmail || ''
    )
      .toLowerCase()
      .trim();
    const email = rawHeaderEmail || null;
    return {
      enforced: false,
      authenticated: Boolean(jwtActor.userId || email),
      userId: jwtActor.userId,
      email,
      verifiedByJwt: false,
    };
  }

  if (!jwtActor.verifiedByJwt || !jwtActor.userId) {
    return {
      enforced: true,
      authenticated: false,
      userId: null,
      email: null,
      verifiedByJwt: false,
      error: jwtActor.error || 'unauthorized',
    };
  }

  const cached = clerkEmailCache.get(jwtActor.userId);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      enforced: true,
      authenticated: true,
      userId: jwtActor.userId,
      email: cached.email,
      verifiedByJwt: true,
    };
  }

  let resolvedEmail: string | null = null;
  try {
    const secretKey = (process.env.CLERK_SECRET_KEY || '').trim();
    if (secretKey) {
      const { createClerkClient } = await import('@clerk/backend');
      const client = createClerkClient({ secretKey });
      const user = await client.users.getUser(jwtActor.userId);
      const primary =
        user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId) ||
        user.emailAddresses?.[0];
      if (primary?.emailAddress) {
        resolvedEmail = primary.emailAddress.toLowerCase().trim();
      }
    }
  } catch {
    resolvedEmail = null;
  }

  clerkEmailCache.set(jwtActor.userId, {
    email: resolvedEmail,
    expiresAt: Date.now() + 60_000,
  });

  return {
    enforced: true,
    authenticated: true,
    userId: jwtActor.userId,
    email: resolvedEmail,
    verifiedByJwt: true,
  };
}


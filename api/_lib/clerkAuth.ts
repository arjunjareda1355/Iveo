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

import { dbClaimUsername } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/claim-username
 * Atomically validates, reserves, and claims a username in the database
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userId = (body.userId || request.headers.get('x-user-id') || '').trim();
    const username = (body.username || '').toLowerCase().trim();
    const primaryEmail = (body.primaryEmail || request.headers.get('x-user-email') || '').toLowerCase().trim() || null;
    const profileData = body.profile || body.profileData || body;

    if (!userId) {
      return Response.json(
        { error: 'unauthorized', message: 'You must be signed in to claim an address.' },
        { status: 401 }
      );
    }

    if (!username) {
      return Response.json(
        { error: 'missing_username', message: 'Username is required.' },
        { status: 400 }
      );
    }

    const result = await dbClaimUsername(userId, username, profileData, primaryEmail);
    if (!result.ok) {
      const statusCode = result.error === 'already_claimed' ? 409 : 400;
      return Response.json(
        {
          ok: false,
          error: result.error,
          message: result.message || 'That address is unavailable.',
        },
        { status: statusCode }
      );
    }

    return Response.json(
      {
        ok: true,
        username: result.username,
        profileUrl: result.profileUrl,
        message: `iveo.site/${result.username} successfully claimed!`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return Response.json({ error: 'claim_failed', message: err?.message }, { status: 500 });
  }
}

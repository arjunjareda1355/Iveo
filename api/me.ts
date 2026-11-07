import { dbGetProfileByUserId, dbGetBlocks } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me?userId=...&email=...
 * Retrieves user's claimed username and settings across any browser/device
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = (url.searchParams.get('userId') || request.headers.get('x-user-id') || '').trim();
  const email = (url.searchParams.get('email') || request.headers.get('x-user-email') || '').toLowerCase().trim() || null;

  if (!userId && !email) {
    return Response.json(
      { error: 'missing_user_id', message: 'User identifier required.' },
      { status: 400 }
    );
  }

  try {
    const profile = await dbGetProfileByUserId(userId, email);
    if (!profile) {
      return Response.json({ ok: true, claimed: false }, { status: 200 });
    }

    const blocks = await dbGetBlocks(profile.username);

    return Response.json(
      {
        ok: true,
        claimed: true,
        username: profile.username,
        profile,
        blocks,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return Response.json({ error: 'fetch_failed', message: err?.message }, { status: 500 });
  }
}

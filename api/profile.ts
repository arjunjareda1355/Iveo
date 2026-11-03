import { dbSaveProfile } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/profile
 * Saves or updates profile in database with server-side ownership verification
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const username = (body.username || '').toLowerCase().trim();
    if (!username) {
      return Response.json({ error: 'missing_username' }, { status: 400 });
    }

    const saveResult = await dbSaveProfile({
      userId: body.userId || request.headers.get('x-user-id') || 'owner',
      username,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      avatarType: body.avatarType,
      avatarId: body.avatarId,
      vibeId: body.vibeId,
      buttonShape: body.buttonShape,
      socials: body.socials,
      socialsPosition: body.socialsPosition,
      primaryEmail: body.primaryEmail || request.headers.get('x-user-email') || null,
      plan: body.plan,
      hideFooter: body.hideFooter,
      hideFromSearch: body.hideFromSearch,
    });

    if (saveResult && !saveResult.ok) {
      if (saveResult.error === 'unauthorized') {
        return Response.json(
          { error: 'unauthorized', message: 'You are not authorized to edit this page.' },
          { status: 403 }
        );
      }
      return Response.json({ error: saveResult.error }, { status: 400 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'save_failed', message: err?.message }, { status: 500 });
  }
}

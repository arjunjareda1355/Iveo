import { dbClaimUsername, dbSaveBlocks } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userId = (body.userId || '').trim();
    const username = (body.username || '').toLowerCase().trim();
    const primaryEmail = (body.primaryEmail || '').toLowerCase().trim() || null;
    const profileData = body.profile || {};
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];

    if (!userId || !username) {
      return Response.json({ error: 'invalid_migration_payload' }, { status: 400 });
    }

    const claimRes = await dbClaimUsername(userId, username, profileData, primaryEmail);
    if (!claimRes.ok && claimRes.error === 'already_claimed') {
      return Response.json({ ok: false, error: 'already_claimed' }, { status: 409 });
    }

    if (blocks.length > 0) {
      await dbSaveBlocks(username, blocks, userId, primaryEmail);
    }

    return Response.json({ ok: true, migrated: true, username }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'migration_failed', message: err?.message }, { status: 500 });
  }
}

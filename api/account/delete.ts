import { dbDeleteAccount } from '../_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const username = (body.username || '').toLowerCase().trim();
    const userId = (body.userId || request.headers.get('x-user-id') || '').trim();
    const primaryEmail = (body.primaryEmail || request.headers.get('x-user-email') || '').toLowerCase().trim() || null;

    if (!username || !userId) {
      return Response.json({ error: 'missing_identifiers' }, { status: 400 });
    }

    const result = await dbDeleteAccount(username, userId, primaryEmail);
    if (!result.ok) {
      if (result.error === 'unauthorized') {
        return Response.json({ error: 'unauthorized', message: 'You are not authorized to delete this account.' }, { status: 403 });
      }
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true, deleted: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'delete_failed', message: err?.message }, { status: 500 });
  }
}

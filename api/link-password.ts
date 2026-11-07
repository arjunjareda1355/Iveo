import { dbSetLinkPassword, dbClearLinkPassword } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { linkId, password, remove } = body;
    if (!linkId) {
      return Response.json({ error: 'missing_link_id' }, { status: 400 });
    }

    if (remove) {
      await dbClearLinkPassword(linkId);
    } else {
      if (!password || password.length < 4 || password.length > 64) {
        return Response.json({ error: 'invalid_password' }, { status: 400 });
      }
      await dbSetLinkPassword(linkId, password);
    }
    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'password_failed', message: err?.message }, { status: 500 });
  }
}

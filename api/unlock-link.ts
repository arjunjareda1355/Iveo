import { dbVerifyLinkPassword, dbGetBlocks } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { linkId, password, username } = body;
    if (!linkId || !password) {
      return Response.json({ ok: false, reason: 'wrong_password' }, { status: 400 });
    }

    const isMatch = await dbVerifyLinkPassword(linkId, String(password).trim());
    if (!isMatch) {
      return Response.json({ ok: false, reason: 'wrong_password' }, { status: 200 });
    }

    let realUrl = 'https://iveo.site';
    if (username) {
      const blocks = await dbGetBlocks(String(username).toLowerCase().trim());
      const target = blocks.find((b) => b.id === linkId);
      if (target?.url) realUrl = target.url;
    }

    return Response.json({ ok: true, url: realUrl }, { status: 200 });
  } catch {
    return Response.json({ ok: false, reason: 'network' }, { status: 500 });
  }
}

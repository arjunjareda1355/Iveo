import { dbGetBlocks, dbSaveBlocks } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/blocks?username=...
 * Retrieves owner's blocks
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').toLowerCase().trim();

  if (!username) {
    return Response.json({ error: 'missing_username' }, { status: 400 });
  }

  try {
    const blocks = await dbGetBlocks(username);
    return Response.json(blocks, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'fetch_failed', message: err?.message }, { status: 500 });
  }
}

/**
 * POST /api/blocks
 * Saves owner's blocks
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
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    const userId = (body.userId || request.headers.get('x-user-id') || '').trim();
    const primaryEmail = (body.primaryEmail || request.headers.get('x-user-email') || '').toLowerCase().trim() || null;

    if (!username) {
      return Response.json({ error: 'missing_username' }, { status: 400 });
    }

    const result = await dbSaveBlocks(username, blocks, userId || undefined, primaryEmail);
    if (result && !result.ok) {
      if (result.error === 'unauthorized') {
        return Response.json(
          { error: 'unauthorized', message: 'You are not authorized to edit this page.' },
          { status: 403 }
        );
      }
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'save_failed', message: err?.message }, { status: 500 });
  }
}

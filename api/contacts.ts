import {
  dbSaveContact,
  dbGetContacts,
  dbDeleteContact,
  dbDeleteAllContacts,
} from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').toLowerCase().trim();
  const search = (url.searchParams.get('search') || '').toLowerCase().trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20);

  try {
    let contacts = await dbGetContacts(username || undefined);
    if (search) {
      contacts = contacts.filter((c: any) =>
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.phone && c.phone.toLowerCase().includes(search)) ||
        (c.formTitle && c.formTitle.toLowerCase().includes(search))
      );
    }
    const total = contacts.length;
    const from = (page - 1) * pageSize;
    const rows = contacts.slice(from, from + pageSize);
    return Response.json({ rows, total }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'fetch_failed', message: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const username = (body.username || '').toLowerCase().trim();
    const linkId = body.linkId;

    if (!username || !linkId) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    if (body.hp) {
      return Response.json({ ok: true }, { status: 200 });
    }

    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await dbSaveContact({
      id,
      userId: body.userId || 'owner',
      username,
      linkId,
      email: body.email || null,
      phone: body.phone || null,
      consentText: body.consentText || null,
      source: body.source || null,
    });
    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'submit_failed', message: err?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const username = (url.searchParams.get('username') || body.username || '').toLowerCase().trim();
    const contactId = (url.searchParams.get('id') || url.searchParams.get('contactId') || body.contactId || body.id || '').trim();
    const all = Boolean(url.searchParams.get('all') === 'true' || body.all);

    if (all) {
      await dbDeleteAllContacts(username || undefined);
    } else if (contactId) {
      await dbDeleteContact(username || undefined, contactId);
    }
    return Response.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'delete_failed', message: err?.message }, { status: 500 });
  }
}

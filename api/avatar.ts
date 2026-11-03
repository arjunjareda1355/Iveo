import path from 'node:path';
import fs from 'node:fs';
import { dbGetProfile, dbVerifyOwnership, dbSaveProfile } from './_lib/azureSql.ts';

export const dynamic = 'force-dynamic';

const AVATAR_DIR = path.resolve(process.cwd(), 'data', 'avatars');

export async function POST(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const username = (body.username || '').toLowerCase().trim();
    const dataUrl = body.dataUrl as string;
    const userId = (body.userId || request.headers.get('x-user-id') || '').trim();
    const primaryEmail = (body.primaryEmail || request.headers.get('x-user-email') || '').toLowerCase().trim() || null;

    if (!username) {
      return Response.json({ error: 'missing_username' }, { status: 400 });
    }

    if (!dataUrl || typeof dataUrl !== 'string') {
      return Response.json({ error: 'missing_data_url' }, { status: 400 });
    }

    const existing = await dbGetProfile(username);
    if (existing) {
      const authorized = await dbVerifyOwnership(username, userId || existing.userId, primaryEmail || existing.primaryEmail);
      if (!authorized) {
        return Response.json(
          { error: 'unauthorized', message: 'You are not authorized to update this avatar.' },
          { status: 403 }
        );
      }
    }

    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return Response.json({ error: 'invalid_data_url' }, { status: 400 });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
    fs.writeFileSync(avatarFile, buffer);

    const avatarUrl = `/api/avatar?u=${encodeURIComponent(username)}&v=${Date.now()}`;

    await dbSaveProfile({
      userId: userId || existing?.userId || 'owner',
      username,
      displayName: existing?.displayName || username,
      bio: existing?.bio || '',
      avatarUrl,
      avatarType: 'uploaded',
      avatarId: null,
      vibeId: existing?.vibeId || 'clean',
      buttonShape: existing?.buttonShape || 'rounded',
      socials: existing?.socials || {},
      socialsPosition: existing?.socialsPosition || 'top',
      primaryEmail: primaryEmail || existing?.primaryEmail || null,
      plan: existing?.plan || 'free',
      hideFooter: existing?.hideFooter,
      hideFromSearch: existing?.hideFromSearch,
    });

    return Response.json({ ok: true, avatarUrl, avatarType: 'uploaded', avatarId: null }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'upload_failed', message: err?.message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const username = (url.searchParams.get('u') || url.searchParams.get('username') || '').toLowerCase().trim();

  if (!username) {
    return new Response(null, { status: 400 });
  }

  const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
  if (fs.existsSync(avatarFile)) {
    const data = fs.readFileSync(avatarFile);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=86400',
      },
    });
  }

  return new Response(null, { status: 404 });
}

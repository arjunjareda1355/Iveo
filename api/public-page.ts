import { dbGetProfile, dbGetBlocks } from './_lib/azureSql.ts';
import { isAllowedAvatarHost } from './_lib/publicPage.ts';
import { RESERVED } from './_lib/usernames.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public-page?u=username
 * Returns public page data for any visitor or crawler across Vercel and Express
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let raw = (url.searchParams.get('u') || url.searchParams.get('username') || '').trim();

  // If not provided in query param, extract from Host header subdomain
  if (!raw) {
    const hostHeader = request.headers.get('host') || url.host || '';
    const host = hostHeader.toLowerCase().split(':')[0];
    if (host.endsWith('.iveo.site')) {
      const sub = host.slice(0, -'.iveo.site'.length);
      if (sub && !RESERVED.has(sub)) {
        raw = sub;
      }
    } else if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      if (sub && !RESERVED.has(sub)) {
        raw = sub;
      }
    }
  }

  const clean = raw.toLowerCase().trim();
  if (!clean) {
    return Response.json({ error: 'missing_username' }, { status: 400 });
  }

  try {
    const profile = await dbGetProfile(clean);
    if (!profile) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    const allBlocks = await dbGetBlocks(clean);
    const now = new Date();

    // Map public blocks (strip URLs from protected links until unlocked)
    const filteredBlocks = (Array.isArray(allBlocks) ? allBlocks : [])
      .filter((b) => {
        if (b.isActive === false || b.isArchived) return false;
        if (b.startAt && new Date(b.startAt) > now) return false;
        if (b.endAt && new Date(b.endAt) <= now) return false;
        return true;
      })
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        title: b.title || '',
        url: b.isProtected ? null : (b.url || null),
        icon: b.icon || null,
        thumbnailPath: b.thumbnailPath || null,
        thumbnailUrl: b.thumbnailUrl || null,
        layout: b.layout || 'classic',
        embedProvider: b.embedProvider || null,
        isProtected: Boolean(b.isProtected),
        signup: b.signup || null,
        tipJar: b.tipJar || null,
        faq: b.faq || null,
        vcard: b.vcard || null,
        animation: b.animation || null,
        badge: b.badge || null,
      }));

    return Response.json(
      {
        profile: {
          username: profile.username,
          displayName: profile.displayName || profile.username,
          bio: profile.bio || '',
          avatarUrl: isAllowedAvatarHost(profile.avatarUrl) ? profile.avatarUrl : null,
          avatarType: profile.avatarType || (profile.avatarId ? 'default' : (profile.avatarUrl ? 'uploaded' : 'default')),
          avatarId: profile.avatarId || null,
          vibeId: profile.vibeId || 'clean',
          buttonShape: profile.buttonShape || 'rounded',
          socials: profile.socials || {},
          socialsPosition: profile.socialsPosition || 'top',
          hideFromSearch: Boolean(profile.hideFromSearch),
          hideFooter: Boolean(profile.hideFooter),
        },
        links: filteredBlocks,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
        },
      }
    );
  } catch (err: any) {
    return Response.json({ error: 'server_error', message: err?.message }, { status: 500 });
  }
}

import { validateUsernameServer, isPrivilegedEmailServer } from './_lib/usernames.ts';
import { adminClient } from './_lib/supabase.ts';
import { dbGetProfile } from './_lib/azureSql.ts';
import { firebaseIsUsernameClaimed } from './_lib/firebaseServer.ts';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get('u') || url.searchParams.get('username') || '';
  const requestingUserId = (url.searchParams.get('userId') || request.headers.get('x-user-id') || '').trim();
  const requestingEmail = (url.searchParams.get('email') || request.headers.get('x-user-email') || '').trim().toLowerCase();
  const clean = raw.trim().replace(/^@+/, '').toLowerCase();
  const allowReserved = isPrivilegedEmailServer(requestingEmail);

  const validation = validateUsernameServer(clean, { allowReserved });
  if (!validation.ok) {
    return Response.json({
      ok: true,
      available: false,
      reason: validation.reason,
      message: validation.message,
    });
  }

  let lookupHadError = false;

  // 1. Check Firebase Cloud Database (persistent across revisions & instances)
  try {
    const fbClaim = await firebaseIsUsernameClaimed(clean, requestingUserId || undefined);
    if (fbClaim.claimed) {
      if (fbClaim.isOwn) {
        return Response.json({
          ok: true,
          available: true,
          username: clean,
          profileUrl: `https://iveo.site/@${clean}`,
          subdomainUrl: `https://iveo.site/@${clean}`,
          message: `iveo.site/@${clean} is your address`,
        });
      }
      return Response.json({
        ok: true,
        available: false,
        reason: 'taken',
        message: `iveo.site/@${clean} is already claimed. Try another.`,
      });
    }
  } catch {
    lookupHadError = true;
  }

  // 2. Check centralized database (Azure SQL / server store)
  try {
    const existing = await dbGetProfile(clean);
    if (existing && existing.username) {
      if (requestingUserId && existing.userId === requestingUserId) {
        return Response.json({
          ok: true,
          available: true,
          username: clean,
          profileUrl: `https://iveo.site/@${clean}`,
          subdomainUrl: `https://iveo.site/@${clean}`,
          message: `iveo.site/@${clean} is your address`,
        });
      }
      return Response.json({
        ok: true,
        available: false,
        reason: 'taken',
        message: `iveo.site/@${clean} is already claimed. Try another.`,
      });
    }
  } catch {
    lookupHadError = true;
  }

  // 3. Check Supabase database if configured
  const supabase = adminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, user_id')
        .eq('username', clean)
        .maybeSingle();

      if (error) {
        lookupHadError = true;
      } else if (data && data.username) {
        if (requestingUserId && data.user_id === requestingUserId) {
          return Response.json({
            ok: true,
            available: true,
            username: clean,
            profileUrl: `https://iveo.site/@${clean}`,
            subdomainUrl: `https://iveo.site/@${clean}`,
            message: `iveo.site/@${clean} is your address`,
          });
        }
        return Response.json({
          ok: true,
          available: false,
          reason: 'taken',
          message: `iveo.site/@${clean} is already claimed. Try another.`,
        });
      }
    } catch {
      lookupHadError = true;
    }
  }

  if (lookupHadError) {
    return Response.json(
      {
        ok: false,
        available: false,
        reason: 'check_failed',
        message: 'Could not verify availability right now. Please try again.',
      },
      { status: 503 }
    );
  }

  return Response.json({
    ok: true,
    available: true,
    username: clean,
    profileUrl: `https://iveo.site/@${clean}`,
    subdomainUrl: `https://iveo.site/@${clean}`,
    message: `iveo.site/@${clean} is available`,
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const u = body.u || body.username || '';
  const userId = body.userId || '';
  const email = body.email || body.primaryEmail || '';
  const url = new URL(request.url);
  url.searchParams.set('u', u);
  if (userId) url.searchParams.set('userId', userId);
  if (email) url.searchParams.set('email', email);
  return GET(new Request(url.toString(), { method: 'GET', headers: request.headers }));
}

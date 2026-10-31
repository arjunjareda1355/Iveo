import { normalizeUsername, RESERVED, USERNAME_PATTERN } from './_lib/usernames.ts';
import { adminClient } from './_lib/supabase.ts';
import { dbGetProfile } from './_lib/azureSql.ts';

export const DEMO_TAKEN_USERNAMES = new Set([
  'maya',
  'devsharma',
  'lenahoffmann',
  'tomasreyes',
  'elena',
  'kai',
  'alex',
  'test',
  'owner',
]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get('u') || url.searchParams.get('username') || '';
  const requestingUserId = url.searchParams.get('userId') || '';
  const clean = raw.trim().toLowerCase();

  if (!clean || clean.length < 3) {
    return Response.json({
      ok: true,
      available: false,
      reason: 'too_short',
      message: 'Use 3 to 24 letters, numbers or underscores.',
    });
  }

  if (clean.length > 24 || !USERNAME_PATTERN.test(clean)) {
    return Response.json({
      ok: true,
      available: false,
      reason: 'invalid_format',
      message: 'Use 3 to 24 letters, numbers or underscores.',
    });
  }

  if (RESERVED.has(clean)) {
    return Response.json({
      ok: true,
      available: false,
      reason: 'reserved',
      message: 'That name is reserved. Choose another.',
    });
  }

  // Check centralized database (Azure SQL / server store)
  try {
    const existing = await dbGetProfile(clean);
    if (existing && existing.username) {
      if (requestingUserId && existing.userId === requestingUserId) {
        return Response.json({
          ok: true,
          available: true,
          username: clean,
          message: `iveo.site/${clean} is your address`,
        });
      }
      return Response.json({
        ok: true,
        available: false,
        reason: 'taken',
        message: 'That address is already claimed. Try another.',
      });
    }
  } catch {}

  // Check Supabase database if configured
  const supabase = adminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, user_id')
        .eq('username', clean)
        .maybeSingle();

      if (!error && data && data.username) {
        if (requestingUserId && data.user_id === requestingUserId) {
          return Response.json({
            ok: true,
            available: true,
            username: clean,
            message: `iveo.site/${clean} is your address`,
          });
        }
        return Response.json({
          ok: true,
          available: false,
          reason: 'taken',
          message: 'That address is already claimed. Try another.',
        });
      }
    } catch {
      // Continue if database lookup fails
    }
  }

  return Response.json({
    ok: true,
    available: true,
    username: clean,
    message: `iveo.site/${clean} is available`,
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const u = body.u || body.username || '';
  const url = new URL(request.url);
  url.searchParams.set('u', u);
  return GET(new Request(url.toString(), { method: 'GET', headers: request.headers }));
}

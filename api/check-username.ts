import { validateUsernameServer } from './_lib/usernames.ts';
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

  const validation = validateUsernameServer(clean);
  if (!validation.ok) {
    return Response.json({
      ok: true,
      available: false,
      reason: validation.reason,
      message: validation.message,
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
          profileUrl: `https://iveo.site/${clean}`,
          subdomainUrl: `https://iveo.site/${clean}`,
          message: `iveo.site/${clean} is your address`,
        });
      }
      return Response.json({
        ok: true,
        available: false,
        reason: 'taken',
        message: `iveo.site/${clean} is already claimed. Try another.`,
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
            profileUrl: `https://iveo.site/${clean}`,
            subdomainUrl: `https://iveo.site/${clean}`,
            message: `iveo.site/${clean} is your address`,
          });
        }
        return Response.json({
          ok: true,
          available: false,
          reason: 'taken',
          message: `iveo.site/${clean} is already claimed. Try another.`,
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
    profileUrl: `https://iveo.site/${clean}`,
    subdomainUrl: `https://iveo.site/${clean}`,
    message: `iveo.site/${clean} is available`,
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const u = body.u || body.username || '';
  const userId = body.userId || '';
  const url = new URL(request.url);
  url.searchParams.set('u', u);
  if (userId) url.searchParams.set('userId', userId);
  return GET(new Request(url.toString(), { method: 'GET', headers: request.headers }));
}

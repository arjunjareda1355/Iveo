import { normalizeUsername, RESERVED, USERNAME_PATTERN } from './_lib/usernames.js';
import { adminClient } from './_lib/supabase.js';

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

  if (DEMO_TAKEN_USERNAMES.has(clean)) {
    return Response.json({
      ok: true,
      available: false,
      reason: 'taken',
      message: "That name isn't available. Try another.",
    });
  }

  // Check Supabase database if configured
  const supabase = adminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', clean)
        .maybeSingle();

      if (!error && data && data.username) {
        return Response.json({
          ok: true,
          available: false,
          reason: 'taken',
          message: 'That name is already taken. Try another.',
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

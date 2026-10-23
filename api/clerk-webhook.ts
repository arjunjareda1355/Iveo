import { verifyWebhook } from '@clerk/backend/webhooks';
import { getClerkWebhookSigningSecret, hasAdminSupabase } from './_lib/env.js';
import { adminClient } from './_lib/supabase.js';
import { normalizeUsername, RESERVED } from './_lib/usernames.js';
import { isAllowedAvatarHost } from './_lib/publicPage.js';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id?: string;
    username?: string | null;
    image_url?: string | null;
  };
}

export async function GET(): Promise<Response> {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const signingSecret = getClerkWebhookSigningSecret();
  if (!signingSecret || !hasAdminSupabase()) {
    console.error('webhook_not_configured');
    return Response.json({ error: 'not_configured' }, { status: 500 });
  }

  // 1. Verify signature before reading payload
  let event: ClerkWebhookEvent;
  try {
    event = (await verifyWebhook(request, {
      signingSecret,
    })) as unknown as ClerkWebhookEvent;
  } catch {
    console.error('invalid_signature');
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // 2. Validate user ID format
  const userId = event.data?.id;
  if (!userId || !/^user_[A-Za-z0-9]+$/.test(userId)) {
    console.log('bad_user_id');
    return Response.json({ ok: true, ignored: true }, { status: 200 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return Response.json({ error: 'temporary' }, { status: 500 });
  }

  // 3. Handle user.deleted
  if (event.type === 'user.deleted') {
    try {
      // 3.1 Delete stored images in user's folder
      const storage = supabase.storage.from('link-images');
      let rounds = 0;
      let hasMore = true;

      while (hasMore && rounds < 20) {
        rounds++;
        const { data: files, error: listError } = await storage.list(userId, {
          limit: 1000,
        });

        if (listError) {
          // If folder does not exist, that is fine
          break;
        }

        if (!files || files.length === 0) {
          hasMore = false;
          break;
        }

        const pathsToRemove = files.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await storage.remove(pathsToRemove);
        if (removeError) {
          console.error('storage_delete_failed');
          return Response.json({ error: 'temporary' }, { status: 500 });
        }
      }

      // 3.2 Delete profile row (cascades remove links & analytics)
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('profile_delete_failed');
        return Response.json({ error: 'temporary' }, { status: 500 });
      }

      console.log('user_deleted_success');
      return Response.json({ ok: true }, { status: 200 });
    } catch {
      console.error('user_deleted_exception');
      return Response.json({ error: 'temporary' }, { status: 500 });
    }
  }

  // 4. Handle user.updated
  if (event.type === 'user.updated') {
    try {
      const patch: Record<string, string | null> = {};

      // Check username
      if (typeof event.data.username === 'string') {
        const cleanUser = normalizeUsername(event.data.username);
        if (cleanUser && !RESERVED.has(cleanUser)) {
          patch.username = cleanUser;
        }
      }

      // Check avatar URL
      if (typeof event.data.image_url === 'string') {
        if (isAllowedAvatarHost(event.data.image_url)) {
          patch.avatar_url = event.data.image_url;
        }
      }

      if (Object.keys(patch).length === 0) {
        return Response.json({ ok: true, ignored: true }, { status: 200 });
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId);

      if (updateError) {
        // Handle username collision or reserved username without retrying
        if (
          updateError.code === '23505' ||
          updateError.message.includes('username_reserved')
        ) {
          console.log('username_conflict');
          // If avatar was in patch, still apply avatar update
          if (patch.avatar_url) {
            await supabase
              .from('profiles')
              .update({ avatar_url: patch.avatar_url })
              .eq('user_id', userId);
          }
          return Response.json({ ok: true }, { status: 200 });
        }

        console.error('profile_update_failed');
        return Response.json({ error: 'temporary' }, { status: 500 });
      }

      console.log('user_updated_success');
      return Response.json({ ok: true }, { status: 200 });
    } catch {
      console.error('user_updated_exception');
      return Response.json({ error: 'temporary' }, { status: 500 });
    }
  }

  // Any other verified event is ignored
  return Response.json({ ok: true, ignored: true }, { status: 200 });
}

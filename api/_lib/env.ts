/**
 * Typed environment getters for server functions under api/
 * Never import from src/.
 */

export function getSiteOrigin(request?: Request): string {
  const envOrigin = process.env.VITE_SITE_ORIGIN?.trim();
  if (envOrigin) {
    try {
      const u = new URL(envOrigin);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      // Fallback to host header
    }
  }

  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) {
      return `https://${host}`;
    }
  }

  return 'https://iveo.site';
}

export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
}

export function getSupabaseSecretKey(): string | undefined {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) return undefined;

  // Accept keys starting with sb_secret_ or service_role JWTs
  if (key.startsWith('sb_secret_')) {
    return key;
  }

  // Check if JWT with role service_role
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') {
        return key;
      }
    }
  } catch {
    // Invalid JWT
  }

  return undefined;
}

export function getClerkWebhookSigningSecret(): string | undefined {
  return process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim();
}

export function hasPublicSupabase(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function hasAdminSupabase(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey() && getClerkWebhookSigningSecret());
}

export function getRazorpayKeyId(): string {
  return (
    process.env.RAZORPAY_KEY_ID?.trim() ||
    process.env.VITE_RAZORPAY_KEY_ID?.trim() ||
    'rzp_live_Tj2WkYSgUgzyJr'
  );
}

export function getRazorpayKeySecret(): string {
  return (
    process.env.RAZORPAY_KEY_SECRET?.trim() ||
    'Veqs5nBUkzIGLOOdFGQW0908'
  );
}

export function getRazorpayWebhookSecret(): string | undefined {
  return (
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    process.env.RAZORPAY_KEY_SECRET?.trim() ||
    'Veqs5nBUkzIGLOOdFGQW0908'
  );
}


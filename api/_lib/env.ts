import 'dotenv/config';

/**
 * Typed environment getters for server functions under api/
 * Never import from src/.
 */

export function getSiteOrigin(request?: Request): string {
  const envOrigin = process.env.VITE_SITE_ORIGIN?.trim() || process.env.APP_URL?.trim();
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
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) {
      const resolvedProto = host.includes('localhost') || host.startsWith('127.') ? proto : 'https';
      return `${resolvedProto}://${host}`;
    }
  }

  return 'https://iveo.site';
}

export function getCanonicalSiteOrigin(): string {
  const explicit = process.env.GSC_SITE_URL?.trim() || process.env.VITE_SITE_ORIGIN?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && !u.host.includes('localhost')) {
        return `${u.protocol}//${u.host}`;
      }
    } catch {}
  }
  return 'https://iveo.site';
}

export function getBuyMeACoffeeToken(): string | undefined {
  return process.env.BUYMEACOFFEE_ACCESS_TOKEN?.trim() || undefined;
}

export function getGoogleSiteVerification(): string | undefined {
  return process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
}

export function getBingSiteVerification(): string | undefined {
  return process.env.BING_SITE_VERIFICATION?.trim() || undefined;
}

export function getIndexNowKey(): string | undefined {
  return process.env.INDEXNOW_KEY?.trim() || undefined;
}

export function getSeoAdminEmails(): string[] {
  const raw = process.env.SEO_ADMIN_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
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
    ''
  );
}

export function getRazorpayKeySecret(): string {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || '';
}

export function getRazorpayWebhookSecret(): string | undefined {
  return (
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    process.env.RAZORPAY_KEY_SECRET?.trim() ||
    undefined
  );
}


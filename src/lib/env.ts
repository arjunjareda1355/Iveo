// Clerk Keys:
// Production key for custom domain (iveo.site):
export const CLERK_PROD_KEY = 'pk_live_Y2xlcmsuaXZlby5zaXRlJA';

// Development key for preview and local dev (*.run.app, localhost) generated via Clerk CLI:
export const CLERK_DEV_KEY =
  'pk_test_Y29zbWljLWFudGVhdGVyLTExNDMuY2xlcmsuYWNjb3VudHMuZGV2JA';

const envKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

export const KEY_ERROR_IS_SECRET = envKey.startsWith('sk_');

// Check if running on the production domain (iveo.site / ivio.site)
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
export const isProductionDomain =
  hostname === 'iveo.site' ||
  hostname.endsWith('.iveo.site') ||
  hostname === 'ivio.site' ||
  hostname.endsWith('.ivio.site');

// Resolve the appropriate publishable key
export const CLERK_PUBLISHABLE_KEY =
  envKey && !KEY_ERROR_IS_SECRET
    ? envKey
    : isProductionDomain
      ? CLERK_PROD_KEY
      : CLERK_DEV_KEY;

export const HAS_CLERK_KEY =
  !KEY_ERROR_IS_SECRET &&
  (CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') ||
    CLERK_PUBLISHABLE_KEY.startsWith('pk_live_'));

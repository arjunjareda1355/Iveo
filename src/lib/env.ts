// Clerk Keys:
// Production key for custom domain (iveo.site):
export const CLERK_PROD_KEY = 'pk_live_Y2xlcmsuaXZlby5zaXRlJA';

// Development key for preview and local dev (*.run.app, localhost):
export const CLERK_DEV_KEY =
  'pk_test_Y29zbWljLWFudGVhdGVyLTExNDMuY2xlcmsuYWNjb3VudHMuZGV2JA';

const envKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

export const KEY_ERROR_IS_SECRET = envKey.startsWith('sk_');

// Check if running on the registered production domain (iveo.site)
const hostname =
  typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
export const isProductionDomain =
  hostname === 'iveo.site' || hostname.endsWith('.iveo.site');

// Resolve the appropriate publishable key:
// 1. If running on production domain (iveo.site), use production key.
// 2. If running on preview or development domain (*.run.app, localhost):
//    Clerk strictly enforces that pk_live_ keys can ONLY be called from their registered domain.
//    Attempting to use a pk_live_ key from *.run.app or localhost causes Clerk JS to throw:
//    "Clerk: Production Keys are only allowed for domain 'iveo.site'".
//    Therefore, on non-production domains we use CLERK_DEV_KEY (or a custom pk_test_ key if provided).
export const CLERK_PUBLISHABLE_KEY = isProductionDomain
  ? envKey.startsWith('pk_live_')
    ? envKey
    : CLERK_PROD_KEY
  : envKey.startsWith('pk_test_')
    ? envKey
    : CLERK_DEV_KEY;

export const HAS_CLERK_KEY =
  !KEY_ERROR_IS_SECRET &&
  (CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') ||
    CLERK_PUBLISHABLE_KEY.startsWith('pk_live_'));

// If your environment has no way to set variables, paste your Clerk PUBLISHABLE key (pk_test_...) here. Never paste a secret key (sk_...).
const CLERK_PUBLISHABLE_KEY_FALLBACK = '';

const rawKey = (
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  CLERK_PUBLISHABLE_KEY_FALLBACK ||
  ''
).trim();

export const KEY_ERROR_IS_SECRET = rawKey.startsWith('sk_');

// Check if running on the production domain or if it's a dev/preview environment
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isProductionDomain =
  hostname === 'iveo.site' ||
  hostname.endsWith('.iveo.site') ||
  hostname === 'ivio.site' ||
  hostname.endsWith('.ivio.site');

export const KEY_ERROR_IS_PRODUCTION_ON_DEV =
  rawKey.startsWith('pk_live_') && !isProductionDomain;

export const HAS_CLERK_KEY =
  !KEY_ERROR_IS_SECRET &&
  !KEY_ERROR_IS_PRODUCTION_ON_DEV &&
  (rawKey.startsWith('pk_test_') || rawKey.startsWith('pk_live_'));

export const CLERK_PUBLISHABLE_KEY = HAS_CLERK_KEY ? rawKey : '';

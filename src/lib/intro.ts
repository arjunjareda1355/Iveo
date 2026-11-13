import { RESERVED_USERNAMES_SET } from './username-rules';

const SITE_APP_ROOT_SEGMENTS = new Set([
  'pricing',
  'legal',
  'privacy',
  'terms',
  'discover',
  'admin',
  'login',
  'signup',
  'sso-callback',
  'onboarding',
  'dashboard',
  'account',
]);

export interface IntroCheckInput {
  pathname: string;
  hostname?: string;
  search?: string;
  localSeen?: string | null;
  sessionSeen?: string | null;
}

/**
 * Determines whether the incoming request/URL corresponds to a user's public page
 * (`/:username` or `<username>.iveo.site` / `?subdomain=<username>`).
 */
export function isUserPageLocation(input: {
  pathname: string;
  hostname?: string;
  search?: string;
}): boolean {
  const rawPath = (input.pathname || '/').trim();
  const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
  const firstSegment = cleanPath.split('/')[0]?.toLowerCase() || '';

  // 1. Check host subdomain (e.g. maya.iveo.site, maya.localhost, maya---xyz.run.app)
  const host = (input.hostname || '').toLowerCase().trim().split(':')[0];
  if (host.endsWith('.iveo.site')) {
    const sub = host.slice(0, -'.iveo.site'.length);
    if (sub && !RESERVED_USERNAMES_SET.has(sub)) return true;
  }
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length);
    if (sub && !RESERVED_USERNAMES_SET.has(sub)) return true;
  }
  if (host.includes('.run.app') && host.includes('---')) {
    const sub = host.split('---')[0];
    if (sub && !RESERVED_USERNAMES_SET.has(sub)) return true;
  }

  // 2. Check explicit ?subdomain= override on root
  if (!firstSegment && input.search) {
    try {
      const params = new URLSearchParams(input.search);
      const subParam = params.get('subdomain')?.toLowerCase().trim();
      if (subParam && !RESERVED_USERNAMES_SET.has(subParam)) {
        return true;
      }
    } catch {
      // ignore invalid search string
    }
  }

  // 3. Root landing page or known marketing/app routes are NOT user pages
  if (!firstSegment || SITE_APP_ROOT_SEGMENTS.has(firstSegment)) {
    return false;
  }

  // Any other path (e.g., /maya, /arjun, /devsharma) is a user page
  return true;
}

/**
 * Determines whether the #iveo-intro curtain animation should play.
 * NEVER plays on user pages, even on first visit or with ?intro.
 */
export function shouldShowSiteIntro(input: IntroCheckInput): boolean {
  if (
    isUserPageLocation({
      pathname: input.pathname,
      hostname: input.hostname,
      search: input.search,
    })
  ) {
    return false;
  }

  let forceIntro = false;
  if (input.search) {
    try {
      const params = new URLSearchParams(input.search);
      forceIntro = params.has('intro') || params.has('replay-intro');
    } catch {
      forceIntro = false;
    }
  }

  if (forceIntro) return true;
  return input.localSeen !== '1' && input.sessionSeen !== '1';
}

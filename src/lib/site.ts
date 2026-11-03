import type { TrackSource } from './analytics/sources';
import { RESERVED_USERNAMES_SET } from './username-rules';

export const SUPPORT_EMAIL = 'help@iveo.site';
export const BASE_DOMAIN = 'iveo.site';

function resolveSiteOrigin(): string {
  const envVal =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_SITE_ORIGIN
      : typeof process !== 'undefined'
        ? process.env?.VITE_SITE_ORIGIN
        : '';

  const envOrigin = (envVal || '').trim();
  if (envOrigin) {
    try {
      const parsed = new URL(envOrigin);
      if (parsed.protocol === 'https:' && parsed.origin === envOrigin.replace(/\/+$/, '')) {
        return parsed.origin;
      }
    } catch {
      // Fallback below
    }
  }
  return 'https://iveo.site';
}

export const SITE_ORIGIN = resolveSiteOrigin();

/**
 * Returns canonical subdomain public URL: https://{username}.iveo.site
 */
export function pageUrl(username: string, options?: { src?: TrackSource }): string {
  if (!username) return 'https://iveo.site';
  const clean = username.replace(/^[@/]+/, '').toLowerCase().trim();

  // For local testing on localhost, use local subdomain or query param
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    const base = `${window.location.protocol}//${clean}.localhost${port}`;
    if (options?.src) {
      return `${base}?src=${encodeURIComponent(options.src)}`;
    }
    return base;
  }

  const base = `https://${clean}.iveo.site`;
  if (options?.src) {
    return `${base}?src=${encodeURIComponent(options.src)}`;
  }
  return base;
}

/**
 * Returns display-friendly subdomain label: {username}.iveo.site
 */
export function pageDisplayUrl(username: string): string {
  if (!username) return 'iveo.site';
  const clean = username.replace(/^[@/]+/, '').toLowerCase().trim();
  return `${clean}.iveo.site`;
}

/**
 * Extracts username from incoming hostname for subdomain multi-tenancy.
 * Returns null if main domain or a reserved platform subdomain.
 */
export function getSubdomainFromHostname(hostname: string): string | null {
  if (!hostname) return null;
  const host = hostname.toLowerCase().trim().split(':')[0]; // strip port

  // 1. Explicit query or pathname overrides for preview / iframe environments
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const subParam = params.get('subdomain') || params.get('u');
    if (subParam && !RESERVED_USERNAMES_SET.has(subParam.toLowerCase().trim())) {
      return subParam.toLowerCase().trim();
    }
  }

  // 2. Production or custom domain: *.iveo.site
  if (host.endsWith('.iveo.site')) {
    const sub = host.slice(0, -'.iveo.site'.length);
    if (sub && !RESERVED_USERNAMES_SET.has(sub)) {
      return sub;
    }
    return null;
  }

  // 3. Localhost: *.localhost (e.g. arjun.localhost)
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, -'.localhost'.length);
    if (sub && !RESERVED_USERNAMES_SET.has(sub)) {
      return sub;
    }
    return null;
  }

  // 4. Cloud Run / staging URLs (e.g. arjun---xyz.run.app)
  if (host.includes('.run.app') && host.includes('---')) {
    const candidate = host.split('---')[0];
    if (candidate && !RESERVED_USERNAMES_SET.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

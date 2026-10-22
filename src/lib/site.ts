import type { TrackSource } from './analytics/sources';

// Set VITE_SITE_ORIGIN to the deployed address until iveo.site points at the app.
export const SUPPORT_EMAIL = 'help@iveo.site';

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

export function pageUrl(username: string, options?: { src?: TrackSource }): string {
  const clean = username.replace(/^\/+/, '');
  const base = `${SITE_ORIGIN}/${clean}`;
  if (options?.src) {
    return `${base}?src=${encodeURIComponent(options.src)}`;
  }
  return base;
}

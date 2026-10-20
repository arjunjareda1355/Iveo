// Set VITE_SITE_ORIGIN to the deployed address until ivio.site points at the app.

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
  return 'https://ivio.site';
}

export const SITE_ORIGIN = resolveSiteOrigin();

export function pageUrl(username: string): string {
  const clean = username.replace(/^\/+/, '');
  return `${SITE_ORIGIN}/${clean}`;
}

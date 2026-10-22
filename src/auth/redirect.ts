/**
 * Validates and normalizes redirect paths to prevent open-redirect vulnerabilities.
 * Safely accepts relative paths or absolute URLs that match the application's origin.
 */
export function safeRedirectPath(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let trimmed = input.trim();

  // Length check
  if (trimmed.length === 0 || trimmed.length > 512) {
    return null;
  }

  // Handle absolute URLs: allow if matching current application origin
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const isAllowedOrigin =
        typeof window !== 'undefined'
          ? url.origin === window.location.origin
          : url.hostname === 'localhost' ||
            url.hostname === 'iveo.site' ||
            url.hostname.endsWith('.run.app');

      if (!isAllowedOrigin) {
        return null;
      }

      trimmed = url.pathname + url.search + url.hash;
    } catch {
      return null;
    }
  }

  // Must start with single '/', not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }

  // Must not contain backslashes, control characters or whitespace
  if (/[\s\\\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Must not contain a scheme (no ':' before the first '?' in path part)
  const questionIndex = trimmed.indexOf('?');
  const pathPart = questionIndex === -1 ? trimmed : trimmed.slice(0, questionIndex);
  if (pathPart.includes(':')) {
    return null;
  }

  // Must not point at an auth or callback route to avoid infinite redirect loops
  if (
    pathPart === '/login' ||
    pathPart.startsWith('/login/') ||
    pathPart === '/signup' ||
    pathPart.startsWith('/signup/') ||
    pathPart === '/sso-callback'
  ) {
    return null;
  }

  return trimmed;
}

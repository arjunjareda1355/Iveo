/**
 * Validates and normalizes redirect paths to prevent open-redirect vulnerabilities.
 */
export function safeRedirectPath(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Length check
  if (trimmed.length === 0 || trimmed.length > 512) {
    return null;
  }

  // Must start with single '/', not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }

  // Must not contain backslashes, control characters or whitespace
  if (/[\s\\\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Must not contain a scheme (no ':' before the first '/' in path beyond index 0)
  const questionIndex = trimmed.indexOf('?');
  const pathPart = questionIndex === -1 ? trimmed : trimmed.slice(0, questionIndex);
  if (pathPart.includes(':')) {
    return null;
  }

  // Must not point at an auth route to avoid infinite redirect loops
  if (pathPart === '/login' || pathPart.startsWith('/login/') ||
      pathPart === '/signup' || pathPart.startsWith('/signup/')) {
    return null;
  }

  return trimmed;
}

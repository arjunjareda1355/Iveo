/**
 * Checks whether an avatar URL complies with avatar validation rules:
 * allows HTTPS/HTTP URLs, Clerk CDN URLs, Supabase Storage URLs, blob URLs, and data:image URLs.
 */
export function isAllowedAvatarUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();
  // Support base64 data URLs for user avatars up to 1MB
  if (
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/jpg;base64,') ||
    trimmed.startsWith('data:image/webp;base64,') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed.length < 1500000;
  }

  if (trimmed.length > 2048) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

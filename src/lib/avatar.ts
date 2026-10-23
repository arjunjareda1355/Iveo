/**
 * Checks whether an avatar URL complies with database contract v4:
 * null or an https address on img.clerk.com or images.clerk.dev (max 2048 chars).
 */
export function isAllowedAvatarUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.length > 2048) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'img.clerk.com' || parsed.hostname === 'images.clerk.dev')
    );
  } catch {
    return false;
  }
}

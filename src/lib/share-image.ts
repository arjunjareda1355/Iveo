/**
 * Computes a short 8-hex cache-busting version hash for share preview images.
 * Keeps in sync with api/_lib/publicPage.ts
 */
export async function computeShareVersion(
  displayName: string | null | undefined,
  bio: string | null | undefined,
  avatarUrl: string | null | undefined,
  vibeId: string | null | undefined
): Promise<string> {
  const parts = [
    displayName || '',
    bio || '',
    avatarUrl || '',
    vibeId || '',
  ].join('|');

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(parts);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return hashHex.slice(0, 8);
    }
  } catch {
    // Fallback
  }

  // Simple string hash fallback if crypto.subtle unavailable
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    hash = (hash << 5) - hash + parts.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

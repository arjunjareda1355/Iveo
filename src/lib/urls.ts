/**
 * Sanitizes and ensures external URLs have a protocol (defaults to https://).
 * Prevents relative routing bugs where example.com opens as /username/example.com.
 */
export function formatExternalUrl(raw: string | null | undefined): string {
  if (!raw) return '#';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'javascript:void(0)') {
    return '#';
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

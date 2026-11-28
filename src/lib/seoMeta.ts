/**
 * Shared SEO title & meta description formatters for creator public pages,
 * SSR head tags, client document head, and dashboard SERP previews.
 * Pure TypeScript — safe in both Node server and browser bundles.
 */

export function truncateAtWord(input: string, maxLen: number): string {
  const clean = String(input || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  if (maxLen <= 1) return clean.slice(0, Math.max(0, maxLen));

  const slice = clean.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const boundary = lastSpace >= Math.floor(maxLen * 0.55) ? slice.slice(0, lastSpace) : slice;
  return `${boundary.replace(/[\s,.;:!?-]+$/g, '').trimEnd() || slice.trimEnd()}…`;
}

export function sanitizeSeoMetaText(raw: string | null | undefined, maxLen: number): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  return truncateAtWord(stripped, maxLen);
}

export interface ProfileSeoMetaInput {
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
}

export function buildProfileSeoTitle(input: ProfileSeoMetaInput): string {
  const custom = sanitizeSeoMetaText(input.customSeoTitle, 70);
  if (custom) return custom;

  const cleanUsername = String(input.username || '')
    .replace(/^@+/, '')
    .trim();
  const display =
    sanitizeSeoMetaText(input.displayName, 60) ||
    (cleanUsername ? `@${cleanUsername}` : 'Creator');
  const suffix = ' | Iveo';
  const maxNameLen = Math.max(12, 65 - suffix.length);
  return `${truncateAtWord(display, maxNameLen)}${suffix}`;
}

export function buildProfileSeoDescription(input: ProfileSeoMetaInput): string {
  const custom = sanitizeSeoMetaText(input.customSeoDescription, 160);
  if (custom) return custom;

  const cleanBio = sanitizeSeoMetaText(input.bio, 160);
  if (cleanBio) return cleanBio;

  const cleanUsername = String(input.username || '')
    .replace(/^@+/, '')
    .trim();
  const display =
    sanitizeSeoMetaText(input.displayName, 45) ||
    (cleanUsername ? `@${cleanUsername}` : 'this creator');
  const normalizedDisplay = display.replace(/^@+/, '').toLowerCase();
  const handleSuffix =
    cleanUsername && normalizedDisplay !== cleanUsername.toLowerCase()
      ? ` (@${cleanUsername})`
      : '';
  return truncateAtWord(
    `Discover ${display}${handleSuffix} on Iveo. Explore official links, projects, and social profiles.`,
    160
  );
}

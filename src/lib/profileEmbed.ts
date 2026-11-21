export type ProfileEmbedStyle = 'card' | 'minimal' | 'full' | 'badge' | 'spotlight' | 'showcase';
export type ProfileEmbedTheme = 'auto' | 'light' | 'dark' | 'glass';

export interface ProfileEmbedStyleOption {
  id: ProfileEmbedStyle;
  label: string;
  description: string;
  defaultHeight: number;
  maxWidth: string;
}

export const PROFILE_EMBED_STYLES: readonly ProfileEmbedStyleOption[] = [
  {
    id: 'card',
    label: 'Profile Card',
    description: 'Avatar, bio, socials & top links in a compact card',
    defaultHeight: 420,
    maxWidth: '420px',
  },
  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'Elevated hero header, verified badge & featured links',
    defaultHeight: 460,
    maxWidth: '440px',
  },
  {
    id: 'showcase',
    label: 'Showcase',
    description: 'Framed creator bento with bio & 2-column link tiles',
    defaultHeight: 500,
    maxWidth: '460px',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Sleek horizontal banner with bio & visit button',
    defaultHeight: 176,
    maxWidth: '480px',
  },
  {
    id: 'full',
    label: 'Full Page',
    description: 'Complete interactive Iveo page with all blocks',
    defaultHeight: 620,
    maxWidth: '480px',
  },
  {
    id: 'badge',
    label: 'Pill',
    description: 'Compact inline badge for footers & sidebars',
    defaultHeight: 82,
    maxWidth: '340px',
  },
] as const;

export const PROFILE_EMBED_THEMES: readonly { id: ProfileEmbedTheme; label: string }[] = [
  { id: 'auto', label: 'Page Vibe' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'glass', label: 'Glass' },
] as const;

export function normalizeEmbedStyle(raw: string | null | undefined): ProfileEmbedStyle {
  const clean = (raw || '').toLowerCase().trim();
  if (
    clean === 'minimal' ||
    clean === 'full' ||
    clean === 'badge' ||
    clean === 'card' ||
    clean === 'spotlight' ||
    clean === 'showcase'
  ) {
    return clean;
  }
  return 'card';
}

export function normalizeEmbedTheme(raw: string | null | undefined): ProfileEmbedTheme {
  const clean = (raw || '').toLowerCase().trim();
  if (clean === 'auto' || clean === 'light' || clean === 'dark' || clean === 'glass') {
    return clean;
  }
  return 'auto';
}

export function getEmbedStyleMeta(style: ProfileEmbedStyle): ProfileEmbedStyleOption {
  return PROFILE_EMBED_STYLES.find((s) => s.id === style) || PROFILE_EMBED_STYLES[0];
}

export function resolveEmbedOrigin(originOverride?: string): string {
  if (originOverride && /^https?:\/\//i.test(originOverride.trim())) {
    return originOverride.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('localhost') || host.includes('.run.app') || host.includes('127.0.0.1')) {
      return window.location.origin;
    }
  }
  return 'https://iveo.site';
}

export function buildProfileEmbedUrl(
  username: string,
  options?: {
    style?: ProfileEmbedStyle;
    theme?: ProfileEmbedTheme;
    origin?: string;
  }
): string {
  const clean = (username || '').replace(/^[@/]+/, '').toLowerCase().trim();
  const origin = resolveEmbedOrigin(options?.origin);
  if (!clean) return `${origin}/embed`;
  const style = normalizeEmbedStyle(options?.style);
  const theme = normalizeEmbedTheme(options?.theme);
  const params = new URLSearchParams({ style, theme });
  return `${origin}/embed/@${encodeURIComponent(clean)}?${params.toString()}`;
}

export function buildProfileEmbedIframeCode(
  username: string,
  options?: {
    style?: ProfileEmbedStyle;
    theme?: ProfileEmbedTheme;
    origin?: string;
    displayName?: string;
  }
): string {
  const clean = (username || '').replace(/^[@/]+/, '').toLowerCase().trim();
  const style = normalizeEmbedStyle(options?.style);
  const meta = getEmbedStyleMeta(style);
  const src = buildProfileEmbedUrl(clean, options);
  const titleText = `${options?.displayName || `@${clean}`} — Iveo Profile`.replace(/"/g, '&quot;');

  return `<iframe src="${src}" title="${titleText}" width="100%" height="${meta.defaultHeight}" style="border:0;max-width:${meta.maxWidth};width:100%;border-radius:16px;overflow:hidden;background:transparent;" loading="lazy" allowtransparency="true" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

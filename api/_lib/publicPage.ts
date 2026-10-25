import { publicRpc } from './supabase.ts';

export interface PublicPageServerData {
  displayName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  vibeId: string;
  hideFromSearch: boolean;
}

export function isAllowedAvatarHost(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const trimmed = url.trim();
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed.length < 1500000;
  }
  if (trimmed.length > 2048) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function loadPublicPage(
  username: string
): Promise<PublicPageServerData | null> {
  if (!username) return null;

  try {
    const raw = await publicRpc<{
      profile?: {
        username?: string;
        display_name?: string | null;
        bio?: string | null;
        avatar_url?: string | null;
        vibe_id?: string | null;
        hide_from_search?: boolean;
      } | null;
    }>('get_public_page', { p_username: username.toLowerCase() });

    if (!raw || !raw.profile || !raw.profile.username) {
      return null;
    }

    const p = raw.profile;
    const pageUsername = p.username;
    if (!pageUsername) {
      return null;
    }
    const cleanAvatar = isAllowedAvatarHost(p.avatar_url) ? p.avatar_url! : null;

    return {
      username: pageUsername.toLowerCase(),
      displayName: p.display_name?.trim() || null,
      bio: p.bio?.trim() || null,
      avatarUrl: cleanAvatar,
      vibeId: p.vibe_id || 'clean',
      hideFromSearch: Boolean(p.hide_from_search),
    };
  } catch {
    return null;
  }
}

export async function version(page: PublicPageServerData): Promise<string> {
  const parts = [
    page.displayName || '',
    page.bio || '',
    page.avatarUrl || '',
    page.vibeId || '',
  ].join('|');

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(parts);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 8);
  } catch {
    return '1';
  }
}

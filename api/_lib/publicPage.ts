import { publicRpc } from './supabase.ts';
import { dbGetProfile, dbGetRedirectTarget } from './azureSql.ts';
import { firebaseGetProfile } from './firebaseServer.ts';

export interface PublicPageServerData {
  displayName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  vibeId: string;
  hideFromSearch: boolean;
  isPublished?: boolean;
  status?: 'active' | 'private' | 'unpublished' | 'deleted' | 'suspended';
  updatedAt?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
  socials?: Record<string, string>;
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
  // Allow relative URLs for server-hosted avatars (e.g. /api/avatar/username)
  if (trimmed.startsWith('/api/avatar/') || trimmed.startsWith('/')) {
    return true;
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
  const clean = username.toLowerCase().trim();

  // 1. Check Azure SQL / Server database first
  try {
    const dbProf = await dbGetProfile(clean);
    if (dbProf && dbProf.username) {
      const status = dbProf.status || (dbProf.isPublished === false ? 'unpublished' : 'active');
      if (status === 'deleted' || status === 'suspended') {
        return null;
      }
      return {
        username: dbProf.username.toLowerCase(),
        displayName: dbProf.displayName || `@${dbProf.username}`,
        bio: dbProf.bio || null,
        avatarUrl: isAllowedAvatarHost(dbProf.avatarUrl) ? dbProf.avatarUrl : null,
        vibeId: dbProf.vibeId || 'clean',
        hideFromSearch: Boolean(dbProf.hideFromSearch),
        isPublished: dbProf.isPublished !== false,
        status,
        updatedAt: dbProf.updatedAt || null,
        customSeoTitle: dbProf.customSeoTitle || null,
        customSeoDescription: dbProf.customSeoDescription || null,
        socials: (dbProf.socials && typeof dbProf.socials === 'object') ? dbProf.socials : {},
      };
    }
  } catch {}

  // If this handle was explicitly renamed and remains unclaimed locally, preserve redirect precedence
  try {
    const activeRedirect = await dbGetRedirectTarget(clean);
    if (activeRedirect) {
      return null;
    }
  } catch {}

  // 1.5 Check Firebase Cloud database
  try {
    const fbProf = await firebaseGetProfile(clean);
    if (fbProf && fbProf.username) {
      const status = fbProf.status || (fbProf.isPublished === false ? 'unpublished' : 'active');
      if (status === 'deleted' || status === 'suspended') {
        return null;
      }
      return {
        username: fbProf.username.toLowerCase(),
        displayName: fbProf.displayName || `@${fbProf.username}`,
        bio: fbProf.bio || null,
        avatarUrl: isAllowedAvatarHost(fbProf.avatarUrl) ? fbProf.avatarUrl : null,
        vibeId: fbProf.vibeId || 'clean',
        hideFromSearch: Boolean(fbProf.hideFromSearch),
        isPublished: fbProf.isPublished !== false,
        status,
        updatedAt: fbProf.updatedAt || null,
        customSeoTitle: fbProf.customSeoTitle || null,
        customSeoDescription: fbProf.customSeoDescription || null,
        socials: (fbProf.socials && typeof fbProf.socials === 'object') ? fbProf.socials : {},
      };
    }
  } catch {}

  // 2. Check Supabase RPC if configured
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
    }>('get_public_page', { p_username: clean });

    if (raw && raw.profile && typeof raw.profile.username === 'string' && raw.profile.username) {
      const p = raw.profile;
      const cleanAvatar = isAllowedAvatarHost(p.avatar_url) ? p.avatar_url! : null;
      return {
        username: (p.username || clean).toLowerCase(),
        displayName: p.display_name?.trim() || null,
        bio: p.bio?.trim() || null,
        avatarUrl: cleanAvatar,
        vibeId: p.vibe_id || 'clean',
        hideFromSearch: Boolean(p.hide_from_search),
        isPublished: true,
        status: 'active',
        updatedAt: null,
        customSeoTitle: null,
        customSeoDescription: null,
        socials: {},
      };
    }
  } catch {}

  return null;
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

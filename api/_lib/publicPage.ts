import { publicRpc } from './supabase.ts';
import { dbGetProfile, dbGetRedirectTarget } from './azureSql.ts';
import { firebaseGetProfile } from './firebaseServer.ts';
import { isPrivilegedEmailServer } from './usernames.ts';

export interface PublicPageServerData {
  displayName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  vibeId: string;
  buttonShape?: 'square' | 'rounded' | 'pill' | null;
  hideFromSearch: boolean;
  hideFooter?: boolean;
  isPublished?: boolean;
  plan?: 'free' | 'pro';
  isPro?: boolean;
  isVerified?: boolean;
  isOwnerProfile?: boolean;
  status?: 'active' | 'private' | 'unpublished' | 'deleted' | 'suspended';
  updatedAt?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
  socials?: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  whatsappNumber?: string | null;
  background?: any;
  fontSettings?: any;
  buttonColors?: any;
  layoutSettings?: any;
  businessCard?: any;
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
      const isOwnerProfile = isPrivilegedEmailServer(dbProf.primaryEmail);
      const isPro = Boolean(dbProf.plan === 'pro' || isOwnerProfile);
      return {
        username: dbProf.username.toLowerCase(),
        displayName: dbProf.displayName || `@${dbProf.username}`,
        bio: dbProf.bio || null,
        avatarUrl: isAllowedAvatarHost(dbProf.avatarUrl) ? dbProf.avatarUrl : null,
        avatarType: dbProf.avatarType,
        avatarId: dbProf.avatarId || null,
        vibeId: dbProf.vibeId || 'clean',
        buttonShape: dbProf.buttonShape || null,
        hideFromSearch: Boolean(dbProf.hideFromSearch),
        hideFooter: Boolean(dbProf.hideFooter && isPro),
        isPublished: dbProf.isPublished !== false,
        plan: isPro ? 'pro' : 'free',
        isPro,
        isVerified: isPro,
        isOwnerProfile,
        status,
        updatedAt: dbProf.updatedAt || null,
        customSeoTitle: dbProf.customSeoTitle || null,
        customSeoDescription: dbProf.customSeoDescription || null,
        socials: (dbProf.socials && typeof dbProf.socials === 'object') ? dbProf.socials : {},
        socialsPosition: dbProf.socialsPosition || 'top',
        whatsappNumber: dbProf.whatsappNumber || null,
        background: dbProf.background || null,
        fontSettings: dbProf.fontSettings || null,
        buttonColors: dbProf.buttonColors || null,
        layoutSettings: dbProf.layoutSettings || null,
        businessCard: dbProf.businessCard || null,
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
      const isOwnerProfile = isPrivilegedEmailServer(fbProf.primaryEmail);
      const isPro = Boolean(fbProf.plan === 'pro' || isOwnerProfile);
      return {
        username: fbProf.username.toLowerCase(),
        displayName: fbProf.displayName || `@${fbProf.username}`,
        bio: fbProf.bio || null,
        avatarUrl: isAllowedAvatarHost(fbProf.avatarUrl) ? fbProf.avatarUrl : null,
        avatarType: fbProf.avatarType,
        avatarId: fbProf.avatarId || null,
        vibeId: fbProf.vibeId || 'clean',
        buttonShape: fbProf.buttonShape || null,
        hideFromSearch: Boolean(fbProf.hideFromSearch),
        hideFooter: Boolean(fbProf.hideFooter && isPro),
        isPublished: fbProf.isPublished !== false,
        plan: isPro ? 'pro' : 'free',
        isPro,
        isVerified: isPro,
        isOwnerProfile,
        status,
        updatedAt: fbProf.updatedAt || null,
        customSeoTitle: fbProf.customSeoTitle || null,
        customSeoDescription: fbProf.customSeoDescription || null,
        socials: (fbProf.socials && typeof fbProf.socials === 'object') ? fbProf.socials : {},
        socialsPosition: fbProf.socialsPosition || 'top',
        whatsappNumber: fbProf.whatsappNumber || null,
        background: fbProf.background || null,
        fontSettings: fbProf.fontSettings || null,
        buttonColors: fbProf.buttonColors || null,
        layoutSettings: fbProf.layoutSettings || null,
        businessCard: fbProf.businessCard || null,
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
        plan?: string | null;
        socials?: Record<string, string> | null;
      } | null;
    }>('get_public_page', { p_username: clean });

    if (raw && raw.profile && typeof raw.profile.username === 'string' && raw.profile.username) {
      const p = raw.profile;
      const cleanAvatar = isAllowedAvatarHost(p.avatar_url) ? p.avatar_url! : null;
      const isPro = p.plan === 'pro';
      return {
        username: (p.username || clean).toLowerCase(),
        displayName: p.display_name?.trim() || null,
        bio: p.bio?.trim() || null,
        avatarUrl: cleanAvatar,
        vibeId: p.vibe_id || 'clean',
        hideFromSearch: Boolean(p.hide_from_search),
        isPublished: true,
        isPro,
        isVerified: isPro,
        status: 'active',
        updatedAt: null,
        customSeoTitle: null,
        customSeoDescription: null,
        socials: p.socials && typeof p.socials === 'object' ? p.socials : {},
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

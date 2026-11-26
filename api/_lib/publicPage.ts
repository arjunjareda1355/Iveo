import { publicRpc } from './supabase.ts';
import { dbGetProfile, dbGetRedirectTarget } from './azureSql.ts';
import { firebaseGetProfile } from './firebaseServer.ts';
import { isPrivilegedEmailServer } from './usernames.ts';
import { selectFresherProfile } from './profileMerge.ts';
import { resolveEffectivePlan } from '../../src/lib/plan.ts';

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
  status?: 'active' | 'private' | 'unpublished' | 'deleted' | 'deleted_pending' | 'suspended';
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
  appearance?: any;
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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

  // 1. Check Azure SQL / Server database & Firebase Cloud database in parallel, choosing freshest by updatedAt
  try {
    const [dbProf, fbProf] = await Promise.all([
      dbGetProfile(clean).catch(() => null),
      Promise.race([
        firebaseGetProfile(clean).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
      ]),
    ]);

    const selected = selectFresherProfile(dbProf, fbProf);
    let chosen: any = selected.profile;
    if (!dbProf && fbProf) {
      // Preserve active rename redirect precedence if username is unclaimed locally
      const activeRedirect = await dbGetRedirectTarget(clean).catch(() => null);
      if (activeRedirect) {
        return null;
      }
    }

    if (chosen && chosen.username) {
      const status = chosen.status || (chosen.isPublished === false ? 'unpublished' : 'active');
      if (status === 'deleted' || status === 'deleted_pending' || status === 'suspended') {
        return null;
      }
      const isOwnerProfile = isPrivilegedEmailServer(chosen.primaryEmail);
      const effectivePlan = resolveEffectivePlan({
        email: chosen.primaryEmail,
        storedPlan: chosen.plan,
        isProFlag: chosen.isPro,
        createdAt: chosen.createdAt || chosen.claimedAt || null,
        subscription: chosen.subscription || null,
      });
      const isPro = effectivePlan.isPro;
      return {
        username: chosen.username.toLowerCase(),
        displayName: chosen.displayName || `@${chosen.username}`,
        bio: chosen.bio || null,
        avatarUrl: isAllowedAvatarHost(chosen.avatarUrl) ? chosen.avatarUrl : null,
        avatarType: chosen.avatarType,
        avatarId: chosen.avatarId || null,
        vibeId: chosen.vibeId || 'clean',
        buttonShape: chosen.buttonShape || null,
        hideFromSearch: Boolean(chosen.hideFromSearch),
        hideFooter: Boolean(chosen.hideFooter && isPro),
        isPublished: chosen.isPublished !== false,
        plan: isPro ? 'pro' : 'free',
        isPro,
        isVerified: isPro,
        isOwnerProfile,
        status,
        updatedAt: chosen.updatedAt || null,
        customSeoTitle: chosen.customSeoTitle || null,
        customSeoDescription: chosen.customSeoDescription || null,
        socials: (chosen.socials && typeof chosen.socials === 'object') ? chosen.socials : {},
        socialsPosition: chosen.socialsPosition || 'top',
        whatsappNumber: chosen.whatsappNumber || null,
        background: chosen.background || null,
        fontSettings: chosen.fontSettings || null,
        buttonColors: chosen.buttonColors || null,
        layoutSettings: chosen.layoutSettings || null,
        businessCard: chosen.businessCard || null,
        appearance: chosen.appearance || null,
      };
    }
  } catch {}

  // Preserve active rename redirect if no profile resolved
  try {
    const activeRedirect = await dbGetRedirectTarget(clean);
    if (activeRedirect) {
      return null;
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

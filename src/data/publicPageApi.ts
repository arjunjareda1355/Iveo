import { PublicPageData, PublicBlock, SignupConfig } from './types';
import { storagePublicUrl } from './storageApi';
import type { VibeId } from '../lib/vibes';
import { isAllowedAvatarUrl } from '../lib/avatar';
import { isOwnerEmail, resolveEffectivePlan } from '../lib/plan';
import { apiFetch } from '../lib/apiFetch';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function mapFbBlocks(rawBlocks: any[]): PublicBlock[] {
  const now = new Date();
  return rawBlocks
    .filter((b) => {
      if (!b || b.isActive === false || b.isArchived) return false;
      if (b.startAt && new Date(b.startAt) > now) return false;
      if (b.endAt && new Date(b.endAt) <= now) return false;
      return true;
    })
    .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0))
    .map((b) => ({
      id: String(b.id),
      kind: b.kind || 'link',
      title: String(b.title || ''),
      url: b.isProtected ? null : (b.url ? String(b.url) : null),
      icon: b.icon || null,
      thumbnailPath: b.thumbnailPath || null,
      thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
      layout: b.layout || 'classic',
      embedProvider: b.embedProvider || null,
      embedMeta: b.embedMeta || null,
      isProtected: Boolean(b.isProtected),
      signup: b.signup || null,
      tipJar: b.tipJar || null,
      coffee: b.coffee || null,
      faq: b.faq || null,
      vcard: b.vcard || null,
      animation: b.animation || null,
      badge: b.badge || null,
      youtube: b.youtube || null,
      product: b.product || null,
      booking: b.booking || null,
      countdown: b.countdown || null,
      promo: b.promo || null,
      location: b.location || null,
      download: b.download || null,
      bluesky: b.bluesky || null,
    }));
}

export async function fetchPublicPage(username: string): Promise<PublicPageData | null> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;

  let serverTerminalNotFound = false;

  // 1. Unified server endpoint (Azure SQL Database / Server store / Firebase Server)
  try {
    const ts = Date.now();
    let res = await apiFetch(`/api/public-page?u=${encodeURIComponent(clean)}&_t=${ts}`, {
      cache: 'no-cache',
      silent: true,
      headers: { 'Cache-Control': 'no-cache' },
    });

    // If on a user subdomain and same-origin /api/public-page is 404, fallback to apex iveo.site
    if (
      !res.ok &&
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('.iveo.site') &&
      window.location.hostname !== 'iveo.site'
    ) {
      try {
        res = await fetch(`https://iveo.site/api/public-page?u=${encodeURIComponent(clean)}&_t=${ts}`, {
          cache: 'no-cache',
        });
      } catch {}
    }

    if (res.status === 404) {
      try {
        const errBody = await res.json();
        const st = errBody?.status;
        if (
          errBody?.confirmed === true ||
          st === 'deleted' ||
          st === 'deleted_pending' ||
          st === 'suspended' ||
          st === 'private' ||
          st === 'unpublished'
        ) {
          serverTerminalNotFound = true;
        }
      } catch {}
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.redirectTo && typeof data.redirectTo === 'string') {
        return { profile: null, links: [], redirectTo: data.redirectTo };
      }
      if (data && data.profile) {
        const mappedResult: PublicPageData = {
          profile: {
            username: data.profile.username || clean,
            displayName: data.profile.displayName || data.profile.username || clean,
            bio: data.profile.bio || '',
            avatarUrl: isAllowedAvatarUrl(data.profile.avatarUrl) ? data.profile.avatarUrl : null,
            avatarType: data.profile.avatarType,
            avatarId: data.profile.avatarId,
            vibeId: (data.profile.vibeId as VibeId) || 'clean',
            plan: data.profile.isPro || data.profile.plan === 'pro' ? 'pro' : 'free',
            isPro: Boolean(data.profile.isVerified ?? data.profile.isPro ?? data.profile.plan === 'pro'),
            isVerified: Boolean(data.profile.isVerified ?? data.profile.isPro ?? data.profile.plan === 'pro'),
            isOwnerProfile: Boolean(data.profile.isOwnerProfile),
            buttonShape: data.profile.buttonShape || null,
            socials: data.profile.socials || {},
            socialsPosition: data.profile.socialsPosition || 'top',
            hideFromSearch: Boolean(data.profile.hideFromSearch),
            hideFooter: Boolean(data.profile.hideFooter),
            background: data.profile.background || null,
            googleAnalyticsId: data.profile.googleAnalyticsId || null,
            metaPixelId: data.profile.metaPixelId || null,
            whatsappNumber: data.profile.whatsappNumber || null,
            customSeoTitle: data.profile.customSeoTitle || null,
            customSeoDescription: data.profile.customSeoDescription || null,
            fontSettings: data.profile.fontSettings || null,
            buttonColors: data.profile.buttonColors || null,
            layoutSettings: data.profile.layoutSettings || null,
            businessCard: data.profile.businessCard || null,
            appearance: data.profile.appearance || null,
            updatedAt: data.profile.updatedAt || null,
          },
          links: (Array.isArray(data.links) ? data.links : []).map((b: any) => ({
            id: String(b.id),
            kind: b.kind,
            title: String(b.title || ''),
            url: b.isProtected ? null : (b.url ? String(b.url) : null),
            icon: b.icon || null,
            thumbnailPath: b.thumbnailPath || null,
            thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
            layout: b.layout || 'classic',
            embedProvider: b.embedProvider || null,
            embedMeta: b.embedMeta || null,
            isProtected: Boolean(b.isProtected),
            signup: b.signup || null,
            tipJar: b.tipJar || null,
            coffee: b.coffee || null,
            faq: b.faq || null,
            vcard: b.vcard || null,
            animation: b.animation || null,
            badge: b.badge || null,
            youtube: b.youtube || null,
            product: b.product || null,
            booking: b.booking || null,
            countdown: b.countdown || null,
            promo: b.promo || null,
            location: b.location || null,
            download: b.download || null,
            bluesky: b.bluesky || null,
          })),
        };

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`iveo_profile_${clean}`, JSON.stringify(mappedResult.profile));
            localStorage.setItem(`iveo_public_blocks_${clean}`, JSON.stringify(mappedResult.links));
          } catch {}
        }

        return mappedResult;
      }
    }
  } catch {
    // Continue to Firebase / local fallback on network failure
  }

  if (serverTerminalNotFound) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`iveo_profile_${clean}`);
        localStorage.removeItem(`iveo_public_blocks_${clean}`);
        localStorage.removeItem(`iveo_blocks_${clean}`);
      } catch {}
    }
    return null;
  }

  // 2. Direct Firebase client lookup fallback (handles cross-instance propagation or missing local disk cache)
  try {
    const { doc, getDoc, getDocs, collection, query, where } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');

    let fbData: any = null;
    let blockOwnerKey = clean;

    const userDoc = await getDoc(doc(db, 'users', clean));
    if (
      userDoc.exists() &&
      userDoc.data()?.status !== 'deleted' &&
      userDoc.data()?.status !== 'deleted_pending'
    ) {
      fbData = userDoc.data();
    }

    if (!fbData) {
      const claimDoc = await getDoc(doc(db, 'claims', clean));
      if (
        claimDoc.exists() &&
        claimDoc.data()?.status !== 'deleted' &&
        claimDoc.data()?.status !== 'deleted_pending' &&
        claimDoc.data()?.userId
      ) {
        const claimUid = String(claimDoc.data()!.userId);
        const uidDoc = await getDoc(doc(db, 'users', claimUid));
        if (
          uidDoc.exists() &&
          uidDoc.data()?.status !== 'deleted' &&
          uidDoc.data()?.status !== 'deleted_pending'
        ) {
          fbData = uidDoc.data();
          blockOwnerKey = claimUid;
        }
      }
    }

    if (!fbData) {
      const qSnap = await getDocs(query(collection(db, 'users'), where('username', '==', clean)));
      for (const d of qSnap.docs) {
        const dData = d.data();
        if (dData?.status !== 'deleted' && dData?.status !== 'deleted_pending') {
          fbData = dData;
          blockOwnerKey = d.id;
          break;
        }
      }
    }

    if (fbData) {
      const st = fbData.status || (fbData.isPublished === false ? 'unpublished' : 'active');
      if (
        st === 'deleted' ||
        st === 'deleted_pending' ||
        st === 'suspended' ||
        st === 'private' ||
        st === 'unpublished'
      ) {
        return null;
      }

      let rawBlocks: any[] = [];
      const cleanBlocksSnap = await getDocs(collection(db, 'users', clean, 'blocks'));
      if (!cleanBlocksSnap.empty) {
        rawBlocks = cleanBlocksSnap.docs.map((d) => d.data());
      } else if (fbData.blocksInitialized !== true) {
        const altKey = blockOwnerKey !== clean ? blockOwnerKey : (fbData.userId && fbData.userId !== clean ? String(fbData.userId) : '');
        if (altKey && altKey !== 'owner') {
          const uidBlocksSnap = await getDocs(collection(db, 'users', altKey, 'blocks'));
          rawBlocks = uidBlocksSnap.docs.map((d) => d.data());
        }
      }

      const resolvedPlan = resolveEffectivePlan({
        email: fbData.primaryEmail,
        storedPlan: fbData.plan,
        isProFlag: fbData.isPro,
        createdAt: fbData.createdAt || fbData.claimedAt || null,
        subscription: fbData.subscription || null,
      });

      const rawAvatar = isAllowedAvatarUrl(fbData.avatarUrl) ? fbData.avatarUrl : null;
      const resolvedAvatarUrl =
        rawAvatar || (fbData.avatarData ? `/api/avatar/${encodeURIComponent(clean)}` : null);

      const mappedFb: PublicPageData = {
        profile: {
          username: String(fbData.username || clean).replace(/^@+/, '').toLowerCase().trim(),
          displayName: fbData.displayName || fbData.username || clean,
          bio: fbData.bio || '',
          avatarUrl: resolvedAvatarUrl,
          avatarType: fbData.avatarType || (fbData.avatarId ? 'default' : (resolvedAvatarUrl ? 'uploaded' : 'default')),
          avatarId: fbData.avatarId || null,
          vibeId: (fbData.vibeId as VibeId) || 'clean',
          plan: resolvedPlan.plan,
          isPro: resolvedPlan.isPro,
          isVerified: resolvedPlan.isPro,
          isOwnerProfile: isOwnerEmail(fbData.primaryEmail),
          buttonShape: fbData.buttonShape || null,
          socials: fbData.socials || {},
          socialsPosition: fbData.socialsPosition || 'top',
          hideFromSearch: Boolean(fbData.hideFromSearch),
          hideFooter: Boolean(fbData.hideFooter),
          background: fbData.background || null,
          googleAnalyticsId: fbData.googleAnalyticsId || null,
          metaPixelId: fbData.metaPixelId || null,
          whatsappNumber: fbData.whatsappNumber || null,
          customSeoTitle: fbData.customSeoTitle || null,
          customSeoDescription: fbData.customSeoDescription || null,
          fontSettings: fbData.fontSettings || null,
          buttonColors: fbData.buttonColors || null,
          layoutSettings: fbData.layoutSettings || null,
          businessCard: fbData.businessCard || null,
          appearance: fbData.appearance || null,
          updatedAt: fbData.updatedAt || null,
        },
        links: mapFbBlocks(rawBlocks),
      };

      return mappedFb;
    }

    // Check rename redirect in Firestore if profile not directly found
    const redirectSnap = await getDoc(doc(db, 'redirects', clean));
    if (redirectSnap.exists()) {
      const target = String(redirectSnap.data()?.to || '').replace(/^@+/, '').toLowerCase().trim();
      if (target && target !== clean) {
        return { profile: null, links: [], redirectTo: target };
      }
    }
  } catch {}

  // 3. Local client cache fallback when server/Firebase are unreachable
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`iveo_profile_${clean}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedBlocksRaw =
          localStorage.getItem(`iveo_public_blocks_${clean}`) ||
          localStorage.getItem(`iveo_blocks_${clean}`);
        const cachedBlocks = cachedBlocksRaw ? JSON.parse(cachedBlocksRaw) : [];
        return {
          profile: {
            username: clean,
            displayName: parsed.displayName || clean,
            bio: parsed.bio || '',
            avatarUrl: isAllowedAvatarUrl(parsed.avatarUrl) ? parsed.avatarUrl : null,
            avatarType: parsed.avatarType,
            avatarId: parsed.avatarId,
            vibeId: (parsed.vibeId as VibeId) || 'clean',
            plan: parsed.isPro || parsed.plan === 'pro' ? 'pro' : 'free',
            isPro: Boolean(parsed.isVerified ?? parsed.isPro ?? parsed.plan === 'pro'),
            isVerified: Boolean(parsed.isVerified ?? parsed.isPro ?? parsed.plan === 'pro'),
            isOwnerProfile: Boolean(parsed.isOwnerProfile),
            buttonShape: parsed.buttonShape || null,
            socials: parsed.socials || {},
            socialsPosition: parsed.socialsPosition || 'top',
            hideFromSearch: Boolean(parsed.hideFromSearch),
            hideFooter: Boolean(parsed.hideFooter),
            background: parsed.background || null,
            googleAnalyticsId: parsed.googleAnalyticsId || null,
            metaPixelId: parsed.metaPixelId || null,
            whatsappNumber: parsed.whatsappNumber || null,
            customSeoTitle: parsed.customSeoTitle || null,
            customSeoDescription: parsed.customSeoDescription || null,
            fontSettings: parsed.fontSettings || null,
            buttonColors: parsed.buttonColors || null,
            layoutSettings: parsed.layoutSettings || null,
            businessCard: parsed.businessCard || null,
            appearance: parsed.appearance || null,
            updatedAt: parsed.updatedAt || null,
          },
          links: Array.isArray(cachedBlocks) ? cachedBlocks : [],
        };
      }
    } catch {}
  }

  if (rawSupabaseUrl) {
    try {
      const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/get_public_page`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_username: clean }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      if (!data || !data.profile) return null;

      // Validate & map blocks safely (Section 5.1)
      const mappedLinks: PublicBlock[] = (data.links || [])
        .map((row: any): PublicBlock | null => {
          if (!row || typeof row !== 'object') return null;
          const kind = ['link', 'header', 'divider', 'embed', 'signup'].includes(row.kind)
            ? row.kind
            : null;
          if (!kind) return null;

          const layout = row.layout === 'featured' ? 'featured' : 'classic';
          const embedProvider = [
            'youtube',
            'spotify',
            'soundcloud',
            'discord',
            'github',
            'linkedin',
            'x',
            'instagram',
            'facebook',
            'threads',
          ].includes(row.embed_provider)
            ? row.embed_provider
            : null;

          // If kind is embed, provider must be recognized
          if (kind === 'embed' && !embedProvider) {
            return null;
          }

          let signupConfig: SignupConfig | null = null;
          if (kind === 'signup') {
            const s = row.signup || row.signup_config;
            if (s && typeof s === 'object') {
              const collectValid = ['email', 'phone', 'both'].includes(s.collect);
              const buttonValid = typeof s.button === 'string' && s.button.length >= 1 && s.button.length <= 20;
              const consentValid = typeof s.consent === 'string' && s.consent.length >= 1 && s.consent.length <= 200;
              const descValid = s.description === null || s.description === undefined || (typeof s.description === 'string' && s.description.length <= 120);

              if (collectValid && buttonValid && consentValid && descValid) {
                signupConfig = {
                  collect: s.collect,
                  button: s.button,
                  consent: s.consent,
                  description: typeof s.description === 'string' ? s.description : null,
                  heading: typeof s.heading === 'string' ? s.heading : undefined,
                  style: ['classic', 'compact', 'minimal', 'spotlight'].includes(s.style) ? s.style : 'classic',
                };
              }
            }
            if (!signupConfig) {
              return null;
            }
          }

          const isProtected = Boolean(row.is_protected);

          return {
            id: String(row.id),
            kind,
            title: String(row.title || ''),
            // The real address of a protected link must NEVER reach visitor's browser before unlock
            url: isProtected ? null : (row.url ? String(row.url) : null),
            icon: row.icon ? String(row.icon) : null,
            thumbnailPath: row.thumbnail_path ? String(row.thumbnail_path) : null,
            thumbnailUrl: storagePublicUrl(row.thumbnail_path),
            layout,
            embedProvider,
            embedMeta: row.embed_meta || null,
            isProtected,
            signup: signupConfig,
          };
        })
        .filter((b: PublicBlock | null): b is PublicBlock => b !== null);

      return {
        profile: {
          username: data.profile.username,
          displayName: data.profile.display_name || data.profile.username,
          bio: data.profile.bio || '',
          avatarUrl: isAllowedAvatarUrl(data.profile.avatar_url)
            ? data.profile.avatar_url
            : null,
          vibeId: (data.profile.vibe_id as VibeId) || 'clean',
          buttonShape: data.profile.button_shape || null,
          socials: data.profile.socials || {},
          hideFromSearch: data.profile.hide_from_search ?? false,
          hideFooter: data.profile.hide_footer ?? false,
        },
        links: mappedLinks,
      };
    } catch {
      // Fall through
    }
  }

  return null;
}

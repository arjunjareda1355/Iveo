import { PublicPageData, PublicBlock, SignupConfig } from './types';
import { storagePublicUrl } from './storageApi';
import type { VibeId } from '../lib/vibes';
import { parseEmbedUrl } from '../lib/embeds';
import { isAllowedAvatarUrl } from '../lib/avatar';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export async function fetchPublicPage(username: string): Promise<PublicPageData | null> {
  const clean = username.toLowerCase().trim();
  if (!clean) return null;

  let serverRespondedNotFound = false;

  // 1. Unified server endpoint (Azure SQL Database / Server store)
  // Ensures published pages are accessible across any browser, device, or crawler with immediate real-time sync
  try {
    const ts = Date.now();
    let res = await fetch(`/api/public-page?u=${encodeURIComponent(clean)}&_t=${ts}`, {
      cache: 'no-cache',
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
      serverRespondedNotFound = true;
    }

    if (res.ok) {
      const data = await res.json();
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
          })),
        };

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`iveo_profile_${clean}`, JSON.stringify(mappedResult.profile));
            localStorage.setItem(`iveo_blocks_${clean}`, JSON.stringify(mappedResult.links));
          } catch {}
        }

        return mappedResult;
      }
    }
  } catch {
    // Continue to Supabase / local fallback on network failure
  }

  if (serverRespondedNotFound) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`iveo_profile_${clean}`);
        localStorage.removeItem(`iveo_blocks_${clean}`);
      } catch {}
    }
    return null;
  }

  // 2. Check local client cache ONLY if server endpoint was unreachable
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`iveo_profile_${clean}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedBlocksRaw = localStorage.getItem(`iveo_blocks_${clean}`);
        const cachedBlocks = cachedBlocksRaw ? JSON.parse(cachedBlocksRaw) : [];
        return {
          profile: {
            username: clean,
            displayName: parsed.displayName || clean,
            bio: parsed.bio || '',
            avatarUrl: isAllowedAvatarUrl(parsed.avatarUrl) ? parsed.avatarUrl : null,
            vibeId: (parsed.vibeId as VibeId) || 'clean',
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
          },
          links: Array.isArray(cachedBlocks) ? cachedBlocks : [],
        };
      }
    } catch {}
  }

  // 3. Direct Firebase client lookup fallback
  try {
    const { doc, getDoc, getDocs, collection } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    const userDoc = await getDoc(doc(db, 'users', clean));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const blocksSnap = await getDocs(collection(db, 'users', clean, 'blocks'));
      const links = blocksSnap.docs.map((d) => d.data() as any);
      return {
        profile: {
          username: data.username || clean,
          displayName: data.displayName || data.username || clean,
          bio: data.bio || '',
          avatarUrl: isAllowedAvatarUrl(data.avatarUrl) ? data.avatarUrl : null,
          vibeId: (data.vibeId as VibeId) || 'clean',
          buttonShape: data.buttonShape || null,
          socials: data.socials || {},
          socialsPosition: data.socialsPosition || 'top',
          hideFromSearch: Boolean(data.hideFromSearch),
          hideFooter: Boolean(data.hideFooter),
          background: data.background || null,
          googleAnalyticsId: data.googleAnalyticsId || null,
          metaPixelId: data.metaPixelId || null,
          whatsappNumber: data.whatsappNumber || null,
          customSeoTitle: data.customSeoTitle || null,
          customSeoDescription: data.customSeoDescription || null,
          fontSettings: data.fontSettings || null,
          buttonColors: data.buttonColors || null,
          layoutSettings: data.layoutSettings || null,
          businessCard: data.businessCard || null,
        },
        links: links.map((b) => ({
          id: String(b.id),
          kind: b.kind || 'link',
          title: String(b.title || ''),
          url: b.isProtected ? null : (b.url ? String(b.url) : null),
          icon: b.icon || null,
          thumbnailPath: b.thumbnailPath || null,
          thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
          layout: b.layout || 'classic',
          embedProvider: b.embedProvider || null,
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
        })),
      };
    }
  } catch {}

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
          const embedProvider = ['youtube', 'spotify', 'soundcloud'].includes(
            row.embed_provider
          )
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

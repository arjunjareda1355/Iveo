import { PublicPageData, PublicBlock } from './types';
import { storagePublicUrl } from './storageApi';
import { VIBES, VibeId } from '../lib/vibes';
import { parseEmbedUrl } from '../lib/embeds';
import { isAllowedAvatarUrl } from '../lib/avatar';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export async function fetchPublicPage(username: string): Promise<PublicPageData | null> {
  const clean = username.toLowerCase().trim();

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
          const kind = ['link', 'header', 'divider', 'embed'].includes(row.kind)
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

          return {
            id: String(row.id),
            kind,
            title: String(row.title || ''),
            url: row.url ? String(row.url) : null,
            icon: row.icon ? String(row.icon) : null,
            thumbnailPath: row.thumbnail_path ? String(row.thumbnail_path) : null,
            thumbnailUrl: storagePublicUrl(row.thumbnail_path),
            layout,
            embedProvider,
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
      // Fall through to local fallback
    }
  }

  // Local fallback for development / test accounts
  try {
    const rawBlocks =
      localStorage.getItem(`iveo_blocks_${clean}`) ||
      localStorage.getItem(`ivio_blocks_${clean}`);
    if (rawBlocks) {
      const allBlocks = JSON.parse(rawBlocks);
      const now = new Date();

      // Check if user has pro in localStorage or default
      const userMeta =
        localStorage.getItem(`iveo_profile_${clean}`) ||
        localStorage.getItem(`ivio_profile_${clean}`);
      const parsedMeta = userMeta ? JSON.parse(userMeta) : {};
      const isPro = parsedMeta.plan === 'pro';

      const filteredLinks: PublicBlock[] = allBlocks
        .filter((b: any) => {
          if (!b.isActive || b.isArchived) return false;
          if (b.startAt && new Date(b.startAt) > now) return false;
          if (b.endAt && new Date(b.endAt) <= now) return false;
          if (!isPro && (b.kind === 'embed' || b.startAt || b.endAt)) return false;
          return true;
        })
        .map((b: any) => ({
          id: b.id,
          kind: b.kind,
          title: b.title || '',
          url: b.url || null,
          icon: b.icon || null,
          thumbnailPath: b.thumbnailPath || null,
          thumbnailUrl: storagePublicUrl(b.thumbnailPath),
          layout: b.layout || 'classic',
          embedProvider: b.embedProvider || null,
        }));

      return {
        profile: {
          username: clean,
          displayName: parsedMeta.displayName || clean,
          bio: parsedMeta.bio || '',
          avatarUrl: parsedMeta.avatarUrl || null,
          vibeId: parsedMeta.vibeId || 'clean',
          buttonShape: parsedMeta.buttonShape || null,
          socials: parsedMeta.socials || {},
          hideFromSearch: false,
          hideFooter:
            isPro &&
            (parsedMeta.hideIveoFooter === true ||
              parsedMeta.hideIvioFooter === true),
        },
        links: filteredLinks,
      };
    }
  } catch {}

  // If username matches default demo persona like maya
  const personaVibe = VIBES.find((v) => v.persona.handle === clean);
  if (personaVibe) {
    return {
      profile: {
        username: clean,
        displayName: personaVibe.persona.name,
        bio: personaVibe.persona.bio,
        avatarUrl: null,
        vibeId: personaVibe.id,
        buttonShape: null,
        socials: {},
        hideFromSearch: false,
        hideFooter: false,
      },
      links: personaVibe.persona.links.map((l, i) => ({
        id: `persona-${i}`,
        kind: 'link',
        title: l,
        url: 'https://iveo.site',
        icon: null,
        thumbnailPath: null,
        thumbnailUrl: null,
        layout: 'classic',
        embedProvider: null,
      })),
    };
  }

  return null;
}

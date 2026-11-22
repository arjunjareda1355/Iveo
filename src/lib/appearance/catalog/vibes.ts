/**
 * Section 10.1 Vibes Catalogue (24) across 6 Collections + Section 10.8 Legacy Mapping.
 */
import type {
  Appearance,
  AvatarFrame,
  ButtonShapeV2,
  ButtonSurface,
  HeaderLayoutV2,
  Hex,
  SpacingV2,
  WidthV2,
} from '../types.ts';
import { findCatalogBackground } from './backgrounds.ts';

export type VibeCollection =
  | 'Light & Calm'
  | 'Dark & Bold'
  | 'Color & Energy'
  | 'Editorial & Luxe'
  | 'Futuristic'
  | 'Organic';

export const VIBE_COLLECTIONS: readonly VibeCollection[] = [
  'Light & Calm',
  'Dark & Bold',
  'Color & Energy',
  'Editorial & Luxe',
  'Futuristic',
  'Organic',
] as const;

export interface CatalogVibe {
  id: string;
  name: string;
  collection: VibeCollection;
  tier: 'free' | 'pro';
  tagline: string;
  moods: readonly string[];
  backgroundId: string;
  page: {
    text: Hex;
    muted: Hex;
    accent: Hex;
  };
  button: {
    fill: Hex | 'transparent' | `rgba(${number},${number},${number},${number})`;
    text: Hex;
    border: Hex | 'transparent' | `rgba(${number},${number},${number},${number})`;
    borderWidth: 0 | 1 | 2 | 3 | 4;
    shape: ButtonShapeV2;
    radius: number;
    surface: ButtonSurface;
  };
  fonts: {
    name: { family: string; weight: number };
    bio: { family: string; weight: number };
    button: { family: string; weight: number };
  };
  layout: {
    header: HeaderLayoutV2;
    avatarFrame: AvatarFrame;
    spacing: SpacingV2;
    width: WidthV2;
  };
}

export const CATALOG_VIBES: readonly CatalogVibe[] = [
  // ── 1. LIGHT & CALM ─────────────────────────────────────────────────────────
  {
    id: 'porcelain',
    name: 'Porcelain',
    collection: 'Light & Calm',
    tier: 'free',
    tagline: 'Quiet, bright and sharp.',
    moods: ['modern', 'calm', 'neutral'],
    backgroundId: 'bg-studio-white',
    page: { text: '#121212', muted: '#5C5C57', accent: '#1F6FEB' },
    button: {
      fill: '#121212',
      text: '#FFFFFF',
      border: '#121212',
      borderWidth: 0,
      shape: 'rounded',
      radius: 14,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Plus Jakarta Sans', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'oat-milk',
    name: 'Oat Milk',
    collection: 'Light & Calm',
    tier: 'pro',
    tagline: 'Warm paper, soft serif voice.',
    moods: ['warm', 'editorial', 'soft'],
    backgroundId: 'bg-washi-paper',
    page: { text: '#2B2117', muted: '#6A5B4A', accent: '#A5541B' },
    button: {
      fill: '#2B2117',
      text: '#F5F0E6',
      border: '#2B2117',
      borderWidth: 0,
      shape: 'pill',
      radius: 9999,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Fraunces', weight: 600 },
      bio: { family: 'Lora', weight: 400 },
      button: { family: 'DM Sans', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'squircle', spacing: 'airy', width: 'focused' },
  },
  {
    id: 'dawn-mist',
    name: 'Dawn Mist',
    collection: 'Light & Calm',
    tier: 'free',
    tagline: 'Fresh morning air.',
    moods: ['modern', 'friendly', 'calm'],
    backgroundId: 'bg-sky-linen',
    page: { text: '#0F1B2D', muted: '#4B5D75', accent: '#3B6FD8' },
    button: {
      fill: '#FFFFFF',
      text: '#0F1B2D',
      border: '#3B6FD8',
      borderWidth: 1,
      shape: 'rounded',
      radius: 14,
      surface: 'outline-hairline',
    },
    fonts: {
      name: { family: 'DM Sans', weight: 700 },
      bio: { family: 'DM Sans', weight: 400 },
      button: { family: 'DM Sans', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'celadon',
    name: 'Celadon',
    collection: 'Light & Calm',
    tier: 'free',
    tagline: 'Soft green calm.',
    moods: ['calm', 'organic', 'modern'],
    backgroundId: 'bg-mint-tint',
    page: { text: '#14261C', muted: '#43594B', accent: '#2E7D57' },
    button: {
      fill: '#1E4D36',
      text: '#FFFFFF',
      border: '#1E4D36',
      borderWidth: 0,
      shape: 'pill',
      radius: 9999,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Plus Jakarta Sans', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    collection: 'Light & Calm',
    tier: 'pro',
    tagline: 'Blush tones, editorial warmth.',
    moods: ['warm', 'editorial', 'luxury'],
    backgroundId: 'bg-peach-fizz',
    page: { text: '#3A1620', muted: '#6B3A47', accent: '#D1456B' },
    button: {
      fill: '#3A1620',
      text: '#FFE9EF',
      border: '#3A1620',
      borderWidth: 0,
      shape: 'rounded',
      radius: 18,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Playfair Display', weight: 700 },
      bio: { family: 'Lora', weight: 400 },
      button: { family: 'DM Sans', weight: 500 },
    },
    layout: { header: 'editorial', avatarFrame: 'rounded', spacing: 'balanced', width: 'focused' },
  },

  // ── 2. DARK & BOLD ──────────────────────────────────────────────────────────
  {
    id: 'obsidian',
    name: 'Obsidian',
    collection: 'Dark & Bold',
    tier: 'free',
    tagline: 'Pure black, pure focus.',
    moods: ['modern', 'bold', 'minimal'],
    backgroundId: 'bg-ink-black',
    page: { text: '#F5F5F5', muted: '#A0A0A6', accent: '#FFFFFF' },
    button: {
      fill: '#F5F5F5',
      text: '#0A0A0B',
      border: '#F5F5F5',
      borderWidth: 0,
      shape: 'rounded',
      radius: 12,
      surface: 'solid',
    },
    fonts: {
      name: { family: 'Inter', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    collection: 'Dark & Bold',
    tier: 'free',
    tagline: 'Night-sky blues.',
    moods: ['techy', 'modern', 'bold'],
    backgroundId: 'bg-film-grain-dark',
    page: { text: '#E8ECF3', muted: '#9AA5B8', accent: '#7C9CFF' },
    button: {
      fill: '#1B2230',
      text: '#E8ECF3',
      border: '#6B7FA6',
      borderWidth: 1,
      shape: 'rounded',
      radius: 14,
      surface: 'soft-tint',
    },
    fonts: {
      name: { family: 'Space Grotesk', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Space Grotesk', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'squircle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'onyx-gold',
    name: 'Onyx Gold',
    collection: 'Dark & Bold',
    tier: 'pro',
    tagline: 'Black and gold, quietly rich.',
    moods: ['luxury', 'classic', 'editorial'],
    backgroundId: 'bg-ink-black',
    page: { text: '#F3EBDD', muted: '#A89F8D', accent: '#D4AF37' },
    button: {
      fill: '#D4AF37',
      text: '#0A0A09',
      border: '#D4AF37',
      borderWidth: 1,
      shape: 'pill',
      radius: 9999,
      surface: 'metallic',
    },
    fonts: {
      name: { family: 'Cormorant Garamond', weight: 700 },
      bio: { family: 'Lora', weight: 400 },
      button: { family: 'DM Sans', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'double-ring', spacing: 'airy', width: 'focused' },
  },
  {
    id: 'velvet-noir',
    name: 'Velvet Noir',
    collection: 'Dark & Bold',
    tier: 'pro',
    tagline: 'Ruby spotlight on black.',
    moods: ['luxury', 'fashion', 'bold'],
    backgroundId: 'bg-mesh-ember',
    page: { text: '#F8E9EC', muted: '#DDB8C2', accent: '#FB7185' },
    button: {
      fill: '#FB7185',
      text: '#12060A',
      border: '#FB7185',
      borderWidth: 0,
      shape: 'rounded',
      radius: 14,
      surface: 'solid',
    },
    fonts: {
      name: { family: 'Bodoni Moda', weight: 700 },
      bio: { family: 'Newsreader', weight: 400 },
      button: { family: 'Inter', weight: 600 },
    },
    layout: { header: 'editorial', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'graphite-mono',
    name: 'Graphite Mono',
    collection: 'Dark & Bold',
    tier: 'free',
    tagline: 'Terminal-clean, all outline.',
    moods: ['techy', 'developer', 'minimal'],
    backgroundId: 'bg-graphite',
    page: { text: '#EDEDED', muted: '#A3A3A3', accent: '#EDEDED' },
    button: {
      fill: 'transparent',
      text: '#EDEDED',
      border: '#EDEDED',
      borderWidth: 1,
      shape: 'square',
      radius: 0,
      surface: 'outline-hairline',
    },
    fonts: {
      name: { family: 'JetBrains Mono', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'JetBrains Mono', weight: 500 },
    },
    layout: { header: 'editorial', avatarFrame: 'rounded', spacing: 'compact', width: 'standard' },
  },

  // ── 3. COLOR & ENERGY ───────────────────────────────────────────────────────
  {
    id: 'tangerine-pop',
    name: 'Tangerine Pop',
    collection: 'Color & Energy',
    tier: 'free',
    tagline: 'Loud orange, hard shadows.',
    moods: ['bold', 'playful', 'brutalist'],
    backgroundId: 'bg-tangerine',
    page: { text: '#111111', muted: '#2B1308', accent: '#111111' },
    button: {
      fill: '#111111',
      text: '#FF6B2C',
      border: '#111111',
      borderWidth: 2,
      shape: 'square',
      radius: 0,
      surface: 'offset-3d',
    },
    fonts: {
      name: { family: 'Space Grotesk', weight: 700 },
      bio: { family: 'Inter', weight: 500 },
      button: { family: 'Space Grotesk', weight: 700 },
    },
    layout: { header: 'centered', avatarFrame: 'sticker', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    collection: 'Color & Energy',
    tier: 'pro',
    tagline: 'Electric violet energy.',
    moods: ['futuristic', 'bold', 'techy'],
    backgroundId: 'bg-violet-storm',
    page: { text: '#F4EEFF', muted: '#B7A6E0', accent: '#A78BFA' },
    button: {
      fill: '#F4EEFF',
      text: '#2A1065',
      border: '#A78BFA',
      borderWidth: 1,
      shape: 'pill',
      radius: 9999,
      surface: 'gradient-flow',
    },
    fonts: {
      name: { family: 'Unbounded', weight: 600 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'gradient-ring', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'aqua-pulse',
    name: 'Aqua Pulse',
    collection: 'Color & Energy',
    tier: 'pro',
    tagline: 'Cool cyan rush.',
    moods: ['modern', 'bold', 'friendly'],
    backgroundId: 'bg-aqua-rush',
    page: { text: '#04201E', muted: '#0B3B38', accent: '#04201E' },
    button: {
      fill: '#04201E',
      text: '#E8FFFD',
      border: '#04201E',
      borderWidth: 0,
      shape: 'pill',
      radius: 9999,
      surface: 'solid',
    },
    fonts: {
      name: { family: 'Outfit', weight: 700 },
      bio: { family: 'Outfit', weight: 400 },
      button: { family: 'Outfit', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    collection: 'Color & Energy',
    tier: 'free',
    tagline: 'Sweet pink and sky.',
    moods: ['playful', 'friendly', 'modern'],
    backgroundId: 'bg-cotton-candy',
    page: { text: '#3B0A24', muted: '#6A3550', accent: '#E11D74' },
    button: {
      fill: '#3B0A24',
      text: '#FFD1E8',
      border: '#3B0A24',
      borderWidth: 0,
      shape: 'pill',
      radius: 9999,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'DM Sans', weight: 700 },
      bio: { family: 'DM Sans', weight: 400 },
      button: { family: 'DM Sans', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'airy', width: 'focused' },
  },

  // ── 4. EDITORIAL & LUXE ─────────────────────────────────────────────────────
  {
    id: 'ivory-press',
    name: 'Ivory Press',
    collection: 'Editorial & Luxe',
    tier: 'pro',
    tagline: 'Printed paper, hairline rules.',
    moods: ['editorial', 'classic', 'literary'],
    backgroundId: 'bg-film-grain-light',
    page: { text: '#1A1A1A', muted: '#5A5A57', accent: '#8C1C13' },
    button: {
      fill: 'transparent',
      text: '#1A1A1A',
      border: '#1A1A1A',
      borderWidth: 1,
      shape: 'square',
      radius: 0,
      surface: 'outline-hairline',
    },
    fonts: {
      name: { family: 'Playfair Display', weight: 700 },
      bio: { family: 'Newsreader', weight: 400 },
      button: { family: 'DM Sans', weight: 500 },
    },
    layout: { header: 'editorial', avatarFrame: 'square', spacing: 'airy', width: 'focused' },
  },
  {
    id: 'noir-editions',
    name: 'Noir Éditions',
    collection: 'Editorial & Luxe',
    tier: 'pro',
    tagline: 'Black-and-white magazine.',
    moods: ['editorial', 'fashion', 'luxury'],
    backgroundId: 'bg-film-grain-dark',
    page: { text: '#F2F2F2', muted: '#A6A6A6', accent: '#F2F2F2' },
    button: {
      fill: 'transparent',
      text: '#F2F2F2',
      border: '#F2F2F2',
      borderWidth: 1,
      shape: 'square',
      radius: 0,
      surface: 'outline-hairline',
    },
    fonts: {
      name: { family: 'Bodoni Moda', weight: 700 },
      bio: { family: 'Newsreader', weight: 400 },
      button: { family: 'Inter', weight: 500 },
    },
    layout: { header: 'editorial', avatarFrame: 'square', spacing: 'airy', width: 'focused' },
  },
  {
    id: 'burgundy-library',
    name: 'Burgundy Library',
    collection: 'Editorial & Luxe',
    tier: 'pro',
    tagline: 'Old library, gold leaf.',
    moods: ['luxury', 'classic', 'editorial'],
    backgroundId: 'bg-burgundy-velvet',
    page: { text: '#F6E7D8', muted: '#C9AE9A', accent: '#C9A66B' },
    button: {
      fill: '#C9A66B',
      text: '#1B070D',
      border: '#C9A66B',
      borderWidth: 1,
      shape: 'rounded',
      radius: 12,
      surface: 'metallic',
    },
    fonts: {
      name: { family: 'Cormorant Garamond', weight: 700 },
      bio: { family: 'EB Garamond', weight: 400 },
      button: { family: 'DM Sans', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'double-ring', spacing: 'airy', width: 'focused' },
  },
  {
    id: 'sapphire-club',
    name: 'Sapphire Club',
    collection: 'Editorial & Luxe',
    tier: 'pro',
    tagline: 'Members-only navy.',
    moods: ['luxury', 'classical', 'editorial'],
    backgroundId: 'bg-sapphire-night',
    page: { text: '#EAF0FF', muted: '#A8B8DA', accent: '#C8D4F0' },
    button: {
      fill: '#EAF0FF',
      text: '#071433',
      border: '#EAF0FF',
      borderWidth: 0,
      shape: 'rounded',
      radius: 14,
      surface: 'solid',
    },
    fonts: {
      name: { family: 'Marcellus', weight: 400 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'circle', spacing: 'balanced', width: 'standard' },
  },

  // ── 5. FUTURISTIC ───────────────────────────────────────────────────────────
  {
    id: 'neon-grid',
    name: 'Neon Grid',
    collection: 'Futuristic',
    tier: 'pro',
    tagline: 'Grid lines and glow.',
    moods: ['futuristic', 'techy', 'developer'],
    backgroundId: 'bg-neon-grid',
    page: { text: '#E9F1FF', muted: '#9FB3D6', accent: '#00F5D4' },
    button: {
      fill: '#0C1230',
      text: '#00F5D4',
      border: '#00F5D4',
      borderWidth: 2,
      shape: 'rounded',
      radius: 12,
      surface: 'neon-glow',
    },
    fonts: {
      name: { family: 'Space Grotesk', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'JetBrains Mono', weight: 500 },
    },
    layout: { header: 'editorial', avatarFrame: 'hexagon', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'chrome-y2k',
    name: 'Chrome Y2K',
    collection: 'Futuristic',
    tier: 'pro',
    tagline: 'Liquid chrome nostalgia.',
    moods: ['futuristic', 'bold', 'techy'],
    backgroundId: 'bg-concrete',
    page: { text: '#0E1220', muted: '#3C4458', accent: '#2B3A67' },
    button: {
      fill: '#EEF1F8',
      text: '#0E1220',
      border: '#5A6479',
      borderWidth: 1,
      shape: 'pill',
      radius: 9999,
      surface: 'metallic',
    },
    fonts: {
      name: { family: 'Unbounded', weight: 600 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Inter', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'gradient-ring', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    collection: 'Futuristic',
    tier: 'pro',
    tagline: 'Frosted glass over aurora.',
    moods: ['futuristic', 'techy', 'modern'],
    backgroundId: 'bg-northern-veil',
    page: { text: '#F0F6FF', muted: '#C8D5EC', accent: '#7DD3FC' },
    button: {
      fill: 'rgba(255,255,255,0.12)',
      text: '#F0F6FF',
      border: 'rgba(255,255,255,0.45)',
      borderWidth: 1,
      shape: 'pill',
      radius: 9999,
      surface: 'glass',
    },
    fonts: {
      name: { family: 'Sora', weight: 700 },
      bio: { family: 'Inter', weight: 400 },
      button: { family: 'Sora', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'halo', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'holo-foil',
    name: 'Holo Foil',
    collection: 'Futuristic',
    tier: 'pro',
    tagline: 'Pearl foil, soft rainbow.',
    moods: ['futuristic', 'clean', 'modern'],
    backgroundId: 'bg-shimmer-foil',
    page: { text: '#1B1530', muted: '#4A4160', accent: '#7C5CFF' },
    button: {
      fill: '#D8CCFF',
      text: '#1B1530',
      border: '#5B3DF0',
      borderWidth: 1,
      shape: 'pill',
      radius: 9999,
      surface: 'gradient-flow',
    },
    fonts: {
      name: { family: 'Outfit', weight: 700 },
      bio: { family: 'Outfit', weight: 400 },
      button: { family: 'Outfit', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'gradient-ring', spacing: 'balanced', width: 'standard' },
  },

  // ── 6. ORGANIC ──────────────────────────────────────────────────────────────
  {
    id: 'moss-stone',
    name: 'Moss & Stone',
    collection: 'Organic',
    tier: 'free',
    tagline: 'Earthy stone and moss.',
    moods: ['warm', 'organic', 'calm'],
    backgroundId: 'bg-stone-grain',
    page: { text: '#1F2A1C', muted: '#4A5946', accent: '#2F4A2B' },
    button: {
      fill: '#2F4A2B',
      text: '#F3F7EE',
      border: '#2F4A2B',
      borderWidth: 0,
      shape: 'rounded',
      radius: 14,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Merriweather', weight: 700 },
      bio: { family: 'Merriweather', weight: 400 },
      button: { family: 'Inter', weight: 500 },
    },
    layout: { header: 'centered', avatarFrame: 'squircle', spacing: 'balanced', width: 'standard' },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    collection: 'Organic',
    tier: 'pro',
    tagline: 'Baked clay and cream.',
    moods: ['warm', 'organic', 'editorial'],
    backgroundId: 'bg-terracotta-clay',
    page: { text: '#FFF8F1', muted: '#FBE6D6', accent: '#FFF8F1' },
    button: {
      fill: '#FFF8F1',
      text: '#5A2210',
      border: '#FFF8F1',
      borderWidth: 0,
      shape: 'rounded',
      radius: 18,
      surface: 'solid-soft',
    },
    fonts: {
      name: { family: 'Fraunces', weight: 700 },
      bio: { family: 'DM Sans', weight: 400 },
      button: { family: 'DM Sans', weight: 600 },
    },
    layout: { header: 'centered', avatarFrame: 'squircle', spacing: 'airy', width: 'focused' },
  },
] as const;

export const OLD_TO_NEW_VIBE_MAP: Record<string, string> = {
  clean: 'porcelain',
  midnight: 'obsidian',
  paper: 'ivory-press',
  sage: 'celadon',
  clay: 'terracotta',
  mono: 'graphite-mono',
  cyberpunk: 'neon-grid',
  sunset: 'tangerine-pop',
  glass: 'aurora-glass',
  brutalist: 'tangerine-pop',
  emerald: 'burgundy-library',
  pastel: 'bubblegum',
};

export function findCatalogVibe(id: string | null | undefined): CatalogVibe | undefined {
  if (!id) return undefined;
  return CATALOG_VIBES.find((v) => v.id === id);
}

export function resolveAnyVibeToV2Id(id: string | null | undefined): string {
  if (!id) return 'porcelain';
  const direct = findCatalogVibe(id);
  if (direct) return direct.id;
  return OLD_TO_NEW_VIBE_MAP[id.toLowerCase()] || 'porcelain';
}

export function getFreeFallbackVibeId(vibeId: string): string {
  const vibe = findCatalogVibe(vibeId);
  if (!vibe || vibe.tier === 'free') return vibe?.id || 'porcelain';
  switch (vibe.collection) {
    case 'Dark & Bold':
      return 'obsidian';
    case 'Color & Energy':
      return 'bubblegum';
    case 'Editorial & Luxe':
      return vibe.backgroundId && findCatalogBackground(vibe.backgroundId)?.tone === 'dark'
        ? 'graphite-mono'
        : 'porcelain';
    case 'Futuristic':
      return vibe.backgroundId && findCatalogBackground(vibe.backgroundId)?.tone === 'dark'
        ? 'eclipse'
        : 'dawn-mist';
    case 'Organic':
      return 'moss-stone';
    case 'Light & Calm':
    default:
      return 'porcelain';
  }
}

export function vibeToAppearanceDefaults(
  vibe: CatalogVibe,
  existingLocks: Appearance['locks'] = [],
  autoMatchButtons = true
): Appearance {
  return {
    schemaVersion: 2,
    vibeId: vibe.id,
    background: {
      type: 'preset',
      id: vibe.backgroundId,
    },
    typography: {
      name: {
        family: vibe.fonts.name.family,
        weight: vibe.fonts.name.weight,
        size: 'm',
        tracking: 'normal',
        case: 'normal',
        source: 'vibe',
      },
      bio: {
        family: vibe.fonts.bio.family,
        weight: vibe.fonts.bio.weight,
        size: 'm',
        tracking: 'normal',
        lineHeight: 'normal',
        source: 'vibe',
      },
      button: {
        family: vibe.fonts.button.family,
        weight: vibe.fonts.button.weight,
        size: 'm',
        tracking: 'normal',
        case: 'normal',
        source: 'vibe',
      },
    },
    buttons: {
      shape: vibe.button.shape,
      radius: vibe.button.radius,
      fill: vibe.button.fill,
      text: vibe.button.text,
      border: vibe.button.border,
      borderWidth: vibe.button.borderWidth,
      surface: vibe.button.surface,
      size: 'm',
      shadow: vibe.button.surface === 'solid-soft' ? 'soft' : 'none',
      align: 'center',
      icon: 'left',
      motion: vibe.button.surface === 'offset-3d' ? 'press' : 'lift',
      states: {},
    },
    layout: {
      header: vibe.layout.header,
      avatar: {
        frame: vibe.layout.avatarFrame,
        size: vibe.layout.header === 'hero' ? 'l' : 'm',
        glow: vibe.layout.avatarFrame === 'halo' ? 'soft' : 'none',
      },
      linkLayout: 'stack',
      spacing: vibe.layout.spacing,
      width: vibe.layout.width,
      entrance: 'fade-up',
      socialIcons: vibe.button.surface === 'glass' ? 'glass' : 'outline',
    },
    locks: existingLocks,
    autoMatchButtons,
  };
}

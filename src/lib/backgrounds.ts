export type BackgroundCategory = 'all' | 'atmosphere' | 'studio' | 'texture';

export interface BackgroundPreset {
  id: string;
  name: string;
  subtitle: string;
  category: Exclude<BackgroundCategory, 'all'>;
  type: 'none' | 'gradient' | 'mesh' | 'pattern';
  value?: string;
  patternSize?: string;
  isDark: boolean;
  isPro?: boolean;
}

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  {
    id: 'none',
    name: 'Theme Default',
    subtitle: 'Match active Vibe',
    category: 'studio',
    type: 'none',
    isDark: false,
  },
  // ── Free Curated Studio Backdrops ────────────────────────────────────────────
  {
    id: 'obsidian-silk',
    name: 'Obsidian Silk',
    subtitle: 'Velvet studio slate',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 20% 10%, rgba(56, 189, 248, 0.16) 0px, transparent 52%), radial-gradient(at 85% 90%, rgba(99, 102, 241, 0.18) 0px, transparent 55%), linear-gradient(165deg, #0D1117 0%, #090A0F 100%)',
    isDark: true,
  },
  {
    id: 'warm-vellum',
    name: 'Warm Vellum',
    subtitle: 'Editorial ivory paper',
    category: 'studio',
    type: 'mesh',
    value:
      'radial-gradient(at 15% 15%, rgba(251, 191, 36, 0.16) 0px, transparent 55%), radial-gradient(at 90% 85%, rgba(244, 114, 182, 0.10) 0px, transparent 50%), linear-gradient(180deg, #FDFBF7 0%, #F4EFE6 100%)',
    isDark: false,
  },
  {
    id: 'arctic-frosted',
    name: 'Arctic Frost',
    subtitle: 'Crisp glacier mist',
    category: 'studio',
    type: 'mesh',
    value:
      'radial-gradient(at 0% 0%, rgba(125, 211, 252, 0.38) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(167, 243, 208, 0.30) 0px, transparent 55%), #F1F5F9',
    isDark: false,
  },
  {
    id: 'espresso-dusk',
    name: 'Espresso Dusk',
    subtitle: 'Warm roasted copper',
    category: 'atmosphere',
    type: 'gradient',
    value:
      'radial-gradient(at 80% 15%, rgba(245, 158, 11, 0.18) 0px, transparent 50%), linear-gradient(155deg, #27150E 0%, #160B07 55%, #0B0605 100%)',
    isDark: true,
  },
  {
    id: 'swiss-dots',
    name: 'Swiss Halftone',
    subtitle: 'Precision dot matrix',
    category: 'texture',
    type: 'pattern',
    value: 'radial-gradient(currentColor 1.2px, transparent 1.2px)',
    patternSize: '18px 18px',
    isDark: false,
  },

  // ── Premium Pro Studio & Atmosphere Backdrops ────────────────────────────────
  {
    id: 'northern-prism',
    name: 'Northern Prism',
    subtitle: 'Borealis glass waves',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 12% 18%, rgba(16, 185, 129, 0.42) 0px, transparent 50%), radial-gradient(at 85% 12%, rgba(59, 130, 246, 0.36) 0px, transparent 52%), radial-gradient(at 50% 92%, rgba(168, 85, 247, 0.38) 0px, transparent 55%), #050814',
    isDark: true,
    isPro: true,
  },
  {
    id: 'iridescent-pearl',
    name: 'Iridescent Pearl',
    subtitle: 'Opal silk shimmer',
    category: 'studio',
    type: 'mesh',
    value:
      'radial-gradient(at 10% 15%, rgba(244, 114, 182, 0.28) 0px, transparent 52%), radial-gradient(at 88% 20%, rgba(96, 165, 250, 0.30) 0px, transparent 50%), radial-gradient(at 45% 90%, rgba(196, 181, 253, 0.34) 0px, transparent 52%), #F8FAFC',
    isDark: false,
    isPro: true,
  },
  {
    id: 'velvet-noire',
    name: 'Velvet Noire',
    subtitle: 'Ruby spotlight noir',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 78% 14%, rgba(225, 29, 72, 0.32) 0px, transparent 52%), radial-gradient(at 15% 88%, rgba(124, 58, 237, 0.24) 0px, transparent 52%), linear-gradient(160deg, #160911 0%, #070509 100%)',
    isDark: true,
    isPro: true,
  },
  {
    id: 'solar-eclipse',
    name: 'Solar Flare',
    subtitle: 'Amber & obsidian rim',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 50% 8%, rgba(249, 115, 22, 0.38) 0px, transparent 48%), radial-gradient(at 85% 75%, rgba(234, 179, 8, 0.16) 0px, transparent 52%), linear-gradient(180deg, #18100C 0%, #09090B 100%)',
    isDark: true,
    isPro: true,
  },
  {
    id: 'nordic-pine',
    name: 'Nordic Pine',
    subtitle: 'Misty deep forest',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 20% 20%, rgba(52, 211, 153, 0.22) 0px, transparent 50%), radial-gradient(at 80% 85%, rgba(20, 184, 166, 0.20) 0px, transparent 55%), linear-gradient(155deg, #04241B 0%, #02130E 100%)',
    isDark: true,
    isPro: true,
  },
  {
    id: 'midnight-abyss',
    name: 'Deep Space',
    subtitle: 'Cobalt horizon glow',
    category: 'atmosphere',
    type: 'mesh',
    value:
      'radial-gradient(at 50% 100%, rgba(37, 99, 235, 0.38) 0px, transparent 58%), radial-gradient(at 15% 15%, rgba(14, 165, 233, 0.20) 0px, transparent 45%), #030712',
    isDark: true,
    isPro: true,
  },
  {
    id: 'matcha-studio',
    name: 'Matcha Studio',
    subtitle: 'Botanical sage mist',
    category: 'studio',
    type: 'mesh',
    value:
      'radial-gradient(at 15% 15%, rgba(132, 204, 22, 0.22) 0px, transparent 50%), radial-gradient(at 85% 80%, rgba(16, 185, 129, 0.18) 0px, transparent 52%), #F4F8F2',
    isDark: false,
    isPro: true,
  },
  {
    id: 'sunset-sorbet',
    name: 'Peach Sorbet',
    subtitle: 'Warm tangerine glass',
    category: 'studio',
    type: 'mesh',
    value:
      'radial-gradient(at 15% 10%, rgba(251, 146, 60, 0.36) 0px, transparent 55%), radial-gradient(at 88% 85%, rgba(244, 63, 94, 0.24) 0px, transparent 55%), #FFF7ED',
    isDark: false,
    isPro: true,
  },
  {
    id: 'drafting-grid',
    name: 'Drafting Grid',
    subtitle: 'Architectural graph',
    category: 'texture',
    type: 'pattern',
    value:
      'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
    patternSize: '22px 22px',
    isDark: false,
    isPro: true,
  },
  {
    id: 'atelier-pinstripe',
    name: 'Atelier Weave',
    subtitle: 'Fine diagonal weave',
    category: 'texture',
    type: 'pattern',
    value:
      'repeating-linear-gradient(135deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 14px)',
    patternSize: '20px 20px',
    isDark: false,
    isPro: true,
  },
] as const;

const PRESET_MAP = new Map<string, BackgroundPreset>(
  BACKGROUND_PRESETS.map((p) => [p.id, p])
);

export function getBackgroundPreset(id?: string | null): BackgroundPreset | null {
  if (!id) return null;
  return PRESET_MAP.get(id) || null;
}

export function isDarkBackgroundPreset(presetId?: string | null): boolean {
  if (!presetId) return false;
  const found = PRESET_MAP.get(presetId);
  if (found) return found.isDark;
  // Legacy fallback compatibility if previously saved presetId exists in DB
  return ['aurora', 'cyber', 'cosmic', 'emerald'].includes(presetId);
}

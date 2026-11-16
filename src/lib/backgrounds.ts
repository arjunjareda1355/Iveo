import {
  type BackgroundConfig,
  type BackgroundImageFit,
  type GradientDirection,
  DEFAULT_BACKGROUND_CONFIG,
  parseBackgroundConfig,
} from './preferences.ts';

export type BackgroundCategory =
  | 'all'
  | 'minimal-premium'
  | 'soft-gradients'
  | 'dark-midnight'
  | 'aurora'
  | 'abstract'
  | 'glass'
  | 'textures';

export interface BackgroundCategoryMeta {
  id: BackgroundCategory;
  label: string;
}

export const BACKGROUND_CATEGORIES: readonly BackgroundCategoryMeta[] = [
  { id: 'all', label: 'All' },
  { id: 'minimal-premium', label: 'Minimal' },
  { id: 'soft-gradients', label: 'Pastel & Gradients' },
  { id: 'dark-midnight', label: 'Dark' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'glass', label: 'Glass' },
  { id: 'textures', label: 'Textures' },
] as const;

export interface BackgroundPreset {
  id: string;
  name: string;
  subtitle: string;
  category: Exclude<BackgroundCategory, 'all'>;
  type: 'none' | 'solid' | 'gradient' | 'mesh' | 'pattern';
  value?: string;
  patternSize?: string;
  isDark: boolean;
  isPro?: boolean;
}

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  // ── 1. Minimal Premium (Pure White Default + Editorial Neutrals) ─────────────
  {
    id: 'pure-white',
    name: 'Pure White',
    subtitle: 'Crisp studio default',
    category: 'minimal-premium',
    type: 'solid',
    value: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'none',
    name: 'Theme Default',
    subtitle: 'Pure white / Vibe base',
    category: 'minimal-premium',
    type: 'none',
    value: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'warm-ivory',
    name: 'Warm Ivory',
    subtitle: 'Soft linen paper',
    category: 'minimal-premium',
    type: 'solid',
    value: '#FAF8F5',
    isDark: false,
  },
  {
    id: 'studio-alabaster',
    name: 'Alabaster',
    subtitle: 'Gallery warm stone',
    category: 'minimal-premium',
    type: 'solid',
    value: '#F4F4F5',
    isDark: false,
  },
  {
    id: 'pale-slate',
    name: 'Pale Slate',
    subtitle: 'Architectural mist',
    category: 'minimal-premium',
    type: 'solid',
    value: '#F1F5F9',
    isDark: false,
  },
  {
    id: 'champagne-silk',
    name: 'Champagne Silk',
    subtitle: 'Satin warm cream',
    category: 'minimal-premium',
    type: 'solid',
    value: '#FBF7F0',
    isDark: false,
  },
  {
    id: 'soft-sand',
    name: 'Soft Sand',
    subtitle: 'Mediterranean limestone',
    category: 'minimal-premium',
    type: 'solid',
    value: '#F5F0E6',
    isDark: false,
  },
  {
    id: 'warm-vellum',
    name: 'Warm Vellum',
    subtitle: 'Editorial ivory sheen',
    category: 'minimal-premium',
    type: 'mesh',
    value:
      'radial-gradient(at 15% 15%, rgba(251, 191, 36, 0.16) 0px, transparent 55%), radial-gradient(at 90% 85%, rgba(244, 114, 182, 0.10) 0px, transparent 50%), linear-gradient(180deg, #FDFBF7 0%, #F4EFE6 100%)',
    isDark: false,
  },

  // ── 2. Soft Gradients & Pastel Backgrounds ───────────────────────────────────
  {
    id: 'arctic-frosted',
    name: 'Arctic Frost',
    subtitle: 'Crisp glacier mist',
    category: 'soft-gradients',
    type: 'mesh',
    value:
      'radial-gradient(at 0% 0%, rgba(125, 211, 252, 0.38) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(167, 243, 208, 0.30) 0px, transparent 55%), #F1F5F9',
    isDark: false,
  },
  {
    id: 'pastel-blush',
    name: 'Rosewater Silk',
    subtitle: 'Delicate blush pastel',
    category: 'soft-gradients',
    type: 'gradient',
    value: 'linear-gradient(155deg, #FFF1F2 0%, #FFE4E6 48%, #FCE7F3 100%)',
    isDark: false,
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    subtitle: 'Soft violet cream',
    category: 'soft-gradients',
    type: 'gradient',
    value: 'linear-gradient(160deg, #F5F3FF 0%, #EDE9FE 52%, #FAE8FF 100%)',
    isDark: false,
  },
  {
    id: 'mint-sorbet',
    name: 'Pistachio Mint',
    subtitle: 'Fresh botanical pastel',
    category: 'soft-gradients',
    type: 'gradient',
    value: 'linear-gradient(160deg, #ECFDF5 0%, #D1FAE5 55%, #E0F2FE 100%)',
    isDark: false,
  },
  {
    id: 'buttercream-sky',
    name: 'Buttercream Sky',
    subtitle: 'Dawn cream & cerulean',
    category: 'soft-gradients',
    type: 'gradient',
    value: 'linear-gradient(145deg, #FEFCE8 0%, #FEF3C7 42%, #E0F2FE 100%)',
    isDark: false,
  },
  {
    id: 'matcha-studio',
    name: 'Matcha Studio',
    subtitle: 'Botanical sage mist',
    category: 'soft-gradients',
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
    category: 'soft-gradients',
    type: 'mesh',
    value:
      'radial-gradient(at 15% 10%, rgba(251, 146, 60, 0.36) 0px, transparent 55%), radial-gradient(at 88% 85%, rgba(244, 63, 94, 0.24) 0px, transparent 55%), #FFF7ED',
    isDark: false,
    isPro: true,
  },
  {
    id: 'iridescent-pearl',
    name: 'Iridescent Pearl',
    subtitle: 'Opal silk shimmer',
    category: 'soft-gradients',
    type: 'mesh',
    value:
      'radial-gradient(at 10% 15%, rgba(244, 114, 182, 0.28) 0px, transparent 52%), radial-gradient(at 88% 20%, rgba(96, 165, 250, 0.30) 0px, transparent 50%), radial-gradient(at 45% 90%, rgba(196, 181, 253, 0.34) 0px, transparent 52%), #F8FAFC',
    isDark: false,
    isPro: true,
  },

  // ── 3. Dark Backgrounds ──────────────────────────────────────────────────────
  {
    id: 'carbon-matte',
    name: 'Carbon Matte',
    subtitle: 'Pure editorial black',
    category: 'dark-midnight',
    type: 'solid',
    value: '#0A0A0A',
    isDark: true,
  },
  {
    id: 'obsidian-slate',
    name: 'Obsidian Slate',
    subtitle: 'Deep neutral zinc',
    category: 'dark-midnight',
    type: 'solid',
    value: '#111827',
    isDark: true,
  },
  {
    id: 'obsidian-silk',
    name: 'Obsidian Silk',
    subtitle: 'Velvet studio slate',
    category: 'dark-midnight',
    type: 'mesh',
    value:
      'radial-gradient(at 20% 10%, rgba(56, 189, 248, 0.16) 0px, transparent 52%), radial-gradient(at 85% 90%, rgba(99, 102, 241, 0.18) 0px, transparent 55%), linear-gradient(165deg, #0D1117 0%, #090A0F 100%)',
    isDark: true,
  },
  {
    id: 'espresso-dusk',
    name: 'Espresso Dusk',
    subtitle: 'Warm roasted copper',
    category: 'dark-midnight',
    type: 'gradient',
    value:
      'radial-gradient(at 80% 15%, rgba(245, 158, 11, 0.18) 0px, transparent 50%), linear-gradient(155deg, #27150E 0%, #160B07 55%, #0B0605 100%)',
    isDark: true,
  },
  {
    id: 'velvet-noire',
    name: 'Velvet Noire',
    subtitle: 'Ruby spotlight noir',
    category: 'dark-midnight',
    type: 'mesh',
    value:
      'radial-gradient(at 78% 14%, rgba(225, 29, 72, 0.32) 0px, transparent 52%), radial-gradient(at 15% 88%, rgba(124, 58, 237, 0.24) 0px, transparent 52%), linear-gradient(160deg, #160911 0%, #070509 100%)',
    isDark: true,
    isPro: true,
  },
  {
    id: 'midnight-abyss',
    name: 'Deep Space',
    subtitle: 'Cobalt horizon glow',
    category: 'dark-midnight',
    type: 'mesh',
    value:
      'radial-gradient(at 50% 100%, rgba(37, 99, 235, 0.38) 0px, transparent 58%), radial-gradient(at 15% 15%, rgba(14, 165, 233, 0.20) 0px, transparent 45%), #030712',
    isDark: true,
    isPro: true,
  },

  // ── 4. Aurora Backgrounds ────────────────────────────────────────────────────
  {
    id: 'aurora-soft',
    name: 'Daylight Aurora',
    subtitle: 'Airy mint & violet ribbons',
    category: 'aurora',
    type: 'mesh',
    value:
      'radial-gradient(at 14% 18%, rgba(45, 212, 191, 0.30) 0px, transparent 50%), radial-gradient(at 86% 16%, rgba(129, 140, 248, 0.30) 0px, transparent 52%), radial-gradient(at 50% 90%, rgba(244, 114, 182, 0.24) 0px, transparent 55%), #F8FAFC',
    isDark: false,
  },
  {
    id: 'northern-prism',
    name: 'Northern Prism',
    subtitle: 'Borealis glass waves',
    category: 'aurora',
    type: 'mesh',
    value:
      'radial-gradient(at 12% 18%, rgba(16, 185, 129, 0.42) 0px, transparent 50%), radial-gradient(at 85% 12%, rgba(59, 130, 246, 0.36) 0px, transparent 52%), radial-gradient(at 50% 92%, rgba(168, 85, 247, 0.38) 0px, transparent 55%), #050814',
    isDark: true,
    isPro: true,
  },
  {
    id: 'solar-eclipse',
    name: 'Solar Flare',
    subtitle: 'Amber & obsidian rim',
    category: 'aurora',
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
    category: 'aurora',
    type: 'mesh',
    value:
      'radial-gradient(at 20% 20%, rgba(52, 211, 153, 0.24) 0px, transparent 50%), radial-gradient(at 80% 85%, rgba(20, 184, 166, 0.22) 0px, transparent 55%), linear-gradient(155deg, #04241B 0%, #02130E 100%)',
    isDark: true,
    isPro: true,
  },
  {
    id: 'violet-nebula',
    name: 'Violet Nebula',
    subtitle: 'Ultraviolet cosmic cloud',
    category: 'aurora',
    type: 'mesh',
    value:
      'radial-gradient(at 80% 18%, rgba(192, 132, 252, 0.36) 0px, transparent 50%), radial-gradient(at 15% 78%, rgba(56, 189, 248, 0.30) 0px, transparent 52%), radial-gradient(at 50% 50%, rgba(236, 72, 153, 0.18) 0px, transparent 60%), #09061A',
    isDark: true,
    isPro: true,
  },

  // ── 5. Abstract Backgrounds ──────────────────────────────────────────────────
  {
    id: 'bauhaus-blush',
    name: 'Bauhaus Blush',
    subtitle: 'Sculptural warm arcs',
    category: 'abstract',
    type: 'mesh',
    value:
      'radial-gradient(circle at 82% 18%, rgba(251, 113, 133, 0.28) 0%, rgba(251, 113, 133, 0.28) 26%, transparent 26.5%), radial-gradient(circle at 12% 84%, rgba(251, 191, 36, 0.26) 0%, rgba(251, 191, 36, 0.26) 24%, transparent 24.5%), #FAF7F2',
    isDark: false,
  },
  {
    id: 'cobalt-wave',
    name: 'Cobalt Wave',
    subtitle: 'Graphic sweeping beam',
    category: 'abstract',
    type: 'gradient',
    value:
      'conic-gradient(from 215deg at 75% 25%, #DBEAFE 0deg, #EFF6FF 95deg, #E0E7FF 195deg, #DBEAFE 360deg)',
    isDark: false,
  },
  {
    id: 'terracotta-arc',
    name: 'Terracotta Arc',
    subtitle: 'Warm studio geometry',
    category: 'abstract',
    type: 'mesh',
    value:
      'radial-gradient(circle at 15% 15%, rgba(234, 88, 12, 0.22) 0%, rgba(234, 88, 12, 0.22) 22%, transparent 22.5%), radial-gradient(circle at 90% 80%, rgba(20, 184, 166, 0.18) 0%, rgba(20, 184, 166, 0.18) 28%, transparent 28.5%), #FFF8F3',
    isDark: false,
    isPro: true,
  },
  {
    id: 'prism-bloom',
    name: 'Prism Bloom',
    subtitle: 'Refracted spectral glow',
    category: 'abstract',
    type: 'gradient',
    value:
      'conic-gradient(from 135deg at 50% 45%, #0F172A 0deg, #1E1B4B 90deg, #312E81 180deg, #0F172A 360deg)',
    isDark: true,
    isPro: true,
  },

  // ── 6. Glass-Style Backgrounds ───────────────────────────────────────────────
  {
    id: 'frosted-quartz',
    name: 'Frosted Quartz',
    subtitle: 'Cool translucent crystal',
    category: 'glass',
    type: 'mesh',
    value:
      'linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(241,245,249,0.55) 100%), radial-gradient(at 20% 20%, rgba(148,163,184,0.22) 0px, transparent 55%), radial-gradient(at 80% 80%, rgba(56,189,248,0.18) 0px, transparent 55%), #F8FAFC',
    isDark: false,
  },
  {
    id: 'rose-glass',
    name: 'Rose Tint Glass',
    subtitle: 'Blush diffused pane',
    category: 'glass',
    type: 'mesh',
    value:
      'linear-gradient(145deg, rgba(255,255,255,0.68) 0%, rgba(255,241,242,0.5) 100%), radial-gradient(at 15% 25%, rgba(251,113,133,0.22) 0px, transparent 55%), radial-gradient(at 85% 75%, rgba(244,114,182,0.18) 0px, transparent 55%), #FFF5F7',
    isDark: false,
  },
  {
    id: 'smoked-glass',
    name: 'Smoked Glass',
    subtitle: 'Charcoal frosted sheen',
    category: 'glass',
    type: 'mesh',
    value:
      'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%), radial-gradient(at 25% 15%, rgba(148,163,184,0.22) 0px, transparent 50%), radial-gradient(at 80% 85%, rgba(99,102,241,0.18) 0px, transparent 55%), #0E1116',
    isDark: true,
    isPro: true,
  },
  {
    id: 'opal-frosted',
    name: 'Opal Frosted',
    subtitle: 'Soft iridescent pane',
    category: 'glass',
    type: 'mesh',
    value:
      'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(248,250,252,0.45) 100%), radial-gradient(at 15% 15%, rgba(167,139,250,0.26) 0px, transparent 52%), radial-gradient(at 85% 85%, rgba(45,212,191,0.22) 0px, transparent 52%), #F8FAFC',
    isDark: false,
    isPro: true,
  },

  // ── 7. Texture-Based Backgrounds ─────────────────────────────────────────────
  {
    id: 'swiss-dots',
    name: 'Swiss Halftone',
    subtitle: 'Precision dot matrix',
    category: 'textures',
    type: 'pattern',
    value: 'radial-gradient(currentColor 1.2px, transparent 1.2px)',
    patternSize: '18px 18px',
    isDark: false,
  },
  {
    id: 'drafting-grid',
    name: 'Drafting Grid',
    subtitle: 'Architectural graph',
    category: 'textures',
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
    category: 'textures',
    type: 'pattern',
    value:
      'repeating-linear-gradient(135deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 14px)',
    patternSize: '20px 20px',
    isDark: false,
    isPro: true,
  },
  {
    id: 'linen-crosshatch',
    name: 'Linen Weave',
    subtitle: 'Subtle woven fabric',
    category: 'textures',
    type: 'pattern',
    value:
      'repeating-linear-gradient(0deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 12px), repeating-linear-gradient(90deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 12px)',
    patternSize: '12px 12px',
    isDark: false,
  },
  {
    id: 'horizon-lines',
    name: 'Studio Ledger',
    subtitle: 'Crisp horizontal rule',
    category: 'textures',
    type: 'pattern',
    value: 'repeating-linear-gradient(180deg, transparent 0px, transparent 23px, currentColor 24px)',
    patternSize: '24px 24px',
    isDark: false,
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
  return ['aurora', 'cyber', 'cosmic', 'emerald'].includes(presetId);
}

export function buildGradientCss(
  stops: string[],
  direction: GradientDirection = 'to bottom right',
  angle?: number
): string {
  const cleanStops = stops
    .map((s) => s.trim())
    .filter((s) => /^#[0-9a-fA-F]{3,8}$/.test(s));
  if (cleanStops.length === 0) return '#FFFFFF';
  if (cleanStops.length === 1) return cleanStops[0];

  if (direction === 'radial') {
    return `radial-gradient(circle at 50% 35%, ${cleanStops.join(', ')})`;
  }

  const degOrDir =
    typeof angle === 'number' && Number.isFinite(angle)
      ? `${Math.round(angle)}deg`
      : direction;
  return `linear-gradient(${degOrDir}, ${cleanStops.join(', ')})`;
}

/**
 * Sanitizes untrusted background input while rejecting unsafe values.
 */
export function sanitizeBackgroundConfig(raw: unknown): BackgroundConfig | null {
  return parseBackgroundConfig(raw);
}

/**
 * Resolves a stored/raw BackgroundConfig into a renderable configuration,
 * defaulting missing, 'none', or invalid configs cleanly to Pure White (#FFFFFF)
 * WITHOUT overwriting caller or database objects.
 */
export function resolveBackgroundConfig(raw?: BackgroundConfig | null): BackgroundConfig {
  const parsed = parseBackgroundConfig(raw);
  if (!parsed || parsed.type === 'none') {
    return { ...DEFAULT_BACKGROUND_CONFIG };
  }
  return parsed;
}

export interface ComputedBackgroundLayers {
  config: BackgroundConfig;
  baseColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition: string;
  isPattern: boolean;
  patternOpacity: number;
  imageUrl?: string;
  imageFit: BackgroundImageFit;
  imagePosition: string;
  overlayColor?: string;
  overlayOpacity: number;
  filterCss?: string;
  isDark: boolean;
}

/**
 * Computes pure presentation CSS properties for BackgroundLayer.
 * Filters (blur, brightness, saturation) and overlays stay isolated in the background container.
 */
export function computeBackgroundLayers(
  raw?: BackgroundConfig | null,
  fallbackBg = '#FFFFFF'
): ComputedBackgroundLayers {
  const parsed = parseBackgroundConfig(raw);
  const preset = parsed?.presetId ? getBackgroundPreset(parsed.presetId) : null;

  // 'none' or missing -> Pure White default unless caller passes theme fallback
  if (!parsed || parsed.type === 'none') {
    const cleanFallback = /^#[0-9a-fA-F]{3,8}$/.test(fallbackBg) ? fallbackBg : '#FFFFFF';
    return {
      config: { ...DEFAULT_BACKGROUND_CONFIG, value: cleanFallback },
      baseColor: cleanFallback,
      backgroundPosition: 'center center',
      isPattern: false,
      patternOpacity: 0,
      imageFit: 'cover',
      imagePosition: '50% 50%',
      overlayOpacity: 0,
      isDark: false,
    };
  }

  const blur = typeof parsed.blur === 'number' ? Math.min(24, Math.max(0, parsed.blur)) : 0;
  const brightness =
    typeof parsed.brightness === 'number' ? Math.min(1.5, Math.max(0.5, parsed.brightness)) : 1;
  const saturation =
    typeof parsed.saturation === 'number' ? Math.min(1.6, Math.max(0.4, parsed.saturation)) : 1;

  const filterParts: string[] = [];
  if (blur > 0) filterParts.push(`blur(${blur}px)`);
  if (Math.abs(brightness - 1) > 0.01) filterParts.push(`brightness(${brightness})`);
  if (Math.abs(saturation - 1) > 0.01) filterParts.push(`saturate(${saturation})`);
  const filterCss = filterParts.length > 0 ? filterParts.join(' ') : undefined;

  const overlayColor = parsed.overlayColor;
  const overlayOpacity =
    typeof parsed.overlayOpacity === 'number'
      ? Math.min(0.85, Math.max(0, parsed.overlayOpacity))
      : 0;

  if (parsed.type === 'solid') {
    const hex = parsed.value && /^#[0-9a-fA-F]{3,8}$/.test(parsed.value) ? parsed.value : '#FFFFFF';
    return {
      config: parsed,
      baseColor: hex,
      backgroundPosition: 'center center',
      isPattern: false,
      patternOpacity: 0,
      imageFit: 'cover',
      imagePosition: '50% 50%',
      overlayColor,
      overlayOpacity,
      filterCss,
      isDark: Boolean(preset?.isDark),
    };
  }

  if (parsed.type === 'image' && parsed.value) {
    const pos = parsed.imagePosition || { x: 50, y: 50 };
    return {
      config: parsed,
      baseColor: '#0A0A0A',
      backgroundPosition: `${pos.x}% ${pos.y}%`,
      isPattern: false,
      patternOpacity: 0,
      imageUrl: parsed.value,
      imageFit: parsed.imageFit || 'cover',
      imagePosition: `${pos.x}% ${pos.y}%`,
      overlayColor: overlayColor || '#000000',
      overlayOpacity: overlayOpacity > 0 ? overlayOpacity : 0.15,
      filterCss,
      isDark: true,
    };
  }

  if (parsed.type === 'pattern') {
    const patternValue = parsed.value || preset?.value;
    return {
      config: parsed,
      baseColor: fallbackBg || '#FFFFFF',
      backgroundImage: patternValue,
      backgroundSize: preset?.patternSize || '18px 18px',
      backgroundPosition: 'center center',
      isPattern: true,
      patternOpacity: 0.12,
      imageFit: 'cover',
      imagePosition: '50% 50%',
      overlayColor,
      overlayOpacity,
      filterCss,
      isDark: Boolean(preset?.isDark),
    };
  }

  // gradient or mesh
  let gradientCss = parsed.value || preset?.value;
  if (parsed.gradientStops && parsed.gradientStops.length >= 2) {
    gradientCss = buildGradientCss(
      parsed.gradientStops,
      parsed.gradientDirection || 'to bottom right',
      parsed.gradientAngle
    );
  }

  return {
    config: parsed,
    baseColor: fallbackBg || '#FFFFFF',
    backgroundImage: gradientCss || 'linear-gradient(135deg, #FFFFFF 0%, #F1F5F9 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    isPattern: false,
    patternOpacity: 0,
    imageFit: 'cover',
    imagePosition: '50% 50%',
    overlayColor,
    overlayOpacity,
    filterCss,
    isDark: Boolean(preset?.isDark),
  };
}


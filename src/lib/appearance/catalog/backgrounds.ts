/**
 * Section 10.2 Backgrounds Catalogue (40 presets across 8 categories).
 * Pure typed data + SVG noise/pattern layer generators + precomputed BgProfile hints.
 */
import type { Hex, PatternOverlayType } from '../types.ts';

export type BackgroundCategoryV2 =
  | 'all'
  | 'solid-tonal'
  | 'soft-gradient'
  | 'mesh'
  | 'aurora'
  | 'glass'
  | 'grain-texture'
  | 'pattern'
  | 'animated';

export interface BackgroundCategoryMetaV2 {
  id: BackgroundCategoryV2;
  label: string;
}

export const BACKGROUND_CATEGORIES_V2: readonly BackgroundCategoryMetaV2[] = [
  { id: 'all', label: 'All' },
  { id: 'solid-tonal', label: 'Solid & Tonal' },
  { id: 'soft-gradient', label: 'Soft Gradient' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'glass', label: 'Glass' },
  { id: 'grain-texture', label: 'Grain & Texture' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'animated', label: 'Animated' },
] as const;

export interface PresetRadialBlob {
  xPct: number;
  yPct: number;
  rxPct: number;
  ryPct: number;
  color: Hex;
  peakAlpha: number; // capped <= 0.40 where specified so text contrast holds
  fadeAtPct?: number;
}

export interface PresetGradientDef {
  kind: 'linear' | 'radial' | 'conic';
  angle: number;
  stops: ReadonlyArray<{ color: Hex; at: number }>;
}

export interface CatalogBackgroundPreset {
  id: string;
  name: string;
  category: Exclude<BackgroundCategoryV2, 'all'>;
  categoryLabel: string;
  tier: 'free' | 'pro';
  tone: 'light' | 'mid' | 'dark';
  baseHex: Hex;
  cssBackground: string;
  gradient?: PresetGradientDef;
  blobs?: readonly PresetRadialBlob[];
  grainOpacity?: number; // 0..0.4
  grainBlend?: 'multiply' | 'screen';
  grainFreq?: number;
  grainOctaves?: number;
  vignetteOpacity?: number;
  blurPx?: number;
  backdropBlurPx?: number;
  veilColor?: string;
  patternKind?: PatternOverlayType;
  patternColor?: string;
  patternSizePx?: number;
  isAnimated?: boolean;
  animationKind?: 'drift' | 'liquid' | 'shimmer';
  moodTags: readonly string[];
}

export function buildSvgNoiseDataUri(baseFrequency = 0.8, octaves = 2): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${octaves}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function buildSvgContourDataUri(strokeColor = '#2E5A44'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none"><g stroke="${strokeColor}" stroke-width="1.2"><path d="M-20 40C45 10 110 80 180 48C250 16 290 60 340 32"/><path d="M-20 96C55 62 120 132 196 98C268 65 296 112 340 88"/><path d="M-20 156C65 118 118 190 205 152C276 122 302 168 340 144"/><path d="M-20 218C52 184 126 244 202 210C272 178 302 224 340 200"/><path d="M-20 278C56 242 132 306 210 270C278 240 304 286 340 264"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function buildSvgWavesDataUri(c1 = '#DBEAFE', c2 = '#BFDBFE', c3 = '#93C5FD'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240" fill="none"><path d="M0 90C95 55 190 125 400 85V240H0Z" fill="${c1}" fill-opacity="0.45"/><path d="M0 140C120 105 230 175 400 135V240H0Z" fill="${c2}" fill-opacity="0.45"/><path d="M0 185C130 160 260 215 400 180V240H0Z" fill="${c3}" fill-opacity="0.45"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const CATALOG_BACKGROUNDS: readonly CatalogBackgroundPreset[] = [
  // ── 1. SOLID & TONAL (8) ────────────────────────────────────────────────────
  {
    id: 'bg-studio-white',
    name: 'Studio White',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'light',
    baseHex: '#FAFAF9',
    cssBackground: '#FAFAF9',
    moodTags: ['light', 'minimal', 'clean', 'white', 'neutral'],
  },
  {
    id: 'bg-warm-bone',
    name: 'Warm Bone',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'light',
    baseHex: '#F3EEE6',
    cssBackground: '#F3EEE6',
    moodTags: ['light', 'warm', 'paper', 'cream', 'calm'],
  },
  {
    id: 'bg-slate-fog',
    name: 'Slate Fog',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'light',
    baseHex: '#E8EBEF',
    cssBackground: '#E8EBEF',
    moodTags: ['light', 'cool', 'slate', 'grey', 'modern'],
  },
  {
    id: 'bg-mint-tint',
    name: 'Mint Tint',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'light',
    baseHex: '#E7F2EA',
    cssBackground: '#E7F2EA',
    moodTags: ['light', 'green', 'sage', 'calm', 'organic'],
  },
  {
    id: 'bg-ink-black',
    name: 'Ink Black',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'dark',
    baseHex: '#0A0A0B',
    cssBackground: '#0A0A0B',
    moodTags: ['dark', 'black', 'minimal', 'bold', 'luxury'],
  },
  {
    id: 'bg-graphite',
    name: 'Graphite',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'dark',
    baseHex: '#161616',
    cssBackground: '#161616',
    moodTags: ['dark', 'charcoal', 'terminal', 'tech', 'mono'],
  },
  {
    id: 'bg-tangerine',
    name: 'Tangerine',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'free',
    tone: 'mid',
    baseHex: '#FF6B2C',
    cssBackground: '#FF6B2C',
    moodTags: ['mid', 'warm', 'orange', 'bold', 'pop', 'vibrant'],
  },
  {
    id: 'bg-terracotta-clay',
    name: 'Terracotta Clay',
    category: 'solid-tonal',
    categoryLabel: 'Solid & Tonal',
    tier: 'pro',
    tone: 'mid',
    baseHex: '#A84A22',
    cssBackground: '#A84A22',
    moodTags: ['mid', 'warm', 'clay', 'earth', 'organic'],
  },

  // ── 2. SOFT GRADIENT (9) ────────────────────────────────────────────────────
  {
    id: 'bg-morning-haze',
    name: 'Morning Haze',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'free',
    tone: 'light',
    baseHex: '#F3E8FF',
    cssBackground: 'linear-gradient(160deg, #FFF1E6 0%, #F3E8FF 55%, #E6F0FF 100%)',
    gradient: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: '#FFF1E6', at: 0 },
        { color: '#F3E8FF', at: 55 },
        { color: '#E6F0FF', at: 100 },
      ],
    },
    moodTags: ['light', 'pastel', 'soft', 'gradient', 'calm'],
  },
  {
    id: 'bg-peach-fizz',
    name: 'Peach Fizz',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'free',
    tone: 'light',
    baseHex: '#FFB3C7',
    cssBackground: 'linear-gradient(135deg, #FFD9C2 0%, #FFB3C7 100%)',
    gradient: {
      kind: 'linear',
      angle: 135,
      stops: [
        { color: '#FFD9C2', at: 0 },
        { color: '#FFB3C7', at: 100 },
      ],
    },
    moodTags: ['light', 'warm', 'pink', 'peach', 'editorial'],
  },
  {
    id: 'bg-sky-linen',
    name: 'Sky Linen',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'free',
    tone: 'light',
    baseHex: '#EAF4FF',
    cssBackground: 'linear-gradient(180deg, #EAF4FF 0%, #FFFFFF 100%)',
    gradient: {
      kind: 'linear',
      angle: 180,
      stops: [
        { color: '#EAF4FF', at: 0 },
        { color: '#FFFFFF', at: 100 },
      ],
    },
    moodTags: ['light', 'cool', 'blue', 'airy', 'clean'],
  },
  {
    id: 'bg-citrus-haze',
    name: 'Citrus Haze',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'free',
    tone: 'light',
    baseHex: '#FFF7C2',
    cssBackground: 'linear-gradient(150deg, #FFF7C2 0%, #FFE0A3 100%)',
    gradient: {
      kind: 'linear',
      angle: 150,
      stops: [
        { color: '#FFF7C2', at: 0 },
        { color: '#FFE0A3', at: 100 },
      ],
    },
    moodTags: ['light', 'warm', 'yellow', 'sunshine', 'bright'],
  },
  {
    id: 'bg-cotton-candy',
    name: 'Cotton Candy',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'free',
    tone: 'light',
    baseHex: '#FFD1E8',
    cssBackground: 'linear-gradient(150deg, #FFD1E8 0%, #D9E6FF 100%)',
    gradient: {
      kind: 'linear',
      angle: 150,
      stops: [
        { color: '#FFD1E8', at: 0 },
        { color: '#D9E6FF', at: 100 },
      ],
    },
    moodTags: ['light', 'pink', 'blue', 'pastel', 'sweet'],
  },
  {
    id: 'bg-aqua-rush',
    name: 'Aqua Rush',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'pro',
    tone: 'mid',
    baseHex: '#00D2C6',
    cssBackground: 'linear-gradient(140deg, #00D2C6 0%, #00A6FF 100%)',
    gradient: {
      kind: 'linear',
      angle: 140,
      stops: [
        { color: '#00D2C6', at: 0 },
        { color: '#00A6FF', at: 100 },
      ],
    },
    moodTags: ['mid', 'cool', 'cyan', 'aqua', 'energy'],
  },
  {
    id: 'bg-dusk-plum',
    name: 'Dusk Plum',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#1B112B',
    cssBackground: 'linear-gradient(160deg, #2B1B3D 0%, #0F0A1A 100%)',
    gradient: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: '#2B1B3D', at: 0 },
        { color: '#0F0A1A', at: 100 },
      ],
    },
    moodTags: ['dark', 'purple', 'plum', 'night', 'luxe'],
  },
  {
    id: 'bg-burgundy-velvet',
    name: 'Burgundy Velvet',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#280B13',
    cssBackground: 'linear-gradient(160deg, #3A121C 0%, #1B070D 100%)',
    gradient: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: '#3A121C', at: 0 },
        { color: '#1B070D', at: 100 },
      ],
    },
    moodTags: ['dark', 'warm', 'burgundy', 'luxury', 'editorial'],
  },
  {
    id: 'bg-sapphire-night',
    name: 'Sapphire Night',
    category: 'soft-gradient',
    categoryLabel: 'Soft Gradient',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#0A1E4A',
    cssBackground: 'linear-gradient(160deg, #0F2A63 0%, #071433 100%)',
    gradient: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: '#0F2A63', at: 0 },
        { color: '#071433', at: 100 },
      ],
    },
    moodTags: ['dark', 'cool', 'navy', 'blue', 'luxury'],
  },

  // ── 3. MESH (4) ─────────────────────────────────────────────────────────────
  {
    id: 'bg-mesh-lagoon',
    name: 'Mesh Lagoon',
    category: 'mesh',
    categoryLabel: 'Mesh',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#07111F',
    cssBackground:
      'radial-gradient(55% 45% at 12% 18%, rgba(20, 184, 166, 0.36) 0%, transparent 70%), radial-gradient(50% 50% at 88% 30%, rgba(99, 102, 241, 0.34) 0%, transparent 70%), radial-gradient(60% 50% at 40% 95%, rgba(14, 165, 233, 0.32) 0%, transparent 70%), #07111F',
    blobs: [
      { xPct: 12, yPct: 18, rxPct: 55, ryPct: 45, color: '#14B8A6', peakAlpha: 0.36, fadeAtPct: 70 },
      { xPct: 88, yPct: 30, rxPct: 50, ryPct: 50, color: '#6366F1', peakAlpha: 0.34, fadeAtPct: 70 },
      { xPct: 40, yPct: 95, rxPct: 60, ryPct: 50, color: '#0EA5E9', peakAlpha: 0.32, fadeAtPct: 70 },
    ],
    grainOpacity: 0.04,
    grainBlend: 'screen',
    moodTags: ['dark', 'cool', 'mesh', 'teal', 'indigo'],
  },
  {
    id: 'bg-mesh-blush',
    name: 'Mesh Blush',
    category: 'mesh',
    categoryLabel: 'Mesh',
    tier: 'pro',
    tone: 'light',
    baseHex: '#FFF5F5',
    cssBackground:
      'radial-gradient(55% 45% at 15% 20%, rgba(255, 180, 200, 0.38) 0%, transparent 70%), radial-gradient(50% 50% at 85% 35%, rgba(255, 214, 165, 0.36) 0%, transparent 70%), radial-gradient(60% 50% at 45% 95%, rgba(217, 194, 255, 0.36) 0%, transparent 70%), #FFF5F5',
    blobs: [
      { xPct: 15, yPct: 20, rxPct: 55, ryPct: 45, color: '#FFB4C8', peakAlpha: 0.38, fadeAtPct: 70 },
      { xPct: 85, yPct: 35, rxPct: 50, ryPct: 50, color: '#FFD6A5', peakAlpha: 0.36, fadeAtPct: 70 },
      { xPct: 45, yPct: 95, rxPct: 60, ryPct: 50, color: '#D9C2FF', peakAlpha: 0.36, fadeAtPct: 70 },
    ],
    grainOpacity: 0.03,
    grainBlend: 'multiply',
    moodTags: ['light', 'warm', 'mesh', 'pastel', 'blush'],
  },
  {
    id: 'bg-mesh-ember',
    name: 'Mesh Ember',
    category: 'mesh',
    categoryLabel: 'Mesh',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#12060A',
    cssBackground:
      'radial-gradient(55% 45% at 10% 15%, rgba(249, 115, 22, 0.35) 0%, transparent 70%), radial-gradient(50% 50% at 90% 40%, rgba(225, 29, 72, 0.36) 0%, transparent 70%), radial-gradient(60% 50% at 50% 100%, rgba(192, 38, 211, 0.32) 0%, transparent 70%), #12060A',
    blobs: [
      { xPct: 10, yPct: 15, rxPct: 55, ryPct: 45, color: '#F97316', peakAlpha: 0.35, fadeAtPct: 70 },
      { xPct: 90, yPct: 40, rxPct: 50, ryPct: 50, color: '#E11D48', peakAlpha: 0.36, fadeAtPct: 70 },
      { xPct: 50, yPct: 100, rxPct: 60, ryPct: 50, color: '#C026D3', peakAlpha: 0.32, fadeAtPct: 70 },
    ],
    grainOpacity: 0.05,
    grainBlend: 'screen',
    moodTags: ['dark', 'warm', 'mesh', 'ruby', 'ember'],
  },
  {
    id: 'bg-mesh-meadow',
    name: 'Mesh Meadow',
    category: 'mesh',
    categoryLabel: 'Mesh',
    tier: 'pro',
    tone: 'light',
    baseHex: '#F3FAEF',
    cssBackground:
      'radial-gradient(55% 45% at 15% 20%, rgba(187, 247, 208, 0.38) 0%, transparent 70%), radial-gradient(50% 50% at 85% 30%, rgba(254, 240, 138, 0.34) 0%, transparent 70%), radial-gradient(60% 50% at 40% 95%, rgba(167, 243, 208, 0.36) 0%, transparent 70%), #F3FAEF',
    blobs: [
      { xPct: 15, yPct: 20, rxPct: 55, ryPct: 45, color: '#BBF7D0', peakAlpha: 0.38, fadeAtPct: 70 },
      { xPct: 85, yPct: 30, rxPct: 50, ryPct: 50, color: '#FEF08A', peakAlpha: 0.34, fadeAtPct: 70 },
      { xPct: 40, yPct: 95, rxPct: 60, ryPct: 50, color: '#A7F3D0', peakAlpha: 0.36, fadeAtPct: 70 },
    ],
    grainOpacity: 0.03,
    grainBlend: 'multiply',
    moodTags: ['light', 'green', 'mesh', 'meadow', 'organic'],
  },

  // ── 4. AURORA (3) ───────────────────────────────────────────────────────────
  {
    id: 'bg-northern-veil',
    name: 'Northern Veil',
    category: 'aurora',
    categoryLabel: 'Aurora',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#050B1A',
    cssBackground:
      'radial-gradient(70% 40% at 50% 0%, rgba(30, 58, 138, 0.40) 0%, transparent 72%), linear-gradient(115deg, transparent 20%, rgba(34, 211, 170, 0.38) 40%, rgba(124, 58, 237, 0.38) 58%, transparent 78%), #050B1A',
    blobs: [
      { xPct: 50, yPct: 0, rxPct: 70, ryPct: 40, color: '#1E3A8A', peakAlpha: 0.4, fadeAtPct: 72 },
      { xPct: 40, yPct: 45, rxPct: 55, ryPct: 30, color: '#22D3AA', peakAlpha: 0.32, fadeAtPct: 75 },
      { xPct: 62, yPct: 55, rxPct: 55, ryPct: 30, color: '#7C3AED', peakAlpha: 0.32, fadeAtPct: 75 },
    ],
    blurPx: 24,
    moodTags: ['dark', 'cool', 'aurora', 'glass', 'futuristic'],
  },
  {
    id: 'bg-polar-dawn',
    name: 'Polar Dawn',
    category: 'aurora',
    categoryLabel: 'Aurora',
    tier: 'pro',
    tone: 'light',
    baseHex: '#F2FBFF',
    cssBackground:
      'linear-gradient(120deg, transparent 15%, rgba(165, 243, 252, 0.38) 40%, rgba(251, 207, 232, 0.38) 62%, transparent 85%), #F2FBFF',
    blobs: [
      { xPct: 35, yPct: 35, rxPct: 60, ryPct: 40, color: '#A5F3FC', peakAlpha: 0.38, fadeAtPct: 75 },
      { xPct: 70, yPct: 65, rxPct: 60, ryPct: 40, color: '#FBCFE8', peakAlpha: 0.38, fadeAtPct: 75 },
    ],
    blurPx: 26,
    moodTags: ['light', 'cool', 'aurora', 'pastel', 'holo'],
  },
  {
    id: 'bg-violet-storm',
    name: 'Violet Storm',
    category: 'aurora',
    categoryLabel: 'Aurora',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#0B0720',
    cssBackground:
      'linear-gradient(110deg, transparent 18%, rgba(109, 40, 217, 0.38) 42%, rgba(37, 99, 235, 0.38) 62%, transparent 82%), #0B0720',
    blobs: [
      { xPct: 40, yPct: 35, rxPct: 55, ryPct: 38, color: '#6D28D9', peakAlpha: 0.38, fadeAtPct: 75 },
      { xPct: 68, yPct: 65, rxPct: 55, ryPct: 38, color: '#2563EB', peakAlpha: 0.36, fadeAtPct: 75 },
    ],
    blurPx: 24,
    moodTags: ['dark', 'cool', 'purple', 'violet', 'aurora', 'energy'],
  },

  // ── 5. GLASS (3) ────────────────────────────────────────────────────────────
  {
    id: 'bg-frosted-pane',
    name: 'Frosted Pane',
    category: 'glass',
    categoryLabel: 'Glass',
    tier: 'pro',
    tone: 'light',
    baseHex: '#EEF1F8',
    cssBackground:
      'radial-gradient(40% 35% at 25% 25%, rgba(191, 211, 255, 0.38) 0%, transparent 70%), radial-gradient(35% 30% at 75% 75%, rgba(255, 201, 227, 0.36) 0%, transparent 70%), linear-gradient(150deg, #E9EEF9, #F9E9F3)',
    gradient: {
      kind: 'linear',
      angle: 150,
      stops: [
        { color: '#E9EEF9', at: 0 },
        { color: '#F9E9F3', at: 100 },
      ],
    },
    blobs: [
      { xPct: 25, yPct: 25, rxPct: 40, ryPct: 35, color: '#BFD3FF', peakAlpha: 0.38, fadeAtPct: 70 },
      { xPct: 75, yPct: 75, rxPct: 35, ryPct: 30, color: '#FFC9E3', peakAlpha: 0.36, fadeAtPct: 70 },
    ],
    veilColor: 'rgba(255, 255, 255, 0.35)',
    backdropBlurPx: 24,
    moodTags: ['light', 'glass', 'frosted', 'cool', 'pastel'],
  },
  {
    id: 'bg-smoked-glass',
    name: 'Smoked Glass',
    category: 'glass',
    categoryLabel: 'Glass',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#0D0F14',
    cssBackground:
      'radial-gradient(44% 40% at 28% 24%, rgba(51, 65, 85, 0.38) 0%, transparent 70%), radial-gradient(38% 36% at 74% 72%, rgba(30, 41, 59, 0.38) 0%, transparent 70%), #0D0F14',
    blobs: [
      { xPct: 28, yPct: 24, rxPct: 44, ryPct: 40, color: '#334155', peakAlpha: 0.38, fadeAtPct: 70 },
      { xPct: 74, yPct: 72, rxPct: 38, ryPct: 36, color: '#1E293B', peakAlpha: 0.38, fadeAtPct: 70 },
    ],
    veilColor: 'rgba(0, 0, 0, 0.25)',
    backdropBlurPx: 28,
    moodTags: ['dark', 'glass', 'smoked', 'charcoal', 'tech'],
  },
  {
    id: 'bg-prism-glass',
    name: 'Prism Glass',
    category: 'glass',
    categoryLabel: 'Glass',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#0B1020',
    cssBackground:
      'radial-gradient(45% 40% at 20% 25%, rgba(34, 211, 238, 0.32) 0%, transparent 70%), radial-gradient(45% 40% at 80% 30%, rgba(167, 139, 250, 0.32) 0%, transparent 70%), radial-gradient(50% 45% at 50% 85%, rgba(244, 114, 182, 0.30) 0%, transparent 70%), #0B1020',
    blobs: [
      { xPct: 20, yPct: 25, rxPct: 45, ryPct: 40, color: '#22D3EE', peakAlpha: 0.32, fadeAtPct: 70 },
      { xPct: 80, yPct: 30, rxPct: 45, ryPct: 40, color: '#A78BFA', peakAlpha: 0.32, fadeAtPct: 70 },
      { xPct: 50, yPct: 85, rxPct: 50, ryPct: 45, color: '#F472B6', peakAlpha: 0.3, fadeAtPct: 70 },
    ],
    grainOpacity: 0.05,
    grainBlend: 'screen',
    moodTags: ['dark', 'cool', 'glass', 'prism', 'futuristic'],
  },

  // ── 6. GRAIN & TEXTURE (5) ──────────────────────────────────────────────────
  {
    id: 'bg-film-grain-light',
    name: 'Film Grain Light',
    category: 'grain-texture',
    categoryLabel: 'Grain & Texture',
    tier: 'free',
    tone: 'light',
    baseHex: '#F4F1EC',
    cssBackground: '#F4F1EC',
    grainOpacity: 0.1,
    grainBlend: 'multiply',
    grainFreq: 0.8,
    grainOctaves: 2,
    moodTags: ['light', 'grain', 'paper', 'editorial', 'press'],
  },
  {
    id: 'bg-film-grain-dark',
    name: 'Film Grain Dark',
    category: 'grain-texture',
    categoryLabel: 'Grain & Texture',
    tier: 'free',
    tone: 'dark',
    baseHex: '#101012',
    cssBackground: '#101012',
    grainOpacity: 0.12,
    grainBlend: 'screen',
    grainFreq: 0.8,
    grainOctaves: 2,
    moodTags: ['dark', 'grain', 'noir', 'editorial', 'night'],
  },
  {
    id: 'bg-washi-paper',
    name: 'Washi Paper',
    category: 'grain-texture',
    categoryLabel: 'Grain & Texture',
    tier: 'pro',
    tone: 'light',
    baseHex: '#F5F0E6',
    cssBackground: '#F5F0E6',
    grainOpacity: 0.08,
    grainBlend: 'multiply',
    grainFreq: 0.45,
    grainOctaves: 3,
    moodTags: ['light', 'warm', 'paper', 'oat', 'calm'],
  },
  {
    id: 'bg-stone-grain',
    name: 'Stone Grain',
    category: 'grain-texture',
    categoryLabel: 'Grain & Texture',
    tier: 'free',
    tone: 'light',
    baseHex: '#E3E5DC',
    cssBackground: '#E3E5DC',
    grainOpacity: 0.09,
    grainBlend: 'multiply',
    grainFreq: 0.6,
    grainOctaves: 3,
    moodTags: ['light', 'stone', 'moss', 'organic', 'grain'],
  },
  {
    id: 'bg-concrete',
    name: 'Concrete',
    category: 'grain-texture',
    categoryLabel: 'Grain & Texture',
    tier: 'pro',
    tone: 'light',
    baseHex: '#CBCDD1',
    cssBackground: 'linear-gradient(180deg, #D7D9DC 0%, #BFC2C7 100%)',
    gradient: {
      kind: 'linear',
      angle: 180,
      stops: [
        { color: '#D7D9DC', at: 0 },
        { color: '#BFC2C7', at: 100 },
      ],
    },
    grainOpacity: 0.14,
    grainBlend: 'multiply',
    grainFreq: 0.35,
    grainOctaves: 4,
    moodTags: ['light', 'grey', 'concrete', 'chrome', 'industrial'],
  },

  // ── 7. PATTERN (5) ──────────────────────────────────────────────────────────
  {
    id: 'bg-dot-matrix',
    name: 'Dot Matrix',
    category: 'pattern',
    categoryLabel: 'Pattern',
    tier: 'free',
    tone: 'light',
    baseHex: '#F7F7F5',
    cssBackground: '#F7F7F5',
    patternKind: 'dots',
    patternColor: 'rgba(17, 17, 17, 0.12)',
    patternSizePx: 16,
    moodTags: ['light', 'pattern', 'dots', 'minimal', 'studio'],
  },
  {
    id: 'bg-graph-sheet',
    name: 'Graph Sheet',
    category: 'pattern',
    categoryLabel: 'Pattern',
    tier: 'free',
    tone: 'light',
    baseHex: '#F2F6FB',
    cssBackground: '#F2F6FB',
    patternKind: 'grid',
    patternColor: 'rgba(169, 189, 214, 0.40)',
    patternSizePx: 32,
    moodTags: ['light', 'cool', 'pattern', 'grid', 'paper'],
  },
  {
    id: 'bg-neon-grid',
    name: 'Neon Grid',
    category: 'pattern',
    categoryLabel: 'Pattern',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#070A18',
    cssBackground: '#070A18',
    patternKind: 'grid',
    patternColor: 'rgba(0, 245, 212, 0.14)',
    patternSizePx: 40,
    vignetteOpacity: 0.45,
    moodTags: ['dark', 'cool', 'neon', 'grid', 'futuristic', 'cyber'],
  },
  {
    id: 'bg-contour-lines',
    name: 'Contour Lines',
    category: 'pattern',
    categoryLabel: 'Pattern',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#0F1A14',
    cssBackground: '#0F1A14',
    patternKind: 'contours',
    patternColor: 'rgba(46, 90, 68, 0.55)',
    patternSizePx: 320,
    moodTags: ['dark', 'green', 'topo', 'organic', 'pattern'],
  },
  {
    id: 'bg-soft-waves',
    name: 'Soft Waves',
    category: 'pattern',
    categoryLabel: 'Pattern',
    tier: 'pro',
    tone: 'light',
    baseHex: '#EFF6FF',
    cssBackground: '#EFF6FF',
    patternKind: 'lines',
    patternColor: 'rgba(147, 197, 253, 0.45)',
    patternSizePx: 240,
    moodTags: ['light', 'cool', 'waves', 'blue', 'pattern'],
  },

  // ── 8. ANIMATED (PRO) (3) ───────────────────────────────────────────────────
  {
    id: 'bg-drift-gradient',
    name: 'Drift Gradient',
    category: 'animated',
    categoryLabel: 'Animated (Pro)',
    tier: 'pro',
    tone: 'light',
    baseHex: '#E0E7FF',
    cssBackground: 'linear-gradient(120deg, #FFE3F1 0%, #E0E7FF 50%, #D1FAE5 100%)',
    gradient: {
      kind: 'linear',
      angle: 120,
      stops: [
        { color: '#FFE3F1', at: 0 },
        { color: '#E0E7FF', at: 50 },
        { color: '#D1FAE5', at: 100 },
      ],
    },
    isAnimated: true,
    animationKind: 'drift',
    moodTags: ['light', 'animated', 'pastel', 'holo', 'gradient'],
  },
  {
    id: 'bg-liquid-mesh',
    name: 'Liquid Mesh',
    category: 'animated',
    categoryLabel: 'Animated (Pro)',
    tier: 'pro',
    tone: 'dark',
    baseHex: '#080814',
    cssBackground:
      'radial-gradient(50% 45% at 22% 28%, rgba(124, 58, 237, 0.36) 0%, transparent 70%), radial-gradient(48% 48% at 78% 24%, rgba(6, 182, 212, 0.34) 0%, transparent 70%), radial-gradient(55% 48% at 52% 84%, rgba(244, 63, 94, 0.32) 0%, transparent 70%), #080814',
    blobs: [
      { xPct: 22, yPct: 28, rxPct: 50, ryPct: 45, color: '#7C3AED', peakAlpha: 0.36, fadeAtPct: 70 },
      { xPct: 78, yPct: 24, rxPct: 48, ryPct: 48, color: '#06B6D4', peakAlpha: 0.34, fadeAtPct: 70 },
      { xPct: 52, yPct: 84, rxPct: 55, ryPct: 48, color: '#F43F5E', peakAlpha: 0.32, fadeAtPct: 70 },
    ],
    isAnimated: true,
    animationKind: 'liquid',
    moodTags: ['dark', 'animated', 'mesh', 'neon', 'futuristic'],
  },
  {
    id: 'bg-shimmer-foil',
    name: 'Shimmer Foil',
    category: 'animated',
    categoryLabel: 'Animated (Pro)',
    tier: 'pro',
    tone: 'light',
    baseHex: '#E5E7EB',
    cssBackground: 'linear-gradient(135deg, #E5E7EB 0%, #F9FAFB 50%, #D1D5DB 100%)',
    gradient: {
      kind: 'linear',
      angle: 135,
      stops: [
        { color: '#E5E7EB', at: 0 },
        { color: '#F9FAFB', at: 50 },
        { color: '#D1D5DB', at: 100 },
      ],
    },
    isAnimated: true,
    animationKind: 'shimmer',
    moodTags: ['light', 'animated', 'silver', 'metallic', 'chrome'],
  },
] as const;

const BG_PRESET_MAP = new Map<string, CatalogBackgroundPreset>(
  CATALOG_BACKGROUNDS.map((b) => [b.id, b])
);

export function findCatalogBackground(id?: string | null): CatalogBackgroundPreset | null {
  if (!id || typeof id !== 'string') return null;
  return BG_PRESET_MAP.get(id.trim()) || null;
}

export function getFreeFallbackBackgroundId(presetId: string): string {
  const found = findCatalogBackground(presetId);
  if (!found) return 'bg-studio-white';
  return found.tone === 'dark' ? 'bg-ink-black' : found.tone === 'mid' ? 'bg-tangerine' : 'bg-studio-white';
}

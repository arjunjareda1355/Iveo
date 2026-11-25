// data-styles.ts: backgrounds, button recipes, layout options (names match the Appearance UI)
import type { Mood, UseCase } from './data-palettes.ts';

// ---------- BACKGROUND KINDS ----------
export type BgKind =
  | 'solid'
  | 'tonal'
  | 'soft-gradient'
  | 'gradient'
  | 'mesh'
  | 'aurora'
  | 'glass'
  | 'grain'
  | 'pattern'
  | 'animated';

export interface BgRecipe {
  kind: BgKind;
  label: string;
  moods: Mood[];
  weight: number;
  busy: boolean; // busy => buttons forced to solid/glass
  gradientLike: boolean; // gradient/mesh/aurora/glass/image style
  pro?: boolean;
}

export const BG_RECIPES: BgRecipe[] = [
  { kind: 'solid', label: 'Solid & Tonal', moods: ['minimal', 'calm', 'business', 'luxe', 'editorial'], weight: 3, busy: false, gradientLike: false },
  { kind: 'tonal', label: 'Solid & Tonal', moods: ['calm', 'warm', 'editorial', 'luxe'], weight: 3, busy: false, gradientLike: false },
  { kind: 'soft-gradient', label: 'Soft Gradient', moods: ['calm', 'warm', 'luxe', 'editorial', 'playful', 'cool'], weight: 4, busy: false, gradientLike: true },
  { kind: 'gradient', label: 'Gradient', moods: ['bold', 'playful', 'futuristic', 'warm'], weight: 2, busy: false, gradientLike: true },
  { kind: 'mesh', label: 'Mesh', moods: ['playful', 'futuristic', 'creator', 'bold'], weight: 2, busy: false, gradientLike: true },
  { kind: 'aurora', label: 'Aurora', moods: ['futuristic', 'cool', 'luxe', 'nature'], weight: 2, busy: false, gradientLike: true, pro: true },
  { kind: 'glass', label: 'Glass', moods: ['futuristic', 'minimal', 'cool', 'luxe'], weight: 1.5, busy: false, gradientLike: true, pro: true },
  { kind: 'grain', label: 'Grain & Texture', moods: ['retro', 'warm', 'editorial', 'calm'], weight: 2, busy: false, gradientLike: false },
  { kind: 'pattern', label: 'Pattern', moods: ['playful', 'retro', 'bold'], weight: 1, busy: true, gradientLike: false },
  { kind: 'animated', label: 'Animated', moods: ['futuristic', 'bold', 'playful'], weight: 1, busy: true, gradientLike: true, pro: true },
];

// ---------- BUTTON RECIPES ----------
export type Shape = 'square' | 'rounded' | 'pill';
export type Surface =
  | 'solid'
  | 'soft-shadow'
  | 'soft-tint'
  | 'outline'
  | 'glass'
  | '3d-offset'
  | 'gradient'
  | 'neon-glow'
  | 'metallic'
  | 'neumorphic'
  | 'underline'
  | 'sticker';

export interface SurfaceRecipe {
  surface: Surface;
  moods: Mood[];
  weight: number;
  needs?: { darkBg?: boolean; lightBg?: boolean; calmBg?: boolean; gradientBg?: boolean };
  hero?: boolean; // counts as a "loud" effect (max 1 per theme)
  hasOwnEdge?: boolean; // has border/shadow so low fill contrast is OK
  allowedOnBusy?: boolean; // ok on pattern/animated backgrounds
  pro?: boolean;
}

export const SURFACES: SurfaceRecipe[] = [
  { surface: 'solid', moods: ['minimal', 'business', 'bold', 'calm', 'creator'], weight: 4, allowedOnBusy: true },
  { surface: 'soft-shadow', moods: ['calm', 'minimal', 'warm', 'business'], weight: 3, hasOwnEdge: true },
  { surface: 'soft-tint', moods: ['calm', 'warm', 'nature', 'playful'], weight: 3, hasOwnEdge: true },
  { surface: 'outline', moods: ['editorial', 'minimal', 'luxe', 'cool'], weight: 3, hasOwnEdge: true },
  { surface: 'glass', moods: ['futuristic', 'luxe', 'cool', 'minimal'], weight: 2, needs: { gradientBg: true }, hasOwnEdge: true, allowedOnBusy: true },
  { surface: '3d-offset', moods: ['playful', 'retro', 'bold'], weight: 2, hero: true, hasOwnEdge: true },
  { surface: 'gradient', moods: ['bold', 'playful', 'warm', 'creator'], weight: 2, hero: true },
  { surface: 'neon-glow', moods: ['futuristic', 'bold'], weight: 1.5, needs: { darkBg: true }, hero: true, hasOwnEdge: true },
  { surface: 'metallic', moods: ['luxe', 'bold'], weight: 1.5, needs: { darkBg: true }, hero: true, pro: true },
  { surface: 'neumorphic', moods: ['calm', 'minimal'], weight: 1, needs: { lightBg: true, calmBg: true }, hasOwnEdge: true },
  { surface: 'underline', moods: ['editorial', 'minimal', 'luxe'], weight: 2.5, hasOwnEdge: true },
  { surface: 'sticker', moods: ['playful', 'retro', 'creator'], weight: 1.5, hero: true, hasOwnEdge: true },
];

export type Motion = 'none' | 'lift' | 'scale' | 'glow' | 'press';
export const MOTIONS: { v: Motion; moods: Mood[] }[] = [
  { v: 'none', moods: ['minimal', 'editorial', 'business'] },
  { v: 'lift', moods: ['calm', 'warm', 'creator', 'business', 'minimal'] },
  { v: 'scale', moods: ['playful', 'bold', 'creator'] },
  { v: 'glow', moods: ['futuristic', 'luxe', 'bold'] },
  { v: 'press', moods: ['retro', 'playful', 'bold'] },
];

// ---------- LAYOUT OPTIONS ----------
export type HeaderStyle = 'centered' | 'editorial' | 'compact-row' | 'hero';
export type AvatarFrame =
  | 'circle'
  | 'squircle'
  | 'rounded'
  | 'square'
  | 'hexagon'
  | 'halo'
  | 'double-ring'
  | 'gradient-ring'
  | 'sticker'
  | 'none';

export interface Opt<T> {
  v: T;
  moods: Mood[];
  useCases?: UseCase[];
  weight?: number;
}

export const HEADERS: Opt<HeaderStyle>[] = [
  { v: 'centered', moods: ['calm', 'minimal', 'luxe', 'business', 'warm'], weight: 4 },
  { v: 'editorial', moods: ['editorial', 'minimal', 'luxe'], useCases: ['artist', 'creator', 'student'], weight: 2 },
  { v: 'compact-row', moods: ['business', 'minimal', 'futuristic'], useCases: ['developer', 'business'], weight: 2 },
  { v: 'hero', moods: ['bold', 'playful', 'creator', 'luxe'], useCases: ['musician', 'influencer', 'artist'], weight: 2 },
];

export const AVATAR_FRAMES: Opt<AvatarFrame>[] = [
  { v: 'circle', moods: ['calm', 'minimal', 'business', 'creator'], weight: 3 },
  { v: 'squircle', moods: ['minimal', 'futuristic', 'playful'], weight: 2 },
  { v: 'rounded', moods: ['warm', 'playful', 'calm'], weight: 2 },
  { v: 'square', moods: ['editorial', 'bold', 'retro'], weight: 1.5 },
  { v: 'hexagon', moods: ['futuristic', 'bold'], useCases: ['developer', 'musician'], weight: 1 },
  { v: 'halo', moods: ['calm', 'luxe', 'warm'], weight: 2 },
  { v: 'double-ring', moods: ['luxe', 'editorial', 'warm'], weight: 2.5 },
  { v: 'gradient-ring', moods: ['playful', 'creator', 'futuristic', 'bold'], useCases: ['influencer', 'musician', 'creator'], weight: 2 },
  { v: 'sticker', moods: ['playful', 'retro'], weight: 1 },
  { v: 'none', moods: ['minimal', 'business'], weight: 0.5 },
];

export const AVATAR_SIZES = [72, 96, 128, 160] as const;
export type AvatarGlow = 'none' | 'soft' | 'accent';
export type LinkLayout = 'stack' | '2-column' | 'chips';
export type Spacing = 'compact' | 'balanced' | 'airy';
export type SocialIcons = 'outline' | 'filled' | 'glass';
export type CardLook = 'match-page' | 'brand' | 'banner' | 'glass' | 'compact' | 'profile-card' | 'with-posts';
export type Width = 'focused' | 'standard' | 'wide';
export type Entrance = 'none' | 'fade-up' | 'stagger-scale';

export const CARD_LOOKS: Opt<CardLook>[] = [
  { v: 'match-page', moods: ['minimal', 'luxe', 'editorial', 'calm', 'business'], weight: 4 },
  { v: 'brand', moods: ['business', 'creator', 'playful', 'bold'], weight: 2 },
  { v: 'banner', moods: ['creator', 'bold', 'playful'], useCases: ['musician', 'influencer', 'creator'], weight: 2 },
  { v: 'glass', moods: ['futuristic', 'luxe', 'cool'], weight: 1.5 },
  { v: 'compact', moods: ['minimal', 'business', 'calm'], useCases: ['business', 'developer', 'student'], weight: 2 },
  { v: 'profile-card', moods: ['business', 'creator', 'warm'], weight: 1.5 },
  { v: 'with-posts', moods: ['creator', 'playful'], useCases: ['influencer', 'creator'], weight: 1 },
];

/**
 * Section 7 Design Tokens & Schema v2 Data Model for Appearance System.
 */

export type Hex = `#${string}`;
export type Color = Hex | 'transparent' | `rgba(${number},${number},${number},${number})`;

export type AppearanceLock =
  | 'background'
  | 'btn.fill'
  | 'btn.text'
  | 'btn.border'
  | 'font.name'
  | 'font.bio'
  | 'font.button'
  | 'layout';

export type PatternOverlayType = 'none' | 'dots' | 'grid' | 'lines' | 'contours';

export interface PatternOverlay {
  kind: PatternOverlayType;
  opacity?: number; // 0..0.30 (stored 0..30 or 0..0.30; canonical normalized 0..30%)
}

export type Background =
  | {
      type: 'preset';
      id: string;
      grain?: number; // 0..40 (%)
      blur?: number; // 0..60 (px)
      vignette?: number; // 0..50 (%)
      tone?: number; // -20..+20
      pattern?: PatternOverlay;
      animate?: boolean; // Pro
    }
  | {
      type: 'solid';
      color: Hex;
    }
  | {
      type: 'gradient';
      kind: 'linear' | 'radial' | 'conic';
      angle: number; // 0..360
      stops: Array<{ color: Hex; at: number }>; // 2..4 stops, at 0..100
    }
  | {
      type: 'image'; // Pro
      assetId: string; // URL or asset identifier (/api/backgrounds/...)
      blur: number; // 0..40
      opacity: number; // 30..100
      brightness: number; // 60..120
      overlay?: { color: Hex; alpha: number }; // alpha 0..0.85
      focal: { x: number; y: number }; // 0..100
      smartScrim?: boolean; // default true
      luminanceGrid?: number[]; // 64 (8x8) Y values [0..1]
      dominantColors?: Hex[];
    }
  | {
      type: 'legacy';
      css: string;
      isDark?: boolean;
      baseHex?: Hex;
    };

export interface FontRole {
  family: string; // Display name or catalog ID (normalized via catalog lookup)
  weight: number; // 300..900
  size: 's' | 'm' | 'l';
  tracking: 'tight' | 'normal' | 'wide';
  case?: 'normal' | 'upper';
  lineHeight?: 'compact' | 'normal' | 'relaxed'; // primarily Bio
  source: 'vibe' | 'user' | 'suggestion';
}

export type ButtonSurface =
  | 'solid'
  | 'solid-soft'
  | 'soft-tint'
  | 'outline-hairline'
  | 'glass'
  | 'offset-3d'
  | 'gradient-flow'
  | 'neon-glow'
  | 'metallic'
  | 'neumorphic-soft'
  | 'underline-only'
  | 'sticker';

export type ButtonShapeV2 = 'square' | 'rounded' | 'pill' | 'custom';
export type ButtonMotion = 'none' | 'lift' | 'press' | 'shine';

export interface ButtonTokens {
  shape: ButtonShapeV2;
  radius: number; // 0..40 (derived unless shape = 'custom')
  fill: Color;
  text: Color;
  border: Color;
  borderWidth: 0 | 1 | 2 | 3 | 4;
  gradient?: { to: Hex; angle: number }; // for gradient-flow / metallic
  surface: ButtonSurface;
  size: 's' | 'm' | 'l';
  shadow: 'none' | 'soft' | 'deep';
  align: 'center' | 'left';
  icon: 'left' | 'right' | 'none';
  motion: ButtonMotion;
  tracking?: 'tight' | 'normal' | 'wide';
  case?: 'normal' | 'upper';
  weight?: 400 | 500 | 600 | 700;
  states: {
    hover?: Partial<{ fill: Color; text: Color; border: Color }>;
    pressed?: Partial<{ fill: Color; text: Color; border: Color }>;
  };
}

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

export type HeaderLayoutV2 = 'centered' | 'editorial' | 'compact' | 'hero';
export type LinkLayoutV2 = 'stack' | 'grid2' | 'chips';
export type SpacingV2 = 'compact' | 'balanced' | 'airy';
export type WidthV2 = 'focused' | 'standard' | 'wide';
export type EntranceV2 = 'none' | 'fade-up' | 'stagger-scale';
export type SocialIconsV2 = 'outline' | 'filled' | 'glass';
export type AvatarSizeV2 = 's' | 'm' | 'l' | 'xl';
export type AvatarGlowV2 = 'none' | 'soft' | 'accent';

export interface LayoutTokens {
  header: HeaderLayoutV2;
  avatar: {
    frame: AvatarFrame;
    size: AvatarSizeV2;
    glow?: AvatarGlowV2;
  };
  linkLayout: LinkLayoutV2;
  spacing: SpacingV2;
  width: WidthV2;
  entrance: EntranceV2;
  socialIcons: SocialIconsV2;
}

export interface Appearance {
  schemaVersion: 2;
  vibeId: string;
  background: Background;
  typography: {
    name: FontRole;
    bio: FontRole;
    button: FontRole;
  };
  buttons: ButtonTokens;
  layout: LayoutTokens;
  locks: AppearanceLock[];
  autoMatchButtons?: boolean; // new pages true, migrated false
  migratedFrom?: {
    vibe?: string;
    background?: string;
    at: string;
  };
  updatedAt?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  data: Appearance;
  createdAt: string;
  updatedAt?: string;
}

export interface HistorySnapshot {
  id: string;
  data: Appearance;
  createdAt: string;
}

export interface BgProfile {
  signature: string;
  meanL: number;
  meanC: number;
  meanHue: number;
  p05L: number;
  p95L: number;
  stdDevL: number;
  complexity: number; // clamp(stdDevL / 0.18, 0, 1)
  darkest: Hex;
  lightest: Hex;
  meanHex: Hex;
  tone: 'light' | 'mid' | 'dark';
  chromatic: boolean;
  warm: boolean;
  cool: boolean;
  isNonFlat: boolean;
  smartScrim?: { color: Hex; alpha: number } | null;
}

export interface ResolvedTokens {
  vibeId: string;
  vibeName: string;
  pageBg: string;
  pageText: Hex;
  pageMuted: string;
  pageAccent: Hex;
  focusRing: Hex;
  smartScrim: { color: Hex; alpha: number } | null;
  background: Background;
  bgProfile: BgProfile;
  typography: {
    name: FontRole & { cssFamily: string; fontId: string };
    bio: FontRole & { cssFamily: string; fontId: string };
    button: FontRole & { cssFamily: string; fontId: string };
  };
  buttons: ButtonTokens & {
    derivedRadius: number;
    heightPx: number;
    paddingXPx: number;
    fontSizePx: number;
    derivedHover: { fill: Color; text: Color; border: Color };
    derivedPressed: { fill: Color; text: Color; border: Color };
  };
  layout: LayoutTokens & {
    gapPx: number;
    columnWidthPx: number;
    avatarSizePx: number;
  };
  cssVars: Record<string, string>;
  downgradedProFields: string[];
}

export const THEME_LIMITS = {
  free: 1,
  pro: 10,
} as const;

export const MAX_HISTORY_SNAPSHOTS = 20;
export const HISTORY_COALESCE_MS = 2000;

export const SYSTEM_DEFAULT_APPEARANCE: Appearance = {
  schemaVersion: 2,
  vibeId: 'porcelain',
  background: { type: 'preset', id: 'bg-studio-white' },
  typography: {
    name: { family: 'Plus Jakarta Sans', weight: 700, size: 'm', tracking: 'normal', case: 'normal', source: 'vibe' },
    bio: { family: 'Inter', weight: 400, size: 'm', tracking: 'normal', lineHeight: 'normal', source: 'vibe' },
    button: { family: 'Inter', weight: 500, size: 'm', tracking: 'normal', case: 'normal', source: 'vibe' },
  },
  buttons: {
    shape: 'rounded',
    radius: 14,
    fill: '#121212',
    text: '#FFFFFF',
    border: '#121212',
    borderWidth: 0,
    surface: 'solid-soft',
    size: 'm',
    shadow: 'soft',
    align: 'center',
    icon: 'left',
    motion: 'lift',
    states: {},
  },
  layout: {
    header: 'centered',
    avatar: { frame: 'circle', size: 'm', glow: 'none' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    entrance: 'fade-up',
    socialIcons: 'outline',
  },
  locks: [],
  autoMatchButtons: true,
};

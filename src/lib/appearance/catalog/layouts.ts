/**
 * Section 10.6 Avatar Frames (10) & Section 10.7 Layout Recipes (12).
 */
import type {
  AvatarFrame,
  AvatarGlowV2,
  AvatarSizeV2,
  ButtonMotion,
  ButtonShapeV2,
  ButtonSurface,
  EntranceV2,
  HeaderLayoutV2,
  LinkLayoutV2,
  SpacingV2,
  WidthV2,
} from '../types.ts';

export interface CatalogAvatarFrame {
  id: AvatarFrame;
  label: string;
}

export const CATALOG_AVATAR_FRAMES: readonly CatalogAvatarFrame[] = [
  { id: 'circle', label: 'Circle' },
  { id: 'squircle', label: 'Squircle' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'halo', label: 'Halo' },
  { id: 'double-ring', label: 'Double ring' },
  { id: 'gradient-ring', label: 'Gradient ring' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'none', label: 'None' },
] as const;

export const AVATAR_SIZE_PX: Record<AvatarSizeV2, number> = {
  s: 72,
  m: 96,
  l: 128,
  xl: 160,
};

export const SPACING_GAP_PX: Record<SpacingV2, number> = {
  compact: 8,
  balanced: 14,
  airy: 22,
};

export const COLUMN_WIDTH_PX: Record<WidthV2, number> = {
  focused: 440,
  standard: 560,
  wide: 720,
};

export const BUTTON_HEIGHT_PX: Record<'s' | 'm' | 'l', number> = {
  s: 46,
  m: 56,
  l: 68,
};

export const BUTTON_PX: Record<'s' | 'm' | 'l', number> = {
  s: 20,
  m: 24,
  l: 28,
};

export const BUTTON_FONT_SIZE_PX: Record<'s' | 'm' | 'l', number> = {
  s: 14,
  m: 16,
  l: 17,
};

export interface LayoutRecipe {
  id: string;
  name: string;
  moods: readonly string[];
  header: HeaderLayoutV2;
  avatar: { frame: AvatarFrame; size: AvatarSizeV2; glow?: AvatarGlowV2 };
  linkLayout: LinkLayoutV2;
  spacing: SpacingV2;
  width: WidthV2;
  surface: ButtonSurface;
  buttonSize: 's' | 'm' | 'l';
  motion: ButtonMotion;
  entrance: EntranceV2;
  align?: 'center' | 'left';
  icon?: 'left' | 'right' | 'none';
  shape?: ButtonShapeV2;
  radius?: number;
  borderWidth?: 0 | 1 | 2 | 3 | 4;
  requires?:
    | 'any'
    | 'light_or_dark_low_complexity'
    | 'c1_glass'
    | 'c4_low_complexity_short'
    | 'chromatic_bg'
    | 'light_bg_soft'
    | 'c2_dark'
    | 'c5_metallic'
    | 'c4_low_complexity'
    | 'c6_contrast7'
    | 'short_labels';
}

export const LAYOUT_RECIPES: readonly LayoutRecipe[] = [
  {
    id: 'clean-stack',
    name: 'Clean Stack',
    moods: ['modern', 'calm'],
    header: 'centered',
    avatar: { frame: 'circle', size: 'm' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    surface: 'solid-soft',
    buttonSize: 'm',
    motion: 'lift',
    entrance: 'fade-up',
    requires: 'any',
  },
  {
    id: 'editorial-left',
    name: 'Editorial Left',
    moods: ['editorial', 'luxury'],
    header: 'editorial',
    avatar: { frame: 'squircle', size: 's' },
    linkLayout: 'stack',
    spacing: 'airy',
    width: 'focused',
    surface: 'outline-hairline',
    buttonSize: 'm',
    align: 'left',
    icon: 'right',
    motion: 'none',
    entrance: 'fade-up',
    requires: 'light_or_dark_low_complexity',
  },
  {
    id: 'glass-float',
    name: 'Glass Float',
    moods: ['futuristic'],
    header: 'centered',
    avatar: { frame: 'halo', size: 'l', glow: 'soft' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    surface: 'glass',
    buttonSize: 'm',
    motion: 'shine',
    entrance: 'stagger-scale',
    requires: 'c1_glass',
  },
  {
    id: 'brutal-grid',
    name: 'Brutal Grid',
    moods: ['bold', 'playful'],
    header: 'editorial',
    avatar: { frame: 'sticker', size: 'm' },
    linkLayout: 'grid2',
    spacing: 'compact',
    width: 'wide',
    surface: 'offset-3d',
    shape: 'square',
    radius: 0,
    borderWidth: 3,
    buttonSize: 'l',
    motion: 'press',
    entrance: 'none',
    requires: 'c4_low_complexity_short',
  },
  {
    id: 'compact-pro',
    name: 'Compact Pro',
    moods: ['modern', 'techy'],
    header: 'compact',
    avatar: { frame: 'rounded', size: 's' },
    linkLayout: 'stack',
    spacing: 'compact',
    width: 'focused',
    surface: 'solid',
    buttonSize: 's',
    motion: 'none',
    entrance: 'none',
    requires: 'any',
  },
  {
    id: 'hero-spotlight',
    name: 'Hero Spotlight',
    moods: ['bold', 'luxury'],
    header: 'hero',
    avatar: { frame: 'gradient-ring', size: 'xl', glow: 'accent' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    surface: 'gradient-flow',
    buttonSize: 'l',
    motion: 'lift',
    entrance: 'stagger-scale',
    requires: 'chromatic_bg',
  },
  {
    id: 'soft-cards',
    name: 'Soft Cards',
    moods: ['calm', 'friendly'],
    header: 'centered',
    avatar: { frame: 'squircle', size: 'm' },
    linkLayout: 'stack',
    spacing: 'airy',
    width: 'standard',
    surface: 'soft-tint',
    shape: 'custom',
    radius: 18,
    buttonSize: 'l',
    motion: 'none',
    entrance: 'fade-up',
    requires: 'light_bg_soft',
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    moods: ['futuristic', 'techy'],
    header: 'editorial',
    avatar: { frame: 'hexagon', size: 'm', glow: 'accent' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    surface: 'neon-glow',
    buttonSize: 'm',
    motion: 'shine',
    entrance: 'fade-up',
    requires: 'c2_dark',
  },
  {
    id: 'luxe-minimal',
    name: 'Luxe Minimal',
    moods: ['luxury'],
    header: 'centered',
    avatar: { frame: 'double-ring', size: 'l' },
    linkLayout: 'stack',
    spacing: 'airy',
    width: 'focused',
    surface: 'metallic',
    shape: 'pill',
    buttonSize: 'm',
    motion: 'none',
    entrance: 'fade-up',
    requires: 'c5_metallic',
  },
  {
    id: 'playful-stickers',
    name: 'Playful Stickers',
    moods: ['playful'],
    header: 'centered',
    avatar: { frame: 'sticker', size: 'l' },
    linkLayout: 'stack',
    spacing: 'balanced',
    width: 'standard',
    surface: 'sticker',
    shape: 'pill',
    buttonSize: 'l',
    motion: 'press',
    entrance: 'stagger-scale',
    requires: 'c4_low_complexity',
  },
  {
    id: 'paper-press',
    name: 'Paper Press',
    moods: ['editorial', 'classic'],
    header: 'editorial',
    avatar: { frame: 'square', size: 's' },
    linkLayout: 'stack',
    spacing: 'airy',
    width: 'focused',
    surface: 'underline-only',
    buttonSize: 'm',
    align: 'left',
    icon: 'right',
    motion: 'none',
    entrance: 'none',
    requires: 'c6_contrast7',
  },
  {
    id: 'wide-showcase',
    name: 'Wide Showcase',
    moods: ['modern', 'portfolio'],
    header: 'compact',
    avatar: { frame: 'rounded', size: 'm' },
    linkLayout: 'grid2',
    spacing: 'balanced',
    width: 'wide',
    surface: 'solid',
    buttonSize: 'm',
    motion: 'lift',
    entrance: 'fade-up',
    requires: 'short_labels',
  },
] as const;

export function getAvatarClipAndRadiusCss(frame: AvatarFrame, sizePx: number): {
  borderRadius: string;
  clipPath?: string;
} {
  switch (frame) {
    case 'square':
    case 'none':
      return { borderRadius: '0px' };
    case 'rounded':
      return { borderRadius: '22%' };
    case 'squircle':
      return { borderRadius: '32%' };
    case 'hexagon':
      return {
        borderRadius: '0px',
        clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
      };
    case 'circle':
    case 'halo':
    case 'double-ring':
    case 'gradient-ring':
    case 'sticker':
    default:
      return { borderRadius: `${Math.max(sizePx, 9999)}px` };
  }
}

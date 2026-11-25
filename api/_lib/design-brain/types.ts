// types.ts: the Theme object the brain outputs.
import type { Hex } from './util.ts';
import type { Mood, UseCase } from './data-palettes.ts';
import type {
  BgKind,
  Shape,
  Surface,
  Motion,
  HeaderStyle,
  AvatarFrame,
  AvatarGlow,
  LinkLayout,
  Spacing,
  SocialIcons,
  CardLook,
  Width,
  Entrance,
} from './data-styles.ts';

export interface GradientStop {
  color: Hex;
  pos: number;
}

export interface Theme {
  vibe: { id: string; name: string; tagline: string; moods: Mood[] };
  page: {
    mode: 'light' | 'dark';
    text: Hex;
    muted: Hex;
    accent: Hex;
    accent2: Hex;
    surface: Hex;
  };
  background: {
    kind: BgKind;
    name: string;
    color: Hex; // base colour (always set; worst-case fallback)
    gradient?: { type: 'linear' | 'radial' | 'conic'; angle: number; stops: GradientStop[] };
    grain?: number; // 0..1
  };
  typography: { name: string; bio: string; buttons: string };
  buttons: {
    shape: Shape;
    surface: Surface;
    fill: Hex;
    fillTransparent: boolean;
    text: Hex;
    border: Hex;
    borderWidth: 0 | 1 | 2 | 3 | 4;
    height: 46 | 56 | 68;
    shadow: 'none' | 'soft' | 'deep';
    weight: 400 | 500 | 600 | 700;
    case: 'normal' | 'upper';
    tracking: 'tight' | 'normal' | 'wide';
    motion: Motion;
  };
  layout: {
    header: HeaderStyle;
    avatarFrame: AvatarFrame;
    avatarSize: 72 | 96 | 128 | 160;
    avatarGlow: AvatarGlow;
    linkLayout: LinkLayout;
    spacing: Spacing;
    socialIcons: SocialIcons;
    cardLook: CardLook;
    width: Width;
    entrance: Entrance;
  };
  meta: {
    seed: string;
    name: string;
    palette: string;
    moods: Mood[];
    score: number;
    why: string;
    contrast: { body: number; button: number; badge: 'AAA' | 'AA' | 'AA Large' | 'Fail' };
    dots: Hex[]; // colour dots for suggestion cards
  };
}

export interface Context {
  seed?: string;
  mood?: Mood;
  useCase?: UseCase;
  plan?: 'free' | 'pro';
  photoColors?: Hex[];
  bio?: string;
  linkTypes?: string[];
  locked?: Partial<Record<'vibe' | 'background' | 'typography' | 'buttons' | 'layout', boolean>>;
  current?: Partial<Theme>; // the user's current theme, for section suggestions + locks
}

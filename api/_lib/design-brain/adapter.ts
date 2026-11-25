// adapter.ts: maps Brain output (Theme) -> Iveo V2 Appearance schema (with free/pro & lock preservation)
import type {
  Appearance,
  AppearanceLock,
  AvatarFrame,
  AvatarGlowV2,
  Background,
  ButtonShapeV2,
  ButtonSurface,
  ButtonTokens,
  FontRole,
  HeaderLayoutV2,
  Hex,
  LayoutTokens,
  LinkLayoutV2,
  SocialIconsV2,
} from '../../../src/lib/appearance/types.ts';
import {
  CATALOG_VIBES,
  findCatalogVibe,
  getFreeFallbackVibeId,
} from '../../../src/lib/appearance/catalog/vibes.ts';
import { findCatalogBackground } from '../../../src/lib/appearance/catalog/backgrounds.ts';
import {
  CATALOG_FONTS,
  clampWeightToFont,
  findCatalogFont,
  isFontAllowedForRole,
} from '../../../src/lib/appearance/catalog/fonts.ts';
import {
  CATALOG_SURFACES,
  checkSurfaceCompatibility,
  getFreeFallbackSurface,
} from '../../../src/lib/appearance/catalog/surfaces.ts';
import { CATALOG_AVATAR_FRAMES } from '../../../src/lib/appearance/catalog/layouts.ts';
import { analyzeBackground } from '../../../src/lib/color/analyze.ts';
import type { CardLookStyle } from '../../../src/data/types.ts';
import type { Context, Theme } from './types.ts';
import type { CardLook, Surface } from './data-styles.ts';
import { isDark } from './util.ts';

const VALID_FRAME_SET = new Set(CATALOG_AVATAR_FRAMES.map((f) => f.id));

const BRAIN_TO_IVEO_VIBE: Record<string, string> = {
  'burgundy-library': 'burgundy-library',
  porcelain: 'porcelain',
  'oat-milk': 'oat-milk',
  'dawn-mist': 'dawn-mist',
  celadon: 'celadon',
  'rose-quartz': 'rose-quartz',
  obsidian: 'obsidian',
  eclipse: 'eclipse',
  'onyx-gold': 'onyx-gold',
  'terracotta-sun': 'terracotta',
  'deep-forest': 'moss-stone',
  'lavender-haze': 'holo-foil',
  'peach-fizz': 'bubblegum',
  'ocean-deep': 'aqua-pulse',
  'neon-nights': 'neon-grid',
  'golden-hour': 'tangerine-pop',
  'paper-press': 'ivory-press',
  'midnight-plum': 'ultraviolet',
  'citrus-pop': 'tangerine-pop',
  'studio-mono': 'graphite-mono',
};

const BRAIN_TO_IVEO_SURFACE: Record<Surface, ButtonSurface> = {
  solid: 'solid',
  'soft-shadow': 'solid-soft',
  'soft-tint': 'soft-tint',
  outline: 'outline-hairline',
  glass: 'glass',
  '3d-offset': 'offset-3d',
  gradient: 'gradient-flow',
  'neon-glow': 'neon-glow',
  metallic: 'metallic',
  neumorphic: 'neumorphic-soft',
  underline: 'underline-only',
  sticker: 'sticker',
};

const IVEO_TO_BRAIN_SURFACE: Record<ButtonSurface, Surface> = {
  solid: 'solid',
  'solid-soft': 'soft-shadow',
  'soft-tint': 'soft-tint',
  'outline-hairline': 'outline',
  glass: 'glass',
  'offset-3d': '3d-offset',
  'gradient-flow': 'gradient',
  'neon-glow': 'neon-glow',
  metallic: 'metallic',
  'neumorphic-soft': 'neumorphic',
  'underline-only': 'underline',
  sticker: 'sticker',
};

const BRAIN_TO_IVEO_CARD_LOOK: Record<CardLook, CardLookStyle> = {
  'match-page': 'match_page',
  brand: 'brand',
  banner: 'banner',
  glass: 'glass',
  compact: 'compact',
  'profile-card': 'profile_card',
  'with-posts': 'with_posts',
};

const IVEO_TO_BRAIN_CARD_LOOK: Record<CardLookStyle, CardLook> = {
  match_page: 'match-page',
  brand: 'brand',
  banner: 'banner',
  glass: 'glass',
  compact: 'compact',
  profile_card: 'profile-card',
  with_posts: 'with-posts',
};

function normalizeHex6(raw: string, fallback: Hex = '#121212'): Hex {
  const s = (raw || '').trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(s)) return s as Hex;
  if (/^#[0-9A-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` as Hex;
  }
  return fallback;
}

function getFreeFallbackFontFamily(
  desiredCategory: 'sans' | 'serif' | 'display' | 'mono' | 'script' | 'rounded',
  role: 'N' | 'B' | 'T'
): string {
  if (desiredCategory === 'mono' && role !== 'B') return 'Geist Mono';
  if (desiredCategory === 'serif') return role === 'B' ? 'Merriweather' : 'Newsreader';
  if (desiredCategory === 'display' && role === 'N') return 'Space Grotesk';
  if (role === 'N') return 'Plus Jakarta Sans';
  if (role === 'B') return 'Inter';
  return 'DM Sans';
}

function resolveCatalogFontForRole(
  familyName: string,
  role: 'N' | 'B' | 'T',
  desiredWeight: number,
  plan: 'free' | 'pro'
): { family: string; weight: number } {
  const match = findCatalogFont(familyName);
  let chosen = match;

  if (!chosen || !isFontAllowedForRole(chosen, role) || (plan === 'free' && chosen.tier === 'pro')) {
    const fallbackFamily = getFreeFallbackFontFamily(chosen?.category || 'sans', role);
    chosen =
      findCatalogFont(fallbackFamily) ||
      CATALOG_FONTS.find((f) => f.tier === 'free' && isFontAllowedForRole(f, role)) ||
      CATALOG_FONTS[0];
  }

  return {
    family: chosen.family,
    weight: clampWeightToFont(chosen, desiredWeight),
  };
}

function mapBrainBackground(t: Theme, plan: 'free' | 'pro'): Background {
  const baseHex = normalizeHex6(t.background.color, '#121212');

  if (t.background.gradient && Array.isArray(t.background.gradient.stops) && t.background.gradient.stops.length >= 2) {
    const g = t.background.gradient;
    const stops = g.stops
      .slice(0, 4)
      .map((s) => ({
        color: normalizeHex6(s.color, baseHex),
        at: Math.max(0, Math.min(100, Math.round(Number(s.pos) || 0))),
      }))
      .sort((a, b) => a.at - b.at);

    if (stops.length >= 2) {
      return {
        type: 'gradient',
        kind: g.type === 'radial' || g.type === 'conic' ? g.type : 'linear',
        angle: Math.max(0, Math.min(360, Math.round(Number(g.angle) || 135))),
        stops,
      };
    }
  }

  if (t.background.kind === 'grain') {
    const grainPresetId = isDark(baseHex) ? 'bg-film-grain-dark' : 'bg-washi-paper';
    const presetMeta = findCatalogBackground(grainPresetId);
    if (presetMeta && (plan === 'pro' || presetMeta.tier === 'free')) {
      return {
        type: 'preset',
        id: presetMeta.id,
        grain: Math.max(0, Math.min(40, Math.round((t.background.grain ?? 0.25) * 40))),
      };
    }
  }

  return {
    type: 'solid',
    color: baseHex,
  };
}

function mapShapeRadius(shape: Theme['buttons']['shape']): { shape: ButtonShapeV2; radius: number } {
  if (shape === 'square') return { shape: 'square', radius: 0 };
  if (shape === 'pill') return { shape: 'pill', radius: 40 };
  return { shape: 'rounded', radius: 14 };
}

function mapMotion(motion: Theme['buttons']['motion']): ButtonTokens['motion'] {
  if (motion === 'scale') return 'lift';
  if (motion === 'glow') return 'shine';
  if (motion === 'press') return 'press';
  if (motion === 'lift') return 'lift';
  return 'none';
}

function mapAvatarSize(size: number, header: HeaderLayoutV2): LayoutTokens['avatar']['size'] {
  let mapped: LayoutTokens['avatar']['size'] =
    size <= 72 ? 's' : size <= 96 ? 'm' : size <= 128 ? 'l' : 'xl';
  if (header === 'hero' && (mapped === 's' || mapped === 'm')) {
    mapped = 'l';
  }
  return mapped;
}

export function mapIveoLocksToBrain(locks: AppearanceLock[] = []): Context['locked'] {
  const locked: NonNullable<Context['locked']> = {};
  if (locks.includes('background')) locked.background = true;
  if (locks.includes('layout')) locked.layout = true;
  if (locks.includes('font.name') && locks.includes('font.bio') && locks.includes('font.button')) {
    locked.typography = true;
  }
  if (locks.includes('btn.fill') && locks.includes('btn.text') && locks.includes('btn.border')) {
    locked.buttons = true;
  }
  return locked;
}

export function fromIveoAppearance(
  appearance: Appearance,
  plan: 'free' | 'pro' = 'free',
  cardLook: CardLookStyle = 'match_page'
): Partial<Theme> {
  const vibeMeta = findCatalogVibe(appearance.vibeId) || CATALOG_VIBES[0];
  const bgProf = analyzeBackground(appearance.background, { pageTextHex: vibeMeta.page.text });

  const bg: Theme['background'] =
    appearance.background.type === 'gradient'
      ? {
          kind: 'gradient',
          name: 'Gradient',
          color: normalizeHex6(appearance.background.stops[0]?.color || bgProf.meanHex),
          gradient: {
            type: appearance.background.kind,
            angle: appearance.background.angle,
            stops: appearance.background.stops.map((s) => ({ color: s.color, pos: s.at })),
          },
        }
      : {
          kind: bgProf.isNonFlat ? 'tonal' : 'solid',
          name: bgProf.tone === 'dark' ? 'Dark' : 'Solid',
          color: normalizeHex6(bgProf.meanHex),
        };

  const mappedSurface: Surface = IVEO_TO_BRAIN_SURFACE[appearance.buttons.surface] || 'solid';
  const shape = appearance.buttons.shape === 'custom' ? 'rounded' : appearance.buttons.shape;
  const fillTransparent = appearance.buttons.fill === 'transparent';

  return {
    vibe: {
      id: vibeMeta.id in BRAIN_TO_IVEO_VIBE ? vibeMeta.id : 'porcelain',
      name: vibeMeta.name,
      tagline: vibeMeta.tagline,
      moods: (vibeMeta.moods as any) || ['modern'],
    },
    page: {
      mode: bgProf.tone === 'dark' ? 'dark' : 'light',
      text: normalizeHex6(vibeMeta.page.text),
      muted: normalizeHex6(vibeMeta.page.muted),
      accent: normalizeHex6(vibeMeta.page.accent),
      accent2: normalizeHex6(vibeMeta.page.accent),
      surface: normalizeHex6(bgProf.meanHex),
    },
    background: bg,
    typography: {
      name: appearance.typography.name.family,
      bio: appearance.typography.bio.family,
      buttons: appearance.typography.button.family,
    },
    buttons: {
      shape,
      surface: mappedSurface,
      fill: fillTransparent ? bg.color : normalizeHex6(String(appearance.buttons.fill), '#121212'),
      fillTransparent,
      text: normalizeHex6(String(appearance.buttons.text), '#FFFFFF'),
      border:
        appearance.buttons.border === 'transparent'
          ? normalizeHex6(String(appearance.buttons.text), '#FFFFFF')
          : normalizeHex6(String(appearance.buttons.border), '#121212'),
      borderWidth: appearance.buttons.borderWidth,
      height: appearance.buttons.size === 's' ? 46 : appearance.buttons.size === 'l' ? 68 : 56,
      shadow: appearance.buttons.shadow,
      weight: (appearance.buttons.weight || 500) as 400 | 500 | 600 | 700,
      case: appearance.buttons.case === 'upper' ? 'upper' : 'normal',
      tracking: appearance.buttons.tracking || 'normal',
      motion:
        appearance.buttons.motion === 'shine'
          ? 'glow'
          : appearance.buttons.motion === 'press'
            ? 'press'
            : appearance.buttons.motion === 'lift'
              ? 'lift'
              : 'none',
    },
    layout: {
      header: appearance.layout.header === 'compact' ? 'compact-row' : appearance.layout.header,
      avatarFrame: appearance.layout.avatar.frame as any,
      avatarSize:
        appearance.layout.avatar.size === 's'
          ? 72
          : appearance.layout.avatar.size === 'l'
            ? 128
            : appearance.layout.avatar.size === 'xl'
              ? 160
              : 96,
      avatarGlow: (appearance.layout.avatar.glow || 'none') as AvatarGlowV2,
      linkLayout: appearance.layout.linkLayout === 'grid2' ? '2-column' : appearance.layout.linkLayout,
      spacing: appearance.layout.spacing,
      socialIcons: appearance.layout.socialIcons,
      cardLook: IVEO_TO_BRAIN_CARD_LOOK[cardLook] || 'match-page',
      width: appearance.layout.width,
      entrance: appearance.layout.entrance,
    },
    ...(plan ? {} : {}),
  };
}

export interface IveoAdaptedOutput {
  appearance: Appearance;
  cardLook: CardLookStyle;
  meta: Theme['meta'];
}

export function applyPatch(current: Theme, patch: Partial<Theme>): Theme {
  return { ...current, ...patch, page: { ...current.page, ...(patch.page ?? {}) } } as Theme;
}

export function toIveoAppearance(
  t: Theme,
  opts?: {
    plan?: 'free' | 'pro';
    locks?: AppearanceLock[];
    autoMatchButtons?: boolean;
    currentAppearance?: Appearance;
  }
): IveoAdaptedOutput {
  const plan: 'free' | 'pro' = opts?.plan ?? 'free';
  const locks = Array.isArray(opts?.locks)
    ? opts!.locks
    : Array.isArray(opts?.currentAppearance?.locks)
      ? opts!.currentAppearance!.locks
      : [];
  const cur = opts?.currentAppearance;

  // 1. Vibe ID mapped to CATALOG_VIBES + plan-gated
  const rawVibeId = BRAIN_TO_IVEO_VIBE[t.vibe.id] || 'porcelain';
  const validVibeId = findCatalogVibe(rawVibeId)?.id || 'porcelain';
  const vibeId = plan === 'free' ? getFreeFallbackVibeId(validVibeId) : validVibeId;
  const vibeMeta = findCatalogVibe(vibeId) || CATALOG_VIBES[0];

  // 2. Background mapped + lock-preserved
  const mappedBg =
    locks.includes('background') && cur?.background ? cur.background : mapBrainBackground(t, plan);
  const bgProfile = analyzeBackground(mappedBg, {
    pageTextHex: normalizeHex6(t.page.text || vibeMeta.page.text) as Hex,
  });

  // 3. Typography mapped (<= 3 families, role-safe, plan-gated) + lock-preserved
  const nameMapped = resolveCatalogFontForRole(t.typography.name, 'N', 700, plan);
  const bioMapped = resolveCatalogFontForRole(t.typography.bio, 'B', 400, plan);
  const buttonMapped = resolveCatalogFontForRole(t.typography.buttons, 'T', t.buttons.weight || 500, plan);

  const nameRole: FontRole =
    locks.includes('font.name') && cur?.typography?.name
      ? cur.typography.name
      : {
          family: nameMapped.family,
          weight: nameMapped.weight,
          size: 'm',
          tracking: 'normal',
          case: 'normal',
          source: 'suggestion',
        };
  const bioRole: FontRole =
    locks.includes('font.bio') && cur?.typography?.bio
      ? cur.typography.bio
      : {
          family: bioMapped.family,
          weight: bioMapped.weight,
          size: 'm',
          tracking: 'normal',
          lineHeight: 'normal',
          source: 'suggestion',
        };
  const buttonFontRole: FontRole =
    locks.includes('font.button') && cur?.typography?.button
      ? cur.typography.button
      : {
          family: buttonMapped.family,
          weight: buttonMapped.weight,
          size: 'm',
          tracking: t.buttons.tracking,
          case: t.buttons.case === 'upper' ? 'upper' : 'normal',
          source: 'suggestion',
        };

  // 4. Button surface + colors mapped, compatibility checked, plan-gated, and lock-preserved
  let mappedSurface: ButtonSurface = BRAIN_TO_IVEO_SURFACE[t.buttons.surface] || 'solid';
  if (plan === 'free') {
    const surfMeta = CATALOG_SURFACES.find((s) => s.id === mappedSurface);
    if (!surfMeta || surfMeta.tier === 'pro') {
      mappedSurface = getFreeFallbackSurface(mappedSurface);
    }
  }
  const compat = checkSurfaceCompatibility(
    mappedSurface,
    bgProfile,
    mappedBg,
    t.page.accent,
    t.page.text
  );
  if (!compat.allowed) {
    mappedSurface = plan === 'free' ? 'solid-soft' : 'solid';
  }

  const { shape, radius } = mapShapeRadius(t.buttons.shape);
  const isTransparentFill =
    t.buttons.fillTransparent ||
    mappedSurface === 'outline-hairline' ||
    mappedSurface === 'glass' ||
    mappedSurface === 'underline-only' ||
    mappedSurface === 'neon-glow';

  const nextFill =
    locks.includes('btn.fill') && cur?.buttons?.fill
      ? cur.buttons.fill
      : isTransparentFill
        ? 'transparent'
        : normalizeHex6(t.buttons.fill, '#121212');
  const nextText =
    locks.includes('btn.text') && cur?.buttons?.text
      ? cur.buttons.text
      : normalizeHex6(t.buttons.text, '#FFFFFF');
  const nextBorder =
    locks.includes('btn.border') && cur?.buttons?.border
      ? cur.buttons.border
      : t.buttons.border
        ? normalizeHex6(t.buttons.border, normalizeHex6(t.buttons.text, '#121212'))
        : nextFill === 'transparent'
          ? normalizeHex6(nextText, '#121212')
          : nextFill;

  const buttons: ButtonTokens = {
    shape,
    radius,
    fill: nextFill,
    text: nextText,
    border: nextBorder,
    borderWidth:
      mappedSurface === 'outline-hairline' && t.buttons.borderWidth === 0
        ? 1
        : t.buttons.borderWidth,
    surface: mappedSurface,
    ...(mappedSurface === 'gradient-flow' || mappedSurface === 'metallic'
      ? { gradient: { to: normalizeHex6(t.page.accent2 || t.page.accent), angle: 90 } }
      : {}),
    size: t.buttons.height === 46 ? 's' : t.buttons.height === 68 ? 'l' : 'm',
    shadow: t.buttons.shadow,
    align: cur?.buttons?.align || 'center',
    icon: cur?.buttons?.icon || 'left',
    motion: mapMotion(t.buttons.motion),
    tracking: t.buttons.tracking,
    case: t.buttons.case === 'upper' ? 'upper' : 'normal',
    weight: t.buttons.weight,
    states: {},
  };

  // 5. Layout mapped + lock-preserved
  const header: HeaderLayoutV2 =
    t.layout.header === 'compact-row' ? 'compact' : (t.layout.header as HeaderLayoutV2);
  const frameCandidate = t.layout.avatarFrame as AvatarFrame;
  const frame: AvatarFrame = VALID_FRAME_SET.has(frameCandidate) ? frameCandidate : 'circle';
  const layout: LayoutTokens =
    locks.includes('layout') && cur?.layout
      ? cur.layout
      : {
          header,
          avatar: {
            frame,
            size: mapAvatarSize(t.layout.avatarSize, header),
            glow: t.layout.avatarGlow as AvatarGlowV2,
          },
          linkLayout: (t.layout.linkLayout === '2-column'
            ? 'grid2'
            : t.layout.linkLayout) as LinkLayoutV2,
          spacing: t.layout.spacing,
          width: t.layout.width,
          entrance: t.layout.entrance,
          socialIcons: t.layout.socialIcons as SocialIconsV2,
        };

  const appearance: Appearance = {
    schemaVersion: 2,
    vibeId,
    background: mappedBg,
    typography: {
      name: nameRole,
      bio: bioRole,
      button: buttonFontRole,
    },
    buttons,
    layout,
    locks: [...locks],
    autoMatchButtons: opts?.autoMatchButtons ?? cur?.autoMatchButtons ?? true,
    updatedAt: new Date().toISOString(),
  };

  return {
    appearance,
    cardLook: BRAIN_TO_IVEO_CARD_LOOK[t.layout.cardLook] || 'match_page',
    meta: t.meta,
  };
}

/**
 * Section 14 Idempotent v1 -> v2 Appearance Migration + Legacy Mirror Sync.
 * Guarantees R1: existing live pages render identically after migration.
 */
import type {
  Appearance,
  AvatarFrame,
  Background,
  ButtonShapeV2,
  ButtonSurface,
  Color,
  HeaderLayoutV2,
  Hex,
  SpacingV2,
  WidthV2,
} from './types.ts';
import { computeBackgroundLayers } from '../backgrounds.ts';
import { resolveEffectiveTokens, type ButtonColors } from '../colors.ts';
import { getFontOption, type FontSettings } from '../fonts.ts';
import type { BackgroundConfig, ButtonShape, LayoutSettings } from '../preferences.ts';
import { VIBES, type VibeId } from '../vibes.ts';
import {
  findCatalogVibe,
  resolveAnyVibeToV2Id,
  vibeToAppearanceDefaults,
} from './catalog/vibes.ts';
import { findCatalogBackground } from './catalog/backgrounds.ts';
import { findCatalogFont } from './catalog/fonts.ts';

export interface LegacyProfileAppearanceInput {
  vibeId?: VibeId | string | null;
  buttonShape?: ButtonShape | null;
  background?: BackgroundConfig | null;
  fontSettings?: FontSettings | null;
  buttonColors?: ButtonColors | null;
  layoutSettings?: LayoutSettings | null;
  appearance?: Appearance | null;
  onboardingComplete?: boolean;
}

function mapLegacyButtonSurface(
  style: LayoutSettings['buttonStyle'] | undefined,
  hasShadow: boolean
): ButtonSurface {
  switch (style) {
    case 'outline':
      return 'outline-hairline';
    case 'soft':
      return 'soft-tint';
    case 'offset':
      return 'offset-3d';
    case 'glass':
      return 'glass';
    case 'gradient':
      return 'gradient-flow';
    case 'solid':
    default:
      return hasShadow ? 'solid-soft' : 'solid';
  }
}

function mapLegacyAvatarFrame(shape: LayoutSettings['avatarShape'] | undefined): AvatarFrame {
  switch (shape) {
    case 'squircle':
      return 'squircle';
    case 'rounded':
      return 'rounded';
    case 'ring':
      return 'halo';
    case 'circle':
    default:
      return 'circle';
  }
}

function mapLegacySpacing(spacing: LayoutSettings['linkSpacing'] | undefined): SpacingV2 {
  switch (spacing) {
    case 'compact':
      return 'compact';
    case 'airy':
      return 'airy';
    case 'normal':
    default:
      return 'balanced';
  }
}

function mapLegacyWidth(width: LayoutSettings['pageWidth'] | undefined): WidthV2 {
  switch (width) {
    case 'compact':
      return 'focused';
    case 'wide':
      return 'wide';
    case 'standard':
    default:
      return 'standard';
  }
}

function mapLegacyShape(
  shape: ButtonShape | null | undefined,
  vibeShape: string,
  radiusPx: number
): ButtonShapeV2 {
  if (shape === 'square' || shape === 'rounded' || shape === 'pill') return shape;
  if (radiusPx <= 0) return 'square';
  if (radiusPx >= 999) return 'pill';
  if (vibeShape === 'Square') return 'square';
  if (vibeShape === 'Pill') return 'pill';
  return 'rounded';
}

function normalizeColorValue(val: string | undefined, fallback: Hex): Color {
  if (!val) return fallback;
  const trimmed = val.trim();
  if (trimmed === 'transparent') return 'transparent';
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase() as Hex;
    }
    return trimmed.toUpperCase() as Hex;
  }
  if (/^rgba?\(/i.test(trimmed)) {
    return trimmed as Color;
  }
  return fallback;
}

/**
 * Idempotently converts legacy v1 profile fields into a Schema v2 Appearance object.
 * Existing pages freeze their custom CSS via `{ type: "legacy", css }` or exact solid/gradient
 * so nothing changes visually on existing live pages (Rule R1).
 */
export function migrateLegacyProfileToAppearanceV2(
  input: LegacyProfileAppearanceInput
): Appearance {
  // Already migrated & schema v2
  if (input.appearance && input.appearance.schemaVersion === 2) {
    return input.appearance;
  }

  const rawVibeId = input.vibeId || 'clean';
  const isDefaultCleanPage =
    !input.background &&
    !input.buttonColors &&
    !input.fontSettings &&
    !input.layoutSettings &&
    !input.buttonShape &&
    rawVibeId === 'clean';

  // Fresh uncustomized accounts start cleanly on Porcelain v2 defaults
  if (isDefaultCleanPage && !input.onboardingComplete) {
    return vibeToAppearanceDefaults(findCatalogVibe('porcelain')!, [], true);
  }

  const oldVibe = VIBES.find((v) => v.id === rawVibeId) || VIBES[0];
  const oldTokens = resolveEffectiveTokens(oldVibe.tokens, input.buttonColors, input.background);
  const bgLayers = computeBackgroundLayers(input.background, oldTokens.bg);
  const mappedNewVibeId = resolveAnyVibeToV2Id(oldVibe.id);

  // Convert background faithfully
  let v2Background: Background;
  if (input.background?.type === 'image' && input.background.value) {
    v2Background = {
      type: 'image',
      assetId: input.background.value,
      blur: Math.max(0, Math.min(40, input.background.blur ?? 0)),
      opacity: Math.round((input.background.opacity ?? 1) * 100),
      brightness: Math.round((input.background.brightness ?? 1) * 100),
      overlay:
        input.background.overlayColor && input.background.overlayOpacity
          ? {
              color: normalizeColorValue(input.background.overlayColor, '#000000') as Hex,
              alpha: input.background.overlayOpacity,
            }
          : undefined,
      focal: input.background.imagePosition || { x: 50, y: 50 },
      smartScrim: true,
    };
  } else if (
    input.background?.type === 'solid' &&
    input.background.value &&
    /^#([0-9a-fA-F]{6})$/.test(input.background.value)
  ) {
    v2Background = {
      type: 'solid',
      color: input.background.value.toUpperCase() as Hex,
    };
  } else if (
    (!input.background || input.background.type === 'none') &&
    /^#([0-9a-fA-F]{6})$/.test(oldTokens.bg)
  ) {
    v2Background = {
      type: 'solid',
      color: oldTokens.bg.toUpperCase() as Hex,
    };
  } else {
    const css =
      bgLayers.backgroundImage ||
      bgLayers.baseColor ||
      oldTokens.bg ||
      '#FFFFFF';
    v2Background = {
      type: 'legacy',
      css,
      isDark: bgLayers.isDark,
      baseHex: normalizeColorValue(bgLayers.baseColor || oldTokens.bg, '#FFFFFF') as Hex,
    };
  }

  const shape = mapLegacyShape(input.buttonShape, oldVibe.nativeShape, oldTokens.buttonRadius);
  const rawBorderW = parseFloat(oldTokens.buttonBorderWidth || (oldTokens.buttonBorder ? '1' : '0'));
  const borderWidth = (Math.min(4, Math.max(0, Math.round(rawBorderW))) as 0 | 1 | 2 | 3 | 4);

  const defaultFontOpt =
    getFontOption(
      oldVibe.fontFamily.includes('Fraunces')
        ? 'fraunces'
        : oldVibe.fontFamily.includes('Geist Mono')
          ? 'geist-mono'
          : 'inter'
    ) || getFontOption('inter')!;
  const nameOpt = getFontOption(input.fontSettings?.nameFont || defaultFontOpt.id) || defaultFontOpt;
  const bioOpt = getFontOption(input.fontSettings?.bioFont || defaultFontOpt.id) || defaultFontOpt;
  const btnOpt = getFontOption(input.fontSettings?.buttonFont || defaultFontOpt.id) || defaultFontOpt;

  const toFontRole = (
    opt: NonNullable<ReturnType<typeof getFontOption>>,
    defaultWeight: number
  ) => {
    const cat = findCatalogFont(opt.id) || findCatalogFont(opt.name);
    return {
      family: cat?.family || opt.name,
      weight: cat?.weights.includes(defaultWeight) ? defaultWeight : cat?.weights[0] || 400,
      size: 'm' as const,
      tracking: 'normal' as const,
      case: 'normal' as const,
      source: 'vibe' as const,
    };
  };

  const headerAlign: HeaderLayoutV2 =
    input.layoutSettings?.headerAlign === 'left' ? 'editorial' : 'centered';

  return {
    schemaVersion: 2,
    vibeId: mappedNewVibeId,
    background: v2Background,
    typography: {
      name: toFontRole(nameOpt, 700),
      bio: toFontRole(bioOpt, 400),
      button: toFontRole(btnOpt, 600),
    },
    buttons: {
      shape: shape === 'rounded' && oldTokens.buttonRadius !== 12 && oldTokens.buttonRadius !== 14 ? 'custom' : shape,
      radius: oldTokens.buttonRadius >= 999 ? 9999 : oldTokens.buttonRadius,
      fill: normalizeColorValue(oldTokens.buttonBg, '#0A0A0A'),
      text: normalizeColorValue(oldTokens.buttonText, '#FFFFFF') as Hex,
      border: normalizeColorValue(oldTokens.buttonBorder, oldTokens.buttonBg.startsWith('#') ? (oldTokens.buttonBg as Hex) : '#0A0A0A'),
      borderWidth,
      surface: mapLegacyButtonSurface(input.layoutSettings?.buttonStyle, Boolean(oldTokens.buttonShadow)),
      size: 'm',
      shadow: oldTokens.buttonShadow ? 'soft' : 'none',
      align: 'center',
      icon: 'left',
      motion: 'lift',
      states: {},
    },
    layout: {
      header: headerAlign,
      avatar: {
        frame: mapLegacyAvatarFrame(input.layoutSettings?.avatarShape),
        size: 'm',
        glow: input.layoutSettings?.avatarShape === 'ring' ? 'soft' : 'none',
      },
      linkLayout: 'stack',
      spacing: mapLegacySpacing(input.layoutSettings?.linkSpacing),
      width: mapLegacyWidth(input.layoutSettings?.pageWidth),
      entrance: 'fade-up',
      socialIcons: input.layoutSettings?.buttonStyle === 'glass' ? 'glass' : 'outline',
    },
    locks: [],
    autoMatchButtons: false, // existing migrated pages keep manual control (Section 9.2)
    migratedFrom: {
      vibe: oldVibe.id,
      background: input.background?.presetId || input.background?.type || 'default',
      at: new Date().toISOString(),
    },
  };
}

/**
 * Applies a CatalogVibe with chosen scope while optionally keeping locks/customizations.
 */
export function applyVibeWithScope(
  current: Appearance,
  vibeId: string,
  scope: 'everything' | 'colors-bg' | 'fonts-layout',
  keepLocks: boolean
): Appearance {
  const vibe = findCatalogVibe(vibeId) || findCatalogVibe('porcelain')!;
  const vibeDefaults = vibeToAppearanceDefaults(vibe, keepLocks ? current.locks : [], current.autoMatchButtons ?? true);

  if (scope === 'everything') {
    const next: Appearance = {
      ...vibeDefaults,
      locks: keepLocks ? current.locks : [],
      autoMatchButtons: current.autoMatchButtons ?? true,
    };
    if (keepLocks) {
      if (current.locks.includes('background')) next.background = current.background;
      if (current.locks.includes('btn.fill')) next.buttons.fill = current.buttons.fill;
      if (current.locks.includes('btn.text')) next.buttons.text = current.buttons.text;
      if (current.locks.includes('btn.border')) next.buttons.border = current.buttons.border;
      if (current.locks.includes('font.name')) next.typography.name = current.typography.name;
      if (current.locks.includes('font.bio')) next.typography.bio = current.typography.bio;
      if (current.locks.includes('font.button')) next.typography.button = current.typography.button;
      if (current.locks.includes('layout')) next.layout = current.layout;
    }
    return next;
  }

  if (scope === 'colors-bg') {
    return {
      ...current,
      vibeId: vibe.id,
      migratedFrom: undefined,
      background: keepLocks && current.locks.includes('background') ? current.background : vibeDefaults.background,
      buttons: {
        ...current.buttons,
        fill: keepLocks && current.locks.includes('btn.fill') ? current.buttons.fill : vibeDefaults.buttons.fill,
        text: keepLocks && current.locks.includes('btn.text') ? current.buttons.text : vibeDefaults.buttons.text,
        border: keepLocks && current.locks.includes('btn.border') ? current.buttons.border : vibeDefaults.buttons.border,
        borderWidth: vibeDefaults.buttons.borderWidth,
        surface: vibeDefaults.buttons.surface,
      },
    };
  }

  // 'fonts-layout'
  return {
    ...current,
    vibeId: vibe.id,
    typography: {
      name: keepLocks && current.locks.includes('font.name') ? current.typography.name : vibeDefaults.typography.name,
      bio: keepLocks && current.locks.includes('font.bio') ? current.typography.bio : vibeDefaults.typography.bio,
      button: keepLocks && current.locks.includes('font.button') ? current.typography.button : vibeDefaults.typography.button,
    },
    layout: keepLocks && current.locks.includes('layout') ? current.layout : vibeDefaults.layout,
  };
}

/**
 * Mirrors v2 Appearance back into legacy preferences shapes for non-refactored helpers
 * (ShareDialog, BusinessCardConfig, Clerk metadata summary) without dropping fidelity.
 */
export function appearanceToLegacyMirror(
  app: Appearance,
  existingLayout?: LayoutSettings | null
): {
  buttonShape: ButtonShape;
  buttonColors: ButtonColors;
  fontSettings: FontSettings;
  layoutSettings: LayoutSettings;
  background: BackgroundConfig;
} {
  const buttonShape: ButtonShape =
    app.buttons.shape === 'square'
      ? 'square'
      : app.buttons.shape === 'pill'
        ? 'pill'
        : 'rounded';

  const buttonColors: ButtonColors = {
    bg: typeof app.buttons.fill === 'string' && app.buttons.fill.startsWith('#') ? app.buttons.fill : undefined,
    text: typeof app.buttons.text === 'string' && app.buttons.text.startsWith('#') ? app.buttons.text : undefined,
    border: typeof app.buttons.border === 'string' && app.buttons.border.startsWith('#') ? app.buttons.border : undefined,
  };

  const nameFontId = findCatalogFont(app.typography.name.family)?.id || 'inter';
  const bioFontId = findCatalogFont(app.typography.bio.family)?.id || 'inter';
  const btnFontId = findCatalogFont(app.typography.button.family)?.id || 'inter';

  const legacyButtonStyle: LayoutSettings['buttonStyle'] =
    app.buttons.surface === 'outline-hairline' || app.buttons.surface === 'underline-only'
      ? 'outline'
      : app.buttons.surface === 'soft-tint'
        ? 'soft'
        : app.buttons.surface === 'offset-3d' || app.buttons.surface === 'sticker'
          ? 'offset'
          : app.buttons.surface === 'glass'
            ? 'glass'
            : app.buttons.surface === 'gradient-flow' || app.buttons.surface === 'metallic'
              ? 'gradient'
              : 'solid';

  const legacyAvatarShape: LayoutSettings['avatarShape'] =
    app.layout.avatar.frame === 'squircle'
      ? 'squircle'
      : app.layout.avatar.frame === 'rounded' || app.layout.avatar.frame === 'square'
        ? 'rounded'
        : app.layout.avatar.frame === 'halo' || app.layout.avatar.frame === 'double-ring' || app.layout.avatar.frame === 'gradient-ring'
          ? 'ring'
          : 'circle';

  let background: BackgroundConfig;
  const bg = app.background;
  if (bg.type === 'solid') {
    background = {
      type: 'solid',
      value: bg.color,
      ...(bg.color.toUpperCase() === '#FFFFFF' ? { presetId: 'pure-white' } : {}),
    };
  } else if (bg.type === 'gradient') {
    const stopsCss = bg.stops.map((s) => `${s.color} ${s.at}%`).join(', ');
    const css =
      bg.kind === 'radial'
        ? `radial-gradient(circle at 50% 45%, ${stopsCss})`
        : bg.kind === 'conic'
          ? `conic-gradient(from ${bg.angle}deg at 50% 50%, ${stopsCss})`
          : `linear-gradient(${bg.angle}deg, ${stopsCss})`;
    background = {
      type: 'gradient',
      value: css,
      gradientStops: bg.stops.map((s) => s.color).slice(0, 3),
      gradientAngle: bg.angle,
      ...(bg.kind === 'radial' ? { gradientDirection: 'radial' } : {}),
    };
  } else if (bg.type === 'preset') {
    const presetMeta = findCatalogBackground(bg.id);
    const cssVal = presetMeta?.cssBackground || '#FAFAF9';
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cssVal.trim())) {
      background = {
        type: 'solid',
        value: cssVal.trim().toUpperCase(),
        presetId: bg.id,
      };
    } else {
      background = {
        type: cssVal.includes('radial-gradient') ? 'mesh' : 'gradient',
        value: cssVal,
        presetId: bg.id,
      };
    }
  } else if (bg.type === 'image') {
    background = {
      type: 'image',
      value: bg.assetId,
      blur: bg.blur,
      opacity: bg.opacity !== undefined ? bg.opacity / 100 : undefined,
      brightness: bg.brightness !== undefined ? bg.brightness / 100 : undefined,
      ...(bg.overlay ? { overlayColor: bg.overlay.color, overlayOpacity: bg.overlay.alpha } : {}),
      ...(bg.focal ? { imagePosition: bg.focal } : {}),
    };
  } else {
    const rawCss = (bg.css || bg.baseHex || '#FFFFFF').trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawCss)) {
      background = { type: 'solid', value: rawCss.toUpperCase() };
    } else if (/gradient\(/i.test(rawCss)) {
      background = { type: rawCss.includes('radial-gradient') ? 'mesh' : 'gradient', value: rawCss };
    } else {
      background = { type: 'solid', value: bg.baseHex || '#FFFFFF' };
    }
  }

  return {
    buttonShape,
    buttonColors,
    fontSettings: {
      nameFont: nameFontId,
      bioFont: bioFontId,
      buttonFont: btnFontId,
    },
    layoutSettings: {
      avatarShape: legacyAvatarShape,
      headerAlign: app.layout.header === 'editorial' ? 'left' : 'center',
      buttonStyle: legacyButtonStyle,
      linkSpacing: app.layout.spacing === 'compact' ? 'compact' : app.layout.spacing === 'airy' ? 'airy' : 'normal',
      pageWidth: app.layout.width === 'focused' ? 'compact' : app.layout.width === 'wide' ? 'wide' : 'standard',
      cardLook: existingLayout?.cardLook || 'match_page',
    },
    background,
  };
}

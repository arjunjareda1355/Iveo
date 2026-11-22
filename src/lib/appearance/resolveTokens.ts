/**
 * Section 7.4 Pure Token Resolver (resolveTokens) shared identically by
 * Dashboard Preview and Public User Page.
 */
import type {
  Appearance,
  Background,
  BgProfile,
  ButtonShapeV2,
  ButtonSurface,
  Color,
  Hex,
  ResolvedTokens,
} from './types.ts';
import { SYSTEM_DEFAULT_APPEARANCE } from './types.ts';
import {
  findCatalogBackground,
  getFreeFallbackBackgroundId,
} from './catalog/backgrounds.ts';
import {
  CATALOG_FONTS,
  clampWeightToFont,
  findCatalogFont,
  getFontStackWithFallback,
  getFreeFallbackFont,
} from './catalog/fonts.ts';
import {
  AVATAR_SIZE_PX,
  BUTTON_FONT_SIZE_PX,
  BUTTON_HEIGHT_PX,
  BUTTON_PX,
  COLUMN_WIDTH_PX,
  SPACING_GAP_PX,
} from './catalog/layouts.ts';
import {
  CATALOG_SURFACES,
  buildButtonSurfaceCss,
  enforceLayoutInvariants,
  getFreeFallbackSurface,
} from './catalog/surfaces.ts';
import { findCatalogVibe, getFreeFallbackVibeId } from './catalog/vibes.ts';
import { analyzeBackground } from '../color/analyze.ts';
import { alphaBlend, contrastRatio, parseColorToRgba, rgbaToCssString, rgbaToHex, worstCaseContrast } from '../color/contrast.ts';
import { adjustLightnessToPass, bestText } from '../color/gamut.ts';
import { hexToOklch } from '../color/oklch.ts';

export interface ResolveTokensOptions {
  isPro?: boolean;
  bgProfileOverride?: BgProfile;
}

/**
 * Shifts `fill` by +-amount toward `towardText` in OKLCH L (Section 7.4).
 */
function deriveStateColor(fill: Color, towardText: Color, amount = 0.04): Color {
  if (fill === 'transparent') {
    const tRgb = parseColorToRgba(towardText);
    if (!tRgb) return 'rgba(128,128,128,0.08)';
    return `rgba(${Math.round(tRgb.r)},${Math.round(tRgb.g)},${Math.round(tRgb.b)},${amount === 0.04 ? 0.08 : 0.14})`;
  }
  const fRgb = parseColorToRgba(fill);
  if (!fRgb) return fill;
  if (fRgb.a < 0.99) {
    return rgbaToCssString({
      ...fRgb,
      a: Math.min(0.96, Number((fRgb.a + amount * 1.5).toFixed(2))),
    }) as Color;
  }
  const fL = hexToOklch(fill).L;
  const tL = towardText === 'transparent' ? 0.5 : hexToOklch(towardText).L;
  const dir = tL > fL ? 1 : -1;
  const newL = Math.max(0.04, Math.min(0.98, fL + dir * amount));
  const fHex = rgbaToHex(fRgb);
  // Step toward newL
  const diffSteps = Math.max(1, Math.round(Math.abs(newL - fL) / 0.01));
  let current = fHex;
  for (let i = 0; i < diffSteps; i++) {
    const o = hexToOklch(current);
    const stepL = Math.max(0.04, Math.min(0.98, o.L + dir * 0.01));
    current = adjustOklchL(current, stepL);
  }
  return current;
}

function adjustOklchL(hex: Hex, targetL: number): Hex {
  const o = hexToOklch(hex);
  const a = o.C * Math.cos((o.h * Math.PI) / 180);
  const b = o.C * Math.sin((o.h * Math.PI) / 180);
  // Gamut safe via dynamic import already loaded at module scope: use reduceChromaToGamut
  return _oklchToSafeHex(targetL, o.C, o.h, a, b);
}

import { reduceChromaToGamut } from '../color/gamut.ts';
import { oklabToRgb } from '../color/oklch.ts';

function _oklchToSafeHex(L: number, C: number, h: number, _a: number, _b: number): Hex {
  const safe = reduceChromaToGamut({ L, C, h });
  const rad = (safe.h * Math.PI) / 180;
  const rgb = oklabToRgb({ L: safe.L, a: safe.C * Math.cos(rad), b: safe.C * Math.sin(rad) });
  return rgbaToHex({ ...rgb, a: 1 });
}

export function resolveDerivedButtonRadius(shape: ButtonShapeV2, customRadius: number, vibeDefaultRadius?: number): number {
  switch (shape) {
    case 'square':
      return 0;
    case 'pill':
      return 9999;
    case 'custom':
      return Math.max(0, Math.min(40, Math.round(customRadius)));
    case 'rounded':
    default:
      if (vibeDefaultRadius !== undefined && vibeDefaultRadius > 0 && vibeDefaultRadius < 40) {
        return vibeDefaultRadius;
      }
      return 14;
  }
}

export function resolveBackgroundCssString(bg: Background): string {
  switch (bg.type) {
    case 'solid':
      return bg.color;
    case 'gradient': {
      const stops = bg.stops.map((s) => `${s.color} ${s.at}%`).join(', ');
      if (bg.kind === 'radial') return `radial-gradient(circle at 50% 45%, ${stops})`;
      if (bg.kind === 'conic') return `conic-gradient(from ${bg.angle}deg at 50% 50%, ${stops})`;
      return `linear-gradient(${bg.angle}deg, ${stops})`;
    }
    case 'preset': {
      const preset = findCatalogBackground(bg.id);
      return preset?.cssBackground || '#FAFAF9';
    }
    case 'image':
      return bg.dominantColors?.[0] || '#0F172A';
    case 'legacy':
      return bg.css || bg.baseHex || '#FFFFFF';
  }
}

export function resolveTokens(
  rawAppearance: Appearance | null | undefined,
  options?: ResolveTokensOptions
): ResolvedTokens {
  const isPro = options?.isPro ?? true;
  const app = rawAppearance || SYSTEM_DEFAULT_APPEARANCE;
  const downgradedProFields: string[] = [];

  // 1. Resolve Vibe (with graceful Pro downgrade)
  const rawVibe = findCatalogVibe(app.vibeId) || findCatalogVibe('porcelain')!;
  const effectiveVibeId = !isPro && rawVibe.tier === 'pro' ? getFreeFallbackVibeId(rawVibe.id) : rawVibe.id;
  if (!isPro && rawVibe.tier === 'pro') {
    downgradedProFields.push('vibeId');
  }
  const vibe = findCatalogVibe(effectiveVibeId) || rawVibe;

  // 2. Resolve Background (with graceful Pro downgrade)
  let bg: Background = app.background || { type: 'preset', id: vibe.backgroundId };
  if (!isPro) {
    if (bg.type === 'image') {
      downgradedProFields.push('background.image');
      bg = { type: 'preset', id: getFreeFallbackBackgroundId(vibe.backgroundId) };
    } else if (bg.type === 'preset') {
      const pMeta = findCatalogBackground(bg.id);
      if (pMeta?.tier === 'pro') {
        downgradedProFields.push('background.preset');
        bg = { ...bg, id: getFreeFallbackBackgroundId(bg.id), animate: false };
      } else if (bg.animate) {
        downgradedProFields.push('background.animate');
        bg = { ...bg, animate: false };
      }
    }
  }

  // 3. Analyze background
  const bgProfile = options?.bgProfileOverride || analyzeBackground(bg, { pageTextHex: vibe.page.text });

  // 4. Determine T5-safe pageText, pageMuted, pageAccent & smartScrim
  const isDarkBg = bgProfile.meanL < 0.5;
  let pageText: Hex = vibe.page.text;
  const smartScrim = bg.type === 'image' && bg.smartScrim !== false ? bgProfile.smartScrim || null : null;

  // Ensure pageText passes >= 4.5 against worst-case sample (darkest & lightest)
  const samples = [bgProfile.darkest, bgProfile.lightest];
  if (worstCaseContrast(pageText, samples) < 4.5) {
    const candidateInk: Hex = '#111113';
    const candidatePaper: Hex = '#FAFAF9';
    const inkWorst = worstCaseContrast(candidateInk, samples);
    const paperWorst = worstCaseContrast(candidatePaper, samples);
    pageText = paperWorst >= inkWorst ? candidatePaper : candidateInk;
    if (worstCaseContrast(pageText, samples) < 4.5) {
      pageText = isDarkBg ? '#FFFFFF' : '#000000';
    }
  }

  const pageTextLumDark = contrastRatio(pageText, '#000000') > contrastRatio(pageText, '#FFFFFF');
  let pageMutedHex: Hex = vibe.page.muted;
  if (worstCaseContrast(pageMutedHex, samples) < 4.5) {
    pageMutedHex = pageTextLumDark ? '#D4D8E0' : '#40444C';
    if (worstCaseContrast(pageMutedHex, samples) < 4.5) {
      pageMutedHex = pageText;
    }
  }
  const pageMuted = pageMutedHex;

  // Accent: ensure visible or fallback cleanly
  const pageAccent: Hex =
    worstCaseContrast(vibe.page.accent, samples) >= 2.2
      ? vibe.page.accent
      : pageText;

  // T4 Focus ring: >= 3:1 vs background
  const focusRing: Hex =
    worstCaseContrast(pageText, samples) >= 3.0 ? pageText : isDarkBg ? '#FFFFFF' : '#000000';

  // 5. Typography (enforce Pro gating + max 3 families + Bio safety)
  const resolveFontRole = (
    role: 'name' | 'bio' | 'button',
    inputRole: Appearance['typography']['name']
  ) => {
    let catFont = findCatalogFont(inputRole.family) || CATALOG_FONTS[0];
    if (!isPro && catFont.tier === 'pro') {
      downgradedProFields.push(`typography.${role}`);
      const roleFit = role === 'name' ? 'N' : role === 'bio' ? 'B' : 'T';
      catFont = getFreeFallbackFont(catFont.category, roleFit);
    }
    if (role === 'bio' && catFont.excludeFromBio) {
      catFont = findCatalogFont('inter')!;
    }
    const weight = clampWeightToFont(catFont, inputRole.weight);
    return {
      ...inputRole,
      family: catFont.family,
      fontId: catFont.id,
      weight,
      cssFamily: getFontStackWithFallback(catFont),
    };
  };

  const nameFont = resolveFontRole('name', app.typography.name);
  const bioFont = resolveFontRole('bio', app.typography.bio);
  const buttonFont = resolveFontRole('button', app.typography.button);

  // 6. Buttons + Surfaces (with Pro gating fallback)
  let surface: ButtonSurface = app.buttons.surface || vibe.button.surface;
  const surfaceMeta = CATALOG_SURFACES.find((s) => s.id === surface);
  if (!isPro && surfaceMeta?.tier === 'pro') {
    downgradedProFields.push('buttons.surface');
    surface = getFreeFallbackSurface(surface);
  }

  const shape = app.buttons.shape || vibe.button.shape;
  const derivedRadius = resolveDerivedButtonRadius(
    shape,
    app.buttons.radius ?? vibe.button.radius,
    vibe.button.shape === 'rounded' ? vibe.button.radius : undefined
  );
  const size = app.buttons.size || 'm';
  const heightPx = BUTTON_HEIGHT_PX[size];
  const paddingXPx = BUTTON_PX[size];
  const fontSizePx = BUTTON_FONT_SIZE_PX[size];

  const fill = app.buttons.fill || vibe.button.fill;
  const text = app.buttons.text || vibe.button.text;
  const border = app.buttons.border || vibe.button.border;
  const borderWidth = app.buttons.borderWidth ?? vibe.button.borderWidth;

  const hoverFill = app.buttons.states?.hover?.fill || deriveStateColor(fill, text, 0.04);
  const pressedFill = app.buttons.states?.pressed?.fill || deriveStateColor(fill, text, 0.08);
  const derivedHover = {
    fill: hoverFill,
    text: app.buttons.states?.hover?.text || text,
    border: app.buttons.states?.hover?.border || border,
  };
  const derivedPressed = {
    fill: pressedFill,
    text: app.buttons.states?.pressed?.text || text,
    border: app.buttons.states?.pressed?.border || border,
  };

  // 7. Layout (C9 hero avatar auto-bump)
  const layoutEnforced = enforceLayoutInvariants(app.layout);
  const gapPx = SPACING_GAP_PX[layoutEnforced.spacing] ?? 14;
  const columnWidthPx = COLUMN_WIDTH_PX[layoutEnforced.width] ?? 560;
  const avatarSizePx = AVATAR_SIZE_PX[layoutEnforced.avatar.size] ?? 96;

  // Compute CSS vars dictionary (Section 12)
  const surfaceCss = buildButtonSurfaceCss({
    surface,
    fill,
    text,
    border,
    borderWidth,
    shadow: app.buttons.shadow,
    gradient: app.buttons.gradient,
    bgProfile,
  });

  const pageBgCss = resolveBackgroundCssString(bg);
  const trackNameVal =
    nameFont.tracking === 'tight'
      ? '-0.02em'
      : nameFont.tracking === 'wide'
        ? '0.04em'
        : '-0.01em';

  const cssVars: Record<string, string> = {
    '--ap-bg': pageBgCss,
    '--ap-text': pageText,
    '--ap-muted': pageMuted,
    '--ap-accent': pageAccent,
    '--ap-focus': focusRing,
    '--ap-btn-fill': String(surfaceCss.backgroundColor || fill),
    '--ap-btn-text': String(surfaceCss.color || text),
    '--ap-btn-border': String(border),
    '--ap-btn-bw': `${borderWidth}px`,
    '--ap-btn-radius': `${derivedRadius}px`,
    '--ap-btn-h': `${heightPx}px`,
    '--ap-btn-px': `${paddingXPx}px`,
    '--ap-btn-shadow': surfaceCss.boxShadow,
    '--ap-gap': `${gapPx}px`,
    '--ap-col': `${columnWidthPx}px`,
    '--ap-font-name': nameFont.cssFamily,
    '--ap-font-bio': bioFont.cssFamily,
    '--ap-font-btn': buttonFont.cssFamily,
    '--ap-w-name': String(nameFont.weight),
    '--ap-w-bio': String(bioFont.weight),
    '--ap-w-btn': String(app.buttons.weight || buttonFont.weight),
    '--ap-track-name': trackNameVal,
    '--ap-avatar': `${avatarSizePx}px`,
  };

  void alphaBlend;

  return {
    vibeId: vibe.id,
    vibeName: vibe.name,
    pageBg: pageBgCss,
    pageText,
    pageMuted,
    pageAccent,
    focusRing,
    smartScrim,
    background: bg,
    bgProfile,
    typography: {
      name: nameFont,
      bio: bioFont,
      button: buttonFont,
    },
    buttons: {
      ...app.buttons,
      surface,
      fill,
      text,
      border,
      borderWidth,
      derivedRadius,
      heightPx,
      paddingXPx,
      fontSizePx,
      derivedHover,
      derivedPressed,
    },
    layout: {
      ...layoutEnforced,
      gapPx,
      columnWidthPx,
      avatarSizePx,
    },
    cssVars,
    downgradedProFields,
  };
}

/**
 * Resolves the display label for Appearance Home's summary rows.
 */
export function buildAppearanceHomeSummary(
  app: Appearance,
  resolved: ResolvedTokens
): {
  vibeSubtitle: string;
  vibeDots: [string, string, string];
  backgroundSubtitle: string;
  typographySubtitle: string;
  buttonsSubtitle: string;
  layoutSubtitle: string;
} {
  const vibe = findCatalogVibe(app.vibeId);
  const vibeName = vibe?.name || 'Custom';
  const vibeCollection = vibe?.collection || 'Custom';
  const hasMigratedCustom = Boolean(app.migratedFrom);

  const bgLabel = (() => {
    const bg = app.background;
    if (bg.type === 'preset') {
      const p = findCatalogBackground(bg.id);
      return p ? `${p.name} · ${p.categoryLabel}` : 'Preset';
    }
    if (bg.type === 'solid') return `Solid · ${bg.color.toUpperCase()}`;
    if (bg.type === 'gradient') return `${bg.kind[0].toUpperCase() + bg.kind.slice(1)} gradient`;
    if (bg.type === 'image') return 'Custom photo · Image';
    return 'Legacy background · Frozen';
  })();

  const shapeNice =
    resolved.buttons.shape[0].toUpperCase() + resolved.buttons.shape.slice(1);
  const fillNice =
    resolved.buttons.fill === 'transparent'
      ? 'Transparent'
      : String(resolved.buttons.fill).toUpperCase().slice(0, 12);
  const bgShort = resolved.bgProfile.meanHex.toUpperCase();

  const headerNice =
    resolved.layout.header[0].toUpperCase() + resolved.layout.header.slice(1);
  const spacingNice =
    resolved.layout.spacing[0].toUpperCase() + resolved.layout.spacing.slice(1);
  const surfaceObj = CATALOG_SURFACES.find((s) => s.id === resolved.buttons.surface);

  return {
    vibeSubtitle: hasMigratedCustom
      ? `${vibeName} · Customised`
      : `${vibeName} · ${vibeCollection}`,
    vibeDots: [
      resolved.bgProfile.meanHex,
      String(resolved.buttons.fill === 'transparent' ? resolved.pageText : resolved.buttons.fill),
      resolved.pageAccent,
    ],
    backgroundSubtitle: bgLabel,
    typographySubtitle: `${resolved.typography.name.family} · ${resolved.typography.bio.family}`,
    buttonsSubtitle: `${shapeNice} · ${fillNice} on ${bgShort}`,
    layoutSubtitle: `${headerNice} · ${spacingNice} · ${surfaceObj?.label || 'Solid'}`,
  };
}

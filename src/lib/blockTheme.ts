import type { CSSProperties } from 'react';
import { VIBES, type VibeId, type VibeTokens } from './vibes.ts';
import {
  DEFAULT_LAYOUT_SETTINGS,
  type BackgroundConfig,
  type ButtonShape,
  type ButtonStyleEffect,
  type LayoutSettings,
  resolveButtonControlRadius,
  resolveCardBorderRadius,
} from './preferences.ts';
import { buildGoogleFontsStylesheetUrl, getFontCssFamily, type FontSettings } from './fonts.ts';
import { computeBackgroundLayers } from './backgrounds.ts';
import {
  type ButtonColors,
  ensureContrastText,
  getHexLuminance,
  resolveCssColorToHex,
  resolveEffectiveTokens,
} from './colors.ts';
import type { Appearance } from './appearance/types.ts';
import { resolveTokens } from './appearance/resolveTokens.ts';
import { buildButtonSurfaceCss } from './appearance/catalog/surfaces.ts';

export interface BlockThemeInput {
  vibeId?: VibeId | string | null;
  vibeTokens?: VibeTokens;
  vibeFontFamily?: string;
  buttonShape?: ButtonShape | null;
  buttonColors?: ButtonColors | null;
  background?: BackgroundConfig | null;
  layoutSettings?: LayoutSettings | null;
  fontSettings?: FontSettings | null;
  appearance?: Appearance | null;
  isPro?: boolean;
  buttonRadiusOverride?: number;
  scale?: number;
}

export interface BlockThemeContract {
  tokens: VibeTokens;
  buttonStyle: ButtonStyleEffect;
  baseBg: string;
  isDarkPage: boolean;
  nameFontFamily: string;
  bioFontFamily: string;
  buttonFontFamily: string;
  radii: {
    effective: number;
    bar: number;
    card: number;
    inner: number;
    control: number;
  };
  surfaceStyle: CSSProperties;
  ctaStyle: CSSProperties;
  cssVars: Record<string, string>;
}

const BUTTON_SHAPE_RADIUS: Record<string, number> = {
  square: 0,
  rounded: 12,
  pill: 999,
};

export function resolveBlockThemeContract(input: BlockThemeInput): BlockThemeContract {
  const scale = input.scale && input.scale > 0 ? input.scale : 1;

  if (input.appearance && input.appearance.schemaVersion === 2) {
    const resolvedV2 = resolveTokens(input.appearance, { isPro: input.isPro ?? true });
    const isDarkPage = resolvedV2.bgProfile.meanL < 0.5;
    const baseBg = resolvedV2.bgProfile.meanHex;
    const effRadius =
      input.buttonRadiusOverride !== undefined
        ? input.buttonRadiusOverride
        : resolvedV2.buttons.derivedRadius;
    const barRadius = resolveCardBorderRadius(effRadius, scale, 'bar');
    const cardRadius = resolveCardBorderRadius(effRadius, scale, 'card');
    const innerRadius = resolveCardBorderRadius(effRadius, scale, 'inner');
    const controlRadius = resolveButtonControlRadius(effRadius, scale);

    const surfaceCss = buildButtonSurfaceCss({
      surface: resolvedV2.buttons.surface,
      fill: resolvedV2.buttons.fill,
      text: resolvedV2.buttons.text,
      border: resolvedV2.buttons.border,
      borderWidth: resolvedV2.buttons.borderWidth,
      shadow: resolvedV2.buttons.shadow,
      gradient: resolvedV2.buttons.gradient,
      bgProfile: resolvedV2.bgProfile,
    });

    const surfaceStyle: CSSProperties = {
      backgroundColor: surfaceCss.backgroundColor,
      ...(surfaceCss.backgroundImage ? { backgroundImage: surfaceCss.backgroundImage } : {}),
      ...(surfaceCss.backgroundSize ? { backgroundSize: surfaceCss.backgroundSize } : {}),
      color: surfaceCss.color,
      border: surfaceCss.border,
      ...(surfaceCss.borderBottom ? { borderBottom: surfaceCss.borderBottom } : {}),
      boxShadow: surfaceCss.boxShadow,
      ...(surfaceCss.backdropFilter
        ? { backdropFilter: surfaceCss.backdropFilter, WebkitBackdropFilter: surfaceCss.backdropFilter }
        : {}),
      ...(surfaceCss.textShadow ? { textShadow: surfaceCss.textShadow } : {}),
    };

    const isLightSurf =
      (getHexLuminance(
        resolveCssColorToHex(
          surfaceCss.backgroundColor === 'transparent' ? baseBg : surfaceCss.backgroundColor,
          baseBg
        )
      ) ?? 255) >= 165;
    const ctaBg =
      resolvedV2.buttons.fill !== 'transparent'
        ? resolveCssColorToHex(resolvedV2.buttons.fill, baseBg)
        : isLightSurf
          ? '#0A0A0A'
          : '#FFFFFF';
    const ctaText = ensureContrastText(resolvedV2.buttons.text, ctaBg, 4.5, baseBg);

    const tokens: VibeTokens = {
      bg: baseBg,
      text: resolvedV2.pageText,
      muted: resolvedV2.pageMuted,
      avatarBg: isDarkPage ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.08)',
      avatarText: resolvedV2.pageText,
      buttonBg: String(resolvedV2.buttons.fill),
      buttonText: String(resolvedV2.buttons.text),
      buttonBorder: resolvedV2.buttons.border === 'transparent' ? undefined : String(resolvedV2.buttons.border),
      buttonBorderWidth: `${resolvedV2.buttons.borderWidth}px`,
      buttonRadius: effRadius,
      buttonShadow: surfaceCss.boxShadow === 'none' ? undefined : surfaceCss.boxShadow,
    };

    const v2ButtonStyle: ButtonStyleEffect =
      resolvedV2.buttons.surface === 'outline-hairline' || resolvedV2.buttons.surface === 'underline-only'
        ? 'outline'
        : resolvedV2.buttons.surface === 'soft-tint'
          ? 'soft'
          : resolvedV2.buttons.surface === 'offset-3d' || resolvedV2.buttons.surface === 'sticker'
            ? 'offset'
            : resolvedV2.buttons.surface === 'glass'
              ? 'glass'
              : resolvedV2.buttons.surface === 'gradient-flow' || resolvedV2.buttons.surface === 'metallic'
                ? 'gradient'
                : 'solid';

    return {
      tokens,
      buttonStyle: v2ButtonStyle,
      baseBg,
      isDarkPage,
      nameFontFamily: resolvedV2.typography.name.cssFamily,
      bioFontFamily: resolvedV2.typography.bio.cssFamily,
      buttonFontFamily: resolvedV2.typography.button.cssFamily,
      radii: {
        effective: effRadius,
        bar: barRadius,
        card: cardRadius,
        inner: innerRadius,
        control: controlRadius,
      },
      surfaceStyle,
      ctaStyle: {
        backgroundColor: ctaBg,
        color: ctaText,
        borderRadius: `${controlRadius}px`,
      },
      cssVars: {
        ...resolvedV2.cssVars,
        '--page-bg': baseBg,
        '--page-text': resolvedV2.pageText,
        '--page-muted': resolvedV2.pageMuted,
        '--block-bg': surfaceCss.backgroundColor,
        '--block-text': surfaceCss.color,
        '--block-muted': isDarkPage ? 'rgba(248, 250, 252, 0.80)' : 'rgba(10, 10, 10, 0.78)',
        '--block-border': surfaceCss.border,
        '--block-border-color': String(resolvedV2.buttons.border),
        '--block-shadow': surfaceCss.boxShadow,
        '--block-backdrop': surfaceCss.backdropFilter || 'none',
        '--block-radius': `${cardRadius}px`,
        '--block-bar-radius': `${barRadius}px`,
        '--block-inner-radius': `${innerRadius}px`,
        '--block-control-radius': `${controlRadius}px`,
        '--block-font': resolvedV2.typography.button.cssFamily,
        '--btn-bg': ctaBg,
        '--btn-text': ctaText,
      },
    };
  }

  const matchedVibe = VIBES.find((v) => v.id === input.vibeId) || VIBES[0];
  const baseTokens = input.vibeTokens || matchedVibe.tokens;
  const fallbackFont = input.vibeFontFamily || matchedVibe.fontFamily;

  const tokens = resolveEffectiveTokens(baseTokens, input.buttonColors, input.background);
  const bgLayers = computeBackgroundLayers(input.background, tokens.bg);
  const baseBg = bgLayers.baseColor || tokens.bg || '#FFFFFF';
  const resolvedPageHex = resolveCssColorToHex(baseBg, '#FFFFFF');
  const isDarkPage = (getHexLuminance(resolvedPageHex) ?? 255) < 135;

  const buttonStyle: ButtonStyleEffect =
    input.layoutSettings?.buttonStyle || DEFAULT_LAYOUT_SETTINGS.buttonStyle;

  const effectiveRadius =
    input.buttonRadiusOverride !== undefined
      ? input.buttonRadiusOverride
      : input.buttonShape && input.buttonShape in BUTTON_SHAPE_RADIUS
        ? BUTTON_SHAPE_RADIUS[input.buttonShape]
        : tokens.buttonRadius;

  const barRadius = resolveCardBorderRadius(effectiveRadius, scale, 'bar');
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const nameFontFamily = getFontCssFamily(input.fontSettings?.nameFont, fallbackFont);
  const bioFontFamily = getFontCssFamily(input.fontSettings?.bioFont, fallbackFont);
  const buttonFontFamily = getFontCssFamily(input.fontSettings?.buttonFont, fallbackFont);

  const baseBorder = tokens.buttonBorder
    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
    : '1px solid rgba(0,0,0,0.08)';

  let surfaceBg = tokens.buttonBg;
  let surfaceBackgroundImage = '';
  let surfaceText = tokens.buttonText;
  let surfaceBorder = tokens.buttonBorder ? baseBorder : 'none';
  let surfaceShadow = tokens.buttonShadow || 'none';
  let surfaceBackdrop = 'none';

  switch (buttonStyle) {
    case 'outline':
      surfaceBg = 'transparent';
      surfaceText = tokens.text;
      surfaceBorder = `1.5px solid ${tokens.buttonBorder || tokens.text}`;
      surfaceShadow = 'none';
      break;
    case 'soft': {
      const tintSource = tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg;
      const tintHex = resolveCssColorToHex(tintSource, resolvedPageHex);
      surfaceBg = `${tintHex}20`;
      surfaceText = tokens.text;
      surfaceBorder = `1px solid ${tintHex}33`;
      surfaceShadow = 'none';
      break;
    }
    case 'offset':
      surfaceBg = tokens.buttonBg === 'transparent' ? resolvedPageHex : tokens.buttonBg;
      surfaceText = ensureContrastText(tokens.buttonText, surfaceBg, 4.5, resolvedPageHex);
      surfaceBorder = `1.5px solid ${tokens.buttonBorder || tokens.text}`;
      surfaceShadow = `${Math.max(2, Math.round(3 * scale))}px ${Math.max(2, Math.round(3 * scale))}px 0px ${tokens.text}`;
      break;
    case 'glass':
      surfaceBg = isDarkPage ? 'rgba(20, 20, 26, 0.56)' : 'rgba(255, 255, 255, 0.62)';
      surfaceBackdrop = 'blur(12px)';
      surfaceText = ensureContrastText(tokens.text, surfaceBg, 4.5, resolvedPageHex);
      surfaceBorder = isDarkPage
        ? '1px solid rgba(255, 255, 255, 0.22)'
        : '1px solid rgba(10, 10, 10, 0.14)';
      surfaceShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
      break;
    case 'gradient': {
      const gStart = tokens.buttonBg === 'transparent' ? '#0A0A0A' : tokens.buttonBg;
      const gEnd = tokens.buttonBorder || '#6366F1';
      surfaceBg = gStart;
      surfaceBackgroundImage = `linear-gradient(135deg, ${gStart} 0%, ${gEnd} 100%)`;
      surfaceText = ensureContrastText(tokens.buttonText, gStart, 4.5, resolvedPageHex);
      surfaceBorder = tokens.buttonBorder ? baseBorder : 'none';
      surfaceShadow = tokens.buttonShadow || '0 4px 14px rgba(0,0,0,0.12)';
      break;
    }
    case 'solid':
    default:
      surfaceBg = tokens.buttonBg;
      surfaceText =
        surfaceBg === 'transparent'
          ? tokens.text
          : ensureContrastText(tokens.buttonText, surfaceBg, 4.5, resolvedPageHex);
      surfaceBorder = tokens.buttonBorder ? baseBorder : 'none';
      surfaceShadow = tokens.buttonShadow || 'none';
      break;
  }

  const effectiveSurfaceHex = resolveCssColorToHex(
    surfaceBg === 'transparent' ? resolvedPageHex : surfaceBg,
    resolvedPageHex
  );
  const safeText = ensureContrastText(surfaceText, effectiveSurfaceHex, 4.5, resolvedPageHex);
  const usesLightText = (getHexLuminance(resolveCssColorToHex(safeText, '#0A0A0A')) ?? 0) >= 150;
  const safeMuted = usesLightText ? 'rgba(248, 250, 252, 0.80)' : 'rgba(10, 10, 10, 0.78)';

  // Primary CTA pill inside cards: invert cleanly if CTA would match surface background
  const isLightSurface = (getHexLuminance(effectiveSurfaceHex) ?? 255) >= 165;
  const preferredCtaBg =
    tokens.buttonBg && tokens.buttonBg !== 'transparent'
      ? resolveCssColorToHex(tokens.buttonBg, effectiveSurfaceHex)
      : isLightSurface
        ? '#0A0A0A'
        : '#FFFFFF';
  const sameAsSurface =
    preferredCtaBg.toUpperCase() === effectiveSurfaceHex.toUpperCase() ||
    (surfaceBg !== 'transparent' &&
      resolveCssColorToHex(surfaceBg, resolvedPageHex).toUpperCase() === preferredCtaBg.toUpperCase());
  const ctaBg = sameAsSurface ? (isLightSurface ? '#0A0A0A' : '#FFFFFF') : preferredCtaBg;
  const ctaText = ensureContrastText(tokens.buttonText, ctaBg, 4.5, effectiveSurfaceHex);

  const borderColorExtracted = (() => {
    if (tokens.buttonBorder && tokens.buttonBorder !== 'transparent') {
      return tokens.buttonBorder;
    }
    return isLightSurface ? 'rgba(10, 10, 10, 0.14)' : 'rgba(255, 255, 255, 0.22)';
  })();

  const surfaceStyle: CSSProperties = {
    backgroundColor: surfaceBg,
    ...(surfaceBackgroundImage ? { backgroundImage: surfaceBackgroundImage } : {}),
    color: safeText,
    border: surfaceBorder,
    boxShadow: surfaceShadow,
    ...(surfaceBackdrop !== 'none'
      ? { backdropFilter: surfaceBackdrop, WebkitBackdropFilter: surfaceBackdrop }
      : {}),
  };

  const ctaStyle: CSSProperties = {
    backgroundColor: ctaBg,
    color: ctaText,
    borderRadius: `${controlRadius}px`,
  };

  const cssVars: Record<string, string> = {
    '--page-bg': baseBg,
    '--page-text': tokens.text,
    '--page-muted': tokens.muted,
    '--block-bg': surfaceBg,
    '--block-text': safeText,
    '--block-muted': safeMuted,
    '--block-border': surfaceBorder,
    '--block-border-color': borderColorExtracted,
    '--block-shadow': surfaceShadow,
    '--block-backdrop': surfaceBackdrop,
    '--block-radius': `${cardRadius}px`,
    '--block-bar-radius': `${barRadius}px`,
    '--block-inner-radius': `${innerRadius}px`,
    '--block-control-radius': `${controlRadius}px`,
    '--block-font': buttonFontFamily,
    '--btn-bg': ctaBg,
    '--btn-text': ctaText,
  };

  return {
    tokens,
    buttonStyle,
    baseBg,
    isDarkPage,
    nameFontFamily,
    bioFontFamily,
    buttonFontFamily,
    radii: {
      effective: effectiveRadius,
      bar: barRadius,
      card: cardRadius,
      inner: innerRadius,
      control: controlRadius,
    },
    surfaceStyle,
    ctaStyle,
    cssVars,
  };
}

export interface BlockContrastPalette {
  surfaceBg: string;
  fg: string;
  muted: string;
  subtleBorder: string;
  inputBg: string;
  inputBorder: string;
  btnBg: string;
  btnText: string;
  isDarkSurface: boolean;
}

export function getBlockContrastPalette(
  surfaceStyle?: CSSProperties,
  tokens?: Partial<VibeTokens> | null,
  backdropHex = '#FFFFFF'
): BlockContrastPalette {
  const rawSurfaceBg =
    (surfaceStyle?.backgroundColor as string | undefined) ||
    tokens?.buttonBg ||
    backdropHex;
  const resolvedBackdrop = resolveCssColorToHex(tokens?.bg || backdropHex, '#FFFFFF');
  const effectiveSurfaceHex = resolveCssColorToHex(
    rawSurfaceBg === 'transparent' ? resolvedBackdrop : rawSurfaceBg,
    resolvedBackdrop
  );
  const surfaceLum = getHexLuminance(effectiveSurfaceHex) ?? 255;
  const isDarkSurface = surfaceLum < 145;

  const preferredFg =
    (surfaceStyle?.color as string | undefined) ||
    tokens?.buttonText ||
    tokens?.text ||
    (isDarkSurface ? '#FFFFFF' : '#0A0A0A');

  const fg = ensureContrastText(preferredFg, effectiveSurfaceHex, 4.5, resolvedBackdrop);
  const usesLightText = (getHexLuminance(resolveCssColorToHex(fg, '#0A0A0A')) ?? 0) >= 150;
  const muted = usesLightText ? 'rgba(248, 250, 252, 0.80)' : 'rgba(10, 10, 10, 0.78)';
  const subtleBorder =
    tokens?.buttonBorder && tokens.buttonBorder !== 'transparent'
      ? tokens.buttonBorder
      : usesLightText
        ? 'rgba(255, 255, 255, 0.22)'
        : 'rgba(10, 10, 10, 0.18)';
  const isSaturatedLightSurface = !usesLightText && surfaceLum < 225;
  const inputBg = usesLightText
    ? 'rgba(255, 255, 255, 0.10)'
    : isSaturatedLightSurface
      ? 'rgba(255, 255, 255, 0.72)'
      : 'rgba(10, 10, 10, 0.04)';
  const inputBorder = usesLightText ? 'rgba(255, 255, 255, 0.24)' : 'rgba(10, 10, 10, 0.22)';

  // Distinct primary CTA colors inside card surfaces
  const preferredCtaBg =
    tokens?.buttonBg &&
    tokens.buttonBg !== 'transparent' &&
    resolveCssColorToHex(tokens.buttonBg, resolvedBackdrop).toUpperCase() !==
      effectiveSurfaceHex.toUpperCase()
      ? resolveCssColorToHex(tokens.buttonBg, resolvedBackdrop)
      : usesLightText
        ? '#FFFFFF'
        : '#0A0A0A';
  const btnBg = preferredCtaBg;
  const btnText = ensureContrastText(tokens?.buttonText, btnBg, 4.5, effectiveSurfaceHex);

  return {
    surfaceBg: rawSurfaceBg,
    fg,
    muted,
    subtleBorder,
    inputBg,
    inputBorder,
    btnBg,
    btnText,
    isDarkSurface,
  };
}

export function buildProfileSsrHeadTags(input: BlockThemeInput): string {
  const contract = resolveBlockThemeContract(input);
  const varLines = Object.entries(contract.cssVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');

  const fontFamilies =
    input.appearance && input.appearance.schemaVersion === 2
      ? [
          input.appearance.typography.name.family,
          input.appearance.typography.bio.family,
          input.appearance.typography.button.family,
        ]
      : [
          input.fontSettings?.nameFont,
          input.fontSettings?.bioFont,
          input.fontSettings?.buttonFont,
        ];

  const fontUrl = buildGoogleFontsStylesheetUrl(fontFamilies);

  const fontLinkTag = fontUrl
    ? `<link id="iveo-ssr-fonts" rel="stylesheet" href="${fontUrl.replace(/&/g, '&amp;')}" />\n    `
    : '';

  const ssrStyle = `<style id="iveo-ssr-theme">
      :root { ${varLines} }
      html, body { background-color: ${contract.baseBg} !important; color: ${contract.tokens.text}; font-family: ${contract.bioFontFamily}; }
      .iveo-ssr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
    </style>`;

  return `${fontLinkTag}${ssrStyle}`;
}

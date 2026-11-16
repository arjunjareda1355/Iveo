import type { VibeTokens } from './vibes.ts';
import type { BackgroundConfig } from './preferences.ts';
import { isDarkBackgroundPreset } from './backgrounds.ts';

export interface ButtonColors {
  bg?: string | null;
  text?: string | null;
  border?: string | null;
}

export const COLOR_SWATCHES: readonly string[] = [
  '#0A0A0A',
  '#FFFFFF',
  '#F8FAFC',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#E11D48',
  '#059669',
  '#D97706',
  '#FACC15',
  '#0EA5E9',
  '#EC4899',
] as const;

const HEX_SHORT_RE = /^#?([0-9a-fA-F]{3})$/;
const HEX_FULL_RE = /^#?([0-9a-fA-F]{6})$/;

/**
 * Normalizes a user-entered hex code (e.g. "2563eb", "#f0a", "#AABBCC") to "#RRGGBB",
 * or returns "transparent" if explicitly requested. Returns null if invalid.
 */
export function normalizeHexColor(
  input: string | null | undefined,
  options?: { allowTransparent?: boolean }
): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (options?.allowTransparent && trimmed.toLowerCase() === 'transparent') {
    return 'transparent';
  }

  const fullMatch = trimmed.match(HEX_FULL_RE);
  if (fullMatch) {
    return `#${fullMatch[1].toUpperCase()}`;
  }

  const shortMatch = trimmed.match(HEX_SHORT_RE);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return null;
}

export function isValidHexColor(
  input: string | null | undefined,
  options?: { allowTransparent?: boolean }
): boolean {
  return normalizeHexColor(input, options) !== null;
}

/**
 * Parses #RRGGBB into RGB [0..255] or returns null.
 */
export function parseHexRgb(color: string | null | undefined): [number, number, number] | null {
  const norm = normalizeHexColor(color);
  if (!norm) return null;
  const hex = norm.slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Returns WCAG perceived luminance in [0..255].
 */
export function getHexLuminance(color: string | null | undefined): number | null {
  const rgb = parseHexRgb(color);
  if (!rgb) return null;
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function isLightHexColor(color: string | null | undefined): boolean {
  const lum = getHexLuminance(color);
  if (lum === null) return false;
  return lum > 165;
}

export function getContrastTextColor(bgColor: string | null | undefined): '#0A0A0A' | '#FFFFFF' {
  const lum = getHexLuminance(bgColor);
  if (lum === null) return '#FFFFFF';
  return lum > 160 ? '#0A0A0A' : '#FFFFFF';
}

export function parseButtonColors(raw: unknown): ButtonColors | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bg = normalizeHexColor(typeof r.bg === 'string' ? r.bg : null, { allowTransparent: true });
  const text = normalizeHexColor(typeof r.text === 'string' ? r.text : null);
  const border = normalizeHexColor(typeof r.border === 'string' ? r.border : null, {
    allowTransparent: true,
  });

  if (!bg && !text && !border) return null;
  return { bg, text, border };
}

/**
 * WCAG 2.1 relative luminance in [0..1].
 */
export function getRelativeLuminance(color: string | null | undefined): number | null {
  const rgb = parseHexRgb(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two hex colors [1..21].
 */
export function getContrastRatio(
  fg: string | null | undefined,
  bg: string | null | undefined
): number | null {
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function blendHex(baseHex: string, overlayHex: string, opacity: number): string {
  const base = parseHexRgb(baseHex);
  const ov = parseHexRgb(overlayHex);
  if (!base || !ov) return baseHex;
  const a = Math.min(1, Math.max(0, opacity));
  const r = Math.round(base[0] * (1 - a) + ov[0] * a);
  const g = Math.round(base[1] * (1 - a) + ov[1] * a);
  const b = Math.round(base[2] * (1 - a) + ov[2] * a);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function extractBackgroundSampleHex(
  bg?: BackgroundConfig | null,
  fallbackBgHex = '#FFFFFF'
): string | null {
  if (!bg || !bg.type || bg.type === 'none') {
    return normalizeHexColor(fallbackBgHex) || '#FFFFFF';
  }
  let base: string | null = null;
  if (bg.type === 'solid') {
    base = normalizeHexColor(bg.value) || '#FFFFFF';
  } else if (bg.gradientStops && bg.gradientStops.length > 0) {
    base = normalizeHexColor(bg.gradientStops[0]);
  } else if (bg.value) {
    const hexMatches = bg.value.match(/#[0-9a-fA-F]{3,6}\b/g);
    if (hexMatches && hexMatches.length > 0) {
      base = normalizeHexColor(hexMatches[hexMatches.length - 1]);
    }
  }
  if (!base && bg.presetId) {
    base = isDarkBackgroundPreset(bg.presetId) ? '#0B0F19' : '#F8FAFC';
  }
  if (!base && bg.type === 'image') {
    base = '#111827';
  }
  if (!base) {
    base = normalizeHexColor(fallbackBgHex) || '#FFFFFF';
  }
  if (bg.overlayColor && typeof bg.overlayOpacity === 'number' && bg.overlayOpacity > 0) {
    const ov = normalizeHexColor(bg.overlayColor);
    if (ov) {
      base = blendHex(base, ov, bg.overlayOpacity);
    }
  }
  return base;
}

export interface BackgroundContrastReport {
  ratio: number;
  passesAA: boolean;
  passesLargeAA: boolean;
  isDarkBg: boolean;
  sampleHex: string;
}

export function checkBackgroundContrast(
  fgHex: string,
  bg?: BackgroundConfig | null,
  fallbackBgHex = '#FFFFFF'
): BackgroundContrastReport {
  const sampleHex = extractBackgroundSampleHex(bg, fallbackBgHex) || '#FFFFFF';
  const cleanFg = normalizeHexColor(fgHex) || '#0A0A0A';
  const ratio = getContrastRatio(cleanFg, sampleHex) ?? 21;
  const lum = getHexLuminance(sampleHex) ?? 255;
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesLargeAA: ratio >= 3,
    isDarkBg: lum < 135,
    sampleHex,
  };
}

/**
 * Determines whether a configured page background is dark so light-theme vibes
 * maintain readable heading, bio, and footer text automatically.
 */
export function isDarkBackgroundConfig(bg?: BackgroundConfig | null): boolean {
  if (!bg || !bg.type || bg.type === 'none') return false;
  if (bg.type === 'solid') {
    let base = normalizeHexColor(bg.value) || '#FFFFFF';
    if (bg.overlayColor && typeof bg.overlayOpacity === 'number' && bg.overlayOpacity > 0) {
      const ov = normalizeHexColor(bg.overlayColor);
      if (ov) base = blendHex(base, ov, bg.overlayOpacity);
    }
    const lum = getHexLuminance(base);
    return lum !== null ? lum < 135 : false;
  }
  if (bg.gradientStops && bg.gradientStops.length > 0) {
    const lums = bg.gradientStops
      .map((s) => {
        let base = normalizeHexColor(s) || '#FFFFFF';
        if (bg.overlayColor && typeof bg.overlayOpacity === 'number' && bg.overlayOpacity > 0) {
          const ov = normalizeHexColor(bg.overlayColor);
          if (ov) base = blendHex(base, ov, bg.overlayOpacity);
        }
        return getHexLuminance(base);
      })
      .filter((n): n is number => n !== null);
    if (lums.length > 0) {
      const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
      return avg < 135;
    }
  }
  if (isDarkBackgroundPreset(bg.presetId)) return true;
  if (bg.type === 'image' && bg.value) return true;
  const sample = extractBackgroundSampleHex(bg, '#FFFFFF');
  if (sample) {
    const lum = getHexLuminance(sample);
    if (lum !== null) return lum < 135;
  }
  return false;
}

/**
 * Merges vibe tokens with optional user-customized buttonColors and dark-backdrop legibility fixes.
 */
export function resolveEffectiveTokens(
  vibeTokens: VibeTokens,
  buttonColors?: ButtonColors | null,
  background?: BackgroundConfig | null
): VibeTokens {
  const customBg = normalizeHexColor(buttonColors?.bg, { allowTransparent: true });
  const customText = normalizeHexColor(buttonColors?.text);
  const customBorder = normalizeHexColor(buttonColors?.border, { allowTransparent: true });

  let effectiveText = vibeTokens.text;
  let effectiveMuted = vibeTokens.muted;
  const isDarkBg = isDarkBackgroundConfig(background);
  if (isDarkBg && isLightHexColor(vibeTokens.bg)) {
    effectiveText = '#F8FAFC';
    effectiveMuted = 'rgba(248, 250, 252, 0.78)';
  } else if (!isDarkBg && background && background.type !== 'none' && !isLightHexColor(vibeTokens.bg)) {
    effectiveText = '#0A0A0A';
    effectiveMuted = 'rgba(10, 10, 10, 0.68)';
  }

  const finalButtonBg = customBg || vibeTokens.buttonBg;
  let finalButtonText = customText || vibeTokens.buttonText;
  // Auto-ensure contrast if user customized fill color without explicitly picking text color
  if (customBg && customBg !== 'transparent' && !customText) {
    finalButtonText = getContrastTextColor(customBg);
  } else if (customBg === 'transparent' && !customText) {
    finalButtonText = effectiveText;
  }

  let finalButtonBorder = vibeTokens.buttonBorder;
  let finalButtonBorderWidth = vibeTokens.buttonBorderWidth;
  if (customBorder === 'transparent') {
    finalButtonBorder = undefined;
    finalButtonBorderWidth = undefined;
  } else if (customBorder) {
    finalButtonBorder = customBorder;
    finalButtonBorderWidth = vibeTokens.buttonBorderWidth || '1.5px';
  } else if (customBg === 'transparent' && !finalButtonBorder) {
    finalButtonBorder = effectiveText;
    finalButtonBorderWidth = '1.5px';
  }

  return {
    ...vibeTokens,
    text: effectiveText,
    muted: effectiveMuted,
    buttonBg: finalButtonBg,
    buttonText: finalButtonText,
    buttonBorder: finalButtonBorder,
    buttonBorderWidth: finalButtonBorderWidth,
  };
}

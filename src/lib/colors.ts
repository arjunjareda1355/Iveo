import type { VibeTokens } from './vibes';
import type { BackgroundConfig } from './preferences';
import { isDarkBackgroundPreset } from './backgrounds';

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
 * Determines whether a configured page background is dark so light-theme vibes
 * maintain readable heading, bio, and footer text automatically.
 */
export function isDarkBackgroundConfig(bg?: BackgroundConfig | null): boolean {
  if (!bg || !bg.type || bg.type === 'none') return false;
  if (isDarkBackgroundPreset(bg.presetId)) return true;
  if (bg.type === 'image' && bg.value) return true;
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
  if (isDarkBackgroundConfig(background) && isLightHexColor(vibeTokens.bg)) {
    effectiveText = '#F8FAFC';
    effectiveMuted = 'rgba(248, 250, 252, 0.78)';
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

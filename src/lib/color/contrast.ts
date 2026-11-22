/**
 * Section 8.1 Contrast & Color Parsing Utilities (pure TypeScript, zero dependencies).
 */

export interface RgbaColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
  a: number; // 0..1
}

/**
 * Normalizes a 3, 6, or 8-digit hex string to upper-case #RRGGBB or #RRGGBBAA.
 * Returns null if invalid. Accepts optional leading '#'.
 */
export function normalizeHexStrict(
  input: string | null | undefined,
  options?: { allowAlpha?: boolean; allowTransparent?: boolean }
): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (options?.allowTransparent && trimmed.toLowerCase() === 'transparent') {
    return 'transparent';
  }

  const m6 = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
  if (m6) {
    return `#${m6[1].toUpperCase()}`;
  }

  const m3 = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
  if (m3) {
    const [r, g, b] = m3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (options?.allowAlpha) {
    const m8 = trimmed.match(/^#?([0-9a-fA-F]{8})$/);
    if (m8) {
      return `#${m8[1].toUpperCase()}`;
    }
    const m4 = trimmed.match(/^#?([0-9a-fA-F]{4})$/);
    if (m4) {
      const [r, g, b, a] = m4[1].split('');
      return `#${r}${r}${g}${g}${b}${b}${a}${a}`.toUpperCase();
    }
  }

  return null;
}

/**
 * Parses #RGB, #RRGGBB, #RRGGBBAA, rgb(...), rgba(...), or "transparent" into RGBA.
 */
export function parseColorToRgba(input: string | null | undefined): RgbaColor | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase() === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hexNorm = normalizeHexStrict(trimmed, { allowAlpha: true });
  if (hexNorm && hexNorm.startsWith('#')) {
    const h = hexNorm.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i
  );
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgbaMatch[1]))));
    const g = Math.min(255, Math.max(0, Math.round(Number(rgbaMatch[2]))));
    const b = Math.min(255, Math.max(0, Math.round(Number(rgbaMatch[3]))));
    let a = 1;
    if (rgbaMatch[4] !== undefined) {
      if (rgbaMatch[4].endsWith('%')) {
        a = Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]) / 100));
      } else {
        a = Math.min(1, Math.max(0, Number(rgbaMatch[4])));
      }
    }
    return { r, g, b, a };
  }

  return null;
}

export function rgbaToHex(rgba: RgbaColor, includeAlpha = false): `#${string}` {
  const r = Math.min(255, Math.max(0, Math.round(rgba.r))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(rgba.g))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(rgba.b))).toString(16).padStart(2, '0');
  if (includeAlpha && rgba.a < 0.999) {
    const a = Math.min(255, Math.max(0, Math.round(rgba.a * 255))).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`.toUpperCase() as `#${string}`;
  }
  return `#${r}${g}${b}`.toUpperCase() as `#${string}`;
}

export function rgbaToCssString(rgba: RgbaColor): string {
  const r = Math.min(255, Math.max(0, Math.round(rgba.r)));
  const g = Math.min(255, Math.max(0, Math.round(rgba.g)));
  const b = Math.min(255, Math.max(0, Math.round(rgba.b)));
  if (rgba.a >= 0.999) {
    return rgbaToHex({ r, g, b, a: 1 });
  }
  const a = Number(Math.min(1, Math.max(0, rgba.a)).toFixed(3));
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * WCAG 2.x sRGB channel linearization (Section 8.1):
 * lin(c) = c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4 (c in 0..1)
 */
export function linearizeChannel(channel255: number): number {
  const c = Math.min(1, Math.max(0, channel255 / 255));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance Y in [0..1] (Section 8.1).
 */
export function relativeLuminance(color: string | RgbaColor): number {
  const rgba = typeof color === 'string' ? parseColorToRgba(color) : color;
  if (!rgba) return 0;
  const r = linearizeChannel(rgba.r);
  const g = linearizeChannel(rgba.g);
  const b = linearizeChannel(rgba.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Alpha-blends foreground over opaque background in sRGB space:
 * out = a * fg + (1 - a) * bg
 */
export function alphaBlend(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const a = Math.min(1, Math.max(0, fg.a));
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/**
 * Composites a potentially translucent foreground string over an opaque backdrop string.
 */
export function compositeOverBg(fgColor: string, bgColor: string): RgbaColor {
  const bg = parseColorToRgba(bgColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  const fg = parseColorToRgba(fgColor);
  if (!fg) return { ...bg, a: 1 };
  if (fg.a >= 0.999) return { ...fg, a: 1 };
  return alphaBlend(fg, bg);
}

/**
 * WCAG 2.x contrast ratio between fg and bg (composites translucent fg over bg).
 */
export function contrastRatio(fgColor: string | RgbaColor, bgColor: string | RgbaColor): number {
  const bgRgba =
    typeof bgColor === 'string'
      ? parseColorToRgba(bgColor) ?? { r: 255, g: 255, b: 255, a: 1 }
      : bgColor;
  const fgRaw =
    typeof fgColor === 'string'
      ? parseColorToRgba(fgColor) ?? { r: 0, g: 0, b: 0, a: 1 }
      : fgColor;
  const fgResolved = fgRaw.a < 0.999 ? alphaBlend(fgRaw, bgRgba) : fgRaw;

  const yA = relativeLuminance(fgResolved);
  const yB = relativeLuminance(bgRgba);
  const lighter = Math.max(yA, yB);
  const darker = Math.min(yA, yB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Computes worst-case (minimum) contrast of foreground (optionally composited over background)
 * against a set of background samples (e.g. [darkest, lightest]).
 */
export function worstCaseContrast(fgColor: string, bgSamples: readonly string[]): number {
  if (bgSamples.length === 0) return contrastRatio(fgColor, '#FFFFFF');
  let minRatio = Infinity;
  for (const sample of bgSamples) {
    const ratio = contrastRatio(fgColor, sample);
    if (ratio < minRatio) minRatio = ratio;
  }
  return minRatio === Infinity ? 21 : minRatio;
}

/**
 * Section 8.2 OKLab & OKLCH Color Space (Björn Ottosson exact matrices).
 * Pure TypeScript, zero dependencies.
 */
import { parseColorToRgba, rgbaToHex, type RgbaColor } from './contrast.ts';

export interface OklabColor {
  L: number; // ~0..1
  a: number;
  b: number;
}

export interface OklchColor {
  L: number; // 0..1
  C: number; // >= 0
  h: number; // 0..360 degrees
}

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

function srgbToLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb255(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

export function rgbToOklab(r: number, g: number, b: number): OklabColor {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

export function oklabToLinearRgb(lab: OklabColor): LinearRgb {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

export function oklabToRgb(lab: OklabColor): RgbaColor {
  const lin = oklabToLinearRgb(lab);
  return {
    r: linearToSrgb255(lin.r),
    g: linearToSrgb255(lin.g),
    b: linearToSrgb255(lin.b),
    a: 1,
  };
}

export function oklabToOklch(lab: OklabColor): OklchColor {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h: C < 1e-6 ? 0 : h };
}

export function oklchToOklab(lch: OklchColor): OklabColor {
  const rad = (normalizeHue(lch.h) * Math.PI) / 180;
  return {
    L: lch.L,
    a: lch.C * Math.cos(rad),
    b: lch.C * Math.sin(rad),
  };
}

export function normalizeHue(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const mod = h % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  return oklabToOklch(rgbToOklab(r, g, b));
}

export function oklchToRgb(lch: OklchColor): RgbaColor {
  return oklabToRgb(oklchToOklab(lch));
}

export function hexToOklab(color: string): OklabColor {
  const rgba = parseColorToRgba(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  return rgbToOklab(rgba.r, rgba.g, rgba.b);
}

export function oklabToHex(lab: OklabColor): `#${string}` {
  return rgbaToHex(oklabToRgb(lab));
}

export function hexToOklch(color: string): OklchColor {
  return oklabToOklch(hexToOklab(color));
}

export function oklchToHex(lch: OklchColor): `#${string}` {
  return rgbaToHex(oklchToRgb(lch));
}

/**
 * Euclidean distance in OKLab (Section 8.2).
 * ~0.02 = barely different, ~0.10 = clearly different.
 */
export function deltaE(colorA: string | OklabColor, colorB: string | OklabColor): number {
  const a = typeof colorA === 'string' ? hexToOklab(colorA) : colorA;
  const b = typeof colorB === 'string' ? hexToOklab(colorB) : colorB;
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function formatOklch(lch: OklchColor): string {
  return `oklch(${(lch.L * 100).toFixed(1)}% ${lch.C.toFixed(3)} ${normalizeHue(lch.h).toFixed(0)})`;
}

/**
 * Shortest angular distance between two hues in degrees [0..180].
 */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(normalizeHue(h1) - normalizeHue(h2));
  return d > 180 ? 360 - d : d;
}

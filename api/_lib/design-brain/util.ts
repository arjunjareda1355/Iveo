// util.ts: colour maths + seeded RNG (no dependencies)

export type Hex = string;

export function hexToRgb(h: Hex): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): Hex {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

export function luminance(h: Hex): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: Hex, b: Hex): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDark(h: Hex): boolean {
  return luminance(h) < 0.25;
}

export function badge(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Fail';
}

/** Best readable text colour for a background: tries preferred first, then near-black/white. */
export function readableOn(bg: Hex, preferred?: Hex, min = 4.5): Hex {
  if (preferred && contrast(bg, preferred) >= min) return preferred;
  const dark = '#0B0A0A';
  const light = '#FFFFFF';
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
}

export function rgbToHsl(h: Hex): [number, number, number] {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hh = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hh =
      max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    hh *= 60;
  }
  return [hh, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): Hex {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Safe small hue/lightness nudge: creates variety without breaking the palette. */
export function shift(h: Hex, dHue: number, dSat = 0, dLight = 0): Hex {
  const [hh, s, l] = rgbToHsl(h);
  return hslToHex(hh + dHue, s + dSat, l + dLight);
}

export function mix(a: Hex, b: Hex, t: number): Hex {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t
  );
}

// ---------- seeded RNG (mulberry32) ----------
export function hashSeed(s: string | number): number {
  const str = String(s);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

export class RNG {
  private a: number;
  constructor(seed: string | number) {
    this.a = hashSeed(seed) || 1;
  }
  next(): number {
    let t = (this.a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  range(min: number, max: number) {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** weighted pick: weights[i] >= 0 */
  weighted<T>(arr: readonly T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
    if (total <= 0) return this.pick(arr);
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
  chance(p: number) {
    return this.next() < p;
  }
}

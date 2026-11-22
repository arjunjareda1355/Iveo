/**
 * Section 8.3 Background Analysis (analyzeBackground -> BgProfile), Smart Scrim solver,
 * deterministic signature memoization, and OKLab k-means palette extraction.
 */
import type { Background, BgProfile, Hex } from '../appearance/types.ts';
import { CATALOG_BACKGROUNDS, findCatalogBackground } from '../appearance/catalog/backgrounds.ts';
import {
  alphaBlend,
  contrastRatio,
  normalizeHexStrict,
  parseColorToRgba,
  relativeLuminance,
  rgbaToHex,
  worstCaseContrast,
  type RgbaColor as Rgba,
} from './contrast.ts';
import { oklabToOklch, oklabToRgb, rgbToOklab } from './oklch.ts';

const PROFILE_CACHE = new Map<string, BgProfile>();
const MAX_CACHE_SIZE = 256;

export function buildBackgroundSignature(bg: Background): string {
  switch (bg.type) {
    case 'solid':
      return `solid:${normalizeHexStrict(bg.color) || '#FFFFFF'}`;
    case 'preset':
      return `preset:${bg.id}:g${bg.grain ?? 0}:b${bg.blur ?? 0}:v${bg.vignette ?? 0}:t${bg.tone ?? 0}:p${bg.pattern?.kind ?? 'none'}:${bg.pattern?.opacity ?? 0}:a${bg.animate ? 1 : 0}`;
    case 'gradient':
      return `grad:${bg.kind}:${Math.round(bg.angle)}:${bg.stops
        .map((s) => `${normalizeHexStrict(s.color) || '#FFFFFF'}@${Math.round(s.at)}`)
        .join(',')}`;
    case 'image':
      return `img:${bg.assetId}:b${bg.blur}:o${bg.opacity}:br${bg.brightness}:ov${bg.overlay?.color ?? ''}@${bg.overlay?.alpha ?? 0}:sc${bg.smartScrim === false ? 0 : 1}:g${(bg.luminanceGrid || []).slice(0, 8).map((v) => v.toFixed(2)).join(',')}:d${(bg.dominantColors || []).join(',')}`;
    case 'legacy':
      return `legacy:${bg.baseHex ?? ''}:${bg.isDark ? 1 : 0}:${bg.css.slice(0, 180)}`;
    default:
      return 'unknown';
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgbaSafe(hex: string | undefined, fallback: Rgba = { r: 250, g: 250, b: 249, a: 1 }): Rgba {
  if (!hex) return fallback;
  return parseColorToRgba(hex) || fallback;
}

function sampleLinearGradient(
  u: number,
  v: number,
  angleDeg: number,
  stops: ReadonlyArray<{ color: string; at: number }>
): Rgba {
  if (stops.length === 0) return { r: 255, g: 255, b: 255, a: 1 };
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const tRaw = (u - 0.5) * dx + (v - 0.5) * dy + 0.5;
  const pct = clamp01(tRaw) * 100;

  if (pct <= sorted[0].at) return hexToRgbaSafe(sorted[0].color);
  if (pct >= sorted[sorted.length - 1].at) return hexToRgbaSafe(sorted[sorted.length - 1].color);

  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i];
    const s1 = sorted[i + 1];
    if (pct >= s0.at && pct <= s1.at) {
      const span = Math.max(0.0001, s1.at - s0.at);
      const k = (pct - s0.at) / span;
      const c0 = hexToRgbaSafe(s0.color);
      const c1 = hexToRgbaSafe(s1.color);
      return {
        r: lerp(c0.r, c1.r, k),
        g: lerp(c0.g, c1.g, k),
        b: lerp(c0.b, c1.b, k),
        a: lerp(c0.a, c1.a, k),
      };
    }
  }
  return hexToRgbaSafe(sorted[0].color);
}

function sampleRadialGradient(
  u: number,
  v: number,
  stops: ReadonlyArray<{ color: string; at: number }>
): Rgba {
  if (stops.length === 0) return { r: 255, g: 255, b: 255, a: 1 };
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const dist = Math.hypot(u - 0.5, v - 0.5) * 1.4142;
  const pct = clamp01(dist) * 100;
  if (pct <= sorted[0].at) return hexToRgbaSafe(sorted[0].color);
  if (pct >= sorted[sorted.length - 1].at) return hexToRgbaSafe(sorted[sorted.length - 1].color);
  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i];
    const s1 = sorted[i + 1];
    if (pct >= s0.at && pct <= s1.at) {
      const k = (pct - s0.at) / Math.max(0.0001, s1.at - s0.at);
      const c0 = hexToRgbaSafe(s0.color);
      const c1 = hexToRgbaSafe(s1.color);
      return {
        r: lerp(c0.r, c1.r, k),
        g: lerp(c0.g, c1.g, k),
        b: lerp(c0.b, c1.b, k),
        a: lerp(c0.a, c1.a, k),
      };
    }
  }
  return hexToRgbaSafe(sorted[0].color);
}

function sampleConicGradient(
  u: number,
  v: number,
  angleDeg: number,
  stops: ReadonlyArray<{ color: string; at: number }>
): Rgba {
  if (stops.length === 0) return { r: 255, g: 255, b: 255, a: 1 };
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  let deg = (Math.atan2(v - 0.5, u - 0.5) * 180) / Math.PI + 90 - angleDeg;
  deg = ((deg % 360) + 360) % 360;
  const pct = (deg / 360) * 100;
  if (pct <= sorted[0].at) return hexToRgbaSafe(sorted[0].color);
  if (pct >= sorted[sorted.length - 1].at) return hexToRgbaSafe(sorted[sorted.length - 1].color);
  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i];
    const s1 = sorted[i + 1];
    if (pct >= s0.at && pct <= s1.at) {
      const k = (pct - s0.at) / Math.max(0.0001, s1.at - s0.at);
      const c0 = hexToRgbaSafe(s0.color);
      const c1 = hexToRgbaSafe(s1.color);
      return {
        r: lerp(c0.r, c1.r, k),
        g: lerp(c0.g, c1.g, k),
        b: lerp(c0.b, c1.b, k),
        a: lerp(c0.a, c1.a, k),
      };
    }
  }
  return hexToRgbaSafe(sorted[0].color);
}

function extractCssColors(css: string): Rgba[] {
  const results: Rgba[] = [];
  const hexMatches = css.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) || [];
  for (const h of hexMatches) {
    const p = parseColorToRgba(h);
    if (p) results.push(p);
  }
  const rgbMatches = css.match(/rgba?\([^)]+\)/gi) || [];
  for (const r of rgbMatches) {
    const p = parseColorToRgba(r);
    if (p) results.push(p);
  }
  return results;
}

/**
 * Generates a 48x48 analytically rasterized RGBA sample grid (2304 samples) representing
 * what sits behind links across the background.
 */
function rasterizeBackground48x48(bg: Background): { samples: Rgba[]; isNonFlat: boolean } {
  const N = 48;
  const samples: Rgba[] = new Array(N * N);

  if (bg.type === 'solid') {
    const c = hexToRgbaSafe(bg.color, { r: 250, g: 250, b: 249, a: 1 });
    samples.fill({ ...c, a: 1 });
    return { samples, isNonFlat: false };
  }

  if (bg.type === 'gradient') {
    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N;
        const c =
          bg.kind === 'radial'
            ? sampleRadialGradient(u, v, bg.stops)
            : bg.kind === 'conic'
              ? sampleConicGradient(u, v, bg.angle, bg.stops)
              : sampleLinearGradient(u, v, bg.angle, bg.stops);
        samples[y * N + x] = { r: c.r, g: c.g, b: c.b, a: 1 };
      }
    }
    return { samples, isNonFlat: true };
  }

  if (bg.type === 'preset') {
    const preset = findCatalogBackground(bg.id) || findCatalogBackground('bg-studio-white')!;
    const base = hexToRgbaSafe(preset.baseHex);
    const toneShift = ((bg.tone ?? 0) / 100) * 0.9; // -0.18..+0.18 OKLab L shift
    const vignetteAmt = clamp01((bg.vignette ?? (preset.vignetteOpacity ? preset.vignetteOpacity * 100 : 0)) / 100);
    const grainAmt = clamp01((bg.grain ?? (preset.grainOpacity ? preset.grainOpacity * 100 : 0)) / 100);
    const isNonFlat =
      preset.category !== 'solid-tonal' ||
      Boolean(bg.pattern && bg.pattern.kind !== 'none') ||
      grainAmt > 0.04 ||
      vignetteAmt > 0.05;

    for (let y = 0; y < N; y++) {
      const v = (y + 0.5) / N;
      for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N;
        let pixel: Rgba = preset.gradient
          ? preset.gradient.kind === 'radial'
            ? sampleRadialGradient(u, v, preset.gradient.stops)
            : preset.gradient.kind === 'conic'
              ? sampleConicGradient(u, v, preset.gradient.angle, preset.gradient.stops)
              : sampleLinearGradient(u, v, preset.gradient.angle, preset.gradient.stops)
          : { ...base, a: 1 };

        // Composite blobs (radial / aurora / glass circles)
        if (preset.blobs && preset.blobs.length > 0) {
          for (const b of preset.blobs) {
            const dx = (u * 100 - b.xPct) / Math.max(8, b.rxPct);
            const dy = (v * 100 - b.yPct) / Math.max(8, b.ryPct);
            const d = Math.hypot(dx, dy);
            const fadeAt = (b.fadeAtPct ?? 70) / 70;
            const falloff = clamp01(1 - d / Math.max(0.35, fadeAt));
            const alpha = b.peakAlpha * falloff * falloff;
            if (alpha > 0.002) {
              const bc = hexToRgbaSafe(b.color);
              pixel = alphaBlend({ ...bc, a: alpha }, pixel);
            }
          }
        }

        // Glass veil if any
        if (preset.veilColor) {
          const veil = parseColorToRgba(preset.veilColor);
          if (veil) pixel = alphaBlend(veil, pixel);
        }

        // Pattern modulation (small deterministic perturbation simulating visual texture)
        if (preset.patternKind && preset.patternColor && (x % 4 === 0 || y % 4 === 0)) {
          const pc = parseColorToRgba(preset.patternColor);
          if (pc) {
            pixel = alphaBlend({ ...pc, a: Math.min(0.45, pc.a * 0.65) }, pixel);
          }
        }

        // Tone shift in OKLab
        if (Math.abs(toneShift) > 0.001) {
          const lab = rgbToOklab(pixel.r, pixel.g, pixel.b);
          const shifted = oklabToRgb({ L: clamp01(lab.L + toneShift), a: lab.a, b: lab.b });
          pixel = { ...shifted, a: 1 };
        }

        // Vignette darkens outer perimeter
        if (vignetteAmt > 0.001) {
          const edgeDist = Math.hypot(u - 0.5, v - 0.5) * 1.4142;
          const vAlpha = vignetteAmt * clamp01((edgeDist - 0.35) / 0.65) * 0.65;
          if (vAlpha > 0.001) {
            pixel = alphaBlend({ r: 0, g: 0, b: 0, a: vAlpha }, pixel);
          }
        }

        // Grain micro-variation
        if (grainAmt > 0.001) {
          const pseudo = (((x * 37 + y * 17) % 11) - 5) / 5;
          const delta = pseudo * grainAmt * 22;
          pixel = {
            r: Math.max(0, Math.min(255, pixel.r + delta)),
            g: Math.max(0, Math.min(255, pixel.g + delta)),
            b: Math.max(0, Math.min(255, pixel.b + delta)),
            a: 1,
          };
        }

        samples[y * N + x] = { r: pixel.r, g: pixel.g, b: pixel.b, a: 1 };
      }
    }

    return { samples, isNonFlat };
  }

  if (bg.type === 'image') {
    const grid = bg.luminanceGrid && bg.luminanceGrid.length >= 64 ? bg.luminanceGrid : null;
    const dom = bg.dominantColors && bg.dominantColors.length > 0 ? bg.dominantColors : ['#1E293B', '#64748B', '#0F172A'];
    const baseRgb = hexToRgbaSafe(dom[0]);
    const brightnessFactor = Math.max(0.4, Math.min(1.4, (bg.brightness ?? 100) / 100));
    const opacityFactor = Math.max(0.3, Math.min(1, (bg.opacity ?? 100) / 100));
    const overlayRgba = bg.overlay ? hexToRgbaSafe(bg.overlay.color) : null;
    const overlayAlpha = bg.overlay?.alpha ?? 0;

    for (let y = 0; y < N; y++) {
      const gy = Math.min(7, Math.floor((y / N) * 8));
      for (let x = 0; x < N; x++) {
        const gx = Math.min(7, Math.floor((x / N) * 8));
        const targetY = grid ? clamp01(grid[gy * 8 + gx]) : ((gx + gy) % 3 === 0 ? 0.16 : 0.42);
        // Synthesize sample preserving exact directional luminance & dominant hue
        const baseLab = rgbToOklab(baseRgb.r, baseRgb.g, baseRgb.b);
        const lApprox = Math.pow(targetY, 1 / 2.6);
        const adjustedL = clamp01(lApprox * brightnessFactor);
        let rgb = oklabToRgb({ L: adjustedL, a: baseLab.a * 0.85, b: baseLab.b * 0.85 });
        // Apply opacity against white canvas
        if (opacityFactor < 1) {
          rgb = {
            r: rgb.r * opacityFactor + 255 * (1 - opacityFactor),
            g: rgb.g * opacityFactor + 255 * (1 - opacityFactor),
            b: rgb.b * opacityFactor + 255 * (1 - opacityFactor),
            a: 1,
          };
        }
        let pixel: Rgba = { ...rgb, a: 1 };
        if (overlayRgba && overlayAlpha > 0) {
          pixel = alphaBlend({ ...overlayRgba, a: overlayAlpha }, pixel);
        }
        samples[y * N + x] = pixel;
      }
    }
    return { samples, isNonFlat: true };
  }

  // Legacy frozen CSS fallback
  const extracted = extractCssColors(bg.css);
  const fallbackRgb: Rgba = bg.baseHex
    ? hexToRgbaSafe(bg.baseHex)
    : bg.isDark
      ? { r: 15, g: 15, b: 18, a: 1 }
      : { r: 250, g: 250, b: 249, a: 1 };
  const palette = extracted.length > 0 ? extracted : [fallbackRgb];

  for (let y = 0; y < N; y++) {
    const v = (y + 0.5) / N;
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N;
      const idx = (u * 0.5 + v * 0.5) * (palette.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(palette.length - 1, i0 + 1);
      const k = idx - i0;
      const c0 = palette[i0];
      const c1 = palette[i1];
      const opaque0 = c0.a < 1 ? alphaBlend(c0, fallbackRgb) : c0;
      const opaque1 = c1.a < 1 ? alphaBlend(c1, fallbackRgb) : c1;
      samples[y * N + x] = {
        r: lerp(opaque0.r, opaque1.r, k),
        g: lerp(opaque0.g, opaque1.g, k),
        b: lerp(opaque0.b, opaque1.b, k),
        a: 1,
      };
    }
  }
  return { samples, isNonFlat: palette.length > 1 || bg.css.includes('gradient') };
}

function summarizeSamples(
  samples: Rgba[],
  signature: string,
  isNonFlat: boolean,
  smartScrim: { color: Hex; alpha: number } | null
): BgProfile {
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;

  const points = samples.map((rgba) => {
    const lab = rgbToOklab(rgba.r, rgba.g, rgba.b);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    return {
      L: lab.L,
      a: lab.a,
      b: lab.b,
      hex: rgbaToHex(rgba),
    };
  });

  const count = points.length || 1;
  const meanL = sumL / count;
  const meanA = sumA / count;
  const meanB = sumB / count;
  const { C: meanC, h: meanHue } = oklabToOklch({ L: meanL, a: meanA, b: meanB });

  let varL = 0;
  for (const p of points) {
    const d = p.L - meanL;
    varL += d * d;
  }
  const stdDevL = Math.sqrt(varL / count);
  const complexity = clamp01(stdDevL / 0.18);

  const sortedByL = [...points].sort((a, b) => a.L - b.L);
  const p05Idx = Math.max(0, Math.min(count - 1, Math.floor(count * 0.05)));
  const p95Idx = Math.max(0, Math.min(count - 1, Math.floor(count * 0.95)));
  const darkest = sortedByL[p05Idx].hex;
  const lightest = sortedByL[p95Idx].hex;

  const p05L = sortedByL[p05Idx].L;
  const p95L = sortedByL[p95Idx].L;

  const meanRgb = oklabToRgb({ L: meanL, a: meanA, b: meanB });
  const meanHex = rgbaToHex({ ...meanRgb, a: 1 });

  const tone: BgProfile['tone'] = meanL >= 0.72 ? 'light' : meanL >= 0.45 ? 'mid' : 'dark';
  const chromatic = meanC >= 0.04;
  const warm = chromatic && ((meanHue >= 15 && meanHue <= 75) || meanHue >= 330);
  const cool = chromatic && meanHue >= 180 && meanHue <= 270;

  return {
    signature,
    meanL,
    meanC,
    meanHue,
    p05L,
    p95L,
    stdDevL,
    complexity,
    darkest,
    lightest,
    meanHex,
    tone,
    chromatic,
    warm,
    cool,
    isNonFlat,
    smartScrim,
  };
}

/**
 * Computes minimum smart scrim alpha (step 0.05, max 0.55) so page text achieves >= 4.5:1
 * against BOTH darkest and lightest background samples.
 */
export function solveSmartScrim(
  samples: Rgba[],
  pageTextHex: Hex
): { color: Hex; alpha: number } | null {
  const sampleHexes = [
    samples.reduce((a, b) => (relativeLuminance(rgbaToHex(a)) < relativeLuminance(rgbaToHex(b)) ? a : b)),
    samples.reduce((a, b) => (relativeLuminance(rgbaToHex(a)) > relativeLuminance(rgbaToHex(b)) ? a : b)),
  ].map((s) => rgbaToHex(s));

  if (worstCaseContrast(pageTextHex, sampleHexes) >= 4.5) {
    return null;
  }

  // Decide dark vs light scrim depending on which makes text contrast higher
  const textIsLight = relativeLuminance(pageTextHex) > 0.35;
  const scrimColor: Hex = textIsLight ? '#000000' : '#FFFFFF';
  const scrimRgb = textIsLight ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

  for (let step = 1; step <= 11; step++) {
    const alpha = Math.round(step * 5) / 100; // 0.05 .. 0.55
    const blendedSamples = sampleHexes.map((hex) => {
      const bgRgb = parseColorToRgba(hex)!;
      return rgbaToHex(alphaBlend({ ...scrimRgb, a: alpha }, bgRgb));
    });
    if (worstCaseContrast(pageTextHex, blendedSamples) >= 4.5) {
      return { color: scrimColor, alpha };
    }
  }

  return { color: scrimColor, alpha: 0.55 };
}

/**
 * Analyzes any Background into a deterministic BgProfile (memoized).
 */
export function analyzeBackground(
  bg: Background,
  options?: { pageTextHex?: Hex }
): BgProfile {
  const textKey = options?.pageTextHex ? `:${options.pageTextHex}` : '';
  const sig = buildBackgroundSignature(bg) + textKey;
  const cached = PROFILE_CACHE.get(sig);
  if (cached) return cached;

  const { samples, isNonFlat } = rasterizeBackground48x48(bg);

  let smartScrim: { color: Hex; alpha: number } | null = null;
  let effectiveSamples = samples;

  if (bg.type === 'image' && bg.smartScrim !== false) {
    const targetText = options?.pageTextHex || '#FFFFFF';
    smartScrim = solveSmartScrim(samples, targetText);
    if (smartScrim) {
      const scrimRgb = parseColorToRgba(smartScrim.color)!;
      effectiveSamples = samples.map((s) =>
        alphaBlend({ ...scrimRgb, a: smartScrim!.alpha }, s)
      );
    }
  }

  const profile = summarizeSamples(effectiveSamples, sig, isNonFlat, smartScrim);

  if (PROFILE_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = PROFILE_CACHE.keys().next().value;
    if (firstKey) PROFILE_CACHE.delete(firstKey);
  }
  PROFILE_CACHE.set(sig, profile);
  return profile;
}

/**
 * Warm cache for all 40 catalog backgrounds.
 */
let presetProfilesPrecomputed = false;
export function precomputePresetProfiles(): Map<string, BgProfile> {
  const out = new Map<string, BgProfile>();
  for (const preset of CATALOG_BACKGROUNDS) {
    const profile = analyzeBackground({ type: 'preset', id: preset.id });
    out.set(preset.id, profile);
  }
  presetProfilesPrecomputed = true;
  return out;
}

export function isPresetProfilesPrecomputed(): boolean {
  return presetProfilesPrecomputed;
}

/**
 * Returns human-friendly 2–4 word tone label for UI headers ("Dark, cool blue", "Light, warm peach").
 */
export function describeBgTone(profile: BgProfile): string {
  const toneLabel =
    profile.tone === 'light' ? 'Light' : profile.tone === 'dark' ? 'Dark' : 'Midtone';
  if (!profile.chromatic) {
    return `${toneLabel}, neutral`;
  }
  const h = profile.meanHue;
  let hueWord = 'neutral';
  if (h < 22 || h >= 340) hueWord = 'warm rose';
  else if (h < 50) hueWord = 'warm peach';
  else if (h < 85) hueWord = 'warm gold';
  else if (h < 155) hueWord = 'sage green';
  else if (h < 205) hueWord = 'cool aqua';
  else if (h < 255) hueWord = 'cool blue';
  else if (h < 305) hueWord = 'violet';
  else hueWord = 'magenta';
  return `${toneLabel}, ${hueWord}`;
}

/**
 * Deterministic k-means clustering in OKLab to extract k (default 5) dominant colors
 * from raw RGBA pixels (e.g., 64x64 downscaled profile photo).
 */
export function extractPaletteFromImagePixels(
  rgbaPixels: Uint8ClampedArray | number[],
  k = 5
): Hex[] {
  const points: Array<{ L: number; a: number; b: number }> = [];
  for (let i = 0; i + 3 < rgbaPixels.length; i += 4) {
    if (rgbaPixels[i + 3] < 128) continue;
    points.push(rgbToOklab(rgbaPixels[i], rgbaPixels[i + 1], rgbaPixels[i + 2]));
  }
  if (points.length === 0) {
    return ['#1F6FEB', '#E11D48', '#14B8A6', '#F59E0B', '#121212'];
  }

  // Deterministic stride initialization across brightness-sorted points
  const sorted = [...points].sort((p, q) => p.L - q.L);
  const centroids = Array.from({ length: k }, (_, idx) => {
    const pos = Math.min(sorted.length - 1, Math.floor(((idx + 0.5) / k) * sorted.length));
    return { ...sorted[pos] };
  });

  for (let iter = 0; iter < 8; iter++) {
    const sums = Array.from({ length: k }, () => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (const pt of points) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dL = pt.L - centroids[c].L;
        const da = pt.a - centroids[c].a;
        const db = pt.b - centroids[c].b;
        const dist = dL * dL + da * da + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      sums[best].L += pt.L;
      sums[best].a += pt.a;
      sums[best].b += pt.b;
      sums[best].n++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c].n > 0) {
        centroids[c] = {
          L: sums[c].L / sums[c].n,
          a: sums[c].a / sums[c].n,
          b: sums[c].b / sums[c].n,
        };
      }
    }
  }

  const seen = new Set<string>();
  const hexes: Hex[] = [];
  for (const c of centroids) {
    const rgb = oklabToRgb({ L: c.L, a: c.a, b: c.b });
    const hex = rgbaToHex({ ...rgb, a: 1 });
    if (!seen.has(hex)) {
      seen.add(hex);
      hexes.push(hex);
    }
  }
  return hexes;
}

/**
 * Generates curated solid suggestions (6 colors) derived from an accent hue that pass T5
 * with the given page text color (used in Background > Color "Suggested" row).
 */
export function generateSuggestedSolids(accentHex: Hex, pageTextHex: Hex, isDarkText: boolean): Hex[] {
  const accent = rgbToOklab(
    parseColorToRgba(accentHex)?.r ?? 31,
    parseColorToRgba(accentHex)?.g ?? 111,
    parseColorToRgba(accentHex)?.b ?? 235
  );
  const { h } = oklabToOklch({ L: accent.L, a: accent.a, b: accent.b });
  const candidates: Array<{ L: number; C: number; h: number }> = isDarkText
    ? [
        { L: 0.96, C: 0.015, h },
        { L: 0.93, C: 0.03, h: (h + 24) % 360 },
        { L: 0.94, C: 0.025, h: (h + 336) % 360 },
        { L: 0.90, C: 0.045, h },
        { L: 0.89, C: 0.04, h: (h + 180) % 360 },
        { L: 0.97, C: 0.008, h },
      ]
    : [
        { L: 0.14, C: 0.02, h },
        { L: 0.18, C: 0.04, h: (h + 24) % 360 },
        { L: 0.20, C: 0.05, h: (h + 336) % 360 },
        { L: 0.24, C: 0.06, h },
        { L: 0.16, C: 0.03, h: (h + 180) % 360 },
        { L: 0.11, C: 0.01, h },
      ];

  const results: Hex[] = [];
  for (const cand of candidates) {
    const rgb = oklabToRgb({
      L: cand.L,
      a: cand.C * Math.cos((cand.h * Math.PI) / 180),
      b: cand.C * Math.sin((cand.h * Math.PI) / 180),
    });
    const hex = rgbaToHex({ ...rgb, a: 1 });
    if (contrastRatio(pageTextHex, hex) >= 4.5 && !results.includes(hex)) {
      results.push(hex);
    }
  }
  return results;
}

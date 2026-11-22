/**
 * Section 8.2 Gamut Mapping & Section 8.6 Auto Text Selection (bestText).
 */
import { contrastRatio, rgbaToHex, worstCaseContrast } from './contrast.ts';
import {
  hexToOklch,
  normalizeHue,
  oklabToLinearRgb,
  oklchToOklab,
  oklchToRgb,
  type OklchColor,
} from './oklch.ts';

/**
 * Returns true if linear RGB channels are within sRGB [0..1] (with 1e-4 numerical tolerance).
 */
export function inGamut(lch: OklchColor): boolean {
  const lin = oklabToLinearRgb(oklchToOklab(lch));
  const eps = 1e-4;
  return (
    lin.r >= -eps &&
    lin.r <= 1 + eps &&
    lin.g >= -eps &&
    lin.g <= 1 + eps &&
    lin.b >= -eps &&
    lin.b <= 1 + eps
  );
}

/**
 * Binary-searches chroma downward (12 iterations) keeping L and h constant
 * until the color fits inside sRGB gamut (Section 8.2).
 */
export function reduceChromaToGamut(lch: OklchColor): OklchColor {
  const clampedL = Math.min(1, Math.max(0, lch.L));
  const hue = normalizeHue(lch.h);
  const startC = Math.max(0, lch.C);

  const candidate: OklchColor = { L: clampedL, C: startC, h: hue };
  if (inGamut(candidate)) {
    return candidate;
  }

  let lo = 0;
  let hi = startC;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) * 0.5;
    if (inGamut({ L: clampedL, C: mid, h: hue })) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { L: clampedL, C: lo, h: hue };
}

/**
 * Converts an OKLCH color into an in-gamut hex string by gamut-reducing chroma (never blind clipping).
 */
export function safeOklchToHex(lch: OklchColor): `#${string}` {
  const safe = reduceChromaToGamut(lch);
  return rgbaToHex(oklchToRgb(safe));
}

/**
 * Applies Section 8.5 chroma cap by lightness band and gamut-reduces into sRGB hex.
 */
export function maxAllowedChroma(L: number): number {
  return L < 0.4 ? 0.14 : L <= 0.7 ? 0.2 : 0.16;
}

export function cappedOklchToHex(lch: OklchColor): `#${string}` {
  const L = Math.min(1, Math.max(0, lch.L));
  const cap = maxAllowedChroma(L);
  return safeOklchToHex({ L, C: Math.min(Math.max(0, lch.C), cap), h: lch.h });
}

/**
 * Adjusts lightness of `colorHex` in 0.02 OKLCH L steps toward light or dark
 * until worst-case contrast against `bgSamples` reaches `targetRatio`.
 * Returns null if unreachable in <= 35 steps.
 */
export function adjustLightnessToPass(
  colorHex: string,
  bgSamples: readonly string[],
  targetRatio: number,
  direction?: 'lighter' | 'darker'
): `#${string}` | null {
  if (worstCaseContrast(colorHex, bgSamples) >= targetRatio) {
    return rgbaToHex(oklchToRgb(reduceChromaToGamut(hexToOklch(colorHex))));
  }

  const base = hexToOklch(colorHex);
  const dirs: Array<'lighter' | 'darker'> = direction
    ? [direction]
    : base.L < 0.5
      ? ['darker', 'lighter']
      : ['lighter', 'darker'];

  let bestHex: `#${string}` | null = null;
  let bestScore = -1;

  for (const dir of dirs) {
    const step = dir === 'lighter' ? 0.02 : -0.02;
    for (let i = 1; i <= 45; i++) {
      const nextL = base.L + step * i;
      if (nextL < 0.02 || nextL > 0.99) break;
      const candidateHex = safeOklchToHex({
        L: nextL,
        C: base.C * (nextL < 0.16 || nextL > 0.92 ? 0.5 : 1),
        h: base.h,
      });
      const ratio = worstCaseContrast(candidateHex, bgSamples);
      if (ratio >= targetRatio) {
        return candidateHex;
      }
      if (ratio > bestScore) {
        bestScore = ratio;
        bestHex = candidateHex;
      }
    }
  }

  return bestScore >= targetRatio ? bestHex : null;
}

/**
 * Section 8.6: bestText(fill, bgWorst?)
 * Returns whichever of ink (#0A0A0B tinted to the fill hue, C <= 0.02) or paper (#FAFAF9 tinted)
 * has the higher contrast with `fill`.
 * If neither reaches minContrast (4.5), moves the FILL lightness in 0.02 steps (max 20 steps)
 * toward whichever side helps.
 */
export function bestText(
  fillColor: string,
  bgWorst: string | readonly string[] = '#FFFFFF',
  minContrast = 4.5
): { fill: `#${string}`; text: `#${string}`; contrast: number } {
  const bgSamples = Array.isArray(bgWorst) ? bgWorst : [bgWorst];
  const isTransparent = fillColor.trim().toLowerCase() === 'transparent';
  const fillOklch = hexToOklch(isTransparent ? bgSamples[0] || '#FFFFFF' : fillColor);
  const tintHue = fillOklch.h;
  const tintChroma = Math.min(0.015, fillOklch.C * 0.18);

  // Subtle hue-tinted ink & paper per 8.6 (C <= 0.02)
  const inkCandidate =
    fillOklch.C < 0.01
      ? ('#0A0A0B' as `#${string}`)
      : safeOklchToHex({ L: 0.145, C: Math.min(0.018, tintChroma), h: tintHue });
  const paperCandidate =
    fillOklch.C < 0.01
      ? ('#FAFAF9' as `#${string}`)
      : safeOklchToHex({ L: 0.978, C: Math.min(0.008, tintChroma * 0.5), h: tintHue });

  const pickOnFill = (currentFill: string): { text: `#${string}`; contrast: number } => {
    const inkR =
      currentFill.toLowerCase() === 'transparent'
        ? worstCaseContrast(inkCandidate, bgSamples)
        : contrastRatio(inkCandidate, currentFill);
    const paperR =
      currentFill.toLowerCase() === 'transparent'
        ? worstCaseContrast(paperCandidate, bgSamples)
        : contrastRatio(paperCandidate, currentFill);

    // Try pure extremes too if tinted missed slightly
    if (inkR >= paperR) {
      if (inkR >= minContrast) return { text: inkCandidate, contrast: inkR };
      const blackR =
        currentFill.toLowerCase() === 'transparent'
          ? worstCaseContrast('#0A0A0B', bgSamples)
          : contrastRatio('#0A0A0B', currentFill);
      if (blackR > inkR) return { text: '#0A0A0B', contrast: blackR };
      return { text: inkCandidate, contrast: inkR };
    } else {
      if (paperR >= minContrast) return { text: paperCandidate, contrast: paperR };
      const whiteR =
        currentFill.toLowerCase() === 'transparent'
          ? worstCaseContrast('#FFFFFF', bgSamples)
          : contrastRatio('#FFFFFF', currentFill);
      if (whiteR > paperR) return { text: '#FFFFFF', contrast: whiteR };
      return { text: paperCandidate, contrast: paperR };
    }
  };

  if (isTransparent) {
    const res = pickOnFill('transparent');
    return {
      fill: 'transparent' as `#${string}`,
      text: res.text,
      contrast: res.contrast,
    };
  }

  let currentFillHex = safeOklchToHex(fillOklch);
  let picked = pickOnFill(currentFillHex);
  if (picked.contrast >= minContrast) {
    return { fill: currentFillHex, text: picked.text, contrast: picked.contrast };
  }

  // Move fill lightness in 0.02 steps (max 20 steps) toward whichever side helps
  const inkC = contrastRatio(inkCandidate, currentFillHex);
  const paperC = contrastRatio(paperCandidate, currentFillHex);
  const dir = paperC >= inkC ? -0.02 : 0.02;

  for (let i = 1; i <= 20; i++) {
    const nextL = Math.min(0.98, Math.max(0.08, fillOklch.L + dir * i));
    const candidateFill = cappedOklchToHex({
      L: nextL,
      C: fillOklch.C,
      h: fillOklch.h,
    });
    const res = pickOnFill(candidateFill);
    if (res.contrast >= minContrast) {
      return { fill: candidateFill, text: res.text, contrast: res.contrast };
    }
    if (res.contrast > picked.contrast) {
      currentFillHex = candidateFill;
      picked = res;
    }
  }

  // Fallback to pure white or near-black fill with max contrast
  return { fill: currentFillHex, text: picked.text, contrast: picked.contrast };
}

/**
 * Section 8.4/8.5 Tone-to-Strategy rules + Section 11 Smart Suggestion Engines
 * (Button colours R1-R12, Fonts curated+generated, Layout recipes+mutations).
 * Pure deterministic functions driven by mulberry32 seeded PRNG.
 */
import type {
  AppearanceLock,
  Background,
  BgProfile,
  ButtonShapeV2,
  ButtonSurface,
  ButtonTokens,
  Color,
  EntranceV2,
  HeaderLayoutV2,
  Hex,
  LayoutTokens,
  LinkLayoutV2,
  SpacingV2,
  WidthV2,
} from '../appearance/types.ts';
import type { CatalogVibe } from '../appearance/catalog/vibes.ts';
import {
  CATALOG_FONTS,
  clampWeightToFont,
  findCatalogFont,
  isFontAllowedForRole,
  type CatalogFont,
} from '../appearance/catalog/fonts.ts';
import { CURATED_FONT_PAIRINGS } from '../appearance/catalog/pairings.ts';
import {
  LAYOUT_RECIPES,
  type LayoutRecipe,
} from '../appearance/catalog/layouts.ts';
import {
  checkLinkLayoutLabelWarning,
  checkSurfaceCompatibility,
  enforceLayoutInvariants,
} from '../appearance/catalog/surfaces.ts';
import {
  alphaBlend,
  contrastRatio,
  parseColorToRgba,
  worstCaseContrast,
} from './contrast.ts';
import {
  bestText,
  cappedOklchToHex,
  maxAllowedChroma,
  safeOklchToHex,
} from './gamut.ts';
import { deltaE, hexToOklch, hueDistance, normalizeHue } from './oklch.ts';
import { mulberry32, pickOne } from './prng.ts';

// ── SECTION 8.5 TONE-TO-STRATEGY DATA TABLE ─────────────────────────────────

export interface ToneStrategyBand {
  id: string;
  minL: number;
  maxL: number;
  inkFillL: number;
  paperFillL: number;
  accentFillL: number;
  recommendedNotes: string;
  avoidNotes: string;
}

export const TONE_STRATEGY_TABLE: readonly ToneStrategyBand[] = [
  {
    id: 'ultra-light',
    minL: 0.92,
    maxL: 1.01,
    inkFillL: 0.18,
    paperFillL: 0.97,
    accentFillL: 0.48,
    recommendedNotes: 'Near-black tinted (L 0.15-0.22); deep accent (L 0.42-0.55); outline ink',
    avoidNotes: 'Pale fills, light greys',
  },
  {
    id: 'light',
    minL: 0.78,
    maxL: 0.92,
    inkFillL: 0.19,
    paperFillL: 0.97,
    accentFillL: 0.46,
    recommendedNotes: 'Deep ink / deep accent / subtle tonal soft (L -0.07)',
    avoidNotes: 'Fills within 0.05 L of background',
  },
  {
    id: 'mid-light',
    minL: 0.62,
    maxL: 0.78,
    inkFillL: 0.22,
    paperFillL: 0.96,
    accentFillL: 0.42,
    recommendedNotes: 'Dark ink (L 0.18-0.30); deep accent L <= 0.50; white text',
    avoidNotes: 'Mid-tone fills (low contrast)',
  },
  {
    id: 'mid',
    minL: 0.45,
    maxL: 0.62,
    inkFillL: 0.16,
    paperFillL: 0.97,
    accentFillL: 0.18,
    recommendedNotes: 'Pure extremes (ink L <= 0.20 or paper L >= 0.96); glass blur 16px',
    avoidNotes: 'Mid fills, same-hue mids',
  },
  {
    id: 'mid-dark',
    minL: 0.28,
    maxL: 0.45,
    inkFillL: 0.16,
    paperFillL: 0.95,
    accentFillL: 0.80,
    recommendedNotes: 'Light paper (L >= 0.92); bright accent (L 0.75-0.85)',
    avoidNotes: 'Dark fills close to background',
  },
  {
    id: 'dark',
    minL: -0.01,
    maxL: 0.28,
    inkFillL: 0.16,
    paperFillL: 0.96,
    accentFillL: 0.82,
    recommendedNotes: 'Light paper (L 0.94-0.98); neon outline (L 0.82-0.90); gold foil; glass',
    avoidNotes: 'Black fills, grey outlines',
  },
] as const;

export function getToneStrategy(meanL: number): ToneStrategyBand {
  return (
    TONE_STRATEGY_TABLE.find((b) => meanL >= b.minL && meanL < b.maxL) ||
    TONE_STRATEGY_TABLE[0]
  );
}

// ── SECTION 8.4 RULE CHECKER (T1-T5) ─────────────────────────────────────────

export interface ButtonRuleEval {
  passStrict: boolean;
  passSoft: boolean;
  textContrast: number;
  affordanceContrast: number;
  focusContrast: number;
}

function worstContrastColorOverSamples(fg: Color, samples: readonly Hex[]): number {
  let minC = Infinity;
  for (const s of samples) {
    const c = contrastRatio(fg, s);
    if (c < minC) minC = c;
  }
  return Number.isFinite(minC) ? minC : 1;
}

function resolveEffectiveTextOnFill(fill: Color, text: Color, bgSample: Hex): number {
  if (fill === 'transparent') {
    return contrastRatio(text, bgSample);
  }
  const bgRgb = parseColorToRgba(bgSample);
  const fillRgb = parseColorToRgba(fill);
  if (!bgRgb || !fillRgb) return 1;
  const resolvedFill = fillRgb.a < 1 ? alphaBlend(fillRgb, bgRgb) : fillRgb;
  const textRgb = parseColorToRgba(text);
  if (!textRgb) return 1;
  const resolvedText = textRgb.a < 1 ? alphaBlend(textRgb, resolvedFill) : textRgb;
  return contrastRatio(
    `rgba(${Math.round(resolvedText.r)},${Math.round(resolvedText.g)},${Math.round(resolvedText.b)},1)`,
    `rgba(${Math.round(resolvedFill.r)},${Math.round(resolvedFill.g)},${Math.round(resolvedFill.b)},1)`
  );
}

export function evaluateButtonSetRules(
  fill: Color,
  text: Color,
  border: Color,
  borderWidth: number,
  bgProfile: BgProfile
): ButtonRuleEval {
  const samples: readonly Hex[] = [bgProfile.darkest, bgProfile.lightest];
  const textContrast = Math.min(
    resolveEffectiveTextOnFill(fill, text, samples[0]),
    resolveEffectiveTextOnFill(fill, text, samples[1])
  );

  const affordanceContrast = Math.min(
    ...samples.map((s) => {
      const fAff = fill === 'transparent' ? 1 : contrastRatio(fill, s);
      const bAff = borderWidth > 0 && border !== 'transparent' ? contrastRatio(border, s) : 1;
      return Math.max(fAff, bAff);
    })
  );

  const focusContrast = Math.max(
    worstContrastColorOverSamples(text, samples),
    border !== 'transparent' ? worstContrastColorOverSamples(border, samples) : 1
  );

  const t1 = textContrast >= 4.5;
  const t2 = fill === 'transparent' ? worstContrastColorOverSamples(text, samples) >= 4.5 : true;
  const t3 = affordanceContrast >= 3.0;

  return {
    passStrict: t1 && t2 && t3,
    passSoft: t1 && t2,
    textContrast: Number(textContrast.toFixed(2)),
    affordanceContrast: Number(affordanceContrast.toFixed(2)),
    focusContrast: Number(focusContrast.toFixed(2)),
  };
}

// ── 11.1 BUTTON COLOUR SUGGESTIONS (8 ButtonSet) ─────────────────────────────

export interface ButtonSetSuggestion {
  id: string;
  recipe:
    | 'R1'
    | 'R2'
    | 'R3'
    | 'R4'
    | 'R5'
    | 'R6'
    | 'R7'
    | 'R8'
    | 'R9'
    | 'R10'
    | 'R11'
    | 'R12';
  name: string;
  fill: Color;
  text: Color;
  border: Color;
  borderWidth: 0 | 1 | 2 | 3 | 4;
  surface?: ButtonSurface;
  shape?: ButtonShapeV2;
  subtle?: boolean;
  lowContrast?: boolean;
  why: string;
  textContrast: number;
  affordanceContrast: number;
  badgeLabel: string;
  scores: {
    contrast: number;
    harmony: number;
    vibe: number;
    novelty: number;
    total: number;
  };
}

function getHueNameWord(hex: Color): string {
  if (hex === 'transparent') return 'Clear';
  const oklch = hexToOklch(hex);
  if (oklch.C < 0.03) return oklch.L < 0.4 ? 'Ink' : 'Paper';
  const h = oklch.h;
  if (h < 25 || h >= 340) return 'Crimson';
  if (h < 55) return 'Amber';
  if (h < 95) return 'Gold';
  if (h < 155) return 'Emerald';
  if (h < 205) return 'Teal';
  if (h < 255) return 'Cobalt';
  if (h < 305) return 'Violet';
  return 'Rose';
}

function adjustHueAndChromaCandidate(
  L: number,
  C: number,
  h: number
): Hex {
  const safeL = Math.max(0.06, Math.min(0.98, L));
  const capC = Math.min(C, maxAllowedChroma(safeL));
  return cappedOklchToHex({ L: safeL, C: capC, h: normalizeHue(h) });
}

function pickBestLightnessForT3(
  h: number,
  C: number,
  bgProfile: BgProfile,
  targetFill?: Hex
): { fill: Hex; text: Hex; border: Hex; borderWidth: 0 | 1 | 2 } | null {
  const startL = targetFill ? hexToOklch(targetFill).L : bgProfile.meanL < 0.5 ? 0.82 : 0.45;
  const directions = bgProfile.meanL < 0.5 ? [1, -1] : [-1, 1];
  const samples = [bgProfile.darkest, bgProfile.lightest];

  for (const dir of directions) {
    for (let step = 0; step <= 32; step++) {
      const candidateL = startL + dir * step * 0.025;
      if (candidateL < 0.08 || candidateL > 0.96) continue;
      const fill = adjustHueAndChromaCandidate(candidateL, C, h);
      const afford = Math.min(contrastRatio(fill, samples[0]), contrastRatio(fill, samples[1]));
      if (afford >= 3.0) {
        const textRes = bestText(fill, samples[0], 4.5);
        const rule = evaluateButtonSetRules(textRes.fill, textRes.text, textRes.fill, 0, bgProfile);
        if (rule.passStrict) {
          return { fill: textRes.fill, text: textRes.text, border: textRes.fill, borderWidth: 0 };
        }
      }
    }
  }

  // Dual-edge fill+border pairs: first preserve the target hue with whichever of paper/ink border
  // covers its weak contrast end on extreme gradients, then try pure ink/paper pairs.
  const candFill = adjustHueAndChromaCandidate(startL, C, h);
  const weakDark = contrastRatio(candFill, samples[0]) < contrastRatio(candFill, samples[1]);
  const primaryBorder: Hex = weakDark ? '#F5F5F4' : '#121211';
  const secondaryBorder: Hex = weakDark ? '#121211' : '#F5F5F4';

  const tryPairs: Array<{ f: Hex; b: Hex }> = [
    { f: candFill, b: primaryBorder },
    { f: candFill, b: secondaryBorder },
    { f: adjustHueAndChromaCandidate(0.32, C, h), b: '#F5F5F4' },
    { f: adjustHueAndChromaCandidate(0.84, Math.min(C, 0.14), h), b: '#121211' },
    { f: '#121211', b: '#F5F5F4' },
    { f: '#F5F5F4', b: '#121211' },
  ];
  for (const pair of tryPairs) {
    const textRes = bestText(pair.f, samples[0], 4.5);
    const rule = evaluateButtonSetRules(textRes.fill, textRes.text, pair.b, 2, bgProfile);
    if (rule.passStrict) {
      return { fill: textRes.fill, text: textRes.text, border: pair.b, borderWidth: 2 };
    }
  }
  return null;
}

export function suggestButtons(params: {
  bgProfile: BgProfile;
  bg: Background;
  vibe: CatalogVibe;
  current: ButtonTokens;
  locks: readonly AppearanceLock[];
  seed: number;
  seenSignatures?: ReadonlySet<string>;
  refreshCount?: number;
}): ButtonSetSuggestion[] {
  const { bgProfile, bg, vibe, current, locks, seed, seenSignatures, refreshCount = 0 } = params;
  const rng = mulberry32(seed);
  const samples: readonly Hex[] = [bgProfile.darkest, bgProfile.lightest];
  const strategy = getToneStrategy(bgProfile.meanL);
  const baseHue = bgProfile.chromatic ? bgProfile.meanHue : hexToOklch(vibe.page.accent).h || 255;

  const lockFill = locks.includes('btn.fill');
  const lockText = locks.includes('btn.text');
  const lockBorder = locks.includes('btn.border');

  type RawCand = {
    recipe: ButtonSetSuggestion['recipe'];
    label: string;
    why: string;
    fill: Color;
    text: Color;
    border: Color;
    borderWidth: 0 | 1 | 2 | 3 | 4;
    surface?: ButtonSurface;
    subtle?: boolean;
    idealHue?: number;
  };

  const candidates: RawCand[] = [];

  // 3 variants per recipe (R1 .. R12)
  for (let v = 0; v < 3; v++) {
    const hueJitter = (rng() - 0.5) * 24;
    const lJitter = (rng() - 0.5) * 0.05;
    const cScale = 0.85 + rng() * 0.25;

    // R1 "Contrast Ink"
    {
      const isDarkBg = bgProfile.meanL < 0.5;
      const targetL = isDarkBg ? 0.965 - Math.abs(lJitter) * 0.5 : strategy.inkFillL + lJitter * 0.6;
      const targetC = isDarkBg
        ? Math.min(0.015, bgProfile.meanC)
        : Math.min(0.03, 0.35 * bgProfile.meanC);
      const fill = adjustHueAndChromaCandidate(targetL, targetC, baseHue + hueJitter * 0.4);
      const bt = bestText(fill, bgProfile.darkest, 7.0);
      const flatRule = evaluateButtonSetRules(bt.fill, bt.text, bt.fill, 0, bgProfile);
      const invBorder: Hex = isDarkBg ? '#121211' : '#F5F5F4';
      const needsEdge = !flatRule.passStrict;
      candidates.push({
        recipe: 'R1',
        label: 'Contrast Ink',
        why: isDarkBg ? 'Crisp light button on a dark page.' : 'Deep ink on a light page. Easy to read.',
        fill: bt.fill,
        text: bt.text,
        border: needsEdge ? invBorder : bt.fill,
        borderWidth: needsEdge ? 2 : 0,
      });
    }

    // R2 "Tonal Soft" (SOFT tier)
    {
      const isDark = bgProfile.meanL < 0.5;
      const fL = isDark ? Math.min(0.36, bgProfile.meanL + 0.08 + v * 0.015) : Math.max(0.55, bgProfile.meanL - 0.08 - v * 0.015);
      const fC = Math.min(0.09, Math.max(bgProfile.meanC, 0.025) * 1.15);
      const fill = adjustHueAndChromaCandidate(fL, fC, baseHue + hueJitter * 0.5);
      const border = adjustHueAndChromaCandidate(
        isDark ? fL + 0.06 : fL - 0.06,
        fC,
        baseHue
      );
      const bt = bestText(fill, bgProfile.darkest, 4.5);
      candidates.push({
        recipe: 'R2',
        label: 'Tonal Soft',
        why: 'Blends gently with your backdrop.',
        fill: bt.fill,
        text: bt.text,
        border,
        borderWidth: 1,
        subtle: true,
      });
    }

    // R3 "Accent Pop"
    {
      const targetHue = bgProfile.chromatic
        ? normalizeHue(baseHue + 180 + (rng() - 0.5) * 36)
        : normalizeHue((v === 0 ? 285 : rng() * 360));
      const baseL = bgProfile.meanL < 0.5 ? 0.78 + lJitter : 0.50 + lJitter;
      const solved = pickBestLightnessForT3(
        targetHue,
        0.17 * cScale,
        bgProfile,
        adjustHueAndChromaCandidate(baseL, 0.17 * cScale, targetHue)
      );
      if (solved) {
        candidates.push({
          recipe: 'R3',
          label: `Accent Pop · ${getHueNameWord(solved.fill)}`,
          why: bgProfile.chromatic ? 'Complementary accent that pops.' : 'Vibrant accent built for contrast.',
          ...solved,
          idealHue: bgProfile.chromatic ? normalizeHue(baseHue + 180) : targetHue,
        });
      }
    }

    // R4 "Analogous Glow"
    {
      const sign = v % 2 === 0 ? 1 : -1;
      const targetHue = normalizeHue(baseHue + sign * (28 + (rng() - 0.5) * 10));
      const baseL = bgProfile.meanL < 0.5 ? 0.78 + lJitter : 0.48 + lJitter;
      const solved = pickBestLightnessForT3(
        targetHue,
        0.12 * cScale,
        bgProfile,
        adjustHueAndChromaCandidate(baseL, 0.12 * cScale, targetHue)
      );
      if (solved) {
        const borderHex = adjustHueAndChromaCandidate(
          Math.min(0.94, hexToOklch(solved.fill).L + 0.08),
          0.11,
          targetHue
        );
        candidates.push({
          recipe: 'R4',
          label: `Analogous · ${getHueNameWord(solved.fill)}`,
          why: 'Harmonic shade drawn from your backdrop.',
          fill: solved.fill,
          text: solved.text,
          border: borderHex,
          borderWidth: Math.max(1, solved.borderWidth) as 1 | 2,
          surface: 'solid-soft',
          idealHue: normalizeHue(baseHue + sign * 28),
        });
      }
    }

    // R5 "Outline Clean"
    {
      const isDark = bgProfile.meanL < 0.5;
      const tL = isDark ? 0.95 - v * 0.02 : 0.18 + v * 0.02;
      const tColor = adjustHueAndChromaCandidate(tL, Math.min(0.02, bgProfile.meanC), baseHue);
      const tWorst = worstCaseContrast(tColor, samples);
      if (tWorst >= 7.0) {
        candidates.push({
          recipe: 'R5',
          label: 'Outline Clean',
          why: 'Minimal hairline border lets the page breathe.',
          fill: 'transparent',
          text: tColor,
          border: tColor,
          borderWidth: 2,
        });
      }
    }

    // R6 "Glass"
    {
      const c1Ok = checkSurfaceCompatibility('glass', bgProfile, bg, vibe.page.accent, '#FFFFFF').allowed;
      if (c1Ok) {
        const isDark = bgProfile.tone === 'dark';
        const glassFill: Color = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.56)';
        const textHex: Hex = isDark ? '#F5F7FB' : '#121316';
        const borderColor: Color = isDark ? 'rgba(255,255,255,0.34)' : 'rgba(18,19,22,0.28)';
        candidates.push({
          recipe: 'R6',
          label: 'Frosted Glass',
          why: 'Translucent layer softly blurs your background.',
          fill: glassFill,
          text: textHex,
          border: borderColor,
          borderWidth: 1,
          surface: 'glass',
        });
      }
    }

    // R7 "Inverse Duo"
    {
      const invL = Math.max(0.12, Math.min(0.94, 1 - bgProfile.meanL + lJitter * 0.5));
      const fill = adjustHueAndChromaCandidate(invL, Math.min(bgProfile.meanC, 0.06), baseHue);
      const textPref = bestText(fill, bgProfile.darkest, 7.0);
      const border: Hex = bgProfile.meanL < 0.5 ? '#F5F5F4' : '#121211';
      candidates.push({
        recipe: 'R7',
        label: 'Inverse Duo',
        why: 'Inverts backdrop tone for unmistakable hierarchy.',
        fill: textPref.fill,
        text: textPref.text,
        border,
        borderWidth: 2,
      });
    }

    // R8 "Triad Bold"
    {
      const sign = v % 2 === 0 ? 1 : -1;
      const targetHue = normalizeHue(baseHue + sign * 120 + hueJitter * 0.5);
      const baseL = bgProfile.meanL < 0.5 ? 0.77 + lJitter : 0.49 + lJitter;
      const solved = pickBestLightnessForT3(
        targetHue,
        0.16 * cScale,
        bgProfile,
        adjustHueAndChromaCandidate(baseL, 0.16 * cScale, targetHue)
      );
      if (solved) {
        candidates.push({
          recipe: 'R8',
          label: `Triad · ${getHueNameWord(solved.fill)}`,
          why: 'Balanced triadic contrast from your page hue.',
          ...solved,
          idealHue: normalizeHue(baseHue + sign * 120),
        });
      }
    }

    // R9 "Vibe Accent"
    {
      const vibeAccOklch = hexToOklch(vibe.page.accent);
      const solved = pickBestLightnessForT3(
        vibeAccOklch.h,
        Math.max(0.08, vibeAccOklch.C),
        bgProfile,
        vibe.page.accent
      );
      if (solved) {
        candidates.push({
          recipe: 'R9',
          label: `${vibe.name} Accent`,
          why: `Echoes the ${vibe.name} accent cleanly.`,
          ...solved,
        });
      }
    }

    // R10 "Gold Foil"
    if (bgProfile.tone === 'dark' || (bgProfile.warm && bgProfile.meanL < 0.6)) {
      candidates.push({
        recipe: 'R10',
        label: 'Gold Foil',
        why: 'Warm brushed metallic leaf that pops on deep tones.',
        fill: '#D4AF37',
        text: '#0A0A09',
        border: '#E7C873',
        borderWidth: 1,
        surface: 'metallic',
      });
    }

    // R11 "Neon Edge"
    if (bgProfile.tone === 'dark') {
      const neonHue = normalizeHue(150 + rng() * 180);
      const fill = adjustHueAndChromaCandidate(
        Math.min(0.24, bgProfile.meanL + 0.03),
        Math.min(0.06, bgProfile.meanC),
        baseHue
      );
      const neon = adjustHueAndChromaCandidate(0.86, 0.17, neonHue);
      candidates.push({
        recipe: 'R11',
        label: `Neon · ${getHueNameWord(neon)}`,
        why: 'Luminous neon border engineered for dark canvases.',
        fill,
        text: neon,
        border: neon,
        borderWidth: 2,
        surface: 'neon-glow',
      });
    }

    // R12 "Wildcard"
    {
      const wildHue = normalizeHue(rng() * 360);
      const baseL = bgProfile.meanL < 0.5 ? 0.8 + lJitter : 0.44 + lJitter;
      const solved = pickBestLightnessForT3(
        wildHue,
        0.15 * cScale,
        bgProfile,
        adjustHueAndChromaCandidate(baseL, 0.15 * cScale, wildHue)
      );
      if (solved) {
        candidates.push({
          recipe: 'R12',
          label: `Studio · ${getHueNameWord(solved.fill)}`,
          why: 'Fresh colour pairing tested for your background.',
          ...solved,
        });
      }
    }
  }

  // Respect user locks (fill / text / border)
  const lockedEvaluated: Array<ButtonSetSuggestion & { _fillKey: string }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let fill: Color = lockFill ? current.fill : c.fill;
    let text: Color = lockText ? current.text : c.text;
    let border: Color = lockBorder ? current.border : c.border;
    const borderWidth: 0 | 1 | 2 | 3 | 4 = lockBorder ? current.borderWidth : c.borderWidth;

    if (lockFill && !lockText && fill !== 'transparent') {
      const bt = bestText(fill, bgProfile.darkest, 4.5);
      fill = bt.fill;
      text = bt.text;
    } else if (!lockFill && lockText && fill !== 'transparent') {
      // Nudge fill lightness to satisfy text contrast against locked text color
      const textLum = hexToOklch(text).L;
      const searchL = textLum > 0.5 ? 0.18 : 0.94;
      const fillOklch = hexToOklch(fill);
      fill = adjustHueAndChromaCandidate(searchL, fillOklch.C, fillOklch.h);
      if (!lockBorder) border = fill;
    }

    // Surface compatibility check if candidate changes surface
    if (c.surface) {
      const compat = checkSurfaceCompatibility(
        c.surface,
        bgProfile,
        bg,
        vibe.page.accent,
        text === 'transparent' ? '#121212' : (text as string)
      );
      if (!compat.allowed) continue;
    }

    const evalRes = evaluateButtonSetRules(fill, text, border, borderWidth, bgProfile);
    const hasAnyLock = lockFill || lockText || lockBorder;

    if (c.subtle) {
      if (!evalRes.passSoft && !hasAnyLock) continue;
    } else {
      if (!evalRes.passStrict && !hasAnyLock) continue;
    }

    // Reject if a locked combo couldn't be fixed ONLY if we have non-locked alternatives;
    // Per spec 11.1 step 3: show with "Low contrast" tag instead of hiding when locks prevent fixing.
    const lowContrast = !c.subtle && !evalRes.passStrict;

    // Score calculation (Section 11.1 step 4)
    const contrastScore =
      0.5 * Math.min(1, Math.max(0, (evalRes.textContrast - 4.5) / (10 - 4.5))) +
      0.5 * Math.min(1, Math.max(0, (evalRes.affordanceContrast - 3.0) / (8 - 3.0)));

    let harmonyScore = 0.8;
    if (c.idealHue !== undefined && fill !== 'transparent') {
      const dist = hueDistance(hexToOklch(fill).h, c.idealHue);
      harmonyScore = dist <= 6 ? 1 : Math.max(0, 1 - (dist - 6) / 24);
    }

    const vibeTarget = vibe.button.fill !== 'transparent' ? vibe.button.fill : vibe.page.accent;
    const fillHex = fill === 'transparent' ? bgProfile.meanHex : (fill as string);
    const vibeAffinity =
      1 - Math.min(1, deltaE(fillHex, vibeTarget as string) / 0.35);

    const setSig = `${fill}|${text}|${border}|${c.surface || 'none'}`;
    const alreadySeen = seenSignatures?.has(setSig) ?? false;
    const novelty = alreadySeen ? 0.05 : 1.0;

    const total =
      0.45 * contrastScore +
      0.25 * harmonyScore +
      0.15 * vibeAffinity +
      0.15 * novelty -
      (lowContrast ? 0.4 : 0);

    const tierTag = evalRes.textContrast >= 7 ? 'AAA' : evalRes.textContrast >= 4.5 ? 'AA' : 'Low';

    lockedEvaluated.push({
      id: `${c.recipe}-${i}`,
      recipe: c.recipe,
      name: c.label,
      fill,
      text,
      border,
      borderWidth,
      surface: c.surface,
      subtle: c.subtle,
      lowContrast,
      why: c.why,
      textContrast: evalRes.textContrast,
      affordanceContrast: evalRes.affordanceContrast,
      badgeLabel: `${tierTag} ${evalRes.textContrast.toFixed(1)}`,
      scores: {
        contrast: contrastScore,
        harmony: harmonyScore,
        vibe: vibeAffinity,
        novelty,
        total,
      },
      _fillKey: fillHex,
    });
  }

  // Sort by descending total score (breaking ties deterministically)
  lockedEvaluated.sort((a, b) => b.scores.total - a.scores.total);

  // Select 8 diverse sets per Section 11.1 step 5
  const selected: ButtonSetSuggestion[] = [];
  const recipeCount = new Map<string, number>();

  const isDiverse = (cand: ButtonSetSuggestion & { _fillKey: string }, strictDelta = true): boolean => {
    for (const existing of selected) {
      if (cand.surface === existing.surface) {
        const d = deltaE(cand._fillKey, existing.fill === 'transparent' ? bgProfile.meanHex : existing.fill);
        if (strictDelta && d < 0.09) return false;
        if (!strictDelta && d < 0.06 && cand.recipe === existing.recipe) return false;
      }
    }
    return true;
  };

  const canTake = (cand: ButtonSetSuggestion & { _fillKey: string }, strictDelta = true): boolean => {
    if (selected.some((s) => `${s.fill}|${s.text}|${s.surface}` === `${cand.fill}|${cand.text}|${cand.surface}`)) {
      return false;
    }
    if ((recipeCount.get(cand.recipe) ?? 0) >= 2) return false;
    if (cand.subtle && selected.length < 3) return false; // SOFT sets only after slot 3
    return isDiverse(cand, strictDelta);
  };

  const take = (cand: ButtonSetSuggestion & { _fillKey: string }) => {
    selected.push(cand);
    recipeCount.set(cand.recipe, (recipeCount.get(cand.recipe) ?? 0) + 1);
  };

  // On refreshCount === 0: slot 1 is always the best R1 (unless none exists)
  if (refreshCount === 0) {
    const bestR1 = lockedEvaluated.find((c) => c.recipe === 'R1' && !c.subtle);
    if (bestR1) take(bestR1);
  }

  // Ensure at least one of {R1, R5}
  if (!selected.some((s) => s.recipe === 'R1' || s.recipe === 'R5')) {
    const safeNeutral = lockedEvaluated.find((c) => (c.recipe === 'R1' || c.recipe === 'R5') && canTake(c));
    if (safeNeutral) take(safeNeutral);
  }

  // Ensure at least one colourful {R3, R4, R8, R9}
  const hasColorful = selected.some((s) => ['R3', 'R4', 'R8', 'R9'].includes(s.recipe));
  if (!hasColorful) {
    const colorCand = lockedEvaluated.find(
      (c) => ['R3', 'R4', 'R8', 'R9'].includes(c.recipe) && canTake(c)
    );
    if (colorCand) take(colorCand);
  }

  // Pass 1: strict diversity deltaE >= 0.09, avoid seen
  for (const cand of lockedEvaluated) {
    if (selected.length >= 8) break;
    if (cand.scores.novelty > 0.5 && canTake(cand, true)) {
      take(cand);
    }
  }

  // Pass 2: allow slightly closer delta >= 0.06 or previously seen if pool scarce
  for (const cand of lockedEvaluated) {
    if (selected.length >= 8) break;
    if (canTake(cand, false)) {
      take(cand);
    }
  }

  // Final guaranteed fill up to 8 using delta >= 0.06 even if recipeCount > 2
  for (const cand of lockedEvaluated) {
    if (selected.length >= 8) break;
    if (cand.subtle && selected.length < 3) continue;
    if (
      !selected.some((s) => `${s.fill}|${s.text}|${s.surface}` === `${cand.fill}|${cand.text}|${cand.surface}`) &&
      isDiverse(cand, false)
    ) {
      take(cand);
    }
  }

  // Last-resort fill if extreme locked/gradient constraints limited diversity
  for (const cand of lockedEvaluated) {
    if (selected.length >= 8) break;
    if (cand.subtle && selected.length < 3) continue;
    if (!selected.some((s) => `${s.fill}|${s.text}|${s.border}|${s.surface}` === `${cand.fill}|${cand.text}|${cand.border}|${cand.surface}`)) {
      take(cand);
    }
  }

  return selected;
}

// ── 11.2 FONT SUGGESTIONS (6 FontCombo) ──────────────────────────────────────

export interface FontComboSuggestion {
  id: string;
  name: string;
  mood: string;
  nameFont: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide'; case?: 'normal' | 'upper' };
  bioFont: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide' };
  buttonFont: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide'; case?: 'normal' | 'upper' };
  locked: boolean; // requires Pro
  isCurated: boolean;
  score: number;
}

export function inferDesiredMoods(
  bgProfile: BgProfile,
  vibe: CatalogVibe,
  currentSurface: ButtonSurface
): string[] {
  const weights = new Map<string, number>();
  const add = (mood: string, w: number) => weights.set(mood, (weights.get(mood) ?? 0) + w);

  for (const m of vibe.moods) add(m, 0.4);
  if (bgProfile.tone === 'dark' && !bgProfile.chromatic) {
    add('modern', 0.4);
    add('techy', 0.35);
    add('luxury', 0.3);
  }
  if (bgProfile.tone === 'light' && !bgProfile.chromatic) {
    add('calm', 0.4);
    add('modern', 0.35);
    add('editorial', 0.35);
  }
  if (bgProfile.tone === 'light' && bgProfile.warm) {
    add('warm', 0.4);
    add('editorial', 0.35);
    add('friendly', 0.3);
    add('organic', 0.3);
  }
  if (bgProfile.meanC >= 0.1) {
    add('bold', 0.4);
    add('playful', 0.35);
    add('friendly', 0.3);
  }
  if (currentSurface === 'neon-glow' || currentSurface === 'glass') {
    add('futuristic', 0.35);
    add('techy', 0.35);
  } else if (currentSurface === 'offset-3d' || currentSurface === 'sticker') {
    add('playful', 0.35);
    add('bold', 0.35);
  } else if (currentSurface === 'metallic' || currentSurface === 'underline-only') {
    add('luxury', 0.35);
    add('editorial', 0.25);
  }

  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
}

function adjustWeightForBackground(font: CatalogFont, desired: number, isDark: boolean): number {
  const bumped = isDark ? Math.min(700, desired + 100) : desired;
  return clampWeightToFont(font, bumped);
}

function isSuperfamilyPair(a: string, b: string): boolean {
  const roots = ['Geist', 'DM', 'Instrument', 'Space', 'Plus Jakarta', 'Source', 'IBM Plex'];
  return roots.some((r) => a.startsWith(r) && b.startsWith(r));
}

function ensureDistinctMaxThreeFamilies(
  nFam: string,
  bFam: string,
  tFam: string
): string {
  const set = new Set([nFam, bFam, tFam]);
  if (set.size <= 3) return tFam;
  return bFam;
}

export function suggestFonts(params: {
  bgProfile: BgProfile;
  vibe: CatalogVibe;
  current: {
    name: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide'; case?: 'normal' | 'upper' };
    bio: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide' };
    button: { family: string; weight: number; tracking: 'tight' | 'normal' | 'wide'; case?: 'normal' | 'upper' };
  };
  currentSurface: ButtonSurface;
  locks: readonly AppearanceLock[];
  seed: number;
  seenIds?: ReadonlySet<string>;
  isPro: boolean;
}): FontComboSuggestion[] {
  const { bgProfile, vibe, current, currentSurface, locks, seed, seenIds, isPro } = params;
  const rng = mulberry32(seed);
  const topMoods = inferDesiredMoods(bgProfile, vibe, currentSurface);
  const isDark = bgProfile.tone === 'dark';
  const lockName = locks.includes('font.name');
  const lockBio = locks.includes('font.bio');
  const lockBtn = locks.includes('font.button');

  const namePool = CATALOG_FONTS.filter((f) => isFontAllowedForRole(f, 'N'));
  const bioPool = CATALOG_FONTS.filter(
    (f) => isFontAllowedForRole(f, 'B') && !f.excludeFromBio && f.legibility >= 0.8 && f.xHeight >= 0.48
  );
  const btnPool = CATALOG_FONTS.filter(
    (f) => isFontAllowedForRole(f, 'T') && f.legibility >= 0.75
  );

  const candidates: FontComboSuggestion[] = [];

  // 18 Curated pairings
  for (const p of CURATED_FONT_PAIRINGS) {
    const nf = findCatalogFont(p.nameFont.family) || CATALOG_FONTS[0];
    const bf = findCatalogFont(p.bioFont.family) || CATALOG_FONTS[0];
    const tf = findCatalogFont(p.buttonFont.family) || CATALOG_FONTS[0];
    if (bf.excludeFromBio) continue;

    const needsPro = nf.tier === 'pro' || bf.tier === 'pro' || tf.tier === 'pro';
    const moodHits = p.moods.filter((m) => topMoods.includes(m)).length;
    const moodScore = Math.min(1, moodHits / 2);
    const catContrast = nf.category !== bf.category || isSuperfamilyPair(nf.family, bf.family) ? 1 : 0.4;
    const legibilityScore = (bf.legibility + tf.legibility) / 2;
    const novelty = seenIds?.has(p.id) ? 0.1 : 1.0;

    let score = 0.4 * moodScore + 0.25 * catContrast + 0.2 * legibilityScore + 0.15 * novelty;
    if (!isPro && needsPro) score -= 0.2;

    // Slight bump if vibe matches exact curated name font
    if (nf.family === vibe.fonts.name.family) score += 0.25;

    const finalNameFam = lockName ? current.name.family : nf.family;
    const finalBioFam = lockBio ? current.bio.family : bf.family;
    const finalBtnFam = ensureDistinctMaxThreeFamilies(
      finalNameFam,
      finalBioFam,
      lockBtn ? current.button.family : tf.family
    );

    candidates.push({
      id: p.id,
      name: p.name,
      mood: p.moods.slice(0, 2).map((m) => m[0].toUpperCase() + m.slice(1)).join(' · '),
      nameFont: {
        family: finalNameFam,
        weight: lockName ? current.name.weight : adjustWeightForBackground(nf, p.nameFont.weight, isDark),
        tracking: isDark ? 'wide' : nf.category === 'display' || nf.category === 'serif' ? 'tight' : 'normal',
      },
      bioFont: {
        family: finalBioFam,
        weight: lockBio ? current.bio.weight : adjustWeightForBackground(bf, Math.max(400, p.bioFont.weight), isDark),
        tracking: isDark ? 'wide' : 'normal',
      },
      buttonFont: {
        family: finalBtnFam,
        weight: lockBtn ? current.button.weight : adjustWeightForBackground(tf, p.buttonFont.weight, isDark),
        tracking: isDark ? 'wide' : 'normal',
      },
      locked: !isPro && needsPro,
      isCurated: true,
      score,
    });
  }

  // 30 Generated combinations
  for (let i = 0; i < 30; i++) {
    const nf = pickOne(rng, namePool);
    const matchingBio = bioPool.filter(
      (b) => b.category !== nf.category || isSuperfamilyPair(nf.family, b.family)
    );
    const bf = pickOne(rng, matchingBio.length > 0 ? matchingBio : bioPool);
    const tf = rng() > 0.45 ? (isFontAllowedForRole(bf, 'T') ? bf : pickOne(rng, btnPool)) : pickOne(rng, btnPool);

    const needsPro = nf.tier === 'pro' || bf.tier === 'pro' || tf.tier === 'pro';
    const moodHits = nf.moods.filter((m) => topMoods.includes(m)).length;
    const moodScore = Math.min(1, moodHits / 2);
    const catContrast = nf.category !== bf.category ? 1 : 0.4;
    const legibilityScore = (bf.legibility + tf.legibility) / 2;
    const genId = `gen-${nf.id}-${bf.id}-${tf.id}`;
    const novelty = seenIds?.has(genId) ? 0.1 : 1.0;

    let score = 0.4 * moodScore + 0.25 * catContrast + 0.2 * legibilityScore + 0.15 * novelty;
    if (!isPro && needsPro) score -= 0.2;

    const finalNameFam = lockName ? current.name.family : nf.family;
    const finalBioFam = lockBio ? current.bio.family : bf.family;
    const finalBtnFam = ensureDistinctMaxThreeFamilies(
      finalNameFam,
      finalBioFam,
      lockBtn ? current.button.family : tf.family
    );

    const defaultNameW = clampWeightToFont(nf, nf.weights.includes(700) ? 700 : nf.weights[nf.weights.length - 1]);
    const defaultBtnW = clampWeightToFont(tf, tf.weights.includes(600) ? 600 : 500);

    candidates.push({
      id: genId,
      name: `${nf.family} × ${bf.family}`,
      mood: nf.moods[0] ? nf.moods[0][0].toUpperCase() + nf.moods[0].slice(1) : 'Custom',
      nameFont: {
        family: finalNameFam,
        weight: lockName ? current.name.weight : adjustWeightForBackground(nf, defaultNameW, isDark),
        tracking: isDark ? 'wide' : nf.category === 'display' ? 'tight' : 'normal',
      },
      bioFont: {
        family: finalBioFam,
        weight: lockBio ? current.bio.weight : adjustWeightForBackground(bf, 400, isDark),
        tracking: isDark ? 'wide' : 'normal',
      },
      buttonFont: {
        family: finalBtnFam,
        weight: lockBtn ? current.button.weight : adjustWeightForBackground(tf, defaultBtnW, isDark),
        tracking: isDark ? 'wide' : 'normal',
      },
      locked: !isPro && needsPro,
      isCurated: false,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Select 6: target 3 curated + 3 generated, max 2 Pro-locked when !isPro, distinct NAME family
  const selected: FontComboSuggestion[] = [];
  const usedNameFamilies = new Set<string>();
  let proCount = 0;

  const canSelect = (c: FontComboSuggestion): boolean => {
    if (c.locked && proCount >= 2) return false;
    if (!lockName && usedNameFamilies.has(c.nameFont.family)) return false;
    if (selected.some((s) => `${s.nameFont.family}|${s.bioFont.family}|${s.buttonFont.family}` === `${c.nameFont.family}|${c.bioFont.family}|${c.buttonFont.family}`)) {
      return false;
    }
    return true;
  };

  const push = (c: FontComboSuggestion) => {
    selected.push(c);
    usedNameFamilies.add(c.nameFont.family);
    if (c.locked) proCount++;
  };

  for (const curated of candidates.filter((c) => c.isCurated)) {
    if (selected.length >= 3) break;
    if (canSelect(curated)) push(curated);
  }
  for (const gen of candidates.filter((c) => !c.isCurated)) {
    if (selected.length >= 6) break;
    if (canSelect(gen)) push(gen);
  }
  for (const anyCand of candidates) {
    if (selected.length >= 6) break;
    if (canSelect(anyCand)) push(anyCand);
  }

  return selected;
}

// ── 11.3 LAYOUT SUGGESTIONS (6 LayoutIdea) ───────────────────────────────────

export interface LayoutIdeaSuggestion {
  id: string;
  name: string;
  tag: string;
  header: HeaderLayoutV2;
  avatar: LayoutTokens['avatar'];
  linkLayout: LinkLayoutV2;
  spacing: SpacingV2;
  width: WidthV2;
  entrance: EntranceV2;
  surface?: ButtonSurface;
  buttonSize?: 's' | 'm' | 'l';
  motion?: ButtonTokens['motion'];
  align?: 'center' | 'left';
  icon?: 'left' | 'right' | 'none';
  shape?: ButtonShapeV2;
  radius?: number;
  borderWidth?: 0 | 1 | 2 | 3 | 4;
  labelWarning?: string | null;
  score: number;
}

function doesRecipeSatisfyConstraints(
  recipe: LayoutRecipe,
  bgProfile: BgProfile,
  bg: Background,
  pageAccentHex: Hex,
  pageTextHex: Hex
): boolean {
  const compat = checkSurfaceCompatibility(
    recipe.surface,
    bgProfile,
    bg,
    pageAccentHex,
    pageTextHex
  );
  if (!compat.allowed) return false;

  switch (recipe.requires) {
    case 'chromatic_bg':
      return bgProfile.chromatic;
    case 'light_bg_soft':
      return bgProfile.tone === 'light';
    case 'light_or_dark_low_complexity':
      return bgProfile.complexity < 0.35;
    case 'c1_glass':
      return compat.allowed;
    case 'c2_dark':
      return bgProfile.tone === 'dark';
    case 'c4_low_complexity':
    case 'c4_low_complexity_short':
      return bgProfile.complexity < 0.35;
    case 'c5_metallic':
      return bgProfile.tone === 'dark' || (bgProfile.warm && bgProfile.tone === 'mid');
    case 'c6_contrast7':
      return worstCaseContrast(pageTextHex, [bgProfile.darkest, bgProfile.lightest]) >= 7.0;
    default:
      return true;
  }
}

const SPACING_CYCLE: readonly SpacingV2[] = ['compact', 'balanced', 'airy'];
const WIDTH_CYCLE: readonly WidthV2[] = ['focused', 'standard', 'wide'];

export function suggestLayouts(params: {
  bgProfile: BgProfile;
  bg: Background;
  vibe: CatalogVibe;
  buttons: ButtonTokens;
  currentLayout: LayoutTokens;
  locks: readonly AppearanceLock[];
  seed: number;
  seenIds?: ReadonlySet<string>;
  linkLabels?: readonly string[];
}): LayoutIdeaSuggestion[] {
  const { bgProfile, bg, vibe, buttons, currentLayout, locks, seed, seenIds, linkLabels = [] } = params;
  const rng = mulberry32(seed);
  const lockLayout = locks.includes('layout');
  const pageTextHex = bgProfile.tone === 'dark' ? '#F5F5F5' : '#121212';

  const validRecipes = LAYOUT_RECIPES.filter((r) =>
    doesRecipeSatisfyConstraints(r, bgProfile, bg, vibe.page.accent, pageTextHex)
  );

  const scored: LayoutIdeaSuggestion[] = validRecipes.map((r) => {
    const moodHits = r.moods.filter((m) => vibe.moods.includes(m)).length;
    const moodOverlap = Math.min(1, moodHits / Math.max(1, r.moods.length));
    const backgroundFit = r.surface === vibe.button.surface ? 1 : 0.65;
    const novelty = seenIds?.has(r.id) ? 0.1 : 1.0;
    const consistency = r.surface === buttons.surface ? 1 : 0.4;

    const enforced = enforceLayoutInvariants({
      header: lockLayout ? currentLayout.header : r.header,
      avatar: lockLayout ? currentLayout.avatar : { ...r.avatar, glow: r.avatar.glow || 'none' },
      linkLayout: lockLayout ? currentLayout.linkLayout : r.linkLayout,
      spacing: lockLayout ? currentLayout.spacing : r.spacing,
      width: lockLayout ? currentLayout.width : r.width,
      entrance: lockLayout ? currentLayout.entrance : r.entrance,
      socialIcons: currentLayout.socialIcons,
    });

    const score = 0.4 * moodOverlap + 0.3 * backgroundFit + 0.15 * novelty + 0.15 * consistency;
    const surfaceNice = r.surface.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const spacingNice = enforced.spacing[0].toUpperCase() + enforced.spacing.slice(1);

    return {
      id: r.id,
      name: r.name,
      tag: `${surfaceNice} · ${spacingNice}`,
      header: enforced.header,
      avatar: enforced.avatar,
      linkLayout: enforced.linkLayout,
      spacing: enforced.spacing,
      width: enforced.width,
      entrance: enforced.entrance,
      surface: r.surface,
      buttonSize: r.buttonSize,
      motion: r.motion,
      align: r.align,
      icon: r.icon,
      shape: r.shape,
      radius: r.radius,
      borderWidth: r.borderWidth,
      labelWarning: checkLinkLayoutLabelWarning(enforced.linkLayout, linkLabels),
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Add 2 seeded mutations of top recipes (Section 11.3)
  const mutations: LayoutIdeaSuggestion[] = [];
  for (let m = 0; m < Math.min(2, scored.length); m++) {
    const base = scored[m];
    const spIdx = Math.min(2, Math.max(0, SPACING_CYCLE.indexOf(base.spacing) + (rng() > 0.5 ? 1 : -1)));
    const wIdx = Math.min(2, Math.max(0, WIDTH_CYCLE.indexOf(base.width) + (rng() > 0.5 ? 1 : -1)));
    const mutated = enforceLayoutInvariants({
      header: base.header,
      avatar: base.avatar,
      linkLayout: base.linkLayout === 'stack' && rng() > 0.65 ? 'grid2' : base.linkLayout,
      spacing: SPACING_CYCLE[spIdx],
      width: WIDTH_CYCLE[wIdx],
      entrance: base.entrance,
      socialIcons: currentLayout.socialIcons,
    });

    mutations.push({
      ...base,
      id: `${base.id}-mut-${m}`,
      name: `${base.name} Remix`,
      tag: `${mutated.header[0].toUpperCase() + mutated.header.slice(1)} · ${mutated.spacing[0].toUpperCase() + mutated.spacing.slice(1)}`,
      header: mutated.header,
      avatar: mutated.avatar,
      linkLayout: mutated.linkLayout,
      spacing: mutated.spacing,
      width: mutated.width,
      labelWarning: checkLinkLayoutLabelWarning(mutated.linkLayout, linkLabels),
      score: base.score - 0.05,
    });
  }

  const combined = [...scored, ...mutations].sort((a, b) => b.score - a.score);
  const selected: LayoutIdeaSuggestion[] = [];
  const seenSig = new Set<string>();

  for (const item of combined) {
    if (selected.length >= 6) break;
    const sig = `${item.header}|${item.linkLayout}|${item.spacing}|${item.surface}`;
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);
    selected.push(item);
  }

  return selected;
}

/**
 * Picks 6 safe background-derived colours that pass rules for fill/text/border in the OKLCH picker.
 */
export function getSafeColorsFromBackground(
  field: 'fill' | 'text' | 'border',
  bgProfile: BgProfile,
  currentFill: Color
): Hex[] {
  const isDarkBg = bgProfile.meanL < 0.5;
  const h = bgProfile.chromatic ? bgProfile.meanHue : 230;
  const results: Hex[] = [];

  const candidateSpecs: Array<{ L: number; C: number; h: number }> =
    field === 'text' && currentFill !== 'transparent'
      ? [
          { L: 0.12, C: 0.015, h },
          { L: 0.97, C: 0.01, h },
          { L: 0.22, C: 0.04, h: (h + 180) % 360 },
          { L: 0.92, C: 0.03, h: (h + 30) % 360 },
          { L: 0.30, C: 0.06, h },
          { L: 0.85, C: 0.08, h: (h + 120) % 360 },
        ]
      : isDarkBg
        ? [
            { L: 0.96, C: 0.012, h },
            { L: 0.86, C: 0.14, h: (h + 180) % 360 },
            { L: 0.84, C: 0.13, h: (h + 30) % 360 },
            { L: 0.82, C: 0.14, h: (h + 120) % 360 },
            { L: 0.88, C: 0.10, h: (h + 210) % 360 },
            { L: 0.90, C: 0.03, h },
          ]
        : [
            { L: 0.16, C: 0.02, h },
            { L: 0.44, C: 0.15, h: (h + 180) % 360 },
            { L: 0.42, C: 0.14, h: (h + 30) % 360 },
            { L: 0.46, C: 0.15, h: (h + 120) % 360 },
            { L: 0.35, C: 0.10, h },
            { L: 0.24, C: 0.04, h: (h + 210) % 360 },
          ];

  for (const spec of candidateSpecs) {
    const hex = safeOklchToHex(spec);
    if (results.includes(hex)) continue;
    if (field === 'text' && currentFill !== 'transparent') {
      if (contrastRatio(hex, currentFill) >= 4.5) results.push(hex);
    } else {
      if (worstCaseContrast(hex, [bgProfile.darkest, bgProfile.lightest]) >= 3.0) {
        results.push(hex);
      }
    }
  }

  return results.length > 0 ? results : isDarkBg ? ['#F5F5F4', '#7DD3FC', '#FDE047'] : ['#121212', '#1F6FEB', '#0F766E'];
}

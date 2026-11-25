// build.ts: turn a palette + RNG into concrete background / button / layout values
import { RNG, mix, shift, contrast, readableOn, isDark, type Hex } from './util.ts';
import type { Palette, Mood, UseCase } from './data-palettes.ts';
import {
  BG_RECIPES,
  SURFACES,
  MOTIONS,
  HEADERS,
  AVATAR_FRAMES,
  CARD_LOOKS,
  AVATAR_SIZES,
  type BgRecipe,
  type SurfaceRecipe,
  type Opt,
} from './data-styles.ts';
import type { Theme } from './types.ts';

const ov = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x)).length;
export const weightBy = <T extends { moods: Mood[]; useCases?: UseCase[]; weight?: number }>(
  items: readonly T[],
  moods: Mood[],
  useCase?: UseCase
) =>
  items.map(
    (i) =>
      (i.weight ?? 1) *
      (0.15 + ov(i.moods, moods)) *
      (useCase && i.useCases?.includes(useCase) ? 1.8 : 1)
  );

/** Pull a stop toward the base colour until text stays readable on it. */
function fixStop(c: Hex, base: Hex, text: Hex, min = 4.8): Hex {
  let out = c;
  for (let i = 0; i < 6 && contrast(out, text) < min; i++) out = mix(out, base, 0.5);
  return contrast(out, text) < min ? base : out;
}

export function buildBackground(
  p: Palette,
  moods: Mood[],
  rng: RNG,
  plan: 'free' | 'pro'
): Theme['background'] {
  const pool = BG_RECIPES.filter((b) => plan === 'pro' || !b.pro);
  const r: BgRecipe = rng.weighted(pool, weightBy(pool, moods));
  const bg = p.bg;
  const bg2 = p.bg2;
  const tx = p.text;
  const angle = rng.int(120, 215);
  const t = rng.range(0.15, 0.4);
  const st = (c: Hex, pos: number) => ({ color: fixStop(c, bg, tx), pos });
  const base = { kind: r.kind, name: r.label, color: bg } as Theme['background'];
  switch (r.kind) {
    case 'solid':
      return base;
    case 'tonal':
      return { ...base, color: mix(bg, bg2, t) };
    case 'soft-gradient':
      return { ...base, gradient: { type: 'linear', angle, stops: [st(bg, 0), st(bg2, 100)] } };
    case 'gradient':
      return {
        ...base,
        gradient: {
          type: rng.pick(['linear', 'linear', 'radial'] as const),
          angle: rng.int(0, 360),
          stops: [
            st(bg, 0),
            st(mix(bg, p.accent, rng.range(0.12, 0.25)), rng.int(40, 60)),
            st(bg2, 100),
          ],
        },
      };
    case 'mesh':
      return {
        ...base,
        gradient: {
          type: 'radial',
          angle: rng.int(0, 360),
          stops: [
            st(mix(bg, p.accent, rng.range(0.1, 0.22)), 0),
            st(bg, 35),
            st(mix(bg, p.accent2, rng.range(0.08, 0.2)), 70),
            st(bg2, 100),
          ],
        },
      };
    case 'aurora':
      return {
        ...base,
        gradient: {
          type: 'linear',
          angle: rng.int(150, 210),
          stops: [
            st(bg, 0),
            st(mix(bg, p.accent, 0.2), 35),
            st(mix(bg, p.accent2, 0.16), 65),
            st(bg2, 100),
          ],
        },
      };
    case 'glass':
      return {
        ...base,
        gradient: {
          type: 'linear',
          angle,
          stops: [st(mix(bg, p.surface, 0.5), 0), st(bg2, 100)],
        },
      };
    case 'grain':
      return { ...base, color: mix(bg, bg2, t), grain: +rng.range(0.15, 0.45).toFixed(2) };
    case 'pattern':
      return { ...base, color: bg, grain: +rng.range(0.05, 0.15).toFixed(2) };
    case 'animated':
      return {
        ...base,
        gradient: {
          type: 'linear',
          angle,
          stops: [st(bg, 0), st(mix(bg, p.accent, 0.18), 50), st(bg2, 100)],
        },
      };
  }
}

export function pickSurface(
  p: Palette,
  bgk: Theme['background'],
  moods: Mood[],
  rng: RNG,
  plan: 'free' | 'pro'
): SurfaceRecipe {
  const br = BG_RECIPES.find((b) => b.kind === bgk.kind)!;
  const dark = isDark(bgk.color);
  const ok = SURFACES.filter((s) => {
    if (s.pro && plan === 'free') return false;
    const n = s.needs;
    if (n?.darkBg && !dark) return false;
    if (n?.lightBg && dark) return false;
    if (n?.calmBg && br.busy) return false;
    if (n?.gradientBg && !br.gradientLike) return false;
    if (br.busy && !s.allowedOnBusy) return false;
    if (s.hero && bgk.kind === 'animated') return false; // one loud effect only
    return true;
  });
  return rng.weighted(ok, weightBy(ok, moods));
}

export function buildButtons(
  p: Palette,
  bgk: Theme['background'],
  s: SurfaceRecipe,
  moods: Mood[],
  fontCat: string,
  rng: RNG
): Theme['buttons'] {
  const bg = bgk.color;
  const transparent = ['outline', 'glass', 'underline', 'neon-glow'].includes(s.surface);
  let fill: Hex = rng.chance(0.55) ? p.accent : p.text;
  if (s.surface === 'metallic') fill = p.accent;
  if (s.surface === 'soft-tint') fill = mix(bg, p.accent, rng.range(0.14, 0.24));
  if (s.surface === 'neumorphic') fill = bg;
  if (s.surface === 'sticker' || s.surface === '3d-offset')
    fill = rng.chance(0.5) ? p.accent2 : p.surface;
  if (s.surface === 'soft-shadow' || s.surface === 'solid')
    fill = rng.chance(0.5) ? p.text : p.accent;
  if (transparent) fill = 'transparent' as Hex;
  const textBase = transparent ? p.text : readableOn(fill, undefined, 7);
  let text = transparent ? readableOn(bg, p.text, 7) : textBase;
  if (s.surface === 'soft-tint' || s.surface === 'neumorphic') text = readableOn(fill, p.text, 7);

  const edge =
    (
      {
        outline: p.accent,
        'neon-glow': p.accent,
        glass: mix(p.text, bg, 0.6),
        underline: p.accent,
        sticker: p.text,
        '3d-offset': p.text,
      } as Record<string, Hex>
    )[s.surface] ?? fill;
  const bw =
    (
      {
        outline: rng.pick([1, 2]),
        'neon-glow': 1,
        glass: 1,
        underline: 0,
        sticker: 2,
        '3d-offset': 2,
      } as Record<string, number>
    )[s.surface] ?? 0;
  const shape = rng.weighted(['square', 'rounded', 'pill'] as const, [
    moods.some((m) => ['editorial', 'retro', 'bold'].includes(m)) ? 2 : 0.6,
    2,
    moods.some((m) => ['playful', 'creator', 'calm'].includes(m)) ? 2.2 : 0.8,
  ]);
  const upper = moods.some((m) => ['bold', 'futuristic', 'retro'].includes(m)) && rng.chance(0.3);
  const serif = fontCat === 'serif';
  return {
    shape,
    surface: s.surface,
    fill,
    fillTransparent: transparent,
    text,
    border: edge as Hex,
    borderWidth: bw as 0 | 1 | 2 | 3 | 4,
    height:
      moods.includes('business') || moods.includes('minimal')
        ? rng.pick([46, 56] as const)
        : rng.pick([56, 56, 68] as const),
    shadow:
      s.surface === 'soft-shadow'
        ? 'soft'
        : s.surface === '3d-offset'
          ? 'none'
          : moods.includes('bold') && rng.chance(0.25)
            ? 'deep'
            : 'none',
    weight: serif
      ? rng.pick([400, 500] as const)
      : upper
        ? rng.pick([600, 700] as const)
        : rng.pick([500, 600] as const),
    case: upper ? 'upper' : 'normal',
    tracking: upper ? 'wide' : moods.includes('luxe') ? rng.pick(['normal', 'wide'] as const) : 'normal',
    motion: rng.weighted(
      MOTIONS.map((m) => m.v),
      weightBy(
        MOTIONS.map((m) => ({ moods: m.moods })),
        moods
      )
    ),
  };
}

const pickOpt = <T>(opts: Opt<T>[], moods: Mood[], u: UseCase | undefined, rng: RNG): T =>
  rng.weighted(
    opts.map((o) => o.v),
    weightBy(opts, moods, u)
  );

export function buildLayout(
  p: Palette,
  bgk: Theme['background'],
  moods: Mood[],
  u: UseCase | undefined,
  hero: boolean,
  rng: RNG
): Theme['layout'] {
  const header = pickOpt(HEADERS, moods, u, rng);
  const m = (...x: Mood[]) => moods.some((y) => x.includes(y));
  const gradientish = !!bgk.gradient;
  return {
    header,
    avatarFrame: pickOpt(AVATAR_FRAMES, moods, u, rng),
    avatarSize:
      header === 'hero'
        ? rng.pick([128, 160] as const)
        : header === 'compact-row'
          ? rng.pick([72, 96] as const)
          : rng.pick(AVATAR_SIZES.slice(1, 4)),
    avatarGlow: hero
      ? 'none'
      : m('futuristic', 'playful') && rng.chance(0.35)
        ? 'accent'
        : m('calm', 'luxe', 'warm') && rng.chance(0.3)
          ? 'soft'
          : 'none',
    linkLayout: rng.weighted(
      ['stack', '2-column', 'chips'] as const,
      [7, m('business', 'creator') ? 1.5 : 0.5, m('minimal') ? 1.2 : 0.4]
    ),
    spacing: m('luxe', 'calm', 'editorial')
      ? rng.weighted(['balanced', 'airy'] as const, [1, 2])
      : m('business', 'minimal')
        ? rng.weighted(['compact', 'balanced', 'airy'] as const, [1, 2, 1])
        : 'balanced',
    socialIcons:
      m('futuristic', 'luxe') && gradientish
        ? 'glass'
        : m('bold', 'playful')
          ? 'filled'
          : 'outline',
    cardLook: pickOpt(CARD_LOOKS, moods, u, rng),
    width: rng.weighted(['focused', 'standard', 'wide'] as const, [7, 2.5, 0.5]),
    entrance: rng.weighted(
      ['none', 'fade-up', 'stagger-scale'] as const,
      [1.5, 6, m('playful', 'bold') ? 2.5 : 0.8]
    ),
  };
}

export { shift };

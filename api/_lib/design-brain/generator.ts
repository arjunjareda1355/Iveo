// generator.ts: generateTheme() + repair + section suggestions + regenerate
import { RNG, mix, shift, contrast, badge, rgbToHsl, readableOn, type Hex } from './util.ts';
import { PALETTES, type Palette, type Mood, type UseCase } from './data-palettes.ts';
import { VIBES, type Vibe } from './data-vibes.ts';
import { FONTS, TRIOS } from './data-fonts.ts';
import { SURFACES } from './data-styles.ts';
import { buildBackground, pickSurface, buildButtons, buildLayout } from './build.ts';
import { hardViolations, score, worstContrast } from './rules.ts';
import type { Theme, Context } from './types.ts';

export const MAX_TRIES = 24;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export type Section = 'vibe' | 'background' | 'typography' | 'buttons' | 'layout';
const ov = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x)).length;
const hueOf = (c: Hex) => rgbToHsl(c)[0];
const hueDist = (a: Hex, b: Hex) => {
  const d = Math.abs(hueOf(a) - hueOf(b)) % 360;
  return d > 180 ? 360 - d : d;
};

// ---------- smart context ----------
export function inferFromContext(ctx: Context): { moods: Mood[]; useCase?: UseCase } {
  const moods: Mood[] = ctx.mood ? [ctx.mood] : [];
  let useCase = ctx.useCase;
  const lt = (ctx.linkTypes ?? []).map((x) => x.toLowerCase());
  const has = (...k: string[]) => lt.some((x) => k.some((y) => x.includes(y)));
  if (!useCase) {
    if (has('spotify', 'soundcloud', 'youtube', 'apple-music')) useCase = 'musician';
    else if (has('github', 'gitlab', 'codepen')) useCase = 'developer';
    else if (has('linkedin', 'calendly')) useCase = 'business';
    else if (has('instagram', 'tiktok', 'pinterest')) useCase = 'influencer';
    else if (has('behance', 'dribbble')) useCase = 'artist';
  }
  if (has('shop', 'store', 'gumroad', 'etsy', 'payment', 'coffee')) moods.push('bold');
  const bio = (ctx.bio ?? '').toLowerCase();
  if (/student|learn|study/.test(bio)) useCase ??= 'student';
  if (/design|artist|illustrat|photograph/.test(bio)) useCase ??= 'artist';
  if (/music|singer|producer|dj|rapper/.test(bio)) useCase ??= 'musician';
  if (/developer|engineer|code|software/.test(bio)) useCase ??= 'developer';
  return { moods, useCase };
}

function harmonyScore(p: Palette): number {
  const d = hueDist(p.accent, p.accent2);
  return d < 20 ? 86 : d < 60 ? 92 : d > 150 ? 90 : d > 100 ? 86 : 78;
}

function anchorPalette(ctx: Context): { palette: Palette; hueDelta: number } | null {
  const cur = ctx.current;
  if (!ctx.locked?.vibe || !cur?.vibe) return null;
  const v = VIBES.find((x) => x.id === cur.vibe!.id);
  const pals = (v ? v.palettes.map((id) => PALETTES.find((p) => p.id === id)!) : PALETTES).filter(
    Boolean
  );
  const acc = cur.page?.accent;
  const palette = acc
    ? [...pals].sort((a, b) => hueDist(a.accent, acc) - hueDist(b.accent, acc))[0]
    : pals[0];
  const hueDelta = acc ? ((hueOf(acc) - hueOf(palette.accent) + 540) % 360) - 180 : 0;
  return { palette, hueDelta };
}

function pickVibe(rng: RNG, ctx: Context, plan: 'free' | 'pro'): Vibe {
  const { moods, useCase } = inferFromContext(ctx);
  const pool = VIBES.filter((v) => !v.pro || plan === 'pro');
  const photo = ctx.photoColors?.[0];
  const w = pool.map((v) => {
    let x = 1 + ov(v.moods, moods) * 2.5;
    if (useCase && v.useCases.includes(useCase)) x *= 2;
    if (photo) {
      const p = PALETTES.find((q) => q.id === v.palettes[0])!;
      x *= 1 + Math.max(0, 1 - hueDist(p.accent, photo) / 90);
    }
    return x;
  });
  return rng.weighted(pool, w);
}

// ---------- repair: makes any theme pass the hard rules where possible ----------
export function repair(t: Theme): Theme {
  const bgs = t.background.gradient
    ? t.background.gradient.stops.map((s) => s.color)
    : [t.background.color];
  const best = (cands: Hex[], pick: (c: Hex) => number) =>
    cands.reduce((a, b) => (pick(b) > pick(a) ? b : a));
  const w = (c: Hex) => Math.min(...bgs.map((b) => contrast(b, c)));
  if (w(t.page.text) < 4.5) t.page.text = best([t.page.text, '#FFFFFF', '#0B0A0A'], w);
  if (w(t.page.muted) < 3) {
    t.page.muted = mix(t.page.text, t.background.color, 0.3);
    if (w(t.page.muted) < 3) t.page.muted = t.page.text;
  }
  const b = t.buttons;
  const sr = SURFACES.find((s) => s.surface === b.surface)!;
  if (b.fillTransparent) {
    if (w(b.text) < 4.5) b.text = best([b.text, t.page.text, '#FFFFFF', '#0B0A0A'], w);
    if (['outline', 'neon-glow', 'underline'].includes(b.surface) && w(b.border) < 3) {
      b.border = best([b.border, t.page.text, t.page.accent], w);
    }
  } else {
    if (contrast(b.fill, b.text) < 4.5) b.text = readableOn(b.fill, t.page.text, 4.5);
    if (['gradient', 'metallic'].includes(b.surface) && contrast(t.page.accent2, b.text) < 4.5) {
      t.page.accent2 = mix(t.page.accent2, b.fill, 0.65);
    }
    if (w(b.fill) < 1.5 && !sr.hasOwnEdge && b.borderWidth === 0 && b.shadow === 'none') {
      b.borderWidth = 1;
      b.border = t.page.text;
    }
  }
  return t;
}

const LABEL: Record<string, string> = {
  'soft-shadow': 'Soft shadow',
  'soft-tint': 'Soft tint',
  '3d-offset': '3D offset',
  'neon-glow': 'Neon glow',
};
const cap = (s: string) =>
  (LABEL[s] ?? s.replace(/-/g, ' ')).replace(/^./, (c) => c.toUpperCase());

function attempt(seed: string, ctx: Context, plan: 'free' | 'pro'): Theme {
  const rng = new RNG(seed);
  const { useCase } = inferFromContext(ctx);
  const anchor = anchorPalette(ctx);
  const vibe =
    ctx.locked?.vibe && ctx.current?.vibe
      ? (VIBES.find((v) => v.id === ctx.current!.vibe!.id) ?? pickVibe(rng, ctx, plan))
      : pickVibe(rng, ctx, plan);
  const palId = rng.pick(vibe.palettes);
  let pal = anchor?.palette ?? PALETTES.find((p) => p.id === palId)!;
  if (plan === 'free' && pal.pro) pal = PALETTES.find((p) => !p.pro)!;
  const dHue = anchor ? anchor.hueDelta : rng.chance(0.65) ? rng.range(-14, 14) : 0;
  const dL = anchor ? 0 : rng.range(-2.5, 2.5);
  const P: Palette = {
    ...pal,
    bg: shift(pal.bg, dHue, 0, dL),
    bg2: shift(pal.bg2, dHue, 0, dL),
    surface: shift(pal.surface, dHue, 0, dL),
    accent: shift(pal.accent, dHue),
    accent2: shift(pal.accent2, dHue),
  };
  const moods = vibe.moods;

  const background = buildBackground(P, moods, rng, plan);
  const trio = rng.weighted(
    TRIOS,
    TRIOS.map((t) => (0.2 + ov(t.moods, moods)) * (t.score / 90) ** 4)
  );
  const surface = pickSurface(P, background, moods, rng, plan);
  const fontCat = FONTS.find((f) => f.name === trio.buttons)?.cat ?? 'sans';
  const buttons = buildButtons(P, background, surface, moods, fontCat, rng);
  const layout = buildLayout(P, background, moods, useCase, !!surface.hero, rng);

  const t: Theme = {
    vibe: { id: vibe.id, name: vibe.name, tagline: vibe.tagline, moods: vibe.moods },
    page: {
      mode: pal.mode,
      text: P.text,
      muted: P.muted,
      accent: P.accent,
      accent2: P.accent2,
      surface: P.surface,
    },
    background,
    typography: { name: trio.name, bio: trio.bio, buttons: trio.buttons },
    buttons,
    layout,
    meta: {
      seed,
      name: vibe.name,
      palette: pal.name,
      moods: vibe.moods,
      score: 0,
      why: '',
      contrast: { body: 0, button: 0, badge: 'Fail' },
      dots: [],
    },
  };
  // locks: keep the user's locked sections exactly as they are
  const L = ctx.locked;
  const C = ctx.current;
  if (C) {
    if (L?.vibe && C.vibe && C.page) {
      t.vibe = C.vibe;
      t.page = { ...C.page };
    }
    if (L?.background && C.background) t.background = C.background;
    if (L?.typography && C.typography) t.typography = C.typography;
    if (L?.buttons && C.buttons) t.buttons = { ...C.buttons };
    if (L?.layout && C.layout) t.layout = C.layout;
  }
  repair(t);
  return finalize(t, trio.score, useCase, harmonyScore(pal));
}

function finalize(
  t: Theme,
  trioScore: number,
  useCase: string | undefined,
  harmony: number
): Theme {
  const body = worstContrast(t.page.text, t);
  const btn = t.buttons.fillTransparent
    ? worstContrast(t.buttons.text, t)
    : contrast(t.buttons.fill, t.buttons.text);
  t.meta.contrast = {
    body: +body.toFixed(1),
    button: +btn.toFixed(1),
    badge: badge(Math.min(body, btn)),
  };
  t.meta.score = score(t, trioScore, useCase, harmony);
  t.meta.dots = [t.background.color, t.page.accent, t.page.accent2, t.page.text];
  t.meta.why =
    `${t.meta.palette} colours with ${t.typography.name} / ${t.typography.bio} and ${cap(t.buttons.surface).toLowerCase()} ${t.buttons.shape} buttons. ` +
    `Text contrast ${t.meta.contrast.body}:1 (${t.meta.contrast.badge}).`;
  return t;
}

// ---------- public API ----------
const cache = new Map<string, Theme>();
export function generateTheme(ctx: Context = {}): Theme {
  const plan = ctx.plan ?? 'free';
  const base = ctx.seed ?? Math.random().toString(36).slice(2, 10);
  const cacheable = !ctx.current && !ctx.locked && !ctx.photoColors && !ctx.linkTypes && !ctx.bio;
  const key = `${base}|${plan}|${ctx.mood ?? ''}|${ctx.useCase ?? ''}`;
  if (cacheable && cache.has(key)) return clone(cache.get(key)!);
  let bestT: Theme | null = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    const t = attempt(`${base}:${i}`, ctx, plan);
    if (hardViolations(t, plan).length) continue;
    if (t.meta.score >= 80) {
      bestT = t;
      break;
    }
    if (!bestT || t.meta.score > bestT.meta.score) bestT = t;
  }
  const out = bestT ?? repair(attempt(`${base}:fallback`, { plan }, plan));
  out.meta.seed = base;
  if (cacheable) {
    cache.set(key, out);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return clone(out);
}

export const signature = (t: Theme) =>
  [
    t.vibe.id,
    t.background.kind,
    t.background.color,
    t.typography.name,
    t.typography.buttons,
    t.buttons.surface,
    t.buttons.shape,
    t.layout.header,
    t.layout.avatarFrame,
  ].join('|');

export interface Suggestion {
  id: string;
  seed: string;
  section: Section | 'all';
  name: string;
  tagline: string;
  badge: string;
  ratio: number;
  dots: Hex[];
  score: number;
  why: string;
  patch: Partial<Theme>;
}

function toSuggestion(section: Section | 'all', t: Theme): Suggestion {
  const ratio = Math.min(t.meta.contrast.body, t.meta.contrast.button);
  const common = {
    id: `${section}:${t.meta.seed}`,
    seed: t.meta.seed,
    section,
    badge: t.meta.contrast.badge,
    ratio,
    dots: t.meta.dots,
    score: t.meta.score,
    why: t.meta.why,
  };
  switch (section) {
    case 'background':
      return {
        ...common,
        name: `${t.meta.palette} · ${t.background.name}`,
        tagline: `${t.background.kind.replace(/-/g, ' ')} · ${t.background.gradient ? t.background.gradient.type + ' ' + t.background.gradient.angle + '°' : t.background.color}${t.background.grain ? ' · grain ' + t.background.grain : ''}`,
        patch: { background: t.background, page: t.page, buttons: t.buttons },
      };
    case 'typography':
      return {
        ...common,
        name: `${t.typography.name} · ${t.typography.bio}`,
        tagline: t.vibe.moods.slice(0, 2).join(' · '),
        patch: { typography: t.typography, buttons: t.buttons },
      };
    case 'buttons':
      return {
        ...common,
        name: `${cap(t.buttons.surface)} · ${cap(t.buttons.shape)}`,
        tagline: `${t.buttons.fillTransparent ? 'line ' + t.buttons.border : t.buttons.fill} · ${t.buttons.weight}${t.buttons.case === 'upper' ? ' · UPPER' : ''} · ${t.buttons.height}px`,
        patch: { buttons: t.buttons, page: t.page },
      };
    case 'layout':
      return {
        ...common,
        name: `${cap(t.layout.header)} · ${cap(t.layout.spacing)}`,
        tagline: `${cap(t.layout.avatarFrame)} avatar · ${cap(t.layout.cardLook)} cards · ${t.layout.linkLayout}`,
        patch: { layout: t.layout },
      };
    default:
      return { ...common, name: t.vibe.name, tagline: t.vibe.tagline, patch: t };
  }
}

/** 5-8 ideas for ONE section, matched to the user's current choices in the other sections. */
export function suggestSection(
  section: Section,
  ctx: Context = {},
  count = 6,
  recent: string[] = []
): { items: Suggestion[]; signatures: string[] } {
  const all: Section[] = ['vibe', 'background', 'typography', 'buttons', 'layout'];
  const locked = { ...(ctx.locked ?? {}) } as NonNullable<Context['locked']>;
  if (ctx.current) for (const s of all) if (s !== section && s !== 'vibe') locked[s] = true;
  if (ctx.current && section !== 'vibe') locked.vibe = true;
  if (section !== 'vibe' && ctx.current) locked[section] = false;
  if (section === 'vibe' && ctx.locked?.vibe === undefined) locked.vibe = false;
  const items: Suggestion[] = [];
  const sigs: string[] = [];
  const seen = new Set(recent);
  const seenVisible = new Set<string>();
  const base = ctx.seed ?? Math.random().toString(36).slice(2, 8);
  for (let n = 0; items.length < count && n < count * 16; n++) {
    const t = generateTheme({ ...ctx, locked, seed: `${base}:${section}:${n}` });
    const s = toSuggestion(section, t);
    const vis = s.name + '|' + s.tagline;
    const sg = vis + '|' + s.dots.join('');
    if (seen.has(sg) || seenVisible.has(vis)) continue;
    seen.add(sg);
    seenVisible.add(vis);
    sigs.push(sg);
    items.push(s);
  }
  return { items, signatures: sigs };
}

/** Refresh icon: new seed, never repeats the last 20 shown (client sends them back). */
export function regenerate(
  section: Section | 'all',
  ctx: Context = {},
  recent: string[] = []
) {
  const seed = Math.random().toString(36).slice(2, 10);
  const r =
    section === 'all'
      ? {
          items: Array.from({ length: 6 }, (_, i) =>
            toSuggestion('all', generateTheme({ ...ctx, seed: `${seed}:${i}` }))
          ),
          signatures: [] as string[],
        }
      : suggestSection(section, { ...ctx, seed }, 6, recent.slice(-20));
  if (section === 'all') {
    r.signatures = r.items.map((s) => s.name + '|' + s.tagline + '|' + s.dots.join(''));
  }
  return r;
}

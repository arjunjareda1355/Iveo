// rules.ts: HARD rules (never break) + SOFT scoring (0..100)
import { contrast, badge, isDark, luminance } from './util.ts';
import type { Theme } from './types.ts';
import { FONTS } from './data-fonts.ts';
import { SURFACES, BG_RECIPES } from './data-styles.ts';

const fontCat = (n: string) => FONTS.find((f) => f.name === n);
export const bgColors = (t: Theme): string[] =>
  t.background.gradient ? t.background.gradient.stops.map((s) => s.color) : [t.background.color];

/** worst-case contrast of a colour against every background stop */
export const worstContrast = (c: string, t: Theme) =>
  Math.min(...bgColors(t).map((b) => contrast(b, c)));

export function hardViolations(t: Theme, plan: 'free' | 'pro' = 'free'): string[] {
  const v: string[] = [];
  const bg = t.background.kind;
  const sr = SURFACES.find((s) => s.surface === t.buttons.surface)!;
  const br = BG_RECIPES.find((b) => b.kind === bg)!;

  if (worstContrast(t.page.text, t) < 4.5) v.push('page text contrast < 4.5');
  if (worstContrast(t.page.muted, t) < 3) v.push('muted text contrast < 3');

  const ownFill = !t.buttons.fillTransparent;
  const btnBg = ownFill ? t.buttons.fill : null;
  if (btnBg) {
    if (contrast(btnBg, t.buttons.text) < 4.5) v.push('button text contrast < 4.5');
    if (
      worstContrast(btnBg, t) < 1.5 &&
      !sr.hasOwnEdge &&
      t.buttons.borderWidth === 0 &&
      t.buttons.shadow === 'none'
    ) {
      v.push('button fill blends with background');
    }
    if (
      ['gradient', 'metallic'].includes(t.buttons.surface) &&
      contrast(t.page.accent2, t.buttons.text) < 4.5
    ) {
      v.push('gradient button end-colour contrast < 4.5');
    }
  } else if (worstContrast(t.buttons.text, t) < 4.5) {
    v.push('transparent button text contrast < 4.5');
  }
  if (
    ['outline', 'neon-glow', 'underline'].includes(t.buttons.surface) &&
    worstContrast(t.buttons.border, t) < 3
  ) {
    v.push('button border not visible (< 3:1)');
  }

  const fams = new Set([t.typography.name, t.typography.bio, t.typography.buttons]);
  if (fams.size > 3) v.push('>3 font families');
  for (const f of [t.typography.bio, t.typography.buttons]) {
    const ft = fontCat(f);
    if (!ft) v.push('unknown font ' + f);
    else if (ft.displayOnly || ft.cat === 'script' || ft.cat === 'display') {
      v.push(`display font "${f}" used for body/buttons`);
    }
  }
  if (!fontCat(t.typography.name)) v.push('unknown name font');

  const dark = isDark(t.background.color);
  const n = sr.needs;
  if (n?.darkBg && !dark) v.push(`${sr.surface} needs dark bg`);
  if (n?.lightBg && dark) v.push(`${sr.surface} needs light bg`);
  if (n?.calmBg && br.busy) v.push(`${sr.surface} needs calm bg`);
  if (n?.gradientBg && !br.gradientLike) v.push(`${sr.surface} needs gradient-like bg`);
  if (br.busy && !sr.allowedOnBusy) v.push('busy background needs solid/glass buttons');

  if (plan === 'free') {
    if (br.pro) v.push('pro background for free user');
    if (sr.pro) v.push('pro button surface for free user');
  }
  return v;
}

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

/** Soft score, 0..100. */
export function score(t: Theme, trioScore: number, useCase?: string, harmony = 80): number {
  const m = t.vibe.moods;
  const br = BG_RECIPES.find((b) => b.kind === t.background.kind)!;
  const sr = SURFACES.find((s) => s.surface === t.buttons.surface)!;
  const nameF = FONTS.find((f) => f.name === t.typography.name)!;
  const moodHit = (xs: string[]) => Math.min(1, overlap(m, xs) / Math.min(2, m.length));
  const moodScore = ((moodHit(br.moods) + moodHit(sr.moods) + moodHit(nameF.moods)) / 3) * 100;
  let s = 0.35 * moodScore + 0.25 * trioScore + 0.2 * harmony + 4; // +4 base consistency
  if (m.includes('editorial') && nameF.cat === 'serif') s += 3;
  if (m.includes('editorial') && ['underline', 'outline'].includes(t.buttons.surface)) s += 2;
  if (m.includes('futuristic') && ['mono', 'sans', 'display'].includes(nameF.cat)) s += 2;
  if (useCase) s += 2;
  const heroes =
    (sr.hero ? 1 : 0) +
    (t.background.kind === 'animated' ? 1 : 0) +
    (t.layout.avatarGlow === 'accent' ? 0.5 : 0);
  if (heroes > 1) s -= 12 * (heroes - 1);
  const cr = contrast(t.page.text, t.background.color);
  if (cr >= 7) s += 3;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export { badge, luminance };

// api.ts: framework-agnostic handlers. Wire them to Express / serverless routes.
import { generateTheme, suggestSection, regenerate, type Section } from './generator.ts';
import type { Context } from './types.ts';
import type { Mood, UseCase } from './data-palettes.ts';

const SECTIONS: Section[] = ['vibe', 'background', 'typography', 'buttons', 'layout'];
const ok = (data: unknown) => ({ status: 200, body: data });
const bad = (msg: string) => ({ status: 400, body: { error: msg } });

/** GET /api/appearance/surprise?mood=&useCase=&seed=   (ctx comes from the logged-in user's profile) */
export function handleSurprise(
  q: { mood?: string; useCase?: string; seed?: string },
  ctx: Context = {}
) {
  const t = generateTheme({
    ...ctx,
    mood: (q.mood as Mood) || ctx.mood,
    useCase: (q.useCase as UseCase) || ctx.useCase,
    seed: q.seed || ctx.seed,
  });
  return ok({ theme: t });
}

/** GET /api/appearance/suggestions?section=vibe|background|typography|buttons|layout */
export function handleSuggestions(
  q: { section?: string; seed?: string; count?: string },
  ctx: Context = {}
) {
  if (!SECTIONS.includes(q.section as Section)) {
    return bad('section must be one of ' + SECTIONS.join('|'));
  }
  const count = Math.max(5, Math.min(8, Number(q.count) || 6));
  return ok(suggestSection(q.section as Section, { ...ctx, seed: q.seed || ctx.seed }, count));
}

/** POST /api/appearance/regenerate   body: { section, recent: string[] }  (recent = last 20 signatures shown) */
export function handleRegenerate(
  body: { section?: string; recent?: string[] },
  ctx: Context = {}
) {
  const s = body.section === 'all' ? 'all' : (body.section as Section);
  if (s !== 'all' && !SECTIONS.includes(s)) return bad('invalid section');
  return ok(regenerate(s, ctx, body.recent ?? []));
}

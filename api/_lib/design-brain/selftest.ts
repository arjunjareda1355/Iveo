import { generateTheme, suggestSection, regenerate, signature, type Section } from './generator.ts';
import { hardViolations } from './rules.ts';
import { PALETTES } from './data-palettes.ts';
import { contrast } from './util.ts';
import { FONTS, TRIOS } from './data-fonts.ts';
import { VIBES } from './data-vibes.ts';
import type { Mood, UseCase } from './data-palettes.ts';
import { toIveoAppearance } from './adapter.ts';
import { resolveTokens } from '../../../src/lib/appearance/resolveTokens.ts';
import { findCatalogVibe } from '../../../src/lib/appearance/catalog/vibes.ts';
import { findCatalogFont } from '../../../src/lib/appearance/catalog/fonts.ts';
import { CATALOG_SURFACES } from '../../../src/lib/appearance/catalog/surfaces.ts';

let fails = 0;
const fail = (m: string) => {
  fails++;
  console.log('FAIL:', m);
};

// data sanity
for (const p of PALETTES) {
  if (contrast(p.bg, p.text) < 7) fail(`palette ${p.id} text/bg ${contrast(p.bg, p.text).toFixed(1)}`);
}
for (const p of PALETTES) {
  if (contrast(p.bg2, p.text) < 4.5) fail(`palette ${p.id} text/bg2 ${contrast(p.bg2, p.text).toFixed(1)}`);
}
for (const t of TRIOS) {
  for (const f of [t.name, t.bio, t.buttons]) {
    if (!FONTS.find((x) => x.name === f)) fail('unknown font ' + f);
  }
}
for (const v of VIBES) {
  for (const id of v.palettes) {
    if (!PALETTES.find((p) => p.id === id)) fail(`vibe ${v.id} -> missing palette ${id}`);
  }
}

// 1000 themes
const moods: (Mood | undefined)[] = [
  undefined,
  'calm',
  'bold',
  'luxe',
  'playful',
  'futuristic',
  'editorial',
  'minimal',
  'warm',
  'cool',
  'nature',
  'retro',
];
const uses: (UseCase | undefined)[] = [
  undefined,
  'creator',
  'musician',
  'business',
  'student',
  'developer',
  'artist',
  'influencer',
];
const sigs = new Set<string>();
let low = 0;
let sum = 0;
const byBadge: Record<string, number> = {};
const surf: Record<string, number> = {};
const bgk: Record<string, number> = {};
const t0 = Date.now();

for (let i = 0; i < 1000; i++) {
  const plan = i % 2 ? 'pro' : 'free';
  const t = generateTheme({
    seed: 'test' + i,
    plan,
    mood: moods[i % moods.length],
    useCase: uses[i % uses.length],
  });
  const v = hardViolations(t, plan);
  if (v.length) fail(`#${i} ${t.vibe.name}: ${v.join('; ')}`);
  if (t.meta.score < 80) low++;
  sum += t.meta.score;
  sigs.add(signature(t));
  byBadge[t.meta.contrast.badge] = (byBadge[t.meta.contrast.badge] ?? 0) + 1;
  surf[t.buttons.surface] = (surf[t.buttons.surface] ?? 0) + 1;
  bgk[t.background.kind] = (bgk[t.background.kind] ?? 0) + 1;

  // Verify Iveo V2 schema adapter conformance on subset
  if (i < 100) {
    const adapted = toIveoAppearance(t, { plan });
    const app = adapted.appearance;
    const catVibe = findCatalogVibe(app.vibeId);
    if (!catVibe) fail(`adapted #${i} invalid vibeId ${app.vibeId}`);
    if (plan === 'free' && catVibe?.tier === 'pro') fail(`adapted #${i} leaked pro vibe ${app.vibeId}`);
    const surfMeta = CATALOG_SURFACES.find((s) => s.id === app.buttons.surface);
    if (!surfMeta) fail(`adapted #${i} invalid surface ${app.buttons.surface}`);
    if (plan === 'free' && surfMeta?.tier === 'pro') fail(`adapted #${i} leaked pro surface ${app.buttons.surface}`);
    for (const r of ['name', 'bio', 'button'] as const) {
      const cf = findCatalogFont(app.typography[r].family);
      if (!cf) fail(`adapted #${i} invalid font ${app.typography[r].family}`);
      if (plan === 'free' && cf?.tier === 'pro') fail(`adapted #${i} leaked pro font ${cf?.family}`);
    }
    const resolved = resolveTokens(app, { isPro: plan === 'pro' });
    if (!resolved.pageText || !resolved.buttons.text) fail(`adapted #${i} failed resolveTokens`);
  }
}

console.log(
  `1000 themes in ${Date.now() - t0}ms | avg score ${(sum / 1000).toFixed(1)} | <80: ${low} | unique signatures: ${sigs.size}`
);
console.log('badges', byBadge);
console.log('surfaces', surf);
console.log('backgrounds', bgk);

// determinism
const a = JSON.stringify(generateTheme({ seed: 'same', plan: 'pro' }));
const b = JSON.stringify(generateTheme({ seed: 'same', plan: 'pro' }));
if (a !== b) fail('same seed gave different themes');

// free plan never gets pro stuff
for (let i = 0; i < 300; i++) {
  const t = generateTheme({ seed: 'f' + i, plan: 'free' });
  if (['aurora', 'glass', 'animated'].includes(t.background.kind) || t.buttons.surface === 'metallic') {
    fail('pro leak ' + i);
  }
}

// locks: locked sections must come back byte-identical
const cur = generateTheme({ seed: 'current', plan: 'pro' });
for (const sec of ['typography', 'layout', 'buttons', 'background'] as const) {
  const locked = { [sec]: true };
  for (let i = 0; i < 20; i++) {
    const t = generateTheme({ seed: 'lk' + i, plan: 'pro', current: cur, locked });
    if (JSON.stringify(t[sec]) !== JSON.stringify(cur[sec])) fail(`lock ${sec} changed (#${i})`);
  }
}

// section suggestions
for (const sec of ['vibe', 'background', 'typography', 'buttons', 'layout'] as Section[]) {
  const r = suggestSection(sec, { seed: 's1', plan: 'pro', current: cur }, 6);
  if (r.items.length < 5) fail(`${sec}: only ${r.items.length} suggestions`);
  const names = new Set(r.items.map((x) => x.name + '|' + x.tagline));
  if (names.size !== r.items.length) fail(`${sec}: duplicates`);
  for (const s of r.items) {
    const merged = { ...cur, ...s.patch, page: { ...cur.page, ...(s.patch.page ?? {}) } } as typeof cur;
    const v = hardViolations(merged, 'pro');
    if (v.length) fail(`${sec} patch breaks rules: ${v.join('; ')}`);
  }
  if (sec !== 'vibe' && sec !== 'background' && r.items.some((x) => x.patch.vibe)) {
    fail(`${sec} changed vibe`);
  }
}

// regenerate: no repeats vs last 20
let recent: string[] = [];
let rep = 0;
for (let i = 0; i < 6; i++) {
  const r = regenerate('background', { plan: 'pro', current: cur }, recent);
  for (const s of r.signatures) {
    if (recent.slice(-20).includes(s)) rep++;
  }
  recent = recent.concat(r.signatures);
}
if (rep) fail(`regenerate repeated ${rep} items within last 20`);

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
const ex = generateTheme({ seed: 'demo', plan: 'free', mood: 'luxe' });
console.log(
  '\nExample:',
  ex.meta.name,
  '·',
  ex.vibe.tagline,
  '| score',
  ex.meta.score,
  '\n',
  ex.meta.why
);
process.exit(fails ? 1 : 0);

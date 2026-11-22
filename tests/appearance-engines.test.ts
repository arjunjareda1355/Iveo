import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  alphaBlend,
  compositeOverBg,
  contrastRatio,
  worstCaseContrast,
} from '../src/lib/color/contrast.ts';
import { deltaE, hexToOklch, oklabToRgb, rgbToOklab } from '../src/lib/color/oklch.ts';
import { bestText, inGamut, reduceChromaToGamut, safeOklchToHex } from '../src/lib/color/gamut.ts';
import { analyzeBackground } from '../src/lib/color/analyze.ts';
import { buildSuggestionSeed, mulberry32 } from '../src/lib/color/prng.ts';
import {
  evaluateButtonSetRules,
  suggestButtons,
  suggestFonts,
  suggestLayouts,
} from '../src/lib/color/recipes.ts';
import { CATALOG_VIBES, findCatalogVibe } from '../src/lib/appearance/catalog/vibes.ts';
import { CATALOG_BACKGROUNDS } from '../src/lib/appearance/catalog/backgrounds.ts';
import { findCatalogFont } from '../src/lib/appearance/catalog/fonts.ts';
import { SYSTEM_DEFAULT_APPEARANCE, type Background, type Hex } from '../src/lib/appearance/types.ts';
import { resolveTokens } from '../src/lib/appearance/resolveTokens.ts';
import { migrateLegacyProfileToAppearanceV2 } from '../src/lib/appearance/migrate.ts';
import { checkLinkLayoutLabelWarning } from '../src/lib/appearance/catalog/surfaces.ts';

describe('Section 8.1 WCAG Contrast Vectors', () => {
  it('matches known WCAG contrast ratios', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    const greyFail = contrastRatio('#777777', '#FFFFFF');
    assert.ok(greyFail > 4.45 && greyFail < 4.5, `expected ~4.48, got ${greyFail}`);

    const greyPass = contrastRatio('#767676', '#FFFFFF');
    assert.ok(greyPass >= 4.5 && greyPass < 4.6, `expected ~4.54, got ${greyPass}`);

    const inkOnBone = contrastRatio('#121212', '#FAFAF9');
    assert.ok(inkOnBone > 17.5 && inkOnBone < 18.5, `expected ~17.9, got ${inkOnBone}`);
  });

  it('composites translucent colors accurately over backdrops', () => {
    const comp = compositeOverBg('rgba(0,0,0,0.5)', '#FFFFFF');
    assert.ok(Math.abs(comp.r - 127.5) < 1);
    assert.equal(comp.a, 1);

    const blended = alphaBlend({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    assert.ok(Math.abs(blended.r - 127.5) < 1);
  });
});

describe('Section 8.2 OKLab / OKLCH Round-Trip & Gamut Reduction', () => {
  it('round-trips 1,000 random sRGB colors within max 1 channel unit', () => {
    const rng = mulberry32(424242);
    for (let i = 0; i < 1000; i++) {
      const r = Math.floor(rng() * 256);
      const g = Math.floor(rng() * 256);
      const b = Math.floor(rng() * 256);
      const lab = rgbToOklab(r, g, b);
      const out = oklabToRgb(lab);
      assert.ok(Math.abs(out.r - r) <= 1, `R mismatch ${r} vs ${out.r}`);
      assert.ok(Math.abs(out.g - g) <= 1, `G mismatch ${g} vs ${out.g}`);
      assert.ok(Math.abs(out.b - b) <= 1, `B mismatch ${b} vs ${out.b}`);
    }
  });

  it('reduces out-of-gamut chroma while preserving L and h', () => {
    const extreme = { L: 0.72, C: 0.45, h: 145 };
    const safe = reduceChromaToGamut(extreme);
    assert.equal(safe.L, extreme.L);
    assert.equal(safe.h, extreme.h);
    assert.ok(safe.C < extreme.C);
    assert.ok(inGamut(safe));
    const hex = safeOklchToHex(extreme);
    assert.match(hex, /^#[0-9A-F]{6}$/);
  });

  it('bestText guarantees >= 4.5 contrast by selecting ink/paper and nudging fill when midtone', () => {
    const res = bestText('#808080', '#FFFFFF', 4.5);
    assert.ok(contrastRatio(res.text, res.fill) >= 4.5, `contrast was ${res.contrast}`);
  });
});

describe('Catalog Coverage & Rules T1-T5 across all 24 Vibes & 40 Backgrounds', () => {
  it('contains exact catalog counts (24 vibes, 40 backgrounds)', () => {
    assert.equal(CATALOG_VIBES.length, 24);
    assert.equal(CATALOG_BACKGROUNDS.length, 40);
  });

  it('resolves accessible pageText (>= 4.5:1 worst-case) for all 24 Vibes', () => {
    for (const vibe of CATALOG_VIBES) {
      const resolved = resolveTokens(
        {
          ...SYSTEM_DEFAULT_APPEARANCE,
          vibeId: vibe.id,
          background: { type: 'preset', id: vibe.backgroundId },
        },
        { isPro: true }
      );
      const worstPageText = worstCaseContrast(resolved.pageText, [
        resolved.bgProfile.darkest,
        resolved.bgProfile.lightest,
      ]);
      assert.ok(
        worstPageText >= 4.5,
        `Vibe ${vibe.id} pageText ${resolved.pageText} failed contrast (${worstPageText}) on [${resolved.bgProfile.darkest}, ${resolved.bgProfile.lightest}]`
      );
      const focusCr = worstCaseContrast(resolved.focusRing, [
        resolved.bgProfile.darkest,
        resolved.bgProfile.lightest,
      ]);
      assert.ok(focusCr >= 3.0, `Vibe ${vibe.id} focusRing contrast (${focusCr}) < 3.0`);
    }
  });

  it('suggestButtons satisfies T1/T3 rules across all 40 catalog backgrounds', () => {
    const baseVibe = findCatalogVibe('porcelain')!;
    for (const bgPreset of CATALOG_BACKGROUNDS) {
      const bg: Background = { type: 'preset', id: bgPreset.id };
      const profile = analyzeBackground(bg);
      const suggestions = suggestButtons({
        bgProfile: profile,
        bg,
        vibe: baseVibe,
        current: SYSTEM_DEFAULT_APPEARANCE.buttons,
        locks: [],
        seed: 1001,
        refreshCount: 0,
      });

      assert.equal(suggestions.length, 8, `Expected 8 suggestions for ${bgPreset.id}`);
      assert.ok(!suggestions[0].subtle, `Slot 1 should never be SOFT on ${bgPreset.id}`);
      for (const s of suggestions) {
        const rule = evaluateButtonSetRules(s.fill, s.text, s.border, s.borderWidth, profile);
        assert.ok(
          s.subtle ? rule.passSoft : rule.passStrict,
          `Preset ${bgPreset.id} suggestion ${s.recipe} (${s.fill} / ${s.text}) failed ${s.subtle ? 'SOFT' : 'STRICT'}: ${JSON.stringify(rule)}`
        );
      }
    }
  });
});

describe('Section 11.4 Worked Examples & 1,000-Background Property Suite', () => {
  it('produces valid high-contrast sets for worked examples (#FAFAF9, #0B1020, #FF6B2C)', () => {
    const baseVibe = findCatalogVibe('porcelain')!;
    const fixtures: Array<{ label: string; bg: Background; expectedTone: 'light' | 'mid' | 'dark' }> = [
      { label: 'light neutral', bg: { type: 'solid', color: '#FAFAF9' }, expectedTone: 'light' },
      {
        label: 'dark gradient',
        bg: {
          type: 'gradient',
          kind: 'linear',
          angle: 135,
          stops: [
            { color: '#0B1020', at: 0 },
            { color: '#1E3A8A', at: 100 },
          ],
        },
        expectedTone: 'dark',
      },
      { label: 'vivid tangerine', bg: { type: 'solid', color: '#FF6B2C' }, expectedTone: 'mid' },
    ];

    for (const fx of fixtures) {
      const profile = analyzeBackground(fx.bg);
      assert.equal(profile.tone, fx.expectedTone, `tone mismatch for ${fx.label}`);
      const list = suggestButtons({
        bgProfile: profile,
        bg: fx.bg,
        vibe: baseVibe,
        current: SYSTEM_DEFAULT_APPEARANCE.buttons,
        locks: [],
        seed: 777,
        refreshCount: 0,
      });
      assert.equal(list.length, 8);
      assert.equal(list[0].recipe, 'R1');
      for (const s of list) {
        if (!s.subtle) {
          assert.ok(s.textContrast >= 4.5, `${fx.label} ${s.recipe} text < 4.5`);
          assert.ok(s.affordanceContrast >= 3.0, `${fx.label} ${s.recipe} affordance < 3.0`);
        }
      }
    }
  });

  it('passes STRICT/SOFT, determinism, novelty & <30ms perf over 1,000 random/extreme backgrounds', () => {
    const rng = mulberry32(20261122);
    const baseVibe = findCatalogVibe('porcelain')!;
    const extremes: Background[] = [
      { type: 'solid', color: '#000000' },
      { type: 'solid', color: '#FFFFFF' },
      { type: 'solid', color: '#7F7F7F' },
      { type: 'solid', color: '#FF0000' },
      { type: 'solid', color: '#00FF00' },
      { type: 'solid', color: '#0000FF' },
    ];

    const toHexByte = (n: number) => Math.floor(n).toString(16).padStart(2, '0').toUpperCase();
    const randHex = (): Hex =>
      `#${toHexByte(rng() * 256)}${toHexByte(rng() * 256)}${toHexByte(rng() * 256)}` as Hex;

    let totalMs = 0;
    const count = 1000;

    for (let i = 0; i < count; i++) {
      let bg: Background;
      if (i < extremes.length) {
        bg = extremes[i];
      } else if (i % 3 === 0) {
        const stopCount = 2 + Math.floor(rng() * 3);
        const stops = Array.from({ length: stopCount }, (_, idx) => ({
          color: randHex(),
          at: Math.round((idx / (stopCount - 1)) * 100),
        }));
        bg = {
          type: 'gradient',
          kind: i % 6 === 0 ? 'radial' : 'linear',
          angle: Math.floor(rng() * 360),
          stops,
        };
      } else {
        bg = { type: 'solid', color: randHex() };
      }

      const profile = analyzeBackground(bg);
      const t0 = performance.now();
      const res = suggestButtons({
        bgProfile: profile,
        bg,
        vibe: baseVibe,
        current: SYSTEM_DEFAULT_APPEARANCE.buttons,
        locks: [],
        seed: i + 10,
        refreshCount: 0,
      });
      totalMs += performance.now() - t0;

      assert.ok(res.length >= 6 && res.length <= 8, `unexpected length ${res.length} on bg #${i}`);
      assert.ok(!res[0].subtle, `SOFT set appeared in slot 1 on bg #${i}`);
      for (const s of res) {
        const ev = evaluateButtonSetRules(s.fill, s.text, s.border, s.borderWidth, profile);
        assert.ok(
          s.subtle ? ev.passSoft : ev.passStrict,
          `Rule failed on bg #${i} (${JSON.stringify(bg)}) for ${s.recipe}: ${JSON.stringify(ev)}`
        );
      }
    }

    const avgMs = totalMs / count;
    assert.ok(avgMs < 30, `Average suggestButtons time too slow: ${avgMs.toFixed(2)}ms`);

    // Determinism & Novelty verification
    const prof = analyzeBackground({ type: 'solid', color: '#1E293B' });
    const seedA = buildSuggestionSeed({ pageId: 'maya', bgSignature: prof.signature, vibeId: 'eclipse', refreshCount: 0 });
    const seedB = buildSuggestionSeed({ pageId: 'maya', bgSignature: prof.signature, vibeId: 'eclipse', refreshCount: 1 });
    const run1 = suggestButtons({
      bgProfile: prof,
      bg: { type: 'solid', color: '#1E293B' },
      vibe: findCatalogVibe('eclipse')!,
      current: SYSTEM_DEFAULT_APPEARANCE.buttons,
      locks: [],
      seed: seedA,
      refreshCount: 0,
    });
    const run1Repeat = suggestButtons({
      bgProfile: prof,
      bg: { type: 'solid', color: '#1E293B' },
      vibe: findCatalogVibe('eclipse')!,
      current: SYSTEM_DEFAULT_APPEARANCE.buttons,
      locks: [],
      seed: seedA,
      refreshCount: 0,
    });
    assert.deepEqual(run1.map((x) => x.fill), run1Repeat.map((x) => x.fill));

    const seen = new Set(run1.map((s) => `${s.fill}|${s.text}|${s.border}|${s.surface || 'none'}`));
    const run2 = suggestButtons({
      bgProfile: prof,
      bg: { type: 'solid', color: '#1E293B' },
      vibe: findCatalogVibe('eclipse')!,
      current: SYSTEM_DEFAULT_APPEARANCE.buttons,
      locks: [],
      seed: seedB,
      seenSignatures: seen,
      refreshCount: 1,
    });
    const changed = run2.filter((s, idx) => deltaE(String(s.fill), String(run1[idx]?.fill || '#000000')) > 0.01);
    assert.ok(changed.length >= 2, 'Expected refresh to vary button suggestions via seenSignatures');
  });
});

describe('Typography & Layout Suggestion Constraints', () => {
  it('never places excluded/script/pixel/condensed fonts in Bio and caps <= 3 families', () => {
    for (const bgPreset of CATALOG_BACKGROUNDS.slice(0, 12)) {
      const profile = analyzeBackground({ type: 'preset', id: bgPreset.id });
      const vibe = findCatalogVibe('porcelain')!;
      const combos = suggestFonts({
        bgProfile: profile,
        vibe,
        current: SYSTEM_DEFAULT_APPEARANCE.typography,
        currentSurface: 'solid-soft',
        locks: [],
        seed: 555,
        isPro: false,
      });

      assert.equal(combos.length, 6);
      for (const combo of combos) {
        const distinct = new Set([combo.nameFont.family, combo.bioFont.family, combo.buttonFont.family]);
        assert.ok(distinct.size <= 3, `Too many font families: ${[...distinct].join(', ')}`);
        const bioFont = findCatalogFont(combo.bioFont.family)!;
        assert.ok(bioFont, `Missing font ${combo.bioFont.family}`);
        assert.ok(!bioFont.excludeFromBio, `${bioFont.family} should not appear in Bio`);
        assert.notEqual(bioFont.category, 'script');
      }
    }
  });

  it('enforces hero avatar auto-bump (C9) and C8 long-label warning', () => {
    const profile = analyzeBackground({ type: 'solid', color: '#111827' });
    const vibe = findCatalogVibe('obsidian')!;
    const ideas = suggestLayouts({
      bgProfile: profile,
      bg: { type: 'solid', color: '#111827' },
      vibe,
      buttons: SYSTEM_DEFAULT_APPEARANCE.buttons,
      currentLayout: SYSTEM_DEFAULT_APPEARANCE.layout,
      locks: [],
      seed: 99,
      linkLabels: ['A very long portfolio project title exceeding twenty-four chars'],
    });
    assert.equal(ideas.length, 6);
    for (const idea of ideas) {
      if (idea.header === 'hero') {
        assert.ok(idea.avatar.size === 'l' || idea.avatar.size === 'xl');
      }
    }
    const warning = checkLinkLayoutLabelWarning('grid2', [
      'A very long portfolio project title exceeding twenty-four chars',
    ]);
    assert.ok(warning && warning.includes('24'));
  });
});

describe('Pro Gating Downgrade & Idempotent v1 -> v2 Migration', () => {
  it('gracefully downgrades lapsed Pro styles when isPro=false', () => {
    const resolved = resolveTokens(
      {
        ...SYSTEM_DEFAULT_APPEARANCE,
        vibeId: 'oat-milk', // pro
        background: { type: 'preset', id: 'bg-northern-veil' }, // pro
        typography: {
          name: { family: 'Clash Display', weight: 600, size: 'm', tracking: 'normal', source: 'user' },
          bio: { family: 'Lora', weight: 400, size: 'm', tracking: 'normal', source: 'user' },
          button: { family: 'Sora', weight: 500, size: 'm', tracking: 'normal', source: 'user' },
        },
        buttons: {
          ...SYSTEM_DEFAULT_APPEARANCE.buttons,
          surface: 'glass', // pro
        },
      },
      { isPro: false }
    );

    assert.ok(resolved.downgradedProFields.includes('vibeId'));
    assert.ok(resolved.downgradedProFields.includes('background.preset'));
    assert.ok(resolved.downgradedProFields.includes('buttons.surface'));
    assert.notEqual(resolved.buttons.surface, 'glass');
    assert.equal(findCatalogVibe(resolved.vibeId)?.tier, 'free');
  });

  it('migrates v1 legacy profile cleanly and is idempotent on v2', () => {
    const v1Migrated = migrateLegacyProfileToAppearanceV2({
      vibeId: 'midnight',
      buttonShape: 'pill',
      buttonColors: { bg: '#E11D48', text: '#FFFFFF', border: '#E11D48' },
      fontSettings: { nameFont: 'syne', bioFont: 'inter', buttonFont: 'inter' },
      layoutSettings: {
        avatarShape: 'ring',
        headerAlign: 'left',
        buttonStyle: 'offset',
        linkSpacing: 'airy',
        pageWidth: 'compact',
      },
      onboardingComplete: true,
    });

    assert.equal(v1Migrated.schemaVersion, 2);
    assert.equal(v1Migrated.vibeId, 'obsidian');
    assert.equal(v1Migrated.buttons.shape, 'pill');
    assert.equal(v1Migrated.buttons.surface, 'offset-3d');
    assert.equal(v1Migrated.layout.header, 'editorial');
    assert.equal(v1Migrated.layout.spacing, 'airy');
    assert.equal(v1Migrated.layout.width, 'focused');
    assert.equal(v1Migrated.autoMatchButtons, false);

    const secondPass = migrateLegacyProfileToAppearanceV2({ appearance: v1Migrated });
    assert.deepEqual(secondPass, v1Migrated);
  });
});

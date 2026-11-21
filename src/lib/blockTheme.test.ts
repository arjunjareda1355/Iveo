import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBlockThemeContract,
  getBlockContrastPalette,
  buildProfileSsrHeadTags,
} from './blockTheme.ts';
import { getContrastRatio } from './colors.ts';

test('resolveBlockThemeContract builds shared CSS variables and preserves AA contrast across vibes and button styles', () => {
  const styles = ['solid', 'outline', 'soft', 'offset', 'glass', 'gradient'] as const;
  const vibes = ['clean', 'midnight', 'paper', 'brutalist'] as const;

  for (const vibeId of vibes) {
    for (const buttonStyle of styles) {
      const contract = resolveBlockThemeContract({
        vibeId,
        layoutSettings: { buttonStyle },
        fontSettings: { buttonFont: 'dm-sans' },
      });

      assert.ok(contract.cssVars['--block-bg'], `missing --block-bg for ${vibeId}/${buttonStyle}`);
      assert.ok(contract.cssVars['--btn-bg'], `missing --btn-bg for ${vibeId}/${buttonStyle}`);
      assert.ok(contract.cssVars['--btn-text'], `missing --btn-text for ${vibeId}/${buttonStyle}`);

      // Verify primary CTA pill text always achieves WCAG AA >= 4.5:1 against CTA background
      const ratio = getContrastRatio(contract.cssVars['--btn-text'], contract.cssVars['--btn-bg']);
      assert.ok(
        ratio !== null && ratio >= 4.5,
        `CTA contrast below AA for ${vibeId}/${buttonStyle}: ratio=${ratio}`
      );
    }
  }
});

test('getBlockContrastPalette handles midnight dark theme without inverting to broken contrast', () => {
  const contract = resolveBlockThemeContract({ vibeId: 'midnight' });
  const palette = getBlockContrastPalette(contract.surfaceStyle, contract.tokens);
  assert.equal(palette.isDarkSurface, true);
  assert.ok((getContrastRatio(palette.btnText, palette.btnBg) ?? 0) >= 4.5);
  assert.notEqual(palette.btnBg.toUpperCase(), '#1C1C1E');
});

test('buildProfileSsrHeadTags outputs critical #iveo-ssr-theme and Google Fonts stylesheet before first paint', () => {
  const html = buildProfileSsrHeadTags({
    vibeId: 'midnight',
    fontSettings: { nameFont: 'fraunces', buttonFont: 'inter' },
  });
  assert.match(html, /id="iveo-ssr-theme"/);
  assert.match(html, /background-color:\s*#0B0B0C/i);
  assert.match(html, /iveo-ssr-only/);
  assert.match(html, /https:\/\/fonts\.googleapis\.com\/css2\?/);
});

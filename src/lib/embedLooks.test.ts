import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_LOOK_OPTIONS,
  getCardLookOption,
  getEmbedLookOptions,
  getLookLabelForProvider,
  normalizeEmbedLookStyle,
  getDefaultEmbedCtaLabel,
  isSocialEmbedProvider,
} from './embedLooks.ts';
import {
  ensureContrastText,
  ensureUiAccentContrast,
  getContrastRatio,
  resolveCssColorToHex,
  resolveGlassSurfaceConfig,
} from './colors.ts';
import { VIBES } from './vibes.ts';
import { listPlatformProviders, PROVIDER_REGISTRY } from './providers/definitions.ts';
import type { CardLookStyle, EmbedProvider } from '../data/types.ts';

describe('embedLooks & unified 5-look design system', () => {
  const providers: EmbedProvider[] = [
    'discord',
    'github',
    'linkedin',
    'x',
    'instagram',
    'facebook',
    'threads',
    'pinterest',
    'youtube',
    'spotify',
    'soundcloud',
    'linktree',
    'bluesky',
    'twitch',
    'snapchat',
  ];

  it('exposes the 7 canonical card looks consistently across providers', () => {
    assert.equal(CARD_LOOK_OPTIONS.length, 7);
    assert.deepEqual(
      CARD_LOOK_OPTIONS.map((o) => o.id),
      ['match_page', 'brand', 'banner', 'glass', 'compact', 'profile_card', 'with_posts']
    );

    for (const provider of providers) {
      const options = getEmbedLookOptions(provider);
      assert.equal(options.length, 7);
      assert.deepEqual(
        options.map((o) => o.id),
        ['match_page', 'brand', 'banner', 'glass', 'compact', 'profile_card', 'with_posts']
      );
      assert.equal(getLookLabelForProvider(provider, 'brand'), 'Brand');
    }
    assert.equal(getCardLookOption('unknown').id, 'match_page');
  });

  it('maps legacy preset names and old look IDs onto the 5 canonical looks cleanly', () => {
    assert.equal(normalizeEmbedLookStyle('match_page'), 'match_page');
    assert.equal(normalizeEmbedLookStyle('theme'), 'match_page');
    assert.equal(normalizeEmbedLookStyle('vibe'), 'match_page');

    assert.equal(normalizeEmbedLookStyle('brand'), 'brand');
    assert.equal(normalizeEmbedLookStyle('signature'), 'brand');
    assert.equal(normalizeEmbedLookStyle('classic'), 'brand');
    assert.equal(normalizeEmbedLookStyle('corporate'), 'brand');
    assert.equal(normalizeEmbedLookStyle('default'), 'brand');

    assert.equal(normalizeEmbedLookStyle('banner'), 'banner');
    assert.equal(normalizeEmbedLookStyle('spotlight'), 'banner');
    assert.equal(normalizeEmbedLookStyle('cover'), 'banner');

    assert.equal(normalizeEmbedLookStyle('glass'), 'glass');
    assert.equal(normalizeEmbedLookStyle('frosted'), 'glass');

    assert.equal(normalizeEmbedLookStyle('compact'), 'compact');
    assert.equal(normalizeEmbedLookStyle('minimal'), 'compact');

    assert.equal(normalizeEmbedLookStyle('invalid', 'compact'), 'compact');
    assert.equal(normalizeEmbedLookStyle(undefined), 'match_page');
  });

  it('distinguishes social account embeds from playable media embeds', () => {
    assert.equal(isSocialEmbedProvider('discord'), true);
    assert.equal(isSocialEmbedProvider('github'), true);
    assert.equal(isSocialEmbedProvider('linkedin'), true);
    assert.equal(isSocialEmbedProvider('x'), true);
    assert.equal(isSocialEmbedProvider('instagram'), true);
    assert.equal(isSocialEmbedProvider('facebook'), true);
    assert.equal(isSocialEmbedProvider('threads'), true);
    assert.equal(isSocialEmbedProvider('pinterest'), true);
    assert.equal(isSocialEmbedProvider('linktree'), true);
    assert.equal(isSocialEmbedProvider('bluesky'), true);
    assert.equal(isSocialEmbedProvider('twitch'), true);
    assert.equal(isSocialEmbedProvider('snapchat'), true);

    assert.equal(isSocialEmbedProvider('youtube'), false);
    assert.equal(isSocialEmbedProvider('spotify'), false);
    assert.equal(isSocialEmbedProvider('soundcloud'), false);
    assert.equal(isSocialEmbedProvider(null), false);
  });

  it('returns plain-English default CTA labels per provider and kind', () => {
    assert.equal(getDefaultEmbedCtaLabel('discord', 'invite'), 'Join server');
    assert.equal(getDefaultEmbedCtaLabel('discord', 'user'), 'Open');
    assert.equal(getDefaultEmbedCtaLabel('github', 'repo'), 'View repo');
    assert.equal(getDefaultEmbedCtaLabel('github', 'profile'), 'View profile');
    assert.equal(getDefaultEmbedCtaLabel('linkedin', 'company'), 'View profile');
    assert.equal(getDefaultEmbedCtaLabel('x', 'post'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('x', 'profile'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('instagram', 'reel'), 'View post');
    assert.equal(getDefaultEmbedCtaLabel('instagram', 'profile'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('facebook', 'group'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('facebook', 'post'), 'View post');
    assert.equal(getDefaultEmbedCtaLabel('threads', 'post'), 'View post');
    assert.equal(getDefaultEmbedCtaLabel('threads', 'profile'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('pinterest', 'pin'), 'View pin');
    assert.equal(getDefaultEmbedCtaLabel('pinterest', 'board'), 'View board');
    assert.equal(getDefaultEmbedCtaLabel('pinterest', 'profile'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('youtube', 'video'), 'Watch');
    assert.equal(getDefaultEmbedCtaLabel('youtube', 'channel'), 'Subscribe');
    assert.equal(getDefaultEmbedCtaLabel('spotify', 'track'), 'Listen on Spotify');
    assert.equal(getDefaultEmbedCtaLabel('soundcloud', 'track'), 'Listen on SoundCloud');
    assert.equal(getDefaultEmbedCtaLabel('twitch', 'profile'), 'Follow');
    assert.equal(getDefaultEmbedCtaLabel('twitch', 'clip'), 'Watch clip');
    assert.equal(getDefaultEmbedCtaLabel('snapchat', 'profile'), 'Add');
    assert.equal(getDefaultEmbedCtaLabel('snapchat', 'spotlight'), 'Watch');
  });

  it('enforces WCAG AA contrast across all 12 vibes x 7 looks x 15 platform providers', () => {
    const platformDefs = listPlatformProviders();
    const looks: CardLookStyle[] = CARD_LOOK_OPTIONS.map((o) => o.id);
    assert.equal(VIBES.length, 12);
    assert.equal(looks.length, 7);
    assert.equal(platformDefs.length, 15);

    for (const vibe of VIBES) {
      const { tokens } = vibe;
      const pageBgHex = resolveCssColorToHex(tokens.bg, '#FFFFFF');
      const vibeSurfaceCss = tokens.buttonBg === 'transparent' ? tokens.bg : tokens.buttonBg;
      const vibeSurfaceHex = resolveCssColorToHex(vibeSurfaceCss, pageBgHex);
      const pageAccentHex = resolveCssColorToHex(
        tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg,
        pageBgHex
      );

      for (const look of looks) {
        for (const def of platformDefs) {
          const glassCfg =
            look === 'glass' ? resolveGlassSurfaceConfig(tokens, def.brandColor, null) : null;
          const resolvedSurfaceHex =
            look === 'glass' && glassCfg
              ? resolveCssColorToHex(glassCfg.backgroundCss, pageBgHex)
              : vibeSurfaceHex;

          const textPrimary =
            look === 'glass' && glassCfg
              ? glassCfg.textColor
              : ensureContrastText(tokens.text, resolvedSurfaceHex, 4.5, pageBgHex);

          const textRatio = getContrastRatio(textPrimary, resolvedSurfaceHex) ?? 0;
          assert.ok(
            textRatio >= 4.5,
            `Expected primary text >= 4.5 for vibe=${vibe.id} look=${look} provider=${def.id}, got ${textRatio}`
          );

          const rawAccent = look === 'match_page' ? pageAccentHex : def.brandColor;
          const guardedAccent = ensureUiAccentContrast(
            rawAccent,
            resolvedSurfaceHex,
            textPrimary,
            3.0,
            pageBgHex
          );
          const accentRatio = getContrastRatio(guardedAccent, resolvedSurfaceHex) ?? 0;
          assert.ok(
            accentRatio >= 3.0,
            `Expected UI accent >= 3.0 for vibe=${vibe.id} look=${look} provider=${def.id}, got ${accentRatio}`
          );

          const buttonFillColor = look === 'match_page' ? pageAccentHex : def.brandColor;
          const buttonFillText = ensureContrastText(
            look !== 'match_page' ? def.brandTextOnFill : null,
            buttonFillColor,
            4.5,
            vibeSurfaceHex
          );
          const btnRatio = getContrastRatio(buttonFillText, buttonFillColor) ?? 0;
          assert.ok(
            btnRatio >= 4.5,
            `Expected CTA button text >= 4.5 for vibe=${vibe.id} look=${look} provider=${def.id}, got ${btnRatio}`
          );
        }
      }
    }

    // Also verify glass escalates opacity to 0.85 against bright midtones
    const brutalist = VIBES.find((v) => v.id === 'brutalist')!;
    const brutalistGlass = resolveGlassSurfaceConfig(brutalist.tokens, PROVIDER_REGISTRY.discord.brandColor, null);
    assert.ok(brutalistGlass.opacity === 0.6 || brutalistGlass.opacity === 0.85);
    const ratioGlass = getContrastRatio(
      brutalistGlass.textColor,
      resolveCssColorToHex(brutalistGlass.backgroundCss, brutalist.tokens.bg)
    ) ?? 0;
    assert.ok(ratioGlass >= 4.5);
  });
});

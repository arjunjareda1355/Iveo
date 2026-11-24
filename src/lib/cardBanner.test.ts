import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANNER_COLOR_SWATCHES,
  DEFAULT_CARD_BANNER_CONFIG,
  computeBannerImagePresentation,
  normalizeBannerHexColor,
  normalizeCardBannerConfig,
  resolveBannerAvatarChain,
  resolveBannerBackgroundStyle,
  resolveBannerMutedTextColor,
  resolveBannerResponsiveMetrics,
  sanitizeEmbedMetaBannerForSave,
} from './cardBanner';

test('defaults when banner config is missing or null (backward compatibility)', () => {
  assert.deepEqual(normalizeCardBannerConfig(undefined), DEFAULT_CARD_BANNER_CONFIG);
  assert.deepEqual(normalizeCardBannerConfig(null), {
    source: 'auto',
    imageUrl: null,
    smallImageUrl: null,
    color: null,
    focalX: 50,
    focalY: 40,
    zoom: 1,
    dim: 20,
  });
});

test('clamps focalX, focalY, zoom, dim and rejects invalid colors/urls', () => {
  const normalized = normalizeCardBannerConfig({
    source: 'upload',
    imageUrl: 'javascript:alert(1)',
    smallImageUrl: '/api/cards/banner/arjun/abcdef123456-sm.webp',
    color: '#0a66c2',
    focalX: -15,
    focalY: 200,
    zoom: 9.5,
    dim: 99,
  });

  assert.equal(normalized.source, 'upload');
  assert.equal(normalized.imageUrl, null);
  assert.equal(normalized.smallImageUrl, '/api/cards/banner/arjun/abcdef123456-sm.webp');
  assert.equal(normalized.color, '#0A66C2');
  assert.equal(normalized.focalX, 0);
  assert.equal(normalized.focalY, 100);
  assert.equal(normalized.zoom, 3);
  assert.equal(normalized.dim, 60);

  assert.equal(normalizeBannerHexColor('#12abEF'), '#12ABEF');
  assert.equal(normalizeBannerHexColor('#123'), null);
  assert.equal(normalizeBannerHexColor('red'), null);
});

test('sanitizeEmbedMetaBannerForSave strips banner config when effectiveLook is not banner', () => {
  const meta = {
    provider: 'linkedin' as const,
    banner: {
      source: 'color' as const,
      color: '#111111',
      dim: 35,
    },
  };
  const kept = sanitizeEmbedMetaBannerForSave(meta, 'banner');
  assert.ok(kept?.banner);
  assert.equal(kept?.banner?.color, '#111111');

  const stripped = sanitizeEmbedMetaBannerForSave(meta, 'compact');
  assert.equal(stripped?.banner, undefined);

  const longDataUrl = `data:image/webp;base64,${'A'.repeat(1200)}`;
  const demoKept = sanitizeEmbedMetaBannerForSave(
    {
      provider: 'linkedin',
      banner: { source: 'upload', imageUrl: longDataUrl, smallImageUrl: longDataUrl },
    },
    'banner',
    { allowDataUrl: true }
  );
  assert.equal(demoKept?.banner?.imageUrl, longDataUrl);

  const serverStripped = sanitizeEmbedMetaBannerForSave(
    {
      provider: 'linkedin',
      banner: { source: 'upload', imageUrl: longDataUrl, smallImageUrl: longDataUrl },
    },
    'banner',
    { allowDataUrl: false }
  );
  assert.equal(serverStripped?.banner?.imageUrl, null);
  assert.equal(serverStripped?.banner?.smallImageUrl, null);
});

test('resolveBannerBackgroundStyle priority and error fallback', () => {
  // Upload active
  const uploaded = resolveBannerBackgroundStyle({
    banner: {
      source: 'upload',
      imageUrl: '/api/cards/banner/maya/hash12345678.webp',
      focalX: 30,
      focalY: 70,
      zoom: 1.5,
      dim: 25,
    },
    fetchedCoverUrl: 'https://cdn.example.com/cover.jpg',
    provider: 'linkedin',
  });
  assert.equal(uploaded.mode, 'image');
  assert.equal(uploaded.imageUrl, '/api/cards/banner/maya/hash12345678.webp');
  assert.equal(uploaded.dimAlpha, 0.25);

  // Broken uploaded URL falls back to gradient (never broken img)
  const uploadedError = resolveBannerBackgroundStyle({
    banner: {
      source: 'upload',
      imageUrl: '/api/cards/banner/maya/hash12345678.webp',
    },
    uploadedFailed: true,
    provider: 'linkedin',
  });
  assert.equal(uploadedError.mode, 'gradient');
  assert.match(uploadedError.backgroundCss, /#0A66C2/);
  assert.match(uploadedError.backgroundCss, /#0B2F5C/);

  // Colour source uses chosen hex or first swatch
  const colored = resolveBannerBackgroundStyle({
    banner: { source: 'color', color: BANNER_COLOR_SWATCHES[2], dim: 10 },
    provider: 'linkedin',
  });
  assert.equal(colored.mode, 'color');
  assert.equal(colored.backgroundCss, '#5E7D63');
  assert.equal(colored.dimAlpha, 0.1);

  // Auto with no fetched cover uses gradient
  const autoFallback = resolveBannerBackgroundStyle({
    banner: { source: 'auto' },
    fetchedCoverUrl: null,
    provider: 'linkedin',
  });
  assert.equal(autoFallback.mode, 'gradient');
  assert.equal(autoFallback.backgroundCss, 'linear-gradient(120deg, #0A66C2 0%, #0B2F5C 100%)');
});

test('computeBannerImagePresentation calculates CSS background position & zoom', () => {
  const base = computeBannerImagePresentation({ focalX: 50, focalY: 40, zoom: 1 });
  assert.equal(base.backgroundPosition, '50% 40%');
  assert.equal(base.backgroundSize, 'cover');
  assert.equal(base.transform, undefined);

  const zoomed = computeBannerImagePresentation({ focalX: 25, focalY: 60, zoom: 1.75 });
  assert.equal(zoomed.backgroundPosition, '25% 60%');
  assert.equal(zoomed.backgroundSize, '175% auto');
  assert.equal(zoomed.transform, 'scale(1.75)');
});

test('resolveBannerResponsiveMetrics switches below 320px width', () => {
  const wide = resolveBannerResponsiveMetrics(342, 1);
  assert.equal(wide.compact, false);
  assert.equal(wide.bannerHeight, 108);
  assert.equal(wide.avatarSize, 72);
  assert.equal(wide.avatarMarginTop, -36);
  assert.equal(wide.avatarRingPx, 4);
  assert.equal(wide.nameFontSize, 17);

  const narrow = resolveBannerResponsiveMetrics(280, 1);
  assert.equal(narrow.compact, true);
  assert.equal(narrow.bannerHeight, 84);
  assert.equal(narrow.avatarSize, 56);
  assert.equal(narrow.avatarMarginTop, -28);
  assert.equal(narrow.avatarRingPx, 4);
  assert.equal(narrow.nameFontSize, 15);
});

test('resolveBannerAvatarChain follows fetched -> Iveo avatar -> initial circle (never platform icon)', () => {
  const fetched = resolveBannerAvatarChain({
    fetchedAvatarUrl: 'https://media.licdn.com/photo.jpg',
    userIveoAvatarUrl: 'https://iveo.site/avatar.png',
    title: 'Arjun',
  });
  assert.deepEqual(fetched, {
    type: 'image',
    url: 'https://media.licdn.com/photo.jpg',
    source: 'fetched',
  });

  const iveoFallback = resolveBannerAvatarChain({
    fetchedAvatarUrl: 'https://media.licdn.com/photo.jpg',
    fetchedError: true,
    userIveoAvatarUrl: 'https://iveo.site/avatar.png',
    title: 'Arjun',
  });
  assert.deepEqual(iveoFallback, {
    type: 'image',
    url: 'https://iveo.site/avatar.png',
    source: 'iveo',
  });

  const initialFallback = resolveBannerAvatarChain({
    fetchedAvatarUrl: null,
    userIveoAvatarUrl: 'https://iveo.site/avatar.png',
    userIveoError: true,
    title: 'Maya Ellis',
    accentHex: '#0A66C2',
    cardSurfaceHex: '#FFFFFF',
  });
  assert.equal(initialFallback.type, 'initial');
  if (initialFallback.type === 'initial') {
    assert.equal(initialFallback.letter, 'M');
  }
});

test('resolveBannerMutedTextColor returns readable light muted color on dark/off-white vibes and dark muted on light vibes', () => {
  assert.equal(resolveBannerMutedTextColor('#111111', '#F8FAFC'), 'rgba(248, 250, 252, 0.78)');
  assert.equal(resolveBannerMutedTextColor('#111111', '#FFFFFF'), 'rgba(248, 250, 252, 0.78)');
  assert.equal(resolveBannerMutedTextColor('#FFFFFF', '#0A0A0A'), 'rgba(10, 10, 10, 0.68)');
  assert.equal(resolveBannerMutedTextColor('#111111', null), 'rgba(248, 250, 252, 0.78)');
  assert.equal(resolveBannerMutedTextColor('#FFFFFF', null), 'rgba(10, 10, 10, 0.68)');
});

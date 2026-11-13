import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGoogleAnalyticsId,
  normalizeMetaPixelId,
  normalizeWhatsAppNumber,
  buildWhatsAppUrl,
  sanitizeSeoField,
} from './integrations.ts';
import { parsePreferences } from './preferences.ts';
import { isLightColor, dataUrlToBlob } from './businessCard.ts';
import { normalizeYouTubeUrl, normalizeSocialUrl } from './urls.ts';

describe('Integrations validation helpers', () => {
  it('validates and normalizes Google Analytics 4 IDs', () => {
    assert.deepEqual(normalizeGoogleAnalyticsId(' g-ab12cd34ef '), {
      valid: true,
      value: 'G-AB12CD34EF',
    });
    assert.deepEqual(normalizeGoogleAnalyticsId(''), {
      valid: true,
      value: null,
    });
    assert.equal(normalizeGoogleAnalyticsId('UA-12345-1').valid, false);
    assert.equal(normalizeGoogleAnalyticsId('G-12').valid, false);
  });

  it('validates and normalizes Meta Pixel numeric IDs', () => {
    assert.deepEqual(normalizeMetaPixelId(' 1234 5678 901234 '), {
      valid: true,
      value: '12345678901234',
    });
    assert.deepEqual(normalizeMetaPixelId(''), { valid: true, value: null });
    assert.equal(normalizeMetaPixelId('abc123456789').valid, false);
    assert.equal(normalizeMetaPixelId('12345').valid, false);
  });

  it('validates WhatsApp numbers and builds wa.me URLs', () => {
    assert.deepEqual(normalizeWhatsAppNumber('+1 (415) 555-0199'), {
      valid: true,
      value: '+14155550199',
    });
    assert.equal(buildWhatsAppUrl('+14155550199'), 'https://wa.me/14155550199');
    assert.equal(buildWhatsAppUrl('123'), null);
    assert.equal(normalizeWhatsAppNumber('123').valid, false);
  });

  it('sanitizes custom SEO titles and descriptions', () => {
    assert.equal(sanitizeSeoField('  Creator Hub  ', 70), 'Creator Hub');
    assert.equal(sanitizeSeoField('   ', 70), null);
    assert.equal(sanitizeSeoField('a'.repeat(100), 70)?.length, 70);
  });
});

describe('Preferences parser with integrations & both social placement', () => {
  it('parses socialsPosition both and integration fields', () => {
    const prefs = parsePreferences({
      vibeId: 'midnight',
      socialsPosition: 'both',
      googleAnalyticsId: ' g-99887766 ',
      metaPixelId: '123456789012',
      whatsappNumber: '+14155550199',
      customSeoTitle: 'My Studio Links',
      customSeoDescription: 'Design work and store',
    });

    assert.equal(prefs.socialsPosition, 'both');
    assert.equal(prefs.googleAnalyticsId, 'G-99887766');
    assert.equal(prefs.metaPixelId, '123456789012');
    assert.equal(prefs.whatsappNumber, '+14155550199');
    assert.equal(prefs.customSeoTitle, 'My Studio Links');
    assert.equal(prefs.customSeoDescription, 'Design work and store');
  });
});

describe('Business card visual contrast & Blob utilities', () => {
  it('detects light vs dark card themes accurately', () => {
    assert.equal(isLightColor('#FFFFFF'), true);
    assert.equal(isLightColor('#F7F5EF'), true);
    assert.equal(isLightColor('#0F172A'), false);
    assert.equal(isLightColor('#09090B'), false);
  });

  it('converts base64 PNG data URLs to binary Blob objects', () => {
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = dataUrlToBlob(tinyPng);
    assert.equal(blob.type, 'image/png');
    assert.ok(blob.size > 0);
  });
});

describe('Social & YouTube handle URL normalization', () => {
  it('normalizes YouTube handles and domains cleanly', () => {
    assert.equal(normalizeYouTubeUrl('iveosite'), 'https://www.youtube.com/@iveosite');
    assert.equal(normalizeYouTubeUrl('@iveosite'), 'https://www.youtube.com/@iveosite');
    assert.equal(normalizeYouTubeUrl('youtube.com/@iveosite'), 'https://youtube.com/@iveosite');
    assert.equal(normalizeYouTubeUrl('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  });

  it('normalizes social handles into platform URLs while preserving full URLs', () => {
    assert.equal(normalizeSocialUrl('instagram', '@iveo.site'), 'https://instagram.com/iveo.site');
    assert.equal(normalizeSocialUrl('youtube', 'iveosite'), 'https://youtube.com/@iveosite');
    assert.equal(normalizeSocialUrl('whatsapp', '+1 415 555 0199'), 'https://wa.me/14155550199');
    assert.equal(normalizeSocialUrl('instagram', 'https://instagram.com/iveo.site'), 'https://instagram.com/iveo.site');
    assert.equal(normalizeSocialUrl('website', 'iveo.site'), 'https://iveo.site');
  });
});

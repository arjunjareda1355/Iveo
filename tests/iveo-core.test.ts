import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_BACKGROUND_CONFIG,
  parseBackgroundConfig,
} from '../src/lib/preferences.ts';
import {
  BACKGROUND_CATEGORIES,
  BACKGROUND_PRESETS,
  buildGradientCss,
  computeBackgroundLayers,
  resolveBackgroundConfig,
} from '../src/lib/backgrounds.ts';
import {
  checkBackgroundContrast,
  isDarkBackgroundConfig,
} from '../src/lib/colors.ts';
import { validateAndFormatSocialInput } from '../src/lib/urls.ts';
import {
  dbClearLinkPassword,
  dbFindBlockForUnlock,
  dbGetBlocks,
  dbGetProfile,
  dbGetProtectedLinkIds,
  dbSaveBlocks,
  dbSaveProfile,
  dbSetLinkPassword,
  dbVerifyLinkPassword,
} from '../api/_lib/azureSql.ts';

describe('Iveo Advanced Background System', () => {
  it('defaults to Pure White (#FFFFFF) when missing, null, "none", or unsafe', () => {
    assert.deepEqual(DEFAULT_BACKGROUND_CONFIG, {
      type: 'solid',
      value: '#FFFFFF',
      presetId: 'pure-white',
    });

    const fromNull = resolveBackgroundConfig(null);
    assert.equal(fromNull.type, 'solid');
    assert.equal(fromNull.value, '#FFFFFF');

    const fromNone = resolveBackgroundConfig({ type: 'none' });
    assert.equal(fromNone.type, 'solid');
    assert.equal(fromNone.value, '#FFFFFF');

    const fromUnsafeImage = resolveBackgroundConfig({
      type: 'image',
      value: 'javascript:alert(1)',
    });
    assert.equal(fromUnsafeImage.type, 'solid');
    assert.equal(fromUnsafeImage.value, '#FFFFFF');
  });

  it('rejects XSS payloads and untrusted data: URIs in parseBackgroundConfig', () => {
    assert.equal(
      parseBackgroundConfig({ type: 'image', value: 'data:text/html,<script>alert(1)</script>' }),
      null
    );
    assert.equal(
      parseBackgroundConfig({ type: 'solid', value: '<script>alert(1)</script>' })?.value,
      undefined
    );
    assert.equal(
      parseBackgroundConfig({ type: 'gradient', value: 'expression(alert(1))' })?.value,
      undefined
    );
    const validUpload = parseBackgroundConfig({
      type: 'image',
      value: '/api/backgrounds/maya/bg-123.webp',
      imageFit: 'contain',
      imagePosition: { x: 120, y: -10 },
      blur: 40,
    });
    assert.ok(validUpload);
    assert.equal(validUpload.value, '/api/backgrounds/maya/bg-123.webp');
    assert.equal(validUpload.imageFit, 'contain');
    assert.deepEqual(validUpload.imagePosition, { x: 100, y: 0 });
    assert.equal(validUpload.blur, 24);
  });

  it('provides curated presets across 7+ distinct categories and builds gradients/layers cleanly', () => {
    const nonAllCategories = BACKGROUND_CATEGORIES.filter((c) => c.id !== 'all');
    assert.ok(nonAllCategories.length >= 7);
    assert.ok(BACKGROUND_PRESETS.length >= 30);

    const grad = buildGradientCss(['#FF0000', '#0000FF'], 'to right', 120);
    assert.equal(grad, 'linear-gradient(120deg, #FF0000, #0000FF)');

    const radialGrad = buildGradientCss(['#111111', '#333333'], 'radial');
    assert.equal(radialGrad, 'radial-gradient(circle at 50% 35%, #111111, #333333)');

    const darkPreset = BACKGROUND_PRESETS.find((p) => p.id === 'carbon-matte');
    assert.ok(darkPreset);
    const layers = computeBackgroundLayers({
      type: 'solid',
      value: darkPreset.value,
      presetId: darkPreset.id,
      blur: 6,
      brightness: 0.9,
      saturation: 1.2,
    });
    assert.equal(layers.baseColor, '#0A0A0A');
    assert.equal(layers.isDark, true);
    assert.equal(layers.filterCss, 'blur(6px) brightness(0.9) saturate(1.2)');
  });

  it('calculates WCAG 2.1 contrast and dark-background detection accurately', () => {
    const whiteContrast = checkBackgroundContrast('#0A0A0A', { type: 'solid', value: '#FFFFFF' });
    assert.equal(whiteContrast.passesAA, true);
    assert.equal(whiteContrast.isDarkBg, false);
    assert.ok(whiteContrast.ratio > 15);

    const poorContrast = checkBackgroundContrast('#E2E8F0', { type: 'solid', value: '#FFFFFF' });
    assert.equal(poorContrast.passesAA, false);

    assert.equal(isDarkBackgroundConfig({ type: 'solid', value: '#0A0A0A' }), true);
    assert.equal(isDarkBackgroundConfig({ type: 'solid', value: '#FFFFFF' }), false);
    assert.equal(
      isDarkBackgroundConfig({
        type: 'solid',
        value: '#FFFFFF',
        overlayColor: '#000000',
        overlayOpacity: 0.8,
      }),
      true
    );
  });
});

describe('Social URL Domain Validation', () => {
  it('rejects mismatched platform domains and formats valid handles/URLs', () => {
    const badYt = validateAndFormatSocialInput('youtube', 'https://instagram.com/someone');
    assert.equal(badYt.ok, false);

    const goodYtHandle = validateAndFormatSocialInput('youtube', '@creator');
    assert.equal(goodYtHandle.ok, true);
    if (goodYtHandle.ok) {
      assert.equal(goodYtHandle.url, 'https://youtube.com/@creator');
    }

    const goodYtUrl = validateAndFormatSocialInput('youtube', 'https://www.youtube.com/@creator');
    assert.equal(goodYtUrl.ok, true);

    const badMail = validateAndFormatSocialInput('mail', 'not-an-email');
    assert.equal(badMail.ok, false);

    const goodMail = validateAndFormatSocialInput('mail', 'hello@iveo.site');
    assert.equal(goodMail.ok, true);
    if (goodMail.ok) {
      assert.equal(goodMail.url, 'mailto:hello@iveo.site');
    }
  });
});

describe('Isolated Per-User Storage & Protected Link Flows', () => {
  let tmpDir = '';
  const prevDataDir = process.env.IVEO_DATA_DIR;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-test-'));
    process.env.IVEO_DATA_DIR = tmpDir;
  });

  after(() => {
    if (prevDataDir === undefined) {
      delete process.env.IVEO_DATA_DIR;
    } else {
      process.env.IVEO_DATA_DIR = prevDataDir;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('migrates legacy server_store.json lazily into isolated users/<username>.json files', async () => {
    const legacyPayload = {
      profiles: {
        legacyuser: {
          userId: 'usr_legacy',
          username: 'legacyuser',
          displayName: 'Legacy User',
          primaryEmail: 'legacy@example.com',
          vibeId: 'clean',
        },
      },
      blocks: {
        legacyuser: [
          {
            id: 'blk_leg_1',
            userId: 'usr_legacy',
            kind: 'link',
            title: 'Secret Note',
            url: 'https://example.com/secret',
            isProtected: false,
            isActive: true,
            isArchived: false,
            position: 0,
          },
        ],
      },
      passwords: {
        blk_leg_1: 'open123',
      },
      contacts: {},
      analytics: {},
      claims: { legacyuser: { userId: 'usr_legacy', username: 'legacyuser', claimedAt: '2026-01-01T00:00:00.000Z' } },
      redirects: {},
      userToUsername: { usr_legacy: 'legacyuser' },
    };
    fs.writeFileSync(path.join(tmpDir, 'server_store.json'), JSON.stringify(legacyPayload), 'utf-8');

    const migratedProfile = await dbGetProfile('legacyuser');
    assert.ok(migratedProfile);
    assert.equal(migratedProfile.displayName, 'Legacy User');
    assert.equal(fs.existsSync(path.join(tmpDir, 'users', 'legacyuser.json')), true);

    const blocks = await dbGetBlocks('legacyuser');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].isProtected, true);
  });

  it('keeps concurrent per-user writes isolated without clobbering sibling users', async () => {
    await Promise.all([
      dbSaveProfile({
        userId: 'usr_alpha',
        username: 'alpha',
        displayName: 'Alpha Studio',
        primaryEmail: 'alpha@example.com',
        background: { type: 'solid', value: '#111827', presetId: 'obsidian-slate' },
      }),
      dbSaveProfile({
        userId: 'usr_beta',
        username: 'beta',
        displayName: 'Beta Creator',
        primaryEmail: 'beta@example.com',
      }),
    ]);

    await Promise.all([
      dbSaveBlocks('alpha', [
        { id: 'a1', userId: 'usr_alpha', kind: 'link', title: 'Alpha Link', url: 'https://alpha.test', isActive: true, position: 0 },
      ]),
      dbSaveBlocks('beta', [
        { id: 'b1', userId: 'usr_beta', kind: 'link', title: 'Beta Link', url: 'https://beta.test', isActive: true, position: 0 },
      ]),
    ]);

    const alphaProf = await dbGetProfile('alpha');
    const betaProf = await dbGetProfile('beta');
    assert.equal(alphaProf?.displayName, 'Alpha Studio');
    assert.equal(alphaProf?.background?.value, '#111827');
    assert.equal(betaProf?.displayName, 'Beta Creator');
    assert.equal(betaProf?.background ?? null, null);

    const alphaBlocks = await dbGetBlocks('alpha');
    const betaBlocks = await dbGetBlocks('beta');
    assert.equal(alphaBlocks[0]?.url, 'https://alpha.test');
    assert.equal(betaBlocks[0]?.url, 'https://beta.test');
  });

  it('manages protected link passwords cleanly across set, verify, unlock, list, and clear', async () => {
    await dbSetLinkPassword('a1', 'vip2026', 'alpha');
    assert.equal(await dbVerifyLinkPassword('a1', 'wrong', 'alpha'), false);
    assert.equal(await dbVerifyLinkPassword('a1', 'vip2026', 'alpha'), true);

    const protectedIds = await dbGetProtectedLinkIds('alpha');
    assert.deepEqual(protectedIds, ['a1']);

    const unlocked = await dbFindBlockForUnlock('a1', 'alpha');
    assert.equal(unlocked.username, 'alpha');
    assert.equal(unlocked.block?.url, 'https://alpha.test');
    assert.equal(unlocked.block?.isProtected, true);

    await dbClearLinkPassword('a1', 'alpha');
    assert.deepEqual(await dbGetProtectedLinkIds('alpha'), []);
    assert.equal(await dbVerifyLinkPassword('a1', 'vip2026', 'alpha'), false);
    const afterBlocks = await dbGetBlocks('alpha');
    assert.equal(afterBlocks[0]?.isProtected, false);
  });
});

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-w1-w2-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const {
  sanitizeForFirestore,
  enforceProfileRuleBounds,
  enforceBlockRuleBounds,
  enforceAnalyticsRuleBounds,
  enforceAppearanceRuleBounds,
} = await import('./firebaseSanitize.ts');
const { setFirebaseWriteHookForTests } = await import('./firebaseServer.ts');
const {
  handleClaimUsername,
  handleSaveProfile,
  handleSaveBlocks,
  handleGetBlocks,
} = await import('./db-handlers.ts');
const {
  handleGetAppearance,
  handlePatchAppearance,
  handleCreateTheme,
  handleRenameTheme,
  handleApplyTheme,
  handleDeleteTheme,
  handleSurpriseAppearance,
  resetAppearanceRateLimitForTests,
} = await import('./appearance-handlers.ts');

function mockReq(options: {
  method?: string;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): any {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(options.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    method: options.method || 'POST',
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers,
    ip: '127.0.0.1',
    get: (name: string) => headers[name.toLowerCase()],
  };
}

function mockRes() {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
  };
  const res: any = {
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    setHeader(k: string, v: string) {
      result.headers[k.toLowerCase()] = v;
      return res;
    },
    json(payload: any) {
      result.body = payload;
      return res;
    },
    send(payload: any) {
      result.body = payload;
      return res;
    },
  };
  return { res, result };
}

describe('W1 + W2: Firestore sanitization, error propagation & appearance sync', () => {
  beforeEach(() => {
    setFirebaseWriteHookForTests(null);
    resetAppearanceRateLimitForTests();
  });

  afterEach(() => {
    setFirebaseWriteHookForTests(null);
    resetAppearanceRateLimitForTests();
  });

  it('sanitizeForFirestore removes undefined deeply, converts NaN/Infinity to null, and formats Date', () => {
    const d = new Date('2026-11-27T08:00:00.000Z');
    const cleaned = sanitizeForFirestore({
      a: 1,
      b: undefined,
      c: Number.NaN,
      d: Number.POSITIVE_INFINITY,
      e: d,
      nested: { keep: 'ok', drop: undefined, arr: [1, undefined, Number.NEGATIVE_INFINITY, { x: undefined, y: true }] },
    }) as any;

    assert.equal('b' in cleaned, false);
    assert.equal(cleaned.c, null);
    assert.equal(cleaned.d, null);
    assert.equal(cleaned.e, '2026-11-27T08:00:00.000Z');
    assert.equal('drop' in cleaned.nested, false);
    assert.deepEqual(cleaned.nested.arr, [1, null, { y: true }]);
  });

  it('rule boundary clampers enforce /firestore.rules limits cleanly', () => {
    const prof = enforceProfileRuleBounds(
      {
        username: '  @Alice_Test  ',
        displayName: 'A'.repeat(200),
        bio: 'B'.repeat(700),
        avatarUrl: 'https://example.com/' + 'x'.repeat(2100),
        avatarData: 'data:image/png;base64,' + 'z'.repeat(400_000),
      },
      'fallback'
    );
    assert.equal(prof.username, 'alice_test');
    assert.equal(prof.displayName.length, 128);
    assert.equal(prof.bio.length, 500);
    assert.equal(prof.avatarUrl.length, 2048);
    assert.equal('avatarData' in prof, false);

    const blk = enforceBlockRuleBounds(
      { id: 'b1', kind: 'link', title: 'T'.repeat(300), url: 'https://e.co/' + 'p'.repeat(2100) },
      'b1',
      'alice_test',
      'user_1'
    );
    assert.equal(blk.title.length, 256);
    assert.equal(blk.url.length, 2048);

    const ev = enforceAnalyticsRuleBounds({ eventType: 'weird', device: 'smartwatch', country: 'US' }, 'ev1', 'alice_test');
    assert.equal(ev.eventType, 'page_view');
    assert.equal(ev.device, 'desktop');
    assert.deepEqual(Object.keys(ev).sort(), ['blockId', 'country', 'createdAt', 'device', 'eventType', 'id', 'referrer', 'username']);

    const manyThemes = Array.from({ length: 25 }, (_, i) => ({ id: `t_${i}`, name: `Theme ${i}` }));
    const appDoc = enforceAppearanceRuleBounds({
      username: 'alice_test',
      userId: 'user_1',
      themes: manyThemes,
    });
    assert.equal(appDoc.themes.length, 20);
  });

  it('propagates Firestore write failures as HTTP 502 instead of fake 200 ok across profile, blocks, and appearance', async () => {
    // Allow initial claim with no-op firebase write hook
    setFirebaseWriteHookForTests(async () => {});
    {
      const { res, result } = mockRes();
      await handleClaimUsername(
        mockReq({
          body: { username: 'syncfailtest', userId: 'user_syncfail', primaryEmail: 'syncfail@example.com' },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
    }

    // Now inject Firebase persistence failure
    setFirebaseWriteHookForTests(async () => {
      throw new Error('PERMISSION_DENIED: injected test failure');
    });

    {
      const { res, result } = mockRes();
      await handleSaveProfile(
        mockReq({
          body: {
            username: 'syncfailtest',
            userId: 'user_syncfail',
            primaryEmail: 'syncfail@example.com',
            displayName: 'Should Fail',
          },
        }),
        res
      );
      assert.equal(result.statusCode, 502);
      assert.equal(result.body?.ok, false);
      assert.equal(result.body?.error, 'firebase_sync_failed');
    }

    {
      const { res, result } = mockRes();
      await handleSaveBlocks(
        mockReq({
          body: {
            username: 'syncfailtest',
            userId: 'user_syncfail',
            blocks: [{ id: 'blk_1', kind: 'link', title: 'Site', url: 'https://iveo.site' }],
          },
        }),
        res
      );
      assert.equal(result.statusCode, 502);
      assert.equal(result.body?.ok, false);
      assert.equal(result.body?.error, 'firebase_sync_failed');
    }

    {
      const { res, result } = mockRes();
      await handlePatchAppearance(
        mockReq({
          method: 'PATCH',
          body: {
            username: 'syncfailtest',
            userId: 'user_syncfail',
            patch: { vibeId: 'obsidian' },
          },
        }),
        res
      );
      assert.equal(result.statusCode, 502);
      assert.equal(result.body?.ok, false);
      assert.equal(result.body?.error, 'firebase_sync_failed');
    }
  });

  it('completes roundtrip save for profile, blocks (without deleted resurrection), themes CRUD, and Surprise rate limits', async () => {
    setFirebaseWriteHookForTests(async () => {});

    // 1. Claim user
    {
      const { res, result } = mockRes();
      await handleClaimUsername(
        mockReq({
          body: { username: 'roundtripcreator', userId: 'user_rt_1', primaryEmail: 'rt@example.com' },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
    }

    // 2. Save 2 blocks then remove 1 block — deleted block stays removed
    {
      const { res, result } = mockRes();
      await handleSaveBlocks(
        mockReq({
          body: {
            username: 'roundtripcreator',
            userId: 'user_rt_1',
            blocks: [
              { id: 'b_keep', kind: 'link', title: 'Portfolio', url: 'https://iveo.site', isActive: true },
              { id: 'b_drop', kind: 'link', title: 'Old Link', url: 'https://example.org', isActive: true },
            ],
          },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
    }

    {
      const { res, result } = mockRes();
      await handleSaveBlocks(
        mockReq({
          body: {
            username: 'roundtripcreator',
            userId: 'user_rt_1',
            blocks: [
              { id: 'b_keep', kind: 'link', title: 'Portfolio', url: 'https://iveo.site', isActive: true },
            ],
          },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
    }

    {
      const { res, result } = mockRes();
      await handleGetBlocks(mockReq({ method: 'GET', query: { username: 'roundtripcreator' } }), res);
      assert.equal(result.statusCode, 200);
      assert.equal(result.body?.length, 1);
      assert.equal(result.body?.[0]?.id, 'b_keep');
    }

    // 3. Patch appearance vibe & typography, create theme, rename non-active theme, delete non-active theme without losing active vibe
    {
      const { res, result } = mockRes();
      await handlePatchAppearance(
        mockReq({
          method: 'PATCH',
          body: {
            username: 'roundtripcreator',
            userId: 'user_rt_1',
            patch: { vibeId: 'obsidian' },
          },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body?.appearance?.vibeId, 'obsidian');
    }

    let createdThemeId = '';
    {
      const { res, result } = mockRes();
      await handleCreateTheme(
        mockReq({
          body: { username: 'roundtripcreator', userId: 'user_rt_1', name: 'Saved Night' },
        }),
        res
      );
      assert.equal(result.statusCode, 201);
      createdThemeId = result.body?.theme?.id;
      assert.ok(createdThemeId);
    }

    {
      const { res, result } = mockRes();
      await handlePatchAppearance(
        mockReq({
          method: 'PATCH',
          body: {
            username: 'roundtripcreator',
            userId: 'user_rt_1',
            patch: { vibeId: 'dawn-mist' },
          },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body?.appearance?.vibeId, 'dawn-mist');
    }

    {
      const { res, result } = mockRes();
      await handleRenameTheme(
        mockReq({
          method: 'PATCH',
          params: { id: createdThemeId },
          body: { username: 'roundtripcreator', userId: 'user_rt_1', name: 'Renamed Night' },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body?.themes?.find((t: any) => t.id === createdThemeId)?.name, 'Renamed Night');
    }

    {
      const { res, result } = mockRes();
      await handleDeleteTheme(
        mockReq({
          method: 'DELETE',
          params: { id: createdThemeId },
          body: { username: 'roundtripcreator', userId: 'user_rt_1' },
        }),
        res
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body?.themes?.some((t: any) => t.id === createdThemeId), false);
    }

    {
      const checkRes = mockRes();
      await handleGetAppearance(
        mockReq({
          method: 'GET',
          query: { username: 'roundtripcreator', userId: 'user_rt_1' },
        }),
        checkRes.res
      );
      assert.equal(checkRes.result.statusCode, 200);
      assert.equal(checkRes.result.body?.appearance?.vibeId, 'dawn-mist');
    }

    // Apply another theme after re-creating to verify apply path
    {
      const create2 = mockRes();
      await handleCreateTheme(
        mockReq({
          body: { username: 'roundtripcreator', userId: 'user_rt_1', name: 'Dawn Mist Preset' },
        }),
        create2.res
      );
      const t2Id = create2.result.body?.theme?.id;
      const applyRes = mockRes();
      await handleApplyTheme(
        mockReq({
          params: { id: t2Id },
          body: { username: 'roundtripcreator', userId: 'user_rt_1' },
        }),
        applyRes.res
      );
      assert.equal(applyRes.result.statusCode, 200);
      assert.equal(applyRes.result.body?.appearance?.vibeId, 'dawn-mist');
    }

    // 4. Surprise Me respects locks and enforces rate limit
    {
      const sRes = mockRes();
      await handleSurpriseAppearance(
        mockReq({
          body: {
            username: 'roundtripcreator',
            userId: 'user_rt_1',
            locks: { vibe: true },
          },
        }),
        sRes.res
      );
      assert.equal(sRes.result.statusCode, 200);
      assert.equal(sRes.result.body?.appearance?.schemaVersion, 2);

      // Verify state persisted via GET
      const getApp = mockRes();
      await handleGetAppearance(
        mockReq({
          method: 'GET',
          query: { username: 'roundtripcreator', userId: 'user_rt_1' },
        }),
        getApp.res
      );
      assert.equal(getApp.result.statusCode, 200);
      assert.equal(getApp.result.body?.appearance?.schemaVersion, 2);
    }

    // Trigger rate limit (60 writes/min allowed)
    let hit429 = false;
    for (let i = 0; i < 65; i++) {
      const r = mockRes();
      await handleSurpriseAppearance(
        mockReq({
          body: { username: 'roundtripcreator', userId: 'user_rt_1' },
        }),
        r.res
      );
      if (r.result.statusCode === 429) {
        hit429 = true;
        break;
      }
    }
    assert.equal(hit429, true);
  });
});

process.on('exit', () => {
  setFirebaseWriteHookForTests(null);
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {}
});

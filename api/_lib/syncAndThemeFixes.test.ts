import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-sync-theme-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const { mergeProfileForSave } = await import('./profileMerge.ts');
const {
  dbGetProfile,
  dbSaveProfile,
  dbSaveBlocks,
  dbGetBlockSyncMeta,
  dbWriteAppearanceState,
} = await import('./azureSql.ts');
const { loadPublicPage } = await import('./publicPage.ts');
const {
  handleGetAppearance,
  handlePatchAppearance,
  handleCreateTheme,
  handleRenameTheme,
  handleDeleteTheme,
  handleApplyTheme,
  handleSurpriseAppearance,
  handleAppearanceSuggestions,
  handleRegenerateAppearance,
  resetAppearanceRateLimitForTests,
} = await import('./appearance-handlers.ts');
const { adminInspectBilling, adminReconcileBilling } = await import('./billingService.ts');
const {
  handleGetBlocks,
  handleGetPublicPage,
  handleSaveProfile,
  handleSeoAdminModerateBackground,
  handleOAuthStatus,
  handleSocialOAuthUrl,
} = await import('./db-handlers.ts');

function createMockRes() {
  const headers: Record<string, string> = {};
  const state: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.body = payload;
      return res;
    },
    getHeaders() {
      return headers;
    },
    get state() {
      return state;
    },
  };
  return res;
}

function makeReq(opts: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}) {
  return {
    headers: opts.headers || {},
    query: opts.query || {},
    params: opts.params || {},
    body: opts.body || {},
  } as any;
}

describe('Sync, Owner SEO/Billing, and Theme Save/Apply Fixes', () => {
  after(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    resetAppearanceRateLimitForTests();
    for (const uname of ['synccreator', 'billingcreator']) {
      await dbWriteAppearanceState(uname, () => ({
        nextProfile: null,
        nextHistory: { undoStack: [], redoStack: [], lastCoalesceKey: null, lastCoalesceAt: 0 },
        nextThemes: [],
        result: true,
      }));
    }

    await dbSaveProfile({
      userId: 'user-sync-1',
      username: 'synccreator',
      primaryEmail: 'sync@example.com',
      displayName: 'Sync Creator',
      bio: 'Original bio text',
      socials: { instagram: 'https://instagram.com/synccreator' },
      vibeId: 'clean',
      plan: 'pro',
    });

    await dbSaveProfile({
      userId: 'user-bill-1',
      username: 'billingcreator',
      primaryEmail: 'billing@example.com',
      displayName: 'Billing Creator',
      bio: 'Billing test creator',
      vibeId: 'clean',
      plan: 'free',
      createdAt: '2027-02-01T00:00:00.000Z',
    });
  });

  it('mergeProfileForSave honors explicit incoming.updatedAt and preserves existing profile fields', () => {
    const existing = {
      userId: 'user-sync-1',
      username: 'synccreator',
      displayName: 'Sync Creator',
      bio: 'Original bio text',
      socials: { instagram: 'https://instagram.com/synccreator' },
      vibeId: 'clean',
      plan: 'pro',
    };
    const explicitTs = '2026-11-23T12:34:56.789Z';
    const merged = mergeProfileForSave(
      existing,
      {
        userId: 'user-sync-1',
        username: 'synccreator',
        vibeId: 'obsidian',
        updatedAt: explicitTs,
      },
      false
    );

    assert.equal(merged.updatedAt, explicitTs);
    assert.equal(merged.displayName, 'Sync Creator');
    assert.equal(merged.bio, 'Original bio text');
    assert.deepEqual(merged.socials, { instagram: 'https://instagram.com/synccreator' });
    assert.equal(merged.vibeId, 'obsidian');
  });

  it('dbSaveBlocks updates profile updatedAt and loadPublicPage reflects fresh profile', async () => {
    const before = await dbGetProfile('synccreator');
    const prevUpdatedAt = before?.updatedAt || '';

    await new Promise((r) => setTimeout(r, 15));
    await dbSaveBlocks('synccreator', [
      {
        id: 'blk-1',
        userId: 'user-sync-1',
        kind: 'link',
        title: 'My New Link',
        url: 'https://example.com',
        isActive: true,
        isArchived: false,
        position: 0,
      },
    ]);

    const after = await dbGetProfile('synccreator');
    assert.ok((after?.updatedAt || '') > prevUpdatedAt, 'dbSaveBlocks should advance profile.updatedAt');

    const pub = await loadPublicPage('synccreator');
    assert.ok(pub);
    assert.equal(pub?.displayName, 'Sync Creator');
    assert.equal(pub?.updatedAt, after?.updatedAt);
  });

  it('PATCH /api/appearance preserves non-appearance fields and avoids false 409 conflicts', async () => {
    const h = { 'x-user-id': 'user-sync-1', 'x-user-email': 'sync@example.com' };
    const getRes = createMockRes();
    await handleGetAppearance(makeReq({ headers: h, query: { username: 'synccreator' } }), getRes);
    assert.equal(getRes.state.statusCode, 200);
    const ts1 = getRes.state.body.updatedAt;

    const patch1 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          expectedUpdatedAt: ts1,
          patch: {
            vibeId: 'obsidian',
            background: { type: 'solid', color: '#111827' },
          },
        },
      }),
      patch1
    );
    assert.equal(patch1.state.statusCode, 200);
    const ts2 = patch1.state.body.updatedAt;
    assert.ok(ts2);

    // Sequential update using confirmed updatedAt succeeds without 409
    const patch2 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          expectedUpdatedAt: ts2,
          patch: {
            buttons: { shape: 'pill' },
          },
        },
      }),
      patch2
    );
    assert.equal(patch2.state.statusCode, 200);
    assert.equal(patch2.state.body.appearance.buttons.shape, 'pill');

    // Non-appearance profile fields remain completely intact
    const saved = await dbGetProfile('synccreator');
    assert.equal(saved?.displayName, 'Sync Creator');
    assert.equal(saved?.bio, 'Original bio text');
    assert.deepEqual(saved?.socials, { instagram: 'https://instagram.com/synccreator' });
  });

  it('POST /api/appearance/themes captures submitted appearance draft and apply activates it', async () => {
    const h = { 'x-user-id': 'user-sync-1', 'x-user-email': 'sync@example.com' };

    const getRes = createMockRes();
    await handleGetAppearance(makeReq({ headers: h, query: { username: 'synccreator' } }), getRes);
    const baseAppearance = getRes.state.body.appearance;

    // Save custom theme passing draft appearance directly in body
    const createRes = createMockRes();
    await handleCreateTheme(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          name: 'Midnight Brand',
          appearance: {
            ...baseAppearance,
            vibeId: 'obsidian',
            background: { type: 'solid', color: '#0B1120' },
            buttons: { ...baseAppearance.buttons, shape: 'square', fill: '#38BDF8', text: '#0B1120' },
          },
        },
      }),
      createRes
    );
    assert.equal(createRes.state.statusCode, 201);
    const createdTheme = createRes.state.body.theme;
    assert.equal(createdTheme.name, 'Midnight Brand');
    assert.equal(createdTheme.data.background.color, '#0B1120');
    assert.equal(createdTheme.data.buttons.shape, 'square');

    // Change live profile to another vibe first
    const switchRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          patch: {
            vibeId: 'porcelain',
            background: { type: 'solid', color: '#FFFFFF' },
            buttons: { shape: 'pill' },
          },
        },
      }),
      switchRes
    );
    assert.equal(switchRes.state.statusCode, 200);
    assert.equal(switchRes.state.body.appearance.background.color, '#FFFFFF');

    // Apply the saved theme and verify persisted profile reflects Midnight Brand
    const applyRes = createMockRes();
    await handleApplyTheme(
      makeReq({
        headers: h,
        params: { id: createdTheme.id },
        body: { username: 'synccreator' },
      }),
      applyRes
    );
    assert.equal(applyRes.state.statusCode, 200);
    assert.equal(applyRes.state.body.appearance.background.color, '#0B1120');
    assert.equal(applyRes.state.body.appearance.buttons.shape, 'square');

    const profileAfterApply = await dbGetProfile('synccreator');
    assert.equal(profileAfterApply?.vibeId, 'obsidian');
    assert.equal(profileAfterApply?.appearance?.background?.color, '#0B1120');
  });

  it('Owner billing inspect/reconcile updates plan, cycle, grace period, and audit log', async () => {
    const initial = await adminInspectBilling('billingcreator');
    assert.equal(initial.ok, true);
    if (initial.ok) {
      assert.equal(initial.plan, 'free');
    }

    const activated = await adminReconcileBilling({
      adminEmail: 'arjunjareda2007@gmail.com',
      username: 'billingcreator',
      action: 'activate_paid',
      period: 'yearly',
      note: 'Manual verification',
    });
    assert.equal(activated.ok, true);
    if (activated.ok) {
      assert.equal(activated.plan, 'pro');
      assert.equal(activated.subscription?.cycle, 'yearly');
      assert.equal(activated.lifecycleState, 'active');
    }

    const graced = await adminReconcileBilling({
      adminEmail: 'arjunjareda2007@gmail.com',
      username: 'billingcreator',
      action: 'grant_grace_period',
    });
    assert.equal(graced.ok, true);
    if (graced.ok) {
      assert.equal(graced.gracePeriod?.inGracePeriod, true);
    }

    const expired = await adminReconcileBilling({
      adminEmail: 'arjunjareda2007@gmail.com',
      username: 'billingcreator',
      action: 'expire_now',
    });
    assert.equal(expired.ok, true);
    if (expired.ok) {
      assert.equal(expired.plan, 'free');
      assert.equal(expired.lifecycleState, 'expired');
    }
  });

  it('handleSeoAdminModerateBackground resets both legacy background and Appearance v2 background', async () => {
    const h = { 'x-user-id': 'user-sync-1', 'x-user-email': 'sync@example.com' };
    const patchRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          patch: { background: { type: 'solid', color: '#FF0066' } },
        },
      }),
      patchRes
    );
    assert.equal(patchRes.state.statusCode, 200);
    assert.equal(patchRes.state.body.appearance.background.color, '#FF0066');

    const modRes = createMockRes();
    await handleSeoAdminModerateBackground(
      makeReq({
        headers: { 'x-user-email': 'arjunjareda2007@gmail.com' },
        body: { username: 'synccreator' },
      }),
      modRes
    );
    assert.equal(modRes.state.statusCode, 200);
    assert.equal(modRes.state.body.ok, true);

    const afterMod = await dbGetProfile('synccreator');
    assert.equal(afterMod?.appearance?.background?.type, 'solid');
    assert.equal(afterMod?.appearance?.background?.color, '#FFFFFF');
  });

  it('deleting all blocks records blocksInitialized and deletedBlockIds so blocks stay empty', async () => {
    await dbSaveBlocks('synccreator', [
      {
        id: 'blk-delete-me',
        userId: 'user-sync-1',
        kind: 'link',
        title: 'Temporary Link',
        url: 'https://example.com',
        isActive: true,
        isArchived: false,
        position: 0,
      },
    ]);

    await dbSaveBlocks('synccreator', []);
    const meta = await dbGetBlockSyncMeta('synccreator');
    assert.equal(meta.blocksInitialized, true);
    assert.equal(meta.deletedBlockIds.has('blk-delete-me'), true);

    const blocksRes = createMockRes();
    await handleGetBlocks(makeReq({ query: { username: 'synccreator' } }), blocksRes);
    assert.equal(blocksRes.state.statusCode, 200);
    assert.deepEqual(blocksRes.state.body, []);

    const pubRes = createMockRes();
    await handleGetPublicPage(makeReq({ query: { u: 'synccreator', _t: '1' } }), pubRes);
    assert.equal(pubRes.state.statusCode, 200);
    assert.deepEqual(pubRes.state.body.links, []);
  });

  it('delta POST /api/profile update preserves newer Appearance v2 and renames/deletes saved themes', async () => {
    const h = { 'x-user-id': 'user-sync-1', 'x-user-email': 'sync@example.com' };

    const patchRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'synccreator',
          patch: {
            vibeId: 'obsidian',
            background: { type: 'solid', color: '#09090B' },
          },
        },
      }),
      patchRes
    );
    assert.equal(patchRes.state.statusCode, 200);

    // Send a delta profile update containing only bio & socials (omitting appearance)
    const profRes = createMockRes();
    await handleSaveProfile(
      makeReq({
        headers: h,
        body: {
          userId: 'user-sync-1',
          username: 'synccreator',
          bio: 'Updated creator bio',
          socials: { github: 'https://github.com/synccreator' },
        },
      }),
      profRes
    );
    assert.equal(profRes.state.statusCode, 200);

    const afterProfileSave = await dbGetProfile('synccreator');
    assert.equal(afterProfileSave?.bio, 'Updated creator bio');
    assert.equal(afterProfileSave?.appearance?.background?.color, '#09090B');
    assert.equal(afterProfileSave?.vibeId, 'obsidian');

    // Create, rename, then delete a theme
    const createRes = createMockRes();
    await handleCreateTheme(
      makeReq({ headers: h, body: { username: 'synccreator', name: 'Draft One' } }),
      createRes
    );
    assert.equal(createRes.state.statusCode, 201);
    const themeId = createRes.state.body.theme.id;

    const renameRes = createMockRes();
    await handleRenameTheme(
      makeReq({
        headers: h,
        params: { id: themeId },
        query: { username: 'synccreator' },
        body: { name: 'Renamed Theme' },
      }),
      renameRes
    );
    assert.equal(renameRes.state.statusCode, 200);
    assert.equal(renameRes.state.body.theme.name, 'Renamed Theme');

    const delRes = createMockRes();
    await handleDeleteTheme(
      makeReq({
        headers: h,
        params: { id: themeId },
        query: { username: 'synccreator' },
      }),
      delRes
    );
    assert.equal(delRes.state.statusCode, 200);
    assert.equal(delRes.state.body.themes.length, 0);
  });

  it('POST /api/appearance/surprise & regenerate respect locks, Pro/Free tier, and unique signatures', async () => {
    const proHeaders = { 'x-user-id': 'user-sync-1', 'x-user-email': 'sync@example.com' };

    const getRes = createMockRes();
    await handleGetAppearance(makeReq({ headers: proHeaders, query: { username: 'synccreator' } }), getRes);
    const current = getRes.state.body.appearance;

    const surpriseRes = createMockRes();
    await handleSurpriseAppearance(
      makeReq({
        headers: proHeaders,
        body: {
          username: 'synccreator',
          current,
          locks: ['font.name', 'font.bio', 'background'],
          bio: 'Creative technologist & designer',
          recent: [],
        },
      }),
      surpriseRes
    );
    assert.equal(surpriseRes.state.statusCode, 200);
    assert.equal(surpriseRes.state.body.ok, true);
    assert.equal(surpriseRes.state.body.tier, 'pro');
    assert.ok(surpriseRes.state.body.appearance);
    assert.ok(surpriseRes.state.body.signature);
    // Locked typography must preserve current font settings
    assert.equal(
      surpriseRes.state.body.appearance.typography.name.family,
      current.typography.name.family
    );
    assert.equal(
      surpriseRes.state.body.appearance.typography.bio.family,
      current.typography.bio.family
    );

    const suggRes = createMockRes();
    await handleAppearanceSuggestions(
      makeReq({
        headers: proHeaders,
        query: { username: 'synccreator', section: 'vibe', count: '5' },
      }),
      suggRes
    );
    assert.equal(suggRes.state.statusCode, 200);
    assert.equal(suggRes.state.body.ok, true);
    assert.equal(suggRes.state.body.items.length, 5);

    // Unauthenticated demo mode runs strictly as Free tier
    const freeRes = createMockRes();
    await handleRegenerateAppearance(
      makeReq({
        body: {
          section: 'all',
          recent: [],
        },
      }),
      freeRes
    );
    assert.equal(freeRes.state.statusCode, 200);
    assert.equal(freeRes.state.body.tier, 'free');
    assert.ok(Array.isArray(freeRes.state.body.items) && freeRes.state.body.items.length > 0);
    for (const item of freeRes.state.body.items) {
      assert.ok(item.appearance);
      assert.notEqual(item.appearance.background.type, 'animated');
    }
  });

  it('OAuth status and social OAuth URL return clean structured status when server OAuth is unconfigured', async () => {
    const statusRes = createMockRes();
    await handleOAuthStatus(makeReq({}), statusRes);
    assert.equal(statusRes.state.statusCode, 200);
    assert.equal(statusRes.state.body.ok, true);
    assert.equal(typeof statusRes.state.body.providers.linkedin, 'boolean');

    const prevId = process.env.LINKEDIN_CLIENT_ID;
    const prevSecret = process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;

    try {
      const urlRes = createMockRes();
      await handleSocialOAuthUrl(
        makeReq({ query: { provider: 'linkedin', origin: 'https://iveo.site' } }),
        urlRes
      );
      assert.equal(urlRes.state.statusCode, 503);
      assert.equal(urlRes.state.body.ok, false);
      assert.equal(urlRes.state.body.error, 'oauth_not_configured');
    } finally {
      if (prevId !== undefined) process.env.LINKEDIN_CLIENT_ID = prevId;
      if (prevSecret !== undefined) process.env.LINKEDIN_CLIENT_SECRET = prevSecret;
    }
  });
});

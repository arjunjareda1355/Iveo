import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-lifecycle-gsc-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const {
  dbClaimUsername,
  dbGetProfile,
  dbSaveProfile,
  dbSaveBlocks,
  dbGetBlocks,
  dbSetLinkPassword,
  dbGetRedirectTarget,
  dbWriteAppearanceState,
  purgeExpiredDeletedAccounts,
} = await import('./azureSql.ts');
const { loadPublicPage } = await import('./publicPage.ts');
const { saveUploadedBackgroundImage, getBackgroundsBaseDir } = await import('./backgroundUpload.ts');
const {
  handlePatchAppearance,
  handleCreateTheme,
  resetAppearanceRateLimitForTests,
} = await import('./appearance-handlers.ts');
const {
  handleGetPublicPage,
  handleGetMe,
  handleDeleteAccount,
  handleSeoAdminGetGscConfig,
  handleSeoAdminSaveGscConfig,
  handleSeoAdminDeleteGscConfig,
} = await import('./db-handlers.ts');
const { GET: checkUsernameGet } = await import('../check-username.ts');
const {
  getGscSafeConfigSummary,
  parseGscServiceAccountCredentials,
  saveGscRuntimeConfig,
  clearGscRuntimeConfig,
  clearGscCachesForTest,
} = await import('./searchEngines.ts');

const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII=';

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

function writeJsonFile(filePath: string, data: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readJsonFile(filePath: string, fallback: any = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

describe('Account Lifecycle (3-Day Grace, Re-Login, Permanent Purge), Orphan Pruning & GSC Config', () => {
  after(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    resetAppearanceRateLimitForTests();
    clearGscCachesForTest();
    clearGscRuntimeConfig();
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  it('soft-deletes account for 3 days (page offline + username locked), restores on login within 3 days, and permanently purges after 3 days', async () => {
    const handle = 'gracecreator';
    const uid = 'user-grace-1';
    const email = 'grace@example.com';

    await dbClaimUsername(
      uid,
      handle,
      { displayName: 'Grace Creator', vibeId: 'clean' },
      email
    );
    await dbSaveProfile({
      userId: uid,
      username: handle,
      primaryEmail: email,
      displayName: 'Grace Creator',
      bio: 'Hello world from Grace',
      vibeId: 'porcelain',
    });
    await dbSaveBlocks(handle, [
      {
        id: 'blk-grace-1',
        userId: uid,
        kind: 'link',
        title: 'Grace Portfolio',
        url: 'https://example.com/grace',
        isActive: true,
        position: 0,
      },
    ]);
    await dbSetLinkPassword('blk-grace-1', 'secret123', handle);

    // Add a legacy rename redirect pointing to gracecreator + uploaded assets
    writeJsonFile(path.join(TEMP_DIR, 'index_redirects.json'), {
      oldgrace: handle,
    });
    const avatarFile = path.join(TEMP_DIR, 'avatars', `${handle}.png`);
    fs.mkdirSync(path.dirname(avatarFile), { recursive: true });
    fs.writeFileSync(avatarFile, 'avatar-bytes');
    const bgSave = saveUploadedBackgroundImage(handle, TINY_PNG_BASE64);
    assert.equal(bgSave.ok, true);
    const bannerDir = path.join(TEMP_DIR, 'card-banners', handle);
    fs.mkdirSync(bannerDir, { recursive: true });
    fs.writeFileSync(path.join(bannerDir, 'banner.png'), 'banner-bytes');

    // 1. Soft delete via HTTP handler
    const delRes = createMockRes();
    await handleDeleteAccount(
      makeReq({
        headers: { 'x-user-id': uid, 'x-user-email': email },
        body: { userId: uid, username: handle, email },
      }),
      delRes
    );
    assert.equal(delRes.state.statusCode, 200);
    assert.equal(delRes.state.body.ok, true);
    assert.equal(delRes.state.body.status, 'deleted_pending');
    assert.equal(delRes.state.body.gracePeriodDays, 3);

    // 2. Public page returns 404 confirmed offline
    const pubRes = createMockRes();
    await handleGetPublicPage(makeReq({ query: { u: handle } }), pubRes);
    assert.equal(pubRes.state.statusCode, 404);
    assert.equal(pubRes.state.body.confirmed, true);
    assert.equal(pubRes.state.body.status, 'deleted_pending');
    assert.equal(await loadPublicPage(handle), null);

    // 3. Other user cannot check-username as available or claim during 3-day grace lock
    const checkOtherRes = await checkUsernameGet(
      new Request(`http://localhost/api/check-username?u=${handle}&userId=other-user-999`)
    );
    const checkOtherJson: any = await checkOtherRes.json();
    assert.equal(checkOtherJson.available, false);

    const claimOther = await dbClaimUsername(
      'other-user-999',
      handle,
      {},
      'other@example.com'
    );
    assert.equal(claimOther.ok, false);
    assert.equal(claimOther.error, 'already_claimed');

    // 4. Re-login within 3 days via handleGetMe cancels deletion & restores page + blocks
    const meRes = createMockRes();
    await handleGetMe(
      makeReq({
        query: { userId: uid, email },
      }),
      meRes
    );
    assert.equal(meRes.state.statusCode, 200);
    assert.equal(meRes.state.body.claimed, true);
    assert.equal(meRes.state.body.reactivated, true);
    assert.equal(meRes.state.body.profile.status, 'active');

    const restoredPub = await loadPublicPage(handle);
    assert.ok(restoredPub);
    assert.equal(restoredPub.displayName, 'Grace Creator');
    const restoredBlocks = await dbGetBlocks(handle);
    assert.equal(restoredBlocks.length, 1);
    assert.equal(restoredBlocks[0].title, 'Grace Portfolio');

    // 5. Delete again and simulate 3 days having elapsed
    const delRes2 = createMockRes();
    await handleDeleteAccount(
      makeReq({
        headers: { 'x-user-id': uid, 'x-user-email': email },
        body: { userId: uid, username: handle, email },
      }),
      delRes2
    );
    assert.equal(delRes2.state.statusCode, 200);

    const pastIso = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const expiredPurgeIso = new Date(Date.now() - 60 * 1000).toISOString();
    const userJsonPath = path.join(TEMP_DIR, 'users', `${handle}.json`);
    const userStore = readJsonFile(userJsonPath);
    userStore.profile.deletedAt = pastIso;
    userStore.profile.purgeAt = expiredPurgeIso;
    writeJsonFile(userJsonPath, userStore);

    const claimsIdx = readJsonFile(path.join(TEMP_DIR, 'index_claims.json'));
    if (claimsIdx[handle]) {
      claimsIdx[handle].deletedAt = pastIso;
      claimsIdx[handle].purgeAt = expiredPurgeIso;
      writeJsonFile(path.join(TEMP_DIR, 'index_claims.json'), claimsIdx);
    }

    const purgeResult = await purgeExpiredDeletedAccounts();
    assert.ok(purgeResult.purged.includes(handle));

    // Verify complete data removal
    assert.equal(fs.existsSync(userJsonPath), false);
    assert.equal(await dbGetProfile(handle), null);
    assert.equal((await dbGetBlocks(handle)).length, 0);
    assert.equal(await dbGetRedirectTarget('oldgrace'), null);
    assert.equal(fs.existsSync(avatarFile), false);
    assert.equal(fs.existsSync(path.join(getBackgroundsBaseDir(), handle)), false);
    assert.equal(fs.existsSync(bannerDir), false);
    assert.equal(readJsonFile(path.join(TEMP_DIR, 'index_claims.json'))[handle], undefined);
    assert.equal(readJsonFile(path.join(TEMP_DIR, 'index_users.json'))[uid], undefined);
    assert.equal(readJsonFile(path.join(TEMP_DIR, 'index_passwords.json'))['blk-grace-1'], undefined);

    // 6. Expired login returns claimed: false and new user can claim the handle
    const meExpiredRes = createMockRes();
    await handleGetMe(
      makeReq({
        query: { userId: uid, email },
      }),
      meExpiredRes
    );
    assert.equal(meExpiredRes.state.body.claimed, false);

    const checkAvailableNow = await checkUsernameGet(
      new Request(`http://localhost/api/check-username?u=${handle}&userId=brand-new-user`)
    );
    const availJson: any = await checkAvailableNow.json();
    assert.equal(availJson.available, true);

    const reclaimRes = await dbClaimUsername(
      'brand-new-user',
      handle,
      {},
      'newowner@example.com'
    );
    assert.equal(reclaimRes.ok, true);
  });

  it('immediately syncs appearance vibes to public page and prunes orphaned background files while preserving theme backgrounds', async () => {
    const handle = 'themecreator';
    const uid = 'user-theme-1';

    await dbClaimUsername(
      uid,
      handle,
      { displayName: 'Theme Creator', vibeId: 'clean', plan: 'pro' },
      'theme@example.com'
    );
    await dbSaveProfile({
      userId: uid,
      username: handle,
      primaryEmail: 'theme@example.com',
      displayName: 'Theme Creator',
      plan: 'pro',
      vibeId: 'clean',
    });

    const upload1 = saveUploadedBackgroundImage(handle, TINY_PNG_BASE64);
    const upload2 = saveUploadedBackgroundImage(handle, TINY_PNG_BASE64);
    assert.equal(upload1.ok, true);
    assert.equal(upload2.ok, true);
    if (!upload1.ok || !upload2.ok) return;

    // Set upload1 as active custom image background
    const patch1 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': uid, 'x-iveo-username': handle },
        body: {
          username: handle,
          patch: {
            vibeId: 'porcelain',
            background: {
              type: 'image',
              assetId: upload1.url,
              blur: 0,
              opacity: 100,
              brightness: 100,
              focal: { x: 50, y: 50 },
            },
          },
        },
      }),
      patch1
    );
    assert.equal(patch1.state.statusCode, 200);

    // Save a theme referencing upload1 so upload1 stays protected
    const saveThemeRes = createMockRes();
    await handleCreateTheme(
      makeReq({
        headers: { 'x-user-id': uid, 'x-iveo-username': handle },
        body: {
          username: handle,
          name: 'Saved Upload Theme',
          appearance: patch1.state.body.appearance,
        },
      }),
      saveThemeRes
    );
    assert.equal(saveThemeRes.state.statusCode, 201);

    // Switch active background to upload2, then switch to obsidian solid vibe — upload2 becomes orphaned and must be deleted while upload1 remains!
    const patchMid = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': uid, 'x-iveo-username': handle },
        body: {
          username: handle,
          patch: {
            background: {
              type: 'image',
              assetId: upload2.url,
              blur: 0,
              opacity: 100,
              brightness: 100,
              focal: { x: 50, y: 50 },
            },
          },
        },
      }),
      patchMid
    );
    assert.equal(patchMid.state.statusCode, 200);

    const patch2 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': uid, 'x-iveo-username': handle },
        body: {
          username: handle,
          patch: {
            vibeId: 'obsidian',
            background: { type: 'solid', color: '#0B0B0D' },
          },
        },
      }),
      patch2
    );
    assert.equal(patch2.state.statusCode, 200);
    assert.equal(patch2.state.body.appearance.vibeId, 'obsidian');

    const file1Name = path.basename(upload1.url);
    const file2Name = path.basename(upload2.url);
    const userBgDir = path.join(getBackgroundsBaseDir(), handle);
    assert.equal(fs.existsSync(path.join(userBgDir, file1Name)), true);
    assert.equal(fs.existsSync(path.join(userBgDir, file2Name)), false);

    // Ensure loadPublicPage reflects updated obsidian background & vibe immediately
    const pub = await loadPublicPage(handle);
    assert.ok(pub);
    assert.equal(pub.appearance?.vibeId, 'obsidian');
    assert.equal(pub.vibeId, 'obsidian');
    assert.equal(pub.background?.type, 'solid');
    assert.equal(pub.background?.value, '#0B0B0D');
  });

  it('saves GSC Service Account JSON safely (including literal PEM newlines) and never leaks private_key', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const fakeServiceAccountEmail = 'seo-test@example-project.iam.gserviceaccount.com';
    // Construct pasted JSON string containing literal newlines inside private_key
    const rawJsonWithLiteralNewlines = `{\n  "type": "service_account",\n  "project_id": "example-project",\n  "private_key_id": "abcdef1234567890",\n  "private_key": "${privateKey}",\n  "client_email": "${fakeServiceAccountEmail}"\n}`;

    const saveRes = saveGscRuntimeConfig({
      rawJson: rawJsonWithLiteralNewlines,
      propertyUrl: 'https://iveo.site/',
    });
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.summary.configured, true);
    assert.equal(saveRes.summary.source, 'runtime_file');
    assert.equal(saveRes.summary.clientEmail, fakeServiceAccountEmail);
    assert.equal(saveRes.summary.projectId, 'example-project');
    assert.equal(JSON.stringify(saveRes.summary).includes('BEGIN PRIVATE KEY'), false);

    const parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.creds?.client_email, fakeServiceAccountEmail);
    assert.ok(parsed.creds?.private_key.includes('BEGIN PRIVATE KEY'));

    // HTTP admin handler GET must not expose private key and must forbid non-admin users
    const forbiddenRes = createMockRes();
    await handleSeoAdminGetGscConfig(
      makeReq({ headers: { 'x-user-email': 'random@example.com' } }),
      forbiddenRes
    );
    assert.equal(forbiddenRes.state.statusCode, 403);

    const adminEmail = 'support@iveo.site';
    const okGetRes = createMockRes();
    await handleSeoAdminGetGscConfig(
      makeReq({ query: { adminEmail }, headers: { 'x-user-email': adminEmail } }),
      okGetRes
    );
    assert.equal(okGetRes.state.statusCode, 200);
    assert.equal(okGetRes.state.body.gsc.configured, true);
    assert.equal(JSON.stringify(okGetRes.state.body).includes('BEGIN PRIVATE KEY'), false);

    // Saving via HTTP with test=false saves & returns redacted summary
    const okPostRes = createMockRes();
    await handleSeoAdminSaveGscConfig(
      makeReq({
        query: { adminEmail },
        headers: { 'x-user-email': adminEmail },
        body: {
          rawJson: rawJsonWithLiteralNewlines,
          propertyUrl: 'sc-domain:iveo.site',
          test: false,
        },
      }),
      okPostRes
    );
    assert.equal(okPostRes.state.statusCode, 200);
    assert.equal(okPostRes.state.body.gsc.propertyUrl, 'sc-domain:iveo.site');
    assert.equal(JSON.stringify(okPostRes.state.body).includes('BEGIN PRIVATE KEY'), false);

    // Delete via HTTP clears runtime config
    const okDelRes = createMockRes();
    await handleSeoAdminDeleteGscConfig(
      makeReq({ query: { adminEmail }, headers: { 'x-user-email': adminEmail } }),
      okDelRes
    );
    assert.equal(okDelRes.state.statusCode, 200);
    assert.equal(okDelRes.state.body.gsc.hasSavedFile, false);
    assert.equal(getGscSafeConfigSummary().hasSavedFile, false);
  });
});

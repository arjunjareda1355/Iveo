import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-w1w5-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const {
  buildProfileSeoTitle,
  buildProfileSeoDescription,
} = await import('../../src/lib/seoMeta.ts');
const {
  validateGscPropertyUrlInput,
  validateGscServiceAccountJsonInput,
} = await import('../../src/lib/gscClientValidation.ts');
const { deriveInitialFromBlock } = await import(
  '../../src/lib/platformBlockInit.ts'
);
const {
  encryptIntegrationsJson,
  decryptIntegrationsJson,
  getOrCreateIndexNowKey,
  appendSeoIntegrationEvent,
  listSeoIntegrationEvents,
  clearSeoIntegrationsStoreCacheForTests,
} = await import('./seoIntegrationsStore.ts');
const {
  saveGscRuntimeConfigAsync,
  getGscSafeConfigSummaryAsync,
  validateGscPropertyUrl,
  clearGscCachesForTest,
} = await import('./searchEngines.ts');
const { dbSaveProfile } = await import('./azureSql.ts');
const {
  handleSaveBlocks,
  handleGetBlocks,
  handleGetPublicPage,
  handleSeoMeOverview,
  handleSeoMeSubmit,
  handleSeoAdminOverview,
} = await import('./db-handlers.ts');
const { clearClerkActorCacheForTests } = await import('./clerkAuth.ts');

function createEphemeralServiceAccount(email = 'seo-bot@iveo-test.iam.gserviceaccount.com') {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    type: 'service_account',
    project_id: 'iveo-w4-test',
    private_key_id: 'keyid_1234567890abcdef',
    private_key: pem,
    client_email: email,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

function createMockRes() {
  const headers: Record<string, string> = {};
  const state: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = String(v);
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

describe('W1-W5 Verification: Sync, Section Headers, Social Looks, Encrypted GSC & Scoped SEO', () => {
  const prevEncKey = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  const prevClerkSecret = process.env.CLERK_SECRET_KEY;
  const prevGscJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const prevIndexNowKey = process.env.INDEXNOW_KEY;

  beforeEach(async () => {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    delete process.env.INDEXNOW_KEY;
    process.env.INTEGRATIONS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    clearGscCachesForTest();
    clearSeoIntegrationsStoreCacheForTests();
    clearClerkActorCacheForTests();

    await dbSaveProfile({
      userId: 'user-creator-1',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      displayName: 'Alice',
      bio: 'Creator bio',
      vibeId: 'clean',
      plan: 'free',
    });
    await dbSaveProfile({
      userId: 'user-creator-2',
      username: 'bob',
      primaryEmail: 'bob@example.com',
      displayName: 'Bob',
      bio: 'Bob bio',
      vibeId: 'clean',
      plan: 'free',
    });
  });

  after(() => {
    if (prevEncKey === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    else process.env.INTEGRATIONS_ENCRYPTION_KEY = prevEncKey;
    if (prevClerkSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = prevClerkSecret;
    if (prevGscJson === undefined) delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    else process.env.GSC_SERVICE_ACCOUNT_JSON = prevGscJson;
    if (prevIndexNowKey === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = prevIndexNowKey;
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it('seoMeta avoids duplicated @handle (@handle) descriptions', () => {
    const descNoName = buildProfileSeoDescription({
      username: 'maya',
      displayName: '@maya',
      bio: '',
    });
    assert.ok(!descNoName.includes('@maya (@maya)'), `Unexpected duplication in: ${descNoName}`);

    const descSameName = buildProfileSeoDescription({
      username: 'maya',
      displayName: 'maya',
      bio: '',
    });
    assert.ok(!descSameName.includes('(@maya)'), `Unexpected duplication in: ${descSameName}`);

    const title = buildProfileSeoTitle({ username: 'maya', displayName: 'Maya Lin' });
    assert.equal(title, 'Maya Lin | Iveo');
  });

  it('gscClientValidation strictly checks JSON shape, size cap, and property URLs', () => {
    assert.equal(validateGscServiceAccountJsonInput('not json').valid, false);
    assert.equal(validateGscServiceAccountJsonInput('[]').valid, false);
    assert.equal(
      validateGscServiceAccountJsonInput(JSON.stringify({ type: 'oauth' })).valid,
      false
    );
    assert.equal(
      validateGscServiceAccountJsonInput(
        JSON.stringify({ type: 'service_account', client_email: 'x@y.com' }) + ' '.repeat(21 * 1024)
      ).valid,
      false
    );

    const sa = createEphemeralServiceAccount();
    const ok = validateGscServiceAccountJsonInput(JSON.stringify(sa));
    assert.equal(ok.valid, true);
    assert.equal(ok.parsedSummary?.clientEmail, sa.client_email);
    assert.equal(ok.parsedSummary?.projectId, sa.project_id);

    assert.equal(validateGscPropertyUrlInput('').valid, true);
    assert.equal(validateGscPropertyUrlInput('sc-domain:iveo.site').valid, true);
    assert.equal(validateGscPropertyUrlInput('https://iveo.site/').valid, true);
    assert.equal(validateGscPropertyUrlInput('ftp://iveo.site').valid, false);
    assert.equal(validateGscPropertyUrlInput('sc-domain:invalid').valid, false);

    const serverProp = validateGscPropertyUrl('sc-domain:IVEO.site');
    assert.equal(serverProp.valid, true);
    if (serverProp.valid) assert.equal(serverProp.normalized, 'sc-domain:iveo.site');
  });

  it('encrypts GSC JSON with AES-256-GCM, rejects tamper/wrong key, persists IndexNow key, caps events at 40, and never leaks secrets', async () => {
    const enc = encryptIntegrationsJson('{"secret":"super_sensitive_pem"}');
    assert.equal(enc.ok, true);
    if (!enc.ok) return;

    const dec = decryptIntegrationsJson(enc.blob);
    assert.equal(dec.ok, true);
    if (dec.ok) assert.equal(dec.plaintext, '{"secret":"super_sensitive_pem"}');

    // Tamper tag
    const tampered = { ...enc.blob, tag: Buffer.from('0123456789abcdef').toString('base64') };
    assert.equal(decryptIntegrationsJson(tampered).ok, false);

    // Wrong key
    process.env.INTEGRATIONS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    assert.equal(decryptIntegrationsJson(enc.blob).ok, false);

    // Save GSC config with valid key and verify redacted summary
    const sa = createEphemeralServiceAccount();
    const saveRes = await saveGscRuntimeConfigAsync({
      rawJson: JSON.stringify(sa),
      propertyUrl: 'sc-domain:iveo.site',
      updatedBy: 'admin@iveo.site',
    });
    assert.equal(saveRes.ok, true);
    const summary = await getGscSafeConfigSummaryAsync();
    assert.equal(summary.configured, true);
    assert.equal(summary.clientEmail, sa.client_email);
    assert.equal(summary.propertyUrl, 'sc-domain:iveo.site');
    assert.ok(!JSON.stringify(summary).includes('BEGIN PRIVATE KEY'));

    // Auto-generated IndexNow key is persisted across calls
    const k1 = await getOrCreateIndexNowKey();
    const k2 = await getOrCreateIndexNowKey();
    assert.match(k1, /^[a-f0-9]{32}$/);
    assert.equal(k1, k2);

    // Event log capped at 40
    for (let i = 0; i < 45; i += 1) {
      await appendSeoIntegrationEvent({
        type: 'ping',
        scope: 'alice',
        provider: 'indexnow',
        targetUrl: `https://iveo.site/@alice?i=${i}`,
        httpStatus: 200,
        outcome: 'success',
      });
    }
    const events = await listSeoIntegrationEvents({ limit: 40 });
    assert.equal(events.length, 40);
  });

  it('W3: legacy youtube and instagram blocks preserve all 7 Card Looks in PlatformBlockEditor', () => {
    const looks = [
      'match_page',
      'brand',
      'banner',
      'glass',
      'compact',
      'profile_card',
      'with_posts',
    ] as const;

    for (const lookStyle of looks) {
      const yt = deriveInitialFromBlock({
        id: 'yt-1',
        kind: 'youtube',
        title: 'Channel',
        url: 'https://youtube.com/@mkbhd',
        icon: null,
        thumbnailPath: null,
        thumbnailUrl: null,
        layout: 'classic',
        embedProvider: 'youtube',
        startAt: null,
        endAt: null,
        isActive: true,
        isArchived: false,
        position: 0,
        embedMeta: { provider: 'youtube', lookStyle },
      });
      assert.equal(yt.provider, 'youtube');
      assert.equal(yt.meta.lookStyle, lookStyle);

      const ig = deriveInitialFromBlock({
        id: 'ig-1',
        kind: 'instagram',
        title: 'Insta',
        url: 'https://instagram.com/mkbhd',
        icon: null,
        thumbnailPath: null,
        thumbnailUrl: null,
        layout: 'classic',
        embedProvider: 'instagram',
        startAt: null,
        endAt: null,
        isActive: true,
        isArchived: false,
        position: 1,
        embedMeta: { provider: 'instagram', lookStyle },
      });
      assert.equal(ig.provider, 'instagram');
      assert.equal(ig.meta.lookStyle, lookStyle);
    }
  });

  it('W1/W2: section headers persist cleanly with url=null, dense positions, and never hide surrounding links', async () => {
    const headers = { 'x-user-id': 'user-creator-1', 'x-user-email': 'alice@example.com' };
    const saveRes = createMockRes();
    await handleSaveBlocks(
      makeReq({
        headers,
        body: {
          username: 'alice',
          blocks: [
            { id: 'h-1', kind: 'header', title: 'Featured', url: null, isActive: false, isArchived: false, position: 5 },
            { id: 'l-1', kind: 'link', title: 'Portfolio', url: 'https://example.com', isActive: true, isArchived: false, position: 10 },
          ],
        },
      }),
      saveRes
    );
    assert.equal(saveRes.state.statusCode, 200);
    assert.equal(saveRes.state.body.blocks.length, 2);
    assert.equal(saveRes.state.body.blocks[0].kind, 'header');
    assert.equal(saveRes.state.body.blocks[0].url, null);
    assert.equal(saveRes.state.body.blocks[0].position, 0);
    assert.equal(saveRes.state.body.blocks[1].position, 1);

    const blocksRes = createMockRes();
    await handleGetBlocks(makeReq({ query: { username: 'alice' } }), blocksRes);
    assert.equal(blocksRes.state.statusCode, 200);
    assert.equal(blocksRes.state.body.length, 2);

    const pubRes = createMockRes();
    await handleGetPublicPage(makeReq({ query: { u: 'alice', _t: '1' } }), pubRes);
    assert.equal(pubRes.state.statusCode, 200);
    // Disabled header is hidden publicly, while active link underneath remains visible
    assert.equal(pubRes.state.body.links.length, 1);
    assert.equal(pubRes.state.body.links[0].id, 'l-1');
  });

  it('W4: enforces 401 unauthenticated, 403 cross-user / non-admin, and 429 submit cooldown', async () => {
    const unauth = createMockRes();
    await handleSeoMeOverview(makeReq({}), unauth);
    assert.equal(unauth.state.statusCode, 401);

    const aliceHeaders = { 'x-user-id': 'user-creator-1', 'x-user-email': 'alice@example.com' };
    const crossUser = createMockRes();
    await handleSeoMeOverview(makeReq({ headers: aliceHeaders, query: { u: 'bob' } }), crossUser);
    assert.equal(crossUser.state.statusCode, 403);

    const nonAdmin = createMockRes();
    await handleSeoAdminOverview(makeReq({ headers: aliceHeaders }), nonAdmin);
    assert.equal(nonAdmin.state.statusCode, 403);

    const ownOk = createMockRes();
    await handleSeoMeOverview(makeReq({ headers: aliceHeaders }), ownOk);
    assert.equal(ownOk.state.statusCode, 200);
    assert.equal(ownOk.state.body.overview.username, 'alice');
    assert.equal(ownOk.state.body.overview.isAdmin, false);

    const sub1 = createMockRes();
    await handleSeoMeSubmit(makeReq({ headers: aliceHeaders, body: { username: 'alice' } }), sub1);
    assert.equal(sub1.state.statusCode, 200);

    const sub2 = createMockRes();
    await handleSeoMeSubmit(makeReq({ headers: aliceHeaders, body: { username: 'alice' } }), sub2);
    assert.equal(sub2.state.statusCode, 429);
    assert.ok(Number(sub2.getHeaders()['retry-after']) >= 1);
  });

  it('redacts Pinterest access tokens and app secrets in error messages', async () => {
    const { redactSecrets } = await import('./serverConfig.ts');
    const prevSecret = process.env.PINTEREST_APP_SECRET;
    process.env.PINTEREST_APP_SECRET = 'ephemeral_pinterest_secret_value_for_test';
    try {
      const sample = 'Error calling Pinterest with pina_EXAMPLETOKEN1234567890ABCDEF and ephemeral_pinterest_secret_value_for_test';
      const cleaned = redactSecrets(sample);
      assert.ok(!cleaned.includes('pina_EXAMPLETOKEN1234567890ABCDEF'), cleaned);
      assert.ok(!cleaned.includes('ephemeral_pinterest_secret_value_for_test'), cleaned);
    } finally {
      if (prevSecret === undefined) delete process.env.PINTEREST_APP_SECRET;
      else process.env.PINTEREST_APP_SECRET = prevSecret;
    }
  });
});

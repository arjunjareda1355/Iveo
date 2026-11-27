import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  clearOAuthStateStoreForTests,
  consumeOAuthRedirectResult,
  consumeOAuthState,
  createOAuthState,
  peekOAuthStateProvider,
  sanitizeOAuthReturnTo,
  storeOAuthRedirectResult,
} from './oauthStateStore.ts';
import {
  decryptTokenPayload,
  encryptTokenPayload,
  readEncryptedOAuthToken,
  saveEncryptedOAuthToken,
} from './tokenCrypto.ts';
import {
  buildSocialOAuthUrl,
  exchangeSocialOAuthCode,
} from './socialIntegrations.ts';
import {
  buildYouTubeOAuthUrl,
  exchangeYouTubeOAuthCode,
} from './youtube.ts';
import {
  handleConsumeOAuthResult,
  handleSocialEmbedLookup,
  handleSocialOAuthCallback,
} from './db-handlers.ts';

function withIsolatedEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-oauth-w4-'));
  const merged: Record<string, string | undefined> = {
    IVEO_DATA_DIR: tmpDir,
    ...vars,
  };
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(merged)) {
    prev[key] = process.env[key];
    if (merged[key] === undefined) delete process.env[key];
    else process.env[key] = merged[key];
  }
  const cleanup = () => {
    clearOAuthStateStoreForTests();
    for (const key of Object.keys(merged)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === 'function') {
      return (res as Promise<void>).finally(cleanup);
    }
    cleanup();
    return res;
  } catch (err) {
    cleanup();
    throw err;
  }
}

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = null;
  let redirectLocation: string | null = null;
  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      body = payload;
      return res;
    },
    send(payload: any) {
      body = payload;
      return res;
    },
    redirect(codeOrUrl: number | string, maybeUrl?: string) {
      if (typeof codeOrUrl === 'number') {
        statusCode = codeOrUrl;
        redirectLocation = maybeUrl || null;
      } else {
        statusCode = 302;
        redirectLocation = codeOrUrl;
      }
      return res;
    },
    getStatus: () => statusCode,
    getBody: () => body,
    getHeaders: () => headers,
    getRedirect: () => redirectLocation,
  };
  return res;
}

test('OAuth state store enforces single-use consumption, TTL expiration, provider match, and safe returnTo', async () => {
  await withIsolatedEnv({}, async () => {
    // sanitizeOAuthReturnTo blocks open redirects
    assert.equal(sanitizeOAuthReturnTo('/dashboard/links'), '/dashboard/links');
    assert.equal(sanitizeOAuthReturnTo('/account#connections'), '/account#connections');
    assert.equal(sanitizeOAuthReturnTo('//evil.com/phish'), null);
    assert.equal(sanitizeOAuthReturnTo('https://evil.com/phish'), null);
    assert.equal(sanitizeOAuthReturnTo('javascript:alert(1)'), null);

    // State creation & single-use consumption
    const state = createOAuthState({
      provider: 'github',
      redirectUri: 'https://iveo.site/api/oauth/github/callback',
      mode: 'redirect',
      returnTo: '/dashboard/links',
      ownerKey: 'alice_creator',
    });
    assert.equal(peekOAuthStateProvider(state), 'github');

    // Cross-provider mismatch rejects and burns state
    const wrongProv = consumeOAuthState(state, 'discord');
    assert.equal(wrongProv.ok, false);
    if (!wrongProv.ok) assert.equal(wrongProv.reason, 'provider_mismatch');

    const afterMismatch = consumeOAuthState(state, 'github');
    assert.equal(afterMismatch.ok, false);
    if (!afterMismatch.ok) assert.equal(afterMismatch.reason, 'unknown_or_replayed_state');

    // Replay protection after valid consumption
    const state2 = createOAuthState({
      provider: 'linkedin',
      redirectUri: 'https://iveo.site/api/oauth/linkedin/callback',
      mode: 'popup',
      ownerKey: 'alice_creator',
    });
    const first = consumeOAuthState(state2, 'linkedin');
    assert.equal(first.ok, true);
    const replay = consumeOAuthState(state2, 'linkedin');
    assert.equal(replay.ok, false);
    if (!replay.ok) assert.equal(replay.reason, 'unknown_or_replayed_state');

    // Expired state rejection
    const expired = createOAuthState({
      provider: 'discord',
      redirectUri: 'https://iveo.site/api/oauth/discord/callback',
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 15));
    const expiredRes = consumeOAuthState(expired, 'discord');
    assert.equal(expiredRes.ok, false);
    if (!expiredRes.ok) {
      assert.ok(expiredRes.reason === 'expired_state' || expiredRes.reason === 'unknown_or_replayed_state');
    }

    // One-time redirect result pickup
    const token = storeOAuthRedirectResult({ type: 'IVEO_SOCIAL_OAUTH_SUCCESS', provider: 'github' });
    const picked = consumeOAuthRedirectResult(token);
    assert.equal(picked?.provider, 'github');
    assert.equal(consumeOAuthRedirectResult(token), null);
  });
});

test('Token encryption uses AES-256-GCM, detects tampering, and fails closed without TOKEN_ENCRYPTION_KEY', async () => {
  await withIsolatedEnv({ TOKEN_ENCRYPTION_KEY: undefined }, () => {
    const res = saveEncryptedOAuthToken('alice', 'github', { accessToken: 'secret_tok_123' });
    assert.equal(res.stored, false);
    assert.equal(res.encrypted, false);
    const storePath = path.join(process.env.IVEO_DATA_DIR!, 'oauth_tokens.json');
    assert.equal(fs.existsSync(storePath), false);
  });

  await withIsolatedEnv({ TOKEN_ENCRYPTION_KEY: 'super-secret-iveo-test-key-material' }, () => {
    const sealed = encryptTokenPayload({ accessToken: 'tok_xyz', refreshToken: 'ref_abc' });
    assert.ok(sealed.startsWith('v1.'));
    assert.equal(sealed.includes('tok_xyz'), false);

    const opened = decryptTokenPayload<{ accessToken: string; refreshToken: string }>(sealed);
    assert.equal(opened.accessToken, 'tok_xyz');
    assert.equal(opened.refreshToken, 'ref_abc');

    // Tamper tag / ciphertext
    const parts = sealed.split('.');
    parts[3] = `${parts[3].slice(0, -2)}AA`;
    assert.throws(() => decryptTokenPayload(parts.join('.')));

    const saved = saveEncryptedOAuthToken('alice', 'github', {
      accessToken: 'gho_real_secret_token',
      refreshToken: 'ghr_refresh',
      expiresAt: Date.now() + 3600_000,
    });
    assert.equal(saved.stored, true);
    assert.equal(saved.encrypted, true);

    const diskRaw = fs.readFileSync(path.join(process.env.IVEO_DATA_DIR!, 'oauth_tokens.json'), 'utf8');
    assert.equal(diskRaw.includes('gho_real_secret_token'), false);

    const readBack = readEncryptedOAuthToken('alice', 'github');
    assert.equal(readBack?.accessToken, 'gho_real_secret_token');
  });
});

test('X PKCE codeVerifier roundtrips via persistent state store and social/YouTube exchange encrypts tokens without leaking them', async () => {
  await withIsolatedEnv(
    {
      X_CLIENT_ID: 'x_cid',
      X_CLIENT_SECRET: 'x_csec',
      GOOGLE_CLIENT_ID: 'yt_cid',
      GOOGLE_CLIENT_SECRET: 'yt_csec',
      SITE_URL: 'https://iveo.site',
      TOKEN_ENCRYPTION_KEY: 'iveo-test-aes-key',
    },
    async () => {
      const builtX = buildSocialOAuthUrl('x', 'https://preview.iveo.local', {
        mode: 'redirect',
        returnTo: '/dashboard/links',
        ownerKey: 'maya_test',
      });
      assert.equal(builtX.redirectUri, 'https://iveo.site/api/oauth/x/callback');
      const xAuthUrl = new URL(builtX.url);
      const challenge = xAuthUrl.searchParams.get('code_challenge');
      assert.equal(xAuthUrl.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(challenge);

      const consumedX = consumeOAuthState(builtX.state, 'x');
      assert.equal(consumedX.ok, true);
      if (!consumedX.ok) throw new Error('expected valid x state');
      assert.ok(consumedX.record.codeVerifier);
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(consumedX.record.codeVerifier!)
        .digest('base64url');
      assert.equal(expectedChallenge, challenge);

      const realFetch = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.x.com/2/oauth2/token') {
          const bodyStr = String(init?.body || '');
          assert.ok(bodyStr.includes(`code_verifier=${encodeURIComponent(consumedX.record.codeVerifier!)}`));
          return new Response(JSON.stringify({ access_token: 'x_secret_tok', refresh_token: 'x_ref', expires_in: 7200 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.startsWith('https://api.x.com/2/users/me')) {
          return new Response(
            JSON.stringify({ data: { id: '42', username: 'maya_x', name: 'Maya Studio', description: 'Design', public_metrics: { followers_count: 500 } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({ access_token: 'yt_secret_tok', refresh_token: 'yt_ref', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.startsWith('https://www.googleapis.com/youtube/v3/channels')) {
          return new Response(
            JSON.stringify({ items: [{ id: 'UC1234567890123456789012', snippet: { title: 'Maya TV', customUrl: '@mayatv' }, statistics: { subscriberCount: '1200' } }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('not found', { status: 404 });
      }) as typeof fetch;

      try {
        const xConn = await exchangeSocialOAuthCode(
          'x',
          'code_abc',
          consumedX.record.redirectUri,
          consumedX.record.codeVerifier,
          consumedX.record.ownerKey
        );
        assert.equal(xConn.embedMeta.handle, '@maya_x');
        assert.equal(JSON.stringify(xConn).includes('x_secret_tok'), false);
        assert.equal(readEncryptedOAuthToken('maya_test', 'x')?.accessToken, 'x_secret_tok');

        const builtYt = buildYouTubeOAuthUrl('https://preview.iveo.local', { ownerKey: 'maya_test' });
        assert.ok(builtYt);
        assert.equal(builtYt!.redirectUri, 'https://iveo.site/api/oauth/youtube/callback');
        const consumedYt = consumeOAuthState(builtYt!.state, 'youtube');
        assert.equal(consumedYt.ok, true);
        if (!consumedYt.ok) throw new Error('expected valid yt state');

        const ytData = await exchangeYouTubeOAuthCode('yt_code', consumedYt.record.redirectUri, consumedYt.record.ownerKey);
        assert.equal(ytData.channelTitle, 'Maya TV');
        assert.equal(JSON.stringify(ytData).includes('yt_secret_tok'), false);
        assert.equal(readEncryptedOAuthToken('maya_test', 'youtube')?.accessToken, 'yt_secret_tok');
      } finally {
        globalThis.fetch = realFetch;
      }
    }
  );
});

test('handleSocialOAuthCallback supports mobile redirect pickup and blocks replayed state, and embed lookup blocks SSRF', async () => {
  await withIsolatedEnv(
    {
      GITHUB_CLIENT_ID: 'gh_cid',
      GITHUB_CLIENT_SECRET: 'gh_csec',
      SITE_URL: 'https://iveo.site',
      TOKEN_ENCRYPTION_KEY: 'iveo-test-aes-key',
    },
    async () => {
      const built = buildSocialOAuthUrl('github', 'https://iveo.site', {
        mode: 'redirect',
        returnTo: '/dashboard/links',
        ownerKey: 'maya',
      });

      const realFetch = globalThis.fetch;
      let tokenHits = 0;
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://github.com/login/oauth/access_token') {
          tokenHits += 1;
          return new Response(JSON.stringify({ access_token: 'gho_secret_tok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url === 'https://api.github.com/user') {
          return new Response(JSON.stringify({ login: 'maya_gh', name: 'Maya GH', public_repos: 12 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      }) as typeof fetch;

      try {
        const cbReq: any = {
          params: { provider: 'github' },
          query: { code: 'gh_code_1', state: built.state },
          headers: { host: 'iveo.site' },
        };
        const cbRes = createMockRes();
        await handleSocialOAuthCallback(cbReq, cbRes);
        assert.equal(cbRes.getStatus(), 302);
        const redirectLoc = cbRes.getRedirect();
        assert.ok(redirectLoc && redirectLoc.startsWith('/dashboard/links?iveo_oauth_result='));
        const resultToken = new URL(`https://iveo.site${redirectLoc}`).searchParams.get('iveo_oauth_result');
        assert.ok(resultToken);

        // Consume result once via /api/oauth/result
        const pickupRes1 = createMockRes();
        await handleConsumeOAuthResult({ query: { token: resultToken } } as any, pickupRes1);
        assert.equal(pickupRes1.getStatus(), 200);
        assert.equal(pickupRes1.getBody().ok, true);
        assert.equal(pickupRes1.getBody().result.provider, 'github');
        assert.equal(JSON.stringify(pickupRes1.getBody()).includes('gho_secret_tok'), false);

        // Second pickup fails 404
        const pickupRes2 = createMockRes();
        await handleConsumeOAuthResult({ query: { token: resultToken } } as any, pickupRes2);
        assert.equal(pickupRes2.getStatus(), 404);

        // Replay of callback state never hits upstream token endpoint
        const replayRes = createMockRes();
        await handleSocialOAuthCallback(cbReq, replayRes);
        assert.equal(tokenHits, 1);
        assert.ok(String(replayRes.getBody()).includes('Authorization session expired or invalid'));
      } finally {
        globalThis.fetch = realFetch;
      }

      // SSRF protection on embed lookup
      for (const badUrl of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data/']) {
        const ssrfRes = createMockRes();
        await handleSocialEmbedLookup(
          { query: { url: badUrl }, headers: {} } as any,
          ssrfRes
        );
        assert.equal(ssrfRes.getStatus(), 400);
        assert.equal(ssrfRes.getBody().error, 'forbidden_url');
      }
    }
  );
});

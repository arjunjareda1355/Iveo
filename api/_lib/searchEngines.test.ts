import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-gsc-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;

const { getCanonicalSiteOrigin, getGscSiteUrl } = await import('./env.ts');
const {
  parseGscServiceAccountCredentials,
  getSearchEngineStatus,
  submitSitemapsToSearchEngines,
  inspectUrlWithGsc,
  clearGscCachesForTest,
} = await import('./searchEngines.ts');

function createEphemeralServiceAccount(email = 'seo-bot@iveo-test.iam.gserviceaccount.com') {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    client_email: email,
    private_key: pem,
    project_id: 'iveo-test',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

const ENV_KEYS = [
  'GSC_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GSC_CLIENT_EMAIL',
  'GSC_PRIVATE_KEY',
  'GSC_SITE_URL',
  'VITE_SITE_ORIGIN',
  'APP_URL',
] as const;

const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

describe('GSC Service Account Parsing, Signing & Property Resolution', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    clearGscCachesForTest();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    clearGscCachesForTest();
  });

  it('handles sc-domain: in GSC_SITE_URL without breaking canonical origin', () => {
    process.env.GSC_SITE_URL = 'sc-domain:iveo.site';
    assert.equal(getGscSiteUrl(), 'sc-domain:iveo.site');
    assert.equal(getCanonicalSiteOrigin(), 'https://iveo.site');
  });

  it('parses standard JSON, escaped newlines, double-stringified JSON, base64, and split env vars', () => {
    const creds = createEphemeralServiceAccount();
    const rawJson = JSON.stringify(creds);

    // 1. Standard JSON
    process.env.GSC_SERVICE_ACCOUNT_JSON = rawJson;
    let parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.creds?.client_email, creds.client_email);

    // 2. Escaped \\n inside private_key & outer quotes
    const escapedJson = JSON.stringify({
      ...creds,
      private_key: creds.private_key.replace(/\n/g, '\\n'),
    });
    process.env.GSC_SERVICE_ACCOUNT_JSON = `'${escapedJson}'`;
    parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.error, undefined);
    assert.doesNotThrow(() => crypto.createPrivateKey(parsed.creds!.private_key));

    // 3. Double-stringified JSON
    process.env.GSC_SERVICE_ACCOUNT_JSON = JSON.stringify(rawJson);
    parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.error, undefined);

    // 4. Base64-encoded JSON
    process.env.GSC_SERVICE_ACCOUNT_JSON = Buffer.from(rawJson, 'utf8').toString('base64');
    parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.error, undefined);

    // 5. Split GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY fallback
    delete process.env.GSC_SERVICE_ACCOUNT_JSON;
    process.env.GSC_CLIENT_EMAIL = creds.client_email;
    process.env.GSC_PRIVATE_KEY = creds.private_key.replace(/\n/g, '\\n');
    parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.equal(parsed.error, undefined);
  });

  it('reports malformed private key diagnostics without leaking secret values', () => {
    const sentinel = 'NOT_A_REAL_SECRET_BODY_XYZ';
    process.env.GSC_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'seo@iveo.site',
      private_key: `-----BEGIN PRIVATE KEY-----\n${sentinel}\n-----END PRIVATE KEY-----`,
    });

    const parsed = parseGscServiceAccountCredentials();
    assert.equal(parsed.configured, true);
    assert.ok(parsed.error);
    assert.ok(!parsed.error.includes(sentinel));

    const status = getSearchEngineStatus();
    assert.equal(status.gscConfigured, false);
    assert.equal(status.gscHasEnv, true);
    assert.ok(status.gscError);
    assert.ok(!JSON.stringify(status).includes(sentinel));
  });

  it('auto-discovers sc-domain property and retries 403/404 candidates cleanly', async () => {
    const creds = createEphemeralServiceAccount();
    process.env.GSC_SERVICE_ACCOUNT_JSON = JSON.stringify(creds);
    process.env.VITE_SITE_ORIGIN = 'https://iveo.site';

    const calls: string[] = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      calls.push(`${init?.method || 'GET'} ${url}`);

      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(
          JSON.stringify({ access_token: 'mock-access-token', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'https://www.googleapis.com/webmasters/v3/sites') {
        return new Response(
          JSON.stringify({
            siteEntry: [
              { siteUrl: 'sc-domain:iveo.site', permissionLevel: 'siteFullUser' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/sites/sc-domain%3Aiveo.site/sitemaps/')) {
        return new Response(null, { status: 204 });
      }

      if (url === 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect') {
        const body = JSON.parse(String(init?.body || '{}'));
        assert.equal(body.siteUrl, 'sc-domain:iveo.site');
        assert.equal(body.inspectionUrl, 'https://iveo.site/@arjun');
        return new Response(
          JSON.stringify({
            inspectionResult: {
              indexStatusResult: {
                verdict: 'PASS',
                coverageState: 'Submitted and indexed',
                lastCrawlTime: '2026-11-24T10:00:00Z',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 });
    }) as typeof fetch;

    const submit = await submitSitemapsToSearchEngines();
    assert.equal(submit.gsc.attempted, true);
    assert.equal(submit.gsc.ok, true);
    assert.equal(submit.gsc.siteUrl, 'sc-domain:iveo.site');

    const inspect = await inspectUrlWithGsc('https://iveo.site/@arjun');
    assert.equal(inspect.configured, true);
    assert.equal(inspect.ok, true);
    assert.equal(inspect.verdict, 'PASS');
    assert.equal(inspect.siteUrl, 'sc-domain:iveo.site');
  });
});

// Cleanup tmp dir after process exits
process.on('exit', () => {
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {}
});

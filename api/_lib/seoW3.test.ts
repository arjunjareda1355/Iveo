import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-seo-w3-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const { buildProfileSeoTitle: sharedTitle, buildProfileSeoDescription: sharedDesc, truncateAtWord } = await import(
  '../../src/lib/seoMeta.ts'
);
const { getSiteOrigin, getCanonicalSiteOrigin, getIndexNowKey } = await import('./env.ts');
const {
  buildProfileSeoTitle,
  buildProfileSeoDescription,
  buildRobotsTxt,
  generatePagesSitemapXml,
  generateSitemapXml,
  buildLlmsTxt,
} = await import('./seoService.ts');
const { notifyIndexNow, clearGscCachesForTest } = await import('./searchEngines.ts');

const ENV_KEYS = [
  'SITE_URL',
  'VITE_SITE_ORIGIN',
  'APP_URL',
  'GSC_SITE_URL',
  'INDEXNOW_KEY',
  'BING_WEBMASTER_API_KEY',
] as const;
const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

describe('W3: Unified SEO metadata, SITE_URL canonicals, IndexNow /IndexNow & 429 cooldown', () => {
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

  it('truncates on word boundaries without ugly mid-word cuts', () => {
    const res = truncateAtWord('Digital product designer crafting simple everyday tools', 34);
    assert.ok(res.length <= 34);
    assert.ok(res.endsWith('…'));
    assert.ok(!res.endsWith('simp…'));
  });

  it('matches client seoMeta and server seoService title/description without bio fluff suffix', () => {
    const bio = 'Independent filmmaker & colorist sharing short films and presets.';
    const sample = {
      username: 'maya',
      displayName: 'Maya Lin',
      bio,
      customSeoTitle: null,
      customSeoDescription: null,
    };

    const clientT = sharedTitle(sample);
    const serverT = buildProfileSeoTitle(sample as any);
    assert.equal(clientT, serverT);
    assert.equal(clientT, 'Maya Lin | Iveo');
    assert.ok(clientT.length <= 65);

    const clientD = sharedDesc(sample);
    const serverD = buildProfileSeoDescription(sample as any);
    assert.equal(clientD, serverD);
    assert.equal(clientD, bio);
    assert.ok(!clientD.includes('— Discover'));
    assert.ok(clientD.length <= 160);

    // Strips HTML and respects custom overrides
    const customSample = {
      username: 'maya',
      displayName: 'Maya',
      customSeoTitle: '<b>Maya Custom</b> ' + 'A'.repeat(80),
      customSeoDescription: '<script>x</script>Custom bio summary ' + 'word '.repeat(40),
    };
    assert.ok(!buildProfileSeoTitle(customSample as any).includes('<b>'));
    assert.ok(buildProfileSeoTitle(customSample as any).length <= 70);
    assert.ok(!buildProfileSeoDescription(customSample as any).includes('<script>'));
    assert.ok(buildProfileSeoDescription(customSample as any).length <= 160);
  });

  it('prefers SITE_URL when set for canonical and runtime origin resolution', () => {
    process.env.SITE_URL = 'https://creator.iveo.site/';
    assert.equal(getSiteOrigin(), 'https://creator.iveo.site');
    assert.equal(getCanonicalSiteOrigin(), 'https://creator.iveo.site');
  });

  it('generates valid robots.txt, sitemaps, and llms.txt cleanly', async () => {
    const robots = buildRobotsTxt('https://iveo.site');
    assert.ok(robots.includes('Allow: /@*'));
    assert.ok(robots.includes('Disallow: /admin'));
    assert.ok(robots.includes('Sitemap: https://iveo.site/sitemap.xml'));

    const pages = await generatePagesSitemapXml('https://iveo.site');
    assert.ok(pages.totalUrls >= 4);
    assert.ok(pages.xml.includes('<loc>https://iveo.site/</loc>'));

    const indexXml = await generateSitemapXml('https://iveo.site');
    assert.ok(indexXml.xml.includes('sitemap-pages.xml'));
    assert.ok(indexXml.xml.includes('sitemap-profiles.xml'));

    const llms = await buildLlmsTxt('https://iveo.site');
    assert.ok(llms.includes('# Iveo'));
  });

  it('calls capitalized https://api.indexnow.org/IndexNow and obeys 429 Retry-After cooldown', async () => {
    process.env.SITE_URL = 'https://iveo.site';
    process.env.INDEXNOW_KEY = 'iveotestkey123456';
    assert.equal(getIndexNowKey(), 'iveotestkey123456');

    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      requestedUrls.push(url);
      if (url === 'https://api.indexnow.org/IndexNow') {
        const body = JSON.parse(String(init?.body || '{}'));
        assert.equal(body.keyLocation, 'https://iveo.site/iveotestkey123456.txt');
        return new Response('Too Many Requests', {
          status: 429,
          headers: { 'Retry-After': '120' },
        });
      }
      return new Response('Unexpected URL', { status: 404 });
    }) as typeof fetch;

    const first = await notifyIndexNow(['https://iveo.site/@maya']);
    assert.equal(first.attempted, true);
    assert.equal(first.ok, false);
    assert.equal(first.status, 'indexnow_err_429');
    assert.deepEqual(requestedUrls, ['https://api.indexnow.org/IndexNow']);

    // Second immediate call should respect Retry-After cooldown without hitting network
    const second = await notifyIndexNow(['https://iveo.site/@maya']);
    assert.equal(second.attempted, false);
    assert.equal(second.ok, false);
    assert.equal(second.status, 'indexnow_cooldown');
    assert.equal(requestedUrls.length, 1);
  });
});

process.on('exit', () => {
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {}
});

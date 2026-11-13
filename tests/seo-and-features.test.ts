import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAIN_SEO_TITLE,
  MAIN_SEO_DESCRIPTION,
  evaluateProfileIndexability,
  buildProfileSeoTitle,
  buildProfileSeoDescription,
  buildMainDomainHeadTags,
  buildProfileSeoPayload,
  buildNotFoundProfileResult,
  buildRobotsTxt,
  generateSitemapXml,
  generateSitemapPageXml,
  validateProfileSeo,
} from '../api/_lib/seoService';
import { extractBmcSlug } from '../api/_lib/buymeacoffee';
import {
  isPrivilegedEmailServer,
  validateUsernameServer,
  classifySegment,
} from '../api/_lib/usernames';
import { isOwnerEmail } from '../src/lib/plan';
import { getHexContrastRatio } from '../src/lib/qr';
import {
  parseBusinessCardConfig,
  mergeBusinessCardConfig,
} from '../src/lib/businessCardConfig';

test('Main domain SEO metadata contains brand title, canonical, and JSON-LD', () => {
  assert.equal(MAIN_SEO_TITLE, 'Iveo – One Link for Everything You Create');
  assert.match(MAIN_SEO_DESCRIPTION, /Create your personal space with Iveo/);

  const head = buildMainDomainHeadTags('https://iveo.site');
  assert.match(head, /<link rel="canonical" href="https:\/\/iveo\.site\/"/);
  assert.match(head, /"@type":"Organization"/);
  assert.match(head, /"@type":"WebSite"/);
  assert.match(head, /image\/svg\+xml/);
});

test('Profile indexability enforces 404 on missing/deleted/suspended and noindex on private/hidden', () => {
  const missing = evaluateProfileIndexability(null);
  assert.equal(missing.indexable, false);
  assert.equal(missing.httpStatus, 404);
  assert.equal(missing.robotsDirective, 'noindex, nofollow');

  const deleted = evaluateProfileIndexability({ username: 'ghost', status: 'deleted' });
  assert.equal(deleted.indexable, false);
  assert.equal(deleted.httpStatus, 404);

  const suspended = evaluateProfileIndexability({ username: 'banned', status: 'suspended' });
  assert.equal(suspended.indexable, false);
  assert.equal(suspended.httpStatus, 404);

  const priv = evaluateProfileIndexability({ username: 'draft', status: 'private', isPublished: true });
  assert.equal(priv.indexable, false);
  assert.equal(priv.httpStatus, 200);
  assert.equal(priv.robotsDirective, 'noindex, nofollow');

  const hidden = evaluateProfileIndexability({ username: 'quiet', status: 'active', isPublished: true, hideFromSearch: true });
  assert.equal(hidden.indexable, false);
  assert.equal(hidden.robotsDirective, 'noindex, nofollow');

  const pub = evaluateProfileIndexability({ username: 'arjun', status: 'active', isPublished: true, hideFromSearch: false });
  assert.equal(pub.indexable, true);
  assert.equal(pub.httpStatus, 200);
  assert.equal(pub.robotsDirective, 'index, follow');
});

test('Profile SEO payload produces dynamic title, description, canonical, ProfilePage & Person JSON-LD', async () => {
  const samplePage = {
    username: 'arjun',
    displayName: 'Arjun Jareda',
    bio: 'Building clean digital products and creative web tools.',
    avatarUrl: null,
    vibeId: 'clean',
    buttonShape: 'rounded' as const,
    buttonRadius: 12,
    plan: 'pro',
    hideFooter: true,
    hideFromSearch: false,
    isPublished: true,
    status: 'active' as const,
    socials: { github: 'https://github.com/arjun' },
    blocks: [{ id: '1', kind: 'link', title: 'Portfolio', url: 'https://arjun.dev', isActive: true }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  assert.equal(
    buildProfileSeoTitle(samplePage),
    'Arjun Jareda – Links, Projects & Social Profiles | Iveo'
  );
  assert.match(buildProfileSeoDescription(samplePage), /Arjun Jareda/);

  const payload = await buildProfileSeoPayload('https://iveo.site', samplePage);
  assert.equal(payload.decision.indexable, true);
  assert.match(payload.headTags, /<link rel="canonical" href="https:\/\/iveo\.site\/arjun" \/>/);
  assert.match(payload.headTags, /"@type":"ProfilePage"/);
  assert.match(payload.headTags, /"@type":"Person"/);
  assert.match(payload.headTags, /https:\/\/github\.com\/arjun/);
  assert.match(payload.ssrBodyHtml, /<h1>Arjun Jareda<\/h1>/);
  assert.match(payload.ssrBodyHtml, /@arjun/);
});

test('Not-found profile builder returns strict HTTP 404 + noindex', () => {
  const notFound = buildNotFoundProfileResult('https://iveo.site', 'missing-creator-xyz');
  assert.equal(notFound.httpStatus, 404);
  assert.match(notFound.tags, /<meta name="robots" content="noindex, nofollow" \/>/);
});

test('robots.txt disallows private routes and references root sitemap', () => {
  const robots = buildRobotsTxt('https://iveo.site');
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/dashboard/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Sitemap: https:\/\/iveo\.site\/sitemap\.xml/);
});

test('Paginated XML sitemap includes public creators and excludes dashboard/admin/404 routes', async () => {
  const rootSitemap = await generateSitemapXml('https://iveo.site', 50000);
  assert.ok(rootSitemap.totalUrls >= 2);
  assert.match(rootSitemap.xml, /https:\/\/iveo\.site\//);
  assert.match(rootSitemap.xml, /https:\/\/iveo\.site\/discover/);
  assert.doesNotMatch(rootSitemap.xml, /\/dashboard/);
  assert.doesNotMatch(rootSitemap.xml, /\/admin/);
  assert.doesNotMatch(rootSitemap.xml, /\/login/);

  // Force multi-page index split with pageSize = 2
  const pagedIndex = await generateSitemapXml('https://iveo.site', 2);
  assert.equal(pagedIndex.isIndex, true);
  assert.ok(pagedIndex.pages >= 2);
  assert.match(pagedIndex.xml, /<sitemapindex/);
  assert.match(pagedIndex.xml, /sitemap-1\.xml/);

  const page1 = await generateSitemapPageXml('https://iveo.site', 1, 2);
  assert.equal(page1.found, true);
  assert.match(page1.xml, /<urlset/);

  const pageOutOfRange = await generateSitemapPageXml('https://iveo.site', 9999, 2);
  assert.equal(pageOutOfRange.found, false);
});

test('validateProfileSeo catches invalid/reserved/private handles cleanly', async () => {
  const res = await validateProfileSeo('https://iveo.site', 'dashboard');
  assert.equal(res.found, false);
  assert.equal(res.indexable, false);
  assert.equal(res.httpStatus, 404);
});

test('Buy Me a Coffee slug extractor handles URLs, bare usernames, and invalid domains', () => {
  assert.equal(extractBmcSlug('https://www.buymeacoffee.com/arjuncreator'), 'arjuncreator');
  assert.equal(extractBmcSlug('buymeacoffee.com/maya.art/extras'), 'maya.art');
  assert.equal(extractBmcSlug('arjuncreator'), 'arjuncreator');
  assert.equal(extractBmcSlug('https://evil-example.com/arjun'), null);
  assert.equal(extractBmcSlug(''), null);
});

test('Privileged owner emails (@iveo.site and designated Gmail accounts) allow reserved handles', () => {
  assert.equal(isOwnerEmail('test@iveo.site'), true);
  assert.equal(isOwnerEmail('arjunjareda2007@gmail.com'), true);
  assert.equal(isOwnerEmail('arjunjareda1355@gmail.com'), true);
  assert.equal(isOwnerEmail('random@gmail.com'), false);

  assert.equal(isPrivilegedEmailServer('founder@iveo.site'), true);
  assert.equal(validateUsernameServer('help', { allowReserved: false }).ok, false);
  assert.equal(validateUsernameServer('help', { allowReserved: true }).ok, true);
  assert.equal(validateUsernameServer('dashboard', { allowReserved: true }).ok, false);
  assert.equal(classifySegment('discover'), 'info');
  assert.equal(classifySegment('admin'), 'private');
});

test('QR contrast checker evaluates dark/light pairs accurately', () => {
  assert.equal(getHexContrastRatio('#0A0A0A', '#FFFFFF') > 15, true);
  assert.equal(getHexContrastRatio('#777777', '#888888') < 3.0, true);
});

test('Business card config parser and merger preserve any-color QR and gradient fields', () => {
  const parsed = parseBusinessCardConfig({
    template: 'gradient',
    bgColor: '#112233',
    bgColor2: '#445566',
    websiteUrl: 'https://iveo.site/arjun',
    showBio: false,
    showHandle: true,
    qrFgColor: '#FF0066',
    qrBgColor: '#FFF5F9',
    cornerStyle: 'pill',
  });
  assert.ok(parsed);
  assert.equal(parsed?.template, 'gradient');
  assert.equal(parsed?.bgColor2, '#445566');
  assert.equal(parsed?.qrFgColor, '#FF0066');
  assert.equal(parsed?.qrBgColor, '#FFF5F9');
  assert.equal(parsed?.showBio, false);

  const merged = mergeBusinessCardConfig(parsed, { showHandle: false });
  assert.equal(merged.bgColor2, '#445566');
  assert.equal(merged.showHandle, false);
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { terminate } from 'firebase/firestore';
import { serverDb } from '../api/_lib/firebaseServer';

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
  getAllUnifiedProfiles,
  isSyntheticTestHandle,
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
  resolveBusinessCardAppearance,
  resolveFrontCardAppearance,
  resolveBackCardAppearance,
  METALLIC_CARD_VIBES,
  buildBackSocialLinks,
  formatSocialHandleLabel,
  CARD_BASE_WIDTH,
  CARD_BASE_HEIGHT,
  CARD_EXPORT_SCALE,
} from '../src/lib/businessCardConfig';
import {
  parseLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../src/lib/preferences';
import {
  BACKGROUND_PRESETS,
  isDarkBackgroundPreset,
} from '../src/lib/backgrounds';
import {
  parseYouTubeInput,
  extractSubscriberCountFromHtml,
} from '../api/_lib/youtube';
import { normalizeYouTubeUrl } from '../src/lib/urls';
import { parseEmbedUrl } from '../src/lib/embeds';

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
    plan: 'pro' as const,
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
  assert.match(payload.headTags, /<link rel="canonical" href="https:\/\/iveo\.site\/@arjun" \/>/);
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
  assert.match(rootSitemap.xml, /https:\/\/iveo\.site\/sitemap-pages\.xml/);
  assert.match(rootSitemap.xml, /https:\/\/iveo\.site\/sitemap-profiles\.xml/);
  assert.doesNotMatch(rootSitemap.xml, /\/dashboard/);
  assert.doesNotMatch(rootSitemap.xml, /\/admin/);
  assert.doesNotMatch(rootSitemap.xml, /\/login/);

  // Force multi-page index split with pageSize = 2
  const pagedIndex = await generateSitemapXml('https://iveo.site', 2);
  assert.equal(pagedIndex.isIndex, true);
  assert.ok(pagedIndex.pages >= 2);
  assert.match(pagedIndex.xml, /<sitemapindex/);
  assert.match(pagedIndex.xml, /sitemap-profiles-1\.xml/);

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

test('LayoutSettings parser enforces valid defaults and enums', () => {
  assert.equal(DEFAULT_LAYOUT_SETTINGS.avatarShape, 'circle');
  assert.equal(DEFAULT_LAYOUT_SETTINGS.buttonStyle, 'solid');
  assert.equal(parseLayoutSettings({}), null);

  const valid = parseLayoutSettings({
    avatarShape: 'squircle',
    headerAlign: 'left',
    buttonStyle: 'glass',
    linkSpacing: 'airy',
    pageWidth: 'wide',
  });
  assert.deepEqual(valid, {
    avatarShape: 'squircle',
    headerAlign: 'left',
    buttonStyle: 'glass',
    linkSpacing: 'airy',
    pageWidth: 'wide',
    cardLook: 'match_page',
  });

  const partial = parseLayoutSettings({ buttonStyle: 'offset', avatarShape: 'invalid' });
  assert.deepEqual(partial, {
    avatarShape: 'circle',
    headerAlign: 'center',
    buttonStyle: 'offset',
    linkSpacing: 'normal',
    pageWidth: 'standard',
    cardLook: 'match_page',
  });
});

test('Background presets exclude legacy presets and classify dark themes accurately', () => {
  assert.ok(BACKGROUND_PRESETS.length >= 16); // 'none' + 15 curated backdrops
  const ids = new Set(BACKGROUND_PRESETS.map((p) => p.id));
  assert.equal(ids.has('obsidian-silk'), true);
  assert.equal(ids.has('northern-prism'), true);
  assert.equal(ids.has('drafting-grid'), true);
  assert.equal(isDarkBackgroundPreset('obsidian-silk'), true);
  assert.equal(isDarkBackgroundPreset('warm-vellum'), false);
});

test('Business card 1:1 fidelity constants and resolved appearance match aspect ratio', () => {
  assert.equal(CARD_BASE_WIDTH, 600);
  assert.equal(CARD_BASE_HEIGHT, 353);
  assert.equal(Math.round(CARD_BASE_WIDTH * CARD_EXPORT_SCALE), 2040);
  assert.equal(Math.round(CARD_BASE_HEIGHT * CARD_EXPORT_SCALE), 1200);

  const appearance = resolveBusinessCardAppearance({
    template: 'classic',
    bgColor: '#0A0A0A',
    cornerStyle: 'pill',
    qrFgColor: '#FFFFFF',
    qrBgColor: '#0A0A0A',
  });
  assert.equal(appearance.bgColor, '#0A0A0A');
  assert.equal(appearance.cornerRadius, 32);
  assert.equal(appearance.qrFg, '#FFFFFF');
});

test('YouTube URL parser handles handles, channel IDs, watch URLs, and invalid domains', () => {
  assert.equal(parseYouTubeInput('@iveosite')?.kind, 'handle');
  assert.equal(parseYouTubeInput('@iveosite')?.canonicalUrl, 'https://www.youtube.com/@iveosite');
  assert.equal(parseYouTubeInput('https://youtu.be/dQw4w9WgXcQ')?.value, 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeInput('UC1234567890123456789012')?.kind, 'channel_id');
  assert.equal(parseYouTubeInput('https://evil.example.com/watch?v=123'), null);
});

test('resolveCardBorderRadius & resolveButtonControlRadius prevent pill oval distortion on tall cards', () => {
  // Square (0)
  assert.equal(resolveCardBorderRadius(0, 1, 'bar'), 0);
  assert.equal(resolveCardBorderRadius(0, 1, 'card'), 0);
  assert.equal(resolveCardBorderRadius(0, 1, 'inner'), 0);
  assert.equal(resolveButtonControlRadius(0, 1), 0);

  // Rounded (12)
  assert.equal(resolveCardBorderRadius(12, 1, 'bar'), 12);
  assert.equal(resolveCardBorderRadius(12, 1, 'card'), 12);
  assert.equal(resolveCardBorderRadius(12, 1, 'inner'), 10);
  assert.equal(resolveButtonControlRadius(12, 1), 12);

  // Pill (999) — bar & control buttons become 9999, cards cap at 22px (scaled) so they stay crisp rectangles
  assert.equal(resolveCardBorderRadius(999, 1, 'bar'), 9999);
  assert.equal(resolveCardBorderRadius(999, 1, 'card'), 22);
  assert.equal(resolveCardBorderRadius(999, 0.5, 'card'), 11);
  assert.equal(resolveCardBorderRadius(999, 1, 'inner'), 12);
  assert.equal(resolveButtonControlRadius(999, 1), 9999);
});

test('Owner email allowlist and SEO admin access are strictly limited to @iveo.site and designated Gmail owners', () => {
  const allowed = ['owner@iveo.site', 'support@IVEO.SITE', 'arjunjareda2007@gmail.com', 'arjunjareda1355@gmail.com'];
  const denied = ['seo@gmail.com', 'admin@example.com', 'hacker@iveo.site.evil.com', 'arjunjareda2007@yahoo.com', '', null, undefined];

  for (const email of allowed) {
    assert.equal(isOwnerEmail(email), true, `Expected ${email} to pass client owner check`);
    assert.equal(isPrivilegedEmailServer(email), true, `Expected ${email} to pass server owner check`);
  }
  for (const email of denied) {
    assert.equal(isOwnerEmail(email), false, `Expected ${String(email)} to fail client owner check`);
    assert.equal(isPrivilegedEmailServer(email), false, `Expected ${String(email)} to fail server owner check`);
  }
});

test('Fake/demo personas and synthetic test handles are completely excluded', async () => {
  assert.equal(isSyntheticTestHandle('test'), true);
  assert.equal(isSyntheticTestHandle('test-user-1'), true);
  assert.equal(isSyntheticTestHandle('demo_99'), true);
  assert.equal(isSyntheticTestHandle('old-1700000000'), true);
  assert.equal(isSyntheticTestHandle('seo-rename-old-123'), true);
  assert.equal(isSyntheticTestHandle('arjun-studio'), false);

  const unified = await getAllUnifiedProfiles();
  const fakeHandles = new Set(['maya', 'devsharma', 'lenahoffmann', 'tomasreyes', 'elena', 'kai', 'alex', 'test']);
  for (const prof of unified) {
    assert.equal(fakeHandles.has(prof.username), false, `Fake handle ${prof.username} should not exist`);
    assert.equal(isSyntheticTestHandle(prof.username), false, `Synthetic handle ${prof.username} should not exist`);
  }
});

test('2-sided metallic business card resolves distinct dual-tone front/back faces and presets', () => {
  assert.ok(METALLIC_CARD_VIBES.length >= 6);

  const parsed = parseBusinessCardConfig({
    metallicVibe: 'champagne',
    metallicFinish: true,
    bgColor: '#2B2115',
    bgColor2: '#0E0A06',
    backBgColor: '#FFFDF5',
    backBgColor2: '#FDE68A',
    backTextColor: '#292117',
    backAccentColor: '#B45309',
    backHeadline: 'Scan to',
    backSubheadline: 'connect.',
    showSocialsOnBack: true,
  });
  assert.ok(parsed);
  assert.equal(parsed?.metallicVibe, 'champagne');
  assert.equal(parsed?.backBgColor, '#FFFDF5');
  assert.equal(parsed?.backBgColor2, '#FDE68A');
  assert.equal(parsed?.backTextColor, '#292117');
  assert.equal(parsed?.backAccentColor, '#B45309');
  assert.equal(parsed?.backHeadline, 'Scan to');
  assert.equal(parsed?.backSubheadline, 'connect.');
  assert.equal(parsed?.showSocialsOnBack, true);

  // Default page-vibe resolves clean light front + clean light back when no vibeTheme passed
  const defaultFront = resolveFrontCardAppearance({});
  const defaultBack = resolveBackCardAppearance({});
  assert.equal(defaultFront.metallicVibe, 'page-vibe');
  assert.equal(defaultFront.bgColor, '#FFFFFF');
  assert.equal(defaultFront.isLight, true);
  assert.equal(defaultBack.bgColor, '#FFFFFF');
  assert.equal(defaultBack.isLight, true);

  // Explicit obsidian metallic resolves dark obsidian front + pearl white back
  const obsidianFront = resolveFrontCardAppearance({ metallicVibe: 'obsidian' });
  const obsidianBack = resolveBackCardAppearance({ metallicVibe: 'obsidian' });
  assert.equal(obsidianFront.bgColor, '#1C1C21');
  assert.equal(obsidianFront.bgColor2, '#070709');
  assert.equal(obsidianFront.isLight, false);
  assert.equal(obsidianBack.bgColor, '#FFFFFF');
  assert.equal(obsidianBack.bgColor2, '#ECEFF4');
  assert.equal(obsidianBack.isLight, true);

  // Page-vibe preset honors theme bg on front while keeping clean back fallback
  const vibeFront = resolveFrontCardAppearance(
    { metallicVibe: 'page-vibe' },
    { bg: '#F4F1EA', text: '#1C1917', accent: '#B45309' }
  );
  assert.equal(vibeFront.bgColor, '#F4F1EA');
  assert.equal(vibeFront.accentColor, '#B45309');

  const cobaltBack = resolveBackCardAppearance({ metallicVibe: 'cobalt' });
  assert.equal(cobaltBack.bgColor, '#F0F7FF');
  assert.equal(cobaltBack.bgColor2, '#DBEAFE');
});

test('Back social links builder formats handles cleanly and caps at 6 links', () => {
  assert.equal(formatSocialHandleLabel('instagram', 'https://instagram.com/arjun.creates/'), '@arjun.creates');
  assert.equal(formatSocialHandleLabel('youtube', 'https://youtube.com/@MrBeast/videos'), '@MrBeast');
  assert.equal(formatSocialHandleLabel('linkedin', 'https://linkedin.com/in/arjun-jareda'), 'in/arjun-jareda');
  assert.equal(formatSocialHandleLabel('website', 'https://iveo.site/arjun'), 'iveo.site/arjun');

  const links = buildBackSocialLinks(
    {
      instagram: 'https://instagram.com/arjun',
      twitter: 'https://twitter.com/arjunx',
      youtube: 'https://youtube.com/@arjunyt',
      linkedin: 'https://linkedin.com/in/arjun',
      github: 'https://github.com/arjun',
      tiktok: 'https://tiktok.com/@arjun',
      threads: 'https://threads.net/@arjun',
    },
    'https://arjun.dev',
    'arjun'
  );
  assert.equal(links.length, 6);
  assert.equal(links[0].platform, 'instagram');
  assert.equal(links[1].platform, 'x');
  assert.equal(links[2].platform, 'youtube');
  assert.equal(links[3].platform, 'website');
});

test('YouTube subscriber scraper, URL normalizer, and embed parser handle edge formats', () => {
  const polymerHtml =
    '{"contentMetadataViewModel":{"metadataParts":[{"text":{"content":"@MrBeast"}},{"text":{"content":"526M subscribers"}}]}}';
  assert.equal(extractSubscriberCountFromHtml(polymerHtml), '526M subscribers');

  const classicHtml =
    '{"subscriberCountText":{"simpleText":"1.24M subscribers"}}';
  assert.equal(extractSubscriberCountFromHtml(classicHtml), '1.24M subscribers');

  assert.equal(normalizeYouTubeUrl('UCX6OQ3DkcsbYNE6H8uQQuVA'), 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA');
  assert.equal(normalizeYouTubeUrl('music.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://music.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(normalizeYouTubeUrl('@MrBeast?si=abc123'), 'https://www.youtube.com/@MrBeast');

  assert.equal(parseYouTubeInput('https://music.youtube.com/watch?v=dQw4w9WgXcQ')?.value, 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeInput('https://www.youtube.com/v/dQw4w9WgXcQ')?.value, 'dQw4w9WgXcQ');

  const musicEmbed = parseEmbedUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ&t=15');
  assert.equal(musicEmbed?.provider, 'youtube');
  assert.equal(musicEmbed?.embedSrc, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&start=15');

  const vEmbed = parseEmbedUrl('https://www.youtube.com/v/dQw4w9WgXcQ');
  assert.equal(vEmbed?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

after(async () => {
  if (serverDb) {
    await terminate(serverDb).catch(() => {});
  }
});



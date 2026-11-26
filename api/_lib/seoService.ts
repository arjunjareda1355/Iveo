import { dbGetBlocks, dbListAllProfiles } from './azureSql.ts';
import { getBingSiteVerification, getCanonicalSiteOrigin, getGoogleSiteVerification } from './env.ts';
import { firebaseGetAllProfiles } from './firebaseServer.ts';
import { escapeHtml, safeJsonLd, truncate } from './html.ts';
import { ogImageAddress, pageAddress } from './site.ts';
import { loadPublicPage, version, type PublicPageServerData } from './publicPage.ts';
import { appendSeoEvent, getSearchEngineStatus, notifyIndexNow, submitSitemapsToSearchEngines } from './searchEngines.ts';
import { classifySegment, isPrivilegedEmailServer, PRIVATE_ROUTES, PUBLIC_INFO_ROUTES } from './usernames.ts';
import { isNewerTimestamp } from './profileMerge.ts';
import { normalizeSocialUrl } from '../../src/lib/urls.ts';

export const MAIN_SEO_TITLE = 'Iveo – One Link for Everything You Create';
export const MAIN_SEO_DESCRIPTION =
  'Create your personal space with Iveo. Share your social links, websites, projects and everything you create through one beautiful, customizable profile.';

export const DEFAULT_SITEMAP_PAGE_SIZE = 50000;

export interface SeoUnifiedProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  vibeId: string;
  plan: string;
  isPro?: boolean;
  status: 'active' | 'private' | 'unpublished' | 'deleted' | 'deleted_pending' | 'suspended';
  isPublished: boolean;
  hideFromSearch: boolean;
  customSeoTitle: string | null;
  customSeoDescription: string | null;
  socials: Record<string, string>;
  updatedAt: string;
  source: 'database' | 'firebase';
}

const SYNTHETIC_TEST_HANDLE_PATTERNS: RegExp[] = [
  /^(test|demo)([_-].*|\d+)?$/i,
  /^(free|pro)user\d*$/i,
  /^tmp[_-]?banner/i,
  /^old-\d+$/i,
  /^seo-rename-(old|new)-\d+$/i,
  /^(verifytemp|themeverify|verif|renm)\d+$/i,
];

export function isSyntheticTestHandle(username: string | null | undefined): boolean {
  const clean = (username || '').toLowerCase().trim();
  if (!clean) return true;
  return SYNTHETIC_TEST_HANDLE_PATTERNS.some((rx) => rx.test(clean));
}

export interface IndexabilityDecision {
  indexable: boolean;
  reason: string;
  robotsDirective: 'index, follow' | 'noindex, nofollow';
  httpStatus: 200 | 404;
}

export interface ProfileSeoIssue {
  username: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

interface SitemapState {
  lastGeneratedAt: string | null;
  lastInvalidatedAt: string | null;
  lastInvalidationReason: string | null;
  totalUrls: number;
  indexableProfiles: number;
  excludedProfiles: number;
  sitemapPages: number;
  cachedXml: Map<string, { xml: string; createdAt: number }>;
}

const sitemapState: SitemapState = {
  lastGeneratedAt: null,
  lastInvalidatedAt: null,
  lastInvalidationReason: null,
  totalUrls: 0,
  indexableProfiles: 0,
  excludedProfiles: 0,
  sitemapPages: 1,
  cachedXml: new Map(),
};

export function invalidateSitemapCache(reason: string): void {
  sitemapState.cachedXml.clear();
  sitemapState.lastInvalidatedAt = new Date().toISOString();
  sitemapState.lastInvalidationReason = reason;
}

export async function notifyProfileSeoChanged(
  action: 'created' | 'updated' | 'deleted' | 'renamed',
  username: string,
  previousUsername?: string | null
): Promise<void> {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  invalidateSitemapCache(`${action}:${clean}`);
  appendSeoEvent(`profile_${action}`, clean, 'sitemap_invalidated', previousUsername ? `from:${previousUsername}` : undefined);

  const origin = getCanonicalSiteOrigin();
  const urls: string[] = [`${origin}/@${encodeURIComponent(clean)}`];
  if (previousUsername && previousUsername !== clean) {
    const prevClean = previousUsername.replace(/^@+/, '').toLowerCase().trim();
    urls.push(`${origin}/@${encodeURIComponent(prevClean)}`);
  }

  // Non-blocking background IndexNow notification when configured
  notifyIndexNow(urls).catch(() => {});
}

export function evaluateProfileIndexability(profile: Partial<SeoUnifiedProfile> | null | undefined): IndexabilityDecision {
  if (!profile || !profile.username) {
    return {
      indexable: false,
      reason: 'profile_not_found',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 404,
    };
  }

  const clean = profile.username.toLowerCase().trim();
  if (PRIVATE_ROUTES.includes(clean)) {
    return {
      indexable: false,
      reason: 'reserved_system_route',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 404,
    };
  }

  const status = profile.status || 'active';
  if (status === 'deleted' || status === 'deleted_pending') {
    return {
      indexable: false,
      reason: 'deleted_profile',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 404,
    };
  }
  if (status === 'suspended') {
    return {
      indexable: false,
      reason: 'suspended_profile',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 404,
    };
  }
  if (status === 'private' || status === 'unpublished' || profile.isPublished === false) {
    return {
      indexable: false,
      reason: status === 'private' ? 'private_profile' : 'unpublished_profile',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 200,
    };
  }
  if (profile.hideFromSearch) {
    return {
      indexable: false,
      reason: 'hide_from_search_enabled',
      robotsDirective: 'noindex, nofollow',
      httpStatus: 200,
    };
  }

  return {
    indexable: true,
    reason: 'eligible_public_profile',
    robotsDirective: 'index, follow',
    httpStatus: 200,
  };
}

export async function getAllUnifiedProfiles(): Promise<SeoUnifiedProfile[]> {
  const byUsername = new Map<string, SeoUnifiedProfile>();
  const todayIso = new Date().toISOString();

  const upsertIfNewer = (candidate: SeoUnifiedProfile) => {
    if (isSyntheticTestHandle(candidate.username)) return;
    const existing = byUsername.get(candidate.username);
    if (!existing || isNewerTimestamp(candidate.updatedAt, existing.updatedAt)) {
      byUsername.set(candidate.username, candidate);
    }
  };

  // 1. Firebase profiles
  try {
    const fbProfiles = await firebaseGetAllProfiles();
    for (const prof of fbProfiles) {
      const uname = typeof prof?.username === 'string' ? prof.username.toLowerCase().trim() : '';
      if (!uname || prof?.status === 'deleted' || prof?.status === 'deleted_pending') continue;
      const isPro = Boolean(prof.isPro || prof.plan === 'pro' || isPrivilegedEmailServer(prof.primaryEmail));
      upsertIfNewer({
        username: uname,
        displayName: prof.displayName || uname,
        bio: prof.bio || '',
        avatarUrl: prof.avatarUrl || null,
        vibeId: prof.vibeId || 'clean',
        plan: isPro ? 'pro' : (prof.plan || 'free'),
        isPro,
        status: prof.status || (prof.isPublished === false ? 'unpublished' : 'active'),
        isPublished: prof.isPublished !== false,
        hideFromSearch: Boolean(prof.hideFromSearch),
        customSeoTitle: prof.customSeoTitle || null,
        customSeoDescription: prof.customSeoDescription || null,
        socials: prof.socials || {},
        updatedAt: prof.updatedAt || todayIso,
        source: 'firebase',
      });
    }
  } catch {}

  // 2. Azure SQL + Server Store (merged by updatedAt so newest write wins)
  try {
    const dbProfiles = await dbListAllProfiles();
    for (const prof of dbProfiles) {
      const uname = typeof prof?.username === 'string' ? prof.username.toLowerCase().trim() : '';
      if (!uname || prof?.status === 'deleted' || prof?.status === 'deleted_pending') continue;
      const isPro = Boolean(prof.isPro || prof.plan === 'pro' || isPrivilegedEmailServer(prof.primaryEmail));
      upsertIfNewer({
        username: uname,
        displayName: prof.displayName || uname,
        bio: prof.bio || '',
        avatarUrl: prof.avatarUrl || null,
        vibeId: prof.vibeId || 'clean',
        plan: isPro ? 'pro' : (prof.plan || 'free'),
        isPro,
        status: prof.status || (prof.isPublished === false ? 'unpublished' : 'active'),
        isPublished: prof.isPublished !== false,
        hideFromSearch: Boolean(prof.hideFromSearch),
        customSeoTitle: prof.customSeoTitle || null,
        customSeoDescription: prof.customSeoDescription || null,
        socials: prof.socials || {},
        updatedAt: prof.updatedAt || todayIso,
        source: 'database',
      });
    }
  } catch {}

  return Array.from(byUsername.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function buildProfileSeoTitle(page: PublicPageServerData): string {
  const displayName = (page.displayName || page.username || '').trim();
  if (page.customSeoTitle?.trim()) {
    return truncate(page.customSeoTitle.trim(), 70);
  }
  const suffix = ' – Links, Projects & Social Profiles | Iveo';
  const maxNameLen = Math.max(12, 72 - suffix.length);
  return `${truncate(displayName, maxNameLen)}${suffix}`;
}

export function buildProfileSeoDescription(page: PublicPageServerData): string {
  const displayName = (page.displayName || page.username || '').trim();
  if (page.customSeoDescription?.trim()) {
    return truncate(page.customSeoDescription.trim(), 160);
  }
  if (page.bio?.trim()) {
    const bioClean = page.bio.trim();
    if (bioClean.length >= 45) {
      return truncate(`${bioClean} — Discover ${displayName} (@${page.username}) on Iveo.`, 160);
    }
    return truncate(
      `${bioClean} Discover ${displayName} on Iveo. Explore their projects, websites, and social media links.`,
      160
    );
  }
  return truncate(
    `Discover ${displayName} on Iveo. Explore their projects, websites, social media links and latest work.`,
    160
  );
}

export function buildVerificationMetaTags(): string {
  const lines: string[] = [];
  const google = getGoogleSiteVerification();
  const bing = getBingSiteVerification();
  if (google) {
    lines.push(`<meta name="google-site-verification" content="${escapeHtml(google)}" />`);
  }
  if (bing) {
    lines.push(`<meta name="msvalidate.01" content="${escapeHtml(bing)}" />`);
  }
  return lines.join('\n    ');
}

export function buildMainDomainHeadTags(requestOrigin?: string): string {
  const canonicalOrigin = getCanonicalSiteOrigin();
  const assetOrigin = requestOrigin || canonicalOrigin;
  const canonicalUrl = `${canonicalOrigin}/`;
  const ogImg = ogImageAddress(assetOrigin);
  const verifications = buildVerificationMetaTags();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Iveo',
    url: canonicalUrl,
    logo: 'https://i.postimg.cc/d1cqB7Dm/iveo-logo-04-tile-white-shadow-4k.png',
    sameAs: [
      'https://www.instagram.com/iveo.site',
      'https://youtube.com/@iveosite',
      'https://x.com/@iveosite',
    ],
    description: MAIN_SEO_DESCRIPTION,
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Iveo',
    url: canonicalUrl,
    description: MAIN_SEO_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${canonicalOrigin}/discover?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Iveo?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Iveo is a personal link-in-bio and digital creator profile platform where you share all your social links, websites, embeds, and projects through one customizable iveo.site/@username address.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I create an Iveo profile?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Claim your username on iveo.site, add your links, choose a theme vibe, customize fonts and buttons, and publish your page instantly.',
        },
      },
    ],
  };

  return `<title>${escapeHtml(MAIN_SEO_TITLE)}</title>
    <meta name="description" content="${escapeHtml(MAIN_SEO_DESCRIPTION)}" />
    <meta name="robots" content="index, follow" />
    ${verifications}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Iveo" />
    <meta property="og:title" content="${escapeHtml(MAIN_SEO_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(MAIN_SEO_DESCRIPTION)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="Iveo – One Link for Everything You Create" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@iveosite" />
    <meta name="twitter:title" content="${escapeHtml(MAIN_SEO_TITLE)}" />
    <meta name="twitter:description" content="${escapeHtml(MAIN_SEO_DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />
    <script type="application/ld+json">${safeJsonLd(orgJsonLd)}</script>
    <script type="application/ld+json">${safeJsonLd(websiteJsonLd)}</script>
    <script type="application/ld+json">${safeJsonLd(faqJsonLd)}</script>`;
}

export async function buildProfileSeoPayload(
  requestOrigin: string,
  page: PublicPageServerData
): Promise<{ headTags: string; ssrBodyHtml: string; decision: IndexabilityDecision }> {
  const canonicalOrigin = getCanonicalSiteOrigin();
  const canonical = pageAddress(canonicalOrigin, page.username);
  const pageVersion = await version(page);
  const name = page.displayName || `@${page.username}`;
  const pageTitle = buildProfileSeoTitle(page);
  const pageDescription = buildProfileSeoDescription(page);

  const decision = evaluateProfileIndexability({
    username: page.username,
    status: page.status || 'active',
    isPublished: page.isPublished !== false,
    hideFromSearch: page.hideFromSearch,
  });

  const ogImg = ogImageAddress(requestOrigin, page.username, pageVersion);

  const blocks = await dbGetBlocks(page.username).catch(() => []);
  const now = new Date();
  const activePublicBlocks = (blocks || []).filter((b: any) => {
    if (!b || b.isActive === false || b.isArchived) return false;
    if (b.isProtected) return false;
    if (b.startAt && new Date(b.startAt) > now) return false;
    if (b.endAt && new Date(b.endAt) <= now) return false;
    return true;
  });

  const publicLinks = activePublicBlocks.filter((b: any) => b.url);

  // Build sameAs strictly from verified / user-provided social profile links + OAuth-connected embed profiles
  const verifiedSocialUrls: string[] = Object.entries(page.socials || {})
    .filter(([, u]) => typeof u === 'string' && u.trim().length > 0)
    .map(([plat, u]) => normalizeSocialUrl(plat.toLowerCase().trim(), String(u)));

  for (const b of activePublicBlocks) {
    if (
      b.url &&
      (b.embedMeta?.connectedViaOAuth === true ||
        b.kind === 'youtube' ||
        b.kind === 'bluesky')
    ) {
      const formatted = String(b.url).trim();
      if (/^https?:\/\//i.test(formatted)) {
        verifiedSocialUrls.push(formatted);
      }
    }
  }

  const sameAs = Array.from(
    new Set(verifiedSocialUrls.filter((u) => /^https?:\/\//i.test(u)))
  );

  const personEntity: Record<string, unknown> = {
    '@type': 'Person',
    '@id': `${canonical}#person`,
    name,
    alternateName: [page.username, `@${page.username}`],
    identifier: page.username,
    url: canonical,
  };
  const truthfulBio = page.bio?.trim() || '';
  if (truthfulBio || pageDescription) {
    personEntity.description = truthfulBio || pageDescription;
  }
  if (page.avatarUrl) {
    personEntity.image = page.avatarUrl.startsWith('/')
      ? `${canonicalOrigin}${page.avatarUrl}`
      : page.avatarUrl;
  }
  if (sameAs.length > 0) {
    personEntity.sameAs = sameAs;
  }

  const profilePageJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${canonical}#profile`,
    url: canonical,
    name: pageTitle,
    description: pageDescription,
    inLanguage: 'en',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    mainEntity: personEntity,
  };
  if (page.updatedAt) {
    profilePageJsonLd.dateModified = page.updatedAt;
  }

  const linkListJsonLd =
    publicLinks.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${name} links and projects`,
          numberOfItems: Math.min(publicLinks.length, 30),
          itemListElement: publicLinks.slice(0, 30).map((b: any, idx: number) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: String(b.title || b.url),
            url: String(b.url),
          })),
        }
      : null;

  const { buildProfileSsrHeadTags } = await import('../../src/lib/blockTheme.ts');
  const ssrThemeTags = buildProfileSsrHeadTags({
    vibeId: page.vibeId,
    buttonShape: page.buttonShape || null,
    buttonColors: page.buttonColors || null,
    background: page.background || null,
    layoutSettings: page.layoutSettings || null,
    fontSettings: page.fontSettings || null,
    appearance: page.appearance || null,
    isPro: Boolean(page.isPro),
  });

  const bootstrapLinks = (blocks || [])
    .filter((b: any) => {
      if (!b || b.isActive === false || b.isArchived) return false;
      if (b.startAt && new Date(b.startAt) > now) return false;
      if (b.endAt && new Date(b.endAt) <= now) return false;
      return true;
    })
    .map((b: any) => ({
      id: b.id,
      kind: b.kind,
      title: b.title || '',
      url: b.isProtected ? null : (b.url || null),
      icon: b.icon || null,
      thumbnailPath: b.thumbnailPath || null,
      thumbnailUrl: b.thumbnailUrl || null,
      layout: b.layout || 'classic',
      embedProvider: b.embedProvider || null,
      embedMeta: b.embedMeta || null,
      isProtected: Boolean(b.isProtected),
      signup: b.signup || null,
      tipJar: b.tipJar || null,
      coffee: b.coffee || null,
      faq: b.faq || null,
      vcard: b.vcard || null,
      animation: b.animation || null,
      badge: b.badge || null,
      youtube: b.youtube || null,
      product: b.product || null,
      booking: b.booking || null,
      countdown: b.countdown || null,
      promo: b.promo || null,
      location: b.location || null,
      download: b.download || null,
      bluesky: b.bluesky || null,
    }));

  const ssrBootstrapPayload = {
    profile: {
      username: page.username,
      displayName: page.displayName || `@${page.username}`,
      bio: page.bio || '',
      avatarUrl: page.avatarUrl || null,
      avatarType: page.avatarType,
      avatarId: page.avatarId || null,
      vibeId: page.vibeId || 'clean',
      plan: page.plan || (page.isPro ? 'pro' : 'free'),
      isPro: Boolean(page.isPro),
      isVerified: Boolean(page.isVerified ?? page.isPro),
      isOwnerProfile: Boolean(page.isOwnerProfile),
      buttonShape: page.buttonShape || null,
      socials: page.socials || {},
      socialsPosition: page.socialsPosition || 'top',
      hideFromSearch: Boolean(page.hideFromSearch),
      hideFooter: Boolean(page.hideFooter && page.isPro),
      background: page.background || null,
      whatsappNumber: page.whatsappNumber || null,
      customSeoTitle: page.customSeoTitle || null,
      customSeoDescription: page.customSeoDescription || null,
      fontSettings: page.fontSettings || null,
      buttonColors: page.buttonColors || null,
      layoutSettings: page.layoutSettings || null,
      businessCard: page.businessCard || null,
      appearance: page.appearance || null,
      updatedAt: page.updatedAt || null,
    },
    links: bootstrapLinks,
  };

  const verifications = buildVerificationMetaTags();
  const headTags = `${ssrThemeTags}
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <meta name="robots" content="${escapeHtml(decision.robotsDirective)}" />
    ${verifications}
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Iveo" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(name)}'s personal profile on Iveo" />
    <meta property="profile:username" content="${escapeHtml(page.username)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@iveosite" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />
    <script id="iveo-profile-jsonld" type="application/ld+json">${safeJsonLd(profilePageJsonLd)}</script>${
    linkListJsonLd
      ? `\n    <script id="iveo-profile-links-jsonld" type="application/ld+json">${safeJsonLd(linkListJsonLd)}</script>`
      : ''
  }
    <script id="iveo-ssr-bootstrap" type="application/json">${safeJsonLd(ssrBootstrapPayload)}</script>`;

  const resolvedAvatar = page.avatarUrl
    ? (page.avatarUrl.startsWith('/') ? `${requestOrigin}${page.avatarUrl}` : page.avatarUrl)
    : null;

  const ssrLinksHtml = publicLinks
    .slice(0, 30)
    .map(
      (b: any) =>
        `<li><a href="${escapeHtml(String(b.url))}" rel="noopener noreferrer">${escapeHtml(String(b.title || b.url))}</a></li>`
    )
    .join('');

  // Semantic HTML for active non-link content blocks (headers, FAQs, products, locations, bookings)
  const ssrRichBlocksHtml = activePublicBlocks
    .slice(0, 30)
    .map((b: any) => {
      if (b.kind === 'header' && b.title) {
        return `<h3>${escapeHtml(String(b.title))}</h3>`;
      }
      if (b.kind === 'faq' && Array.isArray(b.faq?.items) && b.faq.items.length > 0) {
        const qa = b.faq.items
          .filter((item: any) => item && item.question && item.answer)
          .slice(0, 10)
          .map(
            (item: any) =>
              `<dt>${escapeHtml(String(item.question))}</dt><dd>${escapeHtml(String(item.answer))}</dd>`
          )
          .join('');
        return qa ? `<section><h3>${escapeHtml(String(b.title || 'FAQ'))}</h3><dl>${qa}</dl></section>` : '';
      }
      if (b.kind === 'product' && (b.title || b.product?.description)) {
        return `<article><h3>${escapeHtml(String(b.title || 'Featured item'))}</h3>${
          b.product?.description ? `<p>${escapeHtml(String(b.product.description))}</p>` : ''
        }</article>`;
      }
      if (b.kind === 'location' && (b.location?.address || b.title)) {
        return `<p>${escapeHtml(String(b.title || ''))}${
          b.location?.address ? ` — ${escapeHtml(String(b.location.address))}` : ''
        }</p>`;
      }
      if (b.kind === 'booking' && (b.title || b.booking?.description)) {
        return `<article><h3>${escapeHtml(String(b.title || 'Booking'))}</h3>${
          b.booking?.description ? `<p>${escapeHtml(String(b.booking.description))}</p>` : ''
        }</article>`;
      }
      return '';
    })
    .filter(Boolean)
    .join('');

  const ssrSocialsHtml = Object.entries(page.socials || {})
    .filter(([, val]) => typeof val === 'string' && val.trim().length > 0)
    .map(([plat, val]) => {
      const href = normalizeSocialUrl(plat.toLowerCase().trim(), String(val));
      return `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer me">${escapeHtml(plat)}</a></li>`;
    })
    .join('');

  const ssrBodyHtml = `<main id="iveo-ssr-profile" class="iveo-ssr-only" data-username="${escapeHtml(page.username)}">
    <header>
      ${resolvedAvatar ? `<img src="${escapeHtml(resolvedAvatar)}" alt="${escapeHtml(name)} (@${escapeHtml(page.username)}) profile photo" width="96" height="96" />` : ''}
      <h1>${escapeHtml(name)}</h1>
      <p>@${escapeHtml(page.username)}</p>
      ${page.bio ? `<p>${escapeHtml(page.bio)}</p>` : ''}
    </header>
    ${ssrSocialsHtml ? `<nav aria-label="Social profiles"><ul>${ssrSocialsHtml}</ul></nav>` : ''}
    ${ssrLinksHtml ? `<section aria-label="Links"><h2>Links &amp; Projects</h2><ul>${ssrLinksHtml}</ul></section>` : ''}
    ${ssrRichBlocksHtml ? `<section aria-label="Featured content">${ssrRichBlocksHtml}</section>` : ''}
    <footer><a href="${escapeHtml(canonicalOrigin)}/">Create your own Iveo page</a> · <a href="${escapeHtml(canonicalOrigin)}/discover">Discover creators</a></footer>
  </main>`;

  return { headTags, ssrBodyHtml, decision };
}

export async function buildDiscoverSsrHtml(requestOrigin: string, pageNum: number = 1): Promise<string> {
  const canonicalOrigin = getCanonicalSiteOrigin();
  const profiles = await getAllUnifiedProfiles();
  const allEligible = profiles.filter((p) => evaluateProfileIndexability(p).indexable);
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(allEligible.length / pageSize));
  const safePage = Math.max(1, Math.min(pageNum, totalPages));
  const start = (safePage - 1) * pageSize;
  const eligible = allEligible.slice(start, start + pageSize);

  const items = eligible
    .map(
      (p) =>
        `<li><a href="${escapeHtml(pageAddress(requestOrigin, p.username))}">${escapeHtml(p.displayName || `@${p.username}`)} (@${escapeHtml(p.username)})</a>${p.bio ? ` — ${escapeHtml(truncate(p.bio, 110))}` : ''}</li>`
    )
    .join('');

  const navLinks: string[] = [];
  if (safePage > 1) {
    const prevHref = safePage === 2 ? '/discover' : `/discover?page=${safePage - 1}`;
    navLinks.push(`<a href="${escapeHtml(prevHref)}" rel="prev">Previous page</a>`);
  }
  if (safePage < totalPages) {
    navLinks.push(`<a href="/discover?page=${safePage + 1}" rel="next">Next page</a>`);
  }

  return `<main id="iveo-ssr-discover" style="max-width:860px;margin:48px auto;padding:24px;font-family:system-ui,sans-serif;">
    <h1>Discover Creators on Iveo</h1>
    <p>Explore public creator profiles, digital portfolios, and link pages hosted on Iveo.</p>
    <ul>${items}</ul>
    ${navLinks.length > 0 ? `<nav aria-label="Pagination">${navLinks.join(' · ')}</nav>` : ''}
    <footer><a href="${escapeHtml(canonicalOrigin)}/">Back to Iveo home</a></footer>
  </main>`;
}

export function buildNotFoundProfileResult(origin: string, cleanSegment: string): {
  tags: string;
  ssrBodyHtml: string;
  httpStatus: 404;
} {
  const safeSeg = escapeHtml(cleanSegment.replace(/^@+/, ''));
  const ogImg = ogImageAddress(origin);
  const tags = `<title>Page not found (@${safeSeg}) | Iveo</title>
    <meta name="description" content="This Iveo profile could not be found." />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Iveo" />
    <meta property="og:title" content="Page not found | Iveo" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />`;

  const ssrBodyHtml = `<main id="iveo-ssr-404" style="max-width:560px;margin:64px auto;padding:24px;font-family:system-ui,sans-serif;text-align:center;">
    <h1>Profile not found</h1>
    <p>No active Iveo page exists at iveo.site/@${safeSeg}.</p>
    <p><a href="/">Claim iveo.site/@${safeSeg}</a> or <a href="/discover">discover creators on Iveo</a>.</p>
  </main>`;

  return { tags, ssrBodyHtml, httpStatus: 404 };
}

export function buildRobotsTxt(origin: string): string {
  const cleanOrigin = origin.replace(/\/$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /@*',
    'Allow: /discover',
    'Allow: /api/og',
    'Disallow: /api/',
    'Disallow: /dashboard',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /onboarding',
    'Disallow: /account',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /sso-callback',
    '',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    `Sitemap: ${cleanOrigin}/sitemap-pages.xml`,
    `Sitemap: ${cleanOrigin}/sitemap-profiles.xml`,
  ].join('\n');
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly';
  priority: string;
}

export async function collectStaticSitemapEntries(origin: string): Promise<SitemapEntry[]> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];
  const entries = new Map<string, SitemapEntry>();

  entries.set(`${cleanOrigin}/`, {
    loc: `${cleanOrigin}/`,
    lastmod: today,
    changefreq: 'daily',
    priority: '1.0',
  });

  for (const staticPath of [...PUBLIC_INFO_ROUTES]) {
    entries.set(`${cleanOrigin}/${staticPath}`, {
      loc: `${cleanOrigin}/${staticPath}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: staticPath === 'discover' ? '0.9' : '0.6',
    });
  }

  return Array.from(entries.values());
}

export async function collectProfileSitemapEntries(origin: string): Promise<{
  entries: SitemapEntry[];
  indexableProfiles: number;
  excludedProfiles: number;
}> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];
  const entries = new Map<string, SitemapEntry>();

  const allProfiles = await getAllUnifiedProfiles();
  let indexableProfiles = 0;
  let excludedProfiles = 0;

  for (const prof of allProfiles) {
    const decision = evaluateProfileIndexability(prof);
    if (!decision.indexable) {
      excludedProfiles += 1;
      continue;
    }

    indexableProfiles += 1;
    const loc = `${cleanOrigin}/@${encodeURIComponent(prof.username.replace(/^@+/, ''))}`;
    const lastmod =
      typeof prof.updatedAt === 'string' && prof.updatedAt.length >= 10
        ? prof.updatedAt.slice(0, 10)
        : today;

    entries.set(loc, {
      loc,
      lastmod,
      changefreq: 'daily',
      priority: '0.8',
    });
  }

  return {
    entries: Array.from(entries.values()),
    indexableProfiles,
    excludedProfiles,
  };
}

export async function collectSitemapEntries(origin: string): Promise<{
  entries: SitemapEntry[];
  indexableProfiles: number;
  excludedProfiles: number;
}> {
  const staticEntries = await collectStaticSitemapEntries(origin);
  const { entries: profileEntries, indexableProfiles, excludedProfiles } =
    await collectProfileSitemapEntries(origin);

  return {
    entries: [...staticEntries, ...profileEntries],
    indexableProfiles,
    excludedProfiles,
  };
}

function renderUrlsetXml(entries: SitemapEntry[]): string {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escXml(e.loc)}</loc>\n    <lastmod>${escXml(e.lastmod)}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export async function generatePagesSitemapXml(origin: string): Promise<{ xml: string; totalUrls: number }> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const entries = await collectStaticSitemapEntries(cleanOrigin);
  const xml = renderUrlsetXml(entries);
  sitemapState.cachedXml.set('pages', { xml, createdAt: Date.now() });
  return { xml, totalUrls: entries.length };
}

export async function generateProfilesSitemapXml(
  origin: string,
  pageNum: number = 1,
  pageSize: number = DEFAULT_SITEMAP_PAGE_SIZE
): Promise<{ xml: string; found: boolean; totalProfiles: number }> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const { entries } = await collectProfileSitemapEntries(cleanOrigin);
  const start = (pageNum - 1) * pageSize;
  if (pageNum < 1 || (entries.length > 0 && start >= entries.length) || (entries.length === 0 && pageNum > 1)) {
    return { xml: '', found: false, totalProfiles: entries.length };
  }
  const slice = entries.slice(start, start + pageSize);
  const xml = renderUrlsetXml(slice);
  return { xml, found: true, totalProfiles: entries.length };
}

export async function generateSitemapXml(
  origin: string,
  pageSize: number = DEFAULT_SITEMAP_PAGE_SIZE
): Promise<{ xml: string; totalUrls: number; pages: number; isIndex: boolean }> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const [staticEntries, profileResult] = await Promise.all([
    collectStaticSitemapEntries(cleanOrigin),
    collectProfileSitemapEntries(cleanOrigin),
  ]);
  const totalUrls = staticEntries.length + profileResult.entries.length;
  const profilePages = Math.max(1, Math.ceil(profileResult.entries.length / pageSize));
  const pages = 1 + profilePages;

  sitemapState.lastGeneratedAt = new Date().toISOString();
  sitemapState.totalUrls = totalUrls;
  sitemapState.indexableProfiles = profileResult.indexableProfiles;
  sitemapState.excludedProfiles = profileResult.excludedProfiles;
  sitemapState.sitemapPages = pages;

  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const today = new Date().toISOString().split('T')[0];

  const childSitemaps: string[] = [
    `  <sitemap>\n    <loc>${escXml(`${cleanOrigin}/sitemap-pages.xml`)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
  ];

  if (profilePages === 1) {
    childSitemaps.push(
      `  <sitemap>\n    <loc>${escXml(`${cleanOrigin}/sitemap-profiles.xml`)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
    );
  } else {
    for (let i = 1; i <= profilePages; i += 1) {
      childSitemaps.push(
        `  <sitemap>\n    <loc>${escXml(`${cleanOrigin}/sitemap-profiles-${i}.xml`)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${childSitemaps.join('\n')}\n</sitemapindex>`;
  sitemapState.cachedXml.set('root', { xml, createdAt: Date.now() });
  return { xml, totalUrls, pages, isIndex: true };
}

export async function generateSitemapPageXml(
  origin: string,
  pageNum: number,
  pageSize: number = DEFAULT_SITEMAP_PAGE_SIZE
): Promise<{ xml: string; found: boolean }> {
  if (pageNum === 1) {
    const pagesRes = await generatePagesSitemapXml(origin);
    const profilesRes = await collectProfileSitemapEntries(origin);
    return {
      xml: renderUrlsetXml([...(await collectStaticSitemapEntries(origin)), ...profilesRes.entries.slice(0, pageSize)]),
      found: Boolean(pagesRes.xml),
    };
  }
  const { entries } = await collectSitemapEntries(origin);
  const start = (pageNum - 1) * pageSize;
  if (pageNum < 1 || start >= entries.length) {
    return { xml: '', found: false };
  }
  const slice = entries.slice(start, start + pageSize);
  return { xml: renderUrlsetXml(slice), found: true };
}

export async function buildLlmsTxt(origin: string): Promise<string> {
  const cleanOrigin = origin.replace(/\/$/, '');
  const profiles = await getAllUnifiedProfiles();
  const eligible = profiles.filter((p) => evaluateProfileIndexability(p).indexable).slice(0, 50);

  const lines: string[] = [
    '# Iveo',
    '',
    '> Iveo is a personal link-in-bio, creator portfolio, and digital business card platform.',
    '',
    '## Core Pages',
    `- [Home](${cleanOrigin}/): Claim your Iveo @username page`,
    `- [Discover Creators](${cleanOrigin}/discover): Directory of public Iveo creator profiles`,
    `- [Pricing](${cleanOrigin}/pricing): Plans and creator features`,
    `- [Sitemap Index](${cleanOrigin}/sitemap.xml): XML sitemap index for pages and creator profiles`,
    `- [Pages Sitemap](${cleanOrigin}/sitemap-pages.xml): Platform marketing and legal URLs`,
    `- [Profiles Sitemap](${cleanOrigin}/sitemap-profiles.xml): Public iveo.site/@username profiles`,
    '',
    '## Public Creator Profiles',
    ...eligible.map(
      (p) =>
        `- [${p.displayName || `@${p.username}`} (@${p.username})](${cleanOrigin}/@${encodeURIComponent(
          p.username.replace(/^@+/, '')
        )})${p.bio ? `: ${p.bio.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`
    ),
  ];

  return lines.join('\n');
}

export async function validateProfileSeo(origin: string, username: string) {
  const clean = (username || '').toLowerCase().trim();
  const canonicalOrigin = getCanonicalSiteOrigin();
  const segmentKind = classifySegment(clean);

  if (!clean || segmentKind === 'private' || segmentKind === 'invalid') {
    return {
      username: clean,
      found: false,
      indexable: false,
      httpStatus: 404,
      reason: segmentKind === 'private' ? 'private_route' : 'invalid_username',
      canonical: null,
      title: null,
      description: null,
      issues: [
        {
          username: clean,
          severity: 'error' as const,
          code: 'not_found_or_private',
          message: 'Username is invalid or reserved as a private application route.',
        },
      ],
    };
  }

  const page = await loadPublicPage(clean);
  if (!page) {
    return {
      username: clean,
      found: false,
      indexable: false,
      httpStatus: 404,
      reason: 'not_found',
      canonical: null,
      title: null,
      description: null,
      issues: [
        {
          username: clean,
          severity: 'error' as const,
          code: 'profile_not_found',
          message: 'No active public profile exists for this username (returns HTTP 404 + noindex).',
        },
      ],
    };
  }

  const payload = await buildProfileSeoPayload(origin, page);
  const title = buildProfileSeoTitle(page);
  const description = buildProfileSeoDescription(page);
  const canonical = pageAddress(canonicalOrigin, page.username);

  const issues: ProfileSeoIssue[] = [];
  if (!page.bio || page.bio.trim().length < 20) {
    issues.push({
      username: page.username,
      severity: 'warning',
      code: 'short_or_missing_bio',
      message: 'Bio is short or empty; fallback SEO description is used.',
    });
  }
  if (!page.avatarUrl) {
    issues.push({
      username: page.username,
      severity: 'info',
      code: 'default_avatar_og',
      message: 'Using dynamic monogram OG card because no custom avatar photo is uploaded.',
    });
  }
  if (!payload.decision.indexable) {
    issues.push({
      username: page.username,
      severity: 'warning',
      code: payload.decision.reason,
      message: `Profile is excluded from search indexing (${payload.decision.reason}).`,
    });
  }

  return {
    username: page.username,
    displayName: page.displayName,
    found: true,
    indexable: payload.decision.indexable,
    httpStatus: payload.decision.httpStatus,
    robotsDirective: payload.decision.robotsDirective,
    reason: payload.decision.reason,
    canonical,
    title,
    description,
    ogImage: ogImageAddress(origin, page.username),
    issues,
  };
}

export async function getSeoHealthReport(origin: string) {
  const allProfiles = await getAllUnifiedProfiles();
  await generateSitemapXml(origin);

  let indexableCount = 0;
  let nonIndexableCount = 0;
  let missingBioCount = 0;
  let missingAvatarCount = 0;
  const issues: ProfileSeoIssue[] = [];
  const profileSummaries: Array<{
    username: string;
    displayName: string;
    status: string;
    indexable: boolean;
    reason: string;
    hasBio: boolean;
    hasAvatar: boolean;
    customSeo: boolean;
    updatedAt: string;
  }> = [];

  for (const prof of allProfiles) {
    const decision = evaluateProfileIndexability(prof);
    if (decision.indexable) {
      indexableCount += 1;
    } else {
      nonIndexableCount += 1;
    }

    const hasBio = Boolean(prof.bio && prof.bio.trim().length >= 15);
    const hasAvatar = Boolean(prof.avatarUrl);
    if (!hasBio) {
      missingBioCount += 1;
      if (decision.indexable) {
        issues.push({
          username: prof.username,
          severity: 'warning',
          code: 'missing_bio',
          message: 'Public profile is missing a bio (recommended 50–150 characters for rich search snippets).',
        });
      }
    }
    if (!hasAvatar) {
      missingAvatarCount += 1;
    }
    if (!decision.indexable) {
      issues.push({
        username: prof.username,
        severity: 'info',
        code: decision.reason,
        message: `Excluded from sitemap & Google Search (${decision.reason}).`,
      });
    }

    profileSummaries.push({
      username: prof.username,
      displayName: prof.displayName,
      status: prof.status,
      indexable: decision.indexable,
      reason: decision.reason,
      hasBio,
      hasAvatar,
      customSeo: Boolean(prof.customSeoTitle || prof.customSeoDescription),
      updatedAt: prof.updatedAt,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    canonicalDomain: getCanonicalSiteOrigin(),
    metrics: {
      totalProfiles: allProfiles.length,
      indexableProfiles: indexableCount,
      nonIndexableProfiles: nonIndexableCount,
      missingBioCount,
      missingAvatarCount,
    },
    sitemap: {
      url: `${getCanonicalSiteOrigin()}/sitemap.xml`,
      totalUrls: sitemapState.totalUrls,
      pages: sitemapState.sitemapPages,
      lastGeneratedAt: sitemapState.lastGeneratedAt,
      lastInvalidatedAt: sitemapState.lastInvalidatedAt,
      lastInvalidationReason: sitemapState.lastInvalidationReason,
    },
    searchEngines: getSearchEngineStatus(),
    issues: issues.slice(0, 50),
    profiles: profileSummaries.slice(0, 100),
  };
}

export async function regenerateAndPingSitemap(origin: string) {
  invalidateSitemapCache('manual_admin_regenerate');
  const sitemapResult = await generateSitemapXml(origin);
  const submitResult = await submitSitemapsToSearchEngines();
  return {
    ok: true,
    sitemap: {
      totalUrls: sitemapResult.totalUrls,
      pages: sitemapResult.pages,
      isIndex: sitemapResult.isIndex,
      generatedAt: sitemapState.lastGeneratedAt,
    },
    submission: submitResult,
  };
}

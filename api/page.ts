import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSiteOrigin } from './_lib/env.ts';
import { classifySegment, normalizeUsername } from './_lib/usernames.ts';
import { escapeHtml, truncate, safeJsonLd, injectHead } from './_lib/html.ts';
import { loadPublicPage, version, type PublicPageServerData } from './_lib/publicPage.ts';
import { pageAddress, ogImageAddress } from './_lib/site.ts';

const GENERIC_TITLE = 'iveo: one link for everything you make';
const GENERIC_DESCRIPTION =
  'iveo gives you one calm, customizable page for all your links. Claim your name, pick a vibe and share it anywhere. Free to start.';

const PRIVATE_ROUTE_LABELS: Record<string, string> = {
  login: 'Log in',
  signup: 'Create your account',
  dashboard: 'Dashboard',
  onboarding: 'Welcome',
  account: 'Account',
};

async function getShellTemplate(origin: string): Promise<{ template: string; isFallback: boolean }> {
  // 1. Try reading dist/index.html from filesystem
  try {
    const distPath = path.join(process.cwd(), 'dist', 'index.html');
    const content = await readFile(distPath, 'utf8');
    if (content && content.includes('</head>')) {
      return { template: content, isFallback: false };
    }
  } catch {
    // Filesystem read failed, try fetch
  }

  // 2. Try fetching from origin
  try {
    const res = await fetch(`${origin}/index.html`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('</head>')) {
        return { template: text, isFallback: false };
      }
    }
  } catch {
    // Fetch failed
  }

  // 3. Minimal fallback template
  const fallback = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(origin)}/" />
</head>
<body>
  <noscript><p>Redirecting to <a href="${escapeHtml(origin)}/">iveo</a>...</p></noscript>
</body>
</html>`;

  return { template: fallback, isFallback: true };
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request, false);
}

export async function HEAD(request: Request): Promise<Response> {
  return handleRequest(request, true);
}

export async function POST(): Promise<Response> {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  });
}

async function handleRequest(request: Request, isHead: boolean): Promise<Response> {
  const origin = getSiteOrigin(request);
  const url = new URL(request.url);
  const rawSegment = url.searchParams.get('u') || '';
  const segmentKind = classifySegment(rawSegment);

  const { template, isFallback } = await getShellTemplate(origin);

  let pageData: PublicPageServerData | null = null;
  let pageVersion = '1';
  let supabaseFailed = false;

  if (segmentKind === 'username') {
    const cleanUser = normalizeUsername(rawSegment);
    if (cleanUser) {
      try {
        pageData = await loadPublicPage(cleanUser);
        if (pageData) {
          pageVersion = await version(pageData);
        }
      } catch {
        supabaseFailed = true;
      }
    }
  }

  let tags = '';
  let cacheControl = 'public, s-maxage=300, stale-while-revalidate=3600';

  if (pageData) {
    // 5.3 Found Public Page Case
    const name = pageData.displayName || `@${pageData.username}`;
    const pageTitle = `${truncate(name, 60)} | iveo`;
    const pageDescription = pageData.bio
      ? truncate(pageData.bio, 160)
      : `Links by @${pageData.username} on iveo.`;
    const canonical = pageAddress(origin, pageData.username);
    const robots = pageData.hideFromSearch ? 'noindex, nofollow' : 'index, follow';
    const ogImg = ogImageAddress(origin, pageData.username, pageVersion);

    const mainEntity: Record<string, unknown> = {
      '@type': 'Person',
      name: name,
      alternateName: `@${pageData.username}`,
      url: canonical,
    };
    if (pageData.bio) {
      mainEntity.description = pageData.bio;
    }
    if (pageData.avatarUrl) {
      mainEntity.image = pageData.avatarUrl;
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity,
    };

    tags = `<title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="iveo" />
    <meta property="og:title" content="${escapeHtml(name)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${escapeHtml(name)}'s page on iveo" />
    <meta property="profile:username" content="${escapeHtml(pageData.username)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(name)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />
    <script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`;

    cacheControl = 'public, s-maxage=60, stale-while-revalidate=600';
  } else {
    // Generic / Route Cases
    let robots = 'noindex';
    let title = GENERIC_TITLE;
    let canonical = '';

    if (segmentKind === 'private') {
      const routeLabel = PRIVATE_ROUTE_LABELS[rawSegment.toLowerCase()] || 'Dashboard';
      title = `${routeLabel} | iveo`;
      robots = 'noindex, nofollow';
    } else if (segmentKind === 'info') {
      robots = 'index, follow';
      canonical = `${origin}/`;
    }

    const ogImg = ogImageAddress(origin);

    tags = `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="iveo" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta property="og:url" content="${escapeHtml(origin)}/" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="iveo: one link for everything you make" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`;

    cacheControl = 'public, s-maxage=300, stale-while-revalidate=3600';
  }

  if (isFallback || supabaseFailed) {
    cacheControl = 'no-store';
  }

  const finalHtml = injectHead(template, tags);

  return new Response(isHead ? null : finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

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

/**
 * Default export handler for Vercel Serverless Function runner and Node/Express
 */
export default async function handler(req: any, res?: any): Promise<Response | void> {
  // 1. Web Standard API (Request -> Response)
  if (req instanceof Request || (req && typeof req.text === 'function' && !res)) {
    const isHead = (req.method || '').toUpperCase() === 'HEAD';
    return handleRequest(req, isHead);
  }

  // 2. Node / Express Serverless Function (IncomingMessage, ServerResponse)
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'POST') {
      if (res && typeof res.status === 'function') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).end();
      }
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const isHead = method === 'HEAD';
    const protocol = (req.headers && req.headers['x-forwarded-proto']) || 'https';
    const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'iveo.site';
    const url = `${protocol}://${host}${req.url || '/'}`;

    const headers = new Headers();
    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, String(value));
          }
        }
      }
    }

    const webRequest = new Request(url, {
      method,
      headers,
    });

    const webResponse = await handleRequest(webRequest, isHead);

    if (res && typeof res.status === 'function') {
      res.status(webResponse.status);
      webResponse.headers.forEach((val: string, key: string) => {
        res.setHeader(key, val);
      });
      if (isHead || !webResponse.body) {
        return res.end();
      }
      const text = await webResponse.text();
      return res.send(text);
    }

    return webResponse;
  } catch (err: any) {
    if (res && typeof res.status === 'function') {
      return res.status(500).send('Internal Server Error');
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}


export async function resolveSeoHeadForSegment(
  origin: string,
  rawSegment: string
): Promise<{ tags: string; cacheControl: string; failed: boolean; foundProfile: boolean }> {
  const segmentKind = classifySegment(rawSegment);
  let pageData: PublicPageServerData | null = null;
  let pageVersion = '1';
  let failed = false;

  if (segmentKind === 'username' || segmentKind === 'reserved') {
    const cleanUser = normalizeUsername(rawSegment);
    if (cleanUser) {
      try {
        pageData = await loadPublicPage(cleanUser);
        if (pageData) {
          pageVersion = await version(pageData);
        }
      } catch {
        failed = true;
      }
    }
  }

  if (pageData) {
    const name = pageData.displayName || `@${pageData.username}`;
    const pageTitle = pageData.customSeoTitle
      ? truncate(pageData.customSeoTitle, 70)
      : `${truncate(name, 54)} (@${pageData.username}) | iveo`;
    const pageDescription = pageData.customSeoDescription
      ? truncate(pageData.customSeoDescription, 160)
      : pageData.bio
      ? truncate(pageData.bio, 160)
      : `Explore links & updates by ${name} (@${pageData.username}) on iveo.`;
    const canonical = pageAddress(origin, pageData.username);
    const robots = pageData.hideFromSearch ? 'noindex, nofollow' : 'index, follow';
    const ogImg = pageData.avatarUrl?.startsWith('http')
      ? pageData.avatarUrl
      : ogImageAddress(origin, pageData.username, pageVersion);

    const sameAs = Object.values(pageData.socials || {})
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`));

    const mainEntity: Record<string, unknown> = {
      '@type': 'Person',
      name,
      alternateName: `@${pageData.username}`,
      url: canonical,
    };
    if (pageDescription) {
      mainEntity.description = pageDescription;
    }
    if (pageData.avatarUrl) {
      mainEntity.image = pageData.avatarUrl.startsWith('/')
        ? `${origin}${pageData.avatarUrl}`
        : pageData.avatarUrl;
    }
    if (sameAs.length > 0) {
      mainEntity.sameAs = sameAs;
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity,
    };

    const tags = `<title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="iveo" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(name)}'s page on iveo" />
    <meta property="profile:username" content="${escapeHtml(pageData.username)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />
    <script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`;

    return {
      tags,
      cacheControl: 'public, s-maxage=60, stale-while-revalidate=600',
      failed,
      foundProfile: true,
    };
  }

  // Generic / Route Cases
  let robots = rawSegment ? 'noindex' : 'index, follow';
  let title = GENERIC_TITLE;
  let canonical = rawSegment ? '' : `${origin}/`;

  if (segmentKind === 'private') {
    const routeLabel = PRIVATE_ROUTE_LABELS[rawSegment.toLowerCase()] || 'Dashboard';
    title = `${routeLabel} | iveo`;
    robots = 'noindex, nofollow';
  } else if (segmentKind === 'info') {
    robots = 'index, follow';
    canonical = `${origin}/${rawSegment.toLowerCase()}`;
  }

  const ogImg = ogImageAddress(origin);
  const tags = `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ''}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="iveo" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta property="og:url" content="${escapeHtml(canonical || `${origin}/`)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="iveo: one link for everything you make" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(GENERIC_DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`;

  return {
    tags,
    cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600',
    failed,
    foundProfile: false,
  };
}

async function handleRequest(request: Request, isHead: boolean): Promise<Response> {
  const origin = getSiteOrigin(request);
  const url = new URL(request.url);
  const rawSegment = url.searchParams.get('u') || '';

  const { template, isFallback } = await getShellTemplate(origin);
  const { tags, cacheControl: baseCacheControl, failed } = await resolveSeoHeadForSegment(origin, rawSegment);
  const cacheControl = (isFallback || failed) ? 'no-store' : baseCacheControl;

  const finalHtml = injectHead(template, tags);

  return new Response(isHead ? null : finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

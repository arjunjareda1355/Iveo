import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSiteOrigin } from './_lib/env.ts';
import { classifySegment, normalizeUsername } from './_lib/usernames.ts';
import { escapeHtml, injectHead, injectRootSsr } from './_lib/html.ts';
import { loadPublicPage, type PublicPageServerData } from './_lib/publicPage.ts';
import { dbGetRedirectTarget } from './_lib/azureSql.ts';
import { ogImageAddress } from './_lib/site.ts';
import {
  buildDiscoverSsrHtml,
  buildMainDomainHeadTags,
  buildNotFoundProfileResult,
  buildProfileSeoPayload,
  MAIN_SEO_DESCRIPTION,
  MAIN_SEO_TITLE,
} from './_lib/seoService.ts';

const PRIVATE_ROUTE_LABELS: Record<string, string> = {
  login: 'Log in',
  signup: 'Create your account',
  dashboard: 'Dashboard',
  onboarding: 'Welcome',
  account: 'Account',
  admin: 'Admin',
};

const PUBLIC_INFO_META: Record<string, { title: string; description: string }> = {
  discover: {
    title: 'Discover Creators & Public Profiles | Iveo',
    description: 'Browse creators, designers, musicians, and builders on Iveo. Explore curated link pages and projects across iveo.site.',
  },
  pricing: {
    title: 'Pricing – Free & Pro Plans | Iveo',
    description: 'Start free with unlimited links and custom vibes, or upgrade to Iveo Pro for custom fonts, advanced analytics, business cards, and SEO tools.',
  },
  privacy: {
    title: 'Privacy Policy | Iveo',
    description: 'Read how Iveo protects creator and visitor data, analytics privacy, and account ownership.',
  },
  terms: {
    title: 'Terms of Service | Iveo',
    description: 'Terms and acceptable use policies for Iveo personal pages and creator tools.',
  },
  legal: {
    title: 'Legal Information | Iveo',
    description: 'Legal notices, ownership, and compliance details for Iveo (iveo.site).',
  },
  report: {
    title: 'Report a Page | Iveo',
    description: 'Report a suspicious, impersonating, or policy-violating Iveo profile page for Trust & Safety review.',
  },
};

async function getShellTemplate(origin: string): Promise<{ template: string; isFallback: boolean }> {
  try {
    const distPath = path.join(process.cwd(), 'dist', 'index.html');
    const content = await readFile(distPath, 'utf8');
    if (content && content.includes('</head>')) {
      return { template: content, isFallback: false };
    }
  } catch {}

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
  } catch {}

  const fallback = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(MAIN_SEO_TITLE)}</title>
</head>
<body>
  <div id="root"></div>
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

export default async function handler(req: any, res?: any): Promise<Response | void> {
  if (req instanceof Request || (req && typeof req.text === 'function' && !res)) {
    const isHead = (req.method || '').toUpperCase() === 'HEAD';
    return handleRequest(req, isHead);
  }

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

    const webRequest = new Request(url, { method, headers });
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
  } catch {
    if (res && typeof res.status === 'function') {
      return res.status(500).send('Internal Server Error');
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function resolveSeoHeadForSegment(
  origin: string,
  rawSegment: string,
  options?: { pageNum?: number }
): Promise<{
  tags: string;
  ssrBodyHtml: string;
  cacheControl: string;
  failed: boolean;
  foundProfile: boolean;
  httpStatus: 200 | 404 | 301;
  redirectLocation?: string;
}> {
  const cleanFull = (rawSegment || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  const firstSegment = cleanFull.split('/')[0] || '';

  if (firstSegment === 'embed') {
    const rawUser = cleanFull.split('/')[1] || '';
    const cleanUser = rawUser.replace(/^@+/, '');
    const title = cleanUser ? `@${cleanUser} Embed | Iveo` : 'Iveo Profile Embed';
    const ogImg = cleanUser ? `${origin}/api/og?u=${encodeURIComponent(cleanUser)}` : ogImageAddress(origin);
    const tags = `<title>${escapeHtml(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />`;
    return {
      tags,
      ssrBodyHtml: '',
      cacheControl: 'public, s-maxage=120, stale-while-revalidate=600',
      failed: false,
      foundProfile: false,
      httpStatus: 200,
    };
  }

  if (!cleanFull || ['@vite', '@react-refresh', '@fs', '@id'].includes(firstSegment)) {
    return {
      tags: buildMainDomainHeadTags(origin),
      ssrBodyHtml: '',
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600',
      failed: false,
      foundProfile: false,
      httpStatus: 200,
    };
  }

  const hasAtPrefix = firstSegment.startsWith('@');
  const segmentKind = classifySegment(firstSegment);
  let pageData: PublicPageServerData | null = null;
  let failed = false;

  if (hasAtPrefix && (segmentKind === 'username' || segmentKind === 'reserved') && !cleanFull.includes('/')) {
    const cleanUser = normalizeUsername(firstSegment);
    if (cleanUser) {
      try {
        pageData = await loadPublicPage(cleanUser);
      } catch {
        failed = true;
      }

      if (!pageData && !failed) {
        const redirectTarget = await dbGetRedirectTarget(cleanUser).catch(() => null);
        if (redirectTarget) {
          return {
            tags: '',
            ssrBodyHtml: '',
            cacheControl: 'public, max-age=300',
            failed: false,
            foundProfile: false,
            httpStatus: 301,
            redirectLocation: `/@${encodeURIComponent(redirectTarget.replace(/^@+/, ''))}`,
          };
        }
      }
    }
  }

  if (pageData) {
    const { headTags, ssrBodyHtml, decision } = await buildProfileSeoPayload(origin, pageData);
    return {
      tags: headTags,
      ssrBodyHtml,
      cacheControl: decision.indexable
        ? 'public, s-maxage=60, stale-while-revalidate=600'
        : 'no-store',
      failed,
      foundProfile: true,
      httpStatus: decision.httpStatus,
    };
  }

  if (segmentKind === 'private') {
    const routeLabel = PRIVATE_ROUTE_LABELS[firstSegment] || 'Dashboard';
    const title = `${routeLabel} | Iveo`;
    const ogImg = ogImageAddress(origin);
    const tags = `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(MAIN_SEO_DESCRIPTION)}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Iveo" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />`;
    return {
      tags,
      ssrBodyHtml: '',
      cacheControl: 'no-store',
      failed,
      foundProfile: false,
      httpStatus: 200,
    };
  }

  if (segmentKind === 'info') {
    const meta = PUBLIC_INFO_META[firstSegment] || {
      title: MAIN_SEO_TITLE,
      description: MAIN_SEO_DESCRIPTION,
    };
    const pageNum = Math.max(1, Number(options?.pageNum || 1) || 1);
    const canonical =
      firstSegment === 'discover' && pageNum > 1
        ? `https://iveo.site/discover?page=${pageNum}`
        : `https://iveo.site/${firstSegment}`;
    const ogImg = ogImageAddress(origin);
    const ssrBodyHtml =
      firstSegment === 'discover' ? await buildDiscoverSsrHtml(origin, pageNum) : '';
    const pageSuffix = firstSegment === 'discover' && pageNum > 1 ? ` (Page ${pageNum})` : '';
    const resolvedTitle =
      pageSuffix && meta.title.includes(' | Iveo')
        ? meta.title.replace(' | Iveo', `${pageSuffix} | Iveo`)
        : `${meta.title}${pageSuffix}`;
    const tags = `<title>${escapeHtml(resolvedTitle)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Iveo" />
    <meta property="og:title" content="${escapeHtml(resolvedTitle)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta property="og:image:type" content="image/png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@iveosite" />
    <meta name="twitter:title" content="${escapeHtml(resolvedTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`;
    return {
      tags,
      ssrBodyHtml,
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600',
      failed,
      foundProfile: false,
      httpStatus: 200,
    };
  }

  // Nonexistent / deleted / suspended / invalid profile route -> proper HTTP 404 + noindex
  const notFound = buildNotFoundProfileResult(origin, cleanFull);
  return {
    tags: notFound.tags,
    ssrBodyHtml: notFound.ssrBodyHtml,
    cacheControl: 'no-store',
    failed,
    foundProfile: false,
    httpStatus: 404,
  };
}

async function handleRequest(request: Request, isHead: boolean): Promise<Response> {
  const origin = getSiteOrigin(request);
  const url = new URL(request.url);
  const rawSegment = url.searchParams.get('u') || '';
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);

  const resolved = await resolveSeoHeadForSegment(origin, rawSegment, {
    pageNum: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
  });
  if (resolved.httpStatus === 301 && resolved.redirectLocation) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: resolved.redirectLocation,
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const { template, isFallback } = await getShellTemplate(origin);
  const cacheControl = isFallback || resolved.failed ? 'no-store' : resolved.cacheControl;

  let finalHtml = injectHead(template, resolved.tags);
  if (resolved.ssrBodyHtml) {
    finalHtml = injectRootSsr(finalHtml, resolved.ssrBodyHtml);
  }

  return new Response(isHead ? null : finalHtml, {
    status: resolved.httpStatus,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}


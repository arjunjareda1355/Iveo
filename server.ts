import 'dotenv/config';
import express from 'express';
type ExpressReq = express.Request;
type ExpressRes = express.Response;
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const distPath = path.resolve(__dirname, 'dist');
const hasBuiltDist = fs.existsSync(path.resolve(distPath, 'index.html'));
const isProd =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.K_REVISION) ||
  Boolean(process.env.CLOUD_RUN_JOB) ||
  hasBuiltDist;

// Built-in gzip compression for text/JSON/JS/CSS/SVG responses (>= 1KB)
app.use((req, res, next) => {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (req.method === 'HEAD' || !/\bgzip\b/i.test(acceptEncoding)) {
    return next();
  }

  const origSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (
      res.headersSent ||
      res.getHeader('Content-Encoding') ||
      body === undefined ||
      body === null
    ) {
      return origSend(body);
    }

    const ct = String(res.getHeader('Content-Type') || '').toLowerCase();
    const isCompressibleType =
      !ct ||
      ct.includes('text/') ||
      ct.includes('json') ||
      ct.includes('javascript') ||
      ct.includes('xml') ||
      ct.includes('svg');

    if (!isCompressibleType) {
      return origSend(body);
    }

    const buf = Buffer.isBuffer(body)
      ? body
      : typeof body === 'string'
        ? Buffer.from(body)
        : Buffer.from(JSON.stringify(body));

    if (buf.byteLength < 1024) {
      return origSend(body);
    }

    try {
      if (!ct && typeof body === 'object' && !Buffer.isBuffer(body)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      const compressed = zlib.gzipSync(buf, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      return origSend(compressed);
    } catch {
      return origSend(body);
    }
  }) as any;

  next();
});

// Support JSON bodies (including up to 5MB base64 background uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Allow WebAuthn passkey creation/get in top-level and self-origin contexts (skip /embed widgets)
app.use((req, res, next) => {
  if (!req.path.startsWith('/embed')) {
    res.setHeader(
      'Permissions-Policy',
      'publickey-credentials-create=(self), publickey-credentials-get=(self)'
    );
  }
  next();
});

/**
 * Adapts standard Web Request/Response handlers for Express
 */
function adaptWebHandler(
  handler: (request: Request) => Promise<Response>
) {
  return async (req: ExpressReq, res: ExpressRes) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${port}`;
      const url = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      let body: any = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      }

      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body,
      });

      const webResponse = await handler(webRequest);

      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (webResponse.body) {
        const buffer = await webResponse.arrayBuffer();
        res.send(Buffer.from(buffer));
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('API handler error:', err);
      res.status(500).json({ error: 'internal_server_error', message: err?.message });
    }
  };
}

async function startServer() {
  // 0. Container Health Checks
  app.get('/_health', (_req, res) => res.status(200).send('ok'));
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));

  // 1. Razorpay API routes
  const razorpayModule = await import('./api/razorpay.ts');
  const clerkWebhookModule = await import('./api/clerk-webhook.ts');
  const checkUsernameModule = await import('./api/check-username.ts');

  app.post('/api/razorpay/create-order', adaptWebHandler(razorpayModule.handleCreateOrder));
  app.post('/api/razorpay/verify-payment', adaptWebHandler(razorpayModule.handleVerifyPayment));
  app.post('/api/razorpay/webhook', adaptWebHandler(razorpayModule.handleWebhook));
  app.post('/api/clerk-webhook', adaptWebHandler(clerkWebhookModule.POST));
  app.get('/api/check-username', adaptWebHandler(checkUsernameModule.GET));
  app.post('/api/check-username', adaptWebHandler(checkUsernameModule.POST));

  // 2. OpenGraph dynamic image (SVG banner styled to user's Vibe + embedded real avatar)
  app.get('/api/og', async (req, res) => {
    const escapeXml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const loadAvatarDataUri = async (avatarUrl: string | null, username: string): Promise<string | null> => {
      if (!avatarUrl) return null;
      if (avatarUrl.startsWith('data:image/') && avatarUrl.length < 1_500_000) {
        return avatarUrl;
      }
      if (avatarUrl.startsWith('/api/avatar/')) {
        try {
          const avatarFile = path.resolve(process.cwd(), 'data', 'avatars', `${username}.jpg`);
          if (fs.existsSync(avatarFile)) {
            const buf = fs.readFileSync(avatarFile);
            if (buf.byteLength < 1_200_000) {
              return `data:image/jpeg;base64,${buf.toString('base64')}`;
            }
          }
        } catch {}
      }
      if (/^https?:\/\//i.test(avatarUrl)) {
        try {
          const parsed = new URL(avatarUrl);
          const hn = parsed.hostname.toLowerCase();
          if (hn === 'localhost' || hn.startsWith('127.') || hn.startsWith('10.') || hn.startsWith('192.168.') || hn.startsWith('169.254.')) {
            return null;
          }
          const imgRes = await fetch(parsed.toString(), { signal: AbortSignal.timeout(2500) });
          if (!imgRes.ok) return null;
          const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
          if (!ct.startsWith('image/')) return null;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.byteLength > 1_200_000) return null;
          const mime = ct.split(';')[0] || 'image/jpeg';
          return `data:${mime};base64,${buf.toString('base64')}`;
        } catch {
          return null;
        }
      }
      return null;
    };

    try {
      const { normalizeUsername } = await import('./api/_lib/usernames.ts');
      const { loadPublicPage } = await import('./api/_lib/publicPage.ts');
      const { getServerVibe } = await import('./api/_lib/vibes.ts');

      const rawUser = typeof req.query.u === 'string' ? req.query.u : '';
      const username = normalizeUsername(rawUser);
      const page = username ? await loadPublicPage(username) : null;

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');

      if (!page) {
        return res.status(200).send(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FAFAFA"/><text x="96" y="290" font-family="Inter,system-ui,sans-serif" font-size="112" font-weight="700" letter-spacing="-4" fill="#0A0A0A">iveo</text><text x="96" y="365" font-family="Inter,system-ui,sans-serif" font-size="38" fill="#666666">One link for everything you create.</text></svg>`
        );
      }

      const vibe = getServerVibe(page.vibeId);
      const safeName = escapeXml((page.displayName || `@${page.username}`).slice(0, 36));
      const safeHandle = escapeXml(`@${page.username}`);
      const safeBio = escapeXml((page.bio || `Links & projects by @${page.username}`).slice(0, 88));
      const initials = escapeXml((page.displayName || page.username).slice(0, 2).toUpperCase());
      const avatarDataUri = await loadAvatarDataUri(page.avatarUrl, page.username);

      const avatarMarkup = avatarDataUri
        ? `<defs><clipPath id="ogAvatarClip"><circle cx="176" cy="216" r="88"/></clipPath></defs><circle cx="176" cy="216" r="90" fill="${escapeXml(vibe.avatarBg)}"/><image href="${escapeXml(avatarDataUri)}" x="88" y="128" width="176" height="176" clip-path="url(#ogAvatarClip)" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="176" cy="216" r="88" fill="${escapeXml(vibe.avatarBg)}"/><text x="176" y="236" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="700" fill="${escapeXml(vibe.text)}">${initials}</text>`;

      return res.status(200).send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
          <rect width="1200" height="630" fill="${escapeXml(vibe.bg)}"/>
          ${avatarMarkup}
          <text x="304" y="198" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="700" fill="${escapeXml(vibe.text)}">${safeName}</text>
          <text x="304" y="252" font-family="ui-monospace,monospace" font-size="30" fill="${escapeXml(vibe.muted)}">${safeHandle}</text>
          <text x="96" y="395" font-family="Inter,system-ui,sans-serif" font-size="30" fill="${escapeXml(vibe.muted)}">${safeBio}</text>
          <line x1="96" y1="496" x2="1104" y2="496" stroke="${escapeXml(vibe.muted)}" stroke-opacity="0.22" stroke-width="2"/>
          <text x="96" y="556" font-family="ui-monospace,monospace" font-size="26" fill="${escapeXml(vibe.muted)}">iveo.site/@${escapeXml(page.username)}</text>
          <text x="1104" y="556" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="36" font-weight="700" letter-spacing="-1.5" fill="${escapeXml(vibe.text)}">iveo</text>
        </svg>`
      );
    } catch {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FAFAFA"/><text x="100" y="300" font-family="sans-serif" font-size="72" font-weight="bold" fill="#0A0A0A">iveo</text><text x="100" y="380" font-family="sans-serif" font-size="36" fill="#666666">One link for everything you create.</text></svg>`
      );
    }
  });

  // 3. SSR Page metadata
  app.get('/api/page', async (req, res) => {
    try {
      const pageModule = await import('./api/page.ts');
      const handler = adaptWebHandler(pageModule.GET);
      return handler(req, res);
    } catch (err: any) {
      res.status(500).json({ error: 'page_error', message: err?.message });
    }
  });

  // 4. Azure SQL & Backend Persistence Routes
  const dbHandlers = await import('./api/_lib/db-handlers.ts');
  const dataHandlerModule = await import('./api/data.ts');
  app.all('/api/data', (req, res) => dataHandlerModule.default(req, res));
  app.get('/api/db/readiness', dbHandlers.handleDbReadiness);
  app.get('/api/public-page', dbHandlers.handleGetPublicPage);
  app.post('/api/claim-username', dbHandlers.handleClaimUsername);
  app.get('/api/me', dbHandlers.handleGetMe);
  app.post('/api/migrate-legacy', dbHandlers.handleMigrateLegacy);
  app.post('/api/profile', dbHandlers.handleSaveProfile);
  app.post('/api/avatar', dbHandlers.handleUploadAvatar);
  app.get('/api/avatar/:username', dbHandlers.handleServeAvatar);
  app.post('/api/background/upload', dbHandlers.handleUploadBackground);
  app.get('/api/backgrounds/:username/:file', dbHandlers.handleServeBackground);
  app.get('/api/blocks', dbHandlers.handleGetBlocks);
  app.post('/api/blocks', dbHandlers.handleSaveBlocks);
  app.post('/api/contacts', dbHandlers.handleSaveContact);
  app.get('/api/contacts', dbHandlers.handleGetContacts);
  app.delete('/api/contacts', dbHandlers.handleDeleteContacts);
  app.post('/api/analytics/event', dbHandlers.handleRecordAnalyticsEvent);
  app.get('/api/analytics', dbHandlers.handleGetAnalytics);
  app.get('/api/integrations/buymeacoffee', dbHandlers.handleBuyMeACoffee);
  app.get('/api/integrations/youtube', dbHandlers.handleYouTubeShowcase);
  app.get('/api/integrations/embed', dbHandlers.handleSocialEmbedLookup);
  app.get('/api/oauth/youtube/url', dbHandlers.handleYouTubeOAuthUrl);
  app.get(['/api/oauth/youtube/callback', '/api/oauth/youtube/callback/'], dbHandlers.handleYouTubeOAuthCallback);
  app.get('/api/oauth/:provider/url', dbHandlers.handleSocialOAuthUrl);
  app.get(['/api/oauth/:provider/callback', '/api/oauth/:provider/callback/'], dbHandlers.handleSocialOAuthCallback);
  app.get('/api/subscription', dbHandlers.handleGetSubscription);
  app.post('/api/subscription/cancel', dbHandlers.handleCancelSubscription);
  app.post('/api/subscription/reactivate', dbHandlers.handleReactivateSubscription);
  app.get('/api/discover', dbHandlers.handleDiscoverProfiles);
  app.get('/api/seo/admin/overview', dbHandlers.handleSeoAdminOverview);
  app.post('/api/seo/admin/regenerate-sitemap', dbHandlers.handleSeoAdminRegenerate);
  app.get('/api/seo/admin/validate', dbHandlers.handleSeoAdminValidate);
  app.post('/api/seo/admin/inspect', dbHandlers.handleSeoAdminInspect);
  app.post('/api/seo/admin/moderate-background', dbHandlers.handleSeoAdminModerateBackground);
  app.post('/api/unlock-link', dbHandlers.handleUnlockLink);
  app.post('/api/link-password', dbHandlers.handleSetLinkPassword);
  app.get('/api/link-password/status', dbHandlers.handleGetProtectedLinkIds);
  app.post('/api/account/delete', dbHandlers.handleDeleteAccount);

  // 4.1 Safe CORS image proxy for HD Canvas business card export (external avatars)
  app.get('/api/proxy-image', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({ error: 'missing_url' });
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'invalid_url' });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ error: 'invalid_protocol' });
    }
    const hostname = parsed.hostname.toLowerCase();
    // SSRF protections: block localhost, link-local, metadata, and private IPv4/IPv6 ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^fc00:|^fe80:/i.test(hostname)
    ) {
      return res.status(403).json({ error: 'forbidden_host' });
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        signal: AbortSignal.timeout(4500),
        headers: {
          Accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/*;q=0.8',
        },
      });
      if (!upstream.ok) {
        return res.status(502).json({ error: 'upstream_failed', status: upstream.status });
      }
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ error: 'not_an_image' });
      }
      const contentLength = Number(upstream.headers.get('content-length') || '0');
      if (contentLength > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'image_too_large' });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'image_too_large' });
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(buf);
    } catch {
      return res.status(504).json({ error: 'proxy_timeout' });
    }
  });

  // 4.5 Subdomain to Path Redirect Handler (Legacy https://:username.iveo.site -> https://iveo.site/:username)
  const { RESERVED, USERNAME_PATTERN } = await import('./api/_lib/usernames.ts');
  app.use((req, res, next) => {
    const host = (req.get('host') || '').toLowerCase().split(':')[0];
    if (host.endsWith('.iveo.site') && host !== 'iveo.site' && host !== 'www.iveo.site') {
      const candidate = host.slice(0, -'.iveo.site'.length);
      if (!RESERVED.has(candidate) && USERNAME_PATTERN.test(candidate)) {
        const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        const pathSuffix = req.path === '/' ? '' : req.path;
        return res.redirect(301, `https://iveo.site/@${candidate}${pathSuffix}${queryString}`);
      }
    }
    next();
  });

  // 4.6 SEO: robots.txt, categorized sitemaps, llms.txt, and IndexNow verification file
  const { getCanonicalSiteOrigin, getIndexNowKey } = await import('./api/_lib/env.ts');
  const {
    buildLlmsTxt,
    buildRobotsTxt,
    generatePagesSitemapXml,
    generateProfilesSitemapXml,
    generateSitemapPageXml,
    generateSitemapXml,
  } = await import('./api/_lib/seoService.ts');

  const resolveRequestOrigin = (req: ExpressReq) => {
    const host = req.get('host') || 'iveo.site';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    if (host.includes('localhost') || host.startsWith('127.')) {
      return `${protocol}://${host}`;
    }
    return getCanonicalSiteOrigin();
  };

  app.get('/robots.txt', (req, res) => {
    const origin = resolveRequestOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.status(200).send(buildRobotsTxt(origin));
  });

  app.get('/llms.txt', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const txt = await buildLlmsTxt(origin);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
      res.status(200).send(txt);
    } catch {
      res.status(500).send('# Iveo\n');
    }
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const { xml } = await generateSitemapXml(origin);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.status(200).send(xml);
    } catch {
      res.status(500).send('Sitemap generation error');
    }
  });

  app.get('/sitemap-pages.xml', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const { xml } = await generatePagesSitemapXml(origin);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(xml);
    } catch {
      return res.status(500).send('Pages sitemap error');
    }
  });

  app.get('/sitemap-profiles.xml', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req);
      const { xml } = await generateProfilesSitemapXml(origin, 1);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(xml);
    } catch {
      return res.status(500).send('Profiles sitemap error');
    }
  });

  app.get('/sitemap-profiles-:page.xml', async (req, res) => {
    const pageNum = parseInt(req.params.page, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) {
      return res.status(404).send('Not found');
    }
    try {
      const origin = resolveRequestOrigin(req);
      const { xml, found } = await generateProfilesSitemapXml(origin, pageNum);
      if (!found) {
        return res.status(404).send('Profiles sitemap page not found');
      }
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(xml);
    } catch {
      return res.status(500).send('Profiles sitemap error');
    }
  });

  app.get('/sitemap-:page.xml', async (req, res) => {
    const pageNum = parseInt(req.params.page, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) {
      return res.status(404).send('Not found');
    }
    try {
      const origin = resolveRequestOrigin(req);
      const { xml, found } = await generateSitemapPageXml(origin, pageNum);
      if (!found) {
        return res.status(404).send('Sitemap page not found');
      }
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return res.status(200).send(xml);
    } catch {
      return res.status(500).send('Sitemap page error');
    }
  });

  app.get('/:verificationKey.txt', (req, res, next) => {
    const configuredKey = getIndexNowKey();
    if (configuredKey && req.params.verificationKey === configuredKey) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(configuredKey);
    }
    return next();
  });

  const { resolveSeoHeadForSegment } = await import('./api/page.ts');
  const { injectHead, injectRootSsr } = await import('./api/_lib/html.ts');
  const { isUserPageLocation } = await import('./src/lib/intro.ts');

  const stripSiteIntroMarkup = (html: string): string => {
    return html
      .replace(/<style id="iveo-intro-css">[\s\S]*?<\/style>/i, '')
      .replace(/<div id="iveo-intro"[\s\S]*?<div class="iv-edge"><\/div>\s*<\/div>/i, '')
      .replace(/<script id="iveo-intro-js">[\s\S]*?<\/script>/i, '');
  };

  const applySsrSeoTags = async (
    req: ExpressReq,
    html: string
  ): Promise<{ html: string; status: number; redirectLocation?: string }> => {
    const cleanPath = (req.path || '/').replace(/^\/+|\/+$/g, '');
    const host = (req.get('host') || '').toLowerCase();
    const qIndex = req.originalUrl.indexOf('?');
    const search = qIndex !== -1 ? req.originalUrl.slice(qIndex) : '';
    const isUserPage = isUserPageLocation({
      pathname: req.path || '/',
      hostname: host,
      search,
    });

    let resultHtml = html;
    if (isUserPage) {
      resultHtml = stripSiteIntroMarkup(resultHtml);
    }

    // Ignore static asset requests containing file extensions (e.g. .svg, .js, .css, .png)
    if (cleanPath && cleanPath.includes('.')) {
      return { html: resultHtml, status: 200 };
    }

    const origin = resolveRequestOrigin(req);
    const resolved = await resolveSeoHeadForSegment(origin, cleanPath);

    if (resolved.httpStatus === 301 && resolved.redirectLocation) {
      return { html: resultHtml, status: 301, redirectLocation: resolved.redirectLocation };
    }

    if (
      resolved.foundProfile ||
      resolved.httpStatus === 404 ||
      cleanPath.startsWith('admin') ||
      cleanPath.startsWith('embed') ||
      cleanPath === 'report' ||
      cleanPath === 'discover'
    ) {
      resultHtml = stripSiteIntroMarkup(resultHtml);
    }

    if (resolved.tags) {
      resultHtml = injectHead(resultHtml, resolved.tags);
    }
    if (resolved.ssrBodyHtml) {
      resultHtml = injectRootSsr(resultHtml, resolved.ssrBodyHtml);
    }

    return { html: resultHtml, status: resolved.httpStatus };
  };

  app.use('/embed', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', 'frame-ancestors *;');
    next();
  });

  // 5. Vite Dev Server / Static SPA Fallback
  if (!isProd || !hasBuiltDist) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const ssr = await applySsrSeoTags(req, template);
        if (ssr.status === 301 && ssr.redirectLocation) {
          return res.redirect(301, ssr.redirectLocation);
        }
        return res.status(ssr.status).set({ 'Content-Type': 'text/html' }).end(ssr.html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const prodIndexPath = path.resolve(distPath, 'index.html');
    const cachedProdHtml = fs.existsSync(prodIndexPath)
      ? fs.readFileSync(prodIndexPath, 'utf-8')
      : '';

    // Cache hashed JS/CSS/SVG bundle files with gzip compression + 7-day immutable cache
    const assetsDir = path.resolve(distPath, 'assets');
    const gzipAssetCache = new Map<string, { gz: Buffer; contentType: string; etag: string }>();
    const ASSET_MIME: Record<string, string> = {
      '.js': 'application/javascript; charset=UTF-8',
      '.mjs': 'application/javascript; charset=UTF-8',
      '.css': 'text/css; charset=UTF-8',
      '.svg': 'image/svg+xml; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };

    app.use('/assets', (req, res, next) => {
      if (req.method !== 'GET') return next();
      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      if (!/\bgzip\b/i.test(acceptEncoding)) return next();

      const relPath = req.path.replace(/^\/+/, '');
      if (!relPath || relPath.includes('..') || relPath.includes('\0')) return next();
      const ext = path.extname(relPath).toLowerCase();
      const contentType = ASSET_MIME[ext];
      if (!contentType) return next();

      const fullPath = path.resolve(assetsDir, relPath);
      if (!fullPath.startsWith(assetsDir + path.sep) && fullPath !== assetsDir) return next();

      let cached = gzipAssetCache.get(relPath);
      if (!cached) {
        if (!fs.existsSync(fullPath)) return next();
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile() || stat.size < 1024) return next();
          const raw = fs.readFileSync(fullPath);
          const gz = zlib.gzipSync(raw, { level: 6 });
          const etag = `W/"${stat.size}-${stat.mtimeMs}-gz"`;
          cached = { gz, contentType, etag };
          gzipAssetCache.set(relPath, cached);
        } catch {
          return next();
        }
      }

      if (req.headers['if-none-match'] === cached.etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('ETag', cached.etag);
      return res.status(200).end(cached.gz);
    });

    app.use(
      '/assets',
      express.static(assetsDir, {
        index: false,
        maxAge: '7d',
        immutable: true,
      })
    );
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));

    app.get('*', async (req, res) => {
      try {
        const template = cachedProdHtml || fs.readFileSync(prodIndexPath, 'utf-8');
        const ssr = await applySsrSeoTags(req, template);
        if (ssr.status === 301 && ssr.redirectLocation) {
          return res.redirect(301, ssr.redirectLocation);
        }
        return res.status(ssr.status).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(ssr.html);
      } catch {
        if (fs.existsSync(prodIndexPath)) {
          return res.sendFile(prodIndexPath);
        }
        return res.status(503).type('text/plain').send('Application build not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `iveo server running on http://0.0.0.0:${port} (${isProd && hasBuiltDist ? 'prod' : 'dev'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import express from 'express';
type ExpressReq = express.Request;
type ExpressRes = express.Response;
import path from 'node:path';
import fs from 'node:fs';
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

// Support JSON bodies for API requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  // 2. OpenGraph dynamic image (fast Node-native SVG banner styled to user's active Vibe)
  app.get('/api/og', async (req, res) => {
    const escapeXml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    try {
      const { normalizeUsername } = await import('./api/_lib/usernames.ts');
      const { loadPublicPage } = await import('./api/_lib/publicPage.ts');
      const { getServerVibe } = await import('./api/_lib/vibes.ts');

      const rawUser = typeof req.query.u === 'string' ? req.query.u : '';
      const username = normalizeUsername(rawUser);
      const page = username ? await loadPublicPage(username) : null;

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

      if (!page) {
        return res.status(200).send(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FAFAFA"/><text x="96" y="290" font-family="Inter,system-ui,sans-serif" font-size="112" font-weight="700" letter-spacing="-4" fill="#0A0A0A">iveo</text><text x="96" y="365" font-family="Inter,system-ui,sans-serif" font-size="38" fill="#666666">One link for everything you make.</text></svg>`
        );
      }

      const vibe = getServerVibe(page.vibeId);
      const safeName = escapeXml((page.displayName || `@${page.username}`).slice(0, 36));
      const safeHandle = escapeXml(`@${page.username}`);
      const safeBio = escapeXml((page.bio || `Links & projects by @${page.username}`).slice(0, 88));
      const initials = escapeXml((page.displayName || page.username).slice(0, 2).toUpperCase());

      return res.status(200).send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
          <rect width="1200" height="630" fill="${escapeXml(vibe.bg)}"/>
          <circle cx="176" cy="216" r="88" fill="${escapeXml(vibe.avatarBg)}"/>
          <text x="176" y="236" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="700" fill="${escapeXml(vibe.text)}">${initials}</text>
          <text x="304" y="198" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="700" fill="${escapeXml(vibe.text)}">${safeName}</text>
          <text x="304" y="252" font-family="ui-monospace,monospace" font-size="30" fill="${escapeXml(vibe.muted)}">${safeHandle}</text>
          <text x="96" y="395" font-family="Inter,system-ui,sans-serif" font-size="30" fill="${escapeXml(vibe.muted)}">${safeBio}</text>
          <line x1="96" y1="496" x2="1104" y2="496" stroke="${escapeXml(vibe.muted)}" stroke-opacity="0.22" stroke-width="2"/>
          <text x="96" y="556" font-family="ui-monospace,monospace" font-size="26" fill="${escapeXml(vibe.muted)}">iveo.site/${escapeXml(page.username)}</text>
          <text x="1104" y="556" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="36" font-weight="700" letter-spacing="-1.5" fill="${escapeXml(vibe.text)}">iveo</text>
        </svg>`
      );
    } catch {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FAFAFA"/><text x="100" y="300" font-family="sans-serif" font-size="72" font-weight="bold" fill="#0A0A0A">iveo</text><text x="100" y="380" font-family="sans-serif" font-size="36" fill="#666666">One link for everything you make.</text></svg>`
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
  app.get('/api/blocks', dbHandlers.handleGetBlocks);
  app.post('/api/blocks', dbHandlers.handleSaveBlocks);
  app.post('/api/contacts', dbHandlers.handleSaveContact);
  app.get('/api/contacts', dbHandlers.handleGetContacts);
  app.delete('/api/contacts', dbHandlers.handleDeleteContacts);
  app.post('/api/unlock-link', dbHandlers.handleUnlockLink);
  app.post('/api/link-password', dbHandlers.handleSetLinkPassword);
  app.post('/api/account/delete', dbHandlers.handleDeleteAccount);

  // 4.5 Subdomain to Path Redirect Handler (Legacy https://:username.iveo.site -> https://iveo.site/:username)
  const { RESERVED, USERNAME_PATTERN } = await import('./api/_lib/usernames.ts');
  app.use((req, res, next) => {
    const host = (req.get('host') || '').toLowerCase().split(':')[0];
    if (host.endsWith('.iveo.site') && host !== 'iveo.site' && host !== 'www.iveo.site') {
      const candidate = host.slice(0, -'.iveo.site'.length);
      if (!RESERVED.has(candidate) && USERNAME_PATTERN.test(candidate)) {
        const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        const pathSuffix = req.path === '/' ? '' : req.path;
        return res.redirect(301, `https://iveo.site/${candidate}${pathSuffix}${queryString}`);
      }
    }
    next();
  });

  // 4.6 SEO: robots.txt and dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host') || 'iveo.site';
    const origin = host.includes('localhost') || host.startsWith('127.') ? `${protocol}://${host}` : 'https://iveo.site';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /dashboard',
        'Disallow: /onboarding',
        'Disallow: /account',
        'Disallow: /login',
        'Disallow: /signup',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', async (req, res) => {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host') || 'iveo.site';
    const origin = host.includes('localhost') || host.startsWith('127.') ? `${protocol}://${host}` : 'https://iveo.site';
    const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const urls = new Map<string, string>();
    const today = new Date().toISOString().split('T')[0];
    urls.set(`${origin}/`, today);
    for (const staticPath of ['pricing', 'privacy', 'terms', 'legal']) {
      urls.set(`${origin}/${staticPath}`, today);
    }

    try {
      const { VIBES } = await import('./src/lib/vibes.ts');
      for (const v of VIBES) {
        if (v.persona?.handle) {
          urls.set(`${origin}/${v.persona.handle}`, today);
        }
      }
    } catch {}

    try {
      const storePath = path.resolve(__dirname, 'data', 'server_store.json');
      if (fs.existsSync(storePath)) {
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        const profiles = parsed?.profiles || {};
        for (const [uname, prof] of Object.entries<any>(profiles)) {
          if (uname && !prof?.hideFromSearch) {
            const lastmod = typeof prof?.updatedAt === 'string' && prof.updatedAt.length >= 10
              ? prof.updatedAt.slice(0, 10)
              : today;
            urls.set(`${origin}/${encodeURIComponent(uname.toLowerCase())}`, lastmod);
          }
        }
      }
    } catch {}

    const body = Array.from(urls.entries())
      .map(
        ([loc, lastmod]) =>
          `  <url>\n    <loc>${escXml(loc)}</loc>\n    <lastmod>${escXml(lastmod)}</lastmod>\n    <changefreq>daily</changefreq>\n  </url>`
      )
      .join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`
    );
  });

  const { resolveSeoHeadForSegment } = await import('./api/page.ts');
  const { injectHead } = await import('./api/_lib/html.ts');

  const applySsrSeoTags = async (req: ExpressReq, html: string): Promise<string> => {
    const cleanPath = (req.path || '/').replace(/^\/+|\/+$/g, '');
    // Single path segment without dots (e.g. /maya, /arjun) -> inject user or route SEO tags
    if (cleanPath && !cleanPath.includes('/') && !cleanPath.includes('.')) {
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || `localhost:${port}`;
      const origin = `${protocol}://${host}`;
      const { tags } = await resolveSeoHeadForSegment(origin, cleanPath);
      return injectHead(html, tags);
    }
    return html;
  };

  // 5. Vite Dev Server / Static SPA Fallback
  if (!isProd) {
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
        template = await applySsrSeoTags(req, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res) => {
      try {
        let template = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
        template = await applySsrSeoTags(req, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch {
        res.sendFile(path.resolve(distPath, 'index.html'));
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`iveo server running on http://0.0.0.0:${port} (${isProd ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

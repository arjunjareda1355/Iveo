import express, { Request as ExpressReq, Response as ExpressRes } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

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
  // 1. Razorpay API routes
  const createOrderModule = await import('./api/razorpay/create-order.ts');
  const verifyPaymentModule = await import('./api/razorpay/verify-payment.ts');
  const webhookModule = await import('./api/razorpay/webhook.ts');
  const clerkWebhookModule = await import('./api/clerk-webhook.ts');
  const checkUsernameModule = await import('./api/check-username.ts');

  app.post('/api/razorpay/create-order', adaptWebHandler(createOrderModule.POST));
  app.post('/api/razorpay/verify-payment', adaptWebHandler(verifyPaymentModule.POST));
  app.post('/api/razorpay/webhook', adaptWebHandler(webhookModule.POST));
  app.post('/api/clerk-webhook', adaptWebHandler(clerkWebhookModule.POST));
  app.get('/api/check-username', adaptWebHandler(checkUsernameModule.GET));
  app.post('/api/check-username', adaptWebHandler(checkUsernameModule.POST));

  // 2. OpenGraph dynamic image (with graceful SVG fallback in Node ESM dev)
  app.get('/api/og', async (req, res) => {
    try {
      const ogModule = await import('./api/og.ts');
      const handler = adaptWebHandler(ogModule.GET);
      return handler(req, res);
    } catch {
      // In dev environment where @vercel/og wasm requires Edge, fallback to clean svg banner
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(
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

  // 4. Vite Dev Server / Static SPA Fallback
  if (!isProd) {
    const fs = await import('node:fs');
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
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
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

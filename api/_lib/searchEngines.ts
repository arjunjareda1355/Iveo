import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getBingSiteVerification, getCanonicalSiteOrigin, getGoogleSiteVerification, getIndexNowKey } from './env.ts';

const TELEMETRY_PATH = path.resolve(process.cwd(), 'data', 'seo_telemetry.json');

export interface SearchEngineTelemetry {
  lastSitemapPingAt: string | null;
  lastSitemapPingResult: string | null;
  lastIndexNowAt: string | null;
  lastIndexNowUrls: string[];
  lastIndexNowStatus: string | null;
  recentEvents: Array<{
    at: string;
    action: string;
    target: string;
    status: string;
    detail?: string;
  }>;
}

function readTelemetry(): SearchEngineTelemetry {
  try {
    if (fs.existsSync(TELEMETRY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TELEMETRY_PATH, 'utf-8'));
      return {
        lastSitemapPingAt: parsed.lastSitemapPingAt || null,
        lastSitemapPingResult: parsed.lastSitemapPingResult || null,
        lastIndexNowAt: parsed.lastIndexNowAt || null,
        lastIndexNowUrls: Array.isArray(parsed.lastIndexNowUrls) ? parsed.lastIndexNowUrls : [],
        lastIndexNowStatus: parsed.lastIndexNowStatus || null,
        recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
      };
    }
  } catch {}
  return {
    lastSitemapPingAt: null,
    lastSitemapPingResult: null,
    lastIndexNowAt: null,
    lastIndexNowUrls: [],
    lastIndexNowStatus: null,
    recentEvents: [],
  };
}

function writeTelemetry(data: SearchEngineTelemetry): void {
  try {
    if (!fs.existsSync(path.dirname(TELEMETRY_PATH))) {
      fs.mkdirSync(path.dirname(TELEMETRY_PATH), { recursive: true });
    }
    fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export function appendSeoEvent(action: string, target: string, status: string, detail?: string): void {
  const current = readTelemetry();
  current.recentEvents.unshift({
    at: new Date().toISOString(),
    action,
    target,
    status,
    detail,
  });
  current.recentEvents = current.recentEvents.slice(0, 40);
  writeTelemetry(current);
}

export function getSearchEngineStatus() {
  const gscJsonRaw = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  const bingApiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const indexNowKey = getIndexNowKey();
  const googleVerification = getGoogleSiteVerification();
  const bingVerification = getBingSiteVerification();
  const telemetry = readTelemetry();

  let gscConfigured = false;
  let gscClientEmail: string | null = null;
  if (gscJsonRaw) {
    try {
      const parsed = JSON.parse(gscJsonRaw);
      if (parsed?.client_email && parsed?.private_key) {
        gscConfigured = true;
        gscClientEmail = String(parsed.client_email);
      }
    } catch {}
  }

  const siteUrl = getCanonicalSiteOrigin();
  const bingConfigured = Boolean(bingApiKey);
  const indexNowConfigured = Boolean(indexNowKey);

  return {
    siteUrl,
    gscConfigured,
    gscSiteUrl: siteUrl,
    bingConfigured,
    indexNowConfigured,
    recentSubmissions: telemetry.recentEvents.map((e) => ({
      engine: e.action,
      status: e.status,
      detail: e.detail ? `${e.target} (${e.detail})` : e.target,
      timestamp: e.at,
    })),
    googleSearchConsole: {
      configured: gscConfigured,
      verificationMetaConfigured: Boolean(googleVerification),
      serviceAccountEmail: gscClientEmail,
      indexingApiNote:
        'Google Search Console Sitemaps & URL Inspection API supported. Google Indexing API is intentionally NOT used for creator profiles per Google guidelines.',
    },
    bingWebmaster: {
      configured: bingConfigured,
      verificationMetaConfigured: Boolean(bingVerification),
    },
    indexNow: {
      configured: indexNowConfigured,
      keyFileUrl: indexNowKey ? `${siteUrl}/${indexNowKey}.txt` : null,
    },
    telemetry,
  };
}

/**
 * Generates a short-lived Google OAuth2 access token from Service Account JSON using Node crypto.
 */
async function getGscAccessToken(scope: string): Promise<{ token?: string; error?: string }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    return { error: 'GSC_SERVICE_ACCOUNT_JSON is not configured' };
  }

  try {
    const creds = JSON.parse(raw);
    if (!creds.client_email || !creds.private_key) {
      return { error: 'Invalid GSC_SERVICE_ACCOUNT_JSON (missing client_email or private_key)' };
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const signInput = `${header}.${payload}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(creds.private_key, 'base64url');
    const jwt = `${signInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      return { error: tokenJson?.error_description || tokenJson?.error || 'Failed to acquire GSC token' };
    }

    return { token: String(tokenJson.access_token) };
  } catch (err: any) {
    return { error: err?.message || 'GSC auth failed' };
  }
}

/**
 * Submits sitemap.xml to Google Search Console (when GSC_SERVICE_ACCOUNT_JSON is configured)
 * and Bing Webmaster Tools (when BING_WEBMASTER_API_KEY is configured).
 */
export async function submitSitemapsToSearchEngines(): Promise<{
  gsc: { attempted: boolean; ok: boolean; status: string };
  bing: { attempted: boolean; ok: boolean; status: string };
}> {
  const siteUrl = getCanonicalSiteOrigin();
  const feedPath = `${siteUrl}/sitemap.xml`;

  // 1. Google Search Console Sitemaps API (PUT)
  let gscResult = { attempted: false, ok: false, status: 'not_configured' };
  if (process.env.GSC_SERVICE_ACCOUNT_JSON?.trim()) {
    gscResult.attempted = true;
    const auth = await getGscAccessToken('https://www.googleapis.com/auth/webmasters');
    if (auth.token) {
      try {
        const gscUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(`${siteUrl}/`)}/sitemaps/${encodeURIComponent(feedPath)}`;
        const res = await fetch(gscUrl, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${auth.token}` },
          signal: AbortSignal.timeout(5000),
        });
        gscResult = {
          attempted: true,
          ok: res.ok,
          status: res.ok ? 'submitted_ok' : `http_${res.status}`,
        };
      } catch (err: any) {
        gscResult = { attempted: true, ok: false, status: err?.message || 'network_error' };
      }
    } else {
      gscResult = { attempted: true, ok: false, status: auth.error || 'auth_failed' };
    }
  }

  // 2. Bing Webmaster Sitemap Submission
  let bingResult = { attempted: false, ok: false, status: 'not_configured' };
  const bingKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (bingKey) {
    bingResult.attempted = true;
    try {
      const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitFeed?apikey=${encodeURIComponent(bingKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, feedUrl: feedPath }),
        signal: AbortSignal.timeout(5000),
      });
      bingResult = {
        attempted: true,
        ok: res.ok,
        status: res.ok ? 'submitted_ok' : `http_${res.status}`,
      };
    } catch (err: any) {
      bingResult = { attempted: true, ok: false, status: err?.message || 'network_error' };
    }
  }

  const telemetry = readTelemetry();
  telemetry.lastSitemapPingAt = new Date().toISOString();
  telemetry.lastSitemapPingResult = `GSC:${gscResult.status} | Bing:${bingResult.status}`;
  writeTelemetry(telemetry);
  appendSeoEvent('sitemap_submit', feedPath, telemetry.lastSitemapPingResult);

  return { gsc: gscResult, bing: bingResult };
}

/**
 * Inspects a live profile URL using Google Search Console URL Inspection API when configured.
 */
export async function inspectUrlWithGsc(targetUrl: string): Promise<{
  configured: boolean;
  ok: boolean;
  verdict?: string;
  coverageState?: string;
  lastCrawlTime?: string;
  error?: string;
}> {
  if (!process.env.GSC_SERVICE_ACCOUNT_JSON?.trim()) {
    return {
      configured: false,
      ok: false,
      error: 'GSC_SERVICE_ACCOUNT_JSON is not configured. Showing local indexability check instead.',
    };
  }

  const siteUrl = getCanonicalSiteOrigin();
  const auth = await getGscAccessToken('https://www.googleapis.com/auth/webmasters.readonly');
  if (!auth.token) {
    return { configured: true, ok: false, error: auth.error || 'GSC auth failed' };
  }

  try {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl: targetUrl,
        siteUrl: `${siteUrl}/`,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        error: json?.error?.message || `HTTP ${res.status}`,
      };
    }

    const indexStatus = json?.inspectionResult?.indexStatusResult || {};
    return {
      configured: true,
      ok: true,
      verdict: indexStatus.verdict || 'UNKNOWN',
      coverageState: indexStatus.coverageState || 'Unknown',
      lastCrawlTime: indexStatus.lastCrawlTime || undefined,
    };
  } catch (err: any) {
    return { configured: true, ok: false, error: err?.message || 'Inspection failed' };
  }
}

/**
 * Notifies IndexNow (Bing, Yandex, Naver, Seznam) + Bing Webmaster SubmitUrl about updated/deleted URLs.
 */
export async function notifyIndexNow(urls: string[]): Promise<{
  attempted: boolean;
  ok: boolean;
  status: string;
}> {
  const cleanUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, 100);
  if (cleanUrls.length === 0) {
    return { attempted: false, ok: false, status: 'no_urls' };
  }

  const siteUrl = getCanonicalSiteOrigin();
  const host = new URL(siteUrl).host;
  const key = getIndexNowKey();
  const bingKey = process.env.BING_WEBMASTER_API_KEY?.trim();

  let status = 'not_configured';
  let ok = false;
  let attempted = false;

  if (key) {
    attempted = true;
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${siteUrl}/${key}.txt`,
          urlList: cleanUrls,
        }),
        signal: AbortSignal.timeout(4500),
      });
      ok = res.ok || res.status === 202;
      status = ok ? `indexnow_${res.status}` : `indexnow_err_${res.status}`;
    } catch (err: any) {
      status = `indexnow_fail:${err?.message || 'timeout'}`;
    }
  } else if (bingKey) {
    attempted = true;
    try {
      const res = await fetch(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(bingKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, urlList: cleanUrls }),
          signal: AbortSignal.timeout(4500),
        }
      );
      ok = res.ok;
      status = ok ? 'bing_batch_ok' : `bing_err_${res.status}`;
    } catch (err: any) {
      status = `bing_fail:${err?.message || 'timeout'}`;
    }
  }

  const telemetry = readTelemetry();
  telemetry.lastIndexNowAt = new Date().toISOString();
  telemetry.lastIndexNowUrls = cleanUrls.slice(0, 10);
  telemetry.lastIndexNowStatus = status;
  writeTelemetry(telemetry);
  appendSeoEvent('indexnow_ping', cleanUrls[0], status, `${cleanUrls.length} url(s)`);

  return { attempted, ok, status };
}

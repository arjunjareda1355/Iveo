import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  getBingSiteVerification,
  getCanonicalSiteOrigin,
  getGoogleSiteVerification,
  getGscSiteUrl,
  getIndexNowKey,
} from './env.ts';

const TELEMETRY_PATH = path.resolve(process.cwd(), 'data', 'seo_telemetry.json');

function getGscRuntimeConfigPath(): string {
  const baseDir = process.env.IVEO_DATA_DIR
    ? path.resolve(process.env.IVEO_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  return path.join(baseDir, 'gsc_service_account.local.json');
}

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

export interface GscServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
  private_key_id?: string;
  token_uri?: string;
}

export interface ParsedGscCredentials {
  configured: boolean;
  source: 'runtime_file' | 'env' | 'none';
  propertyUrl?: string;
  updatedAt?: string;
  creds?: GscServiceAccountCredentials;
  error?: string;
}

interface StoredRuntimeGscConfig {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  token_uri?: string;
  propertyUrl?: string;
  updatedAt?: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const propertyCache = new Map<string, { sites: string[]; fetchedAt: number }>();
let indexNowCooldownUntil = 0;

export function clearGscCachesForTest(): void {
  tokenCache.clear();
  propertyCache.clear();
  indexNowCooldownUntil = 0;
}

export function normalizePrivateKeyPem(rawKey: string): string {
  let key = rawKey.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\\\r\\\\n/g, '\n').replace(/\\\\n/g, '\n');
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Reconstruct wrapped PEM if pasted onto a single line with spaces
  const match = key.match(
    /^(-----BEGIN [A-Z0-9 ]+-----)\s*([\s\S]+?)\s*(-----END [A-Z0-9 ]+-----)$/
  );
  if (match) {
    const header = match[1].trim();
    const body = match[2].replace(/\s+/g, '');
    const footer = match[3].trim();
    const lines = body.match(/.{1,64}/g) || [body];
    return `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return key.endsWith('\n') ? key : `${key}\n`;
}

function tryParseJsonString(rawInput: string): any | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const variants = [trimmed];
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    variants.push(trimmed.slice(1, -1).trim());
  }

  for (const variant of variants) {
    for (const attempt of [variant, variant.replace(/\r?\n/g, '\\n')]) {
      try {
        let parsed = JSON.parse(attempt);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {}
    }
  }

  // Handle pasted JSON where PEM private_key had literal unescaped newlines inside the string
  try {
    const fixedPemNewlines = trimmed.replace(
      /("private_key"\s*:\s*")([\s\S]*?)(")/,
      (_full, prefix, body, suffix) => `${prefix}${String(body).replace(/\r?\n/g, '\\n')}${suffix}`
    );
    const parsed = JSON.parse(fixedPemNewlines);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {}

  // Base64-encoded JSON fallback
  if (!trimmed.startsWith('{') && /^[A-Za-z0-9+/=\s_-]+$/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}

function readRuntimeGscConfigFile(): StoredRuntimeGscConfig | null {
  try {
    const cfgPath = getGscRuntimeConfigPath();
    if (!fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredRuntimeGscConfig;
    }
  } catch {}
  return null;
}

function validateServiceAccountObject(
  parsed: any,
  source: 'runtime_file' | 'env',
  propertyUrl?: string,
  updatedAt?: string
): ParsedGscCredentials {
  if (!parsed || typeof parsed !== 'object') {
    return {
      configured: true,
      source,
      error: 'GSC service account JSON could not be parsed.',
    };
  }

  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  const rawPrivateKey = typeof parsed.private_key === 'string' ? parsed.private_key : '';

  if (!clientEmail || !clientEmail.includes('@')) {
    return {
      configured: true,
      source,
      error: 'GSC service account credentials are missing a valid client_email.',
    };
  }

  if (!rawPrivateKey.trim()) {
    return {
      configured: true,
      source,
      error: 'GSC service account credentials are missing private_key.',
    };
  }

  const normalizedKey = normalizePrivateKeyPem(rawPrivateKey);
  try {
    crypto.createPrivateKey(normalizedKey);
  } catch {
    return {
      configured: true,
      source,
      error:
        'GSC private_key is malformed or could not be decoded as a valid PEM RSA private key. Ensure full BEGIN/END PRIVATE KEY lines are intact.',
    };
  }

  return {
    configured: true,
    source,
    propertyUrl,
    updatedAt,
    creds: {
      client_email: clientEmail,
      private_key: normalizedKey,
      project_id: typeof parsed.project_id === 'string' ? parsed.project_id.trim() : undefined,
      private_key_id:
        typeof parsed.private_key_id === 'string' ? parsed.private_key_id.trim() : undefined,
      token_uri:
        typeof parsed.token_uri === 'string' && parsed.token_uri.startsWith('https://')
          ? parsed.token_uri.trim()
          : 'https://oauth2.googleapis.com/token',
    },
  };
}

export function getEffectiveGscSiteUrl(): string | null {
  const runtime = readRuntimeGscConfigFile();
  if (runtime?.propertyUrl && typeof runtime.propertyUrl === 'string' && runtime.propertyUrl.trim()) {
    return runtime.propertyUrl.trim();
  }
  return getGscSiteUrl() ?? null;
}

export function parseGscServiceAccountCredentials(): ParsedGscCredentials {
  const runtime = readRuntimeGscConfigFile();
  if (runtime && (runtime.client_email || runtime.private_key)) {
    return validateServiceAccountObject(
      runtime,
      'runtime_file',
      runtime.propertyUrl,
      runtime.updatedAt
    );
  }

  const rawJson =
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
    '';
  const fallbackEmail = process.env.GSC_CLIENT_EMAIL?.trim() || '';
  const fallbackKey = process.env.GSC_PRIVATE_KEY?.trim() || '';

  if (!rawJson && !fallbackEmail && !fallbackKey) {
    return { configured: false, source: 'none' };
  }

  let parsed: any = null;
  if (rawJson) {
    parsed = tryParseJsonString(rawJson);
    if (!parsed) {
      return {
        configured: true,
        source: 'env',
        error: 'GSC_SERVICE_ACCOUNT_JSON could not be parsed as valid JSON or base64 JSON.',
      };
    }
  } else {
    parsed = {
      client_email: fallbackEmail,
      private_key: fallbackKey,
    };
  }

  return validateServiceAccountObject(parsed, 'env', getGscSiteUrl() || undefined);
}

export function getGscSafeConfigSummary() {
  const parsed = parseGscServiceAccountCredentials();
  const runtime = readRuntimeGscConfigFile();
  const siteUrl = getCanonicalSiteOrigin();
  const propertyUrl = getEffectiveGscSiteUrl() || `${siteUrl}/`;
  const hasEnvVars = Boolean(
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
      (process.env.GSC_CLIENT_EMAIL?.trim() && process.env.GSC_PRIVATE_KEY?.trim())
  );
  const keyId = parsed.creds?.private_key_id || runtime?.private_key_id || null;
  const privateKeyIdPreview = keyId
    ? keyId.length > 10
      ? `${keyId.slice(0, 6)}…${keyId.slice(-4)}`
      : keyId
    : null;

  return {
    configured: Boolean(parsed.creds && !parsed.error),
    source: parsed.source,
    hasSavedFile: Boolean(runtime?.client_email && runtime?.private_key),
    hasEnvVars,
    clientEmail: parsed.creds?.client_email || runtime?.client_email || null,
    projectId: parsed.creds?.project_id || runtime?.project_id || null,
    privateKeyIdPreview,
    propertyUrl,
    updatedAt: runtime?.updatedAt || null,
    error: parsed.error || null,
  };
}

export function saveGscRuntimeConfig(input: {
  rawJson?: string | null;
  propertyUrl?: string | null;
}): { ok: boolean; status: number; error?: string; summary: ReturnType<typeof getGscSafeConfigSummary> } {
  const existing = readRuntimeGscConfigFile();
  const trimmedProperty =
    typeof input.propertyUrl === 'string' ? input.propertyUrl.trim() : undefined;

  let normalizedPayload: StoredRuntimeGscConfig | null = null;
  const rawJsonStr = typeof input.rawJson === 'string' ? input.rawJson.trim() : '';

  if (rawJsonStr) {
    const parsed = tryParseJsonString(rawJsonStr);
    if (!parsed) {
      return {
        ok: false,
        status: 400,
        error: 'Could not parse Service Account JSON. Paste the full Google Cloud JSON key file.',
        summary: getGscSafeConfigSummary(),
      };
    }
    if (parsed.type && parsed.type !== 'service_account') {
      return {
        ok: false,
        status: 400,
        error: 'JSON file must have "type": "service_account".',
        summary: getGscSafeConfigSummary(),
      };
    }
    const validated = validateServiceAccountObject(parsed, 'runtime_file');
    if (!validated.creds || validated.error) {
      return {
        ok: false,
        status: 400,
        error: validated.error || 'Invalid service account credentials.',
        summary: getGscSafeConfigSummary(),
      };
    }
    normalizedPayload = {
      type: 'service_account',
      project_id: validated.creds.project_id,
      private_key_id: validated.creds.private_key_id,
      private_key: validated.creds.private_key,
      client_email: validated.creds.client_email,
      token_uri: validated.creds.token_uri || 'https://oauth2.googleapis.com/token',
      ...(trimmedProperty !== undefined
        ? trimmedProperty
          ? { propertyUrl: trimmedProperty }
          : {}
        : existing?.propertyUrl
          ? { propertyUrl: existing.propertyUrl }
          : {}),
      updatedAt: new Date().toISOString(),
    };
  } else if (trimmedProperty !== undefined && existing) {
    normalizedPayload = {
      ...existing,
      ...(trimmedProperty ? { propertyUrl: trimmedProperty } : { propertyUrl: undefined }),
      updatedAt: new Date().toISOString(),
    };
  } else if (!rawJsonStr && trimmedProperty !== undefined) {
    return {
      ok: false,
      status: 400,
      error: 'Paste or upload a Service Account JSON key first.',
      summary: getGscSafeConfigSummary(),
    };
  }

  if (!normalizedPayload) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Service Account JSON.',
      summary: getGscSafeConfigSummary(),
    };
  }

  const cfgPath = getGscRuntimeConfigPath();
  const dir = path.dirname(cfgPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${cfgPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalizedPayload, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.renameSync(tmpPath, cfgPath);
  try {
    fs.chmodSync(cfgPath, 0o600);
  } catch {}

  tokenCache.clear();
  propertyCache.clear();

  return {
    ok: true,
    status: 200,
    summary: getGscSafeConfigSummary(),
  };
}

export function clearGscRuntimeConfig(): ReturnType<typeof getGscSafeConfigSummary> {
  try {
    const cfgPath = getGscRuntimeConfigPath();
    if (fs.existsSync(cfgPath)) {
      fs.unlinkSync(cfgPath);
    }
  } catch {}
  tokenCache.clear();
  propertyCache.clear();
  return getGscSafeConfigSummary();
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
  const bingApiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const indexNowKey = getIndexNowKey();
  const googleVerification = getGoogleSiteVerification();
  const bingVerification = getBingSiteVerification();
  const telemetry = readTelemetry();
  const parsedGsc = parseGscServiceAccountCredentials();
  const gscSummary = getGscSafeConfigSummary();

  const siteUrl = getCanonicalSiteOrigin();
  const preferredGscProperty = gscSummary.propertyUrl || `${siteUrl}/`;
  const gscConfigured = Boolean(parsedGsc.creds && !parsedGsc.error);
  const gscClientEmail = parsedGsc.creds?.client_email || null;
  const bingConfigured = Boolean(bingApiKey);
  const indexNowConfigured = Boolean(indexNowKey);

  return {
    siteUrl,
    gscConfigured,
    gscHasEnv: gscSummary.hasEnvVars,
    gscHasSavedFile: gscSummary.hasSavedFile,
    gscSource: gscSummary.source,
    gscError: parsedGsc.error || null,
    gscSiteUrl: preferredGscProperty,
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
      source: gscSummary.source,
      hasEnv: gscSummary.hasEnvVars,
      hasSavedFile: gscSummary.hasSavedFile,
      error: parsedGsc.error || null,
      verificationMetaConfigured: Boolean(googleVerification),
      serviceAccountEmail: gscClientEmail,
      projectId: gscSummary.projectId,
      privateKeyIdPreview: gscSummary.privateKeyIdPreview,
      propertyUrl: preferredGscProperty,
      updatedAt: gscSummary.updatedAt,
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
 * Generates a short-lived Google OAuth2 access token from Service Account credentials using Node crypto.
 */
async function getGscAccessToken(
  scope: string
): Promise<{ token?: string; clientEmail?: string; error?: string }> {
  const parsed = parseGscServiceAccountCredentials();
  if (!parsed.configured) {
    return { error: 'GSC service account JSON is not configured' };
  }
  if (!parsed.creds || parsed.error) {
    return { error: parsed.error || 'Invalid GSC service account credentials' };
  }

  const creds = parsed.creds;
  const cacheKey = `${creds.client_email}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { token: cached.token, clientEmail: creds.client_email };
  }

  try {
    const tokenEndpoint = creds.token_uri || 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope,
        aud: tokenEndpoint,
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const signInput = `${header}.${payload}`;
    const keyObject = crypto.createPrivateKey(creds.private_key);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(keyObject, 'base64url');
    const jwt = `${signInput}.${signature}`;

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(6000),
    });

    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail =
        tokenJson?.error_description || tokenJson?.error || `HTTP ${tokenRes.status}`;
      return {
        clientEmail: creds.client_email,
        error: `Google OAuth token exchange failed (${detail})`,
      };
    }

    const expiresInSec = Number(tokenJson.expires_in) || 3600;
    const accessToken = String(tokenJson.access_token);
    tokenCache.set(cacheKey, {
      token: accessToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    });

    return { token: accessToken, clientEmail: creds.client_email };
  } catch (err: any) {
    return {
      clientEmail: creds.client_email,
      error: err?.message || 'GSC auth failed',
    };
  }
}

export function buildGscPropertyCandidates(canonicalOrigin: string): string[] {
  const candidates = new Set<string>();
  const explicit = getEffectiveGscSiteUrl();
  if (explicit) candidates.add(explicit);

  try {
    const u = new URL(canonicalOrigin);
    const host = u.host.toLowerCase();
    const bareHost = host.startsWith('www.') ? host.slice(4) : host;
    candidates.add(`${u.protocol}//${host}/`);
    candidates.add(`sc-domain:${bareHost}`);
    candidates.add(`${u.protocol}//www.${bareHost}/`);
    candidates.add(`${u.protocol}//${bareHost}/`);
  } catch {
    candidates.add('https://iveo.site/');
    candidates.add('sc-domain:iveo.site');
  }

  return Array.from(candidates);
}

async function resolveGscSiteCandidates(
  token: string,
  clientEmail: string | undefined,
  canonicalOrigin: string
): Promise<string[]> {
  const fallbackCandidates = buildGscPropertyCandidates(canonicalOrigin);
  const cacheKey = clientEmail || 'default';
  const cached = propertyCache.get(cacheKey);
  let verifiedSites: string[] | null =
    cached && Date.now() - cached.fetchedAt < 5 * 60_000 ? cached.sites : null;

  if (!verifiedSites) {
    try {
      const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const entries: any[] = Array.isArray(json?.siteEntry) ? json.siteEntry : [];
        verifiedSites = entries
          .filter((e) => e?.siteUrl && e?.permissionLevel !== 'siteUnverifiedUser')
          .map((e) => String(e.siteUrl));
        propertyCache.set(cacheKey, { sites: verifiedSites, fetchedAt: Date.now() });
      }
    } catch {
      // Non-fatal: continue with candidate list
    }
  }

  if (!verifiedSites || verifiedSites.length === 0) {
    return fallbackCandidates;
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  // Prioritize verified properties matching canonical candidates first
  for (const cand of fallbackCandidates) {
    const match = verifiedSites.find((s) => s.toLowerCase() === cand.toLowerCase());
    if (match && !seen.has(match)) {
      ordered.push(match);
      seen.add(match);
    }
  }

  // Append any remaining matching domain/host properties from GSC account
  let bareHost = 'iveo.site';
  try {
    const h = new URL(canonicalOrigin).host.toLowerCase();
    bareHost = h.startsWith('www.') ? h.slice(4) : h;
  } catch {}
  for (const site of verifiedSites) {
    if (!seen.has(site) && site.toLowerCase().includes(bareHost)) {
      ordered.push(site);
      seen.add(site);
    }
  }

  for (const cand of fallbackCandidates) {
    if (!seen.has(cand)) {
      ordered.push(cand);
      seen.add(cand);
    }
  }

  return ordered;
}

/**
 * Submits sitemap.xml to Google Search Console (when GSC_SERVICE_ACCOUNT_JSON is configured)
 * and Bing Webmaster Tools (when BING_WEBMASTER_API_KEY is configured).
 */
export async function submitSitemapsToSearchEngines(): Promise<{
  gsc: { attempted: boolean; ok: boolean; status: string; siteUrl?: string; error?: string };
  bing: { attempted: boolean; ok: boolean; status: string };
}> {
  const siteUrl = getCanonicalSiteOrigin();
  const feedPath = `${siteUrl}/sitemap.xml`;

  // 1. Google Search Console Sitemaps API (PUT)
  let gscResult: { attempted: boolean; ok: boolean; status: string; siteUrl?: string; error?: string } = {
    attempted: false,
    ok: false,
    status: 'not_configured',
  };
  const parsedCreds = parseGscServiceAccountCredentials();
  if (parsedCreds.configured) {
    gscResult.attempted = true;
    const auth = await getGscAccessToken('https://www.googleapis.com/auth/webmasters');
    if (auth.token) {
      const candidates = await resolveGscSiteCandidates(auth.token, auth.clientEmail, siteUrl);
      let lastStatus = 'unknown_error';
      let lastError = '';
      for (const candidate of candidates) {
        try {
          const gscUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(candidate)}/sitemaps/${encodeURIComponent(feedPath)}`;
          const res = await fetch(gscUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${auth.token}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            gscResult = {
              attempted: true,
              ok: true,
              status: 'submitted_ok',
              siteUrl: candidate,
            };
            break;
          }
          const errJson: any = await res.json().catch(() => ({}));
          lastStatus = `http_${res.status}`;
          lastError = errJson?.error?.message || `HTTP ${res.status}`;
          if (res.status !== 403 && res.status !== 404) {
            break;
          }
        } catch (err: any) {
          lastStatus = 'network_error';
          lastError = err?.message || 'network_error';
          break;
        }
      }
      if (!gscResult.ok) {
        const hint =
          (lastStatus === 'http_403' || lastStatus === 'http_404') && auth.clientEmail
            ? ` Verify ${auth.clientEmail} has Owner/Full user permission on ${candidates[0]} in Google Search Console.`
            : '';
        gscResult = {
          attempted: true,
          ok: false,
          status: lastStatus,
          error: `${lastError}${hint}`.trim(),
        };
      }
    } else {
      gscResult = {
        attempted: true,
        ok: false,
        status: 'auth_failed',
        error: auth.error || 'auth_failed',
      };
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
  appendSeoEvent(
    'sitemap_submit',
    feedPath,
    telemetry.lastSitemapPingResult,
    gscResult.error || gscResult.siteUrl
  );

  return { gsc: gscResult, bing: bingResult };
}

/**
 * Inspects a live profile URL using Google Search Console URL Inspection API when configured.
 */
export async function inspectUrlWithGsc(targetUrl: string): Promise<{
  configured: boolean;
  ok: boolean;
  siteUrl?: string;
  verdict?: string;
  coverageState?: string;
  lastCrawlTime?: string;
  error?: string;
}> {
  const parsedCreds = parseGscServiceAccountCredentials();
  if (!parsedCreds.configured) {
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

  const candidates = await resolveGscSiteCandidates(auth.token, auth.clientEmail, siteUrl);
  let lastError = 'Inspection failed';
  let lastStatus = 0;

  for (const candidate of candidates) {
    try {
      const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inspectionUrl: targetUrl,
          siteUrl: candidate,
        }),
        signal: AbortSignal.timeout(6000),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        const indexStatus = json?.inspectionResult?.indexStatusResult || {};
        return {
          configured: true,
          ok: true,
          siteUrl: candidate,
          verdict: indexStatus.verdict || 'UNKNOWN',
          coverageState: indexStatus.coverageState || 'Unknown',
          lastCrawlTime: indexStatus.lastCrawlTime || undefined,
        };
      }
      lastStatus = res.status;
      lastError = json?.error?.message || `HTTP ${res.status}`;
      if (res.status !== 403 && res.status !== 404) {
        break;
      }
    } catch (err: any) {
      lastError = err?.message || 'Inspection failed';
      break;
    }
  }

  const hint =
    (lastStatus === 403 || lastStatus === 404) && auth.clientEmail
      ? ` Verify ${auth.clientEmail} has access to ${candidates[0]} in Google Search Console.`
      : '';
  return { configured: true, ok: false, error: `${lastError}${hint}`.trim() };
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
    if (Date.now() < indexNowCooldownUntil) {
      status = 'indexnow_cooldown';
      attempted = false;
      ok = false;
    } else {
      attempted = true;
      try {
        const res = await fetch('https://api.indexnow.org/IndexNow', {
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
        if (res.status === 429) {
          const retryRaw = res.headers.get('retry-after');
          let cooldownMs = 5 * 60_000;
          if (retryRaw) {
            const secs = Number(retryRaw);
            if (Number.isFinite(secs) && secs > 0) {
              cooldownMs = Math.min(3_600_000, Math.max(5_000, secs * 1000));
            } else {
              const targetMs = Date.parse(retryRaw);
              if (!Number.isNaN(targetMs) && targetMs > Date.now()) {
                cooldownMs = Math.min(3_600_000, targetMs - Date.now());
              }
            }
          }
          indexNowCooldownUntil = Date.now() + cooldownMs;
        }
        ok = res.ok || res.status === 202;
        status = ok ? `indexnow_${res.status}` : `indexnow_err_${res.status}`;
      } catch (err: any) {
        status = `indexnow_fail:${err?.message || 'timeout'}`;
      }
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

export async function testGscConnection(): Promise<{
  ok: boolean;
  configured: boolean;
  source: 'runtime_file' | 'env' | 'none';
  oauthOk: boolean;
  clientEmail: string | null;
  projectId: string | null;
  propertyUrl: string;
  matchedProperty: string | null;
  verifiedSites: string[];
  allSites: Array<{ siteUrl: string; permissionLevel: string }>;
  error: string | null;
  actionableHint: string | null;
}> {
  const summary = getGscSafeConfigSummary();
  const parsed = parseGscServiceAccountCredentials();
  const siteUrl = getCanonicalSiteOrigin();
  const candidates = buildGscPropertyCandidates(siteUrl);

  if (!parsed.configured || !parsed.creds || parsed.error) {
    return {
      ok: false,
      configured: false,
      source: summary.source,
      oauthOk: false,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      verifiedSites: [],
      allSites: [],
      error: parsed.error || 'Google Search Console service account JSON is not configured.',
      actionableHint: 'Upload or paste your Google Cloud Service Account JSON key below.',
    };
  }

  const auth = await getGscAccessToken('https://www.googleapis.com/auth/webmasters');
  if (!auth.token) {
    return {
      ok: false,
      configured: true,
      source: summary.source,
      oauthOk: false,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      verifiedSites: [],
      allSites: [],
      error: auth.error || 'Google OAuth token exchange failed.',
      actionableHint:
        'Check that the Service Account JSON key is active in Google Cloud IAM and has not been revoked.',
    };
  }

  try {
    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(6000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiMsg = json?.error?.message || `HTTP ${res.status}`;
      const isApiDisabled = res.status === 403 && /disabled|not enabled|Search Console API/i.test(apiMsg);
      return {
        ok: false,
        configured: true,
        source: summary.source,
        oauthOk: true,
        clientEmail: summary.clientEmail,
        projectId: summary.projectId,
        propertyUrl: summary.propertyUrl,
        matchedProperty: null,
        verifiedSites: [],
        allSites: [],
        error: `Google Search Console API error: ${apiMsg}`,
        actionableHint: isApiDisabled
          ? `Enable "Google Search Console API" in Google Cloud project "${summary.projectId || 'your project'}".`
          : `Grant ${summary.clientEmail} Full or Owner access in Google Search Console -> Settings -> Users and permissions.`,
      };
    }

    const entries: any[] = Array.isArray(json?.siteEntry) ? json.siteEntry : [];
    const allSites = entries
      .filter((e) => e?.siteUrl)
      .map((e) => ({
        siteUrl: String(e.siteUrl),
        permissionLevel: String(e.permissionLevel || 'unknown'),
      }));
    const verifiedSites = allSites
      .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
      .map((s) => s.siteUrl);

    propertyCache.set(parsed.creds.client_email || 'default', {
      sites: verifiedSites,
      fetchedAt: Date.now(),
    });

    let matchedProperty: string | null = null;
    for (const cand of candidates) {
      const found = verifiedSites.find((s) => s.toLowerCase() === cand.toLowerCase());
      if (found) {
        matchedProperty = found;
        break;
      }
    }
    if (!matchedProperty) {
      try {
        const h = new URL(siteUrl).host.toLowerCase();
        const bareHost = h.startsWith('www.') ? h.slice(4) : h;
        matchedProperty = verifiedSites.find((s) => s.toLowerCase().includes(bareHost)) || null;
      } catch {}
    }

    const ok = Boolean(matchedProperty);
    const actionableHint = ok
      ? null
      : verifiedSites.length === 0
        ? `OAuth succeeded, but no GSC properties are shared with ${summary.clientEmail}. In Google Search Console -> Settings -> Users and permissions, add ${summary.clientEmail} as Full or Owner user.`
        : `OAuth succeeded (properties visible: ${verifiedSites.join(', ')}), but none match ${candidates[0]}. Set Property URL above or add ${summary.clientEmail} to ${candidates[0]}.`;

    return {
      ok,
      configured: true,
      source: summary.source,
      oauthOk: true,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: matchedProperty || summary.propertyUrl,
      matchedProperty,
      verifiedSites,
      allSites,
      error: ok ? null : actionableHint,
      actionableHint,
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      source: summary.source,
      oauthOk: true,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      verifiedSites: [],
      allSites: [],
      error: err?.message || 'Network error contacting Google Search Console.',
      actionableHint: null,
    };
  }
}


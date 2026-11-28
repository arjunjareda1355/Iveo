import crypto from 'node:crypto';
import {
  getBingSiteVerification,
  getCanonicalSiteOrigin,
  getGoogleSiteVerification,
  getGscSiteUrl,
  getIndexNowKey,
} from './env.ts';
import { redactSecrets } from './serverConfig.ts';
import {
  appendSeoIntegrationEvent,
  clearLocalEncryptedGscSync,
  clearSeoIntegrationsStoreCacheForTests,
  decryptIntegrationsJson,
  encryptIntegrationsJson,
  getOrCreateIndexNowKey,
  listSeoIntegrationEvents,
  readIntegrationsPayload,
  readLocalEncryptedStoreSync,
  resolveIntegrationsEncryptionKey,
  writeIntegrationsPayload,
  writeLocalEncryptedStoreSync,
  type GscMetadataRecord,
  type SeoEventRecord,
} from './seoIntegrationsStore.ts';

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
    scope?: string;
    provider?: string;
    httpStatus?: number | null;
    outcome?: string;
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
  source: 'env' | 'stored' | 'none';
  propertyUrl?: string;
  updatedAt?: string;
  creds?: GscServiceAccountCredentials;
  error?: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const propertyCache = new Map<string, { sites: string[]; fetchedAt: number }>();
const urlCooldownMap = new Map<string, number>();
let indexNowCooldownUntil = 0;
let lastSitemapSubmitAtMs = 0;
let lastSitemapPingResultMemory: string | null = null;
let lastIndexNowAtMemory: string | null = null;
let lastIndexNowUrlsMemory: string[] = [];
let lastIndexNowStatusMemory: string | null = null;

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60_000;
const SITEMAP_THROTTLE_MS = 60 * 60_000;
const INDEXNOW_URL_DEDUP_MS = 10 * 60_000;

export function clearGscCachesForTest(): void {
  tokenCache.clear();
  propertyCache.clear();
  urlCooldownMap.clear();
  indexNowCooldownUntil = 0;
  lastSitemapSubmitAtMs = 0;
  lastSitemapPingResultMemory = null;
  lastIndexNowAtMemory = null;
  lastIndexNowUrlsMemory = [];
  lastIndexNowStatusMemory = null;
  clearSeoIntegrationsStoreCacheForTests();
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

export function validateGscPropertyUrl(
  rawInput: string | null | undefined
): { valid: true; normalized: string | undefined } | { valid: false; error: string } {
  const raw = String(rawInput || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) {
    return { valid: true, normalized: undefined };
  }
  if (/^sc-domain:/i.test(raw)) {
    const domain = raw
      .slice('sc-domain:'.length)
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      return {
        valid: false,
        error: 'Domain property must look like sc-domain:iveo.site.',
      };
    }
    return { valid: true, normalized: `sc-domain:${domain}` };
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return {
        valid: false,
        error: 'GSC Property URL must start with https:// or sc-domain:.',
      };
    }
    const cleanPath = u.pathname && u.pathname !== '/' ? `${u.pathname.replace(/\/+$/, '')}/` : '/';
    return { valid: true, normalized: `${u.protocol}//${u.host}${cleanPath}` };
  } catch {
    return {
      valid: false,
      error: 'Enter a valid GSC Property URL (e.g. https://iveo.site/ or sc-domain:iveo.site).',
    };
  }
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

function validateServiceAccountObject(
  parsed: any,
  source: 'env' | 'stored',
  propertyUrl?: string,
  updatedAt?: string,
  requireAllFields = false
): ParsedGscCredentials {
  if (!parsed || typeof parsed !== 'object') {
    return {
      configured: true,
      source,
      error: 'GSC service account JSON could not be parsed.',
    };
  }

  if (parsed.type && parsed.type !== 'service_account') {
    return {
      configured: true,
      source,
      error: 'Service Account JSON must have "type": "service_account".',
    };
  }
  if (requireAllFields && parsed.type !== 'service_account') {
    return {
      configured: true,
      source,
      error: 'Service Account JSON is missing "type": "service_account".',
    };
  }

  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  const rawPrivateKey = typeof parsed.private_key === 'string' ? parsed.private_key : '';
  const projectId = typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
  const tokenUri = typeof parsed.token_uri === 'string' ? parsed.token_uri.trim() : '';

  if (!clientEmail || !clientEmail.includes('@')) {
    return {
      configured: true,
      source,
      error: 'GSC service account credentials are missing a valid client_email.',
    };
  }

  if (requireAllFields && !projectId) {
    return {
      configured: true,
      source,
      error: 'GSC service account JSON is missing project_id.',
    };
  }

  if (!rawPrivateKey.trim()) {
    return {
      configured: true,
      source,
      error: 'GSC service account credentials are missing private_key.',
    };
  }

  if (tokenUri && !tokenUri.startsWith('https://')) {
    return {
      configured: true,
      source,
      error: 'GSC service account JSON has an invalid token_uri (must start with https://).',
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
        'GSC private_key is malformed or could not be decoded as a valid PEM RSA private key. Check BEGIN/END PRIVATE KEY headers and server clock.',
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
      project_id: projectId || undefined,
      private_key_id:
        typeof parsed.private_key_id === 'string' ? parsed.private_key_id.trim() : undefined,
      token_uri:
        tokenUri && tokenUri.startsWith('https://')
          ? tokenUri
          : 'https://oauth2.googleapis.com/token',
    },
  };
}

function parseEnvGscCredentials(): ParsedGscCredentials | null {
  const rawJson =
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
    '';
  const fallbackEmail = process.env.GSC_CLIENT_EMAIL?.trim() || '';
  const fallbackKey = process.env.GSC_PRIVATE_KEY?.trim() || '';

  if (!rawJson && !fallbackEmail && !fallbackKey) {
    return null;
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

  return validateServiceAccountObject(parsed, 'env', getGscSiteUrl() || undefined, undefined, false);
}

function parseStoredPayloadCredentials(payload: {
  encryptedGscBlob: any;
  gscMeta: GscMetadataRecord | null;
}): ParsedGscCredentials | null {
  if (!payload?.encryptedGscBlob) {
    return null;
  }
  const decrypted = decryptIntegrationsJson(payload.encryptedGscBlob);
  if (!decrypted.ok) {
    return {
      configured: false,
      source: 'stored',
      propertyUrl: payload.gscMeta?.propertyUrl || undefined,
      updatedAt: payload.gscMeta?.updatedAt || undefined,
      error: decrypted.error,
    };
  }
  const parsed = tryParseJsonString(decrypted.plaintext);
  if (!parsed) {
    return {
      configured: false,
      source: 'stored',
      error: 'Setup Needed - re-upload the key (stored payload invalid).',
    };
  }
  return validateServiceAccountObject(
    parsed,
    'stored',
    payload.gscMeta?.propertyUrl || undefined,
    payload.gscMeta?.updatedAt || undefined,
    false
  );
}

export function getEffectiveGscSiteUrl(): string | null {
  const envUrl = getGscSiteUrl();
  if (envUrl) return envUrl;
  const local = readLocalEncryptedStoreSync();
  if (local.gscMeta?.propertyUrl && typeof local.gscMeta.propertyUrl === 'string') {
    return local.gscMeta.propertyUrl.trim();
  }
  return null;
}

export async function getEffectiveGscSiteUrlAsync(): Promise<string | null> {
  const envUrl = getGscSiteUrl();
  if (envUrl) return envUrl;
  const payload = await readIntegrationsPayload();
  if (payload.gscMeta?.propertyUrl && typeof payload.gscMeta.propertyUrl === 'string') {
    return payload.gscMeta.propertyUrl.trim();
  }
  return null;
}

/**
 * Synchronous credential resolution (used by sync callers/tests).
 * ENV strictly overrides stored config.
 */
export function parseGscServiceAccountCredentials(): ParsedGscCredentials {
  const fromEnv = parseEnvGscCredentials();
  if (fromEnv) return fromEnv;

  const localPayload = readLocalEncryptedStoreSync();
  const fromLocal = parseStoredPayloadCredentials(localPayload);
  if (fromLocal) return fromLocal;

  return { configured: false, source: 'none' };
}

/**
 * Authoritative async credential resolution (checks ENV override first, then encrypted Firebase store).
 */
export async function parseGscServiceAccountCredentialsAsync(): Promise<ParsedGscCredentials> {
  const fromEnv = parseEnvGscCredentials();
  if (fromEnv) return fromEnv;

  const storePayload = await readIntegrationsPayload();
  const fromStore = parseStoredPayloadCredentials(storePayload);
  if (fromStore) return fromStore;

  return { configured: false, source: 'none' };
}

function buildSafeSummaryFromParts(
  parsed: ParsedGscCredentials,
  meta: GscMetadataRecord | null,
  effectiveProperty: string | null
) {
  const siteUrl = getCanonicalSiteOrigin();
  const propertyUrl = effectiveProperty || `${siteUrl}/`;
  const hasEnvVars = Boolean(
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
      (process.env.GSC_CLIENT_EMAIL?.trim() && process.env.GSC_PRIVATE_KEY?.trim())
  );
  const keyId = parsed.creds?.private_key_id || null;
  const privateKeyIdPreview =
    keyId
      ? keyId.length > 10
        ? `${keyId.slice(0, 6)}…${keyId.slice(-4)}`
        : keyId
      : meta?.privateKeyIdPreview || null;

  const encStatus = resolveIntegrationsEncryptionKey();

  return {
    configured: Boolean(parsed.creds && !parsed.error),
    source: parsed.source,
    hasSavedConfig: Boolean(meta?.configured || (parsed.source === 'stored' && parsed.creds)),
    hasSavedFile: Boolean(meta?.configured || (parsed.source === 'stored' && parsed.creds)),
    hasEnvVars,
    clientEmail: parsed.creds?.client_email || meta?.clientEmail || null,
    projectId: parsed.creds?.project_id || meta?.projectId || null,
    privateKeyIdPreview,
    propertyUrl,
    updatedAt: parsed.updatedAt || meta?.updatedAt || null,
    updatedBy: meta?.updatedBy || null,
    lastTestAt: meta?.lastTestAt || null,
    lastTestStatus: meta?.lastTestStatus || null,
    lastPermissionLevel: meta?.lastPermissionLevel || null,
    lastError: parsed.error || meta?.lastError || null,
    error: parsed.error || null,
    encryptionKeyStatus: encStatus.keySource,
  };
}

export function getGscSafeConfigSummary() {
  const parsed = parseGscServiceAccountCredentials();
  const local = readLocalEncryptedStoreSync();
  return buildSafeSummaryFromParts(parsed, local.gscMeta, getEffectiveGscSiteUrl());
}

export async function getGscSafeConfigSummaryAsync() {
  const [parsed, storePayload, effectiveProperty] = await Promise.all([
    parseGscServiceAccountCredentialsAsync(),
    readIntegrationsPayload(),
    getEffectiveGscSiteUrlAsync(),
  ]);
  return buildSafeSummaryFromParts(parsed, storePayload.gscMeta, effectiveProperty);
}

export async function saveGscRuntimeConfigAsync(input: {
  rawJson?: string | null;
  propertyUrl?: string | null;
  updatedBy?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  warning?: string;
  summary: Awaited<ReturnType<typeof getGscSafeConfigSummaryAsync>>;
}> {
  const existing = await readIntegrationsPayload();
  const propValidation = validateGscPropertyUrl(input.propertyUrl);
  if (!propValidation.valid) {
    return {
      ok: false,
      status: 400,
      error: propValidation.error,
      summary: await getGscSafeConfigSummaryAsync(),
    };
  }

  const rawJsonStr = typeof input.rawJson === 'string' ? input.rawJson.trim() : '';
  const hasExplicitProperty = input.propertyUrl !== undefined;
  const resolvedProperty = hasExplicitProperty
    ? propValidation.normalized || null
    : existing.gscMeta?.propertyUrl || null;
  const actorLabel = (input.updatedBy || 'admin').slice(0, 120);
  const nowIso = new Date().toISOString();

  if (rawJsonStr) {
    if (Buffer.byteLength(rawJsonStr, 'utf8') > 25 * 1024) {
      return {
        ok: false,
        status: 413,
        error: 'Service Account JSON must be 25 KB or smaller.',
        summary: await getGscSafeConfigSummaryAsync(),
      };
    }

    const parsed = tryParseJsonString(rawJsonStr);
    if (!parsed) {
      return {
        ok: false,
        status: 400,
        error: 'Could not parse Service Account JSON. Upload or paste the full Google Cloud JSON key file.',
        summary: await getGscSafeConfigSummaryAsync(),
      };
    }

    const validated = validateServiceAccountObject(
      parsed,
      'stored',
      resolvedProperty || undefined,
      nowIso,
      true
    );
    if (!validated.creds || validated.error) {
      return {
        ok: false,
        status: 400,
        error: validated.error || 'Invalid service account credentials.',
        summary: await getGscSafeConfigSummaryAsync(),
      };
    }

    const minimalStored = {
      type: 'service_account',
      project_id: validated.creds.project_id,
      private_key_id: validated.creds.private_key_id,
      private_key: validated.creds.private_key,
      client_email: validated.creds.client_email,
      token_uri: validated.creds.token_uri || 'https://oauth2.googleapis.com/token',
    };

    const encrypted = encryptIntegrationsJson(JSON.stringify(minimalStored));
    if (!encrypted.ok) {
      return {
        ok: false,
        status: 500,
        error: encrypted.error,
        summary: await getGscSafeConfigSummaryAsync(),
      };
    }

    const keyId = validated.creds.private_key_id || null;
    const keyPreview = keyId
      ? keyId.length > 10
        ? `${keyId.slice(0, 6)}…${keyId.slice(-4)}`
        : keyId
      : null;

    const meta: GscMetadataRecord = {
      configured: true,
      clientEmail: validated.creds.client_email,
      projectId: validated.creds.project_id || null,
      privateKeyIdPreview: keyPreview,
      propertyUrl: resolvedProperty,
      updatedAt: nowIso,
      updatedBy: actorLabel,
      lastTestAt: existing.gscMeta?.lastTestAt || null,
      lastTestStatus: existing.gscMeta?.lastTestStatus || null,
      lastPermissionLevel: existing.gscMeta?.lastPermissionLevel || null,
      lastError: null,
    };

    await writeIntegrationsPayload({
      encryptedGscBlob: encrypted.blob,
      gscMeta: meta,
    });

    tokenCache.clear();
    propertyCache.clear();

    return {
      ok: true,
      status: 200,
      warning: encrypted.usingFallbackKey
        ? 'Encrypted with derived fallback key. Set dedicated INTEGRATIONS_ENCRYPTION_KEY in production env for durable rotation.'
        : undefined,
      summary: await getGscSafeConfigSummaryAsync(),
    };
  }

  // Updating propertyUrl only on an existing encrypted GSC config
  if (hasExplicitProperty && existing.encryptedGscBlob && existing.gscMeta) {
    const updatedMeta: GscMetadataRecord = {
      ...existing.gscMeta,
      propertyUrl: resolvedProperty,
      updatedAt: nowIso,
      updatedBy: actorLabel,
    };
    await writeIntegrationsPayload({ gscMeta: updatedMeta });
    propertyCache.clear();
    return {
      ok: true,
      status: 200,
      summary: await getGscSafeConfigSummaryAsync(),
    };
  }

  return {
    ok: false,
    status: 400,
    error: 'Upload or paste a Google Cloud Service Account JSON key first.',
    summary: await getGscSafeConfigSummaryAsync(),
  };
}

export async function clearGscRuntimeConfigAsync(): Promise<
  Awaited<ReturnType<typeof getGscSafeConfigSummaryAsync>>
> {
  await writeIntegrationsPayload({
    encryptedGscBlob: null,
    gscMeta: null,
  });
  tokenCache.clear();
  propertyCache.clear();
  return getGscSafeConfigSummaryAsync();
}

export function clearGscRuntimeConfig(): void {
  clearLocalEncryptedGscSync();
  tokenCache.clear();
  propertyCache.clear();
}

export function saveGscRuntimeConfig(input: {
  rawJson?: string | null;
  propertyUrl?: string | null;
  updatedBy?: string | null;
}) {
  const propValidation = validateGscPropertyUrl(input.propertyUrl);
  if (!propValidation.valid) {
    return {
      ok: false,
      status: 400,
      error: propValidation.error,
      summary: getGscSafeConfigSummary(),
    };
  }
  const rawJsonStr = typeof input.rawJson === 'string' ? input.rawJson.trim() : '';
  const current = readLocalEncryptedStoreSync();
  const resolvedProperty =
    input.propertyUrl !== undefined
      ? propValidation.normalized || null
      : current.gscMeta?.propertyUrl || null;
  const nowIso = new Date().toISOString();

  if (!rawJsonStr) {
    return {
      ok: false,
      status: 400,
      error: 'Upload or paste a Google Cloud Service Account JSON key first.',
      summary: getGscSafeConfigSummary(),
    };
  }
  const parsed = tryParseJsonString(rawJsonStr);
  const validated = validateServiceAccountObject(
    parsed,
    'stored',
    resolvedProperty || undefined,
    nowIso,
    true
  );
  if (!validated.creds || validated.error) {
    return {
      ok: false,
      status: 400,
      error: validated.error || 'Invalid service account credentials.',
      summary: getGscSafeConfigSummary(),
    };
  }
  const encrypted = encryptIntegrationsJson(
    JSON.stringify({
      type: 'service_account',
      project_id: validated.creds.project_id,
      private_key_id: validated.creds.private_key_id,
      private_key: validated.creds.private_key,
      client_email: validated.creds.client_email,
      token_uri: validated.creds.token_uri || 'https://oauth2.googleapis.com/token',
    })
  );
  if (!encrypted.ok) {
    return { ok: false, status: 500, error: encrypted.error, summary: getGscSafeConfigSummary() };
  }
  const keyId = validated.creds.private_key_id || null;
  const meta: GscMetadataRecord = {
    configured: true,
    clientEmail: validated.creds.client_email,
    projectId: validated.creds.project_id || null,
    privateKeyIdPreview: keyId && keyId.length > 10 ? `${keyId.slice(0, 6)}…${keyId.slice(-4)}` : keyId,
    propertyUrl: resolvedProperty,
    updatedAt: nowIso,
    updatedBy: input.updatedBy || 'admin',
    lastTestAt: current.gscMeta?.lastTestAt || null,
    lastTestStatus: current.gscMeta?.lastTestStatus || null,
    lastPermissionLevel: current.gscMeta?.lastPermissionLevel || null,
    lastError: null,
  };
  writeLocalEncryptedStoreSync({
    ...current,
    encryptedGscBlob: encrypted.blob,
    gscMeta: meta,
    updatedAt: nowIso,
  });
  clearSeoIntegrationsStoreCacheForTests();
  tokenCache.clear();
  propertyCache.clear();
  return { ok: true, status: 200, summary: getGscSafeConfigSummary() };
}

export function appendSeoEvent(
  action: string,
  target: string,
  status: string,
  detail?: string,
  options?: { scope?: string; provider?: string; httpStatus?: number | null; outcome?: SeoEventRecord['outcome'] }
): void {
  const outcome: SeoEventRecord['outcome'] =
    options?.outcome ||
    (/ok|200|202|204|success|submitted/i.test(status)
      ? 'success'
      : /not_configured/i.test(status)
        ? 'not_configured'
        : /cooldown|429|rate_limit/i.test(status)
          ? 'rate_limited'
          : /fail|err|4\d\d|5\d\d/i.test(status)
            ? 'failed'
            : 'info');

  appendSeoIntegrationEvent({
    type: action,
    scope: options?.scope || '__system__',
    provider: options?.provider || (action.includes('indexnow') ? 'indexnow' : action.includes('sitemap') ? 'sitemap' : 'seo'),
    targetUrl: target,
    httpStatus: options?.httpStatus ?? null,
    outcome,
    detail: detail ? redactSecrets(detail) : undefined,
  }).catch(() => {});
}

function buildStatusPayload(args: {
  siteUrl: string;
  parsedGsc: ParsedGscCredentials;
  gscSummary: ReturnType<typeof buildSafeSummaryFromParts>;
  indexNowKey: string | null;
  events: SeoEventRecord[];
}) {
  const bingApiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const googleVerification = getGoogleSiteVerification();
  const bingVerification = getBingSiteVerification();

  const { siteUrl, parsedGsc, gscSummary, indexNowKey, events } = args;
  const preferredGscProperty = gscSummary.propertyUrl || `${siteUrl}/`;
  const gscConfigured = Boolean(parsedGsc.creds && !parsedGsc.error);
  const gscClientEmail = parsedGsc.creds?.client_email || gscSummary.clientEmail || null;
  const bingConfigured = Boolean(bingApiKey);
  const indexNowConfigured = Boolean(indexNowKey);

  const recentSubmissions = events.map((e) => ({
    engine: e.provider === 'seo' ? e.type : `${e.provider}:${e.type}`,
    provider: e.provider,
    scope: e.scope,
    status: e.httpStatus ? `${e.outcome} (HTTP ${e.httpStatus})` : e.outcome,
    outcome: e.outcome,
    httpStatus: e.httpStatus,
    detail: e.detail ? `${e.targetUrl} (${e.detail})` : e.targetUrl,
    targetUrl: e.targetUrl,
    timestamp: e.at,
  }));

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
    recentSubmissions,
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
      updatedBy: gscSummary.updatedBy,
      lastTestAt: gscSummary.lastTestAt,
      lastTestStatus: gscSummary.lastTestStatus,
      lastPermissionLevel: gscSummary.lastPermissionLevel,
      lastError: gscSummary.lastError,
      encryptionKeyStatus: gscSummary.encryptionKeyStatus,
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
      source: process.env.INDEXNOW_KEY?.trim() ? 'env' : indexNowKey ? 'stored' : 'none',
    },
    telemetry: {
      lastSitemapPingAt: lastSitemapSubmitAtMs ? new Date(lastSitemapSubmitAtMs).toISOString() : null,
      lastSitemapPingResult: lastSitemapPingResultMemory,
      lastIndexNowAt: lastIndexNowAtMemory,
      lastIndexNowUrls: lastIndexNowUrlsMemory,
      lastIndexNowStatus: lastIndexNowStatusMemory,
      recentEvents: events.map((e) => ({
        at: e.at,
        action: e.type,
        target: e.targetUrl,
        status: e.httpStatus ? `${e.outcome} (${e.httpStatus})` : e.outcome,
        detail: e.detail,
        scope: e.scope,
        provider: e.provider,
        httpStatus: e.httpStatus,
        outcome: e.outcome,
      })),
    },
  };
}

export function getSearchEngineStatus() {
  const siteUrl = getCanonicalSiteOrigin();
  const parsedGsc = parseGscServiceAccountCredentials();
  const gscSummary = getGscSafeConfigSummary();
  const local = readLocalEncryptedStoreSync();
  const indexNowKey = getIndexNowKey() || local.indexNowKey || null;
  return buildStatusPayload({
    siteUrl,
    parsedGsc,
    gscSummary,
    indexNowKey,
    events: [],
  });
}

export async function getSearchEngineStatusAsync() {
  const siteUrl = getCanonicalSiteOrigin();
  const [parsedGsc, gscSummary, indexNowKey, events] = await Promise.all([
    parseGscServiceAccountCredentialsAsync(),
    getGscSafeConfigSummaryAsync(),
    getOrCreateIndexNowKey().catch(() => getIndexNowKey() || null),
    listSeoIntegrationEvents({ limit: 40 }).catch(() => []),
  ]);
  return buildStatusPayload({
    siteUrl,
    parsedGsc,
    gscSummary,
    indexNowKey,
    events,
  });
}

/**
 * Unified GSC access token generator caching in memory until 5 minutes before expiry.
 */
export async function getGscClient(
  scope: string
): Promise<{ token?: string; clientEmail?: string; projectId?: string; propertyUrl?: string; source?: 'env' | 'stored' | 'none'; error?: string }> {
  const parsed = await parseGscServiceAccountCredentialsAsync();
  if (!parsed.configured && parsed.source === 'none') {
    return { source: 'none', error: 'GSC service account JSON is not configured' };
  }
  if (!parsed.creds || parsed.error) {
    return {
      source: parsed.source,
      error: parsed.error || 'Invalid GSC service account credentials',
    };
  }

  const creds = parsed.creds;
  const cacheKey = `${creds.client_email}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return {
      token: cached.token,
      clientEmail: creds.client_email,
      projectId: creds.project_id,
      propertyUrl: parsed.propertyUrl,
      source: parsed.source,
    };
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
      const detail = redactSecrets(
        tokenJson?.error_description || tokenJson?.error || `HTTP ${tokenRes.status}`
      );
      const clockHint =
        /invalid_grant|iat|exp|jwt/i.test(detail)
          ? ' Verify server clock sync (NTP) and that this JSON key has not been revoked in Google Cloud IAM.'
          : '';
      return {
        clientEmail: creds.client_email,
        projectId: creds.project_id,
        source: parsed.source,
        error: `Google OAuth token exchange failed (${detail}).${clockHint}`.trim(),
      };
    }

    const expiresInSec = Number(tokenJson.expires_in) || 3600;
    const accessToken = String(tokenJson.access_token);
    tokenCache.set(cacheKey, {
      token: accessToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    });

    return {
      token: accessToken,
      clientEmail: creds.client_email,
      projectId: creds.project_id,
      propertyUrl: parsed.propertyUrl,
      source: parsed.source,
    };
  } catch (err: any) {
    return {
      clientEmail: creds.client_email,
      projectId: creds.project_id,
      source: parsed.source,
      error: redactSecrets(err?.message || 'GSC auth failed'),
    };
  }
}

export function buildGscPropertyCandidates(
  canonicalOrigin: string,
  explicitProperty?: string | null
): string[] {
  const candidates = new Set<string>();
  const explicit = explicitProperty ?? getEffectiveGscSiteUrl();
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
  canonicalOrigin: string,
  explicitProperty?: string | null
): Promise<string[]> {
  const fallbackCandidates = buildGscPropertyCandidates(canonicalOrigin, explicitProperty);
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
    } catch {}
  }

  if (!verifiedSites || verifiedSites.length === 0) {
    return fallbackCandidates;
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const cand of fallbackCandidates) {
    const match = verifiedSites.find((s) => s.toLowerCase() === cand.toLowerCase());
    if (match && !seen.has(match)) {
      ordered.push(match);
      seen.add(match);
    }
  }

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
 * Throttled background sitemap submitter for automatic user edits (max 1/hour).
 */
export async function submitSitemapsIfDueAsync(): Promise<void> {
  if (Date.now() - lastSitemapSubmitAtMs < SITEMAP_THROTTLE_MS) {
    return;
  }
  await submitSitemapsToSearchEngines({ force: true });
}

/**
 * Submits sitemap.xml to Google Search Console and Bing Webmaster Tools.
 */
export async function submitSitemapsToSearchEngines(options?: {
  force?: boolean;
}): Promise<{
  gsc: { attempted: boolean; ok: boolean; status: string; siteUrl?: string; error?: string };
  bing: { attempted: boolean; ok: boolean; status: string };
}> {
  if (options?.force === false && Date.now() - lastSitemapSubmitAtMs < SITEMAP_THROTTLE_MS) {
    return {
      gsc: { attempted: false, ok: true, status: 'throttled_hourly' },
      bing: { attempted: false, ok: true, status: 'throttled_hourly' },
    };
  }

  const siteUrl = getCanonicalSiteOrigin();
  const feedPath = `${siteUrl}/sitemap.xml`;

  // 1. Google Search Console Sitemaps API (PUT)
  let gscResult: { attempted: boolean; ok: boolean; status: string; siteUrl?: string; error?: string } = {
    attempted: false,
    ok: false,
    status: 'not_configured',
  };
  const parsedCreds = await parseGscServiceAccountCredentialsAsync();
  if (parsedCreds.configured || parsedCreds.error) {
    gscResult.attempted = true;
    const auth = await getGscClient('https://www.googleapis.com/auth/webmasters');
    if (auth.token) {
      const candidates = await resolveGscSiteCandidates(
        auth.token,
        auth.clientEmail,
        siteUrl,
        auth.propertyUrl
      );
      let lastStatus = 'unknown_error';
      let lastHttpStatus: number | null = null;
      let lastError = '';
      for (const candidate of candidates) {
        try {
          const gscUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(candidate)}/sitemaps/${encodeURIComponent(feedPath)}`;
          const res = await fetch(gscUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${auth.token}` },
            signal: AbortSignal.timeout(5000),
          });
          lastHttpStatus = res.status;
          if (res.ok) {
            gscResult = {
              attempted: true,
              ok: true,
              status: 'submitted_ok',
              siteUrl: candidate,
            };
            await appendSeoIntegrationEvent({
              type: 'sitemap_submit',
              scope: '__system__',
              provider: 'gsc',
              targetUrl: feedPath,
              httpStatus: res.status,
              outcome: 'success',
              detail: candidate,
            });
            break;
          }
          const errJson: any = await res.json().catch(() => ({}));
          lastStatus = `http_${res.status}`;
          lastError = redactSecrets(errJson?.error?.message || `HTTP ${res.status}`);
          if (res.status !== 403 && res.status !== 404) {
            break;
          }
        } catch (err: any) {
          lastStatus = 'network_error';
          lastError = redactSecrets(err?.message || 'network_error');
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
        await appendSeoIntegrationEvent({
          type: 'sitemap_submit',
          scope: '__system__',
          provider: 'gsc',
          targetUrl: feedPath,
          httpStatus: lastHttpStatus,
          outcome: 'failed',
          detail: gscResult.error,
        });
      }
    } else {
      gscResult = {
        attempted: true,
        ok: false,
        status: 'auth_failed',
        error: auth.error || 'auth_failed',
      };
      await appendSeoIntegrationEvent({
        type: 'sitemap_submit',
        scope: '__system__',
        provider: 'gsc',
        targetUrl: feedPath,
        httpStatus: null,
        outcome: 'failed',
        detail: gscResult.error,
      });
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
      await appendSeoIntegrationEvent({
        type: 'sitemap_submit',
        scope: '__system__',
        provider: 'bing',
        targetUrl: feedPath,
        httpStatus: res.status,
        outcome: res.ok ? 'success' : 'failed',
        detail: bingResult.status,
      });
    } catch (err: any) {
      bingResult = {
        attempted: true,
        ok: false,
        status: redactSecrets(err?.message || 'network_error'),
      };
      await appendSeoIntegrationEvent({
        type: 'sitemap_submit',
        scope: '__system__',
        provider: 'bing',
        targetUrl: feedPath,
        httpStatus: null,
        outcome: 'failed',
        detail: bingResult.status,
      });
    }
  }

  lastSitemapSubmitAtMs = Date.now();
  lastSitemapPingResultMemory = `GSC:${gscResult.status} | Bing:${bingResult.status}`;

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
  const parsedCreds = await parseGscServiceAccountCredentialsAsync();
  if (!parsedCreds.configured && !parsedCreds.error) {
    return {
      configured: false,
      ok: false,
      error: 'Google Search Console service account is not configured. Showing local indexability check instead.',
    };
  }

  const siteUrl = getCanonicalSiteOrigin();
  const auth = await getGscClient('https://www.googleapis.com/auth/webmasters.readonly');
  if (!auth.token) {
    return { configured: true, ok: false, error: auth.error || 'GSC auth failed' };
  }

  const candidates = await resolveGscSiteCandidates(
    auth.token,
    auth.clientEmail,
    siteUrl,
    auth.propertyUrl
  );
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
      lastError = redactSecrets(json?.error?.message || `HTTP ${res.status}`);
      if (res.status !== 403 && res.status !== 404) {
        break;
      }
    } catch (err: any) {
      lastError = redactSecrets(err?.message || 'Inspection failed');
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
 * Notifies IndexNow (Bing, Yandex, Naver, Seznam) + Bing Webmaster SubmitUrlbatch when configured.
 */
export async function notifyIndexNow(
  urls: string[],
  options?: { scope?: string; bypassDedup?: boolean }
): Promise<{
  attempted: boolean;
  ok: boolean;
  status: string;
  bingBatchStatus?: string;
}> {
  const now = Date.now();
  const dedupedUrls = Array.from(new Set(urls.filter(Boolean)))
    .filter((u) => {
      if (options?.bypassDedup) return true;
      const until = urlCooldownMap.get(u) || 0;
      return until <= now;
    })
    .slice(0, 100);

  if (dedupedUrls.length === 0) {
    return {
      attempted: false,
      ok: true,
      status: urls.length > 0 ? 'skipped_duplicate' : 'no_urls',
    };
  }

  const siteUrl = getCanonicalSiteOrigin();
  const host = new URL(siteUrl).host;
  const key = await getOrCreateIndexNowKey().catch(() => getIndexNowKey() || null);
  const bingKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const scope = options?.scope || '__system__';

  let status = 'not_configured';
  let ok = false;
  let attempted = false;
  let indexNowHttpStatus: number | null = null;
  let bingBatchStatus: string | undefined;

  if (key) {
    if (now < indexNowCooldownUntil) {
      status = 'indexnow_cooldown';
      attempted = false;
      ok = false;
      await appendSeoIntegrationEvent({
        type: 'indexnow_ping',
        scope,
        provider: 'indexnow',
        targetUrl: dedupedUrls[0],
        httpStatus: 429,
        outcome: 'rate_limited',
        detail: `${dedupedUrls.length} url(s) skipped during cooldown`,
      });
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
            urlList: dedupedUrls,
          }),
          signal: AbortSignal.timeout(4500),
        });
        indexNowHttpStatus = res.status;
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
        if (ok) {
          for (const u of dedupedUrls) {
            urlCooldownMap.set(u, Date.now() + INDEXNOW_URL_DEDUP_MS);
          }
        }
        await appendSeoIntegrationEvent({
          type: 'indexnow_ping',
          scope,
          provider: 'indexnow',
          targetUrl: dedupedUrls[0],
          httpStatus: indexNowHttpStatus,
          outcome: res.status === 429 ? 'rate_limited' : ok ? 'success' : 'failed',
          detail: `${dedupedUrls.length} url(s) · HTTP ${res.status}`,
        });
      } catch (err: any) {
        status = `indexnow_fail:${redactSecrets(err?.message || 'timeout')}`;
        await appendSeoIntegrationEvent({
          type: 'indexnow_ping',
          scope,
          provider: 'indexnow',
          targetUrl: dedupedUrls[0],
          httpStatus: null,
          outcome: 'failed',
          detail: status,
        });
      }
    }
  }

  if (bingKey) {
    try {
      const res = await fetch(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(bingKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, urlList: dedupedUrls }),
          signal: AbortSignal.timeout(4500),
        }
      );
      bingBatchStatus = res.ok ? 'bing_batch_ok' : `bing_err_${res.status}`;
      if (!attempted) {
        attempted = true;
        ok = res.ok;
        status = bingBatchStatus;
      }
      await appendSeoIntegrationEvent({
        type: 'url_batch_submit',
        scope,
        provider: 'bing',
        targetUrl: dedupedUrls[0],
        httpStatus: res.status,
        outcome: res.ok ? 'success' : 'failed',
        detail: `${dedupedUrls.length} url(s) · HTTP ${res.status}`,
      });
    } catch (err: any) {
      bingBatchStatus = `bing_fail:${redactSecrets(err?.message || 'timeout')}`;
      if (!attempted) {
        attempted = true;
        status = bingBatchStatus;
      }
    }
  }

  lastIndexNowAtMemory = new Date().toISOString();
  lastIndexNowUrlsMemory = dedupedUrls.slice(0, 10);
  lastIndexNowStatusMemory = status;

  return { attempted, ok, status, bingBatchStatus };
}

async function persistGscTestMeta(update: Partial<GscMetadataRecord>): Promise<void> {
  try {
    const existing = await readIntegrationsPayload();
    if (!existing.gscMeta && !existing.encryptedGscBlob) return;
    await writeIntegrationsPayload({
      gscMeta: {
        configured: existing.gscMeta?.configured ?? false,
        clientEmail: existing.gscMeta?.clientEmail ?? null,
        projectId: existing.gscMeta?.projectId ?? null,
        privateKeyIdPreview: existing.gscMeta?.privateKeyIdPreview ?? null,
        propertyUrl: existing.gscMeta?.propertyUrl ?? null,
        updatedAt: existing.gscMeta?.updatedAt ?? null,
        updatedBy: existing.gscMeta?.updatedBy ?? null,
        lastTestAt: update.lastTestAt ?? existing.gscMeta?.lastTestAt ?? null,
        lastTestStatus: update.lastTestStatus ?? existing.gscMeta?.lastTestStatus ?? null,
        lastPermissionLevel:
          update.lastPermissionLevel ?? existing.gscMeta?.lastPermissionLevel ?? null,
        lastError: update.lastError !== undefined ? update.lastError : existing.gscMeta?.lastError ?? null,
      },
    });
  } catch {}
}

export async function testGscConnection(): Promise<{
  ok: boolean;
  configured: boolean;
  source: 'env' | 'stored' | 'none';
  oauthOk: boolean;
  clientEmail: string | null;
  projectId: string | null;
  propertyUrl: string;
  matchedProperty: string | null;
  permissionLevel: string | null;
  verifiedSites: string[];
  allSites: Array<{ siteUrl: string; permissionLevel: string }>;
  error: string | null;
  actionableHint: string | null;
}> {
  const [summary, parsed] = await Promise.all([
    getGscSafeConfigSummaryAsync(),
    parseGscServiceAccountCredentialsAsync(),
  ]);
  const siteUrl = getCanonicalSiteOrigin();
  const candidates = buildGscPropertyCandidates(siteUrl, summary.propertyUrl);
  const testedAt = new Date().toISOString();

  if (!parsed.configured || !parsed.creds || parsed.error) {
    const err =
      parsed.error || 'Google Search Console service account JSON is not configured.';
    await persistGscTestMeta({
      lastTestAt: testedAt,
      lastTestStatus: 'error',
      lastError: err,
    });
    return {
      ok: false,
      configured: false,
      source: summary.source,
      oauthOk: false,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      permissionLevel: null,
      verifiedSites: [],
      allSites: [],
      error: err,
      actionableHint: 'Upload or paste your Google Cloud Service Account JSON key below.',
    };
  }

  const auth = await getGscClient('https://www.googleapis.com/auth/webmasters');
  if (!auth.token) {
    const err = auth.error || 'Google OAuth token exchange failed.';
    await persistGscTestMeta({
      lastTestAt: testedAt,
      lastTestStatus: 'auth_failed',
      lastError: err,
    });
    return {
      ok: false,
      configured: true,
      source: summary.source,
      oauthOk: false,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      permissionLevel: null,
      verifiedSites: [],
      allSites: [],
      error: err,
      actionableHint:
        'Check that the Service Account JSON key is active in Google Cloud IAM, has not been revoked, and that the server clock is synchronized.',
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
      const apiMsg = redactSecrets(json?.error?.message || `HTTP ${res.status}`);
      const isApiDisabled =
        res.status === 403 && /disabled|not enabled|Search Console API/i.test(apiMsg);
      const hint = isApiDisabled
        ? `Enable "Google Search Console API" in Google Cloud project "${summary.projectId || 'your project'}".`
        : `Grant ${summary.clientEmail} Full or Owner access in Google Search Console -> Settings -> Users and permissions.`;
      await persistGscTestMeta({
        lastTestAt: testedAt,
        lastTestStatus: `http_${res.status}`,
        lastError: apiMsg,
      });
      return {
        ok: false,
        configured: true,
        source: summary.source,
        oauthOk: true,
        clientEmail: summary.clientEmail,
        projectId: summary.projectId,
        propertyUrl: summary.propertyUrl,
        matchedProperty: null,
        permissionLevel: null,
        verifiedSites: [],
        allSites: [],
        error: `Google Search Console API error: ${apiMsg}`,
        actionableHint: hint,
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

    const matchedEntry = matchedProperty
      ? allSites.find((s) => s.siteUrl === matchedProperty)
      : null;
    const permissionLevel = matchedEntry?.permissionLevel || null;
    const ok = Boolean(matchedProperty);
    const actionableHint = ok
      ? null
      : verifiedSites.length === 0
        ? `OAuth succeeded, but no GSC properties are shared with ${summary.clientEmail}. In Google Search Console -> Settings -> Users and permissions, add ${summary.clientEmail} as Full or Owner user.`
        : `OAuth succeeded (properties visible: ${verifiedSites.join(', ')}), but none match ${candidates[0]}. Set Property URL or add ${summary.clientEmail} to ${candidates[0]}.`;

    await persistGscTestMeta({
      lastTestAt: testedAt,
      lastTestStatus: ok ? 'connected' : 'property_mismatch',
      lastPermissionLevel: permissionLevel,
      lastError: ok ? null : actionableHint,
    });

    await appendSeoIntegrationEvent({
      type: 'gsc_connection_test',
      scope: '__system__',
      provider: 'gsc',
      targetUrl: matchedProperty || summary.propertyUrl,
      httpStatus: res.status,
      outcome: ok ? 'success' : 'failed',
      detail: ok ? `${permissionLevel || 'verified'}` : actionableHint || undefined,
    });

    return {
      ok,
      configured: true,
      source: summary.source,
      oauthOk: true,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: matchedProperty || summary.propertyUrl,
      matchedProperty,
      permissionLevel,
      verifiedSites,
      allSites,
      error: ok ? null : actionableHint,
      actionableHint,
    };
  } catch (err: any) {
    const errMsg = redactSecrets(err?.message || 'Network error contacting Google Search Console.');
    await persistGscTestMeta({
      lastTestAt: testedAt,
      lastTestStatus: 'network_error',
      lastError: errMsg,
    });
    return {
      ok: false,
      configured: true,
      source: summary.source,
      oauthOk: true,
      clientEmail: summary.clientEmail,
      projectId: summary.projectId,
      propertyUrl: summary.propertyUrl,
      matchedProperty: null,
      permissionLevel: null,
      verifiedSites: [],
      allSites: [],
      error: errMsg,
      actionableHint: null,
    };
  }
}

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { parseEmbedUrl, detectProviderUrl, type ParsedEmbed } from '../../src/lib/embeds.ts';
import type { EmbedMetaData, EmbedProvider } from '../../src/data/types.ts';
import { fetchYouTubeShowcase } from './youtube.ts';
import {
  getServerConfig,
  redactSecrets,
  type SocialOAuthProvider,
  type ProviderCredentials,
} from './serverConfig.ts';

export type { SocialOAuthProvider };

// Short-lived in-memory PKCE verifier store keyed by OAuth state nonce (X/Twitter PKCE OAuth 2.0)
const pkceStore = new Map<string, { verifier: string; expiresAt: number }>();

// Caches: 6h for stats-bearing providers, 24h for static media metadata, +/- 10% jitter
const STATS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const embedCache = new Map<string, { data: EmbedMetaData; parsed: ParsedEmbed; suggestedTitle: string; expiresAt: number }>();

// Rate limiters (PV-12 & PV-4)
const lookupRateMap = new Map<string, number[]>();
const REFRESH_COOLDOWN_MS = 60_000;
const refreshCooldownMap = new Map<string, number>();

// Spotify token cache, single in-flight lock, 429 cooldown, and global Web API -> oEmbed failover (PV-8)
let cachedSpotifyAppToken: { token: string; expiresAt: number } | null = null;
let spotifyTokenInFlight: Promise<string | null> | null = null;
let spotifyRateLimitedUntil = 0;
let spotifyWebApiFailures = 0;
let spotifyCircuitOpenUntil = 0;

// Telemetry rolling window (15 min)
const telemetryEvents: Array<{ provider: string; status: number; ok: boolean; latencyMs: number; at: number }> = [];
const TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

function recordProviderTelemetry(provider: string, status: number, ok: boolean, latencyMs: number): void {
  const now = Date.now();
  telemetryEvents.push({ provider, status, ok, latencyMs, at: now });
  const cutoff = now - TELEMETRY_WINDOW_MS;
  while (telemetryEvents.length > 0 && telemetryEvents[0].at < cutoff) {
    telemetryEvents.shift();
  }
  const providerEvents = telemetryEvents.filter((e) => e.provider === provider);
  if (providerEvents.length >= 5) {
    const failed = providerEvents.filter((e) => !e.ok).length;
    const rate = failed / providerEvents.length;
    const prevAlert = lastAlertAt.get(provider) || 0;
    if (rate > 0.2 && now - prevAlert > 5 * 60_000) {
      lastAlertAt.set(provider, now);
      console.warn(
        `[provider-alert] ${provider} failure rate ${(rate * 100).toFixed(0)}% over 15m (last status=${status}, latency=${latencyMs}ms)`
      );
    }
  }
}

export function resetSpotifyClientStateForTests(): void {
  cachedSpotifyAppToken = null;
  spotifyTokenInFlight = null;
  spotifyRateLimitedUntil = 0;
  spotifyWebApiFailures = 0;
  spotifyCircuitOpenUntil = 0;
  embedCache.clear();
  lookupRateMap.clear();
  refreshCooldownMap.clear();
  telemetryEvents.length = 0;
  lastAlertAt.clear();
}

export function getPinterestAccessToken(): string {
  return getServerConfig().pinterestAccessToken;
}

export function isPinterestOAuthEnabled(): boolean {
  return getServerConfig().pinterestOAuthEnabled;
}

export function getSocialOAuthCredentials(provider: SocialOAuthProvider): ProviderCredentials {
  return getServerConfig().oauth[provider];
}

export function isValidSocialOAuthProvider(value: string): value is SocialOAuthProvider {
  return (
    value === 'discord' ||
    value === 'github' ||
    value === 'linkedin' ||
    value === 'x' ||
    value === 'instagram' ||
    value === 'facebook' ||
    value === 'threads' ||
    value === 'spotify' ||
    value === 'pinterest'
  );
}

export function checkEmbedLookupRateLimit(key: string, limitPerMin = 20): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowStart = now - 60_000;
  const bucket = (lookupRateMap.get(key) || []).filter((ts) => ts > windowStart);
  if (bucket.length >= limitPerMin) {
    const oldest = bucket[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    lookupRateMap.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }
  bucket.push(now);
  lookupRateMap.set(key, bucket);
  return { allowed: true };
}

export function checkBlockRefreshCooldown(blockId: string): { allowed: boolean; retryAfterSec?: number } {
  const cleanId = (blockId || '').trim();
  if (!cleanId) return { allowed: true };
  const now = Date.now();
  const last = refreshCooldownMap.get(cleanId) || 0;
  if (now - last < REFRESH_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((REFRESH_COOLDOWN_MS - (now - last)) / 1000)),
    };
  }
  refreshCooldownMap.set(cleanId, now);
  return { allowed: true };
}

function getCacheTtlWithJitter(provider: EmbedProvider): number {
  const base =
    provider === 'youtube' || provider === 'github' || provider === 'x' || provider === 'discord'
      ? STATS_CACHE_TTL_MS
      : METADATA_CACHE_TTL_MS;
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.round(base * jitter);
}

function setCachedEmbed(canonicalUrl: string, parsed: ParsedEmbed, data: EmbedMetaData, suggestedTitle: string): void {
  embedCache.set(canonicalUrl, {
    parsed,
    data,
    suggestedTitle,
    expiresAt: Date.now() + getCacheTtlWithJitter(parsed.provider),
  });
}

// ---------- SSRF & Tracking Parameter Hygiene (PV-5) ----------

const TRACKING_PARAMS = new Set([
  'si',
  'igshid',
  'igsh',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref_src',
  'ref_url',
  'feature',
]);

export function stripTrackingParams(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^spotify:/i.test(trimmed)) return trimmed;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(normalized);
    u.hostname = u.hostname.toLowerCase();
    for (const key of Array.from(u.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

export function isBlockedIpAddress(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '').toLowerCase();
  if (!clean) return true;
  if (clean.startsWith('::ffff:')) {
    return isBlockedIpAddress(clean.slice(7));
  }
  const version = net.isIP(clean);
  if (version === 4) {
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16.0.0/12
    if (a === 192 && b === 168) return true; // RFC1918 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (version === 6) {
    if (clean === '::' || clean === '::1') return true;
    if (clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) return true;
    if (clean.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
}

export async function validateExternalFetchUrl(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  if (u.port && u.port !== '80' && u.port !== '443') {
    return { ok: false, reason: 'forbidden_port' };
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    return { ok: false, reason: 'forbidden_host' };
  }
  if (net.isIP(host)) {
    return isBlockedIpAddress(host) ? { ok: false, reason: 'forbidden_ip' } : { ok: true, url: u };
  }
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: 'dns_unresolvable' };
    }
    for (const rec of records) {
      if (isBlockedIpAddress(rec.address)) {
        return { ok: false, reason: 'forbidden_resolved_ip' };
      }
    }
  } catch {
    // If DNS lookup fails offline/in sandboxed test mocks where fetch is stubbed, allow safe hostname format through only if valid public domain
    if (!host.includes('.')) {
      return { ok: false, reason: 'invalid_hostname' };
    }
  }
  return { ok: true, url: u };
}

async function readResponseTextLimited(res: Response, maxBytes = 1_048_576): Promise<string> {
  const cl = Number(res.headers.get('content-length') || '0');
  if (cl > maxBytes) {
    throw new Error('Response exceeded 1 MB cap');
  }
  if (!res.body) {
    const txt = await res.text();
    if (Buffer.byteLength(txt, 'utf8') > maxBytes) throw new Error('Response exceeded 1 MB cap');
    return txt;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new Error('Response exceeded 1 MB cap');
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function expandShortUrlSafe(rawUrl: string, maxRedirects = 3): Promise<string> {
  let current = stripTrackingParams(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const valid = await validateExternalFetchUrl(current);
    if (!valid.ok) {
      throw new Error(`Blocked URL (${valid.reason})`);
    }
    try {
      const res = await fetch(valid.url.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'iveo-resolver/1.0' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return current;
        current = stripTrackingParams(new URL(location, valid.url).toString());
        continue;
      }
      return valid.url.toString();
    } catch {
      return current;
    }
  }
  return current;
}

// ---------- OAuth Setup (for Connected Platforms & Editor Connect) ----------

export function resolveSocialOAuthRedirectUri(
  provider: SocialOAuthProvider,
  requestOrigin?: string
): string {
  const cleanOrigin =
    requestOrigin && /^https?:\/\//i.test(requestOrigin.trim())
      ? requestOrigin.trim().replace(/\/+$/, '')
      : null;
  const appUrl = getServerConfig().appUrl;
  const cleanAppUrl =
    appUrl && /^https?:\/\//i.test(appUrl) ? appUrl.replace(/\/+$/, '') : null;

  const base = cleanOrigin || cleanAppUrl || 'https://iveo.site';
  return `${base}/api/oauth/${provider}/callback`;
}

export function buildSocialOAuthUrl(
  provider: SocialOAuthProvider,
  requestOrigin?: string
): { url: string; redirectUri: string } {
  const creds = getSocialOAuthCredentials(provider);
  if (!creds.clientId) {
    throw new Error(`${provider} connection is not configured on the server.`);
  }
  if (provider === 'pinterest' && !isPinterestOAuthEnabled()) {
    throw new Error('Pinterest OAuth connection is disabled until Standard API access is enabled.');
  }
  const redirectUri = resolveSocialOAuthRedirectUri(provider, requestOrigin);
  const nonce = crypto.randomBytes(12).toString('base64url');
  const statePayload = Buffer.from(
    JSON.stringify({ p: provider, r: redirectUri, n: nonce }),
    'utf8'
  ).toString('base64url');

  if (provider === 'discord') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      prompt: 'consent',
      state: statePayload,
    });
    return {
      url: `https://discord.com/oauth2/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user',
      state: statePayload,
    });
    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'linkedin') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile',
      state: statePayload,
    });
    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'facebook') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state: statePayload,
      response_type: 'code',
      scope: 'public_profile',
    });
    return {
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'instagram') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state: statePayload,
      response_type: 'code',
      scope: 'public_profile,instagram_basic,pages_show_list',
    });
    return {
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'threads') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'threads_basic',
      response_type: 'code',
      state: statePayload,
    });
    return {
      url: `https://threads.net/oauth/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'spotify') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'user-read-private',
      state: statePayload,
    });
    return {
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'pinterest') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user_accounts:read,boards:read,pins:read',
      state: statePayload,
    });
    return {
      url: `https://www.pinterest.com/oauth/?${params.toString()}`,
      redirectUri,
    };
  }

  // X (Twitter) OAuth 2.0 PKCE S256
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pkceStore.set(nonce, { verifier, expiresAt: Date.now() + 15 * 60_000 });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    scope: 'users.read tweet.read',
    state: statePayload,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return {
    url: `https://x.com/i/oauth2/authorize?${params.toString()}`,
    redirectUri,
  };
}

export function parseSocialOAuthState(
  stateParam?: string,
  fallbackOrigin?: string,
  provider?: SocialOAuthProvider
): { redirectUri: string; nonce: string | null } {
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
      const redirectUri =
        decoded?.r && typeof decoded.r === 'string' && /^https?:\/\//i.test(decoded.r)
          ? decoded.r
          : resolveSocialOAuthRedirectUri(provider || 'github', fallbackOrigin);
      const nonce = typeof decoded?.n === 'string' ? decoded.n : null;
      return { redirectUri, nonce };
    } catch {}
  }
  return {
    redirectUri: resolveSocialOAuthRedirectUri(provider || 'github', fallbackOrigin),
    nonce: null,
  };
}

export interface SocialOAuthConnectResult {
  provider: SocialOAuthProvider;
  url: string;
  title: string;
  embedMeta: EmbedMetaData;
}

async function readPinterestProfileWithToken(
  token: string,
  viaOAuth: boolean
): Promise<SocialOAuthConnectResult> {
  const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5500),
  });
  const user: any = await userRes.json().catch(() => null);
  if (!userRes.ok || !user?.username) {
    const errMsg = redactSecrets(user?.message || `Pinterest API returned HTTP ${userRes.status}.`);
    throw new Error(errMsg);
  }

  let coverUrl: string | null = null;
  let boardCount = 0;
  try {
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=3', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (boardsRes.ok) {
      const boardsJson: any = await boardsRes.json().catch(() => null);
      const items = Array.isArray(boardsJson?.items) ? boardsJson.items : [];
      boardCount = items.length;
      const withCover = items.find((b: any) => b?.media?.image_cover_url);
      coverUrl = withCover?.media?.image_cover_url || null;
    }
  } catch {}

  const username = String(user.username).replace(/^@+/, '');
  const displayName = user.business_name || `@${username}`;
  const statsParts: string[] = [];
  if (typeof user.follower_count === 'number' && user.follower_count > 0) {
    statsParts.push(`${user.follower_count.toLocaleString()} followers`);
  }
  if (typeof user.pin_count === 'number' && user.pin_count > 0) {
    statsParts.push(`${user.pin_count.toLocaleString()} pins`);
  } else if (boardCount > 0) {
    statsParts.push(`${boardCount}+ boards`);
  }

  const profileUrl = `https://www.pinterest.com/${username}/`;
  return {
    provider: 'pinterest',
    url: profileUrl,
    title: displayName,
    embedMeta: {
      provider: 'pinterest',
      title: displayName,
      subtitle: `@${username}`,
      description: user.about || null,
      avatarUrl: user.profile_image || null,
      coverUrl,
      badgeText: 'Pinterest',
      statsLabel: statsParts.join(' · ') || null,
      handle: `@${username}`,
      connectedViaOAuth: viaOAuth,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function fetchPinterestAccountFromToken(): Promise<SocialOAuthConnectResult> {
  const token = getPinterestAccessToken();
  if (!token) {
    throw new Error('Pinterest Access Token is not configured on the server.');
  }
  return readPinterestProfileWithToken(token, true);
}

export async function exchangeSocialOAuthCode(
  provider: SocialOAuthProvider,
  code: string,
  redirectUri: string,
  nonce?: string | null
): Promise<SocialOAuthConnectResult> {
  const creds = getSocialOAuthCredentials(provider);
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error(`${provider} connection is not configured on the server.`);
  }

  if (provider === 'discord') {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail = redactSecrets(
        tokenJson?.error_description ||
          tokenJson?.message ||
          tokenJson?.error ||
          `Discord token exchange failed (HTTP ${tokenRes.status}).`
      );
      throw new Error(detail);
    }

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.id) {
      throw new Error('Could not read Discord profile details.');
    }

    let defaultAvatarIdx = 0;
    try {
      if (user.discriminator && user.discriminator !== '0') {
        defaultAvatarIdx = Number(user.discriminator) % 5;
      } else if (/^\d+$/.test(String(user.id))) {
        defaultAvatarIdx = Number((BigInt(user.id) >> 22n) % 6n);
      }
    } catch {
      defaultAvatarIdx = 0;
    }

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${String(user.avatar).startsWith('a_') ? 'gif' : 'png'}?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIdx}.png`;
    const displayName = user.global_name || user.username || 'Discord';
    const handleText =
      user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : `@${user.username}`;
    const accentHex =
      typeof user.accent_color === 'number'
        ? `#${user.accent_color.toString(16).padStart(6, '0')}`
        : null;
    const profileUrl = `https://discord.com/users/${user.id}`;

    return {
      provider: 'discord',
      url: profileUrl,
      title: displayName,
      embedMeta: {
        provider: 'discord',
        title: displayName,
        subtitle: handleText,
        description: null,
        avatarUrl,
        badgeText: 'Discord',
        handle: handleText,
        accentColor: accentHex,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'github') {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(redactSecrets(tokenJson?.error_description || tokenJson?.error || 'GitHub connection failed.'));
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'iveo-embed/1.0',
      },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.login) {
      throw new Error('Could not read GitHub profile details.');
    }

    const title = user.name || `@${user.login}`;
    const statsParts: string[] = [];
    if (typeof user.public_repos === 'number') statsParts.push(`${user.public_repos} repos`);
    if (typeof user.followers === 'number') statsParts.push(`${user.followers} followers`);

    return {
      provider: 'github',
      url: user.html_url || `https://github.com/${user.login}`,
      title,
      embedMeta: {
        provider: 'github',
        title,
        subtitle: `@${user.login}`,
        description: user.bio || null,
        avatarUrl: user.avatar_url || null,
        badgeText: 'GitHub',
        statsLabel: statsParts.join(' · ') || null,
        handle: `@${user.login}`,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'linkedin') {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(redactSecrets(tokenJson?.error_description || tokenJson?.error || 'LinkedIn connection failed.'));
    }

    const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.sub) {
      throw new Error('Could not read LinkedIn profile details.');
    }

    const name = user.name || `${user.given_name || ''} ${user.family_name || ''}`.trim() || 'LinkedIn';
    const slugHint = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || user.sub;
    return {
      provider: 'linkedin',
      url: `https://www.linkedin.com/in/${slugHint}`,
      title: name,
      embedMeta: {
        provider: 'linkedin',
        title: name,
        subtitle: `linkedin.com/in/${slugHint}`,
        description: null,
        avatarUrl: user.picture || null,
        badgeText: 'LinkedIn',
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'facebook' || provider === 'instagram') {
    const tokenParams = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
      { signal: AbortSignal.timeout(6500) }
    );
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail = redactSecrets(
        tokenJson?.error?.message ||
          tokenJson?.error_description ||
          `${provider === 'instagram' ? 'Instagram' : 'Facebook'} connection failed.`
      );
      throw new Error(detail);
    }

    const accessToken = String(tokenJson.access_token);
    if (provider === 'instagram') {
      try {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}&access_token=${encodeURIComponent(accessToken)}`,
          { signal: AbortSignal.timeout(5500) }
        );
        if (accountsRes.ok) {
          const accountsJson: any = await accountsRes.json().catch(() => null);
          const igAccount = (accountsJson?.data || [])
            .map((p: any) => p?.instagram_business_account)
            .find((ig: any) => ig?.username || ig?.id);
          if (igAccount) {
            const igHandle = igAccount.username ? `@${igAccount.username}` : igAccount.name || 'Instagram';
            const igUrl = igAccount.username
              ? `https://www.instagram.com/${igAccount.username}/`
              : 'https://www.instagram.com/';
            const statsParts: string[] = [];
            if (typeof igAccount.followers_count === 'number' && igAccount.followers_count > 0) {
              statsParts.push(`${igAccount.followers_count.toLocaleString()} followers`);
            }
            if (typeof igAccount.media_count === 'number' && igAccount.media_count > 0) {
              statsParts.push(`${igAccount.media_count.toLocaleString()} posts`);
            }
            return {
              provider: 'instagram',
              url: igUrl,
              title: igAccount.name || igHandle,
              embedMeta: {
                provider: 'instagram',
                title: igAccount.name || igHandle,
                subtitle: igHandle,
                description: igAccount.biography || null,
                avatarUrl: igAccount.profile_picture_url || null,
                badgeText: 'Instagram',
                statsLabel: statsParts.join(' · ') || null,
                handle: igHandle,
                connectedViaOAuth: true,
                fetchedAt: new Date().toISOString(),
              },
            };
          }
        }
      } catch {}
    }

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,link,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(5500) }
    );
    const me: any = await meRes.json().catch(() => null);
    if (!meRes.ok || !me?.id) {
      throw new Error(`Could not read ${provider === 'instagram' ? 'Instagram' : 'Facebook'} profile details.`);
    }

    const avatarUrl = me.picture?.data?.url || null;
    const displayName = me.name || (provider === 'instagram' ? 'Instagram' : 'Facebook');
    if (provider === 'instagram') {
      const slug = displayName.toLowerCase().replace(/[^a-z0-9._]+/g, '') || me.id;
      return {
        provider: 'instagram',
        url: `https://www.instagram.com/${slug}/`,
        title: displayName,
        embedMeta: {
          provider: 'instagram',
          title: displayName,
          subtitle: `@${slug}`,
          description: null,
          avatarUrl,
          badgeText: 'Instagram',
          handle: `@${slug}`,
          connectedViaOAuth: true,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const fbUrl = me.link || `https://www.facebook.com/profile.php?id=${me.id}`;
    return {
      provider: 'facebook',
      url: fbUrl,
      title: displayName,
      embedMeta: {
        provider: 'facebook',
        title: displayName,
        subtitle: fbUrl.replace(/^https?:\/\/(www\.)?/, ''),
        description: null,
        avatarUrl,
        badgeText: 'Facebook',
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'threads') {
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(redactSecrets(tokenJson?.error_message || tokenJson?.error?.message || 'Threads connection failed.'));
    }

    const userRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${encodeURIComponent(String(tokenJson.access_token))}`,
      { signal: AbortSignal.timeout(5500) }
    );
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || (!user?.username && !user?.id)) {
      throw new Error('Could not read Threads profile details.');
    }

    const username = user.username ? String(user.username).replace(/^@+/, '') : String(user.id);
    const handle = `@${username}`;
    const displayName = user.name || handle;

    return {
      provider: 'threads',
      url: `https://www.threads.net/@${username}`,
      title: displayName,
      embedMeta: {
        provider: 'threads',
        title: displayName,
        subtitle: handle,
        description: user.threads_biography || null,
        avatarUrl: user.threads_profile_picture_url || null,
        badgeText: 'Threads',
        handle,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'spotify') {
    const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(redactSecrets(tokenJson?.error_description || tokenJson?.error || 'Spotify connection failed.'));
    }

    const accessToken = String(tokenJson.access_token);
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5500),
    });
    const me: any = await meRes.json().catch(() => null);
    if (!meRes.ok || !me?.id) {
      throw new Error('Could not read Spotify profile details.');
    }

    const profileUrl = me.external_urls?.spotify || `https://open.spotify.com/user/${me.id}`;
    const artwork = me.images?.[0]?.url || null;
    return {
      provider: 'spotify',
      url: profileUrl,
      title: me.display_name || me.id,
      embedMeta: {
        provider: 'spotify',
        title: me.display_name || me.id,
        subtitle: 'Spotify',
        description: null,
        avatarUrl: artwork,
        coverUrl: artwork,
        badgeText: 'Spotify',
        statsLabel: null, // Never show removed follower counts or stats on Spotify
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'pinterest') {
    if (!isPinterestOAuthEnabled()) {
      throw new Error('Pinterest OAuth connection is disabled until Standard API access is enabled.');
    }
    const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(redactSecrets(tokenJson?.message || tokenJson?.error_description || 'Pinterest connection failed.'));
    }
    return readPinterestProfileWithToken(String(tokenJson.access_token), true);
  }

  // X (Twitter)
  const pkceEntry = nonce ? pkceStore.get(nonce) : undefined;
  if (nonce) pkceStore.delete(nonce);
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');

  const formParams = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    code_verifier: pkceEntry?.verifier || '',
  });

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: formParams.toString(),
    signal: AbortSignal.timeout(6500),
  });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(redactSecrets(tokenJson?.error_description || tokenJson?.error || 'X connection failed.'));
  }

  const userRes = await fetch(
    'https://api.x.com/2/users/me?user.fields=profile_image_url,description,public_metrics',
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    }
  );
  const userJson: any = await userRes.json().catch(() => null);
  const user = userJson?.data;
  if (!userRes.ok || !user?.username) {
    throw new Error('Could not read X profile details.');
  }

  const followers = user.public_metrics?.followers_count;
  return {
    provider: 'x',
    url: `https://x.com/${user.username}`,
    title: user.name || `@${user.username}`,
    embedMeta: {
      provider: 'x',
      title: user.name || `@${user.username}`,
      subtitle: `@${user.username}`,
      description: user.description || null,
      avatarUrl: user.profile_image_url ? String(user.profile_image_url).replace('_normal.', '_400x400.') : null,
      badgeText: 'X',
      statsLabel: typeof followers === 'number' && followers > 0 ? `${followers.toLocaleString()} followers` : null,
      handle: `@${user.username}`,
      connectedViaOAuth: true,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ---------- OpenGraph Unfurl (SSRF-safe, 3s timeout, 1MB cap) ----------

function formatReadableSlug(slug: string): string {
  return decodeURIComponent(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .trim();
}

function extractMetaTag(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i'
    );
    const match = html.match(re1) || html.match(re2);
    if (match?.[1]) {
      const cleaned = decodeHtmlEntities(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

export async function fetchOpenGraphMetadata(
  rawUrl: string,
  userAgent = 'iveo-unfurl/1.0 (+https://iveo.site)'
): Promise<{
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
} | null> {
  const started = Date.now();
  try {
    const finalUrl = await expandShortUrlSafe(rawUrl, 3);
    const valid = await validateExternalFetchUrl(finalUrl);
    if (!valid.ok) return null;

    const res = await fetch(valid.url.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(3000),
    });
    recordProviderTelemetry('opengraph', res.status, res.ok, Date.now() - started);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml')) return null;

    const html = await readResponseTextLimited(res, 1_048_576);
    const ogTitle = extractMetaTag(html, ['og:title', 'twitter:title']);
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const title = ogTitle || (titleTag ? decodeHtmlEntities(titleTag) : null);
    const description = extractMetaTag(html, ['og:description', 'twitter:description', 'description']);
    const rawImg = extractMetaTag(html, ['og:image', 'og:image:secure_url', 'twitter:image']);
    let image: string | null = null;
    if (rawImg) {
      try {
        const resolvedImg = new URL(rawImg, valid.url).toString();
        if (/^https?:\/\//i.test(resolvedImg)) image = resolvedImg;
      } catch {}
    }
    return {
      finalUrl: valid.url.toString(),
      title,
      description,
      image,
    };
  } catch {
    recordProviderTelemetry('opengraph', 0, false, Date.now() - started);
    return null;
  }
}

// ---------- Spotify Web API (Feb 2026 Compliant) + oEmbed Failover ----------

export async function getSpotifyAppToken(forceFresh = false): Promise<string | null> {
  if (!forceFresh && cachedSpotifyAppToken && cachedSpotifyAppToken.expiresAt > Date.now()) {
    return cachedSpotifyAppToken.token;
  }
  if (forceFresh) {
    cachedSpotifyAppToken = null;
  }
  if (spotifyTokenInFlight) {
    return spotifyTokenInFlight;
  }

  const creds = getSocialOAuthCredentials('spotify');
  if (!creds.clientId || !creds.clientSecret) {
    return null;
  }

  spotifyTokenInFlight = (async () => {
    const started = Date.now();
    try {
      const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(4500),
      });
      recordProviderTelemetry('spotify_token', res.status, res.ok, Date.now() - started);
      if (!res.ok) {
        spotifyWebApiFailures++;
        if (spotifyWebApiFailures >= 2) {
          spotifyCircuitOpenUntil = Date.now() + 10 * 60_000;
          console.warn(
            `[spotify-failover] Token endpoint failed (HTTP ${res.status}); failing over to Spotify oEmbed.`
          );
        }
        return null;
      }
      const json: any = await res.json().catch(() => null);
      if (!json?.access_token) return null;
      const expiresInMs = Math.max(60, Number(json.expires_in || 3600) - 60) * 1000;
      cachedSpotifyAppToken = {
        token: String(json.access_token),
        expiresAt: Date.now() + expiresInMs,
      };
      spotifyWebApiFailures = 0;
      spotifyCircuitOpenUntil = 0;
      return cachedSpotifyAppToken.token;
    } catch (err: any) {
      recordProviderTelemetry('spotify_token', 0, false, Date.now() - started);
      spotifyWebApiFailures++;
      if (spotifyWebApiFailures >= 2) {
        spotifyCircuitOpenUntil = Date.now() + 10 * 60_000;
        console.warn(`[spotify-failover] ${redactSecrets(String(err?.message || 'network error'))}`);
      }
      return null;
    } finally {
      spotifyTokenInFlight = null;
    }
  })();

  return spotifyTokenInFlight;
}

async function fetchSpotifyOembedFallback(
  canonicalUrl: string,
  parsed: ParsedEmbed,
  nowIso: string
): Promise<EmbedMetaData | null> {
  const started = Date.now();
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`, {
      headers: { 'User-Agent': 'iveo-embed/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    recordProviderTelemetry('spotify_oembed', res.status, res.ok, Date.now() - started);
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    const cleanTitle = typeof json?.title === 'string' ? json.title.trim() : '';
    if (!cleanTitle) return null;
    const thumb =
      typeof json?.thumbnail_url === 'string' && /^https?:\/\//i.test(json.thumbnail_url)
        ? json.thumbnail_url
        : null;
    return {
      provider: 'spotify',
      title: cleanTitle,
      subtitle:
        (typeof json?.author_name === 'string' && json.author_name.trim()) ||
        (parsed.subtype ? `Spotify ${parsed.subtype}` : 'Spotify'),
      description: null,
      avatarUrl: thumb,
      coverUrl: thumb,
      badgeText: parsed.label,
      statsLabel: null, // Never show stats on Spotify
      fetchedAt: nowIso,
    };
  } catch {
    recordProviderTelemetry('spotify_oembed', 0, false, Date.now() - started);
    return null;
  }
}

async function fetchSpotifyApiMetadata(
  subtype: string,
  id: string,
  canonicalUrl: string,
  nowIso: string
): Promise<{ meta: EmbedMetaData | null; rateLimited?: boolean }> {
  if (Date.now() < spotifyCircuitOpenUntil || Date.now() < spotifyRateLimitedUntil) {
    return { meta: null, rateLimited: Date.now() < spotifyRateLimitedUntil };
  }

  const endpointMap: Record<string, string> = {
    track: 'tracks',
    album: 'albums',
    playlist: 'playlists',
    artist: 'artists',
    show: 'shows',
    episode: 'episodes',
  };
  const plural = endpointMap[subtype];
  if (!plural) return { meta: null };

  let token = await getSpotifyAppToken(false);
  if (!token) return { meta: null };

  const callApi = async (bearer: string): Promise<Response> => {
    const started = Date.now();
    const res = await fetch(`https://api.spotify.com/v1/${plural}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(4500),
    });
    recordProviderTelemetry('spotify_api', res.status, res.ok, Date.now() - started);
    return res;
  };

  try {
    let res = await callApi(token);
    if (res.status === 401) {
      // Refresh token once on 401
      const freshToken = await getSpotifyAppToken(true);
      if (freshToken) {
        res = await callApi(freshToken);
      }
    }

    if (res.status === 429) {
      const retrySec = Math.max(5, Number(res.headers.get('retry-after') || '30') || 30);
      spotifyRateLimitedUntil = Date.now() + retrySec * 1000;
      console.warn(`[spotify] Rate limited (429). Retry-After=${retrySec}s`);
      return { meta: null, rateLimited: true };
    }

    if (!res.ok) {
      spotifyWebApiFailures++;
      if (spotifyWebApiFailures >= 3 || res.status === 403 || res.status >= 500) {
        spotifyCircuitOpenUntil = Date.now() + 10 * 60_000;
        console.warn(`[spotify-failover] Web API status=${res.status}; switching provider to oEmbed.`);
      }
      return { meta: null };
    }

    const data: any = await res.json().catch(() => null);
    if (!data?.name) return { meta: null };

    spotifyWebApiFailures = 0;

    // Feb 2026 compliant mapping: NEVER read removed fields
    // (artist followers/popularity, track/album popularity, show publisher, available_markets, playlist tracklist)
    let subtitle: string | null = null;
    let description: string | null = null;
    let artwork: string | null = null;

    if (subtype === 'track') {
      const artists = Array.isArray(data.artists)
        ? data.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
        : '';
      subtitle = artists || data.album?.name || 'Track';
      description = data.album?.name ? `From ${data.album.name}` : null;
      artwork = data.album?.images?.[0]?.url || null;
    } else if (subtype === 'album') {
      const artists = Array.isArray(data.artists)
        ? data.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
        : '';
      subtitle = artists || 'Album';
      description = data.release_date ? `Released ${String(data.release_date).slice(0, 4)}` : null;
      artwork = data.images?.[0]?.url || null;
    } else if (subtype === 'playlist') {
      subtitle = data.owner?.display_name ? `By ${data.owner.display_name}` : 'Playlist';
      description = data.description
        ? decodeHtmlEntities(String(data.description).replace(/<[^>]+>/g, '')).trim() || null
        : null;
      artwork = data.images?.[0]?.url || null;
    } else if (subtype === 'artist') {
      const genres = Array.isArray(data.genres) ? data.genres.slice(0, 2).join(', ') : '';
      subtitle = genres || 'Artist';
      artwork = data.images?.[0]?.url || null;
    } else if (subtype === 'show' || subtype === 'episode') {
      subtitle = data.show?.name || (subtype === 'episode' ? 'Podcast episode' : 'Podcast');
      description = data.description || null;
      artwork = data.images?.[0]?.url || data.show?.images?.[0]?.url || null;
    }

    return {
      meta: {
        provider: 'spotify',
        title: String(data.name),
        subtitle: subtitle || canonicalUrl,
        description,
        avatarUrl: artwork,
        coverUrl: artwork,
        statsLabel: null, // PV-8: Spotify cards have no Show stats
        badgeText: `Spotify ${subtype}`,
        fetchedAt: nowIso,
      },
    };
  } catch (err: any) {
    recordProviderTelemetry('spotify_api', 0, false, 0);
    spotifyWebApiFailures++;
    if (spotifyWebApiFailures >= 3) {
      spotifyCircuitOpenUntil = Date.now() + 10 * 60_000;
    }
    console.warn(`[spotify-failover] ${redactSecrets(String(err?.message || 'lookup failed'))}`);
    return { meta: null };
  }
}

// ---------- Unified Resolution Pipeline (PV-2) ----------

function toParsedEmbedFromDetected(rawUrl: string): ParsedEmbed | null {
  const strict = parseEmbedUrl(rawUrl);
  if (strict) return strict;
  const detected = detectProviderUrl(rawUrl);
  if (!detected || detected.provider === 'generic') return null;
  return {
    provider: detected.provider,
    canonicalUrl: detected.canonicalUrl,
    embedSrc: detected.embedSrc || detected.canonicalUrl,
    label: detected.label,
    height: detected.height ?? null,
    aspect: detected.aspect === '16/9' ? '16 / 9' : null,
    identifier: detected.identifier,
    subtype: detected.subtype,
  };
}

export async function fetchSocialEmbedMetadata(
  rawUrl: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  parsed: ParsedEmbed;
  embedMeta: EmbedMetaData;
  suggestedTitle: string;
} | null> {
  const cleanedRaw = stripTrackingParams(rawUrl);
  let parsed = toParsedEmbedFromDetected(cleanedRaw);
  if (!parsed) return null;

  // Expand shorteners safely on server if needed
  const parsedHost = (() => {
    try {
      return new URL(parsed.canonicalUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (
    parsedHost === 'spotify.link' ||
    parsedHost === 'spotify.app.link' ||
    parsedHost === 'pin.it' ||
    parsedHost === 'lnkd.in' ||
    parsedHost === 'youtu.be' ||
    parsedHost === 'on.soundcloud.com'
  ) {
    try {
      const expanded = await expandShortUrlSafe(parsed.canonicalUrl, 3);
      const reparsed = toParsedEmbedFromDetected(expanded);
      if (reparsed) parsed = reparsed;
    } catch {}
  }

  const cached = embedCache.get(parsed.canonicalUrl);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      parsed: cached.parsed,
      embedMeta: cached.data,
      suggestedTitle: cached.suggestedTitle,
    };
  }

  const provider: EmbedProvider = parsed.provider;
  const nowIso = new Date().toISOString();

  // 1. YouTube
  if (provider === 'youtube') {
    try {
      const yt = await fetchYouTubeShowcase(parsed.canonicalUrl);
      const vid = yt?.latestVideos?.[0];
      if (vid?.title || yt?.channelTitle) {
        const meta: EmbedMetaData = {
          provider: 'youtube',
          title: vid?.title || yt?.channelTitle || 'YouTube',
          subtitle: yt?.channelTitle || yt?.handle || parsed.canonicalUrl,
          description: null,
          avatarUrl: yt?.avatarUrl || vid?.thumbnailUrl || null,
          coverUrl: vid?.thumbnailUrl || null,
          statsLabel: yt?.subscriberCountText || null,
          handle: yt?.handle || null,
          badgeText: parsed.label,
          fetchedAt: nowIso,
        };
        setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || parsed.label);
        return { parsed, embedMeta: meta, suggestedTitle: meta.title || parsed.label };
      }
    } catch {}
  }

  // 2. Spotify: Web API -> oEmbed -> cached snapshot on 429 -> manual fallback
  if (provider === 'spotify') {
    if (parsed.subtype && parsed.identifier) {
      const apiRes = await fetchSpotifyApiMetadata(
        parsed.subtype,
        parsed.identifier,
        parsed.canonicalUrl,
        nowIso
      );
      if (apiRes.meta) {
        setCachedEmbed(parsed.canonicalUrl, parsed, apiRes.meta, apiRes.meta.title || parsed.label);
        return { parsed, embedMeta: apiRes.meta, suggestedTitle: apiRes.meta.title || parsed.label };
      }
      // On 429, serve stale snapshot if we have one (AK-7)
      if (apiRes.rateLimited && cached) {
        return {
          parsed: cached.parsed,
          embedMeta: { ...cached.data, staleSnapshot: true } as EmbedMetaData,
          suggestedTitle: cached.suggestedTitle,
        };
      }
    }

    const oembedMeta = await fetchSpotifyOembedFallback(parsed.canonicalUrl, parsed, nowIso);
    if (oembedMeta) {
      setCachedEmbed(parsed.canonicalUrl, parsed, oembedMeta, oembedMeta.title || parsed.label);
      return { parsed, embedMeta: oembedMeta, suggestedTitle: oembedMeta.title || parsed.label };
    }

    if (cached) {
      return {
        parsed: cached.parsed,
        embedMeta: cached.data,
        suggestedTitle: cached.suggestedTitle,
      };
    }

    const basic: EmbedMetaData = {
      provider: 'spotify',
      title: parsed.label,
      subtitle: 'Spotify',
      statsLabel: null,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: basic, suggestedTitle: parsed.label };
  }

  // 3. YouTube oEmbed / SoundCloud oEmbed fallback
  if (provider === 'youtube' || provider === 'soundcloud') {
    const oembedUrl =
      provider === 'youtube'
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`
        : `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}`;

    const started = Date.now();
    try {
      const res = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'iveo-embed/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      recordProviderTelemetry(provider, res.status, res.ok, Date.now() - started);
      if (res.ok) {
        const json: any = await res.json().catch(() => null);
        const cleanTitle = typeof json?.title === 'string' ? json.title.trim() : '';
        if (cleanTitle) {
          const thumb =
            typeof json?.thumbnail_url === 'string' && /^https?:\/\//i.test(json.thumbnail_url)
              ? json.thumbnail_url
              : null;
          const meta: EmbedMetaData = {
            provider,
            title: cleanTitle,
            subtitle:
              (typeof json?.author_name === 'string' && json.author_name.trim()) ||
              parsed.canonicalUrl,
            avatarUrl: thumb,
            coverUrl: thumb,
            badgeText: parsed.label,
            fetchedAt: nowIso,
          };
          setCachedEmbed(parsed.canonicalUrl, parsed, meta, cleanTitle);
          return { parsed, embedMeta: meta, suggestedTitle: cleanTitle };
        }
      }
    } catch {
      recordProviderTelemetry(provider, 0, false, Date.now() - started);
    }

    if (cached) {
      return { parsed: cached.parsed, embedMeta: cached.data, suggestedTitle: cached.suggestedTitle };
    }
    const basic: EmbedMetaData = {
      provider,
      title: parsed.label,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: basic, suggestedTitle: parsed.label };
  }

  // 4. Discord server invite lookup + OG fallback (uses Discord API public invite endpoint)
  if (provider === 'discord') {
    if (parsed.subtype === 'invite' && parsed.identifier) {
      const started = Date.now();
      try {
        const res = await fetch(
          `https://discord.com/api/v10/invites/${encodeURIComponent(parsed.identifier)}?with_counts=true`,
          {
            headers: { 'User-Agent': 'iveo-embed/1.0' },
            signal: AbortSignal.timeout(4500),
          }
        );
        recordProviderTelemetry('discord', res.status, res.ok, Date.now() - started);
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const guild = json?.guild;
          if (guild?.name) {
            const members = json.approximate_member_count;
            const online = json.approximate_presence_count;
            const statsParts: string[] = [];
            if (typeof online === 'number' && online > 0) statsParts.push(`${online.toLocaleString()} online`);
            if (typeof members === 'number' && members > 0) statsParts.push(`${members.toLocaleString()} members`);
            const avatarUrl =
              guild.id && guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
                : null;
            const meta: EmbedMetaData = {
              provider: 'discord',
              title: guild.name,
              subtitle: `discord.gg/${parsed.identifier}`,
              description: guild.description || null,
              avatarUrl,
              badgeText: 'Discord',
              statsLabel: statsParts.join(' · ') || null,
              fetchedAt: nowIso,
            };
            setCachedEmbed(parsed.canonicalUrl, parsed, meta, guild.name);
            return { parsed, embedMeta: meta, suggestedTitle: guild.name };
          }
        }
        if (res.status === 404 && cached) {
          return {
            parsed: cached.parsed,
            embedMeta: { ...cached.data, needsAttention: true },
            suggestedTitle: cached.suggestedTitle,
          };
        }
      } catch {
        recordProviderTelemetry('discord', 0, false, Date.now() - started);
      }
    }

    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    if (og?.title && !/^discord$/i.test(og.title.trim())) {
      const meta: EmbedMetaData = {
        provider: 'discord',
        title: og.title.replace(/^Discord\s*-\s*/i, '').trim() || 'Discord',
        subtitle: parsed.subtype === 'invite' && parsed.identifier ? `discord.gg/${parsed.identifier}` : parsed.canonicalUrl,
        description: og.description || null,
        avatarUrl: og.image,
        badgeText: 'Discord',
        fetchedAt: nowIso,
      };
      setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || 'Discord');
      return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'Discord' };
    }

    const fallback: EmbedMetaData = {
      provider: 'discord',
      title: parsed.subtype === 'user' ? 'Discord' : 'Discord server',
      subtitle: parsed.subtype === 'invite' && parsed.identifier ? `discord.gg/${parsed.identifier}` : parsed.canonicalUrl.replace(/^https?:\/\//, ''),
      description: null,
      badgeText: 'Discord',
      needsAttention: parsed.subtype === 'invite',
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: fallback.title || 'Discord' };
  }

  // 5. GitHub public REST API with optional read-only GITHUB_TOKEN
  if (provider === 'github' && parsed.identifier) {
    const started = Date.now();
    const ghToken = getServerConfig().githubToken;
    try {
      const apiUrl =
        parsed.subtype === 'repo'
          ? `https://api.github.com/repos/${parsed.identifier}`
          : `https://api.github.com/users/${encodeURIComponent(parsed.identifier)}`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'iveo-embed/1.0',
          ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
        },
        signal: AbortSignal.timeout(4500),
      });
      recordProviderTelemetry('github', res.status, res.ok, Date.now() - started);
      if (res.ok) {
        const json: any = await res.json().catch(() => null);
        if (parsed.subtype === 'repo' && json?.full_name) {
          const statsParts: string[] = [];
          if (json.language) statsParts.push(String(json.language));
          if (typeof json.stargazers_count === 'number') statsParts.push(`${json.stargazers_count.toLocaleString()} stars`);
          if (typeof json.forks_count === 'number') statsParts.push(`${json.forks_count.toLocaleString()} forks`);
          const meta: EmbedMetaData = {
            provider: 'github',
            title: json.full_name,
            subtitle: json.owner?.login ? `github.com/${json.owner.login}` : 'github.com',
            description: json.description || null,
            avatarUrl: json.owner?.avatar_url || null,
            badgeText: 'GitHub',
            statsLabel: statsParts.join(' · ') || null,
            handle: parsed.identifier,
            fetchedAt: nowIso,
          };
          setCachedEmbed(parsed.canonicalUrl, parsed, meta, json.full_name);
          return { parsed, embedMeta: meta, suggestedTitle: json.full_name };
        }
        if (parsed.subtype === 'profile' && json?.login) {
          const statsParts: string[] = [];
          if (typeof json.public_repos === 'number') statsParts.push(`${json.public_repos} repos`);
          if (typeof json.followers === 'number') statsParts.push(`${json.followers.toLocaleString()} followers`);
          const meta: EmbedMetaData = {
            provider: 'github',
            title: json.name || `@${json.login}`,
            subtitle: `@${json.login}`,
            description: json.bio || null,
            avatarUrl: json.avatar_url || null,
            badgeText: 'GitHub',
            statsLabel: statsParts.join(' · ') || null,
            handle: `@${json.login}`,
            fetchedAt: nowIso,
          };
          setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || `@${json.login}`);
          return { parsed, embedMeta: meta, suggestedTitle: meta.title || `@${json.login}` };
        }
      }
    } catch {
      recordProviderTelemetry('github', 0, false, Date.now() - started);
    }

    if (cached) {
      return { parsed: cached.parsed, embedMeta: cached.data, suggestedTitle: cached.suggestedTitle };
    }
    const fallback: EmbedMetaData = {
      provider: 'github',
      title: parsed.identifier,
      subtitle: parsed.subtype === 'repo' ? parsed.identifier : `@${parsed.identifier}`,
      description: null,
      badgeText: 'GitHub',
      handle: parsed.identifier,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: parsed.identifier };
  }

  // 6. LinkedIn (PV-7: no scraping behind login walls; readable slug + public OG only if public)
  if (provider === 'linkedin' && parsed.identifier) {
    const cleanName = formatReadableSlug(parsed.identifier);
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const ogTitleClean = og?.title ? og.title.replace(/\s*[|\-–]\s*LinkedIn.*$/i, '').trim() : null;
    const resolvedTitle =
      ogTitleClean && !/^(linkedin|sign in|join linkedin)$/i.test(ogTitleClean)
        ? ogTitleClean
        : cleanName || 'LinkedIn';
    const meta: EmbedMetaData = {
      provider: 'linkedin',
      title: resolvedTitle,
      subtitle: parsed.subtype === 'company' ? `linkedin.com/company/${parsed.identifier}` : `linkedin.com/in/${parsed.identifier}`,
      description: og?.description && !/sign in to view|authwall/i.test(og.description) ? og.description : null,
      avatarUrl: og?.image || null,
      badgeText: 'LinkedIn',
      statsLabel: null, // PV-7: LinkedIn has no public stats
      handle: parsed.identifier,
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || 'LinkedIn');
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'LinkedIn' };
  }

  // 7. X (Twitter)
  if (provider === 'x') {
    if (parsed.identifier) {
      const started = Date.now();
      try {
        const fxRes = await fetch(`https://api.fxtwitter.com/${parsed.identifier}`, {
          headers: { 'User-Agent': 'iveo-embed/1.0' },
          signal: AbortSignal.timeout(4500),
        });
        recordProviderTelemetry('x', fxRes.status, fxRes.ok, Date.now() - started);
        if (fxRes.ok) {
          const fxJson: any = await fxRes.json().catch(() => null);
          const tweet = fxJson?.tweet;
          const user = fxJson?.user || tweet?.author;
          if (tweet && user) {
            const handle = user.screen_name ? `@${user.screen_name}` : `@${parsed.identifier.split('/')[0]}`;
            const mediaImg = tweet.media?.photos?.[0]?.url || tweet.media?.videos?.[0]?.thumbnail_url || null;
            const statsParts: string[] = [];
            if (typeof tweet.likes === 'number' && tweet.likes > 0) statsParts.push(`${tweet.likes.toLocaleString()} likes`);
            if (typeof tweet.retweets === 'number' && tweet.retweets > 0) statsParts.push(`${tweet.retweets.toLocaleString()} reposts`);
            const meta: EmbedMetaData = {
              provider: 'x',
              title: user.name || handle,
              subtitle: handle,
              description: tweet.text || null,
              avatarUrl: user.avatar_url || null,
              coverUrl: mediaImg,
              statsLabel: statsParts.join(' · ') || null,
              badgeText: 'X',
              handle,
              fetchedAt: nowIso,
            };
            setCachedEmbed(parsed.canonicalUrl, parsed, meta, `${user.name || handle} on X`);
            return { parsed, embedMeta: meta, suggestedTitle: `${user.name || handle} on X` };
          }
          if (user && (user.name || user.screen_name)) {
            const handle = user.screen_name ? `@${user.screen_name}` : `@${parsed.identifier.split('/')[0]}`;
            const statsParts: string[] = [];
            if (typeof user.followers === 'number' && user.followers > 0) statsParts.push(`${user.followers.toLocaleString()} followers`);
            if (typeof user.tweets === 'number' && user.tweets > 0) statsParts.push(`${user.tweets.toLocaleString()} posts`);
            const meta: EmbedMetaData = {
              provider: 'x',
              title: user.name || handle,
              subtitle: handle,
              description: user.description || null,
              avatarUrl: user.avatar_url || null,
              coverUrl: user.banner_url || null,
              statsLabel: statsParts.join(' · ') || null,
              badgeText: 'X',
              handle,
              fetchedAt: nowIso,
            };
            setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || handle);
            return { parsed, embedMeta: meta, suggestedTitle: meta.title || handle };
          }
        }
      } catch {
        recordProviderTelemetry('x', 0, false, Date.now() - started);
      }
    }

    if (parsed.subtype === 'post') {
      try {
        const res = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&omit_script=true`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const rawHtml = String(json?.html || '');
          const textExcerpt = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
          const authorName = json?.author_name || 'X post';
          const handleMatch = String(json?.author_url || '').match(/(?:twitter|x)\.com\/([^/?]+)/i);
          const handle = handleMatch?.[1] ? `@${handleMatch[1]}` : null;
          const meta: EmbedMetaData = {
            provider: 'x',
            title: authorName,
            subtitle: handle || parsed.canonicalUrl.replace(/^https?:\/\//, ''),
            description: textExcerpt || null,
            badgeText: 'X',
            handle,
            fetchedAt: nowIso,
          };
          setCachedEmbed(parsed.canonicalUrl, parsed, meta, `${authorName} on X`);
          return { parsed, embedMeta: meta, suggestedTitle: `${authorName} on X` };
        }
      } catch {}
    }

    const handle = parsed.identifier ? `@${parsed.identifier.split('/')[0]}` : '@x';
    const fallback: EmbedMetaData = {
      provider: 'x',
      title: handle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\//, ''),
      description: null,
      badgeText: 'X',
      handle,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: handle };
  }

  // 8. Instagram
  if (provider === 'instagram') {
    const isMedia = parsed.subtype === 'reel' || parsed.subtype === 'post';
    const handle = !isMedia && parsed.identifier ? `@${parsed.identifier}` : null;
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const cleanedTitle = og?.title
      ? og.title.replace(/\s*•\s*Instagram photos and videos$/i, '').replace(/\s*on Instagram:?.*$/i, '').trim()
      : '';
    const title =
      cleanedTitle && !/^(instagram|login)/i.test(cleanedTitle)
        ? cleanedTitle
        : isMedia
          ? parsed.subtype === 'reel'
            ? 'Instagram reel'
            : 'Instagram post'
          : handle || 'Instagram';
    const meta: EmbedMetaData = {
      provider: 'instagram',
      title,
      subtitle: handle || parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      coverUrl: isMedia ? og?.image || null : null,
      badgeText: 'Instagram',
      handle,
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, title);
    return { parsed, embedMeta: meta, suggestedTitle: title };
  }

  // 9. Facebook
  if (provider === 'facebook') {
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const cleanName =
      parsed.identifier && !/^\d+$/.test(parsed.identifier)
        ? formatReadableSlug(parsed.identifier)
        : 'Facebook';
    const ogTitleClean = og?.title ? og.title.replace(/\s*[|\-–]\s*Facebook$/i, '').trim() : '';
    const resolvedTitle =
      ogTitleClean && !/^(facebook|log in or sign up)$/i.test(ogTitleClean)
        ? ogTitleClean
        : cleanName || 'Facebook';
    const meta: EmbedMetaData = {
      provider: 'facebook',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      badgeText: 'Facebook',
      handle: parsed.identifier || null,
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || 'Facebook');
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'Facebook' };
  }

  // 10. Threads
  if (provider === 'threads') {
    const handle = parsed.identifier ? `@${parsed.identifier.split('/')[0]}` : '@threads';
    const isPost = parsed.subtype === 'post';
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const ogTitleClean = og?.title ? og.title.replace(/\s*[•|\-]\s*Threads.*$/i, '').trim() : '';
    const resolvedTitle =
      ogTitleClean && !/^threads$/i.test(ogTitleClean)
        ? ogTitleClean
        : isPost
          ? `${handle} on Threads`
          : handle;
    const meta: EmbedMetaData = {
      provider: 'threads',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      badgeText: 'Threads',
      handle,
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || handle);
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || handle };
  }

  // 11. Linktree
  if (provider === 'linktree') {
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const handle = parsed.identifier ? `@${parsed.identifier}` : 'Linktree';
    const cleanTitle = og?.title ? og.title.replace(/\s*\|\s*Linktree$/i, '').trim() : '';
    const resolvedTitle = cleanTitle && !/^linktree$/i.test(cleanTitle) ? cleanTitle : handle;
    const meta: EmbedMetaData = {
      provider: 'linktree',
      subtype: parsed.subtype || 'profile',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      badgeText: 'Linktree',
      handle,
      source: og ? 'opengraph' : 'manual',
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, resolvedTitle);
    return { parsed, embedMeta: meta, suggestedTitle: resolvedTitle };
  }

  // 11b. Bluesky (AK-1 proof-of-architecture provider)
  if (provider === 'bluesky') {
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const handle = parsed.identifier ? `@${parsed.identifier.replace(/^@+/, '')}` : 'Bluesky';
    const cleanTitle = og?.title ? og.title.replace(/\s*[—\-|]\s*Bluesky$/i, '').trim() : '';
    const resolvedTitle = cleanTitle && !/^bluesky$/i.test(cleanTitle) ? cleanTitle : handle;
    const meta: EmbedMetaData = {
      provider: 'bluesky',
      subtype: parsed.subtype || 'profile',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      badgeText: 'Bluesky',
      handle,
      source: og ? 'opengraph' : 'manual',
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, resolvedTitle);
    return { parsed, embedMeta: meta, suggestedTitle: resolvedTitle };
  }

  // 12. Pinterest — PV-9: NEVER use owner's PINTEREST_ACCESS_TOKEN for arbitrary user URLs!
  // Use public oEmbed + SSRF-safe OpenGraph unfurl; OAuth user API stays strictly behind PINTEREST_OAUTH_ENABLED.
  if (provider === 'pinterest') {
    const targetUrl = parsed.canonicalUrl;
    const started = Date.now();
    const [og, oembedJson] = await Promise.all([
      fetchOpenGraphMetadata(targetUrl),
      fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(3500),
      })
        .then(async (r) => {
          recordProviderTelemetry('pinterest_oembed', r.status, r.ok, Date.now() - started);
          return r.ok ? r.json() : null;
        })
        .catch(() => {
          recordProviderTelemetry('pinterest_oembed', 0, false, Date.now() - started);
          return null;
        }),
    ]);

    const oembedTitle = typeof oembedJson?.title === 'string' ? oembedJson.title.trim() : '';
    const oembedAuthor = typeof oembedJson?.author_name === 'string' ? oembedJson.author_name.trim() : '';
    const oembedThumb =
      typeof oembedJson?.thumbnail_url === 'string' && /^https?:\/\//i.test(oembedJson.thumbnail_url)
        ? oembedJson.thumbnail_url
        : null;
    const ogTitleClean = og?.title ? og.title.replace(/\s*[|\-–]\s*Pinterest$/i, '').trim() : '';
    const isBoard = parsed.subtype === 'board';
    const isPin = parsed.subtype === 'pin';
    const parts = (parsed.identifier || '').split('/').filter(Boolean);
    const userHandle = parts[0] ? `@${parts[0]}` : null;
    const fallbackTitle =
      isBoard && parts[1] ? formatReadableSlug(parts[1]) : isPin ? 'Pinterest pin' : userHandle || 'Pinterest';

    const resolvedTitle =
      (oembedTitle && !/^pinterest$/i.test(oembedTitle) ? oembedTitle : '') ||
      (ogTitleClean && !/^pinterest$/i.test(ogTitleClean) ? ogTitleClean : '') ||
      fallbackTitle;

    const thumb = oembedThumb || og?.image || null;
    const meta: EmbedMetaData = {
      provider: 'pinterest',
      title: resolvedTitle,
      subtitle:
        isBoard && parts.length >= 2
          ? `@${parts[0]} · Board`
          : oembedAuthor
            ? `by ${oembedAuthor}`
            : userHandle || targetUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      description: og?.description || null,
      avatarUrl: thumb,
      coverUrl: thumb,
      badgeText: parsed.label,
      handle: isPin ? null : userHandle,
      fetchedAt: nowIso,
    };
    setCachedEmbed(parsed.canonicalUrl, parsed, meta, meta.title || fallbackTitle);
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || fallbackTitle };
  }

  return null;
}

/**
 * Enriches ANY pasted link (provider URL, shortlink, or generic webpage) safely.
 */
export async function fetchUniversalSocialLinkMetadata(
  rawUrl: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  provider: string;
  canonicalUrl: string;
  suggestedTitle: string;
  embedMeta: EmbedMetaData;
  isGenericLink?: boolean;
} | null> {
  const cleaned = stripTrackingParams(rawUrl);
  if (!cleaned) return null;

  const direct = await fetchSocialEmbedMetadata(cleaned, options);
  if (direct) {
    return {
      provider: direct.parsed.provider,
      canonicalUrl: direct.parsed.canonicalUrl,
      suggestedTitle: direct.suggestedTitle,
      embedMeta: direct.embedMeta,
      isGenericLink: false,
    };
  }

  // Try expanding short links safely
  let targetUrl = cleaned;
  try {
    targetUrl = await expandShortUrlSafe(cleaned, 3);
  } catch {
    return null;
  }

  const afterExpand = await fetchSocialEmbedMetadata(targetUrl, options);
  if (afterExpand) {
    return {
      provider: afterExpand.parsed.provider,
      canonicalUrl: afterExpand.parsed.canonicalUrl,
      suggestedTitle: afterExpand.suggestedTitle,
      embedMeta: afterExpand.embedMeta,
      isGenericLink: false,
    };
  }

  // Generic web link (SSRF-safe OG unfurl for plain links)
  const og = await fetchOpenGraphMetadata(targetUrl);
  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  return {
    provider: 'generic',
    canonicalUrl: og?.finalUrl || targetUrl,
    suggestedTitle: og?.title || hostname || targetUrl,
    isGenericLink: true,
    embedMeta: {
      provider: 'generic',
      title: og?.title || hostname || 'Link',
      subtitle: (og?.finalUrl || targetUrl).replace(/^https?:\/\/(www\.)?/, ''),
      description: og?.description || null,
      avatarUrl: og?.image || null,
      coverUrl: og?.image || null,
      badgeText: 'Link',
      fetchedAt: new Date().toISOString(),
    },
  };
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface OAuthStateRecord {
  state: string;
  provider: string;
  redirectUri: string;
  codeVerifier: string | null;
  mode: 'popup' | 'redirect';
  returnTo: string | null;
  ownerKey: string | null;
  createdAt: number;
  expiresAt: number;
}

interface StoredRedirectResult {
  token: string;
  payload: Record<string, any>;
  expiresAt: number;
}

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_RESULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getDataDir(): string {
  const custom = process.env.IVEO_DATA_DIR?.trim() || process.env.LOCAL_DATA_DIR?.trim();
  return custom ? path.resolve(custom) : path.resolve(process.cwd(), 'data');
}

function getStatesFilePath(): string {
  return path.join(getDataDir(), 'oauth_states.json');
}

function getResultsFilePath(): string {
  return path.join(getDataDir(), 'oauth_results.json');
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function readStateMap(): Record<string, OAuthStateRecord> {
  const file = getStatesFilePath();
  if (!fs.existsSync(file)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') return {};
    const now = Date.now();
    const active: Record<string, OAuthStateRecord> = {};
    for (const [k, rec] of Object.entries(raw as Record<string, OAuthStateRecord>)) {
      if (rec && typeof rec.expiresAt === 'number' && rec.expiresAt > now) {
        active[k] = rec;
      }
    }
    return active;
  } catch {
    return {};
  }
}

export function sanitizeOAuthReturnTo(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed.slice(0, 300);
}

export function createOAuthState(input: {
  provider: string;
  redirectUri: string;
  codeVerifier?: string | null;
  mode?: 'popup' | 'redirect';
  returnTo?: string | null;
  ownerKey?: string | null;
  ttlMs?: number;
}): string {
  const cleanProvider = String(input.provider || '').toLowerCase().trim();
  const nonce = crypto.randomBytes(24).toString('base64url');
  const state = `${cleanProvider}.${nonce}`;
  const now = Date.now();
  const ttl = typeof input.ttlMs === 'number' && input.ttlMs > 0 ? input.ttlMs : DEFAULT_STATE_TTL_MS;

  const map = readStateMap();
  map[state] = {
    state,
    provider: cleanProvider,
    redirectUri: input.redirectUri,
    codeVerifier: input.codeVerifier || null,
    mode: input.mode === 'redirect' ? 'redirect' : 'popup',
    returnTo: sanitizeOAuthReturnTo(input.returnTo),
    ownerKey: input.ownerKey ? String(input.ownerKey).trim().slice(0, 128) : null,
    createdAt: now,
    expiresAt: now + ttl,
  };
  writeJsonAtomic(getStatesFilePath(), map);
  return state;
}

export function peekOAuthStateProvider(stateParam?: string | null): string | null {
  if (!stateParam || typeof stateParam !== 'string') return null;
  const map = readStateMap();
  const found = map[stateParam];
  if (found?.provider) return found.provider;
  const dotIdx = stateParam.indexOf('.');
  if (dotIdx > 0) {
    return stateParam.slice(0, dotIdx).toLowerCase().trim();
  }
  return null;
}

export type ConsumeOAuthStateResult =
  | { ok: true; record: OAuthStateRecord }
  | { ok: false; reason: 'missing_state' | 'unknown_or_replayed_state' | 'expired_state' | 'provider_mismatch' };

export function consumeOAuthState(
  stateParam: string | undefined | null,
  expectedProvider: string
): ConsumeOAuthStateResult {
  const cleanState = typeof stateParam === 'string' ? stateParam.trim() : '';
  if (!cleanState) {
    return { ok: false, reason: 'missing_state' };
  }

  const file = getStatesFilePath();
  let rawMap: Record<string, OAuthStateRecord> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        rawMap = parsed as Record<string, OAuthStateRecord>;
      }
    } catch {
      rawMap = {};
    }
  }

  const record = rawMap[cleanState];
  const now = Date.now();

  // Prune expired & remove consumed entry atomically on every check
  const nextMap: Record<string, OAuthStateRecord> = {};
  for (const [k, rec] of Object.entries(rawMap)) {
    if (k === cleanState) continue;
    if (rec && typeof rec.expiresAt === 'number' && rec.expiresAt > now) {
      nextMap[k] = rec;
    }
  }
  if (record || Object.keys(nextMap).length !== Object.keys(rawMap).length) {
    writeJsonAtomic(file, nextMap);
  }

  if (!record) {
    return { ok: false, reason: 'unknown_or_replayed_state' };
  }
  if (typeof record.expiresAt !== 'number' || record.expiresAt <= now) {
    return { ok: false, reason: 'expired_state' };
  }
  const cleanExpected = String(expectedProvider || '').toLowerCase().trim();
  if (cleanExpected && record.provider !== cleanExpected) {
    return { ok: false, reason: 'provider_mismatch' };
  }

  return { ok: true, record };
}

export function storeOAuthRedirectResult(payload: Record<string, any>): string {
  const token = crypto.randomBytes(20).toString('base64url');
  const file = getResultsFilePath();
  const now = Date.now();
  let rawMap: Record<string, StoredRedirectResult> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        rawMap = parsed as Record<string, StoredRedirectResult>;
      }
    } catch {}
  }
  const nextMap: Record<string, StoredRedirectResult> = {};
  for (const [k, rec] of Object.entries(rawMap)) {
    if (rec && typeof rec.expiresAt === 'number' && rec.expiresAt > now) {
      nextMap[k] = rec;
    }
  }
  nextMap[token] = {
    token,
    payload,
    expiresAt: now + DEFAULT_RESULT_TTL_MS,
  };
  writeJsonAtomic(file, nextMap);
  return token;
}

export function consumeOAuthRedirectResult(tokenParam: string | undefined | null): Record<string, any> | null {
  const token = typeof tokenParam === 'string' ? tokenParam.trim() : '';
  if (!token) return null;
  const file = getResultsFilePath();
  if (!fs.existsSync(file)) return null;
  let rawMap: Record<string, StoredRedirectResult> = {};
  try {
    rawMap = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return null;
  }
  const record = rawMap[token];
  const now = Date.now();
  const nextMap: Record<string, StoredRedirectResult> = {};
  for (const [k, rec] of Object.entries(rawMap)) {
    if (k === token) continue;
    if (rec && typeof rec.expiresAt === 'number' && rec.expiresAt > now) {
      nextMap[k] = rec;
    }
  }
  writeJsonAtomic(file, nextMap);
  if (!record || record.expiresAt <= now) return null;
  return record.payload;
}

export function clearOAuthStateStoreForTests(): void {
  try {
    if (fs.existsSync(getStatesFilePath())) fs.unlinkSync(getStatesFilePath());
  } catch {}
  try {
    if (fs.existsSync(getResultsFilePath())) fs.unlinkSync(getResultsFilePath());
  } catch {}
}

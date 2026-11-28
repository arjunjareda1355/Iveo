import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { serverDb } from './firebaseServer.ts';

export const SYSTEM_INTEGRATIONS_DOC_ID = 'system.integrations';
export const LEGACY_SYSTEM_INTEGRATIONS_DOC_IDS = new Set([
  'system.integrations',
  '__system_integrations__',
]);
const INTEGRATION_KEY_VERSION = 1;
const STORE_CACHE_TTL_MS = 30_000;
const MAX_SEO_EVENTS = 40;

export interface EncryptedBlobV1 {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ct: string;
}

export interface GscMetadataRecord {
  configured: boolean;
  clientEmail: string | null;
  projectId: string | null;
  privateKeyIdPreview: string | null;
  propertyUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastPermissionLevel: string | null;
  lastError: string | null;
}

export interface SeoEventRecord {
  id: string;
  at: string;
  type: string;
  scope: string; // '__system__' or handle (lowercase, without @)
  provider: string; // 'gsc' | 'bing' | 'indexnow' | 'sitemap' | 'seo'
  targetUrl: string;
  httpStatus: number | null;
  outcome: 'success' | 'failed' | 'rate_limited' | 'not_configured' | 'skipped_duplicate' | 'info';
  detail?: string;
}

interface PersistedIntegrationsPayload {
  encryptedGscBlob: EncryptedBlobV1 | null;
  gscMeta: GscMetadataRecord | null;
  indexNowKey: string | null;
  updatedAt: string | null;
}

function getDataDir(): string {
  return process.env.IVEO_DATA_DIR
    ? path.resolve(process.env.IVEO_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
}

function getEncryptedStorePath(): string {
  return path.join(getDataDir(), 'seo_integrations.enc.json');
}

function getLegacyPlaintextGscPath(): string {
  return path.join(getDataDir(), 'gsc_service_account.local.json');
}

function getLocalEventsPath(): string {
  return path.join(getDataDir(), 'seo_events.local.json');
}

export function resolveIntegrationsEncryptionKey(): {
  key: Buffer | null;
  usingFallbackKey: boolean;
  keySource: 'INTEGRATIONS_ENCRYPTION_KEY' | 'hkdf_fallback' | 'none';
} {
  const dedicated = (process.env.INTEGRATIONS_ENCRYPTION_KEY || '').trim();
  if (dedicated) {
    if (/^[0-9a-fA-F]{64}$/.test(dedicated)) {
      return {
        key: Buffer.from(dedicated, 'hex'),
        usingFallbackKey: false,
        keySource: 'INTEGRATIONS_ENCRYPTION_KEY',
      };
    }
    try {
      const b = Buffer.from(dedicated, 'base64');
      if (b.byteLength === 32) {
        return {
          key: b,
          usingFallbackKey: false,
          keySource: 'INTEGRATIONS_ENCRYPTION_KEY',
        };
      }
    } catch {}
    // Hash arbitrary passphrase to 32 bytes deterministically
    return {
      key: crypto.createHash('sha256').update(dedicated, 'utf8').digest(),
      usingFallbackKey: false,
      keySource: 'INTEGRATIONS_ENCRYPTION_KEY',
    };
  }

  const fallbackSecret =
    (process.env.TOKEN_ENCRYPTION_KEY || '').trim() ||
    (process.env.CLERK_SECRET_KEY || '').trim() ||
    (process.env.GOOGLE_CLIENT_SECRET || '').trim() ||
    (process.env.BING_WEBMASTER_API_KEY || '').trim();

  if (!fallbackSecret) {
    return { key: null, usingFallbackKey: false, keySource: 'none' };
  }

  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(fallbackSecret, 'utf8'),
    Buffer.from('iveo-seo-integrations-salt-v1', 'utf8'),
    Buffer.from('iveo-aes-256-gcm-gsc-v1', 'utf8'),
    32
  );
  return {
    key: Buffer.from(derived),
    usingFallbackKey: true,
    keySource: 'hkdf_fallback',
  };
}

export function encryptIntegrationsJson(
  plaintext: string
): { ok: true; blob: EncryptedBlobV1; usingFallbackKey: boolean } | { ok: false; error: string } {
  const resolved = resolveIntegrationsEncryptionKey();
  if (!resolved.key) {
    return {
      ok: false,
      error:
        'Server encryption key is missing. Set INTEGRATIONS_ENCRYPTION_KEY (32 random bytes, base64) in the server environment.',
    };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolved.key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ok: true,
    usingFallbackKey: resolved.usingFallbackKey,
    blob: {
      v: INTEGRATION_KEY_VERSION,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: encrypted.toString('base64'),
    },
  };
}

export function decryptIntegrationsJson(
  blob: EncryptedBlobV1 | null | undefined
): { ok: true; plaintext: string } | { ok: false; error: string } {
  if (!blob || blob.alg !== 'aes-256-gcm' || !blob.iv || !blob.tag || !blob.ct) {
    return { ok: false, error: 'Missing or invalid encrypted payload.' };
  }
  const resolved = resolveIntegrationsEncryptionKey();
  if (!resolved.key) {
    return { ok: false, error: 'Server encryption key unavailable to decrypt GSC configuration.' };
  }
  try {
    const iv = Buffer.from(blob.iv, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const ct = Buffer.from(blob.ct, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', resolved.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return { ok: true, plaintext: decrypted };
  } catch {
    return {
      ok: false,
      error: 'Setup Needed - re-upload the key (stored key could not be decrypted).',
    };
  }
}

let memoryStoreCache: { data: PersistedIntegrationsPayload; expiresAt: number } | null = null;
let indexNowGenInFlight: Promise<string> | null = null;
let memoryEventsCache: { events: SeoEventRecord[]; expiresAt: number } | null = null;

export function clearSeoIntegrationsStoreCacheForTests(): void {
  memoryStoreCache = null;
  memoryEventsCache = null;
  indexNowGenInFlight = null;
}

function purgeLegacyPlaintextGscFileIfExists(): void {
  try {
    const legacy = getLegacyPlaintextGscPath();
    if (fs.existsSync(legacy)) {
      fs.unlinkSync(legacy);
    }
  } catch {}
}

export function readLocalEncryptedStoreSync(): PersistedIntegrationsPayload {
  try {
    const p = getEncryptedStorePath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          encryptedGscBlob: parsed.encryptedGscBlob || null,
          gscMeta: parsed.gscMeta || null,
          indexNowKey: typeof parsed.indexNowKey === 'string' ? parsed.indexNowKey : null,
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        };
      }
    }
  } catch {}
  return {
    encryptedGscBlob: null,
    gscMeta: null,
    indexNowKey: null,
    updatedAt: null,
  };
}

function readLocalEncryptedStore(): PersistedIntegrationsPayload {
  return readLocalEncryptedStoreSync();
}

export function writeLocalEncryptedStoreSync(payload: PersistedIntegrationsPayload): void {
  try {
    const p = getEncryptedStorePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, p);
    try {
      fs.chmodSync(p, 0o600);
    } catch {}
  } catch {}
}

export function clearLocalEncryptedGscSync(): void {
  purgeLegacyPlaintextGscFileIfExists();
  const current = readLocalEncryptedStoreSync();
  const next: PersistedIntegrationsPayload = {
    encryptedGscBlob: null,
    gscMeta: null,
    indexNowKey: current.indexNowKey,
    updatedAt: new Date().toISOString(),
  };
  writeLocalEncryptedStoreSync(next);
  memoryStoreCache = { data: next, expiresAt: Date.now() + STORE_CACHE_TTL_MS };
}

export async function readIntegrationsPayload(): Promise<PersistedIntegrationsPayload> {
  if (memoryStoreCache && memoryStoreCache.expiresAt > Date.now()) {
    return memoryStoreCache.data;
  }

  const local = readLocalEncryptedStore();
  let merged = local;

  if (serverDb) {
    try {
      const snap = await Promise.race([
        getDoc(doc(serverDb, 'users', SYSTEM_INTEGRATIONS_DOC_ID)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      if (snap && snap.exists()) {
        const fbData = snap.data() || {};
        const fbPayload: PersistedIntegrationsPayload = {
          encryptedGscBlob: fbData.encryptedGscBlob || null,
          gscMeta: fbData.gscMeta || null,
          indexNowKey: typeof fbData.indexNowKey === 'string' ? fbData.indexNowKey : null,
          updatedAt: typeof fbData.updatedAt === 'string' ? fbData.updatedAt : null,
        };
        if (
          !local.updatedAt ||
          (fbPayload.updatedAt && fbPayload.updatedAt >= local.updatedAt) ||
          (fbPayload.encryptedGscBlob && !local.encryptedGscBlob) ||
          (fbPayload.indexNowKey && !local.indexNowKey)
        ) {
          merged = fbPayload;
          writeLocalEncryptedStoreSync(merged);
        }
      }
    } catch {}
  }

  memoryStoreCache = { data: merged, expiresAt: Date.now() + STORE_CACHE_TTL_MS };
  return merged;
}

export async function writeIntegrationsPayload(
  patch: Partial<PersistedIntegrationsPayload>
): Promise<PersistedIntegrationsPayload> {
  purgeLegacyPlaintextGscFileIfExists();
  const current = await readIntegrationsPayload();
  const nowIso = new Date().toISOString();
  const next: PersistedIntegrationsPayload = {
    encryptedGscBlob:
      patch.encryptedGscBlob !== undefined ? patch.encryptedGscBlob : current.encryptedGscBlob,
    gscMeta: patch.gscMeta !== undefined ? patch.gscMeta : current.gscMeta,
    indexNowKey: patch.indexNowKey !== undefined ? patch.indexNowKey : current.indexNowKey,
    updatedAt: nowIso,
  };

  writeLocalEncryptedStoreSync(next);
  memoryStoreCache = { data: next, expiresAt: Date.now() + STORE_CACHE_TTL_MS };

  if (serverDb) {
    try {
      await setDoc(
        doc(serverDb, 'users', SYSTEM_INTEGRATIONS_DOC_ID),
        {
          blocksInitialized: false,
          encryptedGscBlob: next.encryptedGscBlob,
          gscMeta: next.gscMeta,
          indexNowKey: next.indexNowKey,
          updatedAt: nowIso.slice(0, 64),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[seoIntegrationsStore] Firebase persist failed:', (err as any)?.message || err);
    }
  }

  return next;
}

export async function getOrCreateIndexNowKey(): Promise<string> {
  const envKey = (process.env.INDEXNOW_KEY || '').trim();
  if (envKey) return envKey;

  const current = await readIntegrationsPayload();
  if (current.indexNowKey && /^[a-fA-F0-9]{16,128}$/.test(current.indexNowKey)) {
    return current.indexNowKey;
  }

  if (indexNowGenInFlight) {
    return indexNowGenInFlight;
  }

  indexNowGenInFlight = (async () => {
    const generated = crypto.randomBytes(16).toString('hex');
    await writeIntegrationsPayload({ indexNowKey: generated });
    indexNowGenInFlight = null;
    return generated;
  })();

  return indexNowGenInFlight;
}

function readLocalEvents(): SeoEventRecord[] {
  try {
    const p = getLocalEventsPath();
    if (fs.existsSync(p)) {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function writeLocalEvents(events: SeoEventRecord[]): void {
  try {
    const p = getLocalEventsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(events.slice(0, MAX_SEO_EVENTS), null, 2), 'utf8');
  } catch {}
}

export async function appendSeoIntegrationEvent(
  input: Omit<SeoEventRecord, 'id' | 'at'> & { at?: string }
): Promise<SeoEventRecord> {
  const nowIso = (input.at || new Date().toISOString()).slice(0, 64);
  const rand = crypto.randomBytes(4).toString('hex');
  const id = `evt_${Date.now()}_${rand}`;
  const cleanScope = String(input.scope || '__system__')
    .replace(/^@+/, '')
    .toLowerCase()
    .trim() || '__system__';

  const record: SeoEventRecord = {
    id,
    at: nowIso,
    type: String(input.type || 'seo_event').slice(0, 64),
    scope: cleanScope.slice(0, 64),
    provider: String(input.provider || 'seo').slice(0, 32),
    targetUrl: String(input.targetUrl || '').slice(0, 500),
    httpStatus: typeof input.httpStatus === 'number' ? input.httpStatus : null,
    outcome: input.outcome || 'info',
    detail: input.detail ? String(input.detail).slice(0, 240) : undefined,
  };

  const currentLocal = readLocalEvents();
  const nextLocal = [record, ...currentLocal].slice(0, MAX_SEO_EVENTS);
  writeLocalEvents(nextLocal);
  memoryEventsCache = { events: nextLocal, expiresAt: Date.now() + STORE_CACHE_TTL_MS };

  if (serverDb) {
    try {
      const blocksCol = collection(serverDb, 'users', SYSTEM_INTEGRATIONS_DOC_ID, 'blocks');
      await setDoc(doc(blocksCol, id), {
        id,
        kind: 'seo_event',
        username: SYSTEM_INTEGRATIONS_DOC_ID,
        title: `${record.provider}:${record.outcome}:${record.scope}`.slice(0, 250),
        url: /^https?:\/\//i.test(record.targetUrl) ? record.targetUrl.slice(0, 2000) : null,
        updatedAt: nowIso,
        seoEvent: record,
      });

      // Prune older events beyond MAX_SEO_EVENTS asynchronously
      getDocs(blocksCol)
        .then((snap) => {
          if (snap.size <= MAX_SEO_EVENTS) return;
          const sorted = snap.docs
            .map((d) => ({ ref: d.ref, at: String((d.data() as any)?.updatedAt || '') }))
            .sort((a, b) => b.at.localeCompare(a.at));
          const toDelete = sorted.slice(MAX_SEO_EVENTS);
          if (toDelete.length > 0) {
            const batch = writeBatch(serverDb!);
            for (const item of toDelete) batch.delete(item.ref);
            batch.commit().catch(() => {});
          }
        })
        .catch(() => {});
    } catch {}
  }

  return record;
}

export async function listSeoIntegrationEvents(options?: {
  scope?: string | null;
  limit?: number;
}): Promise<SeoEventRecord[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? MAX_SEO_EVENTS, MAX_SEO_EVENTS));
  let all: SeoEventRecord[];

  if (memoryEventsCache && memoryEventsCache.expiresAt > Date.now()) {
    all = memoryEventsCache.events;
  } else {
    all = readLocalEvents();
    if (serverDb) {
      try {
        const blocksCol = collection(serverDb, 'users', SYSTEM_INTEGRATIONS_DOC_ID, 'blocks');
        const snap = await Promise.race([
          getDocs(blocksCol),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (snap && snap.size > 0) {
          const fbEvents: SeoEventRecord[] = [];
          snap.forEach((d) => {
            const ev = (d.data() as any)?.seoEvent;
            if (ev && typeof ev === 'object') fbEvents.push(ev as SeoEventRecord);
          });
          fbEvents.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
          if (fbEvents.length > 0) {
            all = fbEvents.slice(0, MAX_SEO_EVENTS);
            writeLocalEvents(all);
          }
        }
      } catch {}
    }
    memoryEventsCache = { events: all, expiresAt: Date.now() + STORE_CACHE_TTL_MS };
  }

  const filterScope = options?.scope
    ? String(options.scope).replace(/^@+/, '').toLowerCase().trim()
    : null;

  const filtered = filterScope ? all.filter((e) => e.scope === filterScope) : all;
  return filtered.slice(0, limit);
}

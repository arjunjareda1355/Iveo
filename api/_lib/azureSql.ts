import sql from 'mssql';
import fs from 'node:fs';
import path from 'node:path';
import { mergeProfileForSave } from './profileMerge.ts';
import { resolveEffectivePlan, type SubscriptionRecord, type UserBillingStore } from '../../src/lib/plan.ts';
import { normalizeAnalyticsSource } from '../../src/lib/analytics/sources.ts';
import { detectDevice } from '../../src/lib/analytics/device.ts';
import {
  firebaseRecordAnalyticsEvent,
  firebaseGetAnalyticsEvents,
  firebaseGetBlocks,
  firebaseGetRedirectTarget,
} from './firebaseServer.ts';

// Confirmed Azure SQL Infrastructure details
const AZURE_SQL_SERVER = process.env.AZURE_SQL_SERVER || 'faneme.database.windows.net';
const AZURE_SQL_DATABASE = process.env.AZURE_SQL_DATABASE || 'fanqme';
const AZURE_SQL_PORT = parseInt(process.env.AZURE_SQL_PORT || '1433', 10);

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';

// Optional SQL / Connection string fallback
const AZURE_SQL_USER = process.env.AZURE_SQL_USER || '';
const AZURE_SQL_PASSWORD = process.env.AZURE_SQL_PASSWORD || '';
const AZURE_SQL_CONNECTION_STRING = process.env.AZURE_SQL_CONNECTION_STRING || '';

let globalPool: sql.ConnectionPool | null = null;
let schemaEnsured = false;
let entraUnavailable = false;
let lastPoolAttemptTime = 0;
const POOL_RETRY_COOLDOWN_MS = 60000;

/**
 * Acquire Microsoft Entra Access Token for Azure SQL
 */
async function getAzureEntraToken(): Promise<string | null> {
  if (entraUnavailable || !AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    return null;
  }
  try {
    const { ClientSecretCredential } = await import('@azure/identity');
    const credential = new ClientSecretCredential(
      AZURE_TENANT_ID,
      AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET
    );
    const tokenResponse = await credential.getToken('https://database.windows.net/.default');
    return tokenResponse?.token || null;
  } catch (err: any) {
    // If tenant is invalid or not found, mark Entra as permanently unavailable to avoid spamming
    entraUnavailable = true;
    return null;
  }
}

/**
 * Creates or retrieves the singleton Azure SQL Connection Pool
 */
export async function getAzureSqlPool(): Promise<sql.ConnectionPool | null> {
  if (globalPool && globalPool.connected) {
    return globalPool;
  }

  // Cooldown backoff so failed attempts don't stall HTTP requests
  const now = Date.now();
  if (now - lastPoolAttemptTime < POOL_RETRY_COOLDOWN_MS) {
    return null;
  }
  lastPoolAttemptTime = now;

  // 1. Try Microsoft Entra Service Principal Authentication
  const entraToken = await getAzureEntraToken();
  if (entraToken) {
    try {
      const config: sql.config = {
        server: AZURE_SQL_SERVER,
        database: AZURE_SQL_DATABASE,
        port: AZURE_SQL_PORT,
        options: {
          encrypt: true,
          trustServerCertificate: false,
          connectTimeout: 3000,
          requestTimeout: 3000,
        },
        authentication: {
          type: 'azure-active-directory-access-token',
          options: {
            token: entraToken,
          },
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };

      const pool = new sql.ConnectionPool(config);
      await pool.connect();
      globalPool = pool;
      await ensureSchema(pool);
      return pool;
    } catch {
      // Gracefully fall through
    }
  }

  // 2. Try Connection String fallback if present
  if (AZURE_SQL_CONNECTION_STRING) {
    try {
      const pool = new sql.ConnectionPool(AZURE_SQL_CONNECTION_STRING);
      await pool.connect();
      globalPool = pool;
      await ensureSchema(pool);
      return pool;
    } catch {
      // Gracefully fall through
    }
  }

  // 3. Try SQL User / Password fallback if present
  if (AZURE_SQL_USER && AZURE_SQL_PASSWORD) {
    try {
      const config: sql.config = {
        server: AZURE_SQL_SERVER,
        database: AZURE_SQL_DATABASE,
        port: AZURE_SQL_PORT,
        user: AZURE_SQL_USER,
        password: AZURE_SQL_PASSWORD,
        options: {
          encrypt: true,
          trustServerCertificate: false,
          connectTimeout: 3000,
          requestTimeout: 3000,
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };

      const pool = new sql.ConnectionPool(config);
      await pool.connect();
      globalPool = pool;
      await ensureSchema(pool);
      return pool;
    } catch {
      // Gracefully fall through
    }
  }

  return null;
}

/**
 * Idempotent schema verification for Azure SQL
 */
async function ensureSchema(pool: sql.ConnectionPool): Promise<void> {
  if (schemaEnsured) return;
  try {
    const migrationSql = `
      -- 1. Profiles Table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='iveo_profiles' AND xtype='U')
      BEGIN
        CREATE TABLE iveo_profiles (
          user_id NVARCHAR(128) NOT NULL,
          username NVARCHAR(64) NOT NULL PRIMARY KEY,
          display_name NVARCHAR(128) NULL,
          bio NVARCHAR(500) NULL,
          avatar_url NVARCHAR(2048) NULL,
          avatar_type NVARCHAR(32) DEFAULT 'default',
          avatar_id NVARCHAR(64) NULL,
          vibe_id NVARCHAR(32) DEFAULT 'clean',
          button_shape NVARCHAR(32) DEFAULT 'rounded',
          socials_json NVARCHAR(MAX) NULL,
          plan NVARCHAR(32) DEFAULT 'free',
          hide_footer BIT DEFAULT 0,
          hide_from_search BIT DEFAULT 0,
          is_published BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_iveo_profiles_user_id ON iveo_profiles(user_id);
      END
      ELSE
      BEGIN
        IF COL_LENGTH('iveo_profiles', 'avatar_type') IS NULL
        BEGIN
          ALTER TABLE iveo_profiles ADD avatar_type NVARCHAR(32) DEFAULT 'default';
        END
        IF COL_LENGTH('iveo_profiles', 'avatar_id') IS NULL
        BEGIN
          ALTER TABLE iveo_profiles ADD avatar_id NVARCHAR(64) NULL;
        END
      END

      -- 2. Blocks Table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='iveo_blocks' AND xtype='U')
      BEGIN
        CREATE TABLE iveo_blocks (
          id NVARCHAR(128) NOT NULL PRIMARY KEY,
          user_id NVARCHAR(128) NOT NULL,
          username NVARCHAR(64) NOT NULL,
          kind NVARCHAR(32) NOT NULL,
          title NVARCHAR(256) NULL,
          url NVARCHAR(2048) NULL,
          icon NVARCHAR(64) NULL,
          thumbnail_path NVARCHAR(512) NULL,
          thumbnail_url NVARCHAR(2048) NULL,
          layout NVARCHAR(32) DEFAULT 'classic',
          embed_provider NVARCHAR(32) NULL,
          signup_config_json NVARCHAR(MAX) NULL,
          is_protected BIT DEFAULT 0,
          start_at NVARCHAR(64) NULL,
          end_at NVARCHAR(64) NULL,
          is_active BIT DEFAULT 1,
          is_archived BIT DEFAULT 0,
          position INT DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_iveo_blocks_username ON iveo_blocks(username);
        CREATE INDEX IX_iveo_blocks_user_id ON iveo_blocks(user_id);
      END

      -- 3. Contacts Table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='iveo_contacts' AND xtype='U')
      BEGIN
        CREATE TABLE iveo_contacts (
          id NVARCHAR(128) NOT NULL PRIMARY KEY,
          user_id NVARCHAR(128) NOT NULL,
          username NVARCHAR(64) NOT NULL,
          link_id NVARCHAR(128) NOT NULL,
          email NVARCHAR(256) NULL,
          phone NVARCHAR(64) NULL,
          consent_text NVARCHAR(500) NULL,
          source NVARCHAR(64) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_iveo_contacts_username ON iveo_contacts(username);
      END

      -- 4. Protected Link Passwords Table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='iveo_link_passwords' AND xtype='U')
      BEGIN
        CREATE TABLE iveo_link_passwords (
          link_id NVARCHAR(128) NOT NULL PRIMARY KEY,
          password_text NVARCHAR(256) NOT NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
      END

      -- 5. Analytics Events Table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='iveo_analytics_events' AND xtype='U')
      BEGIN
        CREATE TABLE iveo_analytics_events (
          id NVARCHAR(128) NOT NULL PRIMARY KEY,
          username NVARCHAR(64) NOT NULL,
          event_type NVARCHAR(32) NOT NULL,
          block_id NVARCHAR(128) NULL,
          country NVARCHAR(16) NULL,
          referrer NVARCHAR(256) NULL,
          device NVARCHAR(32) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_iveo_analytics_username ON iveo_analytics_events(username, created_at);
      END
    `;

    await pool.request().query(migrationSql);
    schemaEnsured = true;
  } catch {
    // Ignore schema errors on unavailable connections
  }
}

/**
 * Diagnostics & Readiness check without exposing credentials
 */
export async function checkDatabaseReadiness(): Promise<{
  ok: boolean;
  status: string;
  server: string;
  database: string;
  mode: 'azure_entra' | 'azure_sql_direct' | 'server_store_ready';
  details?: string;
}> {
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      const res = await pool.request().query('SELECT 1 AS is_alive, DB_NAME() as db_name');
      const isAlive = res.recordset[0]?.is_alive === 1;
      return {
        ok: isAlive,
        status: isAlive ? 'connected' : 'query_failed',
        server: AZURE_SQL_SERVER,
        database: AZURE_SQL_DATABASE,
        mode: AZURE_CLIENT_ID ? 'azure_entra' : 'azure_sql_direct',
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'error_executing_test_query',
        server: AZURE_SQL_SERVER,
        database: AZURE_SQL_DATABASE,
        mode: 'azure_sql_direct',
        details: err?.message || String(err),
      };
    }
  }

  return {
    ok: true,
    status: 'pending_azure_credentials',
    server: AZURE_SQL_SERVER,
    database: AZURE_SQL_DATABASE,
    mode: 'server_store_ready',
    details: 'Server-side persistence active; ready for Azure Entra credentials in environment variables.',
  };
}

// ============================================================================
import { isPrivilegedEmailServer, validateUsernameServer } from './usernames.ts';

// ============================================================================
// Isolated Per-User Atomic Disk Store (Zero cross-user overwrite / race risk)
// ============================================================================
export interface UserRecord {
  profile: any | null;
  blocks: any[];
  blocksInitialized?: boolean;
  deletedBlockIds?: string[];
  contacts: any[];
  passwords: Record<string, string>;
  analytics: any[];
  appearanceHistory?: { undoStack: any[]; redoStack: any[]; lastCoalesceKey?: string | null; lastCoalesceAt?: number };
  appearanceThemes?: any[];
  billing?: UserBillingStore;
}

type IndexPasswordEntry = { password: string; username?: string };

const migratedDirs = new Set<string>();
const userWriteQueues = new Map<string, Promise<unknown>>();

function getDataDir(): string {
  return process.env.IVEO_DATA_DIR
    ? path.resolve(process.env.IVEO_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
}

function getUsersDir(): string {
  return path.join(getDataDir(), 'users');
}

function sanitizeUserFileKey(username: string): string {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  const safe = clean.replace(/[^a-z0-9._-]/g, '_');
  return safe || '_unknown';
}

function atomicWriteJson(filePath: string, data: unknown): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.warn('[UserStore] Atomic write failed:', err);
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        return parsed as T;
      }
    }
  } catch {}
  return fallback;
}

function ensureMigratedToPerUserStore(): void {
  const dataDir = getDataDir();
  if (migratedDirs.has(dataDir)) return;
  migratedDirs.add(dataDir);

  const markerPath = path.join(dataDir, '.migrated_users_v1');
  const legacyPath = path.join(dataDir, 'server_store.json');
  if (fs.existsSync(markerPath) || !fs.existsSync(legacyPath)) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return;

    const profiles: Record<string, any> = parsed.profiles || {};
    const blocksMap: Record<string, any[]> = parsed.blocks || {};
    const contactsMap: Record<string, any[]> = parsed.contacts || {};
    const analyticsMap: Record<string, any[]> = parsed.analytics || {};
    const passwordsMap: Record<string, string> = parsed.passwords || {};
    const claims: Record<string, any> = parsed.claims || {};
    const redirects: Record<string, any> = parsed.redirects || {};
    const userToUsername: Record<string, string> = { ...(parsed.userToUsername || {}) };

    const allUsernames = new Set<string>([
      ...Object.keys(profiles),
      ...Object.keys(blocksMap),
      ...Object.keys(contactsMap),
      ...Object.keys(analyticsMap),
    ]);

    const passwordIndex: Record<string, IndexPasswordEntry> = {};
    const linkOwner = new Map<string, string>();
    for (const [uname, blist] of Object.entries(blocksMap)) {
      const clean = uname.replace(/^@+/, '').toLowerCase().trim();
      if (Array.isArray(blist)) {
        for (const b of blist) {
          if (b?.id) linkOwner.set(String(b.id), clean);
        }
      }
    }

    const perUserPasswords: Record<string, Record<string, string>> = {};
    for (const [linkId, pwd] of Object.entries(passwordsMap)) {
      const owner = linkOwner.get(linkId);
      passwordIndex[linkId] = { password: String(pwd), ...(owner ? { username: owner } : {}) };
      if (owner) {
        if (!perUserPasswords[owner]) perUserPasswords[owner] = {};
        perUserPasswords[owner][linkId] = String(pwd);
      }
    }

    for (const rawName of allUsernames) {
      const clean = rawName.replace(/^@+/, '').toLowerCase().trim();
      if (!clean) continue;
      const prof = profiles[rawName] || profiles[clean] || null;
      if (prof?.userId && prof.userId !== 'owner' && !userToUsername[prof.userId]) {
        userToUsername[prof.userId] = clean;
      }
      const userRec: UserRecord = {
        profile: prof ? { ...prof, username: clean } : null,
        blocks: Array.isArray(blocksMap[rawName] || blocksMap[clean])
          ? (blocksMap[rawName] || blocksMap[clean])
          : [],
        contacts: Array.isArray(contactsMap[rawName] || contactsMap[clean])
          ? (contactsMap[rawName] || contactsMap[clean])
          : [],
        passwords: perUserPasswords[clean] || {},
        analytics: Array.isArray(analyticsMap[rawName] || analyticsMap[clean])
          ? (analyticsMap[rawName] || analyticsMap[clean])
          : [],
      };
      const userFile = path.join(getUsersDir(), `${sanitizeUserFileKey(clean)}.json`);
      if (!fs.existsSync(userFile)) {
        atomicWriteJson(userFile, userRec);
      }
    }

    atomicWriteJson(path.join(dataDir, 'index_users.json'), userToUsername);
    atomicWriteJson(path.join(dataDir, 'index_claims.json'), claims);
    atomicWriteJson(path.join(dataDir, 'index_redirects.json'), redirects);
    atomicWriteJson(path.join(dataDir, 'index_passwords.json'), passwordIndex);
    atomicWriteJson(markerPath, { migratedAt: new Date().toISOString(), users: allUsernames.size });
  } catch (err) {
    console.warn('[UserStore] Migration warning:', err);
  }
}

function getUserFilePath(username: string): string {
  return path.join(getUsersDir(), `${sanitizeUserFileKey(username)}.json`);
}

function readUserRecord(username: string): UserRecord {
  ensureMigratedToPerUserStore();
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) {
    return {
      profile: null,
      blocks: [],
      blocksInitialized: false,
      deletedBlockIds: [],
      contacts: [],
      passwords: {},
      analytics: [],
      appearanceHistory: { undoStack: [], redoStack: [] },
      appearanceThemes: [],
    };
  }
  const raw = readJsonFile<Partial<UserRecord>>(getUserFilePath(clean), {});
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  return {
    profile: raw.profile ?? null,
    blocks,
    blocksInitialized: typeof raw.blocksInitialized === 'boolean' ? raw.blocksInitialized : blocks.length > 0,
    deletedBlockIds: Array.isArray(raw.deletedBlockIds) ? raw.deletedBlockIds.map(String) : [],
    contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
    passwords: raw.passwords && typeof raw.passwords === 'object' ? raw.passwords : {},
    analytics: Array.isArray(raw.analytics) ? raw.analytics : [],
    appearanceHistory:
      raw.appearanceHistory && typeof raw.appearanceHistory === 'object'
        ? {
            undoStack: Array.isArray(raw.appearanceHistory.undoStack) ? raw.appearanceHistory.undoStack : [],
            redoStack: Array.isArray(raw.appearanceHistory.redoStack) ? raw.appearanceHistory.redoStack : [],
            lastCoalesceKey: raw.appearanceHistory.lastCoalesceKey ?? null,
            lastCoalesceAt: typeof raw.appearanceHistory.lastCoalesceAt === 'number' ? raw.appearanceHistory.lastCoalesceAt : 0,
          }
        : { undoStack: [], redoStack: [] },
    appearanceThemes: Array.isArray(raw.appearanceThemes) ? raw.appearanceThemes : [],
    billing:
      raw.billing && typeof raw.billing === 'object'
        ? {
            billingHistory: Array.isArray(raw.billing.billingHistory) ? raw.billing.billingHistory : [],
            invoices: Array.isArray(raw.billing.invoices) ? raw.billing.invoices : [],
            notifications: Array.isArray(raw.billing.notifications) ? raw.billing.notifications : [],
            auditLogs: Array.isArray(raw.billing.auditLogs) ? raw.billing.auditLogs : [],
            processedWebhookEvents: Array.isArray(raw.billing.processedWebhookEvents)
              ? raw.billing.processedWebhookEvents
              : [],
          }
        : {
            billingHistory: [],
            invoices: [],
            notifications: [],
            auditLogs: [],
            processedWebhookEvents: [],
          },
  };
}

function writeUserRecord(username: string, record: UserRecord): void {
  ensureMigratedToPerUserStore();
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return;
  atomicWriteJson(getUserFilePath(clean), record);
}

async function withUserLock<T>(username: string, fn: () => Promise<T> | T): Promise<T> {
  const key = sanitizeUserFileKey(username);
  const prev = userWriteQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  userWriteQueues.set(
    key,
    prev.then(() => gate, () => gate)
  );
  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
    if (userWriteQueues.get(key) === gate) {
      userWriteQueues.delete(key);
    }
  }
}

export async function dbReadUserBilling(username: string): Promise<UserBillingStore> {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  const empty: UserBillingStore = {
    billingHistory: [],
    invoices: [],
    notifications: [],
    auditLogs: [],
    processedWebhookEvents: [],
  };
  if (!clean) return empty;
  const record = readUserRecord(clean);
  return record.billing || empty;
}

export async function dbUpdateUserBilling(
  username: string,
  updater: (prev: UserBillingStore) => UserBillingStore
): Promise<UserBillingStore> {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!clean) {
    return updater({
      billingHistory: [],
      invoices: [],
      notifications: [],
      auditLogs: [],
      processedWebhookEvents: [],
    });
  }
  return withUserLock(clean, () => {
    const record = readUserRecord(clean);
    const prevBilling: UserBillingStore = record.billing || {
      billingHistory: [],
      invoices: [],
      notifications: [],
      auditLogs: [],
      processedWebhookEvents: [],
    };
    const nextBilling = updater(prevBilling);
    record.billing = nextBilling;
    writeUserRecord(clean, record);
    return nextBilling;
  });
}

function readUserIndex(): Record<string, string> {
  ensureMigratedToPerUserStore();
  return readJsonFile<Record<string, string>>(path.join(getDataDir(), 'index_users.json'), {});
}
function writeUserIndex(data: Record<string, string>): void {
  atomicWriteJson(path.join(getDataDir(), 'index_users.json'), data);
}

function readClaimsIndex(): Record<string, { userId: string; username: string; claimedAt: string }> {
  ensureMigratedToPerUserStore();
  return readJsonFile(path.join(getDataDir(), 'index_claims.json'), {});
}
function writeClaimsIndex(data: Record<string, { userId: string; username: string; claimedAt: string }>): void {
  atomicWriteJson(path.join(getDataDir(), 'index_claims.json'), data);
}

function readRedirectsIndex(): Record<string, { to: string; updatedAt: string }> {
  ensureMigratedToPerUserStore();
  return readJsonFile(path.join(getDataDir(), 'index_redirects.json'), {});
}
function writeRedirectsIndex(data: Record<string, { to: string; updatedAt: string }>): void {
  atomicWriteJson(path.join(getDataDir(), 'index_redirects.json'), data);
}

function readPasswordsIndex(): Record<string, IndexPasswordEntry> {
  ensureMigratedToPerUserStore();
  return readJsonFile(path.join(getDataDir(), 'index_passwords.json'), {});
}
function writePasswordsIndex(data: Record<string, IndexPasswordEntry>): void {
  atomicWriteJson(path.join(getDataDir(), 'index_passwords.json'), data);
}

function listAllUserRecords(): Array<{ username: string; record: UserRecord }> {
  ensureMigratedToPerUserStore();
  const dir = getUsersDir();
  if (!fs.existsSync(dir)) return [];
  const results: Array<{ username: string; record: UserRecord }> = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || file.endsWith('.tmp')) continue;
    const uname = file.slice(0, -5);
    const rec = readJsonFile<Partial<UserRecord>>(path.join(dir, file), {});
    results.push({
      username: (rec.profile?.username || uname).replace(/^@+/, '').toLowerCase().trim(),
      record: {
        profile: rec.profile ?? null,
        blocks: Array.isArray(rec.blocks) ? rec.blocks : [],
        contacts: Array.isArray(rec.contacts) ? rec.contacts : [],
        passwords: rec.passwords && typeof rec.passwords === 'object' ? rec.passwords : {},
        analytics: Array.isArray(rec.analytics) ? rec.analytics : [],
      },
    });
  }
  return results;
}

// ============================================================================
// Unified High-Level Operations (Azure SQL with automatic server-store fallback)
// ============================================================================

export async function dbVerifyOwnership(
  username: string,
  userId?: string | null,
  primaryEmail?: string | null
): Promise<boolean> {
  const cleanUsername = username.toLowerCase().trim();
  const profile = await dbGetProfile(cleanUsername);
  if (!profile) return true; // not yet created

  if (!userId) return false;
  if (profile.userId === userId) return true;

  // Check admin / @iveo.site emails list
  if (isPrivilegedEmailServer(primaryEmail)) {
    return true;
  }
  if (profile.primaryEmail && primaryEmail && profile.primaryEmail.toLowerCase().trim() === primaryEmail.toLowerCase().trim()) {
    return true;
  }
  if (profile.userId === 'owner') {
    // Unassigned legacy owner record - allow binding
    return true;
  }

  return false;
}

export async function dbClaimUsername(
  userId: string,
  username: string,
  profileData?: Partial<any>,
  primaryEmail?: string | null,
  previousUsernameHint?: string | null
): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  username?: string;
  previousUsername?: string | null;
  profileUrl?: string;
}> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const cleanPrevHint = previousUsernameHint ? previousUsernameHint.replace(/^@+/, '').toLowerCase().trim() : null;
  const isOwnerEmailMatch = isPrivilegedEmailServer(primaryEmail);

  const validation = validateUsernameServer(clean, { allowReserved: isOwnerEmailMatch });
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.reason === 'reserved' ? 'reserved' : 'invalid_format',
      message: validation.message || 'That name is unavailable.',
    };
  }

  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if username is already claimed
      const checkReq = new sql.Request(transaction);
      checkReq.input('username', sql.NVarChar(64), clean);
      const existing = await checkReq.query('SELECT user_id, display_name FROM iveo_profiles WHERE username = @username');

      if (existing.recordset.length > 0) {
        const existingUserId = existing.recordset[0].user_id;
        if (existingUserId && existingUserId !== userId && existingUserId !== 'owner' && !isOwnerEmailMatch) {
          await transaction.rollback();
          return { ok: false, error: 'already_claimed', message: `iveo.site/@${clean} is already claimed by another creator. Please pick another address.` };
        }
      }

      // Check if this user already claimed a different username, rename/migrate blocks & contacts
      const userCheckReq = new sql.Request(transaction);
      userCheckReq.input('userId', sql.NVarChar(128), userId);
      const prevClaims = await userCheckReq.query('SELECT username FROM iveo_profiles WHERE user_id = @userId');
      let releasedUsername: string | null = null;

      const prevNames = new Set<string>(prevClaims.recordset.map((r: any) => String(r.username).toLowerCase()));
      if (cleanPrevHint && cleanPrevHint !== clean) {
        prevNames.add(cleanPrevHint);
      }

      for (const oldUname of prevNames) {
        if (oldUname && oldUname !== clean) {
          releasedUsername = oldUname;
          const delReq = new sql.Request(transaction);
          delReq.input('oldUsername', sql.NVarChar(64), oldUname);
          delReq.input('userId', sql.NVarChar(128), userId);
          await delReq.query('DELETE FROM iveo_profiles WHERE username = @oldUsername AND user_id = @userId');

          const moveBlocksReq = new sql.Request(transaction);
          moveBlocksReq.input('oldUsername', sql.NVarChar(64), oldUname);
          moveBlocksReq.input('newUsername', sql.NVarChar(64), clean);
          await moveBlocksReq.query('UPDATE iveo_blocks SET username = @newUsername WHERE username = @oldUsername');

          const moveContactsReq = new sql.Request(transaction);
          moveContactsReq.input('oldUsername', sql.NVarChar(64), oldUname);
          moveContactsReq.input('newUsername', sql.NVarChar(64), clean);
          await moveContactsReq.query('UPDATE iveo_contacts SET username = @newUsername WHERE username = @oldUsername');

          const moveAnalyticsReq = new sql.Request(transaction);
          moveAnalyticsReq.input('oldUsername', sql.NVarChar(64), oldUname);
          moveAnalyticsReq.input('newUsername', sql.NVarChar(64), clean);
          await moveAnalyticsReq.query('UPDATE iveo_analytics_events SET username = @newUsername WHERE username = @oldUsername');
        }
      }

      // Insert or update profile
      const claimCreatedAt = profileData?.createdAt || new Date().toISOString();
      const resolvedClaimPlan = resolveEffectivePlan({
        email: primaryEmail,
        storedPlan: profileData?.plan,
        createdAt: claimCreatedAt,
        subscription: profileData?.subscription,
      });
      const effectivePlan = resolvedClaimPlan.plan;
      const insReq = new sql.Request(transaction);
      insReq.input('userId', sql.NVarChar(128), userId);
      insReq.input('username', sql.NVarChar(64), clean);
      insReq.input('displayName', sql.NVarChar(128), profileData?.displayName || clean);
      insReq.input('bio', sql.NVarChar(500), profileData?.bio || '');
      insReq.input('avatarUrl', sql.NVarChar(2048), profileData?.avatarUrl || null);
      insReq.input('avatarType', sql.NVarChar(32), profileData?.avatarType || (profileData?.avatarId ? 'default' : (profileData?.avatarUrl ? 'uploaded' : 'default')));
      insReq.input('avatarId', sql.NVarChar(64), profileData?.avatarId || null);
      insReq.input('vibeId', sql.NVarChar(32), profileData?.vibeId || 'clean');
      insReq.input('buttonShape', sql.NVarChar(32), profileData?.buttonShape || 'rounded');
      insReq.input('socialsJson', sql.NVarChar(sql.MAX), JSON.stringify({
        links: profileData?.socials || {},
        position: profileData?.socialsPosition || 'top',
        email: primaryEmail || null,
        background: profileData?.background || null,
        avatarData: profileData?.avatarData || null,
        status: profileData?.status || 'active',
        createdAt: claimCreatedAt,
        subscription: profileData?.subscription || null,
        integrations: {
          googleAnalyticsId: profileData?.googleAnalyticsId || null,
          metaPixelId: profileData?.metaPixelId || null,
          whatsappNumber: profileData?.whatsappNumber || null,
          customSeoTitle: profileData?.customSeoTitle || null,
          customSeoDescription: profileData?.customSeoDescription || null,
        },
        appearance: {
          fontSettings: profileData?.fontSettings || null,
          buttonColors: profileData?.buttonColors || null,
          businessCard: profileData?.businessCard || null,
          layoutSettings: profileData?.layoutSettings || null,
          appearanceV2: profileData?.appearance || null,
        },
      }));
      insReq.input('plan', sql.NVarChar(32), effectivePlan);

      await insReq.query(`
        MERGE iveo_profiles AS target
        USING (SELECT @username AS username) AS source
        ON (target.username = source.username)
        WHEN MATCHED THEN
          UPDATE SET
            user_id = @userId,
            display_name = @displayName,
            bio = @bio,
            avatar_url = @avatarUrl,
            avatar_type = @avatarType,
            avatar_id = @avatarId,
            vibe_id = @vibeId,
            button_shape = @buttonShape,
            socials_json = @socialsJson,
            plan = @plan,
            updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (user_id, username, display_name, bio, avatar_url, avatar_type, avatar_id, vibe_id, button_shape, socials_json, plan, is_published)
          VALUES (@userId, @username, @displayName, @bio, @avatarUrl, @avatarType, @avatarId, @vibeId, @buttonShape, @socialsJson, @plan, 1);
      `);

      await transaction.commit();

      // Update isolated per-user redirect & claim maps if old username was released
      const redirects = readRedirectsIndex();
      delete redirects[clean];
      if (releasedUsername && releasedUsername !== clean) {
        redirects[releasedUsername] = { to: clean, updatedAt: new Date().toISOString() };
        const claims = readClaimsIndex();
        delete claims[releasedUsername];
        writeClaimsIndex(claims);
        const oldFile = getUserFilePath(releasedUsername);
        if (fs.existsSync(oldFile)) {
          try { fs.unlinkSync(oldFile); } catch {}
        }
      }
      writeRedirectsIndex(redirects);

      return { ok: true, username: clean, previousUsername: releasedUsername, profileUrl: `https://iveo.site/@${clean}` };
    } catch {
      // Gracefully fall through to isolated per-user store
    }
  }

  // Isolated per-user store fallback
  return withUserLock(clean, () => {
    const targetRecord = readUserRecord(clean);
    const existingProfile = targetRecord.profile;
    if (
      existingProfile &&
      existingProfile.userId &&
      existingProfile.userId !== userId &&
      existingProfile.userId !== 'owner' &&
      !isOwnerEmailMatch
    ) {
      return { ok: false, error: 'already_claimed', message: `iveo.site/@${clean} is already claimed by another creator. Please pick another address.` };
    }

    const userIndex = readUserIndex();
    const claimsIndex = readClaimsIndex();
    const redirectsIndex = readRedirectsIndex();
    delete redirectsIndex[clean];

    const hintRecord = cleanPrevHint && cleanPrevHint !== clean ? readUserRecord(cleanPrevHint).profile : null;
    const previousUsername = userIndex[userId] || (
      cleanPrevHint &&
      cleanPrevHint !== clean &&
      hintRecord &&
      (hintRecord.userId === userId || hintRecord.userId === 'owner' || isOwnerEmailMatch)
        ? cleanPrevHint
        : null
    );

    let oldProfSnapshot: any = null;
    if (previousUsername && previousUsername !== clean) {
      const oldRec = readUserRecord(previousUsername);
      oldProfSnapshot = oldRec.profile || null;
      if (oldRec.blocks.length > 0) {
        targetRecord.blocks = oldRec.blocks.map((b) => ({ ...b, username: clean }));
      }
      if (oldRec.contacts.length > 0) {
        targetRecord.contacts = [
          ...targetRecord.contacts,
          ...oldRec.contacts.map((c) => ({ ...c, username: clean })),
        ];
      }
      if (oldRec.analytics.length > 0) {
        targetRecord.analytics = [
          ...targetRecord.analytics,
          ...oldRec.analytics.map((e) => ({ ...e, username: clean })),
        ];
      }
      if (Object.keys(oldRec.passwords).length > 0) {
        targetRecord.passwords = { ...oldRec.passwords, ...targetRecord.passwords };
      }

      const oldFile = getUserFilePath(previousUsername);
      if (fs.existsSync(oldFile)) {
        try { fs.unlinkSync(oldFile); } catch {}
      }
      delete claimsIndex[previousUsername];
      redirectsIndex[previousUsername] = {
        to: clean,
        updatedAt: new Date().toISOString(),
      };
    }

    // If claimed by a new user after deletion of an old account, isolate blocks & contacts
    if (claimsIndex[clean] && claimsIndex[clean].userId !== userId) {
      targetRecord.blocks = [];
      targetRecord.contacts = [];
      targetRecord.passwords = {};
    }

    userIndex[userId] = clean;
    claimsIndex[clean] = {
      userId,
      username: clean,
      claimedAt: new Date().toISOString(),
    };

    const basePrev = targetRecord.profile || oldProfSnapshot || {};
    const fallbackCreatedAt = basePrev?.createdAt || basePrev?.claimedAt || profileData?.createdAt || new Date().toISOString();
    const fallbackSubscription = profileData?.subscription !== undefined ? profileData.subscription : (basePrev?.subscription || null);
    const fallbackPlan = resolveEffectivePlan({
      email: primaryEmail || basePrev?.primaryEmail,
      storedPlan: profileData?.plan || basePrev?.plan,
      createdAt: fallbackCreatedAt,
      subscription: fallbackSubscription,
    });

    targetRecord.profile = {
      ...basePrev,
      userId,
      username: clean,
      displayName: profileData?.displayName || basePrev?.displayName || clean,
      bio: profileData?.bio !== undefined ? profileData.bio : (basePrev?.bio || ''),
      avatarUrl: profileData?.avatarUrl !== undefined ? profileData.avatarUrl : (basePrev?.avatarUrl || null),
      avatarType: profileData?.avatarType || basePrev?.avatarType || (profileData?.avatarId ? 'default' : (profileData?.avatarUrl ? 'uploaded' : 'default')),
      avatarId: profileData?.avatarId !== undefined ? profileData.avatarId : (basePrev?.avatarId || null),
      vibeId: profileData?.vibeId || basePrev?.vibeId || 'clean',
      buttonShape: profileData?.buttonShape !== undefined ? profileData.buttonShape : (basePrev?.buttonShape ?? null),
      socials: profileData?.socials || basePrev?.socials || {},
      socialsPosition: profileData?.socialsPosition || basePrev?.socialsPosition || 'top',
      primaryEmail: primaryEmail || basePrev?.primaryEmail || null,
      plan: fallbackPlan.plan,
      planSource: fallbackPlan.planSource,
      createdAt: fallbackCreatedAt,
      subscription: fallbackSubscription,
      status: profileData?.status || basePrev?.status || 'active',
      isPublished: profileData?.isPublished ?? basePrev?.isPublished ?? true,
      hideFooter: Boolean(profileData?.hideFooter ?? basePrev?.hideFooter),
      hideFromSearch: Boolean(profileData?.hideFromSearch ?? basePrev?.hideFromSearch),
      background: profileData?.background !== undefined ? profileData.background : (basePrev?.background || null),
      googleAnalyticsId: profileData?.googleAnalyticsId !== undefined ? profileData.googleAnalyticsId : (basePrev?.googleAnalyticsId || null),
      metaPixelId: profileData?.metaPixelId !== undefined ? profileData.metaPixelId : (basePrev?.metaPixelId || null),
      whatsappNumber: profileData?.whatsappNumber !== undefined ? profileData.whatsappNumber : (basePrev?.whatsappNumber || null),
      customSeoTitle: profileData?.customSeoTitle !== undefined ? profileData.customSeoTitle : (basePrev?.customSeoTitle || null),
      customSeoDescription: profileData?.customSeoDescription !== undefined ? profileData.customSeoDescription : (basePrev?.customSeoDescription || null),
      fontSettings: profileData?.fontSettings !== undefined ? profileData.fontSettings : (basePrev?.fontSettings || null),
      buttonColors: profileData?.buttonColors !== undefined ? profileData.buttonColors : (basePrev?.buttonColors || null),
      businessCard: profileData?.businessCard !== undefined ? profileData.businessCard : (basePrev?.businessCard || null),
      layoutSettings: profileData?.layoutSettings !== undefined ? profileData.layoutSettings : (basePrev?.layoutSettings || null),
      appearance: profileData?.appearance !== undefined ? profileData.appearance : (basePrev?.appearance ?? null),
      claimedAt: basePrev?.claimedAt || fallbackCreatedAt,
      updatedAt: new Date().toISOString(),
    };

    writeUserRecord(clean, targetRecord);
    writeUserIndex(userIndex);
    writeClaimsIndex(claimsIndex);
    writeRedirectsIndex(redirectsIndex);

    return {
      ok: true,
      username: clean,
      previousUsername: previousUsername && previousUsername !== clean ? previousUsername : null,
      profileUrl: `https://iveo.site/@${clean}`,
    };
  });
}

export async function dbGetProfileByUserId(userId: string, email?: string | null): Promise<any | null> {
  if (!userId && !email) return null;
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      const req = pool.request();
      let query = 'SELECT TOP 1 * FROM iveo_profiles WHERE ';
      if (userId) {
        req.input('userId', sql.NVarChar(128), userId);
        query += 'user_id = @userId';
      }
      query += ' ORDER BY updated_at DESC';
      const res = await req.query(query);

      if (res.recordset.length > 0) {
        const row = res.recordset[0];
        let socials: Record<string, string> = {};
        let socialsPosition: 'top' | 'bottom' | 'both' = 'top';
        let primaryEmail: string | null = null;
        let backgroundConfig: any = null;
        let createdAt: string | null = row.created_at ? new Date(row.created_at).toISOString() : null;
        let subscription: SubscriptionRecord | null = null;
        let avatarData: string | null = null;
        let integrations: Record<string, any> = {};
        let appearance: Record<string, any> = {};
        try {
          if (row.socials_json) {
            const parsed = JSON.parse(row.socials_json);
            if (parsed && typeof parsed === 'object' && 'links' in parsed) {
              socials = parsed.links || {};
              socialsPosition = parsed.position === 'bottom' ? 'bottom' : parsed.position === 'both' ? 'both' : 'top';
              primaryEmail = parsed.email || null;
              backgroundConfig = parsed.background || null;
              avatarData = typeof parsed.avatarData === 'string' ? parsed.avatarData : null;
              if (parsed.createdAt) createdAt = String(parsed.createdAt);
              if (parsed.subscription) subscription = parsed.subscription;
              integrations = (parsed.integrations && typeof parsed.integrations === 'object') ? parsed.integrations : {};
              appearance = (parsed.appearance && typeof parsed.appearance === 'object') ? parsed.appearance : {};
            } else if (parsed && typeof parsed === 'object') {
              socials = parsed;
            }
          }
        } catch {}
        const resolved = resolveEffectivePlan({
          email: primaryEmail || email,
          storedPlan: row.plan,
          createdAt,
          subscription,
        });
        return {
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          avatarData,
          avatarType: row.avatar_type || (row.avatar_id ? 'default' : (row.avatar_url ? 'uploaded' : 'default')),
          avatarId: row.avatar_id || null,
          vibeId: row.vibe_id,
          buttonShape: row.button_shape,
          socials,
          socialsPosition,
          primaryEmail,
          plan: resolved.plan,
          isPro: resolved.isPro,
          planSource: resolved.planSource,
          createdAt,
          subscription,
          hideFooter: Boolean(row.hide_footer),
          hideFromSearch: Boolean(row.hide_from_search),
          background: backgroundConfig || (row as any).background || null,
          googleAnalyticsId: integrations.googleAnalyticsId || null,
          metaPixelId: integrations.metaPixelId || null,
          whatsappNumber: integrations.whatsappNumber || null,
          customSeoTitle: integrations.customSeoTitle || null,
          customSeoDescription: integrations.customSeoDescription || null,
          fontSettings: appearance.fontSettings || null,
          buttonColors: appearance.buttonColors || null,
          businessCard: appearance.businessCard || null,
          layoutSettings: appearance.layoutSettings || null,
          appearance: appearance.appearanceV2 || null,
          isPublished: Boolean(row.is_published),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        };
      }
    } catch {
      // Fall through to server store fallback
    }
  }

  const userIndex = readUserIndex();
  const cleanEmail = email ? email.toLowerCase().trim() : null;
  const applyStorePlan = (found: any) => {
    const resolved = resolveEffectivePlan({
      email: found.primaryEmail || cleanEmail,
      storedPlan: found.plan,
      createdAt: found.createdAt || found.claimedAt,
      subscription: found.subscription,
    });
    return {
      ...found,
      plan: resolved.plan,
      isPro: resolved.isPro,
      planSource: resolved.planSource,
      createdAt: found.createdAt || found.claimedAt || null,
      subscription: found.subscription || null,
    };
  };

  if (userId && userIndex[userId]) {
    const uname = userIndex[userId];
    const rec = readUserRecord(uname);
    if (rec.profile) {
      return applyStorePlan(rec.profile);
    }
  }

  for (const { username: uname, record } of listAllUserRecords()) {
    const p = record.profile;
    if (!p) continue;
    if (userId && p.userId === userId) {
      userIndex[userId] = uname;
      writeUserIndex(userIndex);
      return applyStorePlan(p);
    }
    if (cleanEmail && p.primaryEmail && p.primaryEmail.toLowerCase().trim() === cleanEmail) {
      if (userId && (!p.userId || p.userId === 'owner')) {
        p.userId = userId;
        record.profile = p;
        writeUserRecord(uname, record);
        userIndex[userId] = uname;
        writeUserIndex(userIndex);
      }
      return applyStorePlan(p);
    }
  }

  return null;
}

export async function dbSaveProfile(profile: {
  userId: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  avatarData?: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  vibeId?: string;
  buttonShape?: string | null;
  socials?: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  primaryEmail?: string | null;
  plan?: string;
  createdAt?: string | null;
  subscription?: Partial<SubscriptionRecord> | null;
  status?: 'active' | 'private' | 'unpublished' | 'deleted' | 'suspended';
  isPublished?: boolean;
  hideFooter?: boolean;
  hideFromSearch?: boolean;
  background?: any;
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
  whatsappNumber?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
  fontSettings?: any;
  buttonColors?: any;
  businessCard?: any;
  layoutSettings?: any;
  appearance?: any;
  updatedAt?: string;
}): Promise<{ ok: boolean; error?: string; updatedAt?: string; profile?: any }> {
  const cleanUsername = profile.username.replace(/^@+/, '').toLowerCase().trim();

  // Ownership verification check
  const isAuthorized = await dbVerifyOwnership(cleanUsername, profile.userId, profile.primaryEmail);
  if (!isAuthorized) {
    return { ok: false, error: 'unauthorized' };
  }

  const pool = await getAzureSqlPool();
  const existingProf = await dbGetProfile(cleanUsername);
  const merged = mergeProfileForSave(
    existingProf,
    { ...profile, username: cleanUsername },
    isPrivilegedEmailServer(profile.primaryEmail ?? existingProf?.primaryEmail)
  );

  const socialsPayload = {
    links: merged.socials,
    position: merged.socialsPosition,
    email: merged.primaryEmail,
    background: merged.background,
    avatarData: merged.avatarData || null,
    status: merged.status,
    createdAt: merged.createdAt,
    subscription: merged.subscription,
    integrations: {
      googleAnalyticsId: merged.googleAnalyticsId,
      metaPixelId: merged.metaPixelId,
      whatsappNumber: merged.whatsappNumber,
      customSeoTitle: merged.customSeoTitle,
      customSeoDescription: merged.customSeoDescription,
    },
    appearance: {
      fontSettings: merged.fontSettings,
      buttonColors: merged.buttonColors,
      businessCard: merged.businessCard,
      layoutSettings: merged.layoutSettings,
      appearanceV2: merged.appearance ?? null,
    },
  };

  if (pool) {
    try {
      const req = pool.request();
      req.input('userId', sql.NVarChar(128), merged.userId);
      req.input('username', sql.NVarChar(64), cleanUsername);
      req.input('displayName', sql.NVarChar(128), merged.displayName);
      req.input('bio', sql.NVarChar(500), merged.bio);
      req.input('avatarUrl', sql.NVarChar(2048), merged.avatarUrl);
      req.input('avatarType', sql.NVarChar(32), merged.avatarType);
      req.input('avatarId', sql.NVarChar(64), merged.avatarId);
      req.input('vibeId', sql.NVarChar(32), merged.vibeId);
      req.input('buttonShape', sql.NVarChar(32), merged.buttonShape);
      req.input('socialsJson', sql.NVarChar(sql.MAX), JSON.stringify(socialsPayload));
      req.input('plan', sql.NVarChar(32), merged.plan);
      req.input('hideFooter', sql.Bit, merged.hideFooter ? 1 : 0);
      req.input('hideFromSearch', sql.Bit, merged.hideFromSearch ? 1 : 0);

      await req.query(`
        MERGE iveo_profiles AS target
        USING (SELECT @username AS username) AS source
        ON (target.username = source.username)
        WHEN MATCHED THEN
          UPDATE SET
            user_id = CASE WHEN target.user_id = 'owner' THEN @userId ELSE target.user_id END,
            display_name = @displayName,
            bio = @bio,
            avatar_url = @avatarUrl,
            avatar_type = @avatarType,
            avatar_id = @avatarId,
            vibe_id = @vibeId,
            button_shape = @buttonShape,
            socials_json = @socialsJson,
            plan = @plan,
            hide_footer = @hideFooter,
            hide_from_search = @hideFromSearch,
            updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (user_id, username, display_name, bio, avatar_url, avatar_type, avatar_id, vibe_id, button_shape, socials_json, plan, hide_footer, hide_from_search, is_published)
          VALUES (@userId, @username, @displayName, @bio, @avatarUrl, @avatarType, @avatarId, @vibeId, @buttonShape, @socialsJson, @plan, @hideFooter, @hideFromSearch, 1);
      `);
      return { ok: true, updatedAt: merged.updatedAt, profile: merged };
    } catch {
      // Fall through to server store fallback
    }
  }

  // Isolated per-user store fallback
  return withUserLock(cleanUsername, () => {
    const record = readUserRecord(cleanUsername);
    const nowIso = merged.updatedAt || new Date().toISOString();
    record.profile = {
      ...record.profile,
      ...merged,
      username: cleanUsername,
      updatedAt: nowIso,
    };
    writeUserRecord(cleanUsername, record);

    if (merged.userId && merged.userId !== 'owner') {
      const userIndex = readUserIndex();
      if (userIndex[merged.userId] !== cleanUsername) {
        userIndex[merged.userId] = cleanUsername;
        writeUserIndex(userIndex);
      }
    }
    return { ok: true, updatedAt: nowIso, profile: record.profile };
  });
}

export async function dbGetProfile(username: string): Promise<any | null> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const res = await pool
        .request()
        .input('username', sql.NVarChar(64), clean)
        .query('SELECT * FROM iveo_profiles WHERE username = @username');

      if (res.recordset.length > 0) {
        const row = res.recordset[0];
        let socials: Record<string, string> = {};
        let socialsPosition: 'top' | 'bottom' | 'both' = 'top';
        let primaryEmail: string | null = null;
        let backgroundConfig: any = null;
        let parsedStatus = 'active';
        let createdAt: string | null = row.created_at ? new Date(row.created_at).toISOString() : null;
        let subscription: SubscriptionRecord | null = null;
        let avatarData: string | null = null;
        let integrations: Record<string, any> = {};
        let appearance: Record<string, any> = {};
        try {
          if (row.socials_json) {
            const parsed = JSON.parse(row.socials_json);
            if (parsed && typeof parsed === 'object' && 'links' in parsed) {
              socials = parsed.links || {};
              socialsPosition = parsed.position === 'bottom' ? 'bottom' : parsed.position === 'both' ? 'both' : 'top';
              primaryEmail = parsed.email || null;
              backgroundConfig = parsed.background || null;
              avatarData = typeof parsed.avatarData === 'string' ? parsed.avatarData : null;
              if (parsed.status) parsedStatus = parsed.status;
              if (parsed.createdAt) createdAt = String(parsed.createdAt);
              if (parsed.subscription) subscription = parsed.subscription;
              integrations = (parsed.integrations && typeof parsed.integrations === 'object') ? parsed.integrations : {};
              appearance = (parsed.appearance && typeof parsed.appearance === 'object') ? parsed.appearance : {};
            } else if (parsed && typeof parsed === 'object') {
              socials = parsed;
            }
          }
        } catch {}
        const resolved = resolveEffectivePlan({
          email: primaryEmail,
          storedPlan: row.plan,
          createdAt,
          subscription,
        });
        return {
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          avatarData,
          avatarType: row.avatar_type || (row.avatar_id ? 'default' : (row.avatar_url ? 'uploaded' : 'default')),
          avatarId: row.avatar_id || null,
          vibeId: row.vibe_id,
          buttonShape: row.button_shape,
          socials,
          socialsPosition,
          primaryEmail,
          plan: resolved.plan,
          isPro: resolved.isPro,
          planSource: resolved.planSource,
          createdAt,
          subscription,
          status: parsedStatus,
          hideFooter: Boolean(row.hide_footer),
          hideFromSearch: Boolean(row.hide_from_search),
          background: backgroundConfig || (row as any).background || null,
          googleAnalyticsId: integrations.googleAnalyticsId || null,
          metaPixelId: integrations.metaPixelId || null,
          whatsappNumber: integrations.whatsappNumber || null,
          customSeoTitle: integrations.customSeoTitle || null,
          customSeoDescription: integrations.customSeoDescription || null,
          fontSettings: appearance.fontSettings || null,
          buttonColors: appearance.buttonColors || null,
          businessCard: appearance.businessCard || null,
          layoutSettings: appearance.layoutSettings || null,
          appearance: appearance.appearanceV2 || null,
          isPublished: Boolean(row.is_published),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        };
      }
    } catch {
      // Fall through to server store fallback
    }
  }

  const record = readUserRecord(clean);
  const prof = record.profile;
  if (!prof) return null;
  const resolved = resolveEffectivePlan({
    email: prof.primaryEmail,
    storedPlan: prof.plan,
    createdAt: prof.createdAt || prof.claimedAt,
    subscription: prof.subscription,
  });
  return {
    ...prof,
    plan: resolved.plan,
    isPro: resolved.isPro,
    planSource: resolved.planSource,
    createdAt: prof.createdAt || prof.claimedAt || null,
    subscription: prof.subscription || null,
    status: prof.status || (prof.isPublished === false ? 'unpublished' : 'active'),
    avatarType: prof.avatarType || (prof.avatarId ? 'default' : (prof.avatarUrl ? 'uploaded' : 'default')),
    avatarId: prof.avatarId || null,
  };
}

export async function dbSaveBlocks(
  username: string,
  blocks: any[],
  userId?: string,
  primaryEmail?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

  if (userId) {
    const isAuthorized = await dbVerifyOwnership(clean, userId, primaryEmail);
    if (!isAuthorized) {
      return { ok: false, error: 'unauthorized' };
    }
  }

  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      const delReq = new sql.Request(transaction);
      delReq.input('username', sql.NVarChar(64), clean);
      await delReq.query('DELETE FROM iveo_blocks WHERE username = @username');

      for (const b of blocks) {
        const insReq = new sql.Request(transaction);
        insReq.input('id', sql.NVarChar(128), b.id || `b_${Date.now()}`);
        insReq.input('userId', sql.NVarChar(128), b.userId || 'owner');
        insReq.input('username', sql.NVarChar(64), clean);
        insReq.input('kind', sql.NVarChar(32), b.kind || 'link');
        insReq.input('title', sql.NVarChar(256), b.title || '');
        insReq.input('url', sql.NVarChar(2048), b.url || null);
        insReq.input('icon', sql.NVarChar(64), b.icon || null);
        insReq.input('thumbnailPath', sql.NVarChar(512), b.thumbnailPath || null);
        insReq.input('thumbnailUrl', sql.NVarChar(2048), b.thumbnailUrl || null);
        insReq.input('layout', sql.NVarChar(32), b.layout || 'classic');
        insReq.input('embedProvider', sql.NVarChar(32), b.embedProvider || null);
        const extraPayload = {
          embedMeta: b.embedMeta || null,
          signup: b.signup || null,
          tipJar: b.tipJar || null,
          coffee: b.coffee || null,
          faq: b.faq || null,
          vcard: b.vcard || null,
          animation: b.animation || null,
          badge: b.badge || null,
          youtube: b.youtube || null,
          product: b.product || null,
          booking: b.booking || null,
          countdown: b.countdown || null,
          promo: b.promo || null,
          location: b.location || null,
          download: b.download || null,
          bluesky: b.bluesky || null,
        };
        insReq.input('signupJson', sql.NVarChar(sql.MAX), JSON.stringify(extraPayload));
        insReq.input('isProtected', sql.Bit, b.isProtected ? 1 : 0);
        insReq.input('startAt', sql.NVarChar(64), b.startAt || null);
        insReq.input('endAt', sql.NVarChar(64), b.endAt || null);
        insReq.input('isActive', sql.Bit, b.isActive !== false ? 1 : 0);
        insReq.input('isArchived', sql.Bit, b.isArchived ? 1 : 0);
        insReq.input('position', sql.Int, typeof b.position === 'number' ? b.position : 0);

        await insReq.query(`
          INSERT INTO iveo_blocks (
            id, user_id, username, kind, title, url, icon, thumbnail_path, thumbnail_url,
            layout, embed_provider, signup_config_json, is_protected, start_at, end_at,
            is_active, is_archived, position
          ) VALUES (
            @id, @userId, @username, @kind, @title, @url, @icon, @thumbnailPath, @thumbnailUrl,
            @layout, @embedProvider, @signupJson, @isProtected, @startAt, @endAt,
            @isActive, @isArchived, @position
          )
        `);
      }

      const touchReq = new sql.Request(transaction);
      touchReq.input('username', sql.NVarChar(64), clean);
      await touchReq.query('UPDATE iveo_profiles SET updated_at = SYSUTCDATETIME() WHERE username = @username').catch(() => {});

      await transaction.commit();
      await withUserLock(clean, () => {
        const record = readUserRecord(clean);
        const nextIds = new Set(blocks.map((b) => String(b?.id || '')));
        const deleted = new Set((record.deletedBlockIds || []).filter((id) => !nextIds.has(id)));
        for (const prev of record.blocks) {
          const prevId = String(prev?.id || '');
          if (prevId && !nextIds.has(prevId)) deleted.add(prevId);
        }
        record.blocksInitialized = true;
        record.deletedBlockIds = Array.from(deleted).slice(-500);
        record.blocks = blocks.map((b) => ({
          ...b,
          isActive: b.isActive !== false,
          isArchived: Boolean(b.isArchived),
        }));
        if (record.profile) {
          record.profile = { ...record.profile, updatedAt: new Date().toISOString() };
        }
        writeUserRecord(clean, record);
      });
      return { ok: true };
    } catch {
      // Fall through to server store fallback
    }
  }

  return withUserLock(clean, () => {
    const record = readUserRecord(clean);
    const pwKeys = new Set(Object.keys(record.passwords || {}));
    const nextIds = new Set(blocks.map((b) => String(b?.id || '')));
    const deleted = new Set((record.deletedBlockIds || []).filter((id) => !nextIds.has(id)));
    for (const prev of record.blocks) {
      const prevId = String(prev?.id || '');
      if (prevId && !nextIds.has(prevId)) deleted.add(prevId);
    }
    record.blocksInitialized = true;
    record.deletedBlockIds = Array.from(deleted).slice(-500);
    record.blocks = blocks.map((b) => ({
      ...b,
      isProtected: b.isProtected !== undefined ? Boolean(b.isProtected) : pwKeys.has(String(b.id)),
      isActive: b.isActive !== false,
      isArchived: Boolean(b.isArchived),
    }));
    if (record.profile) {
      record.profile = { ...record.profile, updatedAt: new Date().toISOString() };
    }
    writeUserRecord(clean, record);
    return { ok: true };
  });
}

export async function dbReadAppearanceState(username: string): Promise<{
  profile: any | null;
  history: { undoStack: any[]; redoStack: any[]; lastCoalesceKey?: string | null; lastCoalesceAt?: number };
  themes: any[];
}> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const [sqlProf, rec] = await Promise.all([
    dbGetProfile(clean).catch(() => null),
    Promise.resolve(readUserRecord(clean)),
  ]);
  const profile = sqlProf || rec.profile || null;
  return {
    profile,
    history: rec.appearanceHistory || { undoStack: [], redoStack: [] },
    themes: Array.isArray(rec.appearanceThemes) ? rec.appearanceThemes : [],
  };
}

export async function dbWriteAppearanceState<T>(
  username: string,
  updater: (current: {
    profile: any | null;
    history: { undoStack: any[]; redoStack: any[]; lastCoalesceKey?: string | null; lastCoalesceAt?: number };
    themes: any[];
  }) => {
    nextProfile?: any | null;
    nextHistory?: { undoStack: any[]; redoStack: any[]; lastCoalesceKey?: string | null; lastCoalesceAt?: number };
    nextThemes?: any[];
    result: T;
  }
): Promise<T> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  return withUserLock(clean, async () => {
    const rec = readUserRecord(clean);
    const current = {
      profile: rec.profile,
      history: rec.appearanceHistory || { undoStack: [], redoStack: [] },
      themes: Array.isArray(rec.appearanceThemes) ? rec.appearanceThemes : [],
    };
    const out = updater(current);
    if (out.nextProfile !== undefined) {
      rec.profile = out.nextProfile;
    }
    if (out.nextHistory !== undefined) {
      rec.appearanceHistory = out.nextHistory;
    }
    if (out.nextThemes !== undefined) {
      rec.appearanceThemes = out.nextThemes;
    }
    writeUserRecord(clean, rec);
    return out.result;
  });
}

export async function dbGetBlockSyncMeta(username: string): Promise<{
  blocksInitialized: boolean;
  deletedBlockIds: Set<string>;
}> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return { blocksInitialized: false, deletedBlockIds: new Set() };
  const record = readUserRecord(clean);
  return {
    blocksInitialized: Boolean(record.blocksInitialized || (record.deletedBlockIds && record.deletedBlockIds.length > 0)),
    deletedBlockIds: new Set((record.deletedBlockIds || []).map(String)),
  };
}

export async function dbGetBlocks(username: string): Promise<any[]> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const res = await pool
        .request()
        .input('username', sql.NVarChar(64), clean)
        .query('SELECT * FROM iveo_blocks WHERE username = @username ORDER BY position ASC, created_at ASC');

      return res.recordset.map((r) => {
        let embedMeta = null;
        let signup = null;
        let tipJar = null;
        let coffee = null;
        let faq = null;
        let vcard = null;
        let animation = null;
        let badge = null;
        let youtube = null;
        let product = null;
        let booking = null;
        let countdown = null;
        let promo = null;
        let location = null;
        let download = null;
        let bluesky = null;

        try {
          if (r.signup_config_json) {
            const parsed = JSON.parse(r.signup_config_json);
            if (parsed && typeof parsed === 'object') {
              if (
                'embedMeta' in parsed ||
                'signup' in parsed ||
                'tipJar' in parsed ||
                'coffee' in parsed ||
                'faq' in parsed ||
                'vcard' in parsed ||
                'youtube' in parsed ||
                'product' in parsed ||
                'booking' in parsed ||
                'countdown' in parsed ||
                'promo' in parsed ||
                'location' in parsed ||
                'download' in parsed ||
                'bluesky' in parsed
              ) {
                embedMeta = parsed.embedMeta || null;
                signup = parsed.signup || null;
                tipJar = parsed.tipJar || null;
                coffee = parsed.coffee || null;
                faq = parsed.faq || null;
                vcard = parsed.vcard || null;
                animation = parsed.animation || null;
                badge = parsed.badge || null;
                youtube = parsed.youtube || null;
                product = parsed.product || null;
                booking = parsed.booking || null;
                countdown = parsed.countdown || null;
                promo = parsed.promo || null;
                location = parsed.location || null;
                download = parsed.download || null;
                bluesky = parsed.bluesky || null;
              } else {
                signup = parsed;
              }
            }
          }
        } catch {}

        return {
          id: r.id,
          userId: r.user_id,
          kind: r.kind,
          title: r.title,
          url: r.url,
          icon: r.icon,
          thumbnailPath: r.thumbnail_path,
          thumbnailUrl: r.thumbnail_url,
          layout: r.layout,
          embedProvider: r.embed_provider,
          embedMeta,
          signup,
          tipJar,
          coffee,
          faq,
          vcard,
          animation,
          badge,
          youtube,
          product,
          booking,
          countdown,
          promo,
          location,
          download,
          bluesky,
          isProtected: Boolean(r.is_protected),
          startAt: r.start_at,
          endAt: r.end_at,
          isActive: Boolean(r.is_active),
          isArchived: Boolean(r.is_archived),
          position: r.position,
        };
      });
    } catch {
      // Fall through to server store fallback
    }
  }

  const record = readUserRecord(clean);
  const pwKeys = new Set(Object.keys(record.passwords || {}));
  return record.blocks.map((b) =>
    pwKeys.has(String(b.id)) && !b.isProtected ? { ...b, isProtected: true } : b
  );
}

export async function dbSaveContact(contact: {
  id: string;
  userId: string;
  username: string;
  linkId: string;
  email?: string | null;
  phone?: string | null;
  consentText?: string | null;
  source?: string | null;
  formTitle?: string | null;
}): Promise<void> {
  const clean = contact.username.toLowerCase().trim();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req = pool.request();
      req.input('id', sql.NVarChar(128), contact.id);
      req.input('userId', sql.NVarChar(128), contact.userId || 'owner');
      req.input('username', sql.NVarChar(64), clean);
      req.input('linkId', sql.NVarChar(128), contact.linkId);
      req.input('email', sql.NVarChar(256), contact.email || null);
      req.input('phone', sql.NVarChar(64), contact.phone || null);
      req.input('consentText', sql.NVarChar(500), contact.consentText || null);
      req.input('source', sql.NVarChar(64), contact.formTitle || contact.source || null);

      await req.query(`
        INSERT INTO iveo_contacts (id, user_id, username, link_id, email, phone, consent_text, source)
        VALUES (@id, @userId, @username, @linkId, @email, @phone, @consentText, @source)
      `);
      return;
    } catch {
      // Fall through to server store fallback
    }
  }

  await withUserLock(clean, () => {
    const record = readUserRecord(clean);
    record.contacts.unshift({
      ...contact,
      formTitle: contact.formTitle || contact.source || null,
      createdAt: new Date().toISOString(),
    });
    writeUserRecord(clean, record);
  });
}

export async function dbGetContacts(username?: string): Promise<any[]> {
  const clean = username ? username.toLowerCase().trim() : '';
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req = pool.request();
      let query = 'SELECT * FROM iveo_contacts';
      if (clean) {
        req.input('username', sql.NVarChar(64), clean);
        query += ' WHERE username = @username';
      }
      query += ' ORDER BY created_at DESC';
      const res = await req.query(query);

      return res.recordset.map((r) => ({
        id: r.id,
        linkId: r.link_id,
        email: r.email,
        phone: r.phone,
        consentText: r.consent_text,
        source: r.source,
        formTitle: r.source || null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch {
      // Fall through to isolated per-user store
    }
  }

  if (clean) {
    return readUserRecord(clean).contacts;
  }
  const all: any[] = [];
  for (const { record } of listAllUserRecords()) {
    all.push(...record.contacts);
  }
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function dbDeleteContact(username: string | undefined, contactId: string): Promise<void> {
  const clean = username ? username.toLowerCase().trim() : '';
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req = pool.request().input('id', sql.NVarChar(128), contactId);
      let query = 'DELETE FROM iveo_contacts WHERE id = @id';
      if (clean) {
        req.input('username', sql.NVarChar(64), clean);
        query += ' AND username = @username';
      }
      await req.query(query);
      return;
    } catch {
      // Fall through to isolated per-user store
    }
  }

  if (clean) {
    await withUserLock(clean, () => {
      const record = readUserRecord(clean);
      record.contacts = record.contacts.filter((c) => c.id !== contactId);
      writeUserRecord(clean, record);
    });
  } else {
    for (const { username: uname, record } of listAllUserRecords()) {
      const next = record.contacts.filter((c) => c.id !== contactId);
      if (next.length !== record.contacts.length) {
        await withUserLock(uname, () => {
          const fresh = readUserRecord(uname);
          fresh.contacts = fresh.contacts.filter((c) => c.id !== contactId);
          writeUserRecord(uname, fresh);
        });
      }
    }
  }
}

export async function dbDeleteAllContacts(username?: string): Promise<void> {
  const clean = username ? username.toLowerCase().trim() : '';
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req = pool.request();
      let query = 'DELETE FROM iveo_contacts';
      if (clean) {
        req.input('username', sql.NVarChar(64), clean);
        query += ' WHERE username = @username';
      }
      await req.query(query);
      return;
    } catch {
      // Fall through to isolated per-user store
    }
  }

  if (clean) {
    await withUserLock(clean, () => {
      const record = readUserRecord(clean);
      record.contacts = [];
      writeUserRecord(clean, record);
    });
  } else {
    for (const { username: uname } of listAllUserRecords()) {
      await withUserLock(uname, () => {
        const fresh = readUserRecord(uname);
        fresh.contacts = [];
        writeUserRecord(uname, fresh);
      });
    }
  }
}

export async function dbDeleteAccount(
  username: string,
  userId?: string,
  primaryEmail?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const clean = username.toLowerCase().trim();

  if (userId) {
    const isAuthorized = await dbVerifyOwnership(clean, userId, primaryEmail);
    if (!isAuthorized) {
      return { ok: false, error: 'unauthorized' };
    }
  }

  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req1 = pool.request().input('username', sql.NVarChar(64), clean);
      await req1.query('DELETE FROM iveo_profiles WHERE username = @username');

      const req2 = pool.request().input('username', sql.NVarChar(64), clean);
      await req2.query('DELETE FROM iveo_blocks WHERE username = @username');

      const req3 = pool.request().input('username', sql.NVarChar(64), clean);
      await req3.query('DELETE FROM iveo_contacts WHERE username = @username');
    } catch {
      // Fall through to server store fallback
    }
  }

  await withUserLock(clean, () => {
    const userFile = getUserFilePath(clean);
    if (fs.existsSync(userFile)) {
      try { fs.unlinkSync(userFile); } catch {}
    }

    const claims = readClaimsIndex();
    delete claims[clean];
    writeClaimsIndex(claims);

    const userIndex = readUserIndex();
    for (const [uid, uname] of Object.entries(userIndex)) {
      if (uname === clean) {
        delete userIndex[uid];
      }
    }
    writeUserIndex(userIndex);

    const pwIdx = readPasswordsIndex();
    let pwChanged = false;
    for (const [lid, entry] of Object.entries(pwIdx)) {
      if (entry.username === clean) {
        delete pwIdx[lid];
        pwChanged = true;
      }
    }
    if (pwChanged) writePasswordsIndex(pwIdx);
  });

  // Clean up uploaded avatar & uploaded custom background directory
  try {
    const dataDir = getDataDir();
    const avatarDir = path.join(dataDir, 'avatars');
    if (fs.existsSync(avatarDir)) {
      for (const f of fs.readdirSync(avatarDir)) {
        if (f.startsWith(`${clean}.`) || f.startsWith(`${clean}_`)) {
          try { fs.unlinkSync(path.join(avatarDir, f)); } catch {}
        }
      }
    }
    const bgUserDir = path.join(dataDir, 'backgrounds', sanitizeUserFileKey(clean));
    if (fs.existsSync(bgUserDir)) {
      fs.rmSync(bgUserDir, { recursive: true, force: true });
    }
    const cardBannersDir = path.join(dataDir, 'card-banners', sanitizeUserFileKey(clean));
    if (fs.existsSync(cardBannersDir)) {
      fs.rmSync(cardBannersDir, { recursive: true, force: true });
    }
  } catch {}

  return { ok: true };
}

export async function dbSetLinkPassword(
  linkId: string,
  password: string,
  username?: string | null
): Promise<string | null> {
  const cleanUser = username ? username.replace(/^@+/, '').toLowerCase().trim() : null;
  let ownerUsername = cleanUser;

  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .input('password', sql.NVarChar(256), password)
        .query(`
          MERGE iveo_link_passwords AS target
          USING (SELECT @linkId AS link_id) AS source
          ON (target.link_id = source.link_id)
          WHEN MATCHED THEN
            UPDATE SET password_text = @password
          WHEN NOT MATCHED THEN
            INSERT (link_id, password_text) VALUES (@linkId, @password);
        `);
      await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .query('UPDATE iveo_blocks SET is_protected = 1 WHERE id = @linkId')
        .catch(() => {});
    } catch {
      // Continue syncing per-user store as well
    }
  }

  if (!ownerUsername) {
    for (const { username: uname, record } of listAllUserRecords()) {
      if (record.blocks.some((b) => b.id === linkId)) {
        ownerUsername = uname;
        break;
      }
    }
  }

  const pwIdx = readPasswordsIndex();
  pwIdx[linkId] = { password, ...(ownerUsername ? { username: ownerUsername } : {}) };
  writePasswordsIndex(pwIdx);

  if (ownerUsername) {
    await withUserLock(ownerUsername, () => {
      const record = readUserRecord(ownerUsername!);
      record.passwords[linkId] = password;
      record.blocks = record.blocks.map((b) =>
        b.id === linkId ? { ...b, isProtected: true } : b
      );
      writeUserRecord(ownerUsername!, record);
    });
  }

  return ownerUsername;
}

export async function dbClearLinkPassword(
  linkId: string,
  username?: string | null
): Promise<string | null> {
  const cleanUser = username ? username.replace(/^@+/, '').toLowerCase().trim() : null;
  let ownerUsername = cleanUser;

  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .query('DELETE FROM iveo_link_passwords WHERE link_id = @linkId');
      await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .query('UPDATE iveo_blocks SET is_protected = 0 WHERE id = @linkId')
        .catch(() => {});
    } catch {}
  }

  const pwIdx = readPasswordsIndex();
  if (!ownerUsername && pwIdx[linkId]?.username) {
    ownerUsername = pwIdx[linkId].username || null;
  }
  if (!ownerUsername) {
    for (const { username: uname, record } of listAllUserRecords()) {
      if (record.passwords[linkId] !== undefined || record.blocks.some((b) => b.id === linkId)) {
        ownerUsername = uname;
        break;
      }
    }
  }

  delete pwIdx[linkId];
  writePasswordsIndex(pwIdx);

  if (ownerUsername) {
    await withUserLock(ownerUsername, () => {
      const record = readUserRecord(ownerUsername!);
      delete record.passwords[linkId];
      record.blocks = record.blocks.map((b) =>
        b.id === linkId ? { ...b, isProtected: false } : b
      );
      writeUserRecord(ownerUsername!, record);
    });
  }

  return ownerUsername;
}

export async function dbVerifyLinkPassword(
  linkId: string,
  password: string,
  username?: string | null
): Promise<boolean> {
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      const res = await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .input('password', sql.NVarChar(256), password)
        .query('SELECT link_id FROM iveo_link_passwords WHERE link_id = @linkId AND password_text = @password');
      if (res.recordset.length > 0) return true;
    } catch {}
  }

  if (username) {
    const cleanUser = username.replace(/^@+/, '').toLowerCase().trim();
    const record = readUserRecord(cleanUser);
    if (record.passwords[linkId] !== undefined) {
      return record.passwords[linkId] === password;
    }
  }

  const pwIdx = readPasswordsIndex();
  if (pwIdx[linkId]) {
    return pwIdx[linkId].password === password;
  }

  for (const { record } of listAllUserRecords()) {
    if (record.passwords[linkId] !== undefined) {
      return record.passwords[linkId] === password;
    }
  }
  return false;
}

export async function dbFindBlockForUnlock(
  linkId: string,
  username?: string | null
): Promise<{ username: string | null; block: any | null }> {
  const cleanUser = username ? username.replace(/^@+/, '').toLowerCase().trim() : null;
  if (cleanUser) {
    const blocks = await dbGetBlocks(cleanUser).catch(() => []);
    const found = blocks.find((b) => b.id === linkId) || null;
    if (found) return { username: cleanUser, block: found };
  }

  const pwIdx = readPasswordsIndex();
  const indexedOwner = pwIdx[linkId]?.username;
  if (indexedOwner) {
    const blocks = await dbGetBlocks(indexedOwner).catch(() => []);
    const found = blocks.find((b) => b.id === linkId) || null;
    if (found) return { username: indexedOwner, block: found };
  }

  for (const { username: uname, record } of listAllUserRecords()) {
    const found = record.blocks.find((b) => b.id === linkId);
    if (found) return { username: uname, block: found };
  }
  return { username: cleanUser || indexedOwner || null, block: null };
}

export async function dbGetProtectedLinkIds(username: string): Promise<string[]> {
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return [];
  const record = readUserRecord(clean);
  const ids = new Set<string>(Object.keys(record.passwords || {}));
  for (const b of record.blocks) {
    if (b?.isProtected && b?.id) {
      ids.add(String(b.id));
    }
  }
  return Array.from(ids);
}

export async function dbGetRedirectTarget(username: string): Promise<string | null> {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;
  const existing = readUserRecord(clean);
  if (existing.profile) return null;
  const redirects = readRedirectsIndex();
  const rec = redirects[clean];
  if (rec?.to && rec.to !== clean) {
    return rec.to;
  }
  const fbTarget = await Promise.race([
    firebaseGetRedirectTarget(clean).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ]);
  if (fbTarget && fbTarget !== clean) {
    return fbTarget;
  }
  return null;
}

export async function dbListAllProfiles(): Promise<any[]> {
  const byUsername = new Map<string, any>();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const res = await pool.request().query('SELECT * FROM iveo_profiles');
      for (const row of res.recordset) {
        const uname = String(row.username || '').replace(/^@+/, '').toLowerCase().trim();
        if (!uname) continue;
        let parsedStatus = 'active';
        let integrations: Record<string, any> = {};
        let socials: Record<string, string> = {};
        let primaryEmail: string | null = null;
        let backgroundConfig: any = null;
        let createdAt: string | null = row.created_at ? new Date(row.created_at).toISOString() : null;
        let subscription: SubscriptionRecord | null = null;
        try {
          if (row.socials_json) {
            const parsed = JSON.parse(row.socials_json);
            if (parsed && typeof parsed === 'object') {
              socials = parsed.links || {};
              backgroundConfig = parsed.background || null;
              if (parsed.status) parsedStatus = parsed.status;
              if (parsed.email) primaryEmail = parsed.email;
              if (parsed.createdAt) createdAt = String(parsed.createdAt);
              if (parsed.subscription) subscription = parsed.subscription;
              if (parsed.integrations) integrations = parsed.integrations;
            }
          }
        } catch {}
        const resolved = resolveEffectivePlan({
          email: primaryEmail,
          storedPlan: row.plan,
          createdAt,
          subscription,
        });
        byUsername.set(uname, {
          userId: row.user_id,
          username: uname,
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          vibeId: row.vibe_id,
          socials,
          primaryEmail,
          background: backgroundConfig,
          plan: resolved.plan,
          isPro: resolved.isPro,
          planSource: resolved.planSource,
          createdAt,
          subscription,
          status: parsedStatus,
          hideFromSearch: Boolean(row.hide_from_search),
          isPublished: Boolean(row.is_published),
          customSeoTitle: integrations.customSeoTitle || null,
          customSeoDescription: integrations.customSeoDescription || null,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        });
      }
    } catch {}
  }

  for (const { username: uname, record } of listAllUserRecords()) {
    const prof = record.profile;
    if (!prof || !uname) continue;
    if (!byUsername.has(uname)) {
      const resolved = resolveEffectivePlan({
        email: prof.primaryEmail,
        storedPlan: prof.plan,
        createdAt: prof.createdAt || prof.claimedAt,
        subscription: prof.subscription,
      });
      byUsername.set(uname, {
        ...prof,
        username: uname,
        plan: resolved.plan,
        isPro: resolved.isPro,
        planSource: resolved.planSource,
        createdAt: prof.createdAt || prof.claimedAt || null,
        status: prof.status || (prof.isPublished === false ? 'unpublished' : 'active'),
        isPublished: prof.isPublished !== false,
      });
    }
  }

  return Array.from(byUsername.values());
}

function normalizeStoredDevice(raw: string | null | undefined): 'mobile' | 'tablet' | 'desktop' | 'other' {
  const s = String(raw || '').trim();
  if (!s) return 'desktop';
  const lower = s.toLowerCase();
  if (lower === 'mobile' || lower === 'phone') return 'mobile';
  if (lower === 'tablet' || lower === 'ipad') return 'tablet';
  if (lower === 'desktop' || lower === 'pc' || lower === 'laptop') return 'desktop';
  const uaDetected = detectDevice(s);
  if (uaDetected !== 'other') return uaDetected;
  return lower === 'other' ? 'other' : 'desktop';
}

function normalizeStoredSource(raw: string | null | undefined): string {
  const normalized = normalizeAnalyticsSource(raw, 'iveo.site');
  return normalized === '' ? 'direct' : normalized;
}

export async function dbRecordAnalyticsEvent(event: {
  id?: string;
  username: string;
  eventType: 'page_view' | 'link_click';
  blockId?: string | null;
  country?: string | null;
  referrer?: string | null;
  device?: string | null;
  createdAt?: string;
}): Promise<void> {
  const clean = (event.username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return;

  const id = event.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const country = String(event.country || 'Unknown').trim() || 'Unknown';
  const referrer = normalizeStoredSource(event.referrer);
  const device = normalizeStoredDevice(event.device);
  const createdAt = event.createdAt || new Date().toISOString();

  let savedToSql = false;
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      await pool
        .request()
        .input('id', sql.NVarChar(128), id)
        .input('username', sql.NVarChar(64), clean)
        .input('eventType', sql.NVarChar(32), event.eventType)
        .input('blockId', sql.NVarChar(128), event.blockId || null)
        .input('country', sql.NVarChar(16), country)
        .input('referrer', sql.NVarChar(256), referrer)
        .input('device', sql.NVarChar(32), device)
        .query(`
          INSERT INTO iveo_analytics_events (id, username, event_type, block_id, country, referrer, device)
          VALUES (@id, @username, @eventType, @blockId, @country, @referrer, @device)
        `);
      savedToSql = true;
    } catch {}
  }

  if (!savedToSql) {
    await withUserLock(clean, () => {
      const record = readUserRecord(clean);
      record.analytics.push({
        id,
        username: clean,
        eventType: event.eventType,
        blockId: event.blockId || null,
        country,
        referrer,
        device,
        createdAt,
      });
      if (record.analytics.length > 10000) {
        record.analytics = record.analytics.slice(-10000);
      }
      writeUserRecord(clean, record);
    });
  }

  // Persist to Firestore as well so analytics survive cold starts & mobile/cross-instance traffic
  await Promise.race([
    firebaseRecordAnalyticsEvent({
      id,
      username: clean,
      eventType: event.eventType,
      blockId: event.blockId || null,
      country,
      referrer,
      device,
      createdAt,
    }).catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

export async function dbGetAnalytics(
  username: string,
  fromDate: Date,
  toDate: Date,
  _isPro: boolean
): Promise<any> {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;

  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();
  const fromDayStr = fromDate.toISOString().slice(0, 10);
  const toDayStr = toDate.toISOString().slice(0, 10);
  // Pad backend query range by +/- 14h to account for client timezone offsets without dropping today's events
  const queryFromDate = new Date(fromMs - 14 * 60 * 60 * 1000);
  const queryToDate = new Date(toMs + 14 * 60 * 60 * 1000);

  const pool = await getAzureSqlPool();
  const sqlEventsPromise: Promise<any[]> = pool
    ? pool
        .request()
        .input('username', sql.NVarChar(64), clean)
        .input('from', sql.DateTime2, queryFromDate)
        .input('to', sql.DateTime2, queryToDate)
        .query(`
          SELECT id, event_type, block_id, country, referrer, device, created_at
          FROM iveo_analytics_events
          WHERE username = @username AND created_at >= @from AND created_at <= @to
        `)
        .then((res) =>
          res.recordset.map((r) => ({
            id: r.id || undefined,
            eventType: r.event_type,
            blockId: r.block_id,
            country: r.country || 'Unknown',
            referrer: r.referrer || 'direct',
            device: r.device || 'desktop',
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          }))
        )
        .catch(() => [])
    : Promise.resolve([]);

  const fbEventsPromise: Promise<any[]> = Promise.race([
    firebaseGetAnalyticsEvents(clean, queryFromDate, queryToDate).catch(() => []),
    new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 4000)),
  ]);

  const localList = readUserRecord(clean).analytics.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    const evDay = new Date(t).toISOString().slice(0, 10);
    return evDay >= fromDayStr && evDay <= toDayStr;
  });

  const [sqlEvents, fbEvents] = await Promise.all([sqlEventsPromise, fbEventsPromise]);

  // Merge and deduplicate across SQL, local per-user store, and Firestore
  const deduped = new Map<string, any>();
  for (const ev of [...sqlEvents, ...localList, ...fbEvents]) {
    const ts = new Date(ev.createdAt || '').getTime();
    if (Number.isNaN(ts)) continue;
    const evDay = new Date(ts).toISOString().slice(0, 10);
    if (evDay < fromDayStr || evDay > toDayStr) continue;
    const normRef = normalizeStoredSource(ev.referrer);
    const normDev = normalizeStoredDevice(ev.device);
    const key = ev.id
      ? `id:${ev.id}`
      : `cmp:${ev.eventType}|${ev.blockId || ''}|${String(ev.createdAt || '').slice(0, 19)}|${normRef}|${normDev}`;
    if (!deduped.has(key)) {
      deduped.set(key, {
        ...ev,
        referrer: normRef,
        device: normDev,
      });
    }
  }
  const events = Array.from(deduped.values());

  let views = 0;
  let clicks = 0;
  const byDayMap = new Map<string, { views: number; clicks: number }>();
  const linkClickMap = new Map<string, number>();
  const refMap = new Map<string, { views: number; clicks: number }>();
  const countryMap = new Map<string, { views: number; clicks: number }>();
  const deviceMap = new Map<string, { views: number; clicks: number }>();

  for (const ev of events) {
    const day = new Date(ev.createdAt || Date.now()).toISOString().slice(0, 10);
    const dayEntry = byDayMap.get(day) || { views: 0, clicks: 0 };
    const refKey = normalizeStoredSource(ev.referrer);
    const countryKey = String(ev.country || 'Unknown').trim() || 'Unknown';
    const deviceKey = normalizeStoredDevice(ev.device);

    const refStats = refMap.get(refKey) || { views: 0, clicks: 0 };
    const countryStats = countryMap.get(countryKey) || { views: 0, clicks: 0 };
    const deviceStats = deviceMap.get(deviceKey) || { views: 0, clicks: 0 };

    if (ev.eventType === 'page_view') {
      views += 1;
      dayEntry.views += 1;
      refStats.views += 1;
      countryStats.views += 1;
      deviceStats.views += 1;
    } else if (ev.eventType === 'link_click') {
      clicks += 1;
      dayEntry.clicks += 1;
      refStats.clicks += 1;
      countryStats.clicks += 1;
      deviceStats.clicks += 1;
      if (ev.blockId) {
        linkClickMap.set(ev.blockId, (linkClickMap.get(ev.blockId) || 0) + 1);
      }
    }

    refMap.set(refKey, refStats);
    countryMap.set(countryKey, countryStats);
    deviceMap.set(deviceKey, deviceStats);
    byDayMap.set(day, dayEntry);
  }

  const byDay: { date: string; views: number; clicks: number }[] = [];
  const cursor = new Date(fromDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const endCursor = new Date(toDate);
  endCursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= endCursor && byDay.length < 366) {
    const dStr = cursor.toISOString().slice(0, 10);
    const dData = byDayMap.get(dStr) || { views: 0, clicks: 0 };
    byDay.push({ date: dStr, views: dData.views, clicks: dData.clicks });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const [localBlocks, fbBlocks] = await Promise.all([
    dbGetBlocks(clean).catch(() => []),
    Promise.race([
      firebaseGetBlocks(clean).catch(() => []),
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500)),
    ]),
  ]);
  const titleById = new Map<string, string>();
  [...fbBlocks, ...localBlocks].forEach((b: any) => {
    if (b?.id) titleById.set(b.id, b.title || b.kind || 'Link');
  });

  const resolveLinkTitle = (blockId: string) => {
    if (titleById.has(blockId)) return titleById.get(blockId)!;
    if (blockId.startsWith('social:')) {
      const plat = blockId.slice('social:'.length);
      return `${plat.charAt(0).toUpperCase()}${plat.slice(1)} icon`;
    }
    if (blockId === 'whatsapp') return 'WhatsApp chat';
    return 'Link';
  };

  const ctr = views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0;

  return {
    views,
    clicks,
    ctr,
    by_day: byDay,
    top_links: Array.from(linkClickMap.entries())
      .map(([block_id, c]) => ({
        block_id,
        title: resolveLinkTitle(block_id),
        clicks: c,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 8),
    referrers: Array.from(refMap.entries())
      .map(([referrer, s]) => ({ referrer, views: s.views, clicks: s.clicks }))
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks)),
    countries: Array.from(countryMap.entries())
      .map(([country, s]) => ({ country, views: s.views, clicks: s.clicks }))
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks)),
    devices: Array.from(deviceMap.entries())
      .map(([device, s]) => ({ device, views: s.views, clicks: s.clicks }))
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks)),
    isCapped: false,
  };
}


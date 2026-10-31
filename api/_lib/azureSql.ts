import sql from 'mssql';
import { ClientSecretCredential } from '@azure/identity';
import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Acquire Microsoft Entra Access Token for Azure SQL
 */
async function getAzureEntraToken(): Promise<string | null> {
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    return null;
  }
  try {
    const credential = new ClientSecretCredential(
      AZURE_TENANT_ID,
      AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET
    );
    const tokenResponse = await credential.getToken('https://database.windows.net/.default');
    return tokenResponse?.token || null;
  } catch (err: any) {
    console.warn('[Azure SQL] Entra token acquisition note:', err?.message || err);
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
          connectTimeout: 15000,
          requestTimeout: 15000,
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
    } catch (err: any) {
      console.warn('[Azure SQL] Entra connection note:', err?.message || err);
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
    } catch (err: any) {
      console.warn('[Azure SQL] Connection string note:', err?.message || err);
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
          connectTimeout: 15000,
          requestTimeout: 15000,
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
    } catch (err: any) {
      console.warn('[Azure SQL] SQL auth note:', err?.message || err);
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
    `;

    await pool.request().query(migrationSql);
    schemaEnsured = true;
  } catch (err: any) {
    console.warn('[Azure SQL] Schema migration note:', err?.message || err);
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
// Server-Side Persistent Store Fallback (Ensures cross-browser functionality)
// ============================================================================
const STORE_PATH = path.resolve(process.cwd(), 'data', 'server_store.json');

interface ServerStoreData {
  profiles: Record<string, any>;
  blocks: Record<string, any[]>;
  contacts: Record<string, any[]>;
  passwords: Record<string, string>;
}

function readServerStore(): ServerStoreData {
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { profiles: {}, blocks: {}, contacts: {}, passwords: {} };
}

function writeServerStore(data: ServerStoreData): void {
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[ServerStore] Write failed:', err);
  }
}

// ============================================================================
// Unified High-Level Operations (Azure SQL with automatic server-store fallback)
// ============================================================================

const OWNER_EMAILS_LIST = [
  'help@iveo.site',
  'arjunjareda2007@gmail.com',
  'help@fanq.me',
  'arjunjared1355@gmail.com',
];

export async function dbSaveProfile(profile: {
  userId: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  vibeId?: string;
  buttonShape?: string | null;
  socials?: Record<string, string>;
  socialsPosition?: 'top' | 'bottom';
  primaryEmail?: string | null;
  plan?: string;
  hideFooter?: boolean;
  hideFromSearch?: boolean;
}): Promise<void> {
  const cleanUsername = profile.username.toLowerCase().trim();
  const pool = await getAzureSqlPool();

  const isOwner =
    (profile.primaryEmail &&
      OWNER_EMAILS_LIST.includes(profile.primaryEmail.toLowerCase().trim())) ||
    profile.plan === 'pro';
  const effectivePlan = isOwner ? 'pro' : profile.plan || 'free';

  const socialsPayload = {
    links: profile.socials || {},
    position: profile.socialsPosition || 'top',
    email: profile.primaryEmail || null,
  };

  if (pool) {
    try {
      const req = pool.request();
      req.input('userId', sql.NVarChar(128), profile.userId || 'owner');
      req.input('username', sql.NVarChar(64), cleanUsername);
      req.input('displayName', sql.NVarChar(128), profile.displayName || cleanUsername);
      req.input('bio', sql.NVarChar(500), profile.bio || '');
      req.input('avatarUrl', sql.NVarChar(2048), profile.avatarUrl || null);
      req.input('vibeId', sql.NVarChar(32), profile.vibeId || 'clean');
      req.input('buttonShape', sql.NVarChar(32), profile.buttonShape || 'rounded');
      req.input('socialsJson', sql.NVarChar(sql.MAX), JSON.stringify(socialsPayload));
      req.input('plan', sql.NVarChar(32), effectivePlan);
      req.input('hideFooter', sql.Bit, profile.hideFooter ? 1 : 0);
      req.input('hideFromSearch', sql.Bit, profile.hideFromSearch ? 1 : 0);

      await req.query(`
        MERGE iveo_profiles AS target
        USING (SELECT @username AS username) AS source
        ON (target.username = source.username)
        WHEN MATCHED THEN
          UPDATE SET
            display_name = @displayName,
            bio = @bio,
            avatar_url = @avatarUrl,
            vibe_id = @vibeId,
            button_shape = @buttonShape,
            socials_json = @socialsJson,
            plan = @plan,
            hide_footer = @hideFooter,
            hide_from_search = @hideFromSearch,
            updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (user_id, username, display_name, bio, avatar_url, vibe_id, button_shape, socials_json, plan, hide_footer, hide_from_search, is_published)
          VALUES (@userId, @username, @displayName, @bio, @avatarUrl, @vibeId, @buttonShape, @socialsJson, @plan, @hideFooter, @hideFromSearch, 1);
      `);
      return;
    } catch (err: any) {
      console.warn('[Azure SQL] dbSaveProfile note:', err?.message || err);
    }
  }

  // Server store fallback
  const store = readServerStore();
  store.profiles[cleanUsername] = {
    ...store.profiles[cleanUsername],
    ...profile,
    plan: effectivePlan,
    socials: profile.socials || {},
    socialsPosition: profile.socialsPosition || 'top',
    username: cleanUsername,
    updatedAt: new Date().toISOString(),
  };
  writeServerStore(store);
}

export async function dbGetProfile(username: string): Promise<any | null> {
  const clean = username.toLowerCase().trim();
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
        let socialsPosition: 'top' | 'bottom' = 'top';
        let primaryEmail: string | null = null;
        try {
          if (row.socials_json) {
            const parsed = JSON.parse(row.socials_json);
            if (parsed && typeof parsed === 'object' && 'links' in parsed) {
              socials = parsed.links || {};
              socialsPosition = parsed.position || 'top';
              primaryEmail = parsed.email || null;
            } else if (parsed && typeof parsed === 'object') {
              socials = parsed;
            }
          }
        } catch {}
        return {
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          vibeId: row.vibe_id,
          buttonShape: row.button_shape,
          socials,
          socialsPosition,
          primaryEmail,
          plan: row.plan,
          hideFooter: Boolean(row.hide_footer),
          hideFromSearch: Boolean(row.hide_from_search),
          isPublished: Boolean(row.is_published),
        };
      }
    } catch (err: any) {
      console.warn('[Azure SQL] dbGetProfile note:', err?.message || err);
    }
  }

  const store = readServerStore();
  return store.profiles[clean] || null;
}

export async function dbSaveBlocks(username: string, blocks: any[]): Promise<void> {
  const clean = username.toLowerCase().trim();
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
          signup: b.signup || null,
          tipJar: b.tipJar || null,
          faq: b.faq || null,
          vcard: b.vcard || null,
          animation: b.animation || null,
          badge: b.badge || null,
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

      await transaction.commit();
      return;
    } catch (err: any) {
      console.warn('[Azure SQL] dbSaveBlocks note:', err?.message || err);
    }
  }

  const store = readServerStore();
  store.blocks[clean] = blocks.map((b) => ({
    ...b,
    isActive: b.isActive !== false,
    isArchived: Boolean(b.isArchived),
  }));
  writeServerStore(store);
}

export async function dbGetBlocks(username: string): Promise<any[]> {
  const clean = username.toLowerCase().trim();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const res = await pool
        .request()
        .input('username', sql.NVarChar(64), clean)
        .query('SELECT * FROM iveo_blocks WHERE username = @username ORDER BY position ASC, created_at ASC');

      return res.recordset.map((r) => {
        let signup = null;
        let tipJar = null;
        let faq = null;
        let vcard = null;
        let animation = null;
        let badge = null;

        try {
          if (r.signup_config_json) {
            const parsed = JSON.parse(r.signup_config_json);
            if (parsed && typeof parsed === 'object') {
              if ('signup' in parsed || 'tipJar' in parsed || 'faq' in parsed || 'vcard' in parsed) {
                signup = parsed.signup || null;
                tipJar = parsed.tipJar || null;
                faq = parsed.faq || null;
                vcard = parsed.vcard || null;
                animation = parsed.animation || null;
                badge = parsed.badge || null;
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
          signup,
          tipJar,
          faq,
          vcard,
          animation,
          badge,
          isProtected: Boolean(r.is_protected),
          startAt: r.start_at,
          endAt: r.end_at,
          isActive: Boolean(r.is_active),
          isArchived: Boolean(r.is_archived),
          position: r.position,
        };
      });
    } catch (err: any) {
      console.warn('[Azure SQL] dbGetBlocks note:', err?.message || err);
    }
  }

  const store = readServerStore();
  return store.blocks[clean] || [];
}

export async function dbSaveContact(contact: {
  id: string;
  userId: string;
  username: string;
  linkId: string;
  email?: string | null;
  phone?: string | null;
  consentText?: string | null;
  source?: string;
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
      req.input('source', sql.NVarChar(64), contact.source || null);

      await req.query(`
        INSERT INTO iveo_contacts (id, user_id, username, link_id, email, phone, consent_text, source)
        VALUES (@id, @userId, @username, @linkId, @email, @phone, @consentText, @source)
      `);
      return;
    } catch (err: any) {
      console.warn('[Azure SQL] dbSaveContact note:', err?.message || err);
    }
  }

  const store = readServerStore();
  if (!store.contacts[clean]) store.contacts[clean] = [];
  store.contacts[clean].unshift({
    ...contact,
    createdAt: new Date().toISOString(),
  });
  writeServerStore(store);
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
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch (err: any) {
      console.warn('[Azure SQL] dbGetContacts note:', err?.message || err);
    }
  }

  const store = readServerStore();
  if (clean) {
    return store.contacts[clean] || [];
  }
  const all: any[] = [];
  for (const list of Object.values(store.contacts)) {
    all.push(...list);
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
    } catch (err: any) {
      console.warn('[Azure SQL] dbDeleteContact note:', err?.message || err);
    }
  }

  const store = readServerStore();
  if (clean && store.contacts[clean]) {
    store.contacts[clean] = store.contacts[clean].filter((c) => c.id !== contactId);
  } else {
    for (const key of Object.keys(store.contacts)) {
      store.contacts[key] = store.contacts[key].filter((c) => c.id !== contactId);
    }
  }
  writeServerStore(store);
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
    } catch (err: any) {
      console.warn('[Azure SQL] dbDeleteAllContacts note:', err?.message || err);
    }
  }

  const store = readServerStore();
  if (clean) {
    store.contacts[clean] = [];
  } else {
    store.contacts = {};
  }
  writeServerStore(store);
}

export async function dbDeleteAccount(username: string): Promise<void> {
  const clean = username.toLowerCase().trim();
  const pool = await getAzureSqlPool();

  if (pool) {
    try {
      const req1 = pool.request().input('username', sql.NVarChar(64), clean);
      await req1.query('DELETE FROM iveo_profiles WHERE username = @username');

      const req2 = pool.request().input('username', sql.NVarChar(64), clean);
      await req2.query('DELETE FROM iveo_blocks WHERE username = @username');

      const req3 = pool.request().input('username', sql.NVarChar(64), clean);
      await req3.query('DELETE FROM iveo_contacts WHERE username = @username');
    } catch (err: any) {
      console.warn('[Azure SQL] dbDeleteAccount note:', err?.message || err);
    }
  }

  const store = readServerStore();
  delete store.profiles[clean];
  delete store.blocks[clean];
  delete store.contacts[clean];
  writeServerStore(store);
}

export async function dbSetLinkPassword(linkId: string, password: string): Promise<void> {
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
      return;
    } catch (err: any) {
      console.warn('[Azure SQL] dbSetLinkPassword note:', err?.message || err);
    }
  }

  const store = readServerStore();
  store.passwords[linkId] = password;
  writeServerStore(store);
}

export async function dbClearLinkPassword(linkId: string): Promise<void> {
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .query('DELETE FROM iveo_link_passwords WHERE link_id = @linkId');
      return;
    } catch (err: any) {
      console.warn('[Azure SQL] dbClearLinkPassword note:', err?.message || err);
    }
  }

  const store = readServerStore();
  delete store.passwords[linkId];
  writeServerStore(store);
}

export async function dbVerifyLinkPassword(linkId: string, password: string): Promise<boolean> {
  const pool = await getAzureSqlPool();
  if (pool) {
    try {
      const res = await pool
        .request()
        .input('linkId', sql.NVarChar(128), linkId)
        .input('password', sql.NVarChar(256), password)
        .query('SELECT link_id FROM iveo_link_passwords WHERE link_id = @linkId AND password_text = @password');
      return res.recordset.length > 0;
    } catch (err: any) {
      console.warn('[Azure SQL] dbVerifyLinkPassword note:', err?.message || err);
    }
  }

  const store = readServerStore();
  return store.passwords[linkId] === password;
}

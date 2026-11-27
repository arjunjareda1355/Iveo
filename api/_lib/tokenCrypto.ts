import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface EncryptedOAuthTokenRecord {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  updatedAt: string;
}

function getDataDir(): string {
  const custom = process.env.IVEO_DATA_DIR?.trim() || process.env.LOCAL_DATA_DIR?.trim();
  return custom ? path.resolve(custom) : path.resolve(process.cwd(), 'data');
}

function getTokenStorePath(): string {
  return path.join(getDataDir(), 'oauth_tokens.json');
}

export function hasTokenEncryptionKey(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY?.trim());
}

function deriveAesKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error('token_encryption_key_missing');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptTokenPayload(payload: unknown): string {
  const key = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptTokenPayload<T = unknown>(encoded: string): T {
  const parts = String(encoded || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('invalid_encrypted_token_format');
  }
  const key = deriveAesKey();
  const iv = Buffer.from(parts[1], 'base64url');
  const authTag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}

function readTokenStore(): Record<string, string> {
  try {
    const file = getTokenStorePath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeTokenStoreAtomic(store: Record<string, string>): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const target = getTokenStorePath();
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, target);
}

/**
 * Persists OAuth tokens strictly encrypted via AES-256-GCM.
 * Refuses to write plaintext tokens if TOKEN_ENCRYPTION_KEY is unset.
 */
export function saveEncryptedOAuthToken(
  ownerKey: string | null | undefined,
  provider: string,
  tokens: {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: number | null;
    scope?: string | null;
  }
): { stored: boolean; encrypted: boolean } {
  const cleanOwner = String(ownerKey || '').trim().toLowerCase();
  const cleanProvider = String(provider || '').trim().toLowerCase();
  if (!cleanOwner || !cleanProvider || !tokens.accessToken) {
    return { stored: false, encrypted: false };
  }
  if (!hasTokenEncryptionKey()) {
    // Fail closed against plaintext token persistence when encryption key is unset
    return { stored: false, encrypted: false };
  }

  const record: EncryptedOAuthTokenRecord = {
    accessToken: String(tokens.accessToken),
    refreshToken: tokens.refreshToken ? String(tokens.refreshToken) : null,
    expiresAt: typeof tokens.expiresAt === 'number' && Number.isFinite(tokens.expiresAt) ? tokens.expiresAt : null,
    scope: tokens.scope ? String(tokens.scope) : null,
    updatedAt: new Date().toISOString(),
  };

  const store = readTokenStore();
  store[`${cleanOwner}:${cleanProvider}`] = encryptTokenPayload(record);
  writeTokenStoreAtomic(store);
  return { stored: true, encrypted: true };
}

export function readEncryptedOAuthToken(
  ownerKey: string | null | undefined,
  provider: string
): EncryptedOAuthTokenRecord | null {
  const cleanOwner = String(ownerKey || '').trim().toLowerCase();
  const cleanProvider = String(provider || '').trim().toLowerCase();
  if (!cleanOwner || !cleanProvider || !hasTokenEncryptionKey()) return null;

  const store = readTokenStore();
  const encrypted = store[`${cleanOwner}:${cleanProvider}`];
  if (!encrypted) return null;
  try {
    return decryptTokenPayload<EncryptedOAuthTokenRecord>(encrypted);
  } catch {
    return null;
  }
}

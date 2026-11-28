import {
  Block,
  BlockKind,
  BlockLayout,
  EmbedMetaData,
  EmbedProvider,
  SignupConfig,
  LinkAnimation,
  TipJarConfig,
  FaqConfig,
  VCardConfig,
  CoffeeData,
  YouTubeData,
  ProductConfig,
  BookingConfig,
  CountdownConfig,
  PromoConfig,
  LocationConfig,
  DownloadConfig,
  BlueskyConfig,
} from './types';
import { storagePublicUrl } from './storageApi';
import { apiFetch } from '../lib/apiFetch';
import { buildAuthHeaders } from '../lib/clerkTokenBridge';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export interface CreateBlockInput {
  kind: BlockKind;
  title: string;
  url?: string | null;
  icon?: string | null;
  thumbnailPath?: string | null;
  thumbnailUrl?: string | null;
  layout?: BlockLayout;
  embedProvider?: EmbedProvider | null;
  embedMeta?: EmbedMetaData | null;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
  youtube?: YouTubeData | null;
  product?: ProductConfig | null;
  booking?: BookingConfig | null;
  countdown?: CountdownConfig | null;
  promo?: PromoConfig | null;
  location?: LocationConfig | null;
  download?: DownloadConfig | null;
  bluesky?: BlueskyConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface UpdateBlockInput {
  title?: string;
  url?: string | null;
  icon?: string | null;
  thumbnailPath?: string | null;
  thumbnailUrl?: string | null;
  layout?: BlockLayout;
  embedProvider?: EmbedProvider | null;
  embedMeta?: EmbedMetaData | null;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
  youtube?: YouTubeData | null;
  product?: ProductConfig | null;
  booking?: BookingConfig | null;
  countdown?: CountdownConfig | null;
  promo?: PromoConfig | null;
  location?: LocationConfig | null;
  download?: DownloadConfig | null;
  bluesky?: BlueskyConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
  isProtected?: boolean;
  position?: number;
}

function getLocalBlocks(userId: string): Block[] {
  const cleanId = (userId || 'owner').trim().toLowerCase();
  try {
    const raw =
      localStorage.getItem(`iveo_blocks_${userId}`) ||
      localStorage.getItem(`iveo_blocks_${cleanId}`) ||
      localStorage.getItem(`ivio_blocks_${userId}`) ||
      localStorage.getItem(`ivio_blocks_${cleanId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export interface BlockAuthContext {
  ownerUserId?: string | null;
  primaryEmail?: string | null;
  isDemo?: boolean;
}

export async function syncBlocksToServer(
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<Block[] | null> {
  if (auth?.isDemo) return blocks;
  const clean = (userId || '').replace(/^@+/, '').trim().toLowerCase();
  if (!clean) return null;

  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
    ...(auth?.ownerUserId ? { 'x-user-id': auth.ownerUserId } : {}),
    ...(auth?.primaryEmail ? { 'x-user-email': auth.primaryEmail } : {}),
  });

  const res = await fetch('/api/blocks', {
    method: 'POST',
    headers,
    keepalive: true,
    body: JSON.stringify({
      username: clean,
      blocks,
      userId: auth?.ownerUserId || undefined,
      primaryEmail: auth?.primaryEmail || undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`sync_failed_${res.status}`);
  }
  const json = await res.json().catch(() => null);
  const serverBlocks = Array.isArray(json?.blocks) ? (json.blocks as Block[]) : null;

  // If userId was still 'owner' while username existed in localStorage, mirror once
  try {
    const currentUsername = localStorage.getItem('iveo_current_username');
    const cleanCurrent = currentUsername ? currentUsername.replace(/^@+/, '').toLowerCase().trim() : '';
    if (cleanCurrent && cleanCurrent !== clean && clean === 'owner') {
      const mirrorRes = await fetch('/api/blocks', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify({
          username: cleanCurrent,
          blocks,
          userId: auth?.ownerUserId || undefined,
          primaryEmail: auth?.primaryEmail || undefined,
        }),
      });
      if (!mirrorRes.ok) {
        throw new Error(`sync_failed_${mirrorRes.status}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('sync_failed_')) {
      throw err;
    }
  }
  return serverBlocks;
}

interface PendingDebouncedSync {
  userId: string;
  blocks: Block[];
  auth?: BlockAuthContext;
  waiters: Array<{ resolve: (blocks: Block[] | null) => void; reject: (err: unknown) => void }>;
}

const blockSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingBlockSyncs = new Map<string, PendingDebouncedSync>();
const blockSyncChains = new Map<string, Promise<void>>();

function persistLocalStorageBlocks(userId: string, blocks: Block[]): void {
  const cleanId = (userId || 'owner').trim().toLowerCase();
  try {
    const serialized = JSON.stringify(blocks);
    localStorage.setItem(`iveo_blocks_${userId}`, serialized);
    if (cleanId !== userId) {
      localStorage.setItem(`iveo_blocks_${cleanId}`, serialized);
    }
    localStorage.removeItem(`ivio_blocks_${userId}`);
    if (cleanId !== userId) {
      localStorage.removeItem(`ivio_blocks_${cleanId}`);
    }
  } catch {}
}

function notifyBlockSync(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  const clean = userId.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return;
  const updatedAt = new Date().toISOString();
  try {
    window.dispatchEvent(new CustomEvent('iveo_profile_sync', { detail: { username: clean, type: 'blocks', updatedAt } }));
  } catch {}
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('iveo_profile_sync');
      ch.postMessage({ username: clean, type: 'blocks', updatedAt });
      ch.close();
    }
  } catch {}
}

function enqueueServerBlockWrite(
  key: string,
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<Block[] | null> {
  const prevChain = blockSyncChains.get(key) || Promise.resolve();
  const nextChain = prevChain
    .catch(() => {})
    .then(async () => {
      const serverBlocks = await syncBlocksToServer(userId, blocks, auth);
      if (serverBlocks) {
        persistLocalStorageBlocks(userId, serverBlocks);
      }
      notifyBlockSync(userId);
      return serverBlocks;
    });
  blockSyncChains.set(key, nextChain.then(() => undefined, () => undefined));
  return nextChain;
}

export async function flushPendingBlockSync(
  userId: string,
  authOverride?: BlockAuthContext
): Promise<void> {
  const key = (userId || 'owner').trim().toLowerCase();
  const timer = blockSyncTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    blockSyncTimers.delete(key);
  }
  const pending = pendingBlockSyncs.get(key);
  if (!pending) return;
  pendingBlockSyncs.delete(key);
  const resolvedAuth = authOverride || pending.auth;
  if (resolvedAuth?.isDemo) {
    notifyBlockSync(pending.userId);
    pending.waiters.forEach((w) => w.resolve(pending.blocks));
    return;
  }
  try {
    const synced = await enqueueServerBlockWrite(key, pending.userId, pending.blocks, resolvedAuth);
    pending.waiters.forEach((w) => w.resolve(synced));
  } catch (err) {
    pending.waiters.forEach((w) => w.reject(err));
    throw err;
  }
}

export async function flushSaveLocalBlocks(
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<Block[] | null> {
  persistLocalStorageBlocks(userId, blocks);
  if (auth?.isDemo) {
    notifyBlockSync(userId);
    return blocks;
  }
  const key = (userId || 'owner').trim().toLowerCase();
  const prevTimer = blockSyncTimers.get(key);
  if (prevTimer) {
    clearTimeout(prevTimer);
    blockSyncTimers.delete(key);
  }
  const prevPending = pendingBlockSyncs.get(key);
  if (prevPending) {
    pendingBlockSyncs.delete(key);
    // Superseded by newer full snapshot flush
    prevPending.waiters.forEach((w) => w.resolve(null));
  }
  return enqueueServerBlockWrite(key, userId, blocks, auth);
}

export async function saveLocalBlocks(
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<Block[] | null> {
  return flushSaveLocalBlocks(userId, blocks, auth);
}

export async function seedStarterLinks(
  userId: string,
  links: Array<{ title: string; url: string }>,
  auth?: BlockAuthContext
): Promise<void> {
  const existing = getLocalBlocks(userId);
  const newBlocks: Block[] = links
    .filter((l) => l.title.trim().length > 0)
    .map((l, i) => ({
      id: crypto.randomUUID(),
      kind: 'link',
      title: l.title.trim(),
      url: l.url.trim() || 'https://iveo.site',
      icon: null,
      thumbnailPath: null,
      thumbnailUrl: null,
      layout: 'classic',
      embedProvider: null,
      startAt: null,
      endAt: null,
      position: existing.length + i,
      isActive: true,
      isArchived: false,
    }));
  const updated = [...existing, ...newBlocks];
  await flushSaveLocalBlocks(userId, updated, auth);
}

export async function listMyBlocks(
  token: string | null,
  userId: string,
  auth?: BlockAuthContext
): Promise<Block[]> {
  const cleanId = (userId || 'owner').trim().toLowerCase();

  if (auth?.isDemo) {
    const local = getLocalBlocks(cleanId);
    return local.map((b) => ({
      ...b,
      thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
    }));
  }

  // 1. Query server database first (Azure SQL / Server store / Firebase fallback)
  try {
    const res = await apiFetch(`/api/blocks?username=${encodeURIComponent(cleanId)}&_t=${Date.now()}`, {
      cache: 'no-store',
      silent: true,
      headers: {
        ...(auth?.ownerUserId ? { 'x-user-id': auth.ownerUserId } : {}),
        ...(auth?.primaryEmail ? { 'x-user-email': auth.primaryEmail } : {}),
      },
    });
    if (res.ok) {
      const data = await res.json();
      const blocksArray = Array.isArray(data) ? data : (Array.isArray(data?.blocks) ? data.blocks : null);
      if (Array.isArray(blocksArray)) {
        persistLocalStorageBlocks(userId, blocksArray);
        return blocksArray.map((b: any) => ({
          ...b,
          thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
        }));
      }
    }
  } catch {
    // Continue to local/Supabase fallback only when server is unreachable
  }

  // 2. Local fallback when server is unreachable
  if (!rawSupabaseUrl) {
    const local = getLocalBlocks(cleanId);
    return local.map((b) => ({
      ...b,
      thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
    }));
  }

  const response = await fetch(
    `${rawSupabaseUrl}/rest/v1/links?user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,kind,title,url,icon,thumbnail_path,layout,embed_provider,signup_config,start_at,end_at,is_active,is_archived,position&order=position.asc,created_at.asc`,
    {
      headers: {
        apikey: anonKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch blocks');
  }

  const data = await response.json();
  return (data || []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    title: row.title || '',
    url: row.url || null,
    icon: row.icon || null,
    thumbnailPath: row.thumbnail_path || null,
    thumbnailUrl: storagePublicUrl(row.thumbnail_path),
    layout: row.layout || 'classic',
    embedProvider: row.embed_provider || null,
    signup:
      row.signup_config && typeof row.signup_config === 'object'
        ? {
            collect: row.signup_config.collect,
            button: row.signup_config.button,
            consent: row.signup_config.consent,
            description: row.signup_config.description || null,
          }
        : null,
    startAt: row.start_at || null,
    endAt: row.end_at || null,
    isActive: row.is_active ?? true,
    isArchived: row.is_archived ?? false,
    position: row.position ?? 0,
  }));
}

export async function createBlockWithSync(
  token: string | null,
  userId: string,
  input: CreateBlockInput,
  auth?: BlockAuthContext,
  currentBlocks?: Block[]
): Promise<{ block: Block; blocks: Block[] | null }> {
  const newBlock: Block = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    url: input.url ?? null,
    icon: input.icon || null,
    thumbnailPath: input.thumbnailPath || null,
    thumbnailUrl: input.thumbnailUrl !== undefined ? input.thumbnailUrl : storagePublicUrl(input.thumbnailPath),
    layout: input.layout || 'classic',
    embedProvider: input.embedProvider || null,
    embedMeta: input.embedMeta || null,
    signup: input.signup || null,
    tipJar: input.tipJar || null,
    faq: input.faq || null,
    vcard: input.vcard || null,
    coffee: input.coffee || null,
    youtube: input.youtube || null,
    product: input.product || null,
    booking: input.booking || null,
    countdown: input.countdown || null,
    promo: input.promo || null,
    location: input.location || null,
    download: input.download || null,
    bluesky: input.bluesky || null,
    animation: input.animation || null,
    badge: input.badge || null,
    startAt: input.startAt || null,
    endAt: input.endAt || null,
    isActive: input.isActive ?? true,
    isArchived: false,
    position: input.position ?? 0,
  };

  if (!rawSupabaseUrl) {
    const list = Array.isArray(currentBlocks) ? currentBlocks : getLocalBlocks(userId);
    const updated = [{ ...newBlock, position: 0 }, ...list.filter((b) => b.id !== newBlock.id)].map(
      (item, idx) => ({
        ...item,
        position: idx,
      })
    );
    const syncedBlocks = await flushSaveLocalBlocks(userId, updated, auth);
    return { block: { ...newBlock, position: 0 }, blocks: syncedBlocks };
  }

  const created = await createBlockSupabase(token, userId, input);
  return { block: created, blocks: null };
}

export async function createBlock(
  token: string | null,
  userId: string,
  input: CreateBlockInput,
  auth?: BlockAuthContext,
  currentBlocks?: Block[]
): Promise<Block> {
  if (!rawSupabaseUrl) {
    const { block } = await createBlockWithSync(token, userId, input, auth, currentBlocks);
    return block;
  }
  return createBlockSupabase(token, userId, input);
}

async function createBlockSupabase(
  token: string | null,
  userId: string,
  input: CreateBlockInput
): Promise<Block> {

  const payload: any = {
    user_id: userId,
    kind: input.kind,
    title: input.title,
    url: input.url || null,
    icon: input.icon || null,
    thumbnail_path: input.thumbnailPath || null,
    layout: input.layout || 'classic',
    embed_provider: input.embedProvider || null,
    signup_config: input.signup || null,
    start_at: input.startAt || null,
    end_at: input.endAt || null,
    position: input.position ?? 0,
    is_active: input.isActive ?? true,
  };

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/links`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('pro_required')) {
      throw new Error('pro_required');
    }
    throw new Error('Failed to create block');
  }

  const [row] = await response.json();
  return {
    id: row.id,
    kind: row.kind,
    title: row.title || '',
    url: row.url || null,
    icon: row.icon || null,
    thumbnailPath: row.thumbnail_path || null,
    thumbnailUrl: storagePublicUrl(row.thumbnail_path),
    layout: row.layout || 'classic',
    embedProvider: row.embed_provider || null,
    signup:
      row.signup_config && typeof row.signup_config === 'object'
        ? {
            collect: row.signup_config.collect,
            button: row.signup_config.button,
            consent: row.signup_config.consent,
            description: row.signup_config.description || null,
          }
        : null,
    startAt: row.start_at || null,
    endAt: row.end_at || null,
    isActive: row.is_active ?? true,
    isArchived: row.is_archived ?? false,
    position: row.position ?? 0,
  };
}

export async function updateBlock(
  token: string | null,
  userId: string,
  blockId: string,
  input: UpdateBlockInput,
  auth?: BlockAuthContext,
  currentBlocks?: Block[]
): Promise<Block[] | null> {
  if (!rawSupabaseUrl) {
    const list = Array.isArray(currentBlocks) ? currentBlocks : getLocalBlocks(userId);
    const updated = list.map((b) => (b.id === blockId ? { ...b, ...input } : b));
    return flushSaveLocalBlocks(userId, updated, auth);
  }

  const payload: any = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.url !== undefined) payload.url = input.url;
  if (input.icon !== undefined) payload.icon = input.icon;
  if (input.thumbnailPath !== undefined) payload.thumbnail_path = input.thumbnailPath;
  if (input.layout !== undefined) payload.layout = input.layout;
  if (input.embedProvider !== undefined) payload.embed_provider = input.embedProvider;
  if (input.signup !== undefined) payload.signup_config = input.signup;
  if (input.startAt !== undefined) payload.start_at = input.startAt;
  if (input.endAt !== undefined) payload.end_at = input.endAt;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.isArchived !== undefined) payload.is_archived = input.isArchived;
  if (input.position !== undefined) payload.position = input.position;

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/links?id=eq.${blockId}`, {
    method: 'PATCH',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('pro_required')) {
      throw new Error('pro_required');
    }
    throw new Error('Failed to update block');
  }
  return null;
}

export async function setBlockImage(
  token: string | null,
  userId: string,
  blockId: string,
  input: { thumbnailPath: string | null; layout: BlockLayout; thumbnailUrl?: string | null },
  auth?: BlockAuthContext,
  currentBlocks?: Block[]
): Promise<Block[] | null> {
  return updateBlock(
    token,
    userId,
    blockId,
    {
      thumbnailPath: input.thumbnailPath,
      thumbnailUrl: input.thumbnailUrl,
      layout: input.layout,
    },
    auth,
    currentBlocks
  );
}

export async function deleteBlock(
  token: string | null,
  userId: string,
  blockId: string,
  auth?: BlockAuthContext,
  currentBlocks?: Block[]
): Promise<Block[] | null> {
  if (!rawSupabaseUrl) {
    const list = Array.isArray(currentBlocks) ? currentBlocks : getLocalBlocks(userId);
    return flushSaveLocalBlocks(
      userId,
      list.filter((b) => b.id !== blockId),
      auth
    );
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/links?id=eq.${blockId}`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete block');
  }
  return null;
}

export async function saveOrderedBlocks(
  token: string | null,
  userId: string,
  orderedBlocks: Block[],
  auth?: BlockAuthContext
): Promise<Block[] | null> {
  if (!rawSupabaseUrl) {
    return flushSaveLocalBlocks(userId, orderedBlocks, auth);
  }

  for (let i = 0; i < orderedBlocks.length; i++) {
    await updateBlock(token, userId, orderedBlocks[i].id, { position: i }, auth);
  }
  return null;
}

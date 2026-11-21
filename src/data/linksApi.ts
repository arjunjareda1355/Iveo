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

// Memory / LocalStorage store fallback for when Supabase credentials are not connected
function getLocalBlocks(userId: string): Block[] {
  try {
    const raw =
      localStorage.getItem(`iveo_blocks_${userId}`) ||
      localStorage.getItem(`ivio_blocks_${userId}`);
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
): Promise<void> {
  if (auth?.isDemo) return;
  const clean = (userId || '').trim().toLowerCase();
  if (!clean) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth?.ownerUserId) headers['x-user-id'] = auth.ownerUserId;
  if (auth?.primaryEmail) headers['x-user-email'] = auth.primaryEmail;

  try {
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

    // If current username in localStorage is different from userId (e.g. user set their handle), sync for that handle as well
    const currentUsername = localStorage.getItem('iveo_current_username');
    if (currentUsername && currentUsername.toLowerCase() !== clean && clean === 'owner') {
      await fetch('/api/blocks', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify({
          username: currentUsername.toLowerCase(),
          blocks,
          userId: auth?.ownerUserId || undefined,
          primaryEmail: auth?.primaryEmail || undefined,
        }),
      });
    }
  } catch (err) {
    throw err;
  }
}

const blockSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

export async function flushSaveLocalBlocks(
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<void> {
  persistLocalStorageBlocks(userId, blocks);
  if (auth?.isDemo) return;
  const key = (userId || 'owner').trim().toLowerCase();
  const prevTimer = blockSyncTimers.get(key);
  if (prevTimer) {
    clearTimeout(prevTimer);
    blockSyncTimers.delete(key);
  }
  const prevChain = blockSyncChains.get(key) || Promise.resolve();
  const nextChain = prevChain
    .catch(() => {})
    .then(() => syncBlocksToServer(userId, blocks, auth));
  blockSyncChains.set(key, nextChain.catch(() => {}));
  await nextChain;
}

export async function saveLocalBlocks(
  userId: string,
  blocks: Block[],
  auth?: BlockAuthContext
): Promise<void> {
  persistLocalStorageBlocks(userId, blocks);
  if (auth?.isDemo) return;
  const key = (userId || 'owner').trim().toLowerCase();
  const prevTimer = blockSyncTimers.get(key);
  if (prevTimer) clearTimeout(prevTimer);
  blockSyncTimers.set(
    key,
    setTimeout(() => {
      blockSyncTimers.delete(key);
      const latestBlocks = getLocalBlocks(userId);
      const prevChain = blockSyncChains.get(key) || Promise.resolve();
      const nextChain = prevChain
        .catch(() => {})
        .then(() => syncBlocksToServer(userId, latestBlocks, auth))
        .catch(() => {});
      blockSyncChains.set(key, nextChain);
    }, 80)
  );
}

export async function seedStarterLinks(
  userId: string,
  links: Array<{ title: string; url: string }>
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
  await saveLocalBlocks(userId, updated);
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
      cache: 'no-cache',
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
        try {
          localStorage.setItem(`iveo_blocks_${cleanId}`, JSON.stringify(blocksArray));
          localStorage.setItem(`iveo_blocks_${userId}`, JSON.stringify(blocksArray));
        } catch {}
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

    if (local.length > 0) {
      syncBlocksToServer(cleanId, local, auth).catch(() => {});
    }

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

export async function createBlock(
  token: string | null,
  userId: string,
  input: CreateBlockInput,
  auth?: BlockAuthContext
): Promise<Block> {
  const newBlock: Block = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    url: input.url || null,
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
    const list = getLocalBlocks(userId);
    const updated = [newBlock, ...list];
    await saveLocalBlocks(userId, updated, auth);
    return newBlock;
  }

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
  auth?: BlockAuthContext
): Promise<void> {
  if (!rawSupabaseUrl) {
    const list = getLocalBlocks(userId);
    const updated = list.map((b) => (b.id === blockId ? { ...b, ...input } : b));
    if (input.isArchived !== undefined) {
      await flushSaveLocalBlocks(userId, updated, auth);
    } else {
      await saveLocalBlocks(userId, updated, auth);
    }
    return;
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
}

export async function setBlockImage(
  token: string | null,
  userId: string,
  blockId: string,
  input: { thumbnailPath: string | null; layout: BlockLayout; thumbnailUrl?: string | null },
  auth?: BlockAuthContext
): Promise<void> {
  await updateBlock(token, userId, blockId, {
    thumbnailPath: input.thumbnailPath,
    thumbnailUrl: input.thumbnailUrl,
    layout: input.layout,
  }, auth);
}

export async function deleteBlock(
  token: string | null,
  userId: string,
  blockId: string,
  auth?: BlockAuthContext
): Promise<void> {
  if (!rawSupabaseUrl) {
    const list = getLocalBlocks(userId);
    await flushSaveLocalBlocks(
      userId,
      list.filter((b) => b.id !== blockId),
      auth
    );
    return;
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
}

export async function saveOrderedBlocks(
  token: string | null,
  userId: string,
  orderedBlocks: Block[],
  auth?: BlockAuthContext
): Promise<void> {
  if (!rawSupabaseUrl) {
    await saveLocalBlocks(userId, orderedBlocks, auth);
    return;
  }

  for (let i = 0; i < orderedBlocks.length; i++) {
    await updateBlock(token, userId, orderedBlocks[i].id, { position: i }, auth);
  }
}

import { Block, BlockKind, BlockLayout, EmbedProvider, SignupConfig, LinkAnimation, TipJarConfig, FaqConfig, VCardConfig } from './types';
import { storagePublicUrl } from './storageApi';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export interface CreateBlockInput {
  kind: BlockKind;
  title: string;
  url?: string | null;
  icon?: string | null;
  thumbnailPath?: string | null;
  layout?: BlockLayout;
  embedProvider?: EmbedProvider | null;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
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
  layout?: BlockLayout;
  embedProvider?: EmbedProvider | null;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
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

export async function syncBlocksToServer(userId: string, blocks: Block[]): Promise<void> {
  const clean = (userId || '').trim().toLowerCase();
  if (!clean) return;

  try {
    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: clean, blocks }),
    });

    // If current username in localStorage is different from userId (e.g. user set their handle), sync for that handle as well
    const currentUsername = localStorage.getItem('iveo_current_username');
    if (currentUsername && currentUsername.toLowerCase() !== clean && clean === 'owner') {
      await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername.toLowerCase(), blocks }),
      });
    }
  } catch {
    // Suppress network errors
  }
}

export function saveLocalBlocks(userId: string, blocks: Block[]) {
  try {
    localStorage.setItem(`iveo_blocks_${userId}`, JSON.stringify(blocks));
  } catch {}
  syncBlocksToServer(userId, blocks);
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
  saveLocalBlocks(userId, updated);
}

export async function listMyBlocks(token: string | null, userId: string): Promise<Block[]> {
  const cleanId = (userId || 'owner').trim().toLowerCase();

  // 1. Query server database first (Azure SQL / Server store)
  try {
    const res = await fetch(`/api/blocks?username=${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      const blocksArray = Array.isArray(data) ? data : (Array.isArray(data?.blocks) ? data.blocks : null);
      if (blocksArray && blocksArray.length > 0) {
        try {
          localStorage.setItem(`iveo_blocks_${cleanId}`, JSON.stringify(blocksArray));
        } catch {}
        return blocksArray.map((b: any) => ({
          ...b,
          thumbnailUrl: b.thumbnailUrl || storagePublicUrl(b.thumbnailPath),
        }));
      }
    }
  } catch {
    // Continue
  }

  // 2. Local fallback
  if (!rawSupabaseUrl) {
    let local = getLocalBlocks(cleanId);
    // If cleanId has no local blocks, check if there are blocks stored under 'owner'
    if (local.length === 0 && cleanId !== 'owner') {
      const ownerBlocks = getLocalBlocks('owner');
      if (ownerBlocks.length > 0) {
        local = ownerBlocks;
        saveLocalBlocks(cleanId, local);
      }
    }

    if (local.length > 0) {
      // Ensure server is seeded with local blocks in background
      syncBlocksToServer(cleanId, local);
    }

    return local.map((b) => ({
      ...b,
      thumbnailUrl: storagePublicUrl(b.thumbnailPath),
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
  input: CreateBlockInput
): Promise<Block> {
  const newBlock: Block = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    url: input.url || null,
    icon: input.icon || null,
    thumbnailPath: input.thumbnailPath || null,
    thumbnailUrl: storagePublicUrl(input.thumbnailPath),
    layout: input.layout || 'classic',
    embedProvider: input.embedProvider || null,
    signup: input.signup || null,
    tipJar: input.tipJar || null,
    faq: input.faq || null,
    vcard: input.vcard || null,
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
    saveLocalBlocks(userId, updated);
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
  input: UpdateBlockInput
): Promise<void> {
  if (!rawSupabaseUrl) {
    const list = getLocalBlocks(userId);
    const updated = list.map((b) => (b.id === blockId ? { ...b, ...input } : b));
    saveLocalBlocks(userId, updated);
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
  input: { thumbnailPath: string | null; layout: BlockLayout; thumbnailUrl?: string | null }
): Promise<void> {
  await updateBlock(token, userId, blockId, {
    thumbnailPath: input.thumbnailPath,
    thumbnailUrl: input.thumbnailUrl,
    layout: input.layout,
  });
}

export async function deleteBlock(
  token: string | null,
  userId: string,
  blockId: string
): Promise<void> {
  if (!rawSupabaseUrl) {
    const list = getLocalBlocks(userId);
    saveLocalBlocks(
      userId,
      list.filter((b) => b.id !== blockId)
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

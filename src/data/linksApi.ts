import { Block, BlockKind, BlockLayout, EmbedProvider } from './types';
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

function saveLocalBlocks(userId: string, blocks: Block[]) {
  try {
    localStorage.setItem(`iveo_blocks_${userId}`, JSON.stringify(blocks));
  } catch {}
}

export async function listMyBlocks(token: string | null, userId: string): Promise<Block[]> {
  if (!rawSupabaseUrl) {
    const local = getLocalBlocks(userId);
    return local.map((b) => ({
      ...b,
      thumbnailUrl: storagePublicUrl(b.thumbnailPath),
    }));
  }

  const response = await fetch(
    `${rawSupabaseUrl}/rest/v1/links?user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,kind,title,url,icon,thumbnail_path,layout,embed_provider,start_at,end_at,is_active,is_archived,position&order=position.asc,created_at.asc`,
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
  input: { thumbnailPath: string | null; layout: BlockLayout }
): Promise<void> {
  await updateBlock(token, userId, blockId, {
    thumbnailPath: input.thumbnailPath,
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

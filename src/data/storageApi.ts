const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');

// Local memory storage fallback for development when Supabase storage is not connected
const localBlobMap = new Map<string, string>();

export function storagePublicUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  if (localBlobMap.has(path)) {
    return localBlobMap.get(path)!;
  }
  if (rawSupabaseUrl) {
    return `${rawSupabaseUrl}/storage/v1/object/public/link-images/${path}`;
  }
  return path;
}

export type StorageErrorCode =
  | 'too_large'
  | 'unsupported'
  | 'not_authenticated'
  | 'network'
  | 'unknown';

export async function uploadLinkImage(
  tokenOrClient: string | null | undefined,
  userId: string,
  blob: Blob
): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${fileName}`;

  if (!rawSupabaseUrl) {
    // Local fallback: generate object URL
    const objUrl = URL.createObjectURL(blob);
    localBlobMap.set(path, objUrl);
    return path;
  }

  try {
    const url = `${rawSupabaseUrl}/storage/v1/object/link-images/${path}`;
    const headers: Record<string, string> = {
      'Content-Type': blob.type,
      'Cache-Control': '31536000',
    };

    if (tokenOrClient) {
      headers['Authorization'] = `Bearer ${tokenOrClient}`;
    }

    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (anonKey) {
      headers['apikey'] = anonKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: blob,
    });

    if (response.status === 413) {
      throw new Error('too_large');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('not_authenticated');
    }
    if (!response.ok) {
      const text = await response.text();
      if (text.includes('mime') || text.includes('unsupported')) {
        throw new Error('unsupported');
      }
      throw new Error('unknown');
    }

    return path;
  } catch (err: unknown) {
    if (err instanceof Error && ['too_large', 'unsupported', 'not_authenticated'].includes(err.message)) {
      throw err;
    }
    // Network or other error
    throw new Error('network');
  }
}

export async function removeLinkImage(
  tokenOrClient: string | null | undefined,
  path: string | null | undefined
): Promise<boolean> {
  if (!path) return true;

  if (localBlobMap.has(path)) {
    const objUrl = localBlobMap.get(path);
    if (objUrl) URL.revokeObjectURL(objUrl);
    localBlobMap.delete(path);
    return true;
  }

  if (!rawSupabaseUrl) {
    return true;
  }

  try {
    const url = `${rawSupabaseUrl}/storage/v1/object/link-images/${path}`;
    const headers: Record<string, string> = {};
    if (tokenOrClient) {
      headers['Authorization'] = `Bearer ${tokenOrClient}`;
    }
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (anonKey) {
      headers['apikey'] = anonKey;
    }

    await fetch(url, {
      method: 'DELETE',
      headers,
    });

    return true;
  } catch {
    // Best effort, never throw
    return false;
  }
}

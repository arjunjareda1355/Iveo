import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseUrl,
  getSupabasePublishableKey,
  getSupabaseSecretKey,
} from './env.js';

let cachedAdminClient: SupabaseClient | null = null;

export async function publicRpc<T = unknown>(
  name: string,
  args: Record<string, unknown>
): Promise<T | null> {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return null;
  }

  try {
    const headers: Record<string, string> = {
      apikey: key,
      'Content-Type': 'application/json',
    };

    if (key.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as T;
    return data;
  } catch {
    // Fail silently on timeout or network error
    return null;
  }
}

export function adminClient(): SupabaseClient | null {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    return null;
  }

  try {
    cachedAdminClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return cachedAdminClient;
  } catch {
    return null;
  }
}

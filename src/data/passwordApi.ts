const rawSupabaseUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '').trim().replace(/\/+$/, '');
const anonKey = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();

/**
 * Set or change link password (Pro, owner only)
 * Never log, store, or transmit the password outside this RPC.
 */
export async function setLinkPassword(
  token: string | null,
  linkId: string,
  password: string
): Promise<void> {
  const cleanPass = password.trim();
  if (cleanPass.length < 4 || cleanPass.length > 64 || cleanPass !== password) {
    throw new Error('invalid_password');
  }

  if (!rawSupabaseUrl) {
    // Local / development fallback
    try {
      localStorage.setItem(`iveo_link_pwd_${linkId}`, cleanPass);
      const set = new Set<string>(JSON.parse(localStorage.getItem('iveo_protected_ids') || '[]'));
      set.add(linkId);
      localStorage.setItem('iveo_protected_ids', JSON.stringify(Array.from(set)));
    } catch {}
    return;
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/set_link_password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      p_link_id: linkId,
      p_password: password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('pro_required')) throw new Error('pro_required');
    if (errorText.includes('invalid_password')) throw new Error('invalid_password');
    if (errorText.includes('not_authenticated')) throw new Error('not_authenticated');
    if (errorText.includes('not_found')) throw new Error('not_found');
    throw new Error('Failed to set link password');
  }

  // Update local cache of protected IDs
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem('iveo_protected_ids') || '[]'));
    set.add(linkId);
    localStorage.setItem('iveo_protected_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Remove link password (Owner only)
 */
export async function clearLinkPassword(
  token: string | null,
  linkId: string
): Promise<void> {
  if (!rawSupabaseUrl) {
    try {
      localStorage.removeItem(`iveo_link_pwd_${linkId}`);
      const set = new Set<string>(JSON.parse(localStorage.getItem('iveo_protected_ids') || '[]'));
      set.delete(linkId);
      localStorage.setItem('iveo_protected_ids', JSON.stringify(Array.from(set)));
    } catch {}
    return;
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/clear_link_password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      p_link_id: linkId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('not_authenticated')) throw new Error('not_authenticated');
    throw new Error('Failed to clear link password');
  }

  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem('iveo_protected_ids') || '[]'));
    set.delete(linkId);
    localStorage.setItem('iveo_protected_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Get protected link IDs for the current owner
 */
export async function getProtectedLinkIds(token: string | null): Promise<string[]> {
  if (!rawSupabaseUrl) {
    try {
      return JSON.parse(localStorage.getItem('iveo_protected_ids') || '[]');
    } catch {
      return [];
    }
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/get_protected_link_ids`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    // If not authenticated or error, return empty array
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

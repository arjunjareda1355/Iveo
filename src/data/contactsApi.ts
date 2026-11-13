import { Contact } from './types';

const rawSupabaseUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '').trim().replace(/\/+$/, '');
const anonKey = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();

export interface ListContactsParams {
  page: number;
  pageSize: number;
  search?: string;
  username?: string | null;
}

export interface ListContactsResult {
  rows: Contact[];
  total: number;
}

/**
 * Sanitizes search term to prevent query parameter injection
 * (removes commas, parens, percent signs; keeps letters, digits, @, ., +, _, -, space)
 */
export function sanitizeSearchTerm(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .slice(0, 64)
    .replace(/[^a-zA-Z0-9@.+_ -]/g, '');
}

function getLocalContacts(): Contact[] {
  try {
    const raw = localStorage.getItem('iveo_contacts_local');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem('iveo_contacts_local', JSON.stringify(contacts));
  } catch {}
}

export async function listContacts(
  token: string | null,
  params: ListContactsParams
): Promise<ListContactsResult> {
  const { page, pageSize, search, username } = params;
  const cleanUser = (username || '').trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sanitizedTerm = sanitizeSearchTerm(search || '');

  if (!rawSupabaseUrl) {
    try {
      const qs = new URLSearchParams({
        username: cleanUser,
        search: sanitizedTerm,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/contacts?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.rows)) {
          return { rows: data.rows, total: typeof data.total === 'number' ? data.total : data.rows.length };
        }
      }
    } catch {
      // Continue to local fallback
    }
    const all = getLocalContacts();
    let filtered = all;
    if (sanitizedTerm) {
      const termLower = sanitizedTerm.toLowerCase();
      filtered = all.filter(
        (c) =>
          (c.email && c.email.toLowerCase().includes(termLower)) ||
          (c.phone && c.phone.toLowerCase().includes(termLower)) ||
          (c.formTitle && c.formTitle.toLowerCase().includes(termLower))
      );
    }
    const rows = filtered.slice(from, to + 1);
    return { rows, total: filtered.length };
  }

  let url = `${rawSupabaseUrl}/rest/v1/contacts?select=id,link_id,form_title,email,phone,consent_text,source,created_at&order=created_at.desc`;

  if (sanitizedTerm) {
    const filter = `or=(email.ilike.*${encodeURIComponent(sanitizedTerm)}*,phone.ilike.*${encodeURIComponent(
      sanitizedTerm
    )}*,form_title.ilike.*${encodeURIComponent(sanitizedTerm)}*)`;
    url += `&${filter}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Prefer: 'count=exact',
      Range: `${from}-${to}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch contacts');
  }

  const contentRange = response.headers.get('content-range');
  let total = 0;
  if (contentRange) {
    const parts = contentRange.split('/');
    if (parts.length === 2) {
      total = parseInt(parts[1], 10) || 0;
    }
  }

  const data = await response.json();
  const rows: Contact[] = (data || []).map((r: any) => ({
    id: r.id,
    linkId: r.link_id || null,
    formTitle: r.form_title || '',
    email: r.email || null,
    phone: r.phone || null,
    consentText: r.consent_text || '',
    source: r.source || '',
    createdAt: r.created_at,
  }));

  if (!contentRange) {
    total = rows.length;
  }

  return { rows, total };
}

export async function deleteContact(
  token: string | null,
  id: string,
  username?: string | null
): Promise<void> {
  const cleanUser = (username || '').trim().toLowerCase();
  try {
    const qs = new URLSearchParams({ id });
    if (cleanUser) qs.set('username', cleanUser);
    await fetch(`/api/contacts?${qs.toString()}`, { method: 'DELETE' });
  } catch {}

  if (!rawSupabaseUrl) {
    const list = getLocalContacts();
    saveLocalContacts(list.filter((c) => c.id !== id));
    return;
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/contacts?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete contact');
  }
}

export async function deleteAllContacts(
  token: string | null,
  username?: string | null
): Promise<void> {
  const cleanUser = (username || '').trim().toLowerCase();
  try {
    const qs = new URLSearchParams({ all: 'true' });
    if (cleanUser) qs.set('username', cleanUser);
    await fetch(`/api/contacts?${qs.toString()}`, { method: 'DELETE' });
  } catch {}

  if (!rawSupabaseUrl) {
    saveLocalContacts([]);
    return;
  }

  const response = await fetch(`${rawSupabaseUrl}/rest/v1/contacts?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete all contacts');
  }
}

export async function fetchContactsForExport(
  token: string | null,
  username?: string | null
): Promise<Contact[]> {
  const cleanUser = (username || '').trim().toLowerCase();
  if (!rawSupabaseUrl) {
    try {
      const qs = new URLSearchParams({
        username: cleanUser,
        page: '1',
        pageSize: '20000',
      });
      const res = await fetch(`/api/contacts?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.rows)) {
          return data.rows;
        }
      }
    } catch {}
    return getLocalContacts();
  }

  const allContacts: Contact[] = [];
  const pageSize = 1000;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const response = await fetch(
      `${rawSupabaseUrl}/rest/v1/contacts?select=id,link_id,form_title,email,phone,consent_text,source,created_at&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Range: `${from}-${to}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export contacts');
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    for (const r of data) {
      allContacts.push({
        id: r.id,
        linkId: r.link_id || null,
        formTitle: r.form_title || '',
        email: r.email || null,
        phone: r.phone || null,
        consentText: r.consent_text || '',
        source: r.source || '',
        createdAt: r.created_at,
      });
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return allContacts;
}

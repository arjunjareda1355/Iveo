import { isSafeHref } from '../lib/urls';

const rawSupabaseUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '').trim().replace(/\/+$/, '');
const anonKey = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();

export type UnlockLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'wrong_password' | 'locked' | 'unavailable' | 'network' };

export async function unlockLink(
  linkId: string,
  password: string
): Promise<UnlockLinkResult> {
  if (!rawSupabaseUrl) {
    try {
      const stored = localStorage.getItem(`iveo_link_pwd_${linkId}`);
      if (stored && stored === password) {
        return { ok: true, url: 'https://iveo.site' };
      }
      return { ok: false, reason: 'wrong_password' };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }

  try {
    const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/unlock_link`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_link_id: linkId,
        p_password: password,
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: 'network' };
    }

    const data = await response.json();
    if (data && data.ok === true && typeof data.url === 'string') {
      if (isSafeHref(data.url)) {
        return { ok: true, url: data.url };
      }
      return { ok: false, reason: 'unavailable' };
    }

    const reason = data?.reason;
    if (reason === 'locked' || reason === 'wrong_password' || reason === 'unavailable') {
      return { ok: false, reason };
    }

    return { ok: false, reason: 'wrong_password' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export interface SubmitContactArgs {
  username: string;
  linkId: string;
  email?: string | null;
  phone?: string | null;
  consent: boolean;
  hp?: string;
  source?: string;
}

export type SubmitContactResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'consent_required'
        | 'invalid_email'
        | 'invalid_phone'
        | 'rate_limited'
        | 'unavailable'
        | 'network';
    };

export async function submitContact(args: SubmitContactArgs): Promise<SubmitContactResult> {
  if (!rawSupabaseUrl) {
    if (!args.consent) return { ok: false, reason: 'consent_required' };
    if (args.hp) return { ok: true };
    return { ok: true };
  }

  try {
    const response = await fetch(`${rawSupabaseUrl}/rest/v1/rpc/submit_contact`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_username: args.username,
        p_link_id: args.linkId,
        p_email: args.email || null,
        p_phone: args.phone || null,
        p_consent: args.consent,
        p_hp: args.hp || '',
        p_source: args.source || '',
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: 'network' };
    }

    const data = await response.json();
    if (data && data.ok === true) {
      return { ok: true };
    }

    const reason = data?.reason;
    if (
      reason === 'consent_required' ||
      reason === 'invalid_email' ||
      reason === 'invalid_phone' ||
      reason === 'rate_limited' ||
      reason === 'unavailable'
    ) {
      return { ok: false, reason };
    }

    return { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * Lightweight tracking client for fire-and-forget public page events.
 * Uses keepalive fetch so requests complete even if visitors navigate away immediately.
 * Never requests or sends a Clerk token.
 */

export async function sendTrackingRpc(
  fnName: string,
  params: Record<string, unknown>
): Promise<void> {
  const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!rawUrl || !anonKey) {
    // If Supabase is not configured, fallback to local dev simulation
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        recordLocalSimulation(fnName, params);
      }
    } catch {
      // Ignore
    }
    return;
  }

  try {
    await fetch(`${rawUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      keepalive: true,
    });
  } catch {
    // Silently ignore all network / ad-blocker errors
  }
}

/**
 * Local simulation store for when Supabase credentials are not connected,
 * enabling full end-to-end testing of counters in local development.
 */
function recordLocalSimulation(fnName: string, params: Record<string, unknown>): void {
  if (fnName !== 'record_page_event') return;

  const username = String(params.p_username || '').toLowerCase().trim();
  const event = String(params.p_event || '');
  const linkId = params.p_link_id ? String(params.p_link_id) : '00000000-0000-0000-0000-000000000000';
  const source = String(params.p_source || '');
  const device = String(params.p_device || 'other');
  const today = new Date().toISOString().slice(0, 10);

  if (!username || (event !== 'view' && event !== 'click')) return;

  const storageKey = `iveo_analytics_sim_${username}`;
  const raw = localStorage.getItem(storageKey);
  const rows: Array<{
    day: string;
    event: string;
    link_id: string;
    source: string;
    device: string;
    hits: number;
  }> = raw ? JSON.parse(raw) : [];

  const existing = rows.find(
    (r) =>
      r.day === today &&
      r.event === event &&
      r.link_id === linkId &&
      r.source === source &&
      r.device === device
  );

  if (existing) {
    existing.hits += 1;
  } else {
    rows.push({
      day: today,
      event,
      link_id: linkId,
      source,
      device,
      hits: 1,
    });
  }

  localStorage.setItem(storageKey, JSON.stringify(rows));
}

import { sendTrackingRpc } from './trackingClient';
import { TrackSource } from '../lib/analytics/sources';
import { DeviceType } from '../lib/analytics/device';
import { AnalyticsResult, analyticsFromJson } from '../lib/analytics/types';

export interface RecordEventInput {
  username: string;
  event: 'view' | 'click';
  linkId?: string | null;
  source?: TrackSource | string;
  device?: DeviceType | string;
}

/**
 * Fires public page view or click counter to Supabase record_page_event RPC.
 */
export async function recordPageEvent(input: RecordEventInput): Promise<void> {
  await sendTrackingRpc('record_page_event', {
    p_username: input.username,
    p_event: input.event,
    p_link_id: input.linkId || null,
    p_source: input.source || '',
    p_device: input.device || 'other',
  });
}

/**
 * Authenticated owner query for analytics data.
 * Calls public.get_analytics(p_from, p_to) with Clerk token.
 */
export async function getAnalytics(
  token: string | null,
  from: string,
  to: string,
  isPro: boolean,
  username?: string | null
): Promise<AnalyticsResult> {
  const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (rawUrl && anonKey && token) {
    const response = await fetch(`${rawUrl}/rest/v1/rpc/get_analytics`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_from: from,
        p_to: to,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('not_authenticated');
      }
      throw new Error('Failed to load analytics');
    }

    const data = await response.json();
    const mapped = analyticsFromJson(data);
    if (!mapped) {
      throw new Error('Invalid analytics response');
    }
    return mapped;
  }

  // Fallback local simulation for dev environment
  return getLocalSimulatedAnalytics(from, to, isPro, username);
}

function getLocalSimulatedAnalytics(
  from: string,
  to: string,
  isPro: boolean,
  username?: string | null
): AnalyticsResult {
  const clean = (username || '').toLowerCase().trim();
  const storageKey = `iveo_analytics_sim_${clean}`;

  let rows: Array<{
    day: string;
    event: string;
    link_id: string;
    source: string;
    device: string;
    hits: number;
  }> = [];

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) rows = JSON.parse(raw);
  } catch {
    // Ignore
  }

  const maxDays = isPro ? 365 : 30;

  // Filter within date range
  const filtered = rows.filter((r) => r.day >= from && r.day <= to);

  const totalViews = filtered
    .filter((r) => r.event === 'view')
    .reduce((sum, r) => sum + r.hits, 0);

  const totalClicks = filtered
    .filter((r) => r.event === 'click')
    .reduce((sum, r) => sum + r.hits, 0);

  // Daily map
  const dailyMap = new Map<string, { views: number; clicks: number }>();

  // Fill all days between from and to
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    dailyMap.set(dayStr, { views: 0, clicks: 0 });
  }

  for (const r of filtered) {
    const entry = dailyMap.get(r.day) || { views: 0, clicks: 0 };
    if (r.event === 'view') entry.views += r.hits;
    if (r.event === 'click') entry.clicks += r.hits;
    dailyMap.set(r.day, entry);
  }

  const daily = Array.from(dailyMap.entries()).map(([day, counts]) => ({
    day,
    views: counts.views,
    clicks: counts.clicks,
  }));

  // Top links
  const linkClicksMap = new Map<string, number>();
  for (const r of filtered) {
    if (r.event === 'click' && r.link_id && r.link_id !== '00000000-0000-0000-0000-000000000000') {
      linkClicksMap.set(r.link_id, (linkClicksMap.get(r.link_id) || 0) + r.hits);
    }
  }

  const links = Array.from(linkClicksMap.entries())
    .map(([linkId, clicks]) => ({ linkId, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  // Sources & Devices (Pro only)
  let sources: Array<{ source: TrackSource; views: number; clicks: number }> | null = null;
  let devices: Array<{ device: DeviceType; views: number; clicks: number }> | null = null;

  if (isPro) {
    const sourcesMap = new Map<string, { views: number; clicks: number }>();
    const devicesMap = new Map<string, { views: number; clicks: number }>();

    for (const r of filtered) {
      const srcKey = r.source || '';
      const sEntry = sourcesMap.get(srcKey) || { views: 0, clicks: 0 };
      if (r.event === 'view') sEntry.views += r.hits;
      if (r.event === 'click') sEntry.clicks += r.hits;
      sourcesMap.set(srcKey, sEntry);

      const devKey = r.device || 'other';
      const dEntry = devicesMap.get(devKey) || { views: 0, clicks: 0 };
      if (r.event === 'view') dEntry.views += r.hits;
      if (r.event === 'click') dEntry.clicks += r.hits;
      devicesMap.set(devKey, dEntry);
    }

    sources = Array.from(sourcesMap.entries())
      .map(([source, stats]) => ({
        source: source as TrackSource,
        views: stats.views,
        clicks: stats.clicks,
      }))
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks);

    devices = Array.from(devicesMap.entries())
      .map(([device, stats]) => ({
        device: device as DeviceType,
        views: stats.views,
        clicks: stats.clicks,
      }))
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks);
  }

  return {
    range: {
      from,
      to,
      maxDays,
      isPro,
    },
    totals: {
      views: totalViews,
      clicks: totalClicks,
    },
    daily,
    links,
    sources,
    devices,
  };
}

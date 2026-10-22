import { TrackSource, TRACK_SOURCES_SET } from './sources';
import { DeviceType } from './device';

export type RangeKey = '7d' | '30d' | '90d' | '12m';

export interface AnalyticsDay {
  day: string;
  views: number;
  clicks: number;
}

export interface AnalyticsLinkStat {
  linkId: string;
  clicks: number;
}

export interface AnalyticsSourceStat {
  source: TrackSource;
  views: number;
  clicks: number;
}

export interface AnalyticsDeviceStat {
  device: DeviceType;
  views: number;
  clicks: number;
}

export interface AnalyticsResult {
  range: {
    from: string;
    to: string;
    maxDays: number;
    isPro: boolean;
  };
  totals: {
    views: number;
    clicks: number;
  };
  daily: AnalyticsDay[];
  links: AnalyticsLinkStat[];
  sources: AnalyticsSourceStat[] | null;
  devices: AnalyticsDeviceStat[] | null;
}

const VALID_DEVICES = new Set<string>(['mobile', 'tablet', 'desktop', 'other']);

/**
 * Validating mapper from raw server JSON to AnalyticsResult.
 * Unknown sources become 'other', invalid numbers default to 0. Never throws.
 */
export function analyticsFromJson(raw: unknown): AnalyticsResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  try {
    const data = raw as Record<string, any>;
    const rangeObj = data.range || {};
    const from = typeof rangeObj.from === 'string' ? rangeObj.from : '';
    const to = typeof rangeObj.to === 'string' ? rangeObj.to : '';
    const maxDays = typeof rangeObj.max_days === 'number' ? rangeObj.max_days : 30;
    const isPro = rangeObj.is_pro === true;

    const totalsObj = data.totals || {};
    const views = typeof totalsObj.views === 'number' ? Math.max(0, totalsObj.views) : 0;
    const clicks = typeof totalsObj.clicks === 'number' ? Math.max(0, totalsObj.clicks) : 0;

    const daily: AnalyticsDay[] = Array.isArray(data.daily)
      ? data.daily
          .filter((d: any) => d && typeof d === 'object' && typeof d.day === 'string')
          .map((d: any) => ({
            day: String(d.day),
            views: typeof d.views === 'number' ? Math.max(0, d.views) : 0,
            clicks: typeof d.clicks === 'number' ? Math.max(0, d.clicks) : 0,
          }))
      : [];

    const links: AnalyticsLinkStat[] = Array.isArray(data.links)
      ? data.links
          .filter((l: any) => l && typeof l === 'object' && (l.link_id || l.linkId))
          .map((l: any) => ({
            linkId: String(l.link_id || l.linkId),
            clicks: typeof l.clicks === 'number' ? Math.max(0, l.clicks) : 0,
          }))
      : [];

    let sources: AnalyticsSourceStat[] | null = null;
    if (Array.isArray(data.sources)) {
      sources = data.sources
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any) => {
          const rawSrc = String(s.source ?? '');
          const source: TrackSource = TRACK_SOURCES_SET.has(rawSrc)
            ? (rawSrc as TrackSource)
            : 'other';
          return {
            source,
            views: typeof s.views === 'number' ? Math.max(0, s.views) : 0,
            clicks: typeof s.clicks === 'number' ? Math.max(0, s.clicks) : 0,
          };
        });
    }

    let devices: AnalyticsDeviceStat[] | null = null;
    if (Array.isArray(data.devices)) {
      devices = data.devices
        .filter((dv: any) => dv && typeof dv === 'object')
        .map((dv: any) => {
          const rawDev = String(dv.device || 'other');
          const device: DeviceType = VALID_DEVICES.has(rawDev)
            ? (rawDev as DeviceType)
            : 'other';
          return {
            device,
            views: typeof dv.views === 'number' ? Math.max(0, dv.views) : 0,
            clicks: typeof dv.clicks === 'number' ? Math.max(0, dv.clicks) : 0,
          };
        });
    }

    return {
      range: {
        from,
        to,
        maxDays,
        isPro,
      },
      totals: {
        views,
        clicks,
      },
      daily,
      links,
      sources,
      devices,
    };
  } catch {
    return null;
  }
}

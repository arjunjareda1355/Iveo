import { AnalyticsDay } from './types';
import { formatDayLabel, formatMonthLabel } from './dates';

export interface Bucket {
  key: string;
  startDay: string;
  label: string;
  views: number;
  clicks: number;
}

/**
 * Calculates Monday of the given UTC date.
 */
function getUtcMonday(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Groups daily analytics counters into day, week (Monday-based), or calendar month buckets.
 * Buckets are returned ascending, contiguous and exact.
 */
export function buildBuckets(
  daily: AnalyticsDay[],
  bucketType: 'day' | 'week' | 'month'
): Bucket[] {
  if (!daily || daily.length === 0) {
    return [];
  }

  // Sort ascending by day
  const sorted = [...daily].sort((a, b) => a.day.localeCompare(b.day));

  if (bucketType === 'day') {
    return sorted.map((d) => ({
      key: d.day,
      startDay: d.day,
      label: formatDayLabel(d.day),
      views: d.views,
      clicks: d.clicks,
    }));
  }

  if (bucketType === 'week') {
    const bucketsMap = new Map<string, Bucket>();

    for (const d of sorted) {
      // Find week start (Monday)
      const monday = getUtcMonday(d.day);
      const existing = bucketsMap.get(monday);

      if (!existing) {
        bucketsMap.set(monday, {
          key: monday,
          startDay: d.day, // Start day in range
          label: formatDayLabel(d.day),
          views: d.views,
          clicks: d.clicks,
        });
      } else {
        existing.views += d.views;
        existing.clicks += d.clicks;
      }
    }

    return Array.from(bucketsMap.values());
  }

  // Monthly buckets
  const monthlyMap = new Map<string, Bucket>();

  for (const d of sorted) {
    const monthKey = d.day.slice(0, 7); // YYYY-MM
    const existing = monthlyMap.get(monthKey);

    if (!existing) {
      monthlyMap.set(monthKey, {
        key: monthKey,
        startDay: d.day,
        label: formatMonthLabel(d.day),
        views: d.views,
        clicks: d.clicks,
      });
    } else {
      existing.views += d.views;
      existing.clicks += d.clicks;
    }
  }

  return Array.from(monthlyMap.values());
}

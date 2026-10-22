/**
 * Date and number formatting utilities for iveo analytics.
 * All calendar days in analytics use UTC format: YYYY-MM-DD.
 */

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysUtc(dateString: string, n: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDayLabel(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatMonthLabel(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Formats hit counts using compact notation for large numbers (100k+).
 */
export function formatCount(n: number): string {
  if (n >= 100000) {
    return new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(undefined).format(n);
}

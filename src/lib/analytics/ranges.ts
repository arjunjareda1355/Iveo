import { RangeKey } from './types';
import { todayUtc, addDaysUtc } from './dates';

export interface RangeConfig {
  days: number;
  bucket: 'day' | 'week' | 'month';
  pro: boolean;
  label: string;
}

export const RANGES: Record<RangeKey, RangeConfig> = {
  '7d': { days: 7, bucket: 'day', pro: false, label: '7 days' },
  '30d': { days: 30, bucket: 'day', pro: false, label: '30 days' },
  '90d': { days: 90, bucket: 'week', pro: true, label: '90 days' },
  '12m': { days: 365, bucket: 'month', pro: true, label: '12 months' },
};

export const DEFAULT_RANGE: RangeKey = '30d';

export function isValidRangeKey(raw: string | null | undefined): raw is RangeKey {
  return raw === '7d' || raw === '30d' || raw === '90d' || raw === '12m';
}

export function rangeToDates(key: RangeKey): { from: string; to: string } {
  const to = todayUtc();
  const config = RANGES[key] || RANGES[DEFAULT_RANGE];
  const from = addDaysUtc(to, -(config.days - 1));
  return { from, to };
}

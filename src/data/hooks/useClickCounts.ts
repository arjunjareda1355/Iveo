import { useMemo } from 'react';
import { useAnalytics } from './useAnalytics';

/**
 * Returns a Map of linkId => click count for the last 30 days.
 * Safe to mount on Links tab: never throws, blocks or disrupts rendering.
 */
export function useClickCounts(): Map<string, number> {
  const { data } = useAnalytics('30d');

  return useMemo(() => {
    const map = new Map<string, number>();
    if (!data || !Array.isArray(data.links)) {
      return map;
    }

    for (const item of data.links) {
      if (item && item.linkId) {
        map.set(item.linkId, item.clicks || 0);
      }
    }

    return map;
  }, [data]);
}

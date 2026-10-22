import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { RangeKey, AnalyticsResult } from '../../lib/analytics/types';
import { rangeToDates } from '../../lib/analytics/ranges';
import { getAnalytics } from '../analyticsApi';
import { useIveoSession } from '../../auth/useIvioSession';

interface UseAnalyticsResult {
  data: AnalyticsResult | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  dataUpdatedAt: number;
  refetch: () => Promise<void>;
}

// Global cache for analytics responses across component mounts
const analyticsCache = new Map<string, { data: AnalyticsResult; updatedAt: number }>();

export function useAnalytics(rangeKey: RangeKey): UseAnalyticsResult {
  const session = useIveoSession();
  const { getToken } = useAuth();

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<number>(Date.now());

  const dates = rangeToDates(rangeKey);
  const cacheKey = `${session.username || ''}:${dates.from}:${dates.to}:${session.isPro}`;
  const previousDataRef = useRef<AnalyticsResult | null>(null);

  const fetchAnalytics = useCallback(
    async (isManualRefresh = false) => {
      if (!session.isSignedIn || !session.username) {
        setIsLoading(false);
        return;
      }

      // Check cache validity (stale time 60s) unless manual refresh
      const cached = analyticsCache.get(cacheKey);
      const isFresh = cached && Date.now() - cached.updatedAt < 60000;

      if (cached && !isManualRefresh) {
        setData(cached.data);
        previousDataRef.current = cached.data;
        setDataUpdatedAt(cached.updatedAt);
        setIsLoading(false);
        if (isFresh) return;
      }

      setIsFetching(true);
      if (!previousDataRef.current && !cached) {
        setIsLoading(true);
      }

      try {
        let token: string | null = null;
        try {
          token = await getToken({ template: 'supabase' }).catch(() => null);
        } catch {
          // Token error
        }

        const res = await getAnalytics(
          token,
          dates.from,
          dates.to,
          session.isPro,
          session.username
        );

        analyticsCache.set(cacheKey, { data: res, updatedAt: Date.now() });
        setData(res);
        previousDataRef.current = res;
        setDataUpdatedAt(Date.now());
        setIsError(false);
        setError(null);
      } catch (err: any) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error('Failed to load analytics'));
        if (isManualRefresh) {
          throw err;
        }
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [session.isSignedIn, session.username, session.isPro, cacheKey, dates.from, dates.to, getToken]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Refetch on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchAnalytics();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAnalytics]);

  return {
    data,
    isLoading: isLoading && !data,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
    refetch: () => fetchAnalytics(true),
  };
}

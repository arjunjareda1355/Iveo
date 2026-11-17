import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { getProtectedLinkIds } from '../passwordApi';
import { useIveoSession } from '../../auth/useIvioSession';

// Module-level cache and listeners so all components share the active protected IDs
let cachedProtectedIds = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

export function updateProtectedIdsCache(updater: (prev: Set<string>) => Set<string>) {
  cachedProtectedIds = updater(new Set(cachedProtectedIds));
  listeners.forEach((listener) => listener(cachedProtectedIds));
}

export function useProtectedLinkIds(): {
  protectedIds: Set<string>;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const { getToken } = useAuth();
  const session = useIveoSession();

  const [protectedIds, setProtectedIds] = useState<Set<string>>(cachedProtectedIds);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    listeners.add(setProtectedIds);
    return () => {
      listeners.delete(setProtectedIds);
    };
  }, []);

  const fetchIds = useCallback(async () => {
    if (!session.isSignedIn) {
      setProtectedIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      const token = await getToken({ template: 'supabase' }).catch(() => null);
      const ids = await getProtectedLinkIds(token, session.username);
      const newSet = new Set(ids);
      cachedProtectedIds = newSet;
      setProtectedIds(newSet);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [getToken, session.isSignedIn, session.username]);

  useEffect(() => {
    fetchIds();
  }, [fetchIds]);

  return {
    protectedIds,
    isLoading,
    refetch: fetchIds,
  };
}

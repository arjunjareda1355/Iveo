import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { setLinkPassword as apiSetLinkPassword } from '../passwordApi';
import { updateProtectedIdsCache } from './useProtectedLinkIds';

export function useSetLinkPassword(): {
  setLinkPassword: (linkId: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setLinkPassword = useCallback(
    async (linkId: string, password: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken({ template: 'supabase' }).catch(() => null);
        await apiSetLinkPassword(token, linkId, password);
        // Only update cache after call succeeds
        updateProtectedIdsCache((prev) => {
          prev.add(linkId);
          return prev;
        });
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    setLinkPassword,
    isLoading,
    error,
  };
}

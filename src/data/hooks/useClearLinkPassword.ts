import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { clearLinkPassword as apiClearLinkPassword } from '../passwordApi';
import { updateProtectedIdsCache } from './useProtectedLinkIds';

export function useClearLinkPassword(): {
  clearLinkPassword: (linkId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const clearLinkPassword = useCallback(
    async (linkId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      let wasPresent = false;
      updateProtectedIdsCache((prev) => {
        wasPresent = prev.has(linkId);
        prev.delete(linkId);
        return prev;
      });

      try {
        const token = await getToken({ template: 'supabase' }).catch(() => null);
        await apiClearLinkPassword(token, linkId);
      } catch (err) {
        // Roll back on error
        if (wasPresent) {
          updateProtectedIdsCache((prev) => {
            prev.add(linkId);
            return prev;
          });
        }
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
    clearLinkPassword,
    isLoading,
    error,
  };
}

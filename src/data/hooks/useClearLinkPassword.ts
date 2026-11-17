import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { clearLinkPassword as apiClearLinkPassword } from '../passwordApi';
import { updateProtectedIdsCache } from './useProtectedLinkIds';
import { useIveoSession } from '../../auth/useIvioSession';

export function useClearLinkPassword(): {
  clearLinkPassword: (linkId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { getToken } = useAuth();
  const session = useIveoSession();
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
        await apiClearLinkPassword(token, linkId, session.username);
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
    [getToken, session.username]
  );

  return {
    clearLinkPassword,
    isLoading,
    error,
  };
}

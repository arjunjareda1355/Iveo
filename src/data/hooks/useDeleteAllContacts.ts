import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { deleteAllContacts as apiDeleteAllContacts } from '../contactsApi';
import { useIveoSession } from '../../auth/useIvioSession';

export function useDeleteAllContacts(): {
  deleteAllContacts: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { getToken } = useAuth();
  const { username } = useIveoSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteAllContacts = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken({ template: 'supabase' }).catch(() => null);
      await apiDeleteAllContacts(token, username);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, username]);

  return {
    deleteAllContacts,
    isLoading,
    error,
  };
}

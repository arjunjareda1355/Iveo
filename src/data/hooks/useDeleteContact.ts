import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { deleteContact as apiDeleteContact } from '../contactsApi';
import { useIveoSession } from '../../auth/useIvioSession';

export function useDeleteContact(): {
  deleteContact: (id: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { getToken } = useAuth();
  const { username } = useIveoSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken({ template: 'supabase' }).catch(() => null);
        await apiDeleteContact(token, id, username);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, username]
  );

  return {
    deleteContact,
    isLoading,
    error,
  };
}

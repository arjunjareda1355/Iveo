import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { Contact } from '../types';
import { listContacts } from '../contactsApi';
import { useIveoSession } from '../../auth/useIvioSession';

export interface UseContactsResult {
  rows: Contact[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  optimisticDelete: (id: string) => void;
  optimisticDeleteAll: () => void;
}

export function useContacts({
  page,
  search = '',
  pageSize = 50,
}: {
  page: number;
  search?: string;
  pageSize?: number;
}): UseContactsResult {
  const { getToken } = useAuth();
  const session = useIveoSession();

  const [rows, setRows] = useState<Contact[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // keepPreviousData ref
  const previousDataRef = useRef<{ rows: Contact[]; total: number } | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!session.isSignedIn) {
      setRows([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    if (previousDataRef.current) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }
    setIsError(false);
    setError(null);

    try {
      const token = await getToken({ template: 'supabase' }).catch(() => null);
      const res = await listContacts(token, { page, pageSize, search });
      setRows(res.rows);
      setTotal(res.total);
      previousDataRef.current = res;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(e);
      if (previousDataRef.current) {
        setRows(previousDataRef.current.rows);
        setTotal(previousDataRef.current.total);
      }
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [getToken, page, pageSize, search, session.isSignedIn]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const optimisticDelete = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const optimisticDeleteAll = useCallback(() => {
    setRows([]);
    setTotal(0);
  }, []);

  return {
    rows,
    total,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: fetchContacts,
    optimisticDelete,
    optimisticDeleteAll,
  };
}

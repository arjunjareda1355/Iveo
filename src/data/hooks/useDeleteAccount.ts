import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/react';
import { useAccountDeletion } from '../../components/account/AccountDeletionProvider';
import { SUPPORT_EMAIL } from '../../lib/site';
import { copy } from '../../content/copy';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export interface DeleteAccountState {
  isDeleting: boolean;
  error: 'first' | 'second' | null;
  errorMessage: string | null;
  supportEmail: string;
  deleteAccount: (confirmedUsername: string) => Promise<void>;
}

export function useDeleteAccount(): DeleteAccountState {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { isDeleting, setIsDeleting } = useAccountDeletion();
  const [error, setError] = useState<'first' | 'second' | null>(null);

  const deleteAccount = async (confirmedUsername: string) => {
    if (!user) return;
    const currentUsername = user.username?.trim().toLowerCase() || '';
    if (confirmedUsername.trim().toLowerCase() !== currentUsername) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const userId = user.id;

    // 1. Get token
    let token: string | null = null;
    try {
      token = await getToken({ template: 'supabase' }).catch(() => null);
    } catch {
      // Token fetch failed
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: anonKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. Delete user's images in link-images bucket (failures ignored; webhook sweeps)
    if (rawSupabaseUrl) {
      try {
        let pages = 0;
        let hasMore = true;

        while (hasMore && pages < 10) {
          pages++;
          const listRes = await fetch(
            `${rawSupabaseUrl}/storage/v1/object/list/link-images`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({ prefix: userId, limit: 100 }),
            }
          );

          if (!listRes.ok) break;
          const files = await listRes.json();
          if (!files || !Array.isArray(files) || files.length === 0) {
            hasMore = false;
            break;
          }

          const prefixes = files.map((f: { name: string }) => `${userId}/${f.name}`);
          await fetch(`${rawSupabaseUrl}/storage/v1/object/link-images`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ prefixes }),
          });
        }
      } catch {
        // Ignored
      }
    }

    // 3. Delete profile row (allowed by owner delete policy; cascades remove links and stats)
    if (rawSupabaseUrl) {
      try {
        const deleteProfileRes = await fetch(
          `${rawSupabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'DELETE',
            headers,
          }
        );

        if (!deleteProfileRes.ok && deleteProfileRes.status !== 404) {
          setIsDeleting(false);
          setError('first');
          return;
        }
      } catch {
        setIsDeleting(false);
        setError('first');
        return;
      }
    } else {
      // Local development cleanups
      try {
        localStorage.removeItem(`iveo_blocks_${currentUsername}`);
        localStorage.removeItem(`ivio_blocks_${currentUsername}`);
      } catch {}
    }

    // 4. Delete Clerk account
    try {
      await user.delete();
    } catch {
      // Page data is already gone, but Clerk deletion failed
      setIsDeleting(false);
      setError('second');
      return;
    }

    // 5. On success
    try {
      sessionStorage.clear();
    } catch {}

    setIsDeleting(false);
    navigate('/?deleted=1', { replace: true });
  };

  const errorMessage =
    error === 'first'
      ? copy.deleteAccount.errorFirst
      : error === 'second'
        ? `${copy.deleteAccount.errorSecondPrefix} ${SUPPORT_EMAIL}.`
        : null;

  return {
    isDeleting,
    error,
    errorMessage,
    supportEmail: SUPPORT_EMAIL,
    deleteAccount,
  };
}

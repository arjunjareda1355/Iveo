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

    const meta = (user.unsafeMetadata && typeof user.unsafeMetadata === 'object'
      ? user.unsafeMetadata
      : {}) as Record<string, unknown>;

    const currentUsername = (
      user.username ||
      (typeof meta.username === 'string' ? meta.username : '') ||
      (typeof meta.preferredUsername === 'string' ? meta.preferredUsername : '') ||
      user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
      ''
    ).trim().toLowerCase();

    const confirmedClean = confirmedUsername.trim().toLowerCase();
    const emailClean = (user.primaryEmailAddress?.emailAddress || '').trim().toLowerCase();
    const isMatch =
      confirmedClean === currentUsername ||
      confirmedClean === emailClean ||
      confirmedClean === user.id.toLowerCase();

    if (!isMatch && currentUsername) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const userId = user.id;

    // 1. Unified server-side deletion (Azure SQL / Server store)
    try {
      await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUsername || userId,
          userId,
        }),
      });
    } catch {
      // Continue
    }

    // 2. Get Supabase token if configured
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

    // 3. Delete user's images in link-images bucket if Supabase configured
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

    // 4. Delete Supabase profile row if configured
    if (rawSupabaseUrl) {
      try {
        await fetch(
          `${rawSupabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'DELETE',
            headers,
          }
        );
      } catch {
        // Continue
      }
    }

    // 5. Clean up all browser storage
    try {
      localStorage.removeItem(`iveo_blocks_${currentUsername}`);
      localStorage.removeItem(`ivio_blocks_${currentUsername}`);
      localStorage.removeItem(`iveo_profile_${currentUsername}`);
      localStorage.removeItem(`ivio_profile_${currentUsername}`);
      localStorage.removeItem(`iveo_blocks_${userId}`);
      localStorage.removeItem('iveo_current_username');
      sessionStorage.clear();
    } catch {}

    // 6. Delete Clerk account or sign out
    try {
      if (typeof user.delete === 'function') {
        await user.delete();
      }
    } catch (clerkErr) {
      console.warn('Clerk user delete caught, signing out instead:', clerkErr);
    }

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

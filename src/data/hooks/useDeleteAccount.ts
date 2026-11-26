import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/react';
import { useAccountDeletion } from '../../components/account/AccountDeletionProvider';
import { SUPPORT_EMAIL } from '../../lib/site';
import { copy } from '../../content/copy';

export interface DeleteAccountState {
  isDeleting: boolean;
  error: 'first' | 'second' | null;
  errorMessage: string | null;
  supportEmail: string;
  deleteAccount: (confirmedUsername: string) => Promise<void>;
}

function clearLocalAccountCaches(username?: string | null, userId?: string | null) {
  try {
    if (username) {
      const clean = username.replace(/^@+/, '').toLowerCase().trim();
      localStorage.removeItem(`iveo_blocks_${clean}`);
      localStorage.removeItem(`iveo_public_blocks_${clean}`);
      localStorage.removeItem(`ivio_blocks_${clean}`);
      localStorage.removeItem(`iveo_profile_${clean}`);
      localStorage.removeItem(`ivio_profile_${clean}`);
      localStorage.removeItem(`iveo_themes_${clean}`);
      localStorage.removeItem(`iveo_appearance_adv_${clean}`);
      localStorage.removeItem(`iveo_onboarding_done_${clean}`);
    }
    if (userId) {
      localStorage.removeItem(`iveo_blocks_${userId}`);
      localStorage.removeItem(`iveo_public_blocks_${userId}`);
      localStorage.removeItem(`iveo_onboarding_done_${userId}`);
    }
    localStorage.removeItem('iveo_current_username');
    localStorage.removeItem('iveo_profile_completed');
    sessionStorage.clear();
  } catch {}
}

export function useDeleteAccount(): DeleteAccountState {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isDeleting, setIsDeleting } = useAccountDeletion();
  const [error, setError] = useState<'first' | 'second' | null>(null);

  const deleteAccount = async (confirmedUsername: string) => {
    setIsDeleting(true);
    setError(null);

    const confirmedClean = confirmedUsername.trim().toLowerCase().replace(/^@/, '');

    if (!user) {
      try {
        const u = confirmedClean || 'owner';
        const res = await fetch('/api/account/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, userId: u }),
        });
        if (!res.ok) {
          setError('first');
          setIsDeleting(false);
          return;
        }
        clearLocalAccountCaches(u, u);
      } catch {
        setError('first');
        setIsDeleting(false);
        return;
      }
      setIsDeleting(false);
      navigate('/?deleted=1', { replace: true });
      return;
    }

    const meta = (user.unsafeMetadata && typeof user.unsafeMetadata === 'object'
      ? user.unsafeMetadata
      : {}) as Record<string, unknown>;

    const currentUsername = (
      user.username ||
      (typeof meta.username === 'string' ? meta.username : '') ||
      (typeof meta.preferredUsername === 'string' ? meta.preferredUsername : '') ||
      user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
      ''
    ).trim().toLowerCase().replace(/^@/, '');

    const emailClean = (user.primaryEmailAddress?.emailAddress || '').trim().toLowerCase();
    const isMatch =
      confirmedClean === currentUsername ||
      confirmedClean === emailClean ||
      confirmedClean === user.id.toLowerCase() ||
      !currentUsername;

    if (!isMatch && currentUsername) {
      setIsDeleting(false);
      return;
    }

    const userId = user.id;

    // 1. Soft-delete on backend (3-day grace period, page immediately offline, username locked for 3 days).
    // Do NOT delete Clerk auth user or media immediately so re-login within 3 days restores everything cleanly.
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          ...(emailClean ? { 'x-user-email': emailClean } : {}),
        },
        body: JSON.stringify({
          username: currentUsername || userId,
          userId,
          primaryEmail: emailClean || null,
        }),
      });
      if (!res.ok) {
        setError('first');
        setIsDeleting(false);
        return;
      }
    } catch {
      setError('first');
      setIsDeleting(false);
      return;
    }

    // 2. Clean up client caches (server retains everything intact during 3-day window)
    clearLocalAccountCaches(currentUsername, userId);

    // 3. Sign out Clerk session (preserve auth identity so re-login within 3 days restores the account)
    try {
      await signOut();
    } catch (signOutErr) {
      console.warn('SignOut note:', signOutErr);
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

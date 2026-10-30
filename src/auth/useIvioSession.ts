import { useEffect, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { HAS_CLERK_KEY } from '../lib/env';
import { VibeId } from '../lib/vibes';
import {
  ButtonShape,
  IveoPreferences,
  parsePreferences,
  DEFAULT_PREFERENCES,
} from '../lib/preferences';
import { validateUsername, normalizeUsername } from '../lib/username-rules';
import { isAllowedAvatarUrl } from '../lib/avatar';
import { isOwnerEmail } from '../lib/plan';

export interface IveoSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  username: string | null;
  displayName: string;
  bio: string;
  imageUrl: string | null;
  category: string | null;
  primaryEmail: string | null;
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  socialsPosition: 'top' | 'bottom';
  onboardingComplete: boolean;
  plan: 'free' | 'pro';
  isPro: boolean;
  hideIveoFooter: boolean;
  hideIvioFooter: boolean;
  updateUsername: (newUsername: string) => Promise<void>;
  updatePreferences: (patch: Partial<Omit<IveoPreferences, 'plan'>>) => Promise<void>;
  updateProfile: (profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    category?: string | null;
  }) => Promise<void>;
  updateSocials: (socials: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
}

export type IvioSession = IveoSession;

const FALLBACK_SESSION: IveoSession = {
  isLoaded: true,
  isSignedIn: false,
  username: null,
  displayName: 'Your name',
  bio: '',
  imageUrl: null,
  category: null,
  primaryEmail: null,
  vibeId: DEFAULT_PREFERENCES.vibeId,
  buttonShape: DEFAULT_PREFERENCES.buttonShape,
  socials: {},
  socialsPosition: 'top',
  onboardingComplete: false,
  plan: 'free',
  isPro: false,
  hideIveoFooter: false,
  hideIvioFooter: false,
  updateUsername: async () => {},
  updatePreferences: async () => {},
  updateProfile: async () => {},
  updateSocials: async () => {},
  signOut: async () => {},
};

function useClerkSession(): IveoSession {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const { signOut } = useClerk();

  const isLoaded = Boolean(authLoaded && userLoaded);
  const activeUser = isLoaded && isSignedIn && user ? user : null;

  // Support reading username from user.username or fallback to unsafeMetadata.username
  const meta = (activeUser?.unsafeMetadata && typeof activeUser.unsafeMetadata === 'object'
    ? activeUser.unsafeMetadata
    : {}) as Record<string, unknown>;

  const rawUsername =
    activeUser?.username ||
    (typeof meta.username === 'string' ? meta.username : '') ||
    (typeof meta.preferredUsername === 'string' ? meta.preferredUsername : '') ||
    '';
  const normalizedUsername = normalizeUsername(rawUsername);
  const username = normalizedUsername || null;

  const preferences = parsePreferences(activeUser?.unsafeMetadata);

  const displayName =
    preferences.displayName ||
    activeUser?.fullName ||
    username ||
    'Your name';

  const bio = preferences.bio || '';

  // Avatar can come from custom uploaded avatarUrl or Clerk image
  const candidateAvatar = preferences.avatarUrl || activeUser?.imageUrl;
  const imageUrl: string | null = (isAllowedAvatarUrl(candidateAvatar) ? candidateAvatar : null) ?? null;
  const category = preferences.category || null;
  const socials = preferences.socials || {};

  const primaryEmail = activeUser?.primaryEmailAddress?.emailAddress || null;

  const isUsernameValid = username ? validateUsername(username).ok : false;
  const onboardingComplete = preferences.onboardingComplete === true && isUsernameValid;

  const isOwner = primaryEmail ? isOwnerEmail(primaryEmail) : false;
  const plan: 'free' | 'pro' = isOwner ? 'pro' : preferences.plan;
  const isPro = isOwner || plan === 'pro';
  const hideFooter = preferences.hideIveoFooter || preferences.hideIvioFooter || false;
  const socialsPosition = preferences.socialsPosition || 'top';
  const vibeId = preferences.vibeId || DEFAULT_PREFERENCES.vibeId;
  const buttonShape = preferences.buttonShape || DEFAULT_PREFERENCES.buttonShape;

  const syncToServer = async (payload: Record<string, unknown>) => {
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Background sync, suppress errors
    }
  };

  // Automatic sync on session load to ensure Azure SQL and server store have current user profile
  // ALWAYS executed unconditionally at hook top level!
  useEffect(() => {
    if (activeUser && username) {
      syncToServer({
        username,
        displayName: displayName || username,
        bio,
        avatarUrl: imageUrl,
        vibeId,
        buttonShape,
        socials,
        socialsPosition,
        primaryEmail,
        plan: isPro ? 'pro' : plan,
        hideFooter,
      });
    }
  }, [
    activeUser?.id,
    username,
    displayName,
    bio,
    imageUrl,
    vibeId,
    buttonShape,
    socialsPosition,
    primaryEmail,
    isPro,
    plan,
    hideFooter,
  ]);

  if (!activeUser) {
    return {
      isLoaded,
      isSignedIn: false,
      username: null,
      displayName: 'Your name',
      bio: '',
      imageUrl: null,
      category: null,
      primaryEmail: null,
      vibeId: DEFAULT_PREFERENCES.vibeId,
      buttonShape: DEFAULT_PREFERENCES.buttonShape,
      socials: {},
      socialsPosition: 'top',
      onboardingComplete: false,
      plan: 'free',
      isPro: false,
      hideIveoFooter: false,
      hideIvioFooter: false,
      updateUsername: async () => {},
      updatePreferences: async () => {},
      updateProfile: async () => {},
      updateSocials: async () => {},
      signOut: async () => {
        await signOut();
      },
    };
  }

  const currentUser = activeUser;

  const updateUsername = async (newUsername: string): Promise<void> => {
    const clean = normalizeUsername(newUsername);
    if (!clean) {
      throw new Error('Please enter a valid address (3 to 24 letters, numbers or underscores).');
    }

    const currentMeta = (currentUser.unsafeMetadata && typeof currentUser.unsafeMetadata === 'object'
      ? currentUser.unsafeMetadata
      : {}) as Record<string, unknown>;

    // 1. Always write to unsafeMetadata first (universally supported by Clerk)
    try {
      await currentUser.update({
        unsafeMetadata: {
          ...currentMeta,
          username: clean,
        },
      });
    } catch (metaErr) {
      console.warn('Could not save username to unsafeMetadata:', metaErr);
    }

    // 2. Try updating top-level Clerk username (if enabled in Clerk dashboard settings)
    try {
      await currentUser.update({ username: clean });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes('not a valid parameter') ||
        msg.includes('username is not a valid parameter')
      ) {
        // Silently handled via metadata
      } else {
        console.warn('Clerk top-level username update note:', msg);
      }
    }

    // 3. Mirror to localStorage
    try {
      const raw = localStorage.getItem(`iveo_profile_${clean}`) || '{}';
      const parsed = JSON.parse(raw);
      localStorage.setItem(
        `iveo_profile_${clean}`,
        JSON.stringify({
          ...parsed,
          username: clean,
        })
      );
      localStorage.setItem('iveo_current_username', clean);
    } catch {}

    // Mirror to Azure SQL / Server database
    syncToServer({
      username: clean,
      displayName: displayName || clean,
      bio,
      avatarUrl: imageUrl,
      vibeId: preferences.vibeId,
      buttonShape: preferences.buttonShape,
      socials,
      socialsPosition: preferences.socialsPosition || 'top',
      primaryEmail,
      plan: isPro ? 'pro' : plan,
      hideFooter,
    });
  };

  const updatePreferences = async (patch: Partial<Omit<IveoPreferences, 'plan'>>): Promise<void> => {
    const currentMeta = (currentUser.unsafeMetadata && typeof currentUser.unsafeMetadata === 'object'
      ? currentUser.unsafeMetadata
      : {}) as Record<string, unknown>;

    const { plan: _ignoredPlan, ...safePatch } = patch as any;

    const merged = {
      ...currentMeta,
      ...safePatch,
    };

    try {
      await currentUser.update({
        unsafeMetadata: merged,
      });
    } catch (metaErr) {
      console.warn('Clerk metadata update note:', metaErr);
    }

    // Mirror to localStorage for offline and public profile fallback
    if (username) {
      try {
        const raw = localStorage.getItem(`iveo_profile_${username}`) || '{}';
        const parsed = JSON.parse(raw);
        localStorage.setItem(
          `iveo_profile_${username}`,
          JSON.stringify({
            ...parsed,
            vibeId: merged.vibeId || parsed.vibeId,
            buttonShape: merged.buttonShape || parsed.buttonShape,
            hideFooter: merged.hideIveoFooter || merged.hideIvioFooter || parsed.hideFooter,
            displayName: merged.displayName !== undefined ? merged.displayName : parsed.displayName,
            bio: merged.bio !== undefined ? merged.bio : parsed.bio,
            avatarUrl: merged.avatarUrl !== undefined ? merged.avatarUrl : parsed.avatarUrl,
            socials: merged.socials !== undefined ? merged.socials : parsed.socials,
            socialsPosition: merged.socialsPosition || parsed.socialsPosition || 'top',
          })
        );
      } catch {}

      // Mirror to Azure SQL / Server database
      syncToServer({
        username,
        displayName: merged.displayName !== undefined ? merged.displayName : displayName,
        bio: merged.bio !== undefined ? merged.bio : bio,
        avatarUrl: merged.avatarUrl !== undefined ? merged.avatarUrl : imageUrl,
        vibeId: merged.vibeId || preferences.vibeId,
        buttonShape: merged.buttonShape || preferences.buttonShape,
        socials: merged.socials !== undefined ? merged.socials : socials,
        socialsPosition: (merged.socialsPosition as any) || preferences.socialsPosition || 'top',
        primaryEmail,
        plan: isPro ? 'pro' : plan,
        hideFooter: merged.hideIveoFooter || merged.hideIvioFooter || hideFooter,
      });
    }
  };

  const updateProfile = async (profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    category?: string | null;
  }): Promise<void> => {
    let finalAvatarUrl = profile.avatarUrl;

    // If a base64 data URL was passed, upload it to the server backend first
    // to keep Clerk metadata well below the 8 KB limit and fit in SQL columns
    if (finalAvatarUrl && finalAvatarUrl.startsWith('data:image/')) {
      try {
        const u = username || localStorage.getItem('iveo_current_username') || 'owner';
        const res = await fetch('/api/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, dataUrl: finalAvatarUrl }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.avatarUrl) {
            finalAvatarUrl = json.avatarUrl;
          }
        }
      } catch (uploadErr) {
        console.warn('Avatar server upload note:', uploadErr);
      }
    }

    await updatePreferences({
      displayName: profile.displayName !== undefined ? profile.displayName : preferences.displayName,
      bio: profile.bio !== undefined ? profile.bio : preferences.bio,
      avatarUrl: finalAvatarUrl !== undefined ? finalAvatarUrl : preferences.avatarUrl,
      category: profile.category !== undefined ? profile.category : preferences.category,
    });
  };

  const updateSocials = async (newSocials: Record<string, string>): Promise<void> => {
    await updatePreferences({
      socials: newSocials,
    });
  };

  return {
    isLoaded: true,
    isSignedIn: true,
    username,
    displayName,
    bio,
    imageUrl,
    category,
    primaryEmail,
    vibeId: preferences.vibeId,
    buttonShape: preferences.buttonShape,
    socials,
    socialsPosition: preferences.socialsPosition || 'top',
    onboardingComplete,
    plan,
    isPro,
    hideIveoFooter: hideFooter,
    hideIvioFooter: hideFooter,
    updateUsername,
    updatePreferences,
    updateProfile,
    updateSocials,
    signOut: async () => {
      await signOut();
    },
  };
}

export function useIveoSession(): IveoSession {
  if (!HAS_CLERK_KEY) {
    return FALLBACK_SESSION;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkSession();
}

export const useIvioSession = useIveoSession;

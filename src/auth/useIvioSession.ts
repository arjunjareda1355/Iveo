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
  onboardingComplete: false,
  plan: 'free',
  isPro: false,
  hideIveoFooter: false,
  hideIvioFooter: false,
  updateUsername: async () => {},
  updatePreferences: async () => {},
  updateProfile: async () => {},
  signOut: async () => {},
};

function useClerkSession(): IveoSession {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const { signOut } = useClerk();

  const isLoaded = authLoaded && userLoaded;

  if (!isLoaded || !isSignedIn || !user) {
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
      onboardingComplete: false,
      plan: 'free',
      isPro: false,
      hideIveoFooter: false,
      hideIvioFooter: false,
      updateUsername: async () => {},
      updatePreferences: async () => {},
      updateProfile: async () => {},
      signOut: async () => {
        await signOut();
      },
    };
  }

  const rawUsername = user.username || '';
  const normalizedUsername = normalizeUsername(rawUsername);
  const username = normalizedUsername || null;

  const preferences = parsePreferences(user.unsafeMetadata);

  const displayName =
    preferences.displayName ||
    user.fullName ||
    username ||
    'Your name';

  const bio = preferences.bio || '';

  // Avatar can come from custom uploaded avatarUrl or Clerk image
  const candidateAvatar = preferences.avatarUrl || user.imageUrl;
  const imageUrl = isAllowedAvatarUrl(candidateAvatar) ? candidateAvatar : null;
  const category = preferences.category || null;

  const primaryEmail = user.primaryEmailAddress?.emailAddress || null;

  const isUsernameValid = username ? validateUsername(username).ok : false;
  const onboardingComplete = preferences.onboardingComplete === true && isUsernameValid;

  const plan = preferences.plan;
  const isPro = plan === 'pro';
  const hideFooter = preferences.hideIveoFooter || preferences.hideIvioFooter || false;

  const updateUsername = async (newUsername: string): Promise<void> => {
    await user.update({ username: newUsername });
  };

  const updatePreferences = async (patch: Partial<Omit<IveoPreferences, 'plan'>>): Promise<void> => {
    const currentMeta = (user.unsafeMetadata && typeof user.unsafeMetadata === 'object'
      ? user.unsafeMetadata
      : {}) as Record<string, unknown>;

    const { plan: _ignoredPlan, ...safePatch } = patch as any;

    const merged = {
      ...currentMeta,
      ...safePatch,
    };

    await user.update({
      unsafeMetadata: merged,
    });

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
          })
        );
      } catch {}
    }
  };

  const updateProfile = async (profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    category?: string | null;
  }): Promise<void> => {
    await updatePreferences({
      displayName: profile.displayName !== undefined ? profile.displayName : preferences.displayName,
      bio: profile.bio !== undefined ? profile.bio : preferences.bio,
      avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : preferences.avatarUrl,
      category: profile.category !== undefined ? profile.category : preferences.category,
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
    onboardingComplete,
    plan,
    isPro,
    hideIveoFooter: hideFooter,
    hideIvioFooter: hideFooter,
    updateUsername,
    updatePreferences,
    updateProfile,
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

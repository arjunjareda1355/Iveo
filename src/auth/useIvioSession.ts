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
  imageUrl: string | null;
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
  signOut: () => Promise<void>;
}

export type IvioSession = IveoSession;

const FALLBACK_SESSION: IveoSession = {
  isLoaded: true,
  isSignedIn: false,
  username: null,
  displayName: 'Your name',
  imageUrl: null,
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
      imageUrl: null,
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
      signOut: async () => {
        await signOut();
      },
    };
  }

  const rawUsername = user.username || '';
  const normalizedUsername = normalizeUsername(rawUsername);
  const username = normalizedUsername || null;
  const displayName = username || user.fullName || 'Your name';
  const imageUrl = isAllowedAvatarUrl(user.imageUrl) ? user.imageUrl : null;
  const primaryEmail = user.primaryEmailAddress?.emailAddress || null;

  const preferences = parsePreferences(user.unsafeMetadata);

  const isUsernameValid = username ? validateUsername(username).ok : false;
  const onboardingComplete = preferences.onboardingComplete === true && isUsernameValid;

  const plan = preferences.plan;
  const isPro = plan === 'pro';
  const hideFooter = preferences.hideIveoFooter || preferences.hideIvioFooter || false;

  const updateUsername = async (newUsername: string): Promise<void> => {
    await user.update({ username: newUsername });
  };

  const updatePreferences = async (patch: Partial<Omit<IveoPreferences, 'plan'>>): Promise<void> => {
    // unsafeMetadata holds client-writable preferences. Never write plan here (server/database authoritative).
    const currentMeta = (user.unsafeMetadata && typeof user.unsafeMetadata === 'object'
      ? user.unsafeMetadata
      : {}) as Record<string, unknown>;

    // Ensure plan is not included in client update payloads
    const { plan: _ignoredPlan, ...safePatch } = patch as any;

    await user.update({
      unsafeMetadata: {
        ...currentMeta,
        ...safePatch,
      },
    });
  };

  return {
    isLoaded: true,
    isSignedIn: true,
    username,
    displayName,
    imageUrl,
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

// Backward-compatible alias
export const useIvioSession = useIveoSession;

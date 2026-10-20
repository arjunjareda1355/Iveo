import { useAuth, useUser, useClerk } from '@clerk/react';
import { HAS_CLERK_KEY } from '../lib/env';
import { VibeId } from '../lib/vibes';
import {
  ButtonShape,
  IvioPreferences,
  parsePreferences,
  DEFAULT_PREFERENCES,
} from '../lib/preferences';
import { validateUsername, normalizeUsername } from '../lib/username-rules';

export interface IvioSession {
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
  hideIvioFooter: boolean;
  updateUsername: (newUsername: string) => Promise<void>;
  updatePreferences: (patch: Partial<Omit<IvioPreferences, 'plan'>>) => Promise<void>;
  signOut: () => Promise<void>;
}

const FALLBACK_SESSION: IvioSession = {
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
  hideIvioFooter: false,
  updateUsername: async () => {},
  updatePreferences: async () => {},
  signOut: async () => {},
};

function useClerkSession(): IvioSession {
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
  const imageUrl = user.imageUrl || null;
  const primaryEmail = user.primaryEmailAddress?.emailAddress || null;

  const preferences = parsePreferences(user.unsafeMetadata);

  const isUsernameValid = username ? validateUsername(username).ok : false;
  const onboardingComplete = preferences.onboardingComplete === true && isUsernameValid;

  const plan = preferences.plan;
  const isPro = plan === 'pro';
  const hideIvioFooter = preferences.hideIvioFooter;

  const updateUsername = async (newUsername: string): Promise<void> => {
    await user.update({ username: newUsername });
  };

  const updatePreferences = async (patch: Partial<Omit<IvioPreferences, 'plan'>>): Promise<void> => {
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
    hideIvioFooter,
    updateUsername,
    updatePreferences,
    signOut: async () => {
      await signOut();
    },
  };
}

export function useIvioSession(): IvioSession {
  if (!HAS_CLERK_KEY) {
    return FALLBACK_SESSION;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkSession();
}

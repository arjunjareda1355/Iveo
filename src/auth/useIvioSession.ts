import { useEffect, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { HAS_CLERK_KEY } from '../lib/env';
import { VibeId } from '../lib/vibes';
import {
  ButtonShape,
  BackgroundConfig,
  IveoPreferences,
  parsePreferences,
  DEFAULT_PREFERENCES,
} from '../lib/preferences';
import { validateUsername, normalizeUsername } from '../lib/username-rules';
import { isAllowedAvatarUrl } from '../lib/avatar';
import { isOwnerEmail } from '../lib/plan';
import { getSubdomainFromHostname } from '../lib/site';
import { syncProfileToFirebase } from '../lib/firebaseSync';

export interface IveoSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  username: string | null;
  displayName: string;
  bio: string;
  imageUrl: string | null;
  avatarType: 'default' | 'uploaded';
  avatarId: string | null;
  category: string | null;
  primaryEmail: string | null;
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  socialsPosition: 'top' | 'bottom' | 'both';
  background?: BackgroundConfig | null;
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
  whatsappNumber?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
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
    avatarType?: 'default' | 'uploaded';
    avatarId?: string | null;
    category?: string | null;
    background?: BackgroundConfig | null;
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
  avatarType: 'default',
  avatarId: null,
  category: null,
  primaryEmail: null,
  vibeId: DEFAULT_PREFERENCES.vibeId,
  buttonShape: DEFAULT_PREFERENCES.buttonShape,
  socials: {},
  socialsPosition: 'top',
  background: null,
  googleAnalyticsId: null,
  metaPixelId: null,
  whatsappNumber: null,
  customSeoTitle: null,
  customSeoDescription: null,
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

  // Server-side profile data retrieved via /api/me for cross-browser synchronization
  const [serverProfile, setServerProfile] = useState<any | null>(null);

  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object') {
        setServerProfile((prev: any) => ({ ...(prev || {}), ...detail }));
      }
    };
    window.addEventListener('iveo-server-profile-sync', onSync);
    return () => window.removeEventListener('iveo-server-profile-sync', onSync);
  }, []);

  // Fetch claimed profile from database whenever activeUser loads
  useEffect(() => {
    if (!activeUser?.id) {
      setServerProfile(null);
      return;
    }

    let isMounted = true;
    const fetchServerProfile = async () => {
      try {
        const email = activeUser.primaryEmailAddress?.emailAddress || '';
        const res = await fetch(
          `/api/me?userId=${encodeURIComponent(activeUser.id)}&email=${encodeURIComponent(email)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.claimed && data.username && isMounted) {
            setServerProfile(data.profile);

            // Sync username back to Clerk unsafeMetadata if it was missing or out of sync
            const currentMeta = (activeUser.unsafeMetadata && typeof activeUser.unsafeMetadata === 'object'
              ? activeUser.unsafeMetadata
              : {}) as Record<string, unknown>;

            if (currentMeta.username !== data.username) {
              try {
                await activeUser.update({
                  unsafeMetadata: {
                    ...currentMeta,
                    username: data.username,
                    onboardingComplete: true,
                  },
                });
              } catch {}
            }
          }
        }
      } catch {}
    };

    fetchServerProfile();
    return () => {
      isMounted = false;
    };
  }, [activeUser?.id, activeUser?.primaryEmailAddress?.emailAddress]);

  // Support reading username from serverProfile, user.username or fallback to unsafeMetadata.username
  const meta = (activeUser?.unsafeMetadata && typeof activeUser.unsafeMetadata === 'object'
    ? activeUser.unsafeMetadata
    : {}) as Record<string, unknown>;

  const rawUsername =
    serverProfile?.username ||
    activeUser?.username ||
    (typeof meta.username === 'string' ? meta.username : '') ||
    (typeof meta.preferredUsername === 'string' ? meta.preferredUsername : '') ||
    '';
  const normalizedUsername = normalizeUsername(rawUsername);
  const username = normalizedUsername || null;

  const preferences = parsePreferences(activeUser?.unsafeMetadata);

  const displayName =
    serverProfile?.displayName ||
    preferences.displayName ||
    activeUser?.fullName ||
    username ||
    'Your name';

  const bio = serverProfile?.bio !== undefined ? serverProfile.bio : (preferences.bio || '');

  // Avatar can come from server profile, custom uploaded avatarUrl or Clerk image
  const candidateAvatar = serverProfile?.avatarUrl || preferences.avatarUrl || activeUser?.imageUrl;
  const imageUrl: string | null = (isAllowedAvatarUrl(candidateAvatar) ? candidateAvatar : null) ?? null;
  const category = preferences.category || null;
  const socials = serverProfile?.socials || preferences.socials || {};

  const primaryEmail = activeUser?.primaryEmailAddress?.emailAddress || null;

  const isUsernameValid = username ? validateUsername(username).ok : false;
  const isProfileSetup =
    isUsernameValid &&
    (preferences.onboardingComplete === true ||
      Boolean(serverProfile && serverProfile.username) ||
      (typeof window !== 'undefined' && (
        localStorage.getItem(`iveo_onboarding_done_${activeUser?.id}`) === 'true' ||
        localStorage.getItem(`iveo_onboarding_done_${username}`) === 'true' ||
        localStorage.getItem('iveo_profile_completed') === 'true' ||
        localStorage.getItem(`iveo_profile_${username}`) !== null
      )));
  const onboardingComplete = Boolean(isProfileSetup);

  const isOwner = primaryEmail ? isOwnerEmail(primaryEmail) : false;
  const plan: 'free' | 'pro' = isOwner || serverProfile?.plan === 'pro' ? 'pro' : preferences.plan;
  const isPro = isOwner || plan === 'pro';
  const hideFooter = serverProfile?.hideFooter ?? (preferences.hideIveoFooter || preferences.hideIvioFooter || false);
  const socialsPosition: 'top' | 'bottom' | 'both' =
    serverProfile?.socialsPosition || preferences.socialsPosition || 'top';
  const vibeId = serverProfile?.vibeId || preferences.vibeId || DEFAULT_PREFERENCES.vibeId;
  const buttonShape = serverProfile?.buttonShape || preferences.buttonShape || DEFAULT_PREFERENCES.buttonShape;
  const googleAnalyticsId =
    serverProfile?.googleAnalyticsId !== undefined
      ? serverProfile.googleAnalyticsId
      : (preferences.googleAnalyticsId || null);
  const metaPixelId =
    serverProfile?.metaPixelId !== undefined
      ? serverProfile.metaPixelId
      : (preferences.metaPixelId || null);
  const whatsappNumber =
    serverProfile?.whatsappNumber !== undefined
      ? serverProfile.whatsappNumber
      : (preferences.whatsappNumber || null);
  const customSeoTitle =
    serverProfile?.customSeoTitle !== undefined
      ? serverProfile.customSeoTitle
      : (preferences.customSeoTitle || null);
  const customSeoDescription =
    serverProfile?.customSeoDescription !== undefined
      ? serverProfile.customSeoDescription
      : (preferences.customSeoDescription || null);

  const syncToServer = async (payload: Record<string, unknown>) => {
    if (!activeUser?.id) return;
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.id,
          'x-user-email': primaryEmail || '',
        },
        body: JSON.stringify({
          ...payload,
          userId: activeUser.id,
          primaryEmail,
        }),
      });
    } catch {
      // Background sync, suppress errors
    }
  };

  // Safe migration of legacy localStorage profile data to database
  useEffect(() => {
    if (!activeUser?.id || !username) return;

    const migrationKey = `iveo_migrated_${activeUser.id}`;
    if (typeof window !== 'undefined' && !localStorage.getItem(migrationKey)) {
      try {
        const rawLegacy = localStorage.getItem(`iveo_profile_${username}`);
        const rawBlocks = localStorage.getItem(`iveo_blocks_${username}`);
        if (rawLegacy || rawBlocks) {
          const legacyProf = rawLegacy ? JSON.parse(rawLegacy) : {};
          const legacyBlocks = rawBlocks ? JSON.parse(rawBlocks) : [];
          fetch('/api/migrate-legacy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: activeUser.id,
              username,
              primaryEmail,
              profile: legacyProf,
              blocks: legacyBlocks,
            }),
          })
            .then(() => {
              localStorage.setItem(migrationKey, 'true');
            })
            .catch(() => {});
        } else {
          localStorage.setItem(migrationKey, 'true');
        }
      } catch {
        localStorage.setItem(migrationKey, 'true');
      }
    }
  }, [activeUser?.id, username, primaryEmail]);

  // Automatic sync on session load to ensure Azure SQL and server store have current user profile
  useEffect(() => {
    if (activeUser?.id && username) {
      syncToServer({
        username,
        displayName: displayName || username,
        bio,
        avatarUrl: imageUrl,
        vibeId,
        buttonShape,
        socials,
        socialsPosition,
        googleAnalyticsId,
        metaPixelId,
        whatsappNumber,
        customSeoTitle,
        customSeoDescription,
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
    googleAnalyticsId,
    metaPixelId,
    whatsappNumber,
    customSeoTitle,
    customSeoDescription,
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
      avatarType: 'default',
      avatarId: null,
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

    // 1. Atomically claim username on database FIRST
    const claimRes = await fetch('/api/claim-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id,
        'x-user-email': primaryEmail || '',
      },
      body: JSON.stringify({
        userId: currentUser.id,
        username: clean,
        primaryEmail,
        displayName: displayName || clean,
        bio,
        avatarUrl: imageUrl,
        vibeId: preferences.vibeId,
        buttonShape: preferences.buttonShape,
        socials,
        socialsPosition: preferences.socialsPosition || 'top',
        plan: isPro ? 'pro' : plan,
        hideFooter,
      }),
    });

    const claimData = await claimRes.json();
    if (!claimRes.ok || !claimData.ok) {
      throw new Error(claimData.message || 'That address is unavailable. Try another.');
    }

    // 2. Set serverProfile state immediately
    setServerProfile((prev: any) => ({
      ...(prev || {}),
      userId: currentUser.id,
      username: clean,
      displayName: displayName || clean,
    }));

    // 3. Write to Clerk unsafeMetadata
    const currentMeta = (currentUser.unsafeMetadata && typeof currentUser.unsafeMetadata === 'object'
      ? currentUser.unsafeMetadata
      : {}) as Record<string, unknown>;

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

    // 4. Try updating top-level Clerk username (if enabled in Clerk dashboard settings)
    try {
      await currentUser.update({ username: clean });
    } catch {}
  };

  const updatePreferences = async (patch: Partial<Omit<IveoPreferences, 'plan'>>): Promise<void> => {
    const currentMeta = (currentUser.unsafeMetadata && typeof currentUser.unsafeMetadata === 'object'
      ? currentUser.unsafeMetadata
      : {}) as Record<string, unknown>;

    const { plan: _ignoredPlan, ...safePatch } = patch as any;

    // 1. Immediately update serverProfile React state for immediate UI consistency across all hooks
    setServerProfile((prev: any) => ({
      ...(prev || {}),
      ...safePatch,
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iveo-server-profile-sync', { detail: safePatch }));
    }

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

    if (safePatch.onboardingComplete) {
      try {
        localStorage.setItem(`iveo_onboarding_done_${currentUser.id}`, 'true');
      } catch {}
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
            avatarType: merged.avatarType !== undefined ? merged.avatarType : parsed.avatarType,
            avatarId: merged.avatarId !== undefined ? merged.avatarId : parsed.avatarId,
            socials: merged.socials !== undefined ? merged.socials : parsed.socials,
            socialsPosition: merged.socialsPosition || parsed.socialsPosition || 'top',
            googleAnalyticsId: merged.googleAnalyticsId !== undefined ? merged.googleAnalyticsId : parsed.googleAnalyticsId,
            metaPixelId: merged.metaPixelId !== undefined ? merged.metaPixelId : parsed.metaPixelId,
            whatsappNumber: merged.whatsappNumber !== undefined ? merged.whatsappNumber : parsed.whatsappNumber,
            customSeoTitle: merged.customSeoTitle !== undefined ? merged.customSeoTitle : parsed.customSeoTitle,
            customSeoDescription: merged.customSeoDescription !== undefined ? merged.customSeoDescription : parsed.customSeoDescription,
          })
        );
      } catch {}

      // Await sync to Azure SQL / Server database
      await syncToServer({
        username,
        displayName: merged.displayName !== undefined ? merged.displayName : displayName,
        bio: merged.bio !== undefined ? merged.bio : bio,
        avatarUrl: merged.avatarUrl !== undefined ? merged.avatarUrl : imageUrl,
        avatarType: merged.avatarType || (merged.avatarId ? 'default' : (merged.avatarUrl ? 'uploaded' : 'default')),
        avatarId: merged.avatarId || null,
        vibeId: merged.vibeId || preferences.vibeId,
        buttonShape: merged.buttonShape || preferences.buttonShape,
        socials: merged.socials !== undefined ? merged.socials : socials,
        socialsPosition: (merged.socialsPosition as any) || socialsPosition || 'top',
        googleAnalyticsId: merged.googleAnalyticsId !== undefined ? merged.googleAnalyticsId : googleAnalyticsId,
        metaPixelId: merged.metaPixelId !== undefined ? merged.metaPixelId : metaPixelId,
        whatsappNumber: merged.whatsappNumber !== undefined ? merged.whatsappNumber : whatsappNumber,
        customSeoTitle: merged.customSeoTitle !== undefined ? merged.customSeoTitle : customSeoTitle,
        customSeoDescription: merged.customSeoDescription !== undefined ? merged.customSeoDescription : customSeoDescription,
        primaryEmail,
        plan: isPro ? 'pro' : plan,
        hideFooter: merged.hideIveoFooter || merged.hideIvioFooter || hideFooter,
      });

      // Background Firestore persistence
      if (username || currentUser.id) {
        syncProfileToFirebase(username || currentUser.id, {
          username,
          displayName: merged.displayName !== undefined ? merged.displayName : displayName,
          bio: merged.bio !== undefined ? merged.bio : bio,
          avatarUrl: merged.avatarUrl !== undefined ? merged.avatarUrl : imageUrl,
          avatarType: merged.avatarType || (merged.avatarId ? 'default' : (merged.avatarUrl ? 'uploaded' : 'default')),
          avatarId: merged.avatarId || null,
          vibeId: merged.vibeId || preferences.vibeId,
          buttonShape: merged.buttonShape || preferences.buttonShape,
          socials: merged.socials !== undefined ? merged.socials : socials,
          socialsPosition: (merged.socialsPosition as any) || socialsPosition || 'top',
          googleAnalyticsId: merged.googleAnalyticsId !== undefined ? merged.googleAnalyticsId : googleAnalyticsId,
          metaPixelId: merged.metaPixelId !== undefined ? merged.metaPixelId : metaPixelId,
          whatsappNumber: merged.whatsappNumber !== undefined ? merged.whatsappNumber : whatsappNumber,
          customSeoTitle: merged.customSeoTitle !== undefined ? merged.customSeoTitle : customSeoTitle,
          customSeoDescription: merged.customSeoDescription !== undefined ? merged.customSeoDescription : customSeoDescription,
          primaryEmail,
          plan: isPro ? 'pro' : plan,
        }).catch(() => {});
      }
    }
  };

  const updateProfile = async (profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    avatarType?: 'default' | 'uploaded';
    avatarId?: string | null;
    category?: string | null;
    background?: BackgroundConfig | null;
  }): Promise<void> => {
    let finalAvatarUrl = profile.avatarUrl;
    let finalAvatarType = profile.avatarType;
    let finalAvatarId = profile.avatarId;

    // If a base64 data URL was passed, upload it to the server backend first
    // to keep Clerk metadata well below the 8 KB limit and fit in SQL columns
    if (finalAvatarUrl && finalAvatarUrl.startsWith('data:image/')) {
      try {
        const u = username || localStorage.getItem('iveo_current_username') || 'owner';
        const res = await fetch('/api/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
            'x-user-email': primaryEmail || '',
          },
          body: JSON.stringify({
            userId: currentUser.id,
            username: u,
            dataUrl: finalAvatarUrl,
            primaryEmail,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.avatarUrl) {
            finalAvatarUrl = json.avatarUrl;
            finalAvatarType = 'uploaded';
            finalAvatarId = null;
          }
        }
      } catch (uploadErr) {
        console.warn('Avatar server upload note:', uploadErr);
      }
    }

    // Immediately update local React state
    setServerProfile((prev: any) => ({
      ...(prev || {}),
      ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
      ...(finalAvatarUrl !== undefined ? { avatarUrl: finalAvatarUrl } : {}),
      ...(finalAvatarType !== undefined ? { avatarType: finalAvatarType } : {}),
      ...(finalAvatarId !== undefined ? { avatarId: finalAvatarId } : {}),
      ...(profile.background !== undefined ? { background: profile.background } : {}),
    }));

    await updatePreferences({
      displayName: profile.displayName !== undefined ? profile.displayName : preferences.displayName,
      bio: profile.bio !== undefined ? profile.bio : preferences.bio,
      avatarUrl: finalAvatarUrl !== undefined ? finalAvatarUrl : preferences.avatarUrl,
      avatarType: finalAvatarType !== undefined ? finalAvatarType : (serverProfile?.avatarType || 'default'),
      avatarId: finalAvatarId !== undefined ? finalAvatarId : (serverProfile?.avatarId || null),
      category: profile.category !== undefined ? profile.category : preferences.category,
      background: profile.background !== undefined ? profile.background : preferences.background,
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
    avatarType: serverProfile?.avatarType || (serverProfile?.avatarId ? 'default' : (serverProfile?.avatarUrl ? 'uploaded' : 'default')),
    avatarId: serverProfile?.avatarId || null,
    category,
    primaryEmail,
    vibeId,
    buttonShape,
    socials,
    socialsPosition,
    background: serverProfile?.background || preferences.background || null,
    googleAnalyticsId,
    metaPixelId,
    whatsappNumber,
    customSeoTitle,
    customSeoDescription,
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

const DEMO_AVATAR_URL =
  'https://i.postimg.cc/Rh5vdyVb/file-0000000002448211a254292ad6932ab5.png';
const DEMO_STORAGE_KEY = 'iveo_demo_session_maya';

function useDemoSession(): IveoSession {
  const [demoState, setDemoState] = useState<{
    username: string;
    displayName: string;
    bio: string;
    imageUrl: string | null;
    vibeId: VibeId;
    buttonShape: ButtonShape | null;
    socials: Record<string, string>;
    socialsPosition: 'top' | 'bottom' | 'both';
    background: BackgroundConfig | null;
    googleAnalyticsId: string | null;
    metaPixelId: string | null;
    whatsappNumber: string | null;
    customSeoTitle: string | null;
    customSeoDescription: string | null;
    hideFooter: boolean;
  }>(() => {
    const defaults = {
      username: 'maya',
      displayName: 'Maya Ellis',
      bio: 'Illustrator and writer. Zines, prints and the occasional essay.',
      imageUrl: DEMO_AVATAR_URL,
      vibeId: DEFAULT_PREFERENCES.vibeId,
      buttonShape: DEFAULT_PREFERENCES.buttonShape,
      socials: {} as Record<string, string>,
      socialsPosition: 'top' as 'top' | 'bottom' | 'both',
      background: null as BackgroundConfig | null,
      googleAnalyticsId: null as string | null,
      metaPixelId: null as string | null,
      whatsappNumber: null as string | null,
      customSeoTitle: null as string | null,
      customSeoDescription: null as string | null,
      hideFooter: false,
    };

    if (typeof window === 'undefined') return defaults;
    try {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch {}
    return defaults;
  });

  useEffect(() => {
    const onDemoSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object') {
        setDemoState(detail);
      }
    };
    window.addEventListener('iveo-demo-session-sync', onDemoSync);
    return () => window.removeEventListener('iveo-demo-session-sync', onDemoSync);
  }, []);

  const persistDemo = (updater: (prev: typeof demoState) => typeof demoState) => {
    setDemoState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (typeof window !== 'undefined') {
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent('iveo-demo-session-sync', { detail: next }));
        });
      }
      return next;
    });
  };

  return {
    ...FALLBACK_SESSION,
    isLoaded: true,
    isSignedIn: true,
    onboardingComplete: true,
    username: demoState.username,
    displayName: demoState.displayName,
    bio: demoState.bio,
    imageUrl: demoState.imageUrl,
    vibeId: demoState.vibeId,
    buttonShape: demoState.buttonShape,
    socials: demoState.socials,
    socialsPosition: demoState.socialsPosition,
    background: demoState.background,
    googleAnalyticsId: demoState.googleAnalyticsId,
    metaPixelId: demoState.metaPixelId,
    whatsappNumber: demoState.whatsappNumber,
    customSeoTitle: demoState.customSeoTitle,
    customSeoDescription: demoState.customSeoDescription,
    isPro: true,
    plan: 'pro',
    hideIveoFooter: demoState.hideFooter,
    hideIvioFooter: demoState.hideFooter,
    updateUsername: async (newUsername: string) => {
      const clean = normalizeUsername(newUsername);
      if (clean) {
        persistDemo((prev) => ({ ...prev, username: clean }));
      }
    },
    updatePreferences: async (patch) => {
      persistDemo((prev) => ({
        ...prev,
        ...(patch.vibeId !== undefined ? { vibeId: patch.vibeId } : {}),
        ...(patch.buttonShape !== undefined ? { buttonShape: patch.buttonShape } : {}),
        ...(patch.socials !== undefined ? { socials: patch.socials } : {}),
        ...(patch.socialsPosition !== undefined ? { socialsPosition: patch.socialsPosition } : {}),
        ...(patch.background !== undefined ? { background: patch.background } : {}),
        ...(patch.googleAnalyticsId !== undefined ? { googleAnalyticsId: patch.googleAnalyticsId } : {}),
        ...(patch.metaPixelId !== undefined ? { metaPixelId: patch.metaPixelId } : {}),
        ...(patch.whatsappNumber !== undefined ? { whatsappNumber: patch.whatsappNumber } : {}),
        ...(patch.customSeoTitle !== undefined ? { customSeoTitle: patch.customSeoTitle } : {}),
        ...(patch.customSeoDescription !== undefined ? { customSeoDescription: patch.customSeoDescription } : {}),
        ...(patch.hideIveoFooter !== undefined || patch.hideIvioFooter !== undefined
          ? { hideFooter: Boolean(patch.hideIveoFooter ?? patch.hideIvioFooter) }
          : {}),
      }));
    },
    updateProfile: async (profile) => {
      persistDemo((prev) => ({
        ...prev,
        ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
        ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
        ...(profile.avatarUrl !== undefined ? { imageUrl: profile.avatarUrl } : {}),
        ...(profile.background !== undefined ? { background: profile.background } : {}),
      }));
    },
    updateSocials: async (newSocials) => {
      persistDemo((prev) => ({ ...prev, socials: newSocials }));
    },
  };
}

export function useIveoSession(): IveoSession {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useDemoSession();
    }
  }

  if (!HAS_CLERK_KEY) {
    return FALLBACK_SESSION;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkSession();
}

export const useIvioSession = useIveoSession;

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { HAS_CLERK_KEY } from '../lib/env';
import { VibeId } from '../lib/vibes';
import {
  ButtonShape,
  BackgroundConfig,
  LayoutSettings,
  IveoPreferences,
  parsePreferences,
  DEFAULT_PREFERENCES,
} from '../lib/preferences';
import type { FontSettings } from '../lib/fonts';
import type { ButtonColors } from '../lib/colors';
import type { BusinessCardConfig } from '../lib/businessCardConfig';
import { validateUsername, normalizeUsername } from '../lib/username-rules';
import { isAllowedAvatarUrl } from '../lib/avatar';
import {
  isOwnerEmail,
  resolveEffectivePlan,
  type PlanSource,
  type SubscriptionRecord,
} from '../lib/plan';
import { getSubdomainFromHostname } from '../lib/site';
import type { Appearance } from '../lib/appearance/types';
import { migrateLegacyProfileToAppearanceV2 } from '../lib/appearance/migrate';
import { buildAuthHeaders, registerClerkTokenGetter } from '../lib/clerkTokenBridge';

function broadcastProfileSync(username: string | null | undefined, type: 'profile' | 'blocks', updatedAt: string) {
  if (!username || typeof window === 'undefined') return;
  const clean = String(username).replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return;
  try {
    window.dispatchEvent(
      new CustomEvent('iveo_profile_sync', { detail: { username: clean, type, updatedAt } })
    );
  } catch {}
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('iveo_profile_sync');
      ch.postMessage({ username: clean, type, updatedAt });
      ch.close();
    }
  } catch {}
}

export interface IveoSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
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
  fontSettings?: FontSettings | null;
  buttonColors?: ButtonColors | null;
  layoutSettings?: LayoutSettings | null;
  businessCard?: BusinessCardConfig | null;
  appearance?: Appearance | null;
  updatedAt?: string | null;
  onboardingComplete: boolean;
  plan: 'free' | 'pro';
  isPro: boolean;
  planSource: PlanSource;
  createdAt: string | null;
  subscription: SubscriptionRecord | null;
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
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export type IvioSession = IveoSession;

const FALLBACK_SESSION: IveoSession = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
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
  fontSettings: null,
  buttonColors: null,
  layoutSettings: null,
  businessCard: null,
  appearance: null,
  updatedAt: null,
  onboardingComplete: false,
  plan: 'free',
  isPro: false,
  planSource: 'free',
  createdAt: null,
  subscription: null,
  hideIveoFooter: false,
  hideIvioFooter: false,
  updateUsername: async () => {},
  updatePreferences: async () => {},
  updateProfile: async () => {},
  updateSocials: async () => {},
  refreshSession: async () => {},
  signOut: async () => {},
};

function useClerkSession(): IveoSession {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const { signOut } = useClerk();

  const clerkLoaded = Boolean(authLoaded && userLoaded);
  const activeUser = clerkLoaded && isSignedIn && user ? user : null;

  useEffect(() => {
    registerClerkTokenGetter(isSignedIn ? () => getToken() : null);
    return () => registerClerkTokenGetter(null);
  }, [isSignedIn, getToken]);

  // Server-side profile data retrieved via /api/me for cross-browser synchronization
  const [serverProfile, setServerProfile] = useState<any | null>(null);
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);
  const hasFetchedServerProfile = !activeUser?.id || fetchedForUserId === activeUser.id;
  const isLoaded = clerkLoaded && (!activeUser || hasFetchedServerProfile);
  const syncQueueRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncDoneRef = useRef(false);
  const pendingPatchRef = useRef<Record<string, any>>({});
  const pendingClerkPatchRef = useRef<Record<string, any>>({});
  const pendingWaitersRef = useRef<Array<{ resolve: () => void; reject: (err: unknown) => void }>>([]);
  const inFlightSyncRef = useRef<Promise<void>>(Promise.resolve());
  const latestSnapshotRef = useRef<Record<string, any>>({});
  const flushSyncRef = useRef<(() => void) | null>(null);

  const refreshServerProfile = useCallback(async () => {
    if (!activeUser?.id) return;
    try {
      const email = activeUser.primaryEmailAddress?.emailAddress || '';
      const res = await fetch(
        `/api/me?userId=${encodeURIComponent(activeUser.id)}&email=${encodeURIComponent(email)}&_t=${Date.now()}`,
        { cache: 'no-cache' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.claimed && data.username && data.profile) {
          setServerProfile(data.profile);
          if (data.reactivated) {
            try {
              sessionStorage.setItem('iveo_account_reactivated', '1');
              window.dispatchEvent(new CustomEvent('iveo_account_reactivated'));
            } catch {}
          }
        } else if (data && data.ok === true && data.claimed === false) {
          setServerProfile(null);
        }
      }
    } catch {}
  }, [activeUser?.id, activeUser?.primaryEmailAddress?.emailAddress]);

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

  useEffect(() => {
    const onPageHide = () => {
      flushSyncRef.current?.();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flushSyncRef.current?.();
    };
  }, []);

  // Fetch claimed profile from database (with 3s timeout & direct Firestore fallback) whenever activeUser loads
  useEffect(() => {
    if (!activeUser?.id) {
      setServerProfile(null);
      setFetchedForUserId(null);
      initialSyncDoneRef.current = false;
      return;
    }

    let isMounted = true;
    const fetchServerProfile = async () => {
      let hydratedProfile: any | null = null;
      let serverConfirmedUnclaimed = false;
      let serverPurgedExpired = false;
      const email = activeUser.primaryEmailAddress?.emailAddress || '';
      const cleanEmail = email.toLowerCase().trim();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(
            `/api/me?userId=${encodeURIComponent(activeUser.id)}&email=${encodeURIComponent(email)}`,
            { signal: controller.signal, cache: 'no-cache' }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.claimed && data.username && data.profile) {
              hydratedProfile = data.profile;
              if (data.reactivated) {
                try {
                  sessionStorage.setItem('iveo_account_reactivated', '1');
                  window.dispatchEvent(new CustomEvent('iveo_account_reactivated'));
                } catch {}
              }
            } else if (data && data.ok === true && data.claimed === false) {
              serverConfirmedUnclaimed = true;
              serverPurgedExpired = Boolean(data.purgedExpired);
            }
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {}

      // Parallelized Direct Firestore fallback ONLY when /api/me failed or did not confirm unclaimed
      if (!hydratedProfile && !serverConfirmedUnclaimed) {
        try {
          const { doc, getDoc, getDocs, collection, query, where } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');

          const uidPromise = getDoc(doc(db, 'users', activeUser.id))
            .then((d) => (d.exists() && d.data()?.username && d.data()?.status !== 'deleted' ? d.data() : null))
            .catch(() => null);

          const userQueryPromise = getDocs(query(collection(db, 'users'), where('userId', '==', activeUser.id)))
            .then((snap) => {
              for (const d of snap.docs) {
                const dData = d.data();
                if (dData?.username && dData?.status !== 'deleted') return dData;
              }
              return null;
            })
            .catch(() => null);

          const claimsPromise = getDocs(query(collection(db, 'claims'), where('userId', '==', activeUser.id)))
            .then(async (snap) => {
              for (const d of snap.docs) {
                const cData = d.data();
                if (cData?.status !== 'deleted') {
                  const uname = String(cData.username || d.id || '').replace(/^@+/, '').toLowerCase().trim();
                  if (uname) {
                    const uDoc = await getDoc(doc(db, 'users', uname)).catch(() => null);
                    return uDoc && uDoc.exists() ? uDoc.data() : { username: uname, userId: activeUser.id, displayName: uname };
                  }
                }
              }
              return null;
            })
            .catch(() => null);

          const emailPromise = cleanEmail
            ? getDocs(query(collection(db, 'users'), where('primaryEmail', '==', cleanEmail)))
                .then((snap) => {
                  for (const d of snap.docs) {
                    const dData = d.data();
                    if (dData?.username && dData?.status !== 'deleted') return dData;
                  }
                  return null;
                })
                .catch(() => null)
            : Promise.resolve(null);

          const results = await Promise.race([
            Promise.all([uidPromise, userQueryPromise, claimsPromise, emailPromise]),
            new Promise<null[]>((resolve) => setTimeout(() => resolve([null, null, null, null]), 3000)),
          ]);
          hydratedProfile = results.find((r) => Boolean(r && r.username)) || null;
        } catch {}
      }

      if (hydratedProfile && hydratedProfile.username && isMounted) {
        const cleanUname = String(hydratedProfile.username).replace(/^@+/, '').toLowerCase().trim();
        const normalizedHydrated = { ...hydratedProfile, username: cleanUname };
        setServerProfile(normalizedHydrated);

        const currentMeta = (activeUser.unsafeMetadata && typeof activeUser.unsafeMetadata === 'object'
          ? activeUser.unsafeMetadata
          : {}) as Record<string, unknown>;

        if (currentMeta.username !== cleanUname || currentMeta.onboardingComplete !== true) {
          activeUser.update({
            unsafeMetadata: {
              ...currentMeta,
              username: cleanUname,
              onboardingComplete: true,
            },
          }).catch(() => {});
        }
      } else if (serverConfirmedUnclaimed && isMounted) {
        setServerProfile(null);
        const currentMeta = (activeUser.unsafeMetadata && typeof activeUser.unsafeMetadata === 'object'
          ? activeUser.unsafeMetadata
          : {}) as Record<string, unknown>;
        const oldMetaUser = typeof currentMeta.username === 'string'
          ? currentMeta.username.replace(/^@+/, '').toLowerCase().trim()
          : '';
        try {
          if (oldMetaUser) {
            localStorage.removeItem(`iveo_profile_${oldMetaUser}`);
            localStorage.removeItem(`iveo_blocks_${oldMetaUser}`);
            localStorage.removeItem(`iveo_public_blocks_${oldMetaUser}`);
            localStorage.removeItem(`iveo_onboarding_done_${oldMetaUser}`);
            localStorage.removeItem(`iveo_themes_${oldMetaUser}`);
          }
          localStorage.removeItem(`iveo_onboarding_done_${activeUser.id}`);
          localStorage.removeItem('iveo_current_username');
          localStorage.removeItem('iveo_profile_completed');
        } catch {}
        if (currentMeta.username || currentMeta.onboardingComplete === true || serverPurgedExpired) {
          activeUser.update({
            unsafeMetadata: {
              ...currentMeta,
              username: null,
              preferredUsername: null,
              onboardingComplete: false,
            },
          }).catch(() => {});
        }
      }

      if (isMounted) {
        setFetchedForUserId(activeUser.id);
      }
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
  const isOwner = primaryEmail ? isOwnerEmail(primaryEmail) : false;

  const isUsernameValid = username ? validateUsername(username, { allowReserved: isOwner }).ok : false;
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

  const createdAtIso: string | null =
    serverProfile?.createdAt ||
    (activeUser?.createdAt ? new Date(activeUser.createdAt).toISOString() : null);
  const subscriptionRecord: SubscriptionRecord | null = serverProfile?.subscription || null;
  const resolvedPlan = resolveEffectivePlan({
    email: primaryEmail,
    storedPlan: serverProfile?.plan || preferences.plan,
    isProFlag: serverProfile?.isPro,
    createdAt: createdAtIso,
    subscription: subscriptionRecord,
  });
  const plan: 'free' | 'pro' = resolvedPlan.plan;
  const isPro = resolvedPlan.isPro;
  const planSource: PlanSource = resolvedPlan.planSource;
  const hideFooter = serverProfile?.hideFooter ?? (preferences.hideIveoFooter || preferences.hideIvioFooter || false);
  const socialsPosition: 'top' | 'bottom' | 'both' =
    serverProfile?.socialsPosition || preferences.socialsPosition || 'top';
  const vibeId = serverProfile?.vibeId || preferences.vibeId || DEFAULT_PREFERENCES.vibeId;
  const buttonShape =
    serverProfile?.buttonShape !== undefined
      ? serverProfile.buttonShape
      : (preferences.buttonShape ?? DEFAULT_PREFERENCES.buttonShape);
  const effectiveBackground =
    serverProfile?.background !== undefined ? serverProfile.background : (preferences.background || null);
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
  const fontSettings =
    serverProfile?.fontSettings !== undefined
      ? serverProfile.fontSettings
      : (preferences.fontSettings || null);
  const buttonColors =
    serverProfile?.buttonColors !== undefined
      ? serverProfile.buttonColors
      : (preferences.buttonColors || null);
  const layoutSettings =
    serverProfile?.layoutSettings !== undefined
      ? serverProfile.layoutSettings
      : (preferences.layoutSettings || null);
  const businessCard =
    serverProfile?.businessCard !== undefined
      ? serverProfile.businessCard
      : (preferences.businessCard || null);
  const rawAppearance =
    serverProfile?.appearance !== undefined
      ? serverProfile.appearance
      : (preferences.appearance || null);
  const appearance: Appearance = migrateLegacyProfileToAppearanceV2({
    vibeId,
    buttonShape,
    background: effectiveBackground,
    fontSettings,
    buttonColors,
    layoutSettings,
    appearance: rawAppearance,
    onboardingComplete,
  });
  const updatedAtIso: string | null = serverProfile?.updatedAt ?? preferences.updatedAt ?? null;

  latestSnapshotRef.current = {
    username,
    displayName,
    bio,
    imageUrl,
    avatarType: serverProfile?.avatarType || (serverProfile?.avatarId ? 'default' : (serverProfile?.avatarUrl ? 'uploaded' : 'default')),
    avatarId: serverProfile?.avatarId || null,
    vibeId,
    buttonShape,
    socials,
    socialsPosition,
    background: effectiveBackground,
    googleAnalyticsId,
    metaPixelId,
    whatsappNumber,
    customSeoTitle,
    customSeoDescription,
    fontSettings,
    buttonColors,
    layoutSettings,
    businessCard,
    appearance: rawAppearance,
    updatedAt: updatedAtIso,
    createdAtIso,
    primaryEmail,
    plan: isPro ? 'pro' : plan,
    isPro,
    hideFooter,
    meta,
    ...pendingPatchRef.current,
  };

  const syncToServer = async (payload: Record<string, unknown>, keepalive = false): Promise<string | null> => {
    if (!activeUser?.id) return null;
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
      'x-user-id': activeUser.id,
      'x-user-email': primaryEmail || '',
    });
    const res = await fetch('/api/profile', {
      method: 'POST',
      keepalive,
      headers,
      body: JSON.stringify({
        ...payload,
        userId: activeUser.id,
        primaryEmail,
      }),
    });
    if (!res.ok) {
      let errMsg = `profile_sync_failed (${res.status})`;
      try {
        const errData = await res.json();
        if (errData?.error) errMsg = String(errData.error);
      } catch {}
      throw new Error(errMsg);
    }
    try {
      const data = await res.json();
      if (data?.updatedAt) {
        return String(data.updatedAt);
      }
    } catch {}
    return null;
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

  // Backfill server only when serverProfile has no record yet (never overwrite hydrated serverProfile with defaults)
  useEffect(() => {
    if (!hasFetchedServerProfile || !activeUser?.id || !username || initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    if (serverProfile && serverProfile.username) {
      if (!serverProfile.primaryEmail && primaryEmail) {
        syncToServer({ username, primaryEmail }).catch(() => {});
      }
      return;
    }
    syncToServer({
      username,
      displayName: displayName || username,
      bio,
      avatarUrl: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : null,
      avatarType: latestSnapshotRef.current.avatarType,
      avatarId: latestSnapshotRef.current.avatarId,
      vibeId,
      buttonShape,
      socials,
      socialsPosition,
      background: effectiveBackground,
      googleAnalyticsId,
      metaPixelId,
      whatsappNumber,
      customSeoTitle,
      customSeoDescription,
      fontSettings,
      buttonColors,
      layoutSettings,
      businessCard,
      createdAt: createdAtIso,
      primaryEmail,
      plan: isPro ? 'pro' : plan,
      hideFooter,
    }).catch(() => {});
  }, [hasFetchedServerProfile, activeUser?.id, username, serverProfile]);

  if (!activeUser) {
    return {
      isLoaded,
      isSignedIn: false,
      userId: null,
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
      planSource: 'free',
      createdAt: null,
      subscription: null,
      hideIveoFooter: false,
      hideIvioFooter: false,
      updateUsername: async () => {},
      updatePreferences: async () => {},
      updateProfile: async () => {},
      updateSocials: async () => {},
      refreshSession: async () => {},
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
    const previousUsername = username && username !== clean ? username : null;

    // 1. Atomically claim username on database FIRST (server automatically releases previousUsername)
    const claimHeaders = await buildAuthHeaders({
      'Content-Type': 'application/json',
      'x-user-id': currentUser.id,
      'x-user-email': primaryEmail || '',
    });
    const claimRes = await fetch('/api/claim-username', {
      method: 'POST',
      headers: claimHeaders,
      body: JSON.stringify({
        userId: currentUser.id,
        username: clean,
        previousUsername,
        primaryEmail,
        displayName: displayName || clean,
        bio,
        avatarUrl: imageUrl,
        avatarType: serverProfile?.avatarType || (serverProfile?.avatarId ? 'default' : (imageUrl ? 'uploaded' : 'default')),
        avatarId: serverProfile?.avatarId || null,
        vibeId: vibeId || preferences.vibeId,
        buttonShape: buttonShape ?? preferences.buttonShape,
        socials,
        socialsPosition: socialsPosition || preferences.socialsPosition || 'top',
        background: effectiveBackground,
        googleAnalyticsId,
        metaPixelId,
        whatsappNumber,
        customSeoTitle,
        customSeoDescription,
        fontSettings,
        buttonColors,
        layoutSettings,
        businessCard,
        plan: isPro ? 'pro' : plan,
        hideFooter,
      }),
    });

    const claimData = await claimRes.json();
    if (!claimRes.ok || !claimData.ok) {
      throw new Error(claimData.message || 'That address is unavailable. Try another.');
    }

    // 2. Clean up old handle localStorage cache so stale data never lingers
    if (typeof window !== 'undefined') {
      try {
        if (previousUsername) {
          const oldProfile = localStorage.getItem(`iveo_profile_${previousUsername}`);
          if (oldProfile && !localStorage.getItem(`iveo_profile_${clean}`)) {
            localStorage.setItem(`iveo_profile_${clean}`, oldProfile);
          }
          const oldBlocks = localStorage.getItem(`iveo_blocks_${previousUsername}`);
          if (oldBlocks && !localStorage.getItem(`iveo_blocks_${clean}`)) {
            localStorage.setItem(`iveo_blocks_${clean}`, oldBlocks);
          }
          localStorage.removeItem(`iveo_profile_${previousUsername}`);
          localStorage.removeItem(`iveo_blocks_${previousUsername}`);
          localStorage.removeItem(`iveo_onboarding_done_${previousUsername}`);
          localStorage.removeItem(`ivio_profile_${previousUsername}`);
          localStorage.removeItem(`ivio_blocks_${previousUsername}`);
        }
        localStorage.setItem('iveo_current_username', clean);
      } catch {}
    }

    // 3. Set serverProfile state immediately
    setServerProfile((prev: any) => ({
      ...(prev || {}),
      userId: currentUser.id,
      username: clean,
      displayName: displayName || clean,
    }));

    // 4. Write to Clerk unsafeMetadata
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

    // 5. Try updating top-level Clerk username (if enabled in Clerk dashboard settings)
    try {
      await currentUser.update({ username: clean });
    } catch {}
  };

  const updatePreferences = (patch: Partial<Omit<IveoPreferences, 'plan'>>): Promise<void> => {
    const { plan: _ignoredPlan, ...safePatch } = patch as any;
    const optimisticUpdatedAt = new Date().toISOString();

    // 1. Synchronously merge into accumulated delta patch & snapshot so rapid clicks never lose prior edits
    pendingPatchRef.current = {
      ...pendingPatchRef.current,
      ...safePatch,
      updatedAt: optimisticUpdatedAt,
    };
    const prevSnap = latestSnapshotRef.current || {};
    const mergedSnap: Record<string, any> = {
      ...prevSnap,
      ...pendingPatchRef.current,
    };
    latestSnapshotRef.current = mergedSnap;

    // 2. Immediately update serverProfile React state for instantaneous UI feedback
    setServerProfile((prev: any) => ({
      ...(prev || {}),
      ...safePatch,
      updatedAt: optimisticUpdatedAt,
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('iveo-server-profile-sync', {
          detail: { ...safePatch, updatedAt: optimisticUpdatedAt },
        })
      );
    }

    // Keep Clerk unsafeMetadata well under its 8KB limit
    const sanitizeForClerk = (rawObj: Record<string, any>): Record<string, unknown> => {
      const cleaned: Record<string, unknown> = { ...rawObj };
      delete cleaned.avatarData;
      delete cleaned.appearance;
      if (typeof cleaned.avatarUrl === 'string' && cleaned.avatarUrl.startsWith('data:')) {
        delete cleaned.avatarUrl;
      }
      if (cleaned.background && typeof cleaned.background === 'object') {
        const bgObj = cleaned.background as Record<string, any>;
        cleaned.background = {
          type: bgObj.type,
          presetId: bgObj.presetId,
          ...(typeof bgObj.value === 'string' && !bgObj.value.startsWith('data:') && bgObj.value.length <= 240
            ? { value: bgObj.value }
            : {}),
        };
      }
      return cleaned;
    };
    pendingClerkPatchRef.current = {
      ...pendingClerkPatchRef.current,
      ...sanitizeForClerk(safePatch),
      updatedAt: optimisticUpdatedAt,
    };

    if (safePatch.onboardingComplete) {
      try {
        localStorage.setItem(`iveo_onboarding_done_${currentUser.id}`, 'true');
      } catch {}
    }

    const activeUsername = mergedSnap.username || username;
    const nextBackground = mergedSnap.background !== undefined ? mergedSnap.background : effectiveBackground;
    const nextButtonShape = mergedSnap.buttonShape !== undefined ? mergedSnap.buttonShape : buttonShape;
    const nextFontSettings = mergedSnap.fontSettings !== undefined ? mergedSnap.fontSettings : fontSettings;
    const nextButtonColors = mergedSnap.buttonColors !== undefined ? mergedSnap.buttonColors : buttonColors;
    const nextLayoutSettings = mergedSnap.layoutSettings !== undefined ? mergedSnap.layoutSettings : layoutSettings;
    const nextBusinessCard = mergedSnap.businessCard !== undefined ? mergedSnap.businessCard : businessCard;
    const nextAppearance = mergedSnap.appearance !== undefined ? mergedSnap.appearance : rawAppearance;

    const nextHideFooter =
      safePatch.hideIveoFooter !== undefined
        ? Boolean(safePatch.hideIveoFooter)
        : (safePatch.hideIvioFooter !== undefined
            ? Boolean(safePatch.hideIvioFooter)
            : (mergedSnap.hideFooter ?? hideFooter));

    if (activeUsername) {
      try {
        const raw = localStorage.getItem(`iveo_profile_${activeUsername}`) || '{}';
        const parsed = JSON.parse(raw);
        localStorage.setItem(
          `iveo_profile_${activeUsername}`,
          JSON.stringify({
            ...parsed,
            vibeId: mergedSnap.vibeId || parsed.vibeId,
            plan: isPro ? 'pro' : plan,
            isPro,
            isVerified: isPro,
            buttonShape: nextButtonShape !== undefined ? nextButtonShape : parsed.buttonShape,
            hideFooter: nextHideFooter,
            displayName: mergedSnap.displayName !== undefined ? mergedSnap.displayName : parsed.displayName,
            bio: mergedSnap.bio !== undefined ? mergedSnap.bio : parsed.bio,
            avatarUrl: mergedSnap.avatarUrl !== undefined ? mergedSnap.avatarUrl : (mergedSnap.imageUrl ?? parsed.avatarUrl),
            avatarType: mergedSnap.avatarType !== undefined ? mergedSnap.avatarType : parsed.avatarType,
            avatarId: mergedSnap.avatarId !== undefined ? mergedSnap.avatarId : parsed.avatarId,
            socials: mergedSnap.socials !== undefined ? mergedSnap.socials : parsed.socials,
            socialsPosition: mergedSnap.socialsPosition || parsed.socialsPosition || 'top',
            background: nextBackground,
            googleAnalyticsId: mergedSnap.googleAnalyticsId !== undefined ? mergedSnap.googleAnalyticsId : parsed.googleAnalyticsId,
            metaPixelId: mergedSnap.metaPixelId !== undefined ? mergedSnap.metaPixelId : parsed.metaPixelId,
            whatsappNumber: mergedSnap.whatsappNumber !== undefined ? mergedSnap.whatsappNumber : parsed.whatsappNumber,
            customSeoTitle: mergedSnap.customSeoTitle !== undefined ? mergedSnap.customSeoTitle : parsed.customSeoTitle,
            customSeoDescription: mergedSnap.customSeoDescription !== undefined ? mergedSnap.customSeoDescription : parsed.customSeoDescription,
            fontSettings: nextFontSettings,
            buttonColors: nextButtonColors,
            layoutSettings: nextLayoutSettings,
            businessCard: nextBusinessCard,
            appearance: nextAppearance,
            updatedAt: optimisticUpdatedAt,
          })
        );
      } catch {}
    }

    const executeFlush = (keepalive = false) => {
      if (syncQueueRef.current) {
        clearTimeout(syncQueueRef.current);
        syncQueueRef.current = null;
      }
      const accumulated = { ...pendingPatchRef.current };
      const clerkDelta = { ...pendingClerkPatchRef.current };
      const waiters = pendingWaitersRef.current;
      if (Object.keys(accumulated).length === 0 && waiters.length === 0) {
        return;
      }
      pendingPatchRef.current = {};
      pendingClerkPatchRef.current = {};
      pendingWaitersRef.current = [];

      const latest = latestSnapshotRef.current || {};
      const targetUsername = latest.username || username;
      const baseClerkMeta = (
        currentUser.unsafeMetadata && typeof currentUser.unsafeMetadata === 'object'
          ? currentUser.unsafeMetadata
          : {}
      ) as Record<string, unknown>;
      const clerkSnapshot = {
        ...baseClerkMeta,
        ...clerkDelta,
      };

      const runSync = async () => {
        try {
          await currentUser
            .update({ unsafeMetadata: clerkSnapshot })
            .catch((metaErr) => console.warn('Clerk metadata update note:', metaErr));

          if (targetUsername) {
            const deltaPayload: Record<string, unknown> = {
              username: targetUsername,
              createdAt: createdAtIso,
              primaryEmail,
              plan: isPro ? 'pro' : plan,
            };
            const copyIfPresent = (key: string, destKey = key) => {
              if (accumulated[key] !== undefined) {
                deltaPayload[destKey] = accumulated[key];
              }
            };
            copyIfPresent('displayName');
            copyIfPresent('bio');
            copyIfPresent('avatarUrl');
            copyIfPresent('avatarType');
            copyIfPresent('avatarId');
            copyIfPresent('vibeId');
            copyIfPresent('buttonShape');
            copyIfPresent('socials');
            copyIfPresent('socialsPosition');
            copyIfPresent('background');
            copyIfPresent('googleAnalyticsId');
            copyIfPresent('metaPixelId');
            copyIfPresent('whatsappNumber');
            copyIfPresent('customSeoTitle');
            copyIfPresent('customSeoDescription');
            copyIfPresent('fontSettings');
            copyIfPresent('buttonColors');
            copyIfPresent('layoutSettings');
            copyIfPresent('businessCard');
            copyIfPresent('appearance');
            copyIfPresent('status');
            copyIfPresent('isPublished');
            copyIfPresent('hideFromSearch');
            if (accumulated.hideIveoFooter !== undefined || accumulated.hideIvioFooter !== undefined) {
              deltaPayload.hideFooter = Boolean(accumulated.hideIveoFooter ?? accumulated.hideIvioFooter);
            }

            const confirmedUpdatedAt = (await syncToServer(deltaPayload, keepalive)) || optimisticUpdatedAt;
            latestSnapshotRef.current = {
              ...(latestSnapshotRef.current || {}),
              updatedAt: confirmedUpdatedAt,
            };
            setServerProfile((prev: any) =>
              prev ? { ...prev, updatedAt: confirmedUpdatedAt } : prev
            );

            try {
              const rawLocal = localStorage.getItem(`iveo_profile_${targetUsername}`) || '{}';
              const parsedLocal = JSON.parse(rawLocal);
              localStorage.setItem(
                `iveo_profile_${targetUsername}`,
                JSON.stringify({ ...parsedLocal, updatedAt: confirmedUpdatedAt })
              );
            } catch {}

            broadcastProfileSync(targetUsername, 'profile', confirmedUpdatedAt);
          }

          waiters.forEach((w) => w.resolve());
        } catch (err) {
          waiters.forEach((w) => w.reject(err));
        }
      };

      inFlightSyncRef.current = inFlightSyncRef.current.then(runSync, runSync);
    };

    flushSyncRef.current = () => executeFlush(true);

    // Coalesce rapid updates (60ms debounce) with strict FIFO async serialization and real awaited completion
    return new Promise<void>((resolve, reject) => {
      pendingWaitersRef.current.push({ resolve, reject });
      if (syncQueueRef.current) {
        clearTimeout(syncQueueRef.current);
      }
      syncQueueRef.current = setTimeout(() => executeFlush(false), 60);
    });
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
        const avatarHeaders = await buildAuthHeaders({
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-email': primaryEmail || '',
        });
        const res = await fetch('/api/avatar', {
          method: 'POST',
          headers: avatarHeaders,
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
    isLoaded,
    isSignedIn: true,
    userId: currentUser.id,
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
    background: effectiveBackground,
    googleAnalyticsId,
    metaPixelId,
    whatsappNumber,
    customSeoTitle,
    customSeoDescription,
    fontSettings,
    buttonColors,
    layoutSettings,
    businessCard,
    appearance,
    updatedAt: updatedAtIso,
    onboardingComplete,
    plan,
    isPro,
    planSource,
    createdAt: createdAtIso,
    subscription: subscriptionRecord,
    hideIveoFooter: hideFooter,
    hideIvioFooter: hideFooter,
    updateUsername,
    updatePreferences,
    updateProfile,
    updateSocials,
    refreshSession: refreshServerProfile,
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
    fontSettings: FontSettings | null;
    buttonColors: ButtonColors | null;
    layoutSettings: LayoutSettings | null;
    businessCard: BusinessCardConfig | null;
    appearance?: Appearance | null;
    updatedAt?: string | null;
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
      fontSettings: null as FontSettings | null,
      buttonColors: null as ButtonColors | null,
      layoutSettings: null as LayoutSettings | null,
      businessCard: null as BusinessCardConfig | null,
      appearance: null as Appearance | null,
      updatedAt: null as string | null,
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
      const nowIso = new Date().toISOString();
      const next = { ...updater(prev), updatedAt: nowIso };
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (typeof window !== 'undefined') {
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent('iveo-demo-session-sync', { detail: next }));
          broadcastProfileSync(next.username, 'profile', nowIso);
        });
      }
      return next;
    });
  };

  const demoAppearance = migrateLegacyProfileToAppearanceV2({
    vibeId: demoState.vibeId,
    buttonShape: demoState.buttonShape,
    background: demoState.background,
    fontSettings: demoState.fontSettings,
    buttonColors: demoState.buttonColors,
    layoutSettings: demoState.layoutSettings,
    appearance: demoState.appearance || null,
    onboardingComplete: true,
  });

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
    fontSettings: demoState.fontSettings,
    buttonColors: demoState.buttonColors,
    layoutSettings: demoState.layoutSettings,
    businessCard: demoState.businessCard,
    appearance: demoAppearance,
    updatedAt: demoState.updatedAt || null,
    isPro: true,
    plan: 'pro',
    planSource: 'early_bird',
    createdAt: '2026-06-01T00:00:00.000Z',
    subscription: null,
    hideIveoFooter: demoState.hideFooter,
    hideIvioFooter: demoState.hideFooter,
    refreshSession: async () => {},
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
        ...(patch.displayName !== undefined ? { displayName: patch.displayName || '' } : {}),
        ...(patch.bio !== undefined ? { bio: patch.bio || '' } : {}),
        ...(patch.avatarUrl !== undefined ? { imageUrl: patch.avatarUrl } : {}),
        ...(patch.socials !== undefined ? { socials: patch.socials } : {}),
        ...(patch.socialsPosition !== undefined ? { socialsPosition: patch.socialsPosition } : {}),
        ...(patch.background !== undefined ? { background: patch.background } : {}),
        ...(patch.googleAnalyticsId !== undefined ? { googleAnalyticsId: patch.googleAnalyticsId } : {}),
        ...(patch.metaPixelId !== undefined ? { metaPixelId: patch.metaPixelId } : {}),
        ...(patch.whatsappNumber !== undefined ? { whatsappNumber: patch.whatsappNumber } : {}),
        ...(patch.customSeoTitle !== undefined ? { customSeoTitle: patch.customSeoTitle } : {}),
        ...(patch.customSeoDescription !== undefined ? { customSeoDescription: patch.customSeoDescription } : {}),
        ...(patch.fontSettings !== undefined ? { fontSettings: patch.fontSettings } : {}),
        ...(patch.buttonColors !== undefined ? { buttonColors: patch.buttonColors } : {}),
        ...(patch.layoutSettings !== undefined ? { layoutSettings: patch.layoutSettings } : {}),
        ...(patch.businessCard !== undefined ? { businessCard: patch.businessCard } : {}),
        ...(patch.appearance !== undefined ? { appearance: patch.appearance } : {}),
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

const IveoSessionContext = createContext<IveoSession | null>(null);

const DemoSessionProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useDemoSession();
  return React.createElement(IveoSessionContext.Provider, { value: session }, children);
};

const ClerkSessionProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useClerkSession();
  return React.createElement(IveoSessionContext.Provider, { value: session }, children);
};

const FallbackSessionProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(IveoSessionContext.Provider, { value: FALLBACK_SESSION }, children);

export const IveoSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemo =
    typeof window !== 'undefined' &&
    (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1' || params.get('autostart') === '1';
    })();

  if (isDemo) {
    return React.createElement(DemoSessionProviderInner, null, children);
  }
  if (HAS_CLERK_KEY) {
    return React.createElement(ClerkSessionProviderInner, null, children);
  }
  return React.createElement(FallbackSessionProviderInner, null, children);
};

export function useIveoSession(): IveoSession {
  const ctx = useContext(IveoSessionContext);
  if (ctx) {
    return ctx;
  }

  const isDemo =
    typeof window !== 'undefined' &&
    (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1' || params.get('autostart') === '1';
    })();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const demoSession = useDemoSession();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clerkSession = HAS_CLERK_KEY ? useClerkSession() : FALLBACK_SESSION;

  return isDemo ? demoSession : clerkSession;
}

export const useIvioSession = useIveoSession;

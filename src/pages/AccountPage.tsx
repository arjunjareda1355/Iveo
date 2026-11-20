import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/react';
import { ArrowLeft, Check, Download, Loader2, WifiOff } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Accordion } from '../components/ui/Accordion';
import { AddressPill } from '../components/dashboard/AddressPill';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { SubscriptionCard } from '../components/plan/SubscriptionCard';
import { SecuritySection } from '../components/account/SecuritySection';
import { ConnectedPlatformsSection } from '../components/account/ConnectedPlatformsSection';
import { DeleteAccountDialog } from '../components/account/DeleteAccountDialog';
import { IveoUserButton } from '../auth/IvioUserButton';
import { RequireAuth } from '../auth/guards';
import { useIveoSession } from '../auth/useIvioSession';
import { BlocksProvider } from '../data/BlocksContext';
import { listMyBlocks } from '../data/linksApi';
import { getProtectedLinkIds } from '../data/passwordApi';
import { fetchPublicPage } from '../data/publicPageApi';
import { HAS_CLERK_KEY } from '../lib/env';
import {
  sanitizeUsername,
  validateUsernameSync,
  checkUsernameAvailability,
} from '../lib/username';
import { FREE_PLAN_HIGHLIGHTS, PRO_PLAN_HIGHLIGHTS } from '../lib/plan';
import { useToast } from '../components/ui/Toast';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Sign-in & security' },
  { id: 'connections', label: 'Connected platforms' },
  { id: 'plan', label: 'Plan & billing' },
  { id: 'data', label: 'Data & privacy' },
] as const;

type SectionId = (typeof ACCOUNT_SECTIONS)[number]['id'];

/**
 * Keeps the external sign-in profile's name aligned when the creator updates displayName in /account (AR-9),
 * only rendered inside a live ClerkProvider environment.
 */
const ClerkProfileSyncBridge: React.FC<{
  onRegisterSync: (fn: (displayName: string) => Promise<void>) => void;
}> = ({ onRegisterSync }) => {
  const { user } = useUser();
  useEffect(() => {
    onRegisterSync(async (name: string) => {
      if (!user || !name.trim()) return;
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ');
      await user.update({ firstName, lastName }).catch(() => {});
    });
  }, [user, onRegisterSync]);
  return null;
};

const ClerkExportDataButton: React.FC<{
  username: string | null;
  displayName: string;
  vibeId: string;
  buttonShape: string | null;
  hideIveoFooter: boolean;
  offline: boolean;
}> = (props) => {
  const { getToken } = useAuth();
  return (
    <ExportDataButtonInner
      {...props}
      fetchToken={() => getToken({ template: 'supabase' }).catch(() => null)}
    />
  );
};

const ExportDataButtonInner: React.FC<{
  username: string | null;
  displayName: string;
  vibeId: string;
  buttonShape: string | null;
  hideIveoFooter: boolean;
  offline: boolean;
  fetchToken: () => Promise<string | null>;
}> = ({
  username,
  displayName,
  vibeId,
  buttonShape,
  hideIveoFooter,
  offline,
  fetchToken,
}) => {
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!username || isExporting || offline) return;
    setIsExporting(true);
    try {
      const token = await fetchToken();
      const blocks = await listMyBlocks(token, username);
      const protectedIds = await getProtectedLinkIds(token).catch(() => []);
      const protectedSet = new Set(protectedIds);
      const publicData = await fetchPublicPage(username).catch(() => null);

      const profileSocials = publicData?.profile?.socials || {};
      const socialsList = Object.entries(profileSocials).map(([platform, url]) => ({
        platform,
        url: String(url),
      }));

      const exportObject = {
        exportedAt: new Date().toISOString(),
        version: 1,
        profile: {
          username,
          displayName: displayName || username,
          bio: publicData?.profile?.bio || '',
          vibe: vibeId,
          buttonShape: buttonShape || 'rounded',
          socials: socialsList,
          isPublished: true,
          hideFromSearch: publicData?.profile?.hideFromSearch || false,
          hideIveoFooter: hideIveoFooter || false,
        },
        links: blocks.map((b) => ({
          kind: b.kind,
          title: b.title,
          url: b.url,
          icon: b.icon,
          layout: b.layout,
          embedProvider: b.embedProvider,
          thumbnailUrl: b.thumbnailUrl,
          startAt: b.startAt,
          endAt: b.endAt,
          isActive: b.isActive,
          isArchived: b.isArchived,
          position: b.position,
          signup: b.signup,
          isProtected:
            b.kind === 'link'
              ? protectedSet.has(b.id) || b.isProtected === true
              : undefined,
        })),
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
        type: 'application/json',
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `iveo-data-${username}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      showToast(copy.exportData.successToast);
    } catch {
      showToast(copy.exportData.errorToast);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={handleExport}
      disabled={isExporting || offline || !username}
      className="shrink-0 self-start sm:self-center inline-flex items-center gap-2"
    >
      <Download size={16} strokeWidth={1.6} />
      <span>{isExporting ? 'Exporting...' : 'Export your data'}</span>
    </Button>
  );
};

export const AccountPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const location = useLocation();
  const session = useIveoSession();
  const { showToast } = useToast();

  const isDemo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('demo') === '1' || params.get('autostart') === '1';
  }, [location.search]);

  const demoSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      const kept = new URLSearchParams();
      if (params.get('demo') === '1') kept.set('demo', '1');
      if (params.get('autostart') === '1') kept.set('autostart', '1');
      return `?${kept.toString()}`;
    }
    return '';
  }, [location.search]);

  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [activeNavId, setActiveNavId] = useState<SectionId>('profile');
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [connectedPageProviders, setConnectedPageProviders] = useState<Set<string>>(
    () => new Set()
  );

  // Profile form state (AR-3 #profile, AR-9, AR-10)
  const [displayName, setDisplayName] = useState(session.displayName || '');
  const [usernameInput, setUsernameInput] = useState(session.username || '');
  const [bio, setBio] = useState(session.bio || '');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'error'
  >('idle');
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [confirmUsernameModalOpen, setConfirmUsernameModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const clerkSyncNameRef = useRef<((name: string) => Promise<void>) | null>(null);
  const registerClerkSync = useCallback((fn: (name: string) => Promise<void>) => {
    clerkSyncNameRef.current = fn;
  }, []);

  useEffect(() => {
    document.title = copy.dashboard.titles.account;
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    setDisplayName(session.displayName || '');
  }, [session.displayName]);

  useEffect(() => {
    setUsernameInput(session.username || '');
    setUsernameStatus('idle');
    setUsernameMessage(null);
  }, [session.username]);

  useEffect(() => {
    setBio(session.bio || '');
  }, [session.bio]);

  // Hash scroll + brief highlight (AR-2 / AR-11)
  useEffect(() => {
    const rawHash = location.hash?.replace(/^#/, '');
    if (!rawHash) return;
    // Legacy aliases (#passkeys -> #security, #subscription -> #plan)
    const mapped =
      rawHash === 'passkeys'
        ? 'security'
        : rawHash === 'subscription'
          ? 'plan'
          : rawHash;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(mapped);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (ACCOUNT_SECTIONS.some((s) => s.id === mapped)) {
          setActiveNavId(mapped as SectionId);
        }
        setHighlightedSection(mapped);
        window.setTimeout(() => setHighlightedSection(null), 1200);
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  // Desktop left-rail scroll-spy (AR-2)
  useEffect(() => {
    const elements = ACCOUNT_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean
    ) as HTMLElement[];
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = visible[0]?.target?.id as SectionId | undefined;
        if (topId && ACCOUNT_SECTIONS.some((s) => s.id === topId)) {
          setActiveNavId(topId);
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [session.isLoaded]);

  // Debounced live username availability check while typing (AR-10)
  useEffect(() => {
    const clean = sanitizeUsername(usernameInput);
    if (!clean || clean === (session.username || '')) {
      setUsernameStatus('idle');
      setUsernameMessage(null);
      return;
    }

    const sync = validateUsernameSync(clean, { email: session.primaryEmail });
    if (sync.status !== 'available') {
      setUsernameStatus('error');
      setUsernameMessage(sync.message);
      return;
    }

    let cancelled = false;
    setUsernameStatus('checking');
    setUsernameMessage(null);

    const timer = window.setTimeout(async () => {
      const res = await checkUsernameAvailability(
        clean,
        session.userId || undefined,
        session.primaryEmail
      );
      if (cancelled) return;
      if (res.status === 'available') {
        setUsernameStatus('available');
        setUsernameMessage(`iveo.site/@${clean} is available`);
      } else {
        setUsernameStatus('error');
        setUsernameMessage(res.message);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [usernameInput, session.username, session.userId, session.primaryEmail]);

  const handleJumpTo = (id: SectionId) => {
    setActiveNavId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightedSection(id);
      window.setTimeout(() => setHighlightedSection(null), 1200);
    }
  };

  const handleAvatarChange = async (url: string | null) => {
    if (isOffline) return;
    try {
      await session.updateProfile({ avatarUrl: url });
      showToast('Photo updated');
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const handleAvatarPayloadChange = async (payload: {
    avatarUrl: string | null;
    avatarType: 'default' | 'uploaded';
    avatarId: string | null;
  }) => {
    if (isOffline) return;
    try {
      await session.updateProfile({
        avatarUrl: payload.avatarUrl,
        avatarType: payload.avatarType,
        avatarId: payload.avatarId,
      });
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const cleanUsernameInput = sanitizeUsername(usernameInput);
  const usernameChanged = cleanUsernameInput !== (session.username || '');
  const profileDirty =
    displayName.trim() !== (session.displayName || '').trim() ||
    bio.trim() !== (session.bio || '').trim() ||
    usernameChanged;

  const commitProfileSave = async () => {
    setIsSavingProfile(true);
    try {
      if (usernameChanged && cleanUsernameInput) {
        await session.updateUsername(cleanUsernameInput);
      }
      const nextDisplayName = displayName.trim() || undefined;
      await session.updateProfile({
        displayName: nextDisplayName,
        bio: bio.trim(),
      });
      if (nextDisplayName && clerkSyncNameRef.current) {
        await clerkSyncNameRef.current(nextDisplayName).catch(() => {});
      }
      setProfileSaved(true);
      showToast('Saved');
      setTimeout(() => setProfileSaved(false), 1800);
    } catch (err: any) {
      showToast(err?.message || "Couldn't save profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleProfileFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline || !profileDirty || isSavingProfile) return;

    if (usernameChanged) {
      if (!cleanUsernameInput || usernameStatus === 'error' || usernameStatus === 'checking') {
        return;
      }
      if (session.username) {
        setConfirmUsernameModalOpen(true);
        return;
      }
    }

    await commitProfileSave();
  };

  const blocksUserId = session.username || 'owner';

  const planIncludesItems = useMemo(
    () => [
      {
        id: 'whats-included',
        question: "What's included",
        answer: (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="font-semibold text-ink mb-2">Free plan</p>
              <ul className="space-y-1.5 text-muted">
                {FREE_PLAN_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={14} className="text-ink shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink mb-2">iveo Pro</p>
              <ul className="space-y-1.5 text-muted">
                {PRO_PLAN_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={14} className="text-ink shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <RequireAuth>
      {HAS_CLERK_KEY && !isDemo && (
        <ClerkProfileSyncBridge onRegisterSync={registerClerkSync} />
      )}
      <div className="min-h-screen bg-bg flex flex-col">
        {/* Dashboard-shell Header (AR-2: Logo, AddressPill, Dashboard back link, Avatar menu; NO Preview, Share or mobile bottom bar) */}
        <header className="sticky top-0 z-40 h-16 w-full bg-surface border-b border-border">
          <Container className="h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <Logo tone="light" size="md" compactMobile />
              {session.username && (
                <div className="hidden sm:block min-w-0">
                  <AddressPill username={session.username} isPro={session.isPro} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <Link
                to={`/dashboard${demoSearch}`}
                aria-label="Back to dashboard"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-1.5 text-[14px] font-medium text-ink hover:text-ink-2 sm:px-3 rounded-[12px] hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink whitespace-nowrap"
              >
                <ArrowLeft size={18} strokeWidth={1.6} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <IveoUserButton />
            </div>
          </Container>
        </header>

        {/* Main Content */}
        <main id="main" className="flex-1 py-6 sm:py-10 pb-16">
          <div className="w-full max-w-[960px] mx-auto px-4 sm:px-6 flex flex-col gap-6">
            {/* Page Heading (AR-2) */}
            <div>
              <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
                Account
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                Manage your profile, sign-in security, connected platforms, plan and data.
              </p>
            </div>

            {isOffline && (
              <div
                role="status"
                className="p-3.5 rounded-[12px] border border-amber-200 bg-amber-50 text-[#92400E] flex items-center gap-2.5 text-[13px] font-medium"
              >
                <WifiOff size={16} className="shrink-0" />
                <span>You are offline. Reconnect to save changes.</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-8 items-start">
              {/* Desktop sticky left "On this page" scroll-spy rail (AR-2) */}
              <aside
                className="hidden lg:flex flex-col gap-1 sticky top-24"
                aria-label="On this page"
              >
                <span className="px-3 pb-1 text-[12px] font-medium text-muted">
                  On this page
                </span>
                {ACCOUNT_SECTIONS.map((item) => {
                  const active = activeNavId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleJumpTo(item.id)}
                      className={`min-h-[40px] px-3 rounded-[12px] text-left text-[13px] transition-colors cursor-pointer ${
                        active
                          ? 'bg-surface border border-border text-ink font-semibold'
                          : 'text-muted hover:text-ink hover:bg-surface-2/60'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </aside>

              {/* Right Content Sections (max 720px, flat bordered cards) */}
              <div className="flex flex-col gap-8 min-w-0 max-w-[720px] w-full">
                {!session.isLoaded ? (
                  <div className="flex flex-col gap-6" aria-busy="true">
                    <div className="h-[340px] rounded-[16px] bg-surface-2 animate-pulse" />
                    <div className="h-[260px] rounded-[16px] bg-surface-2 animate-pulse" />
                    <div className="h-[140px] rounded-[16px] bg-surface-2 animate-pulse" />
                  </div>
                ) : (
                  <>
                    {/* 1. Profile (#profile) */}
                    <section
                      id="profile"
                      aria-labelledby="account-profile-heading"
                      className={`scroll-mt-24 flex flex-col gap-3 rounded-[16px] transition-shadow duration-300 ${
                        highlightedSection === 'profile' ? 'ring-2 ring-ink/20 ring-offset-4' : ''
                      }`}
                    >
                      <div>
                        <h2
                          id="account-profile-heading"
                          className="text-[18px] font-semibold text-ink leading-tight"
                        >
                          Profile
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted">
                          How you appear on your public page.
                        </p>
                      </div>

                      <form
                        onSubmit={handleProfileFormSubmit}
                        className="rounded-[16px] border border-border bg-surface divide-y divide-divider"
                      >
                        {/* Photo row */}
                        <div className="p-4 sm:p-5">
                          <ProfilePhotoUploader
                            currentAvatarUrl={session.imageUrl}
                            avatarType={session.avatarType}
                            avatarId={session.avatarId}
                            initials={displayName || session.username || 'ME'}
                            username={session.username}
                            userId={session.userId}
                            primaryEmail={session.primaryEmail}
                            onAvatarChange={handleAvatarChange}
                            onAvatarPayloadChange={handleAvatarPayloadChange}
                          />
                        </div>

                        {/* Display name, username & bio */}
                        <div className="p-4 sm:p-5 flex flex-col gap-4">
                          {/* Display name */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="account-display-name"
                                className="text-[13px] font-medium text-ink"
                              >
                                Display name
                              </label>
                              <span className="text-[11px] text-muted tabular-nums">
                                {displayName.length}/50
                              </span>
                            </div>
                            <input
                              id="account-display-name"
                              type="text"
                              maxLength={50}
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                              placeholder="Your display name"
                              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors"
                            />
                          </div>

                          {/* Username (AR-10) */}
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="account-username"
                              className="text-[13px] font-medium text-ink"
                            >
                              Username
                            </label>
                            <div className="flex items-center rounded-[12px] border border-border bg-surface px-3.5 h-11 focus-within:border-ink transition-colors">
                              <span className="text-[14px] text-muted font-mono select-none pr-0.5">
                                iveo.site/@
                              </span>
                              <input
                                id="account-username"
                                type="text"
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(sanitizeUsername(e.target.value))}
                                placeholder="yourname"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className="flex-1 min-w-0 font-mono text-[14px] text-ink bg-transparent outline-none pl-0.5"
                              />
                              {usernameStatus === 'checking' && (
                                <Loader2 size={15} className="animate-spin text-muted shrink-0" />
                              )}
                            </div>

                            {usernameStatus === 'error' && usernameMessage ? (
                              <p
                                className="text-[12px] text-[color:var(--error,#B3261E)] font-medium"
                                role="alert"
                              >
                                {usernameMessage}
                              </p>
                            ) : usernameStatus === 'available' && usernameMessage ? (
                              <p className="text-[12px] text-[#166534] font-medium">
                                {usernameMessage}
                              </p>
                            ) : (
                              <p className="text-[12px] text-muted">
                                Changing your username changes your page link.
                              </p>
                            )}
                          </div>

                          {/* Bio */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="account-bio"
                                className="text-[13px] font-medium text-ink"
                              >
                                Bio
                              </label>
                              <span className="text-[11px] text-muted tabular-nums">
                                {bio.length}/160
                              </span>
                            </div>
                            <textarea
                              id="account-bio"
                              value={bio}
                              onChange={(e) => setBio(e.target.value.slice(0, 160))}
                              rows={3}
                              maxLength={160}
                              placeholder="A short sentence about what you create..."
                              className="w-full p-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors resize-none"
                            />
                          </div>
                        </div>

                        {/* Section footer Save */}
                        <div className="px-4 sm:px-5 py-3.5 flex items-center justify-end gap-3">
                          <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            loading={isSavingProfile}
                            disabled={
                              isOffline ||
                              isSavingProfile ||
                              (!profileDirty && !profileSaved) ||
                              (usernameChanged &&
                                (usernameStatus === 'error' ||
                                  usernameStatus === 'checking' ||
                                  !cleanUsernameInput))
                            }
                          >
                            {profileSaved ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Check size={15} />
                                <span>Saved</span>
                              </span>
                            ) : (
                              'Save profile'
                            )}
                          </Button>
                        </div>
                      </form>
                    </section>

                    {/* 2. Sign-in & security (#security) */}
                    <section
                      id="security"
                      aria-labelledby="account-security-heading"
                      className={`scroll-mt-24 flex flex-col gap-3 rounded-[16px] transition-shadow duration-300 ${
                        highlightedSection === 'security' ? 'ring-2 ring-ink/20 ring-offset-4' : ''
                      }`}
                    >
                      <div>
                        <h2
                          id="account-security-heading"
                          className="text-[18px] font-semibold text-ink leading-tight"
                        >
                          Sign-in &amp; security
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted">
                          How you sign in and keep your account safe.
                        </p>
                      </div>

                      <div className="rounded-[16px] border border-border bg-surface">
                        <SecuritySection
                          isDemo={isDemo}
                          offline={isOffline}
                          connectedPageProviders={connectedPageProviders}
                        />
                      </div>
                    </section>

                    {/* 3. Connected platforms (#connections) */}
                    <section
                      id="connections"
                      aria-labelledby="account-connections-heading"
                      className={`scroll-mt-24 flex flex-col gap-3 rounded-[16px] transition-shadow duration-300 ${
                        highlightedSection === 'connections'
                          ? 'ring-2 ring-ink/20 ring-offset-4'
                          : ''
                      }`}
                    >
                      <div>
                        <h2
                          id="account-connections-heading"
                          className="text-[18px] font-semibold text-ink leading-tight"
                        >
                          Connected platforms
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted">
                          Accounts iveo uses to show your cards and players.
                        </p>
                      </div>

                      <div className="rounded-[16px] border border-border bg-surface">
                        <BlocksProvider
                          key={`account-blocks-${blocksUserId}`}
                          userId={blocksUserId}
                          ownerUserId={session.userId}
                          primaryEmail={session.primaryEmail}
                        >
                          <ConnectedPlatformsSection
                            offline={isOffline}
                            onProvidersDetected={setConnectedPageProviders}
                          />
                        </BlocksProvider>
                      </div>
                    </section>

                    {/* 4. Plan & billing (#plan) */}
                    <section
                      id="plan"
                      aria-labelledby="account-plan-heading"
                      className={`scroll-mt-24 flex flex-col gap-3 rounded-[16px] transition-shadow duration-300 ${
                        highlightedSection === 'plan' ? 'ring-2 ring-ink/20 ring-offset-4' : ''
                      }`}
                    >
                      <div>
                        <h2
                          id="account-plan-heading"
                          className="text-[18px] font-semibold text-ink leading-tight"
                        >
                          Plan &amp; billing
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted">
                          Your current plan, billing schedule, and invoices.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <SubscriptionCard />
                        <div className="rounded-[16px] border border-border bg-surface px-4 sm:px-5">
                          <Accordion
                            items={planIncludesItems}
                            defaultOpenIndex={-1}
                            className="border-y-0"
                          />
                        </div>
                      </div>
                    </section>

                    {/* 5. Data & privacy (#data) */}
                    <section
                      id="data"
                      aria-labelledby="account-data-heading"
                      className={`scroll-mt-24 flex flex-col gap-3 rounded-[16px] transition-shadow duration-300 ${
                        highlightedSection === 'data' ? 'ring-2 ring-ink/20 ring-offset-4' : ''
                      }`}
                    >
                      <div>
                        <h2
                          id="account-data-heading"
                          className="text-[18px] font-semibold text-ink leading-tight"
                        >
                          Data &amp; privacy
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted">
                          Download your page data or permanently delete your account.
                        </p>
                      </div>

                      <div className="rounded-[16px] border border-border bg-surface divide-y divide-divider">
                        {/* Export row */}
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-ink">
                              Export your data
                            </h3>
                            <p className="mt-0.5 text-[13px] text-muted">
                              Download a copy of your page data as JSON. Statistics are not included.
                            </p>
                          </div>

                          {HAS_CLERK_KEY && !isDemo ? (
                            <ClerkExportDataButton
                              username={session.username}
                              displayName={session.displayName}
                              vibeId={session.vibeId}
                              buttonShape={session.buttonShape}
                              hideIveoFooter={session.hideIveoFooter}
                              offline={isOffline}
                            />
                          ) : (
                            <ExportDataButtonInner
                              username={session.username}
                              displayName={session.displayName}
                              vibeId={session.vibeId}
                              buttonShape={session.buttonShape}
                              hideIveoFooter={session.hideIveoFooter}
                              offline={isOffline}
                              fetchToken={async () => null}
                            />
                          )}
                        </div>

                        {/* Danger zone row */}
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-[color:var(--error,#B3261E)]">
                              Delete account
                            </h3>
                            <p className="mt-0.5 text-[13px] text-muted">
                              Permanently delete your account, page and all data. This cannot be undone.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="destructive"
                            size="md"
                            disabled={isOffline}
                            onClick={() => setIsDeleteDialogOpen(true)}
                            className="shrink-0 self-start sm:self-center"
                          >
                            Delete account
                          </Button>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Confirm Username Change Dialog (AR-10) */}
        <BottomSheet
          isOpen={confirmUsernameModalOpen}
          onClose={() => {
            if (!isSavingProfile) setConfirmUsernameModalOpen(false);
          }}
          title="Change your username?"
          subtitle={`Your public page moves to iveo.site/@${cleanUsernameInput} and your old link iveo.site/@${session.username || ''} stops working. Update it anywhere you've shared it.`}
          maxWidthClass="sm:max-w-md"
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isSavingProfile}
              onClick={() => setConfirmUsernameModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={isSavingProfile}
              onClick={async () => {
                setConfirmUsernameModalOpen(false);
                await commitProfileSave();
              }}
            >
              Change username
            </Button>
          </div>
        </BottomSheet>

        {/* Delete Account Typed-Confirmation Dialog */}
        <DeleteAccountDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          username={session.username || session.primaryEmail?.split('@')[0] || 'account'}
          email={session.primaryEmail}
        />
      </div>
    </RequireAuth>
  );
};

export default AccountPage;

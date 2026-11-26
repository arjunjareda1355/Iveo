import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Eye,
  Share2,
  Link2,
  Plug,
  Palette,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Container } from '../components/ui/Container';
import { BottomSheet } from '../components/ui/BottomSheet';
import { IvioUserButton } from '../auth/IvioUserButton';
import { LinksTab } from '../components/dashboard/LinksTab';
import { ProfilesTab } from '../components/dashboard/ProfilesTab';
import { SettingsTab } from '../components/dashboard/SettingsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { ContactsTab } from './ContactsTab';
import { VibePhone } from '../components/phone/VibePhone';
import { PhoneProfile } from '../components/phone/PhonePage';
import { ShareDialog } from '../components/share/ShareDialog';
import { BlocksProvider, useBlocks } from '../data/BlocksContext';
import { useIvioSession } from '../auth/useIvioSession';
import { useProtectedLinkIds } from '../data/hooks/useProtectedLinkIds';
import { VIBES } from '../lib/vibes';
import { ButtonShape } from '../lib/preferences';
import { useNow, isBlockVisibleNow } from '../lib/time';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';
import {
  AppearanceProvider,
  useAppearance,
} from '../components/appearance/AppearanceContext';
import { AppearanceHome } from '../components/appearance/AppearanceHome';
import { VibeScreen } from '../components/appearance/VibeScreen';
import { BackgroundScreen } from '../components/appearance/BackgroundScreen';
import { ButtonsScreen } from '../components/appearance/ButtonsScreen';
import { TypographyScreen } from '../components/appearance/TypographyScreen';
import { LayoutScreen } from '../components/appearance/LayoutScreen';
import { appearanceToLegacyMirror } from '../lib/appearance/migrate';
import { resolveAnyVibeToV2Id } from '../lib/appearance/catalog/vibes';
import { useToast } from '../components/ui/Toast';

const BUTTON_RADIUS_MAP: Record<ButtonShape, number> = {
  square: 0,
  rounded: 12,
  pill: 999,
};

type AppearanceSubRoute =
  | 'home'
  | 'vibe'
  | 'background'
  | 'typography'
  | 'buttons'
  | 'layout';

const DashboardContent: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const session = useIvioSession();
  const location = useLocation();
  const { blocks } = useBlocks();
  const { protectedIds } = useProtectedLinkIds();
  const now = useNow(30000);
  const appearanceCtx = useAppearance();
  const { showToast } = useToast();

  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const notifyReactivated = () => {
      try {
        if (sessionStorage.getItem('iveo_account_reactivated') === '1') {
          sessionStorage.removeItem('iveo_account_reactivated');
          showToast('Welcome back — your account deletion was cancelled and your page is live again.');
        }
      } catch {}
    };
    notifyReactivated();
    window.addEventListener('iveo_account_reactivated', notifyReactivated);
    return () => window.removeEventListener('iveo_account_reactivated', notifyReactivated);
  }, [showToast]);

  const isProfiles = location.pathname.includes('/profiles');
  const isAppearance = location.pathname.includes('/appearance');
  const isContacts = location.pathname.includes('/contacts');
  const isAnalytics = location.pathname.includes('/analytics');
  const isSettings = location.pathname.includes('/settings');
  const isLinks = !isProfiles && !isAppearance && !isContacts && !isAnalytics && !isSettings;

  const appearanceSubSection: AppearanceSubRoute = useMemo(() => {
    if (!isAppearance) return 'home';
    if (location.pathname.endsWith('/appearance/vibe')) return 'vibe';
    if (location.pathname.endsWith('/appearance/background')) return 'background';
    if (location.pathname.endsWith('/appearance/typography')) return 'typography';
    if (location.pathname.endsWith('/appearance/buttons')) return 'buttons';
    if (location.pathname.endsWith('/appearance/layout')) return 'layout';
    return 'home';
  }, [isAppearance, location.pathname]);

  const demoSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      return location.search;
    }
    return '';
  }, [location.search]);

  useEffect(() => {
    if (isProfiles) {
      document.title = copy.dashboard.titles.profiles;
    } else if (isAppearance) {
      document.title = copy.dashboard.titles.appearance;
    } else if (isContacts) {
      document.title = copy.dashboard.titles.contacts;
    } else if (isAnalytics) {
      document.title = copy.dashboard.titles.analytics;
    } else if (isSettings) {
      document.title = copy.dashboard.titles.settings;
    } else {
      document.title = copy.dashboard.titles.links;
    }
  }, [isProfiles, isAppearance, isContacts, isAnalytics, isSettings]);

  const activeAppearance = isAppearance
    ? appearanceCtx.draft
    : session.appearance || appearanceCtx.draft;
  const activeResolved = appearanceCtx.resolved;
  const mirrored = useMemo(
    () => appearanceToLegacyMirror(activeAppearance, session.layoutSettings),
    [activeAppearance, session.layoutSettings]
  );

  const baseVibe = useMemo(() => {
    const v1Match = VIBES.find(
      (v) => v.id === session.vibeId || resolveAnyVibeToV2Id(v.id) === activeAppearance.vibeId
    );
    return v1Match || VIBES[0];
  }, [session.vibeId, activeAppearance.vibeId]);

  const activeVibe = useMemo(
    () =>
      isAppearance
        ? {
            ...baseVibe,
            tokens: {
              ...baseVibe.tokens,
              bg: activeResolved.bgProfile.meanHex,
              text: activeResolved.pageText,
            },
          }
        : baseVibe,
    [isAppearance, baseVibe, activeResolved.bgProfile.meanHex, activeResolved.pageText]
  );

  const profileData: PhoneProfile = {
    name: session.displayName || session.username || 'Your name',
    handle: session.username || 'yourname',
    avatarUrl: session.imageUrl,
    bio: session.bio || 'Your bio goes here.',
    isPro: session.isPro,
    isVerified: session.isPro,
    socials: session.socials,
    socialsPosition: session.socialsPosition,
    whatsappNumber: session.whatsappNumber,
    background: isAppearance ? mirrored.background : session.background,
    fontSettings: isAppearance ? mirrored.fontSettings : session.fontSettings,
    buttonColors: isAppearance ? mirrored.buttonColors : session.buttonColors,
    layoutSettings: isAppearance ? mirrored.layoutSettings : session.layoutSettings,
    appearance: activeAppearance,
  };

  const buttonRadiusOverride = isAppearance
    ? activeResolved.buttons.derivedRadius
    : session.buttonShape
      ? BUTTON_RADIUS_MAP[session.buttonShape]
      : undefined;

  const visiblePreviewBlocks = blocks.filter((b) =>
    isBlockVisibleNow(b, session.plan, now)
  );

  const hideFooterMark = isAppearance
    ? appearanceCtx.hideFooterMark
    : Boolean(session.isPro && (session.hideIveoFooter || session.hideIvioFooter));

  const navItems = [
    { to: `/dashboard${demoSearch}`, label: copy.dashboard.tabs.links, end: true, icon: Link2 },
    { to: `/dashboard/profiles${demoSearch}`, label: copy.dashboard.tabs.profiles, end: false, icon: Plug },
    { to: `/dashboard/appearance${demoSearch}`, label: copy.dashboard.tabs.appearance, end: false, icon: Palette },
    { to: `/dashboard/contacts${demoSearch}`, label: copy.dashboard.tabs.contacts, end: false, icon: Users },
    { to: `/dashboard/analytics${demoSearch}`, label: copy.dashboard.tabs.analytics, end: false, icon: BarChart3 },
    { to: `/dashboard/settings${demoSearch}`, label: copy.dashboard.tabs.settings, end: false, icon: Settings },
  ];

  const showLivePreviewColumn = isLinks || isProfiles || isAppearance;
  const isAppearanceSubScreen = isAppearance && appearanceSubSection !== 'home';

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Sticky Top Header (56px / h-14) */}
      <header className="sticky top-0 z-40 h-14 w-full bg-surface border-b border-border">
        <Container className="h-full flex items-center justify-between gap-2">
          <div className="flex items-center min-w-0">
            <Logo tone="light" size="md" compactMobile />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMobilePreviewOpen(true)}
              aria-label="Preview your page"
              title="Preview"
              className="lg:hidden w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
            >
              <Eye size={20} strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              aria-label="Share your page"
              title="Share"
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
            >
              <Share2 size={20} strokeWidth={1.5} />
            </button>

            <IvioUserButton />
          </div>
        </Container>
      </header>

      {/* Desktop Horizontal Tabs (md and up) */}
      <nav
        aria-label="Dashboard tabs"
        className="hidden md:block h-12 w-full bg-surface border-b border-border sticky top-14 z-30"
      >
        <Container className="h-full flex items-center gap-7">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative h-full flex items-center gap-2 text-[14px] font-medium transition-colors duration-120 select-none shrink-0 whitespace-nowrap ${
                  isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </Container>
      </nav>

      {/* Main Content Area (Bottom padding reserves mobile fixed tab bar) */}
      <main
        id="main"
        className={`flex-1 ${isAppearanceSubScreen ? 'py-0 sm:py-5 pb-4 md:pb-6' : 'py-5 sm:py-8 pb-24 md:pb-12'}`}
      >
        <Container>
          {isAnalytics ? (
            <div className="w-full max-w-[880px] mx-auto">
              <AnalyticsTab />
            </div>
          ) : isContacts ? (
            <div className="w-full max-w-[880px] mx-auto">
              <ContactsTab />
            </div>
          ) : isSettings ? (
            <div className="w-full max-w-[960px] mx-auto">
              <SettingsTab />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
              {/* Left Column: Centered 720px max */}
              <div className="w-full max-w-[720px] mx-auto lg:mx-0 min-w-0">
                {isLinks && <LinksTab />}
                {isProfiles && <ProfilesTab />}
                {isAppearance && (
                  <>
                    {appearanceSubSection === 'home' && <AppearanceHome />}
                    {appearanceSubSection === 'vibe' && (
                      <VibeScreen onOpenPreview={() => setMobilePreviewOpen(true)} />
                    )}
                    {appearanceSubSection === 'background' && (
                      <BackgroundScreen onOpenPreview={() => setMobilePreviewOpen(true)} />
                    )}
                    {appearanceSubSection === 'typography' && (
                      <TypographyScreen onOpenPreview={() => setMobilePreviewOpen(true)} />
                    )}
                    {appearanceSubSection === 'buttons' && (
                      <ButtonsScreen onOpenPreview={() => setMobilePreviewOpen(true)} />
                    )}
                    {appearanceSubSection === 'layout' && (
                      <LayoutScreen onOpenPreview={() => setMobilePreviewOpen(true)} />
                    )}
                  </>
                )}
              </div>

              {/* Right Column (>=1024px): Persistent 360px Sticky Live Phone Preview */}
              {showLivePreviewColumn && (
                <div className="hidden lg:flex w-[360px] flex-col items-center justify-center sticky top-32">
                  <VibePhone
                    currentVibe={activeVibe}
                    profile={profileData}
                    blocks={visiblePreviewBlocks.length > 0 || !appearanceCtx.isDemo ? visiblePreviewBlocks : undefined}
                    protectedIds={protectedIds}
                    hideFooterMark={hideFooterMark}
                    embedMode="placeholder"
                    buttonRadiusOverride={buttonRadiusOverride}
                    width={300}
                  />
                  <span className="mt-4 text-[13px] text-muted select-none">
                    Live preview
                  </span>
                </div>
              )}
            </div>
          )}
        </Container>
      </main>

      {/* Mobile Fixed Bottom Tab Bar (<768px) — hidden on sub-screens so sticky Done bar sits cleanly */}
      {!isAppearanceSubScreen && (
        <nav
          aria-label="Mobile dashboard navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div className="grid grid-cols-6 h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 min-w-0 px-0.5 transition-colors select-none ${
                      isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                      <span className="text-[10px] leading-none tracking-tight truncate max-w-full">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile/Tablet Preview Sheet (triggered from Header Eye Icon or Sub-screen Preview button) */}
      <BottomSheet
        isOpen={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        title="Live preview"
        ariaLabel="Phone preview"
      >
        <div className="py-5 px-4 flex flex-col items-center justify-center">
          <VibePhone
            currentVibe={activeVibe}
            profile={profileData}
            blocks={visiblePreviewBlocks.length > 0 || !appearanceCtx.isDemo ? visiblePreviewBlocks : undefined}
            protectedIds={protectedIds}
            hideFooterMark={hideFooterMark}
            embedMode="placeholder"
            buttonRadiusOverride={buttonRadiusOverride}
            width={280}
          />
        </div>
      </BottomSheet>

      {/* Top Bar Share Sheet */}
      {session.username && (
        <ShareDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          username={session.username}
          displayName={session.displayName}
          bio={session.bio}
          avatarUrl={session.imageUrl}
          vibeId={session.vibeId}
          fontSettings={mirrored.fontSettings}
          buttonColors={mirrored.buttonColors}
          businessCard={session.businessCard}
          socials={session.socials}
          onSaveCardConfig={async (cfg) => {
            await session.updatePreferences({ businessCard: cfg });
          }}
          isPro={session.isPro}
          isPublished={true}
        />
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const session = useIvioSession();
  const isDemo =
    typeof window !== 'undefined' &&
    (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1' || params.get('autostart') === '1';
    })();

  if (!session.isLoaded && !isDemo) {
    return null;
  }

  const userId = session.username || 'owner';

  return (
    <BlocksProvider
      key={userId}
      userId={userId}
      ownerUserId={session.userId}
      primaryEmail={session.primaryEmail}
    >
      <AppearanceProvider>
        <DashboardContent />
      </AppearanceProvider>
    </BlocksProvider>
  );
};

export default DashboardPage;

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Eye,
  Share2,
  Link2,
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
import { AppearanceTab } from '../components/dashboard/AppearanceTab';
import { SettingsTab } from '../components/dashboard/SettingsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { ContactsTab } from './ContactsTab';
import { VibePhone } from '../components/phone/VibePhone';
import { PhoneProfile } from '../components/phone/PhonePage';
import { ShareDialog } from '../components/share/ShareDialog';
import { BlocksProvider, useBlocks } from '../data/BlocksContext';
import { useIvioSession } from '../auth/useIvioSession';
import { useProtectedLinkIds } from '../data/hooks/useProtectedLinkIds';
import { VIBES, VibeId } from '../lib/vibes';
import { ButtonShape, LayoutSettings } from '../lib/preferences';
import { FontSettings } from '../lib/fonts';
import { ButtonColors } from '../lib/colors';
import { BackgroundConfig } from '../data/types';
import { useNow, isBlockVisibleNow } from '../lib/time';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

const BUTTON_RADIUS_MAP: Record<ButtonShape, number> = {
  square: 0,
  rounded: 12,
  pill: 999,
};

const DashboardContent: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const session = useIvioSession();
  const location = useLocation();
  const { blocks } = useBlocks();
  const { protectedIds } = useProtectedLinkIds();
  const now = useNow(30000);

  const [previewVibeId, setPreviewVibeId] = useState<VibeId>(session.vibeId);
  const [previewShape, setPreviewShape] = useState<ButtonShape | null>(session.buttonShape);
  const [previewFontSettings, setPreviewFontSettings] = useState<FontSettings | null>(
    session.fontSettings ?? null
  );
  const [previewButtonColors, setPreviewButtonColors] = useState<ButtonColors | null>(
    session.buttonColors ?? null
  );
  const [previewLayoutSettings, setPreviewLayoutSettings] = useState<LayoutSettings | null>(
    session.layoutSettings ?? null
  );
  const [previewBackground, setPreviewBackground] = useState<BackgroundConfig | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Sync state with session
  useEffect(() => {
    setPreviewVibeId(session.vibeId);
    setPreviewShape(session.buttonShape ?? null);
    setPreviewFontSettings(session.fontSettings ?? null);
    setPreviewButtonColors(session.buttonColors ?? null);
    setPreviewLayoutSettings(session.layoutSettings ?? null);
  }, [
    session.vibeId,
    session.buttonShape,
    session.fontSettings,
    session.buttonColors,
    session.layoutSettings,
  ]);

  const isAppearance = location.pathname.includes('/appearance');
  const isContacts = location.pathname.includes('/contacts');
  const isAnalytics = location.pathname.includes('/analytics');
  const isSettings = location.pathname.includes('/settings');
  const isLinks = !isAppearance && !isContacts && !isAnalytics && !isSettings;

  useEffect(() => {
    if (!isAppearance) {
      setPreviewBackground(null);
    }
  }, [isAppearance]);

  const demoSearch = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      return location.search;
    }
    return '';
  }, [location.search]);

  useEffect(() => {
    if (isAppearance) {
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
  }, [isAppearance, isContacts, isAnalytics, isSettings]);

  const activeVibe = VIBES.find((v) => v.id === previewVibeId) || VIBES[0];

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
    background: previewBackground ?? session.background,
    fontSettings: previewFontSettings,
    buttonColors: previewButtonColors,
    layoutSettings: previewLayoutSettings,
  };

  const buttonRadiusOverride = previewShape ? BUTTON_RADIUS_MAP[previewShape] : undefined;

  const visiblePreviewBlocks = blocks.filter((b) =>
    isBlockVisibleNow(b, session.plan, now)
  );

  const hideFooterMark =
    session.isPro && (session.hideIveoFooter || session.hideIvioFooter);

  const navItems = [
    { to: `/dashboard${demoSearch}`, label: copy.dashboard.tabs.links, end: true, icon: Link2 },
    { to: `/dashboard/appearance${demoSearch}`, label: copy.dashboard.tabs.appearance, end: false, icon: Palette },
    { to: `/dashboard/contacts${demoSearch}`, label: copy.dashboard.tabs.contacts, end: false, icon: Users },
    { to: `/dashboard/analytics${demoSearch}`, label: copy.dashboard.tabs.analytics, end: false, icon: BarChart3 },
    { to: `/dashboard/settings${demoSearch}`, label: copy.dashboard.tabs.settings, end: false, icon: Settings },
  ];

  const showLivePreviewColumn = isLinks || isAppearance;

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
      <main id="main" className="flex-1 py-5 sm:py-8 pb-24 md:pb-12">
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
                {isAppearance && (
                  <AppearanceTab
                    onPreviewVibeChange={(vId) => setPreviewVibeId(vId)}
                    onPreviewShapeChange={(shape) => setPreviewShape(shape)}
                    onPreviewFontSettingsChange={(fonts) => setPreviewFontSettings(fonts)}
                    onPreviewButtonColorsChange={(colors) => setPreviewButtonColors(colors)}
                    onPreviewLayoutChange={(layout) => setPreviewLayoutSettings(layout)}
                    onPreviewBackgroundChange={(bg) => setPreviewBackground(bg)}
                    mobilePhonePreview={
                      <VibePhone
                        currentVibe={activeVibe}
                        profile={profileData}
                        blocks={visiblePreviewBlocks}
                        protectedIds={protectedIds}
                        hideFooterMark={hideFooterMark}
                        embedMode="placeholder"
                        buttonRadiusOverride={buttonRadiusOverride}
                        width={220}
                      />
                    }
                  />
                )}
              </div>

              {/* Right Column (>=1024px): Persistent 360px Sticky Live Phone Preview */}
              {showLivePreviewColumn && (
                <div className="hidden lg:flex w-[360px] flex-col items-center justify-center sticky top-32">
                  <VibePhone
                    currentVibe={activeVibe}
                    profile={profileData}
                    blocks={visiblePreviewBlocks}
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

      {/* Mobile Fixed Bottom Tab Bar (<768px) — 5 equal columns, zero scroll/clipping */}
      <nav
        aria-label="Mobile dashboard navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 min-w-0 px-1 transition-colors select-none ${
                    isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
                    <span className="text-[11px] leading-none tracking-tight truncate max-w-full">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile/Tablet Preview Sheet (triggered from Header Eye Icon) */}
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
            blocks={visiblePreviewBlocks}
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
          vibeId={previewVibeId}
          fontSettings={previewFontSettings}
          buttonColors={previewButtonColors}
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
  const userId = session.username || 'owner';

  return (
    <BlocksProvider
      key={userId}
      userId={userId}
      ownerUserId={session.userId}
      primaryEmail={session.primaryEmail}
    >
      <DashboardContent />
    </BlocksProvider>
  );
};

export default DashboardPage;

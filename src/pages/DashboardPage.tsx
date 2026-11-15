import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Eye, X, Share2 } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { AddressPill } from '../components/dashboard/AddressPill';
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

  // Determine active tab & document title
  const isAppearance = location.pathname.includes('/appearance');
  const isContacts = location.pathname.includes('/contacts');
  const isAnalytics = location.pathname.includes('/analytics');
  const isSettings = location.pathname.includes('/settings');
  const isLinks = !isAppearance && !isContacts && !isAnalytics && !isSettings;

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

  // Lock scroll on mobile preview sheet open
  useEffect(() => {
    if (mobilePreviewOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMobilePreviewOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobilePreviewOpen]);

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
    background: session.background,
    fontSettings: previewFontSettings,
    buttonColors: previewButtonColors,
    layoutSettings: previewLayoutSettings,
  };

  const buttonRadiusOverride = previewShape ? BUTTON_RADIUS_MAP[previewShape] : undefined;

  // Filter blocks visible right now for preview
  const visiblePreviewBlocks = blocks.filter((b) =>
    isBlockVisibleNow(b, session.plan, now)
  );

  const hideFooterMark =
    session.isPro && (session.hideIveoFooter || session.hideIvioFooter);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 h-16 w-full bg-surface border-b border-border">
        <Container className="h-full flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Logo tone="light" size="md" />
            {session.username && (
              <AddressPill username={session.username} isPro={session.isPro} />
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Single responsive share button */}
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsShareOpen(true)}
              aria-label="Share your page"
            >
              <Share2 size={16} strokeWidth={1.5} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>

            <IvioUserButton />
          </div>
        </Container>
      </header>

      {/* Tabs Row */}
      <nav
        aria-label="Dashboard Tabs"
        className="h-12 w-full bg-surface border-b border-border sticky top-16 z-30 overflow-x-auto no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <Container className="h-full flex items-center gap-6 sm:gap-8">
          <NavLink
            to={`/dashboard${demoSearch}`}
            end
            className={({ isActive }) =>
              `relative h-full flex items-center text-[14px] font-medium transition-colors duration-120 select-none ${
                isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{copy.dashboard.tabs.links}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to={`/dashboard/appearance${demoSearch}`}
            className={({ isActive }) =>
              `relative h-full flex items-center text-[14px] font-medium transition-colors duration-120 select-none ${
                isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{copy.dashboard.tabs.appearance}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to={`/dashboard/contacts${demoSearch}`}
            className={({ isActive }) =>
              `relative h-full flex items-center text-[14px] font-medium transition-colors duration-120 select-none ${
                isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{copy.dashboard.tabs.contacts}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to={`/dashboard/analytics${demoSearch}`}
            className={({ isActive }) =>
              `relative h-full flex items-center text-[14px] font-medium transition-colors duration-120 select-none ${
                isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{copy.dashboard.tabs.analytics}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to={`/dashboard/settings${demoSearch}`}
            className={({ isActive }) =>
              `relative h-full flex items-center text-[14px] font-medium transition-colors duration-120 select-none ${
                isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{copy.dashboard.tabs.settings}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>
        </Container>
      </nav>

      {/* Main Content Area */}
      <main id="main" className="flex-1 py-8 sm:py-10 pb-24 lg:pb-10">
        <Container>
          {isAnalytics ? (
            <div className="w-full">
              <AnalyticsTab />
            </div>
          ) : isContacts ? (
            <div className="w-full">
              <ContactsTab />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column (7 of 12): Tab Panel */}
              <div className="lg:col-span-7">
                {isLinks && <LinksTab />}
                {isAppearance && (
                  <AppearanceTab
                    onPreviewVibeChange={(vId) => setPreviewVibeId(vId)}
                    onPreviewShapeChange={(shape) => setPreviewShape(shape)}
                    onPreviewFontSettingsChange={(fonts) => setPreviewFontSettings(fonts)}
                    onPreviewButtonColorsChange={(colors) => setPreviewButtonColors(colors)}
                    onPreviewLayoutChange={(layout) => setPreviewLayoutSettings(layout)}
                  />
                )}
                {isSettings && <SettingsTab />}
              </div>

              {/* Right Column (5 of 12): Desktop Sticky Live Phone Preview */}
              <div className="hidden lg:flex col-span-5 flex-col items-center justify-center sticky top-32">
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
            </div>
          )}
        </Container>
      </main>

      {/* Floating Preview Button and Sheet on Mobile (hidden on Analytics & Contacts) */}
      {!isAnalytics && !isContacts && (
        <>
          <div className="lg:hidden fixed bottom-6 right-6 z-40">
            <button
              type="button"
              onClick={() => setMobilePreviewOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] bg-ink text-white font-medium text-[14px] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
            >
              <Eye size={16} strokeWidth={1.5} />
              <span>Preview</span>
            </button>
          </div>

          {mobilePreviewOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Phone Preview"
              className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex flex-col justify-end lg:justify-center lg:items-center"
              onClick={(e) => {
                if (e.target === e.currentTarget) setMobilePreviewOpen(false);
              }}
            >
              <div className="bg-surface rounded-t-[20px] lg:rounded-[24px] p-6 max-h-[88vh] lg:w-full lg:max-w-[380px] overflow-y-auto flex flex-col items-center relative border-t lg:border border-border shadow-2xl">
                <button
                  type="button"
                  onClick={() => setMobilePreviewOpen(false)}
                  aria-label="Close preview"
                  className="absolute top-4 right-4 p-2 text-muted hover:text-ink rounded-full focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
                <div className="my-4">
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
              </div>
            </div>
          )}
        </>
      )}

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

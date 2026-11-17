import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile } from '@clerk/react';
import { ArrowLeft, Check } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AddressPill } from '../components/dashboard/AddressPill';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { SubscriptionCard } from '../components/plan/SubscriptionCard';
import { PasskeysCard } from '../components/account/PasskeysCard';
import { IveoUserButton } from '../auth/IvioUserButton';
import { RequireAuth } from '../auth/guards';
import { iveoAppearance } from '../auth/appearance';
import { useIveoSession } from '../auth/useIvioSession';
import { useToast } from '../components/ui/Toast';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

export const AccountPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const session = useIveoSession();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(session.displayName || '');
  const [bio, setBio] = useState(session.bio || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    document.title = copy.dashboard.titles.account;
  }, []);

  useEffect(() => {
    setDisplayName(session.displayName || '');
  }, [session.displayName]);

  useEffect(() => {
    setBio(session.bio || '');
  }, [session.bio]);

  const handleAvatarChange = async (url: string | null) => {
    try {
      await session.updateProfile({ avatarUrl: url });
      showToast('Avatar updated');
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const handleAvatarPayloadChange = async (payload: {
    avatarUrl: string | null;
    avatarType: 'default' | 'uploaded';
    avatarId: string | null;
  }) => {
    try {
      await session.updateProfile({
        avatarUrl: payload.avatarUrl,
        avatarType: payload.avatarType,
        avatarId: payload.avatarId,
      });
      showToast('Avatar updated');
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await session.updateProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim(),
      });
      setProfileSaved(true);
      showToast('Profile info updated');
      setTimeout(() => setProfileSaved(false), 1800);
    } catch {
      showToast("Couldn't save profile info");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const accountAppearance = {
    ...iveoAppearance,
    elements: {
      ...iveoAppearance.elements,
      rootBox: {
        width: '100%',
      },
      cardBox: {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
        width: '100%',
      },
      card: {
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
        borderRadius: '0px',
        width: '100%',
      },
      navbar: {
        borderRight: 'none',
        backgroundColor: 'transparent',
      },
      pageScrollBox: {
        backgroundColor: 'transparent',
        padding: '0.5rem 0',
      },
      profileSection__username: {
        display: 'none',
      },
    },
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-bg flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 w-full bg-surface border-b border-border">
          <Container className="h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <Logo tone="light" size="md" />
              {session.username && <AddressPill username={session.username} isPro={session.isPro} />}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-ink-2 py-2 px-3 rounded-[10px] hover:bg-surface-2 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink whitespace-nowrap"
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">Back to dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </Link>
              <IveoUserButton />
            </div>
          </Container>
        </header>

        {/* Content Area */}
        <main id="main" className="flex-1 py-8 sm:py-10">
          <div className="w-full max-w-[880px] mx-auto px-4 sm:px-6 flex flex-col gap-6">
            {/* Public Profile, Avatar & Bio */}
            <Card className="flex flex-col gap-5">
              <div>
                <h1 className="text-[20px] font-semibold text-ink leading-tight">
                  Profile &amp; Bio
                </h1>
                <p className="mt-1 text-[14px] text-muted">
                  Customize your avatar, display name, and public page bio.
                </p>
              </div>

              <form onSubmit={handleSaveProfileInfo} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-2">
                    Avatar &amp; Photo
                  </label>
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

                <div>
                  <label htmlFor="account-display-name" className="block text-[13px] font-medium text-ink mb-1.5">
                    Display Name
                  </label>
                  <input
                    id="account-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya Ellis"
                    className="w-full h-11 px-3.5 rounded-[10px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="account-bio" className="text-[13px] font-medium text-ink">
                      Bio
                    </label>
                    <span className="text-[11px] text-muted tabular-nums">{bio.length}/160</span>
                  </div>
                  <textarea
                    id="account-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    rows={3}
                    placeholder="A short sentence about what you create..."
                    className="w-full p-3 rounded-[10px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors resize-none"
                  />
                </div>

                <div className="flex justify-start sm:justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isSavingProfile}
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
            </Card>

            {/* Subscription & Billing */}
            <div id="subscription">
              <SubscriptionCard />
            </div>

            {/* Passkeys Authentication (Clerk Managed) */}
            <div id="passkeys">
              <PasskeysCard />
            </div>

            {/* Seamless Clerk Security & Account Controls (No Side Borders) */}
            <section aria-label="Account Security">
              <UserProfile routing="path" path="/account" appearance={accountAppearance} />
            </section>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
};

export default AccountPage;

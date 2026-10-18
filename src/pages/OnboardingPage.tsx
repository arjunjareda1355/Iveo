import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { Eye, X, Copy } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StepProgress } from '../components/onboarding/StepProgress';
import { VibeTileGroup } from '../components/onboarding/VibeTileGroup';
import { VibePhone } from '../components/phone/VibePhone';
import { PhoneProfile } from '../components/phone/PhonePage';
import { useIvioSession } from '../auth/useIvioSession';
import { useToast } from '../components/ui/Toast';
import { VIBES, VibeId } from '../lib/vibes';
import {
  normalizeUsername,
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../lib/username-rules';
import { copy } from '../content/copy';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { showToast } = useToast();
  const session = useIvioSession();

  // Determine initial step
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(() => {
    if (!session.username || !validateUsername(session.username).ok) {
      return 1;
    }
    return 2;
  });

  // Step 1: Username state
  const [usernameInput, setUsernameInput] = useState<string>(() => {
    if (session.username) return session.username;
    try {
      const stored = sessionStorage.getItem('ivio.claim');
      if (stored) return normalizeUsername(stored);
    } catch {
      // ignore
    }
    return '';
  });

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Step 2: Vibe state
  const [selectedVibeId, setSelectedVibeId] = useState<VibeId>(session.vibeId || 'clean');
  const [isSavingVibe, setIsSavingVibe] = useState(false);

  // Step 3: Finish state
  const [isCompleting, setIsCompleting] = useState(false);

  // Mobile preview sheet state
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Shift focus to step heading on step change
  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  // Lock body scroll and handle Escape when mobile preview sheet is open
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

  const activeVibe = VIBES.find((v) => v.id === selectedVibeId) || VIBES[0];

  const profileData: PhoneProfile = {
    name: session.displayName || session.username || 'Your name',
    handle: session.username || usernameInput || 'yourname',
    avatarUrl: session.imageUrl,
    bio: 'Your bio goes here.',
    links: ['Your first link', 'Your second link', 'Your third link'],
  };

  // Step 1: Submit username
  const handleUsernameSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = normalizeUsername(usernameInput);
    const valResult = validateUsername(clean);

    if (!valResult.ok) {
      if (valResult.reason === 'reserved') {
        setUsernameError(copy.onboarding.usernameStatus.reserved);
      } else {
        setUsernameError(copy.onboarding.usernameStatus.validFormat);
      }
      return;
    }

    setUsernameError(null);

    // If username is unchanged and already saved on Clerk
    if (session.username === clean) {
      setCurrentStep(2);
      return;
    }

    if (!user) {
      setCurrentStep(2);
      return;
    }

    setIsSavingUsername(true);
    try {
      await user.update({ username: clean });
      setCurrentStep(2);
    } catch (err: unknown) {
      const errObj = err as { errors?: Array<{ message?: string; longMessage?: string }> };
      const message =
        errObj.errors?.[0]?.longMessage || errObj.errors?.[0]?.message || '';

      if (message.toLowerCase().includes('taken') || message.toLowerCase().includes('already in use')) {
        setUsernameError(copy.onboarding.usernameStatus.taken);
      } else {
        setUsernameError(copy.onboarding.usernameStatus.saveFailed);
      }
    } finally {
      setIsSavingUsername(false);
    }
  };

  // Step 2: Submit vibe
  const handleVibeSubmit = async () => {
    setIsSavingVibe(true);
    try {
      await session.updatePreferences({ vibeId: selectedVibeId });
      setCurrentStep(3);
    } catch {
      showToast(copy.toasts.saveFailed);
    } finally {
      setIsSavingVibe(false);
    }
  };

  // Step 3: Finish onboarding
  const handleFinishOnboarding = async () => {
    setIsCompleting(true);
    try {
      await session.updatePreferences({
        onboardingComplete: true,
        onboardedAt: new Date().toISOString(),
      });
      try {
        sessionStorage.removeItem('ivio.claim');
      } catch {
        // ignore
      }
      navigate('/dashboard', { replace: true });
    } catch {
      showToast(copy.toasts.saveFailed);
      setIsCompleting(false);
    }
  };

  const copyAddress = async () => {
    const fullUrl = `https://ivio.site/${session.username || usernameInput}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast(copy.toasts.linkCopied);
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top Header */}
      <header className="w-full max-w-[960px] mx-auto h-16 flex items-center justify-between">
        <Logo tone="light" size="md" isLink={false} />

        {/* Mobile Preview Trigger */}
        <button
          type="button"
          onClick={() => setMobilePreviewOpen(true)}
          className="lg:hidden inline-flex items-center gap-1.5 text-[14px] font-medium text-ink px-3 py-1.5 rounded-[10px] hover:bg-surface-2 border border-border focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
        >
          <Eye size={16} strokeWidth={1.5} />
          <span>{copy.onboarding.buttons.preview}</span>
        </button>
      </header>

      {/* Main Container: 2 columns on desktop (7 of 12 left, 5 of 12 right) */}
      <main className="w-full max-w-[960px] mx-auto my-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col">
            {/* Step Progress */}
            <StepProgress currentStep={currentStep} />

            <div className="mt-8">
              {/* Step 1: Confirm your address */}
              {currentStep === 1 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    {copy.onboarding.titles.step1}
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    {copy.onboarding.bodies.step1}
                  </p>

                  <form onSubmit={handleUsernameSubmit} className="mt-6">
                    <div className="relative flex h-14 w-full items-center rounded-[14px] px-2 pl-4 bg-surface border border-border-strong hover:border-[#A3A3A3] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(10,10,10,0.08)] transition-all duration-120">
                      <span className="font-mono text-[16px] text-muted select-none pointer-events-none shrink-0">
                        ivio.site/
                      </span>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => {
                          const val = normalizeUsername(e.target.value);
                          setUsernameInput(val);
                          const check = validateUsername(val);
                          if (!check.ok) {
                            if (check.reason === 'reserved') {
                              setUsernameError(copy.onboarding.usernameStatus.reserved);
                            } else {
                              setUsernameError(copy.onboarding.usernameStatus.validFormat);
                            }
                          } else {
                            setUsernameError(null);
                          }
                        }}
                        maxLength={USERNAME_MAX}
                        placeholder="yourname"
                        aria-label="Choose your address"
                        className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none font-sans px-1 placeholder:text-subtle"
                      />
                    </div>

                    {/* Status line: strictly reserved 20px min height */}
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-2.5 min-h-[20px] text-[14px]"
                    >
                      {usernameError ? (
                        <span className="text-error">{usernameError}</span>
                      ) : (
                        <span className="text-muted">
                          {copy.onboarding.usernameStatus.validFormat}
                        </span>
                      )}
                    </div>

                    <div className="mt-8 flex items-center justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={isSavingUsername}
                        disabled={
                          !usernameInput ||
                          usernameInput.length < USERNAME_MIN ||
                          !!usernameError
                        }
                      >
                        {copy.onboarding.buttons.continue}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 2: Pick a vibe */}
              {currentStep === 2 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    {copy.onboarding.titles.step2}
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    {copy.onboarding.bodies.step2}
                  </p>

                  <div className="mt-6">
                    <VibeTileGroup
                      selectedVibeId={selectedVibeId}
                      onSelect={(id) => setSelectedVibeId(id)}
                    />
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setCurrentStep(1)}
                    >
                      {copy.onboarding.buttons.back}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={isSavingVibe}
                      onClick={handleVibeSubmit}
                    >
                      {copy.onboarding.buttons.continue}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: You're all set */}
              {currentStep === 3 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    {copy.onboarding.titles.step3}
                  </h1>

                  <div className="mt-6">
                    <Card className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="font-mono text-[18px] font-medium text-ink">
                          ivio.site/{session.username || usernameInput}
                        </span>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={copyAddress}
                          iconRight={<Copy size={14} />}
                        >
                          {copy.onboarding.buttons.copyLink}
                        </Button>
                      </div>

                      <div className="h-px w-full bg-border" aria-hidden="true" />

                      <div className="text-[14px] text-muted flex items-center gap-2">
                        <span>Chosen style:</span>
                        <span className="font-medium text-ink">{activeVibe.name}</span>
                      </div>

                      <p className="text-[14px] text-muted leading-relaxed">
                        {copy.onboarding.bodies.step3}
                      </p>
                    </Card>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setCurrentStep(2)}
                    >
                      {copy.onboarding.buttons.back}
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      loading={isCompleting}
                      onClick={handleFinishOnboarding}
                    >
                      {copy.onboarding.buttons.goToDashboard}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 of 12): Desktop Live Phone Preview */}
          <div className="hidden lg:flex col-span-5 flex-col items-center justify-center sticky top-24">
            <VibePhone
              currentVibe={activeVibe}
              profile={profileData}
              width={300}
            />
            <span className="mt-4 text-[13px] text-muted select-none">
              Live preview
            </span>
          </div>
        </div>
      </main>

      {/* Spacing footer balance */}
      <div className="h-6" aria-hidden="true" />

      {/* Mobile Bottom Sheet for Phone Preview */}
      {mobilePreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Phone Preview"
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end"
        >
          <div className="bg-surface rounded-t-[20px] p-6 max-h-[85vh] overflow-y-auto flex flex-col items-center relative border-t border-border">
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
                width={280}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;

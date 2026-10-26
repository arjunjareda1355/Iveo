import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, X, Copy, Check, ArrowRight, ArrowLeft, Sparkles, Globe, Link2, Plus, Trash2 } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StepProgress } from '../components/onboarding/StepProgress';
import { VibeTileGroup } from '../components/onboarding/VibeTileGroup';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { VibePhone } from '../components/phone/VibePhone';
import { PhoneProfile } from '../components/phone/PhonePage';
import { ProfilePhotoUploader } from '../components/profile/ProfilePhotoUploader';
import { useIvioSession } from '../auth/useIvioSession';
import { useToast } from '../components/ui/Toast';
import { VIBES, VibeId } from '../lib/vibes';
import { ButtonShape } from '../lib/preferences';
import {
  normalizeUsername,
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../lib/username-rules';
import { checkUsernameAvailability } from '../lib/username';
import { pageUrl } from '../lib/site';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageBlock } from '../data/types';
import { seedStarterLinks } from '../data/linksApi';

const CRAFT_OPTIONS = [
  { id: 'design', label: 'Design & Visual Art', icon: '🎨', placeholderLinks: ['Portfolio', 'Shop prints'] },
  { id: 'music', label: 'Music & Audio', icon: '🎵', placeholderLinks: ['Latest single', 'Tour dates'] },
  { id: 'writing', label: 'Writing & Publishing', icon: '✍️', placeholderLinks: ['Latest essay', 'Newsletter'] },
  { id: 'tech', label: 'Tech & Software', icon: '💻', placeholderLinks: ['GitHub', 'Projects'] },
  { id: 'business', label: 'Business & Freelance', icon: '💼', placeholderLinks: ['Services', 'Book a call'] },
  { id: 'creator', label: 'Content Creator', icon: '⚡', placeholderLinks: ['YouTube', 'Instagram'] },
] as const;

const STEP_LABELS = ['Address', 'Profile', 'Craft', 'Links', 'Style', 'Publish'] as const;

export const OnboardingPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useIvioSession();

  // Step 1 to 6
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (!session.username || !validateUsername(session.username).ok) {
      return 1;
    }
    return 2;
  });

  // Step 1: Address state
  const [usernameInput, setUsernameInput] = useState<string>(() => {
    if (session.username) return session.username;
    try {
      const stored =
        sessionStorage.getItem('iveo.claim') ||
        sessionStorage.getItem('ivio.claim');
      if (stored) return normalizeUsername(stored);
    } catch {}
    return '';
  });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);

  // Step 2: Profile state
  const [displayName, setDisplayName] = useState<string>(() => session.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => session.imageUrl || null);
  const [bio, setBio] = useState<string>(() => session.bio || '');

  // Step 3: Craft
  const [selectedCraft, setSelectedCraft] = useState<string>('creator');

  // Step 4: Starter Links
  const [starterLinks, setStarterLinks] = useState<Array<{ id: string; title: string; url: string }>>([
    { id: '1', title: 'Portfolio / Website', url: 'https://' },
    { id: '2', title: 'Social profile', url: 'https://' },
  ]);

  // Step 5: Vibe & Shape
  const [selectedVibeId, setSelectedVibeId] = useState<VibeId>(session.vibeId || 'clean');
  const [buttonShape, setButtonShape] = useState<ButtonShape>('rounded');

  // Submitting
  const [isSaving, setIsSaving] = useState(false);

  // Mobile preview sheet state
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Focus step heading on step change
  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  // Lock body scroll when mobile preview is open
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

  // Real-time username check on step 1
  useEffect(() => {
    if (currentStep !== 1) return;
    if (!usernameInput || usernameInput.length < USERNAME_MIN) {
      setUsernameError(null);
      setUsernameAvailable(false);
      return;
    }

    let active = true;
    setIsCheckingUsername(true);

    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(usernameInput);
      if (!active) return;
      setIsCheckingUsername(false);

      if (res.status === 'available') {
        setUsernameError(null);
        setUsernameAvailable(true);
      } else {
        setUsernameError(res.message);
        setUsernameAvailable(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [usernameInput, currentStep]);

  // Update craft links suggestion when craft changes
  const handleSelectCraft = (craftId: string) => {
    setSelectedCraft(craftId);
    const found = CRAFT_OPTIONS.find((c) => c.id === craftId);
    if (found && starterLinks.every((l) => !l.title || l.title === 'Portfolio / Website' || l.title === 'Social profile')) {
      setStarterLinks([
        { id: '1', title: found.placeholderLinks[0] || 'My Work', url: 'https://' },
        { id: '2', title: found.placeholderLinks[1] || 'Follow along', url: 'https://' },
      ]);
    }
  };

  const activeVibe = VIBES.find((v) => v.id === selectedVibeId) || VIBES[0];

  const profileData: PhoneProfile = {
    name: displayName.trim() || session.username || usernameInput || 'Your name',
    handle: session.username || usernameInput || 'yourname',
    avatarUrl,
    bio: bio.trim() || 'Your bio goes here.',
    socials: session.socials || {},
  };

  const previewBlocks: PageBlock[] = starterLinks
    .filter((l) => l.title.trim().length > 0)
    .map((l, idx) => ({
      id: `preview-${l.id}`,
      kind: 'link',
      title: l.title,
      url: l.url.trim() || 'https://iveo.site',
      layout: 'classic',
      isActive: true,
      isArchived: false,
      position: idx,
    }));

  const BUTTON_RADIUS_MAP: Record<ButtonShape, number> = {
    square: 0,
    rounded: 12,
    pill: 999,
  };

  // Step 1: Save username
  const handleUsernameNext = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = normalizeUsername(usernameInput);
    const valResult = validateUsername(clean);

    if (!valResult.ok) {
      setUsernameError('Use 3 to 24 letters, numbers or underscores.');
      return;
    }

    setIsSaving(true);
    try {
      if (session.username !== clean) {
        await session.updateUsername(clean);
      }
      setCurrentStep(2);
    } catch (err: any) {
      setUsernameError(err?.message || 'That address is unavailable. Please try another.');
    } finally {
      setIsSaving(false);
    }
  };

  // Step 2: Profile photo & bio
  const handleProfileNext = async () => {
    setIsSaving(true);
    try {
      await session.updateProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl,
      });
      setCurrentStep(3);
    } catch {
      showToast("Couldn't save profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Step 3: Craft
  const handleCraftNext = async () => {
    setIsSaving(true);
    try {
      await session.updateProfile({ category: selectedCraft });
      setCurrentStep(4);
    } catch {
      showToast("Couldn't save category.");
    } finally {
      setIsSaving(false);
    }
  };

  // Step 4: Starter Links
  const handleLinksNext = async () => {
    setIsSaving(true);
    try {
      const uname = session.username || usernameInput;
      if (uname && starterLinks.length > 0) {
        await seedStarterLinks(uname, starterLinks);
      }
      setCurrentStep(5);
    } catch {
      showToast("Couldn't save links. You can edit them later.");
      setCurrentStep(5);
    } finally {
      setIsSaving(false);
    }
  };

  // Step 5: Style & Vibe
  const handleStyleNext = async () => {
    setIsSaving(true);
    try {
      await session.updatePreferences({
        vibeId: selectedVibeId,
        buttonShape,
      });
      setCurrentStep(6);
    } catch {
      showToast("Couldn't save style.");
    } finally {
      setIsSaving(false);
    }
  };

  // Step 6: Finish & Launch
  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await session.updatePreferences({
        onboardingComplete: true,
        onboardedAt: new Date().toISOString(),
        vibeId: selectedVibeId,
        buttonShape,
      });
      try {
        sessionStorage.removeItem('iveo.claim');
        sessionStorage.removeItem('ivio.claim');
      } catch {}
      showToast('Your page is published!');
      navigate('/dashboard', { replace: true });
    } catch {
      showToast("Couldn't finish setup. Try again.");
      setIsSaving(false);
    }
  };

  const copyAddress = async () => {
    const fullUrl = pageUrl(session.username || usernameInput);
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Address copied');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top Header */}
      <header className="w-full max-w-[980px] mx-auto h-16 flex items-center justify-between">
        <Logo tone="light" size="md" isLink={false} />

        {/* Mobile Preview Trigger */}
        <button
          type="button"
          onClick={() => setMobilePreviewOpen(true)}
          className="lg:hidden inline-flex items-center gap-1.5 text-[14px] font-medium text-ink px-3 py-1.5 rounded-[10px] hover:bg-surface-2 border border-border focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
        >
          <Eye size={16} strokeWidth={1.5} />
          <span>Preview</span>
        </button>
      </header>

      {/* Main Container: 2 columns on desktop (7 of 12 left, 5 of 12 right) */}
      <main className="w-full max-w-[980px] mx-auto my-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col">
            {/* Step Progress */}
            <StepProgress currentStep={currentStep} totalSteps={6} labels={STEP_LABELS} />

            <div className="mt-8">
              {/* STEP 1: Address */}
              {currentStep === 1 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    Confirm your address
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    This is where your personal page will live. You can change it anytime in Settings.
                  </p>

                  <form onSubmit={handleUsernameNext} className="mt-6">
                    <div className="relative flex h-14 w-full items-center rounded-[14px] px-2 pl-4 bg-surface border border-border-strong hover:border-[#A3A3A3] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(10,10,10,0.08)] transition-all duration-120">
                      <span className="font-mono text-[16px] text-muted select-none pointer-events-none shrink-0">
                        iveo.site/
                      </span>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(normalizeUsername(e.target.value))}
                        maxLength={USERNAME_MAX}
                        placeholder="yourname"
                        aria-label="Choose your address"
                        className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none font-sans px-1 placeholder:text-subtle"
                        autoFocus
                      />
                      {usernameAvailable && (
                        <div className="mr-3 text-emerald-600 flex items-center gap-1 text-[13px] font-medium">
                          <Check size={16} strokeWidth={2.5} />
                          <span>Available</span>
                        </div>
                      )}
                    </div>

                    {usernameError && (
                      <p className="mt-2 text-[13px] text-red-600 font-medium">{usernameError}</p>
                    )}

                    <div className="mt-6">
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={isSaving || isCheckingUsername}
                        disabled={!usernameInput || usernameInput.length < USERNAME_MIN || !!usernameError}
                      >
                        Continue
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 2: Profile (Name, Photo, Bio) */}
              {currentStep === 2 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    Set up your identity
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    Add your name, photo, and a short bio so visitors know who you are.
                  </p>

                  <div className="mt-6 flex flex-col gap-5">
                    {/* Photo Uploader */}
                    <div>
                      <label className="block text-[13px] font-medium text-ink mb-2">
                        Profile Photo
                      </label>
                      <ProfilePhotoUploader
                        currentAvatarUrl={avatarUrl}
                        initials={displayName || usernameInput || 'ME'}
                        onAvatarChange={(url) => setAvatarUrl(url)}
                      />
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-[13px] font-medium text-ink mb-1.5">
                        Your Name / Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Maya Ellis"
                        className="w-full h-12 px-4 rounded-[12px] bg-surface border border-border text-[15px] text-ink outline-none focus:border-ink focus:shadow-xs transition-all"
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-medium text-ink">
                          Short Bio
                        </label>
                        <span className="text-[11px] text-muted">{bio.length}/160</span>
                      </div>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 160))}
                        rows={3}
                        placeholder="e.g. Illustrator and writer. Zines, prints and the occasional essay."
                        className="w-full p-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink focus:shadow-xs transition-all resize-none"
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={() => setCurrentStep(1)}
                      >
                        <ArrowLeft size={16} className="mr-1.5" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        loading={isSaving}
                        onClick={handleProfileNext}
                      >
                        <span>Continue</span>
                        <ArrowRight size={16} className="ml-1.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Craft & Category */}
              {currentStep === 3 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    What do you make?
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    Select your focus to customize your link recommendations.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CRAFT_OPTIONS.map((craft) => {
                      const isSelected = selectedCraft === craft.id;
                      return (
                        <button
                          key={craft.id}
                          type="button"
                          onClick={() => handleSelectCraft(craft.id)}
                          className={`p-4 rounded-[14px] border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-ink bg-surface shadow-[0_0_0_1px_#0A0A0A]'
                              : 'border-border bg-surface-2 hover:border-border-2'
                          }`}
                        >
                          <span className="text-[24px] select-none">{craft.icon}</span>
                          <div>
                            <span className="text-[15px] font-medium text-ink block">
                              {craft.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => setCurrentStep(2)}
                    >
                      <ArrowLeft size={16} className="mr-1.5" />
                      <span>Back</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      loading={isSaving}
                      onClick={handleCraftNext}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} className="ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: Starter Links */}
              {currentStep === 4 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    Add your first links
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    Add a couple of destinations you want to share with your audience. You can add more later.
                  </p>

                  <div className="mt-6 space-y-3.5">
                    {starterLinks.map((link, idx) => (
                      <div
                        key={link.id}
                        className="p-3.5 bg-surface border border-border rounded-[14px] flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-mono text-muted uppercase">
                            Link #{idx + 1}
                          </span>
                          {starterLinks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setStarterLinks(starterLinks.filter((_, i) => i !== idx))}
                              className="text-muted hover:text-red-600 transition-colors"
                              aria-label="Remove link"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.title}
                            onChange={(e) => {
                              const updated = [...starterLinks];
                              updated[idx].title = e.target.value;
                              setStarterLinks(updated);
                            }}
                            placeholder="Title (e.g. Portfolio)"
                            className="h-10 px-3 rounded-[10px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...starterLinks];
                              updated[idx].url = e.target.value;
                              setStarterLinks(updated);
                            }}
                            placeholder="https://yourlink.com"
                            className="h-10 px-3 rounded-[10px] bg-surface-2 border border-border text-[14px] font-mono text-ink outline-none focus:border-ink"
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        setStarterLinks([
                          ...starterLinks,
                          { id: String(Date.now()), title: '', url: 'https://' },
                        ])
                      }
                      fullWidth
                    >
                      <Plus size={15} className="mr-1.5" />
                      <span>Add another link</span>
                    </Button>
                  </div>

                  <div className="mt-8 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => setCurrentStep(3)}
                    >
                      <ArrowLeft size={16} className="mr-1.5" />
                      <span>Back</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      loading={isSaving}
                      onClick={handleLinksNext}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} className="ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 5: Style & Vibe */}
              {currentStep === 5 && (
                <div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    Pick a vibe
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    Choose an aesthetic starting point. You can customize fonts and shapes anytime.
                  </p>

                  <div className="mt-6">
                    <VibeTileGroup
                      selectedVibeId={selectedVibeId}
                      onSelect={(vId) => setSelectedVibeId(vId)}
                    />
                  </div>

                  <div className="mt-6">
                    <label className="block text-[13px] font-medium text-ink mb-2">
                      Button Shape
                    </label>
                    <div className="max-w-[320px]">
                      <SegmentedControl<ButtonShape>
                        options={[
                          { value: 'square', label: 'Square' },
                          { value: 'rounded', label: 'Rounded' },
                          { value: 'pill', label: 'Pill' },
                        ]}
                        value={buttonShape}
                        onChange={(s) => setButtonShape(s)}
                        ariaLabel="Button shape"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => setCurrentStep(4)}
                    >
                      <ArrowLeft size={16} className="mr-1.5" />
                      <span>Back</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      loading={isSaving}
                      onClick={handleStyleNext}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} className="ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 6: Publish & Launch */}
              {currentStep === 6 && (
                <div>
                  <div className="w-12 h-12 rounded-full bg-ink text-surface flex items-center justify-center mb-4">
                    <Sparkles size={24} />
                  </div>

                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[28px] font-medium text-ink leading-tight tracking-[-0.02em] outline-none"
                  >
                    Your page is ready to publish
                  </h1>
                  <p className="mt-2 text-[15px] text-muted leading-relaxed">
                    Your personal iveo page is all configured. Click below to publish and open your creator dashboard.
                  </p>

                  {/* Summary Card */}
                  <Card className="mt-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted">Your Address</span>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="font-mono text-[14px] font-semibold text-ink hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>iveo.site/{session.username || usernameInput}</span>
                        <Copy size={13} className="text-muted" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-[13px] text-muted">Selected Vibe</span>
                      <span className="text-[14px] font-medium text-ink capitalize">
                        {activeVibe.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-[13px] text-muted">Links Prepared</span>
                      <span className="text-[14px] font-medium text-ink">
                        {previewBlocks.length} links
                      </span>
                    </div>
                  </Card>

                  <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      loading={isSaving}
                      onClick={handleFinish}
                      fullWidth
                    >
                      Publish & Go to Dashboard
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={copyAddress}
                    >
                      <Copy size={16} className="mr-1.5" />
                      <span>Copy link</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 of 12): Desktop Sticky Live Phone Preview */}
          <div className="hidden lg:flex col-span-5 flex-col items-center justify-center sticky top-24">
            <VibePhone
              currentVibe={activeVibe}
              profile={profileData}
              blocks={previewBlocks}
              buttonRadiusOverride={BUTTON_RADIUS_MAP[buttonShape]}
              width={300}
            />
            <span className="mt-4 text-[13px] text-muted select-none">
              Live preview
            </span>
          </div>
        </div>
      </main>

      {/* Mobile Floating Preview Sheet */}
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

            <VibePhone
              currentVibe={activeVibe}
              profile={profileData}
              blocks={previewBlocks}
              buttonRadiusOverride={BUTTON_RADIUS_MAP[buttonShape]}
              width={280}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;

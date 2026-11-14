import React, { useState, useRef, useEffect, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { useIvioSession } from '../auth/useIvioSession';
import {
  normalizeUsername,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../lib/username-rules';
import { checkUsernameAvailability } from '../lib/username';
import { copy } from '../content/copy';
import { cn } from '../lib/cn';

interface ClaimFormProps {
  tone?: 'light' | 'dark';
  className?: string;
  initialValue?: string;
  centerStatus?: boolean;
}

// Availability is mocked on the client. Replace with a real lookup when Firestore is added.

export const ClaimForm: React.FC<ClaimFormProps> = ({
  tone = 'light',
  className,
  initialValue = '',
  centerStatus = false,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const statusId = useId();

  const session = useIvioSession();
  const { isLoaded, isSignedIn, username, onboardingComplete } = session;

  const [rawInput, setRawInput] = useState<string>(initialValue);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [statusState, setStatusState] = useState<
    'initial' | 'checking' | 'available' | 'unavailable' | 'empty_submit'
  >('initial');
  const [availableUsername, setAvailableUsername] = useState<string>('');

  const isDark = tone === 'dark';

  // Debounced availability check
  useEffect(() => {
    let active = true;
    if (!rawInput || rawInput.length < USERNAME_MIN) {
      setIsChecking(false);
      setStatusState('initial');
      setAvailableUsername('');
      return;
    }

    setIsChecking(true);
    setStatusState('checking');

    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailability(rawInput, session.userId || undefined, session.primaryEmail);
      if (!active) return;
      setIsChecking(false);

      if (res.status === 'available') {
        setStatusState('available');
        setAvailableUsername(res.username);
      } else {
        setStatusState('unavailable');
        setAvailableUsername('');
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rawInput, session.userId, session.primaryEmail]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = normalizeUsername(e.target.value);
    setRawInput(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = rawInput.trim();
    if (!trimmed) {
      navigate('/signup');
      return;
    }

    const clean = normalizeUsername(trimmed);
    if (!clean || clean.length < USERNAME_MIN) {
      navigate('/signup');
      return;
    }

    try {
      sessionStorage.setItem('iveo.claim', clean);
      sessionStorage.setItem('ivio.claim', clean);
    } catch {}

    navigate(`/signup?u=${encodeURIComponent(clean)}`);
  };

  // Signed in state: compact pill + button
  if (isLoaded && isSignedIn) {
    const targetUrl = onboardingComplete ? '/dashboard' : '/onboarding';
    const buttonText = onboardingComplete
      ? copy.hero.goToDashboard
      : copy.hero.continueSetup;

    return (
      <div
        className={cn(
          'w-full max-w-[480px] flex flex-col sm:flex-row items-stretch sm:items-center gap-3',
          centerStatus && 'justify-center',
          className
        )}
      >
        <Link
          to={username ? `/${username}` : '/dashboard'}
          target={username ? '_blank' : undefined}
          rel={username ? 'noopener noreferrer' : undefined}
          title={username ? `View live profile iveo.site/${username}` : undefined}
          className={cn(
            'h-12 px-4 rounded-[10px] flex items-center justify-center font-mono text-[15px] border transition-opacity hover:opacity-85 cursor-pointer',
            isDark
              ? 'bg-[#141414] text-[#FAFAFA] border-[#262626]'
              : 'bg-surface text-ink border-border-strong'
          )}
        >
          iveo.site/{username || 'you'}
        </Link>

        <Button
          as={Link}
          to={targetUrl}
          variant={isDark ? 'inverse' : 'primary'}
          size="lg"
          iconRight={<ArrowRight size={16} strokeWidth={1.5} />}
        >
          {buttonText}
        </Button>
      </div>
    );
  }

  // Signed out (or while Clerk is loading, to avoid layout jump)
  const renderStatus = () => {
    if (statusState === 'empty_submit') {
      return (
        <span className="text-error font-normal text-[14px]">
          Enter the address you want.
        </span>
      );
    }

    if (statusState === 'checking' || isChecking) {
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[14px]',
            isDark ? 'text-inverse-muted' : 'text-muted'
          )}
        >
          <svg
            className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" className="opacity-25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <span>Checking availability</span>
        </span>
      );
    }

    if (statusState === 'unavailable') {
      return (
        <span className="text-error font-normal text-[14px]">
          That address isn't available. Try another.
        </span>
      );
    }

    if (statusState === 'available') {
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[14px] font-medium',
            isDark ? 'text-inverse-text' : 'text-ink'
          )}
        >
          <Check size={16} strokeWidth={2} className="shrink-0" />
          <span>iveo.site/{availableUsername} is available</span>
        </span>
      );
    }

    // Default untouched / too short
    return (
      <span
        className={cn(
          'text-[14px]',
          isDark ? 'text-inverse-muted' : 'text-muted'
        )}
      >
        Use {USERNAME_MIN} to {USERNAME_MAX} letters, numbers or hyphens.
      </span>
    );
  };

  return (
    <div className={cn('w-full max-w-[480px]', className)}>
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full flex flex-col sm:block"
      >
        <div
          className={cn(
            'relative flex h-14 w-full items-center rounded-[14px] px-2 pl-4 transition-all duration-120',
            isDark
              ? 'bg-[#141414] border border-[#262626] hover:border-[#383838] focus-within:border-[#FAFAFA] focus-within:shadow-[0_0_0_3px_rgba(250,250,250,0.12)]'
              : 'bg-surface border border-border-strong hover:border-[#A3A3A3] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(10,10,10,0.08)]'
          )}
        >
          <span
            className={cn(
              'font-mono text-[16px] select-none shrink-0 pointer-events-none pl-1 pr-1 font-medium',
              isDark ? 'text-inverse-muted' : 'text-muted'
            )}
          >
            iveo.site/
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            value={rawInput}
            onChange={handleChange}
            placeholder={copy.hero.claimPlaceholder}
            aria-label="Choose your iveo address"
            aria-describedby={statusId}
            maxLength={USERNAME_MAX}
            className={cn(
              'flex-1 min-w-0 bg-transparent text-[16px] outline-none font-sans px-1 placeholder:text-subtle',
              isDark ? 'text-inverse-text' : 'text-ink'
            )}
          />
          {/* Desktop inline button */}
          <div className="hidden sm:block shrink-0">
            <Button
              type="submit"
              variant={isDark ? 'inverse' : 'primary'}
              size="md"
              iconRight={<ArrowRight size={16} strokeWidth={1.5} />}
            >
              {copy.hero.claimButton}
            </Button>
          </div>
        </div>

        {/* Mobile stacked button */}
        <div className="block sm:hidden mt-3 w-full">
          <Button
            type="submit"
            variant={isDark ? 'inverse' : 'primary'}
            size="lg"
            fullWidth
            iconRight={<ArrowRight size={16} strokeWidth={1.5} />}
          >
            {copy.hero.claimButton}
          </Button>
        </div>
      </form>

      {/* Status line */}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        className={cn(
          'mt-2.5 min-h-[20px] flex items-center transition-opacity duration-120',
          centerStatus ? 'justify-center text-center' : 'justify-start text-left'
        )}
      >
        {renderStatus()}
      </div>
    </div>
  );
};

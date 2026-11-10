import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignUp } from '@clerk/react';
import { Link as LinkIcon } from 'lucide-react';
import { AuthLayout, AuthSkeletonCard } from '../auth/AuthLayout';
import { GuestOnly } from '../auth/guards';
import { normalizeUsername, validateUsername } from '../lib/username-rules';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

export const SignupPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const [searchParams] = useSearchParams();
  const [claim, setClaim] = useState<string | null>(null);

  useEffect(() => {
    const rawParam = searchParams.get('u');
    let effectiveClaim: string | null = null;

    if (rawParam) {
      const normalized = normalizeUsername(rawParam);
      if (validateUsername(normalized).ok) {
        effectiveClaim = normalized;
        try {
          sessionStorage.setItem('iveo.claim', normalized);
          sessionStorage.setItem('ivio.claim', normalized);
        } catch {
          // ignore storage error
        }
      }
    }

    if (!effectiveClaim) {
      try {
        const stored =
          sessionStorage.getItem('iveo.claim') ||
          sessionStorage.getItem('ivio.claim');
        if (stored) {
          const normalized = normalizeUsername(stored);
          if (validateUsername(normalized).ok) {
            effectiveClaim = normalized;
          }
        }
      } catch {
        // ignore storage error
      }
    }

    setClaim(effectiveClaim);
  }, [searchParams]);

  const contextElement = claim ? (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div className="inline-flex h-9 items-center gap-2 rounded-full bg-surface border border-border px-3.5 text-[14px] shadow-xs">
        <LinkIcon size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-muted">{copy.auth.claimPillPrefix}</span>
        <span className="font-mono font-medium text-ink">iveo.site/{claim}</span>
      </div>
      <span className="text-[13px] text-muted text-center">
        {copy.auth.claimPillHelper}
      </span>
    </div>
  ) : undefined;

  return (
    <GuestOnly>
      <AuthLayout
        title={copy.auth.signupTitle}
        contextElement={contextElement}
      >
        <SignUp
          routing="path"
          path="/signup"
          signInUrl="/login"
          forceRedirectUrl="/onboarding"
          fallbackRedirectUrl="/onboarding"
          signInFallbackRedirectUrl="/dashboard"
          signInForceRedirectUrl="/dashboard"
          initialValues={claim ? { username: claim } : undefined}
          fallback={<AuthSkeletonCard />}
        />
      </AuthLayout>
    </GuestOnly>
  );
};

export default SignupPage;

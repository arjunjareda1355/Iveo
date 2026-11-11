import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { CLERK_PUBLISHABLE_KEY, HAS_CLERK_KEY } from '../lib/env';
import { iveoAppearance } from './appearance';
import { getSubdomainFromHostname } from '../lib/site';

interface ClerkRootProps {
  children: React.ReactNode;
}

function normalizeClerkToPath(to: string): string {
  if (!to) return '/';
  if (to.startsWith('http://') || to.startsWith('https://')) {
    try {
      const parsed = new URL(to);
      if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      // fallback to original string
    }
  }
  return to;
}

export const ClerkRoot: React.FC<ClerkRootProps> = ({ children }) => {
  const navigate = useNavigate();

  if (!HAS_CLERK_KEY) {
    return <>{children}</>;
  }

  const handleClerkNavigate = (to: string, replace = false) => {
    const target = normalizeClerkToPath(to);
    if (target.startsWith('http://') || target.startsWith('https://')) {
      if (replace) {
        window.location.replace(target);
      } else {
        window.location.href = target;
      }
      return;
    }
    navigate(target, { replace });
  };

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      supportEmail="help@iveo.site"
      routerPush={(to) => handleClerkNavigate(to, false)}
      routerReplace={(to) => handleClerkNavigate(to, true)}
      appearance={iveoAppearance}
    >
      {children}
    </ClerkProvider>
  );
};


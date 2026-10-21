import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { CLERK_PUBLISHABLE_KEY, HAS_CLERK_KEY } from '../lib/env';
import { iveoAppearance } from './appearance';

interface ClerkRootProps {
  children: React.ReactNode;
}

export const ClerkRoot: React.FC<ClerkRootProps> = ({ children }) => {
  const navigate = useNavigate();

  if (!HAS_CLERK_KEY) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/onboarding"
      supportEmail="help@iveo.site"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      allowedRedirectOrigins={[window.location.origin]}
      appearance={iveoAppearance}
    >
      {children}
    </ClerkProvider>
  );
};

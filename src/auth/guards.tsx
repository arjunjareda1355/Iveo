import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useIvioSession } from './useIvioSession';
import { AuthSplash } from './AuthSplash';
import { LoadError } from './LoadError';
import { SetupMissingKey } from './SetupMissingKey';
import { safeRedirectPath } from './redirect';
import { HAS_CLERK_KEY } from '../lib/env';
import { useAccountDeletion } from '../components/account/AccountDeletionProvider';

interface GuardProps {
  children: React.ReactNode;
}

export const AuthLoaderGuard: React.FC<GuardProps> = ({ children }) => {
  const { isLoaded } = useIvioSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (!HAS_CLERK_KEY) {
    return <SetupMissingKey />;
  }

  if (timedOut && !isLoaded) {
    return <LoadError />;
  }

  if (!isLoaded) {
    return <AuthSplash />;
  }

  return <>{children}</>;
};

export const GuestOnly: React.FC<GuardProps> = ({ children }) => {
  const { isSignedIn, onboardingComplete } = useIvioSession();
  const { isDeleting } = useAccountDeletion();
  const [searchParams] = useSearchParams();

  if (isDeleting) {
    return <>{children}</>;
  }

  return (
    <AuthLoaderGuard>
      {isSignedIn ? (
        <Navigate
          to={
            !onboardingComplete
              ? '/onboarding'
              : safeRedirectPath(searchParams.get('redirect_url')) || '/'
          }
          replace
        />
      ) : (
        children
      )}
    </AuthLoaderGuard>
  );
};

export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { isSignedIn } = useIvioSession();
  const { isDeleting } = useAccountDeletion();
  const location = useLocation();

  if (isDeleting) {
    return <>{children}</>;
  }

  const currentPath = location.pathname + location.search;

  return (
    <AuthLoaderGuard>
      {!isSignedIn ? (
        <Navigate
          to={`/login?redirect_url=${encodeURIComponent(currentPath)}`}
          replace
        />
      ) : (
        children
      )}
    </AuthLoaderGuard>
  );
};

export const RequireOnboarded: React.FC<GuardProps> = ({ children }) => {
  const { onboardingComplete } = useIvioSession();
  const { isDeleting } = useAccountDeletion();

  if (isDeleting) {
    return <>{children}</>;
  }

  return (
    <RequireAuth>
      {!onboardingComplete ? <Navigate to="/onboarding" replace /> : children}
    </RequireAuth>
  );
};

export const RequireNotOnboarded: React.FC<GuardProps> = ({ children }) => {
  const { onboardingComplete } = useIvioSession();
  const { isDeleting } = useAccountDeletion();

  if (isDeleting) {
    return <>{children}</>;
  }

  return (
    <RequireAuth>
      {onboardingComplete ? <Navigate to="/dashboard" replace /> : children}
    </RequireAuth>
  );
};

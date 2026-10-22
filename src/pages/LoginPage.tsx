import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import { AuthLayout, AuthSkeletonCard } from '../auth/AuthLayout';
import { GuestOnly } from '../auth/guards';
import { safeRedirectPath } from '../auth/redirect';
import { copy } from '../content/copy';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawRedirectUrl = searchParams.get('redirect_url');

  useEffect(() => {
    if (rawRedirectUrl) {
      const safe = safeRedirectPath(rawRedirectUrl);
      if (!safe) {
        // Discard unsafe redirect target silently with a replace navigation
        navigate('/login', { replace: true });
      }
    }
  }, [rawRedirectUrl, navigate]);

  const validatedRedirectUrl = safeRedirectPath(rawRedirectUrl) || '/';

  return (
    <GuestOnly>
      <AuthLayout title={copy.auth.loginTitle}>
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          fallbackRedirectUrl={validatedRedirectUrl}
          signUpFallbackRedirectUrl="/onboarding"
          fallback={<AuthSkeletonCard />}
        />
      </AuthLayout>
    </GuestOnly>
  );
};

export default LoginPage;

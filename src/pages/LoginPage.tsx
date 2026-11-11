import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import { AuthLayout, AuthSkeletonCard } from '../auth/AuthLayout';
import { GuestOnly } from '../auth/guards';
import { safeRedirectPath } from '../auth/redirect';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

export const LoginPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const [searchParams] = useSearchParams();
  const rawRedirectUrl = searchParams.get('redirect_url');
  const validatedRedirectUrl = safeRedirectPath(rawRedirectUrl) || '/dashboard';

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

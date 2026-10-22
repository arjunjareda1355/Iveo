import React from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/react';
import { AuthLayout, AuthSkeletonCard } from '../auth/AuthLayout';

export const SSOCallbackPage: React.FC = () => {
  return (
    <AuthLayout title="Completing sign in...">
      <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/onboarding"
          continueSignUpUrl="/onboarding"
          firstFactorUrl="/login"
          secondFactorUrl="/login"
        />
        <AuthSkeletonCard />
      </div>
    </AuthLayout>
  );
};

export default SSOCallbackPage;

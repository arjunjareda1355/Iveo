import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SignIn, useSignIn } from '@clerk/react';
import { KeyRound } from 'lucide-react';
import { AuthLayout, AuthSkeletonCard } from '../auth/AuthLayout';
import { GuestOnly } from '../auth/guards';
import { safeRedirectPath } from '../auth/redirect';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';
import { Button } from '../components/ui/Button';
import { HAS_CLERK_KEY } from '../lib/env';

interface PasskeySignInSectionProps {
  redirectUrl: string;
}

const PasskeySignInSection: React.FC<PasskeySignInSectionProps> = ({ redirectUrl }) => {
  const { signIn } = useSignIn();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePasskeySignIn = async () => {
    if (!signIn || isLoading) return;
    if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
      setErrorMsg('Passkeys are not supported in this browser.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const { error } = await signIn.passkey({ flow: 'discoverable' });
      if (error) {
        const msg = String(error.longMessage || error.message || '');
        if (/cancel|abort|NotAllowedError|passkey_retrieval_cancelled/i.test(msg + String(error.code || ''))) {
          setErrorMsg('Passkey sign-in was cancelled.');
        } else {
          setErrorMsg(msg || 'Could not sign in with passkey. Try your email or password.');
        }
        return;
      }

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const target = decorateUrl(redirectUrl);
            if (target.startsWith('http://') || target.startsWith('https://')) {
              window.location.replace(target);
            } else {
              navigate(target, { replace: true });
            }
          },
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/cancel|abort|NotAllowedError/i.test(msg)) {
        setErrorMsg('Passkey sign-in was cancelled.');
      } else {
        setErrorMsg(msg || 'Could not sign in with passkey.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="relative flex items-center justify-center my-1">
        <div className="w-full border-t border-border" />
        <span className="px-3 text-[12px] text-muted bg-bg shrink-0">or</span>
        <div className="w-full border-t border-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        fullWidth
        loading={isLoading}
        onClick={handlePasskeySignIn}
      >
        <KeyRound size={16} strokeWidth={1.6} className="mr-2" />
        <span>Sign in with a passkey</span>
      </Button>

      {errorMsg && (
        <p role="alert" className="text-[12px] text-red-600 text-center mt-0.5">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

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
        {HAS_CLERK_KEY && <PasskeySignInSection redirectUrl={validatedRedirectUrl} />}
      </AuthLayout>
    </GuestOnly>
  );
};

export default LoginPage;

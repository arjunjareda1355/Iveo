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

function isInsideIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function classifyPasskeySignInError(
  err: unknown,
  inIframe: boolean
): { message: string; needsTopLevelTab: boolean } {
  const anyErr = err as any;
  const code = String(anyErr?.code || anyErr?.errors?.[0]?.code || '');
  const name = String(anyErr?.name || '');
  const msg = String(
    anyErr?.longMessage ||
      anyErr?.errors?.[0]?.longMessage ||
      anyErr?.message ||
      anyErr?.errors?.[0]?.message ||
      ''
  );
  const combined = `${code} ${name} ${msg}`;

  if (
    /publickey-credentials|SecurityError|Permissions-Policy|not enabled in this document|cross-origin/i.test(
      combined
    ) ||
    (inIframe &&
      (code === 'passkey_retrieval_cancelled' ||
        /NotAllowedError|not allowed/i.test(combined)))
  ) {
    return {
      message:
        'Your browser blocked passkey sign-in inside this embedded preview. Open Login in a full browser tab to use your passkey.',
      needsTopLevelTab: true,
    };
  }
  if (
    code === 'passkey_invalid_rpID_or_domain' ||
    /rpId|relying party|domain does not match/i.test(combined)
  ) {
    return {
      message:
        'Passkey sign-in cannot be verified on this domain. Open Login on the primary domain or sign in with email.',
      needsTopLevelTab: inIframe,
    };
  }
  if (code === 'passkey_pa_not_supported' || code === 'passkey_not_supported') {
    return {
      message: 'This device or browser does not support passkey authentication.',
      needsTopLevelTab: false,
    };
  }
  if (
    code === 'passkey_retrieval_cancelled' ||
    /AbortError|passkey_retrieval_cancelled|cancel/i.test(combined)
  ) {
    return {
      message: 'Passkey sign-in was cancelled.',
      needsTopLevelTab: false,
    };
  }
  if (
    /form_identifier_not_found|passkey_not_found|no_passkey|not found/i.test(combined)
  ) {
    return {
      message:
        'No saved passkey matched on this device. Sign in with email first, then add a passkey in Account settings.',
      needsTopLevelTab: false,
    };
  }
  if (/NotAllowedError/i.test(combined)) {
    return {
      message:
        'No passkey was selected or verification timed out. Ensure biometrics or screen lock is enabled and try again.',
      needsTopLevelTab: false,
    };
  }
  return {
    message: msg || 'Could not sign in with passkey. Try signing in with email or social login above.',
    needsTopLevelTab: false,
  };
}

const PasskeySignInSection: React.FC<PasskeySignInSectionProps> = ({ redirectUrl }) => {
  const { signIn, fetchStatus } = useSignIn();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsTopLevelTab, setNeedsTopLevelTab] = useState(false);
  const inIframe = isInsideIframe();

  const handlePasskeySignIn = async () => {
    if (!signIn || isLoading || fetchStatus === 'fetching') return;
    if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
      setErrorMsg('Passkeys are not supported in this browser.');
      setNeedsTopLevelTab(false);
      return;
    }

    setErrorMsg(null);
    setNeedsTopLevelTab(false);
    setIsLoading(true);
    try {
      // Always reset any prior or completed sign-in attempt before starting discoverable passkey auth.
      if (signIn.status && signIn.status !== 'needs_identifier') {
        await signIn.reset();
      }

      let passkeyResult = await signIn.passkey({ flow: 'discoverable' });
      if (
        passkeyResult.error &&
        /SignIn\.create|strategy|sign_in_no_identification|attempt/i.test(
          `${(passkeyResult.error as any)?.code || ''} ${passkeyResult.error?.message || ''}`
        )
      ) {
        const created = await signIn.create({ strategy: 'passkey' });
        if (!created.error) {
          passkeyResult = await signIn.passkey();
        }
      }

      if (passkeyResult.error) {
        const classified = classifyPasskeySignInError(passkeyResult.error, inIframe);
        setErrorMsg(classified.message);
        setNeedsTopLevelTab(classified.needsTopLevelTab);
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
      } else if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
        setErrorMsg('Passkey verified. Complete the second-step verification prompt above to finish signing in.');
      } else {
        setErrorMsg('Sign-in needs another verification step. Please use the form above.');
      }
    } catch (err: unknown) {
      const classified = classifyPasskeySignInError(err, inIframe);
      setErrorMsg(classified.message);
      setNeedsTopLevelTab(classified.needsTopLevelTab);
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
        disabled={!signIn || isLoading || fetchStatus === 'fetching'}
        onClick={handlePasskeySignIn}
      >
        <KeyRound size={16} strokeWidth={1.6} className="mr-2" />
        <span>Sign in with a passkey</span>
      </Button>

      {errorMsg && (
        <div role="alert" className="text-[12px] text-red-600 text-center mt-0.5 flex flex-col items-center gap-1.5">
          <p>{errorMsg}</p>
          {needsTopLevelTab && typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline text-ink hover:text-ink-2"
            >
              Open login in full tab
            </a>
          )}
        </div>
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

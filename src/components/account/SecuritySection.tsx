import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReverification, useSession, useUser } from '@clerk/react';
import {
  AlertCircle,
  Check,
  KeyRound,
  Laptop,
  Loader2,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import { HAS_CLERK_KEY } from '../../lib/env';
import { PasskeysSection } from './PasskeysCard';

function extractPlainError(err: unknown, fallback: string): string {
  const anyErr = err as any;
  const code = String(anyErr?.errors?.[0]?.code || anyErr?.code || '');
  if (code === 'reverification_cancelled') {
    return 'Verification was cancelled. Confirm your identity to finish this change.';
  }
  const rawMsg = String(
    anyErr?.errors?.[0]?.longMessage ||
      anyErr?.errors?.[0]?.message ||
      anyErr?.message ||
      ''
  ).trim();
  if (!rawMsg || /clerk/i.test(rawMsg)) {
    return fallback;
  }
  return rawMsg;
}

function formatSessionDate(value: Date | string | null | undefined): string {
  if (!value) return 'Recently';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const SIGN_IN_PROVIDERS: ReadonlyArray<{
  strategy: 'oauth_google' | 'oauth_github' | 'oauth_discord' | 'oauth_apple';
  providerKey: string;
  label: string;
}> = [
  { strategy: 'oauth_google', providerKey: 'google', label: 'Google' },
  { strategy: 'oauth_github', providerKey: 'github', label: 'GitHub' },
  { strategy: 'oauth_discord', providerKey: 'discord', label: 'Discord' },
  { strategy: 'oauth_apple', providerKey: 'apple', label: 'Apple' },
];

interface RowOverflowProps {
  ariaLabel: string;
  items: ReadonlyArray<{
    label: string;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }>;
}

const RowOverflowMenu: React.FC<RowOverflowProps> = ({ ariaLabel, items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[12px] text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] w-48 rounded-[12px] bg-surface border border-border shadow-[0_12px_32px_rgba(10,10,10,0.12)] py-1.5 z-40"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`w-full min-h-[44px] px-3.5 flex items-center text-[14px] font-medium text-left transition-colors cursor-pointer disabled:opacity-50 ${
                item.destructive
                  ? 'text-[color:var(--error,#B3261E)] hover:bg-red-50'
                  : 'text-ink hover:bg-surface-2'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface SecuritySectionProps {
  isDemo?: boolean;
  offline?: boolean;
  connectedPageProviders?: Set<string>;
}

const ClerkSecuritySectionInner: React.FC<{
  offline: boolean;
  connectedPageProviders: Set<string>;
}> = ({ offline, connectedPageProviders }) => {
  const { user, isLoaded } = useUser();
  const { session: activeSession } = useSession();
  const { showToast } = useToast();

  // Add / verify email state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null);
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [emailStep, setEmailStep] = useState<'enter' | 'verify'>('enter');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [signOutOthersPw, setSignOutOthersPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Sign-in providers modal
  const [connectProviderOpen, setConnectProviderOpen] = useState(false);
  const [providerBusyId, setProviderBusyId] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  // Two-step verification modal
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [twoFactorSupported, setTwoFactorSupported] = useState<boolean>(true);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // Sessions / signed-in devices state
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      status: string;
      lastActiveAt: Date;
      latestActivity?: {
        browserName?: string;
        browserVersion?: string;
        deviceType?: string;
        city?: string;
        country?: string;
        isMobile?: boolean;
      };
      revoke: () => Promise<unknown>;
    }>
  >([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAllOther, setRevokingAllOther] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user || typeof user.getSessions !== 'function') {
      setSessionsLoading(false);
      return;
    }
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const list = await user.getSessions();
      const activeList = (Array.isArray(list) ? list : []).filter(
        (s) => s.status === 'active' || s.id === activeSession?.id
      );
      setSessions(activeList as typeof sessions);
    } catch {
      setSessionsError("Couldn't load signed-in devices.");
    } finally {
      setSessionsLoading(false);
    }
  }, [user, activeSession?.id]);

  useEffect(() => {
    if (isLoaded && user) {
      loadSessions();
    } else if (isLoaded) {
      setSessionsLoading(false);
    }
  }, [isLoaded, user, loadSessions]);

  // Reverification-wrapped sensitive mutations (AR-4)
  const createEmailWithReverify = useReverification(async (email: string) => {
    if (!user) throw new Error('Not signed in');
    const created = await user.createEmailAddress({ email });
    await created.prepareVerification({ strategy: 'email_code' });
    await user.reload?.();
    return created;
  });

  const makePrimaryEmailWithReverify = useReverification(async (emailAddressId: string) => {
    if (!user) throw new Error('Not signed in');
    await user.update({ primaryEmailAddressId: emailAddressId });
    await user.reload?.();
  });

  const destroyEmailWithReverify = useReverification(async (emailAddressId: string) => {
    if (!user) throw new Error('Not signed in');
    const target = user.emailAddresses.find((e) => e.id === emailAddressId);
    if (!target) throw new Error('Email not found');
    await target.destroy();
    await user.reload?.();
  });

  const updatePasswordWithReverify = useReverification(
    async (params: { newPassword: string; currentPassword?: string; signOutOfOtherSessions?: boolean }) => {
      if (!user) throw new Error('Not signed in');
      await user.updatePassword(params);
      await user.reload?.();
    }
  );

  const createExternalAccountWithReverify = useReverification(
    async (strategy: 'oauth_google' | 'oauth_github' | 'oauth_discord' | 'oauth_apple') => {
      if (!user) throw new Error('Not signed in');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://iveo.site';
      const external = await user.createExternalAccount({
        strategy,
        redirectUrl: `${origin}/account#security`,
      });
      const redirectUrl = external?.verification?.externalVerificationRedirectURL;
      if (redirectUrl && typeof window !== 'undefined') {
        window.location.href = redirectUrl.toString();
      }
      return external;
    }
  );

  const destroyExternalWithReverify = useReverification(async (externalId: string) => {
    if (!user) throw new Error('Not signed in');
    const target = user.externalAccounts.find((a) => a.id === externalId);
    if (!target) throw new Error('Provider not found');
    await target.destroy();
    await user.reload?.();
  });

  const createTotpWithReverify = useReverification(async () => {
    if (!user) throw new Error('Not signed in');
    return await user.createTOTP();
  });

  const disableTotpWithReverify = useReverification(async () => {
    if (!user) throw new Error('Not signed in');
    await user.disableTOTP();
    await user.reload?.();
  });

  if (!isLoaded) {
    return (
      <div className="p-5 flex flex-col gap-4" aria-busy="true">
        <div className="h-14 rounded-[12px] bg-surface-2 animate-pulse" />
        <div className="h-14 rounded-[12px] bg-surface-2 animate-pulse" />
        <div className="h-14 rounded-[12px] bg-surface-2 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-5 text-[14px] text-muted">
        Sign in to manage your email addresses, password, passkeys, and devices.
      </div>
    );
  }

  const emails = user.emailAddresses ?? [];
  const signInAccounts = (user.externalAccounts ?? []).filter((acct) => {
    const providerKey = String(acct.provider || '').toLowerCase().replace(/^oauth_/, '');
    // AR-3: Keep each provider in one home if managed in Connected platforms
    return !connectedPageProviders.has(providerKey);
  });
  const connectedStrategies = new Set(
    (user.externalAccounts ?? []).map((a) => `oauth_${String(a.provider || '').replace(/^oauth_/, '')}`)
  );

  // Email handlers
  const openAddEmail = () => {
    setNewEmailInput('');
    setPendingEmailId(null);
    setEmailCodeInput('');
    setEmailStep('enter');
    setEmailError(null);
    setEmailModalOpen(true);
  };

  const openVerifyExistingEmail = async (emailId: string) => {
    setEmailError(null);
    setPendingEmailId(emailId);
    setEmailCodeInput('');
    setEmailStep('verify');
    setEmailModalOpen(true);
    try {
      const target = user.emailAddresses.find((e) => e.id === emailId);
      await target?.prepareVerification({ strategy: 'email_code' });
    } catch (err) {
      setEmailError(extractPlainError(err, "Couldn't send a verification code. Try again."));
    }
  };

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim();
    if (!clean || !clean.includes('@')) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const created = await createEmailWithReverify(clean);
      setPendingEmailId(created.id);
      setEmailStep('verify');
    } catch (err) {
      setEmailError(extractPlainError(err, "Couldn't add that email address. Try another."));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleConfirmEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = emailCodeInput.trim();
    if (!pendingEmailId || code.length < 4) {
      setEmailError('Enter the verification code sent to your email.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      const target = user.emailAddresses.find((em) => em.id === pendingEmailId);
      if (!target) throw new Error('Email address missing');
      await target.attemptVerification({ code });
      await user.reload?.();
      setEmailModalOpen(false);
      showToast('Email address verified');
    } catch (err) {
      setEmailError(extractPlainError(err, "That verification code didn't match. Try again."));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleMakePrimaryEmail = async (emailId: string) => {
    if (offline) return;
    try {
      await makePrimaryEmailWithReverify(emailId);
      showToast('Primary email updated');
    } catch (err) {
      showToast(extractPlainError(err, "Couldn't update primary email."));
    }
  };

  const handleRemoveEmail = async (emailId: string) => {
    if (offline) return;
    try {
      await destroyEmailWithReverify(emailId);
      showToast('Email address removed');
    } catch (err) {
      showToast(extractPlainError(err, "Couldn't remove that email address."));
    }
  };

  // Password handlers
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      setPwError('Use at least 8 characters for your password.');
      return;
    }
    if (user.passwordEnabled && !currentPw) {
      setPwError('Enter your current password.');
      return;
    }
    setPwBusy(true);
    setPwError(null);
    try {
      await updatePasswordWithReverify({
        newPassword: newPw,
        ...(user.passwordEnabled ? { currentPassword: currentPw } : {}),
        signOutOfOtherSessions: signOutOthersPw,
      });
      setPasswordModalOpen(false);
      setCurrentPw('');
      setNewPw('');
      showToast(user.passwordEnabled ? 'Password updated' : 'Password added');
      if (signOutOthersPw) loadSessions();
    } catch (err) {
      setPwError(extractPlainError(err, 'Check your current password and try again.'));
    } finally {
      setPwBusy(false);
    }
  };

  // Two-step verification handlers
  const openTwoFactorModal = async () => {
    setTwoFactorOpen(true);
    setTotpError(null);
    setTotpCode('');
    setTotpBackupCodes(null);
    if (!user.totpEnabled && typeof user.createTOTP === 'function') {
      setTotpBusy(true);
      try {
        const res = await createTotpWithReverify();
        setTotpSecret(res.secret || null);
        setTotpUri(res.uri || null);
      } catch (err: any) {
        const code = String(err?.errors?.[0]?.code || err?.code || '');
        if (/not_enabled|feature_not_enabled/i.test(code)) {
          setTwoFactorSupported(false);
          setTwoFactorOpen(false);
        } else {
          setTotpError(extractPlainError(err, "Couldn't start authenticator setup right now."));
        }
      } finally {
        setTotpBusy(false);
      }
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) {
      setTotpError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setTotpBusy(true);
    setTotpError(null);
    try {
      const verified = await user.verifyTOTP({ code: totpCode.trim() });
      await user.reload?.();
      setTotpBackupCodes(verified?.backupCodes || null);
      if (!verified?.backupCodes?.length) {
        setTwoFactorOpen(false);
      }
      showToast('Two-step verification enabled');
    } catch (err) {
      setTotpError(extractPlainError(err, "That code didn't match. Check your authenticator and try again."));
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisableTotp = async () => {
    setTotpBusy(true);
    setTotpError(null);
    try {
      await disableTotpWithReverify();
      setTwoFactorOpen(false);
      showToast('Two-step verification turned off');
    } catch (err) {
      setTotpError(extractPlainError(err, "Couldn't turn off two-step verification."));
    } finally {
      setTotpBusy(false);
    }
  };

  // Device session handlers
  const otherSessions = sessions.filter((s) => s.id !== activeSession?.id);

  const handleRevokeSession = async (sessId: string) => {
    if (offline) return;
    setRevokingSessionId(sessId);
    try {
      const target = sessions.find((s) => s.id === sessId);
      await target?.revoke();
      await loadSessions();
      showToast('Device signed out');
    } catch {
      showToast("Couldn't sign out that device.");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (offline || otherSessions.length === 0) return;
    setRevokingAllOther(true);
    try {
      await Promise.all(otherSessions.map((s) => s.revoke().catch(() => null)));
      await loadSessions();
      showToast('Signed out of all other devices');
    } catch {
      showToast("Couldn't sign out of other devices.");
    } finally {
      setRevokingAllOther(false);
    }
  };

  return (
    <div className="divide-y divide-divider">
      {/* 1. Email addresses */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-ink">Email addresses</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Used for sign-in, security alerts, and billing receipts.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={openAddEmail}
            disabled={offline}
            className="shrink-0 self-start"
          >
            <Plus size={15} className="mr-1.5" />
            <span>Add email address</span>
          </Button>
        </div>

        <ul className="divide-y divide-divider border-t border-divider pt-1">
          {emails.map((email) => {
            const isPrimary = email.id === user.primaryEmailAddressId;
            const isVerified = email.verification?.status === 'verified';
            const menuItems: Array<{ label: string; onClick: () => void; destructive?: boolean }> = [];
            if (!isVerified) {
              menuItems.push({
                label: 'Verify email',
                onClick: () => openVerifyExistingEmail(email.id),
              });
            }
            if (!isPrimary && isVerified) {
              menuItems.push({
                label: 'Make primary',
                onClick: () => handleMakePrimaryEmail(email.id),
              });
            }
            if (!isPrimary && emails.length > 1) {
              menuItems.push({
                label: 'Remove',
                onClick: () => handleRemoveEmail(email.id),
                destructive: true,
              });
            }

            return (
              <li key={email.id} className="py-3 flex items-center justify-between gap-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {email.emailAddress}
                  </span>
                  {isPrimary && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-ink text-surface">
                      Primary
                    </span>
                  )}
                  {!isVerified && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-[#92400E] border border-amber-200">
                      Needs verification
                    </span>
                  )}
                </div>
                <RowOverflowMenu
                  ariaLabel={`Actions for ${email.emailAddress}`}
                  items={menuItems}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* 2. Password */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink">Password</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {user.passwordEnabled ? 'Set · Used with email sign-in.' : 'Not set · You sign in with email code, passkey or linked provider.'}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={offline}
          onClick={() => {
            setCurrentPw('');
            setNewPw('');
            setPwError(null);
            setSignOutOthersPw(false);
            setPasswordModalOpen(true);
          }}
          className="shrink-0 self-start sm:self-center"
        >
          {user.passwordEnabled ? 'Change password' : 'Add password'}
        </Button>
      </div>

      {/* 3. Passkeys */}
      <div className="p-4 sm:p-5">
        <PasskeysSection offline={offline} />
      </div>

      {/* 4. Sign-in providers */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-ink">Sign-in providers</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Social logins you can use to access your iveo account.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              setProviderError(null);
              setConnectProviderOpen(true);
            }}
            disabled={offline}
            className="shrink-0 self-start"
          >
            <Plus size={15} className="mr-1.5" />
            <span>Connect account</span>
          </Button>
        </div>

        {providerError && (
          <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
            {providerError}
          </p>
        )}

        {signInAccounts.length === 0 ? (
          <p className="text-[13px] text-muted">No sign-in providers connected yet.</p>
        ) : (
          <ul className="divide-y divide-divider border-t border-divider pt-1">
            {signInAccounts.map((acct) => {
              const title = acct.providerTitle?.() || acct.provider;
              const identifier = acct.accountIdentifier?.() || acct.emailAddress || acct.username || '';
              const isVerified = acct.verification?.status === 'verified';
              const needsReauth = acct.verification && acct.verification.status !== 'verified';

              return (
                <li key={acct.id} className="py-3 flex items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-ink">{title}</span>
                      {needsReauth ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-[#92400E] border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#92400E]" />
                          Needs reconnecting
                        </span>
                      ) : isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-[#166534] border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                          Connected
                        </span>
                      ) : null}
                    </div>
                    {identifier && (
                      <p className="text-[12px] text-muted truncate mt-0.5">{identifier}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {needsReauth && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={offline || providerBusyId === acct.id}
                        onClick={async () => {
                          setProviderBusyId(acct.id);
                          try {
                            const origin =
                              typeof window !== 'undefined' ? window.location.origin : 'https://iveo.site';
                            const res = await acct.reauthorize({
                              redirectUrl: `${origin}/account#security`,
                            });
                            const redir = res?.verification?.externalVerificationRedirectURL;
                            if (redir) window.location.href = redir.toString();
                          } catch (err) {
                            setProviderError(
                              extractPlainError(err, `Couldn't reconnect ${title}. Try again.`)
                            );
                          } finally {
                            setProviderBusyId(null);
                          }
                        }}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={offline || providerBusyId === acct.id}
                      aria-label={`Remove ${title}`}
                      className="text-[color:var(--error,#B3261E)] hover:bg-red-50"
                      onClick={async () => {
                        setProviderBusyId(acct.id);
                        try {
                          await destroyExternalWithReverify(acct.id);
                          showToast(`${title} disconnected`);
                        } catch (err) {
                          setProviderError(
                            extractPlainError(err, `Couldn't remove ${title}. Keep at least one sign-in method.`)
                          );
                        } finally {
                          setProviderBusyId(null);
                        }
                      }}
                    >
                      <Trash2 size={14} className="mr-1" />
                      <span>Remove</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 5. Two-step verification (conditional if enabled in product config) */}
      {twoFactorSupported && (
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-ink">Two-step verification</h3>
              {user.twoFactorEnabled || user.totpEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-[#166534] border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                  On
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {user.twoFactorEnabled || user.totpEnabled
                ? 'Authenticator app protection is active on this account.'
                : 'Add an extra verification step with an authenticator app.'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={offline}
            onClick={openTwoFactorModal}
            className="shrink-0 self-start sm:self-center"
          >
            Manage
          </Button>
        </div>
      )}

      {/* 6. Signed-in devices */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-ink">Signed-in devices</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Devices currently signed into your account.
            </p>
          </div>
          {otherSessions.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={revokingAllOther}
              disabled={offline || revokingAllOther}
              onClick={handleRevokeAllOthers}
              className="shrink-0 self-start"
            >
              Sign out of all other devices
            </Button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="h-14 rounded-[12px] bg-surface-2 animate-pulse" aria-busy="true" />
        ) : sessionsError ? (
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
            <span>{sessionsError}</span>
            <Button type="button" variant="ghost" size="sm" onClick={loadSessions}>
              Retry
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[13px] text-muted">Only this browser session is active.</p>
        ) : (
          <ul className="divide-y divide-divider border-t border-divider pt-1">
            {sessions.map((sess) => {
              const isCurrent = sess.id === activeSession?.id;
              const act = sess.latestActivity || {};
              const deviceLabel = [
                act.browserName ? `${act.browserName}${act.browserVersion ? ` ${act.browserVersion.split('.')[0]}` : ''}` : null,
                act.deviceType || (act.isMobile ? 'Mobile device' : 'Computer'),
              ]
                .filter(Boolean)
                .join(' · ');
              const locationLabel = [act.city, act.country].filter(Boolean).join(', ');
              const lastActiveLabel = formatSessionDate(sess.lastActiveAt);

              return (
                <li key={sess.id} className="py-3 flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0 mt-0.5">
                      {act.isMobile ? <Smartphone size={16} /> : <Laptop size={16} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium text-ink truncate">
                          {deviceLabel || 'Web session'}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-ink text-surface">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted mt-0.5 truncate">
                        {locationLabel ? `${locationLabel} · ` : ''}Last active {lastActiveLabel}
                      </p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={offline || revokingSessionId === sess.id}
                      onClick={() => handleRevokeSession(sess.id)}
                      aria-label={`Sign out ${deviceLabel || 'device'}`}
                      className="shrink-0"
                    >
                      {revokingSessionId === sess.id ? 'Signing out...' : 'Sign out'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add / verify email modal */}
      <BottomSheet
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={emailStep === 'enter' ? 'Add email address' : 'Verify email address'}
        subtitle={
          emailStep === 'enter'
            ? 'We will send a one-time code to confirm this address belongs to you.'
            : 'Enter the verification code sent to your inbox.'
        }
        maxWidthClass="sm:max-w-md"
      >
        {emailStep === 'enter' ? (
          <form onSubmit={handleSendEmailCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-add-email" className="text-[13px] font-medium text-ink">
                Email address
              </label>
              <input
                id="account-add-email"
                type="email"
                value={newEmailInput}
                onChange={(e) => {
                  setNewEmailInput(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="you@example.com"
                autoFocus
                className="h-11 px-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink"
              />
            </div>

            {emailError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                {emailError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setEmailModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" loading={emailBusy}>
                Send code
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmEmailCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-email-code" className="text-[13px] font-medium text-ink">
                Verification code
              </label>
              <input
                id="account-email-code"
                type="text"
                inputMode="numeric"
                value={emailCodeInput}
                onChange={(e) => {
                  setEmailCodeInput(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="123456"
                autoFocus
                className="h-11 px-3 rounded-[12px] bg-surface border border-border font-mono text-[15px] text-ink outline-none focus:border-ink"
              />
            </div>

            {emailError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                {emailError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setEmailModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" loading={emailBusy}>
                Verify email
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>

      {/* Password modal */}
      <BottomSheet
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={user.passwordEnabled ? 'Change password' : 'Add password'}
        subtitle="Use at least 8 characters. Keep your password unique to iveo."
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
          {user.passwordEnabled && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-current-pw" className="text-[13px] font-medium text-ink">
                Current password
              </label>
              <input
                id="account-current-pw"
                type="password"
                value={currentPw}
                onChange={(e) => {
                  setCurrentPw(e.target.value);
                  if (pwError) setPwError(null);
                }}
                autoComplete="current-password"
                autoFocus
                className="h-11 px-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-new-pw" className="text-[13px] font-medium text-ink">
              New password
            </label>
            <input
              id="account-new-pw"
              type="password"
              value={newPw}
              onChange={(e) => {
                setNewPw(e.target.value);
                if (pwError) setPwError(null);
              }}
              autoComplete="new-password"
              autoFocus={!user.passwordEnabled}
              className="h-11 px-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink"
            />
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[13px] text-ink">Sign out of all other devices</span>
            <Toggle
              checked={signOutOthersPw}
              onChange={() => setSignOutOthersPw((prev) => !prev)}
              ariaLabel="Sign out of all other devices"
            />
          </div>

          {pwError && (
            <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
              {pwError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pwBusy}>
              Save password
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Connect sign-in provider modal */}
      <BottomSheet
        isOpen={connectProviderOpen}
        onClose={() => setConnectProviderOpen(false)}
        title="Connect sign-in provider"
        subtitle="Choose a provider to add as a sign-in option."
        maxWidthClass="sm:max-w-sm"
      >
        <div className="flex flex-col gap-2">
          {SIGN_IN_PROVIDERS.map((p) => {
            const already = connectedStrategies.has(p.strategy);
            return (
              <button
                key={p.strategy}
                type="button"
                disabled={already || providerBusyId === p.strategy}
                onClick={async () => {
                  setProviderBusyId(p.strategy);
                  setProviderError(null);
                  try {
                    await createExternalAccountWithReverify(p.strategy);
                    setConnectProviderOpen(false);
                  } catch (err) {
                    setProviderError(
                      extractPlainError(err, `${p.label} sign-in is not available right now.`)
                    );
                    setConnectProviderOpen(false);
                  } finally {
                    setProviderBusyId(null);
                  }
                }}
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-border bg-surface hover:bg-surface-2 flex items-center justify-between text-[14px] font-medium text-ink transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{p.label}</span>
                {already ? (
                  <span className="text-[12px] text-muted">Connected</span>
                ) : providerBusyId === p.strategy ? (
                  <Loader2 size={15} className="animate-spin text-muted" />
                ) : (
                  <span className="text-[12px] text-muted">Connect</span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Two-step verification modal */}
      <BottomSheet
        isOpen={twoFactorOpen}
        onClose={() => setTwoFactorOpen(false)}
        title="Two-step verification"
        subtitle={
          user.twoFactorEnabled || user.totpEnabled
            ? 'Authenticator app verification is active.'
            : 'Add this key to your authenticator app, then enter the 6-digit code.'
        }
        maxWidthClass="sm:max-w-md"
      >
        {totpBackupCodes && totpBackupCodes.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 text-[13px] text-[#166534]">
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>Save these one-time backup codes in a safe place. Each can be used once.</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-[12px] border border-border bg-surface font-mono text-[13px] text-ink">
              {totpBackupCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="primary" size="md" onClick={() => setTwoFactorOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : user.twoFactorEnabled || user.totpEnabled ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[14px] text-ink">
              <ShieldCheck size={18} className="text-[#166534]" />
              <span>Two-step verification is active on your account.</span>
            </div>
            {totpError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                {totpError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setTwoFactorOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="md"
                loading={totpBusy}
                onClick={handleDisableTotp}
              >
                Turn off
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerifyTotp} className="flex flex-col gap-4">
            {totpBusy && !totpSecret ? (
              <div className="h-20 rounded-[12px] bg-surface-2 animate-pulse" aria-busy="true" />
            ) : (
              <>
                {totpSecret && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-muted">Setup key</span>
                    <code className="p-3 rounded-[12px] border border-border bg-surface font-mono text-[13px] text-ink break-all select-all">
                      {totpSecret}
                    </code>
                    {totpUri && (
                      <a
                        href={totpUri}
                        className="text-[12px] text-ink underline underline-offset-2 self-start mt-1"
                      >
                        Open in authenticator app
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="account-totp-code" className="text-[13px] font-medium text-ink">
                    6-digit code
                  </label>
                  <input
                    id="account-totp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={totpCode}
                    onChange={(e) => {
                      setTotpCode(e.target.value);
                      if (totpError) setTotpError(null);
                    }}
                    placeholder="123456"
                    autoFocus
                    className="h-11 px-3 rounded-[12px] bg-surface border border-border font-mono text-[15px] text-ink outline-none focus:border-ink"
                  />
                </div>
              </>
            )}

            {totpError && (
              <div className="flex items-start gap-2 text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{totpError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={() => setTwoFactorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" loading={totpBusy} disabled={!totpCode.trim()}>
                Enable two-step
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
};

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  isDemo = false,
  offline = false,
  connectedPageProviders = new Set<string>(),
}) => {
  if (!HAS_CLERK_KEY || isDemo) {
    return (
      <div className="divide-y divide-divider">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Email addresses</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              {isDemo ? 'Preview session — email editing is available on signed-in accounts.' : 'Sign in to manage email addresses.'}
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-ink text-surface">
            Primary
          </span>
        </div>
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Passkeys &amp; password</h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Sign in with Face ID, Touch ID, Windows Hello or a security key.
            </p>
          </div>
          <KeyRound size={18} className="text-muted shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <ClerkSecuritySectionInner
      offline={offline}
      connectedPageProviders={connectedPageProviders}
    />
  );
};

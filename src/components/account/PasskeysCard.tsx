import React, { useState, useMemo } from 'react';
import { useUser, useReverification } from '@clerk/react';
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { HAS_CLERK_KEY } from '../../lib/env';

function formatPasskeyDate(value: Date | string | null | undefined): string {
  if (!value) return 'Never';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function checkIsIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function classifyPasskeyError(
  err: unknown,
  fallback: string,
  inIframe: boolean
): { message: string; needsTopLevelTab: boolean } {
  const anyErr = err as any;
  const code = String(anyErr?.errors?.[0]?.code || anyErr?.code || '');
  const name = String(anyErr?.name || '');
  const msg = String(
    anyErr?.errors?.[0]?.longMessage ||
      anyErr?.errors?.[0]?.message ||
      anyErr?.message ||
      ''
  );
  const combined = `${code} ${name} ${msg}`;

  if (code === 'reverification_cancelled') {
    return {
      message: 'Account verification was cancelled. Verify when prompted to save passkey changes.',
      needsTopLevelTab: false,
    };
  }
  if (
    /publickey-credentials|SecurityError|Permissions-Policy|not enabled in this document|cross-origin/i.test(
      combined
    ) ||
    (inIframe &&
      (code === 'passkey_registration_cancelled' ||
        /NotAllowedError|not allowed/i.test(combined)))
  ) {
    return {
      message:
        'Your browser blocked passkey setup inside this embedded view. Open Account settings in a full browser tab to register your passkey.',
      needsTopLevelTab: true,
    };
  }
  if (
    code === 'passkey_invalid_rpID_or_domain' ||
    /rpId|relying party|domain does not match/i.test(combined)
  ) {
    return {
      message:
        'Passkey setup cannot run on this preview domain. Open Account settings on your primary app domain.',
      needsTopLevelTab: inIframe,
    };
  }
  if (code === 'passkey_already_exists' || /already registered|InvalidStateError/i.test(combined)) {
    return {
      message: 'A passkey for this device or security key is already registered to your account.',
      needsTopLevelTab: false,
    };
  }
  if (
    code === 'passkey_registration_cancelled' ||
    code === 'passkey_operation_aborted' ||
    /AbortError|passkey_registration_cancelled|cancel/i.test(combined)
  ) {
    return {
      message: 'Passkey setup was cancelled before completing biometric or device verification.',
      needsTopLevelTab: false,
    };
  }
  if (/NotAllowedError/i.test(combined)) {
    return {
      message:
        'Passkey prompt was dismissed or timed out. Make sure screen lock / biometrics are enabled on your device and try again.',
      needsTopLevelTab: false,
    };
  }
  if (
    code === 'passkey_not_supported' ||
    code === 'passkey_pa_not_supported' ||
    /not supported/i.test(combined)
  ) {
    return {
      message: 'Passkeys are not supported on this device or browser.',
      needsTopLevelTab: false,
    };
  }
  if (/not enabled|feature_not_enabled|passkeys_not_enabled|passkey_feature_not_enabled/i.test(combined)) {
    return {
      message: 'Passkeys are currently unavailable for this sign-in environment.',
      needsTopLevelTab: false,
    };
  }
  return {
    message: msg || fallback,
    needsTopLevelTab: false,
  };
}

const ClerkPasskeysCardInner: React.FC = () => {
  const { user, isLoaded } = useUser();
  const { showToast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsTopLevelTab, setNeedsTopLevelTab] = useState(false);

  const inIframe = useMemo(() => checkIsIframe(), []);

  const webAuthnSupported =
    typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';

  const passkeys = user?.passkeys ?? [];

  // Wrap Clerk passkey operations with useReverification so session_reverification_required
  // automatically opens Clerk's verification modal and retries cleanly.
  const createPasskeyWithReverify = useReverification(async () => {
    if (!user) throw new Error('Sign in to add a passkey.');
    const created = await user.createPasskey();
    await user.reload?.();
    return created;
  });

  const renamePasskeyWithReverify = useReverification(async (passkeyId: string, name: string) => {
    const target = user?.passkeys?.find((pk) => pk.id === passkeyId);
    if (!target) throw new Error('Passkey not found.');
    const updated = await target.update({ name });
    await user?.reload?.();
    return updated;
  });

  const deletePasskeyWithReverify = useReverification(async (passkeyId: string) => {
    const target = user?.passkeys?.find((pk) => pk.id === passkeyId);
    if (!target) throw new Error('Passkey not found.');
    await target.delete();
    await user?.reload?.();
    return { deleted: true };
  });

  const handleAddPasskey = async () => {
    if (!user || isCreating) return;
    if (!webAuthnSupported) {
      setErrorMsg('Your current browser or device does not support WebAuthn passkeys.');
      return;
    }

    setErrorMsg(null);
    setNeedsTopLevelTab(false);
    setIsCreating(true);
    try {
      await createPasskeyWithReverify();
      showToast('Passkey added to your account');
    } catch (err) {
      const classified = classifyPasskeyError(
        err,
        'Could not register passkey. Please try again.',
        inIframe
      );
      setErrorMsg(classified.message);
      setNeedsTopLevelTab(classified.needsTopLevelTab);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartRename = (id: string, currentName: string | null) => {
    setEditingId(id);
    setRenameValue(currentName || '');
    setErrorMsg(null);
    setNeedsTopLevelTab(false);
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setRenameValue('');
  };

  const handleSaveRename = async (e: React.FormEvent, passkeyId: string) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    setSavingRenameId(passkeyId);
    setErrorMsg(null);
    setNeedsTopLevelTab(false);
    try {
      await renamePasskeyWithReverify(passkeyId, trimmed);
      setEditingId(null);
      setRenameValue('');
      showToast('Passkey renamed');
    } catch (err) {
      const classified = classifyPasskeyError(err, 'Could not rename passkey.', inIframe);
      setErrorMsg(classified.message);
      setNeedsTopLevelTab(classified.needsTopLevelTab);
    } finally {
      setSavingRenameId(null);
    }
  };

  const handleDelete = async (passkeyId: string) => {
    setDeletingId(passkeyId);
    setErrorMsg(null);
    setNeedsTopLevelTab(false);
    try {
      await deletePasskeyWithReverify(passkeyId);
      showToast('Passkey removed');
    } catch (err) {
      const classified = classifyPasskeyError(err, 'Could not remove passkey.', inIframe);
      setErrorMsg(classified.message);
      setNeedsTopLevelTab(classified.needsTopLevelTab);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0 mt-0.5">
            <KeyRound size={18} strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-ink leading-tight">
              Passkeys
            </h2>
            <p className="mt-1 text-[13px] text-muted leading-relaxed">
              Sign in quickly and securely using Face ID, Touch ID, Windows Hello, or a hardware security key. Managed by Clerk.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleAddPasskey}
          loading={isCreating}
          disabled={!isLoaded || !user || !webAuthnSupported || isCreating}
          className="shrink-0 self-start"
        >
          <Plus size={15} className="mr-1.5" />
          <span>Add passkey</span>
        </Button>
      </div>

      {!webAuthnSupported && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-3 rounded-[10px] bg-surface-2 border border-border text-[13px] text-muted"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-ink" />
          <span>Passkeys require a modern browser with WebAuthn support (Chrome, Safari, Edge, or Firefox).</span>
        </div>
      )}

      {inIframe && !errorMsg && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-[10px] bg-surface-2 border border-border text-[12px] text-muted"
        >
          <span>
            If your browser restricts passkey prompts inside an embedded preview, open this page in a full tab.
          </span>
          {typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-ink hover:underline shrink-0"
            >
              <span>Open in full tab</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex flex-col gap-2 p-3 rounded-[10px] bg-red-50 border border-red-200 text-[13px] text-red-700"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          {needsTopLevelTab && typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-red-700 text-white text-[12px] font-semibold hover:bg-red-800 transition-colors ml-6"
            >
              <span>Open in full browser tab</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {!isLoaded ? (
        <div className="h-16 rounded-[10px] bg-surface-2 animate-pulse" aria-hidden="true" />
      ) : passkeys.length === 0 ? (
        <div className="p-4 rounded-[10px] bg-surface-2 border border-border flex items-center gap-3">
          <ShieldCheck size={18} className="text-muted shrink-0" />
          <div className="text-[13px] text-muted">
            No passkeys registered yet. Add a passkey on this device for passwordless one-tap sign-in.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[10px] border border-border bg-surface">
          {passkeys.map((pk) => {
            const isEditing = editingId === pk.id;
            const label = pk.name || 'Passkey';

            return (
              <li key={pk.id} className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(e, pk.id)}
                    className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="e.g. MacBook Touch ID"
                      aria-label="Passkey name"
                      maxLength={64}
                      autoFocus
                      className="flex-1 h-9 px-3 rounded-[8px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={savingRenameId === pk.id}
                        disabled={!renameValue.trim() || savingRenameId === pk.id}
                      >
                        <Check size={14} className="mr-1" />
                        <span>Save</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelRename}
                        disabled={savingRenameId === pk.id}
                      >
                        <X size={14} className="mr-1" />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-ink truncate">
                          {label}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted mt-0.5">
                        Added {formatPasskeyDate(pk.createdAt)} · Last used {formatPasskeyDate(pk.lastUsedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartRename(pk.id, pk.name)}
                        aria-label={`Rename ${label}`}
                        title="Rename passkey"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pk.id)}
                        disabled={deletingId === pk.id}
                        aria-label={`Remove ${label}`}
                        title="Remove passkey"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        <span>{deletingId === pk.id ? 'Removing...' : 'Remove'}</span>
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export const PasskeysCard: React.FC = () => {
  if (!HAS_CLERK_KEY) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0">
            <KeyRound size={18} strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-ink leading-tight">
              Passkeys
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Sign in with biometrics or a hardware security key when signed into a live Clerk session.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return <ClerkPasskeysCardInner />;
};

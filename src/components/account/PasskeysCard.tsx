import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useUser, useReverification } from '@clerk/react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { HAS_CLERK_KEY } from '../../lib/env';

export function formatPasskeyDate(value: Date | string | null | undefined): string {
  if (!value) return 'Never';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function checkIsIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function classifyPasskeyError(
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
      message: 'Verification was cancelled. Confirm when prompted to save passkey changes.',
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
        'Your browser blocked passkey setup inside this embedded view. Open Account in a full browser tab to add a passkey.',
      needsTopLevelTab: true,
    };
  }
  if (
    code === 'passkey_invalid_rpID_or_domain' ||
    /rpId|relying party|domain does not match/i.test(combined)
  ) {
    return {
      message:
        'Passkey setup cannot run on this preview domain. Open Account on your primary app domain.',
      needsTopLevelTab: inIframe,
    };
  }
  if (code === 'passkey_already_exists' || /already registered|InvalidStateError/i.test(combined)) {
    return {
      message: 'A passkey for this device or security key is already added to your account.',
      needsTopLevelTab: false,
    };
  }
  if (
    code === 'passkey_registration_cancelled' ||
    code === 'passkey_operation_aborted' ||
    /AbortError|passkey_registration_cancelled|cancel/i.test(combined)
  ) {
    return {
      message: 'Passkey setup was cancelled before completing verification.',
      needsTopLevelTab: false,
    };
  }
  if (/NotAllowedError/i.test(combined)) {
    return {
      message:
        'Passkey prompt was dismissed or timed out. Make sure screen lock or biometrics are enabled on your device and try again.',
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
      message: 'Passkeys are currently unavailable in this environment.',
      needsTopLevelTab: false,
    };
  }
  return {
    message: fallback,
    needsTopLevelTab: false,
  };
}

interface PasskeyRowMenuProps {
  label: string;
  disabled?: boolean;
  onRename: () => void;
  onRemove: () => void;
}

const PasskeyRowMenu: React.FC<PasskeyRowMenuProps> = ({
  label,
  disabled,
  onRename,
  onRemove,
}) => {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (ref.current && typeof window !== 'undefined') {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 150 && rect.top > 150);
    }
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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        aria-label={`Actions for passkey ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[12px] text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 w-44 rounded-[12px] bg-surface border border-border shadow-[0_12px_32px_rgba(10,10,10,0.12)] py-1.5 z-40 ${
            openUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="w-full min-h-[44px] px-3.5 flex items-center gap-2.5 text-[14px] font-medium text-ink hover:bg-surface-2 text-left cursor-pointer"
          >
            <Pencil size={15} className="text-muted shrink-0" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
            className="w-full min-h-[44px] px-3.5 flex items-center gap-2.5 text-[14px] font-medium text-[color:var(--error,#B3261E)] hover:bg-red-50 text-left cursor-pointer"
          >
            <Trash2 size={15} className="shrink-0" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const PasskeysSection: React.FC<{ offline?: boolean }> = ({ offline = false }) => {
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
    if (!user || isCreating || offline) return;
    if (!webAuthnSupported) {
      setErrorMsg('Your browser or device does not support passkeys.');
      return;
    }

    setErrorMsg(null);
    setNeedsTopLevelTab(false);
    setIsCreating(true);
    try {
      await createPasskeyWithReverify();
      showToast('Passkey added');
    } catch (err) {
      const classified = classifyPasskeyError(
        err,
        'Could not add passkey. Try again.',
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
    if (!trimmed || offline) return;

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
    if (offline) return;
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink leading-snug">
            Passkeys
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Sign in with Face ID, Touch ID, Windows Hello or a security key.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleAddPasskey}
          loading={isCreating}
          disabled={!isLoaded || !user || !webAuthnSupported || isCreating || offline}
          className="shrink-0 self-start"
        >
          <Plus size={15} className="mr-1.5" />
          <span>Add passkey</span>
        </Button>
      </div>

      {!webAuthnSupported && (
        <p className="text-[13px] text-muted">
          Passkeys require a modern browser with WebAuthn support.
        </p>
      )}

      {inIframe && !errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <span>Passkey prompts may require opening this page in a full tab.</span>
          {typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-ink hover:underline shrink-0"
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
          className="flex flex-col gap-2 p-3 rounded-[12px] bg-red-50 border border-red-200 text-[13px] text-[color:var(--error,#B3261E)]"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          {needsTopLevelTab && typeof window !== 'undefined' && (
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[10px] bg-[color:var(--error,#B3261E)] text-white text-[12px] font-medium hover:bg-red-700 transition-colors ml-6"
            >
              <span>Open in full browser tab</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {!isLoaded ? (
        <div className="h-14 rounded-[12px] bg-surface-2 animate-pulse" aria-busy="true" />
      ) : passkeys.length === 0 ? (
        <p className="text-[13px] text-muted">
          No passkeys yet. Add one to sign in with your fingerprint or face.
        </p>
      ) : (
        <ul className="divide-y divide-divider border-t border-divider pt-1">
          {passkeys.map((pk) => {
            const isEditing = editingId === pk.id;
            const label = pk.name || 'Passkey';

            return (
              <li key={pk.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
                      aria-label={`Rename passkey ${label}`}
                      maxLength={64}
                      autoFocus
                      className="flex-1 h-11 px-3 rounded-[12px] bg-surface border border-border text-[14px] text-ink outline-none focus:border-ink"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={savingRenameId === pk.id}
                        disabled={!renameValue.trim() || savingRenameId === pk.id || offline}
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
                    <div className="min-w-0 flex-1">
                      <span className="text-[14px] font-medium text-ink block break-words leading-snug">
                        {label}
                      </span>
                      <p className="text-[12px] text-muted mt-0.5 break-words leading-snug">
                        Added {formatPasskeyDate(pk.createdAt)} · Last used {formatPasskeyDate(pk.lastUsedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <div className="hidden sm:flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartRename(pk.id, pk.name)}
                          aria-label={`Rename passkey ${label}`}
                          disabled={offline}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pk.id)}
                          disabled={deletingId === pk.id || offline}
                          aria-label={`Remove passkey ${label}`}
                          className="text-[color:var(--error,#B3261E)] hover:bg-red-50"
                        >
                          {deletingId === pk.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                      <div className="sm:hidden">
                        <PasskeyRowMenu
                          label={label}
                          disabled={deletingId === pk.id || offline}
                          onRename={() => handleStartRename(pk.id, pk.name)}
                          onRemove={() => handleDelete(pk.id)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const PasskeysCard: React.FC = () => {
  if (!HAS_CLERK_KEY) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-[16px] font-semibold text-ink leading-tight">Passkeys</h2>
        <p className="text-[13px] text-muted">
          Sign in with Face ID, Touch ID, Windows Hello or a security key when signed into a live session.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <PasskeysSection />
    </Card>
  );
};

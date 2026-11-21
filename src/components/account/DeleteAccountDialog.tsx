import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SITE_ORIGIN, SUPPORT_EMAIL } from '../../lib/site';
import { useDeleteAccount } from '../../data/hooks/useDeleteAccount';
import { copy } from '../../content/copy';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  email?: string | null;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  isOpen,
  onClose,
  username,
  email,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const { isDeleting, error, deleteAccount } = useDeleteAccount();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const cleanUsername = (username || '').trim().toLowerCase().replace(/^@/, '');
  const cleanEmail = (email || '').trim().toLowerCase();
  const inputClean = confirmInput.trim().toLowerCase().replace(/^@/, '');

  const isMatch = Boolean(
    inputClean &&
      ((cleanUsername && inputClean === cleanUsername) ||
        (cleanEmail && inputClean === cleanEmail))
  );

  const host = (() => {
    try {
      return new URL(SITE_ORIGIN).host;
    } catch {
      return 'iveo.site';
    }
  })();

  const bodyText = copy.deleteAccount.dialogBody
    .replace('{host}', host)
    .replace('{username}', cleanUsername);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        const inputEl = dialogRef.current?.querySelector<HTMLInputElement>('input');
        inputEl?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
        }
      };
    } else {
      setConfirmInput('');
    }
  }, [isOpen]);

  // Trap focus and handle escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape' && !isDeleting) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href]'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  const handleDelete = async () => {
    if (!isMatch || isDeleting) return;
    await deleteAccount(confirmInput);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] transition-opacity duration-150"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[420px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <h2
          id="delete-account-dialog-title"
          className="text-[20px] font-semibold text-ink leading-tight"
        >
          {copy.deleteAccount.dialogTitle}
        </h2>

        <p className="mt-3 text-[14px] leading-relaxed text-ink/80">
          {bodyText}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <label
            htmlFor="confirm-delete-username"
            className="text-[13px] text-muted font-normal"
          >
            Type <strong className="font-mono text-ink">{cleanUsername}</strong>
            {cleanEmail ? (
              <>
                {' '}
                or <strong className="font-mono text-ink">{cleanEmail}</strong>
              </>
            ) : null}{' '}
            to confirm:
          </label>
          <Input
            id="confirm-delete-username"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isDeleting}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-12"
            placeholder={cleanUsername}
          />

          {error && (
            <div role="alert" className="text-[13px] text-[color:var(--error,#B3261E)] mt-1 leading-normal">
              {error === 'first' ? (
                <span>{copy.deleteAccount.errorFirst}</span>
              ) : (
                <span>
                  {copy.deleteAccount.errorSecondPrefix}{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20assistance`}
                    className="underline hover:text-ink transition-colors"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2.5">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
            className="order-2 sm:order-1"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            disabled={!isMatch}
            loading={isDeleting}
            onClick={handleDelete}
            className="order-1 sm:order-2 bg-[color:var(--error,#B3261E)] hover:bg-red-700 text-white disabled:opacity-40"
          >
            Delete permanently
          </Button>
        </div>
      </div>
    </div>
  );
};

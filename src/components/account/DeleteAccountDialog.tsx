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
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  isOpen,
  onClose,
  username,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const { isDeleting, error, deleteAccount } = useDeleteAccount();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const cleanTarget = (username || '').trim().toLowerCase().replace(/^@/, '');
  const inputClean = confirmInput.trim().toLowerCase().replace(/^@/, '');
  const isMatch = Boolean(cleanTarget) && inputClean === cleanTarget;

  const host = (() => {
    try {
      return new URL(SITE_ORIGIN).host;
    } catch {
      return 'iveo.site';
    }
  })();

  const bodyText = copy.deleteAccount.dialogBody
    .replace('{host}', host)
    .replace('{username}', cleanTarget);

  const confirmLabelText = copy.deleteAccount.confirmLabel.replace(
    '{username}',
    cleanTarget
  );

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

      // Cannot close while deletion is running
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150"
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

        <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
          {bodyText}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <label
            htmlFor="confirm-delete-username"
            className="text-[13px] text-muted font-normal"
          >
            {confirmLabelText}
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
            placeholder={cleanTarget}
          />

          {/* Error Message */}
          {error && (
            <div role="alert" className="text-[13px] text-[#B3261E] mt-1 leading-normal">
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
            {copy.deleteAccount.cancelButton}
          </Button>

          <Button
            variant="secondary"
            size="md"
            disabled={!isMatch || isDeleting}
            onClick={handleDelete}
            className="order-1 sm:order-2 text-[#B3261E] hover:text-[#B3261E] border-border hover:border-[#B3261E]/40"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span>Deleting...</span>
              </span>
            ) : (
              <span>{copy.deleteAccount.deleteButton}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

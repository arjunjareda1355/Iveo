import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { ProLockNotice } from '../plan/ProLockNotice';
import { useSetLinkPassword } from '../../data/hooks/useSetLinkPassword';
import { useClearLinkPassword } from '../../data/hooks/useClearLinkPassword';
import { useToast } from '../ui/Toast';
import { copy } from '../../content/copy';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordSectionProps {
  isPro: boolean;
  linkId: string;
  isProtected: boolean;
  onPasswordSet?: () => void;
  onPasswordRemoved?: () => void;
}

export const PasswordSection: React.FC<PasswordSectionProps> = ({
  isPro,
  linkId,
  isProtected,
  onPasswordSet,
  onPasswordRemoved,
}) => {
  const { setLinkPassword, isLoading: isSetting } = useSetLinkPassword();
  const { clearLinkPassword, isLoading: isClearing } = useClearLinkPassword();
  const { showToast } = useToast();

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Free accounts
  if (!isPro) {
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-ink">
              {copy.password.dashboard.switchLabel}
            </p>
            <p className="text-[13px] text-muted">
              {copy.password.dashboard.switchDesc}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isProtected}
            aria-disabled="true"
            disabled
            className="w-11 h-6 rounded-full bg-border flex items-center p-0.5 cursor-not-allowed opacity-60"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                isProtected ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <ProLockNotice feature="password_links" />

        {isProtected && (
          <div className="p-3 bg-surface-2 border border-border rounded-[10px] flex items-center justify-between gap-3 text-[14px] text-muted">
            <div className="flex items-center gap-2 text-ink">
              <Lock className="w-4 h-4 text-muted" />
              <span>{copy.password.dashboard.passwordSet}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isClearing}
              onClick={async () => {
                try {
                  await clearLinkPassword(linkId);
                  showToast(copy.password.dashboard.toasts.removed);
                  onPasswordRemoved?.();
                } catch {
                  showToast(copy.password.dashboard.toasts.error);
                }
              }}
              className="shrink-0 text-red-600 hover:text-red-700"
            >
              {copy.password.dashboard.removePassword}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const handleToggle = async () => {
    if (isProtected) {
      try {
        await clearLinkPassword(linkId);
        showToast(copy.password.dashboard.toasts.removed);
        setIsComposerOpen(false);
        setPassword('');
        setValidationError(null);
        onPasswordRemoved?.();
      } catch {
        showToast(copy.password.dashboard.toasts.error);
      }
    } else {
      setIsComposerOpen((prev) => !prev);
      setPassword('');
      setValidationError(null);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = password;

    if (raw.length < 4 || raw.length > 64) {
      setValidationError(copy.password.dashboard.errors.invalid);
      return;
    }

    if (raw !== raw.trim()) {
      setValidationError(copy.password.dashboard.errors.invalid);
      return;
    }

    try {
      await setLinkPassword(linkId, raw);
      showToast(copy.password.dashboard.toasts.set);
      setIsComposerOpen(false);
      setPassword('');
      setValidationError(null);
      onPasswordSet?.();
    } catch {
      setValidationError(copy.password.dashboard.errors.generic);
    }
  };

  const handleRemove = async () => {
    try {
      await clearLinkPassword(linkId);
      showToast(copy.password.dashboard.toasts.removed);
      setIsComposerOpen(false);
      setPassword('');
      setValidationError(null);
      onPasswordRemoved?.();
    } catch {
      showToast(copy.password.dashboard.toasts.error);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink">
            {copy.password.dashboard.switchLabel}
          </p>
          <p className="text-[13px] text-muted">
            {copy.password.dashboard.switchDesc}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isProtected || isComposerOpen}
          onClick={handleToggle}
          disabled={isSetting || isClearing}
          className={`w-11 h-6 rounded-full flex items-center p-0.5 transition-colors duration-150 cursor-pointer ${
            isProtected || isComposerOpen ? 'bg-ink' : 'bg-border'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
              isProtected || isComposerOpen ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Protected summary view when not in edit mode */}
      {isProtected && !isComposerOpen && (
        <div className="p-3 bg-surface-2 border border-border rounded-[10px] flex items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="w-4 h-4 text-muted" />
            <span className="font-medium">
              {copy.password.dashboard.passwordSet}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsComposerOpen(true);
                setPassword('');
                setValidationError(null);
              }}
            >
              {copy.password.dashboard.changePassword}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isClearing}
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700"
            >
              {copy.password.dashboard.removePassword}
            </Button>
          </div>
        </div>
      )}

      {/* Inline Password Composer */}
      {isComposerOpen && (
        <form
          onSubmit={handleSavePassword}
          className="p-3.5 bg-surface-2 border border-border rounded-[10px] flex flex-col gap-3 animate-fade-in"
        >
          <div>
            <label
              htmlFor={`pwd-input-${linkId}`}
              className="block text-[13px] font-medium text-ink mb-1"
            >
              {copy.password.dashboard.inputLabel}
            </label>
            <div className="relative">
              <input
                id={`pwd-input-${linkId}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                autoFocus
                placeholder="••••••••"
                className="w-full h-9 px-3 pr-10 text-[14px] bg-surface border border-border rounded-[8px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? copy.password.dashboard.hidePassword
                    : copy.password.dashboard.showPassword
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {copy.password.dashboard.helper}
            </p>
            {validationError && (
              <p className="mt-1 text-[12px] text-red-600 font-medium">
                {validationError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsComposerOpen(false);
                setPassword('');
                setValidationError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSetting || !password}
            >
              {isSetting
                ? 'Saving...'
                : isProtected
                ? copy.password.dashboard.updatePassword
                : copy.password.dashboard.setPassword}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

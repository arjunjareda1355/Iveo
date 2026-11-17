import React, { useState, useEffect, useRef } from 'react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { unlockLink } from '../../data/publicApi';
import { isSafeHref } from '../../lib/urls';
import { Eye, EyeOff, X, Lock, Check } from 'lucide-react';

interface UnlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  block: PageBlock | null;
  vibe: Vibe;
  username?: string | null;
  onSuccess: (block: PageBlock, url: string) => void;
  buttonRadiusOverride?: number;
  fontFamily?: string;
}

export const UnlockDialog: React.FC<UnlockDialogProps> = ({
  isOpen,
  onClose,
  block,
  vibe,
  username,
  onSuccess,
  buttonRadiusOverride,
  fontFamily,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockedUrl, setUnlockedUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state on open/close/block change
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setUnlockedUrl(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, block?.id]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !block) return null;

  const tokens = vibe.tokens;
  const effectiveRadius =
    buttonRadiusOverride !== undefined
      ? buttonRadiusOverride
      : vibe.tokens.buttonRadius;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await unlockLink(block.id, password.trim(), username);
      if (res.ok) {
        if (!isSafeHref(res.url)) {
          setErrorMessage(copy.password.visitor.errors.unavailable);
          setIsSubmitting(false);
          return;
        }
        setUnlockedUrl(res.url);
        onSuccess(block, res.url);
      } else {
        if (res.reason === 'wrong_password') {
          setErrorMessage(copy.password.visitor.errors.wrong);
        } else if (res.reason === 'locked') {
          setErrorMessage(copy.password.visitor.errors.locked);
        } else if (res.reason === 'unavailable') {
          setErrorMessage(copy.password.visitor.errors.unavailable);
        } else {
          setErrorMessage(copy.password.visitor.errors.network);
        }
      }
    } catch {
      setErrorMessage(copy.password.visitor.errors.network);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(10, 10, 10, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full sm:max-w-[420px] rounded-t-[20px] sm:rounded-[20px] p-6 shadow-2xl relative transition-all"
        style={{
          backgroundColor: tokens.bg,
          color: tokens.text,
          fontFamily: fontFamily || vibe.fontFamily,
          border: tokens.buttonBorder
            ? `1px solid ${tokens.buttonBorder}`
            : '1px solid rgba(0,0,0,0.1)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.password.visitor.closeButton}
          className="absolute right-4 top-4 p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: tokens.text }}
        >
          <X className="w-5 h-5" />
        </button>

        {unlockedUrl ? (
          /* Unlocked Success State */
          <div className="flex flex-col items-center text-center py-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: tokens.buttonBg,
                color: tokens.buttonText,
              }}
            >
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h2
              id="unlock-dialog-title"
              className="text-lg font-semibold tracking-tight mb-1"
              style={{ color: tokens.text }}
            >
              {copy.password.visitor.unlockedStatus}
            </h2>

            <p
              className="text-sm opacity-80 mb-6 truncate max-w-full px-2"
              style={{ color: tokens.text }}
            >
              {block.title}
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <a
                href={isSafeHref(unlockedUrl) ? unlockedUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="w-full h-11 px-4 font-medium transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center cursor-pointer shadow-sm"
                style={{
                  backgroundColor: tokens.buttonBg,
                  color: tokens.buttonText,
                  borderRadius: `${Math.min(12, effectiveRadius)}px`,
                  border: tokens.buttonBorder
                    ? `1px solid ${tokens.buttonBorder}`
                    : 'none',
                }}
              >
                {copy.password.visitor.openLinkButton}
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 px-4 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: tokens.text }}
              >
                {copy.password.visitor.closeButton}
              </button>
            </div>
          </div>
        ) : (
          /* Password Form State */
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 opacity-70 shrink-0" />
              <span className="text-xs font-medium uppercase tracking-wider opacity-70">
                {copy.password.visitor.protectedNotice}
              </span>
            </div>

            <h2
              id="unlock-dialog-title"
              className="text-base font-semibold tracking-tight mb-4 truncate"
              style={{ color: tokens.text }}
            >
              {block.title}
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="unlock-password"
                  className="block text-xs font-medium mb-1.5 opacity-80"
                  style={{ color: tokens.text }}
                >
                  {copy.password.visitor.passwordLabel}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="unlock-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                    required
                    className="w-full h-11 px-3.5 pr-10 text-sm bg-transparent rounded-lg transition-colors focus:outline-none"
                    style={{
                      color: tokens.text,
                      border: errorMessage
                        ? '1px solid #ef4444'
                        : tokens.buttonBorder
                        ? `1px solid ${tokens.buttonBorder}`
                        : '1px solid rgba(0,0,0,0.2)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? copy.password.dashboard.hidePassword
                        : copy.password.dashboard.showPassword
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 p-1"
                    style={{ color: tokens.text }}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {errorMessage && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">
                    {errorMessage}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 h-11 px-4 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
                  style={{ color: tokens.text }}
                >
                  {copy.password.visitor.cancelButton}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !password.trim()}
                  className="flex-1 h-11 px-4 font-medium transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-sm text-sm"
                  style={{
                    backgroundColor: tokens.buttonBg,
                    color: tokens.buttonText,
                    borderRadius: `${Math.min(12, effectiveRadius)}px`,
                    border: tokens.buttonBorder
                      ? `1px solid ${tokens.buttonBorder}`
                      : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    copy.password.visitor.unlockButton
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  ariaLabel,
  maxWidthClass = 'sm:max-w-lg',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || 'Dialog'}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-lg)] flex flex-col max-h-[88vh] overflow-hidden',
          maxWidthClass
        )}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        {(title || subtitle) && (
          <div className="px-5 py-3.5 sm:py-4 border-b border-divider flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 className="text-[18px] font-semibold text-ink leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[13px] text-muted mt-0.5 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 -mr-2 -my-1.5 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-divider bg-surface shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { ProBadge } from './ProBadge';
import { Button } from '../ui/Button';
import { ProFeature, getProFeatureName } from '../../lib/plan';

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: ProFeature | null;
}

export const UpgradeDialog: React.FC<UpgradeDialogProps> = ({
  isOpen,
  onClose,
  feature,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      // Focus close or primary button
      const timer = setTimeout(() => {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[420px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="flex items-center gap-2">
          <ProBadge />
          {feature && (
            <span className="text-[14px] text-ink-2 font-medium">
              {getProFeatureName(feature)} is a Pro feature.
            </span>
          )}
        </div>

        <h2
          id="upgrade-dialog-title"
          className="mt-3 text-[22px] font-semibold text-ink leading-tight"
        >
          Pro is coming soon
        </h2>

        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Pro features are not open for purchase yet. Email help@ivio.site to ask about early access.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <Button
            as="a"
            href="mailto:help@ivio.site?subject=ivio%20Pro%20early%20access"
            variant="primary"
            size="md"
            fullWidth
          >
            Email us
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} fullWidth>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

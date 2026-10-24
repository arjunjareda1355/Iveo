import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProBadge } from './ProBadge';
import { SubscriptionVerificationResult } from '../../lib/razorpay';
import { useToast } from '../ui/Toast';

interface PaymentSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: SubscriptionVerificationResult | null;
}

export const PaymentSuccessDialog: React.FC<PaymentSuccessDialogProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

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

  if (!isOpen || !data) return null;

  const formattedDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleCopyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(
        `iveo Pro Subscription\nPayment ID: ${data.paymentId}\nOrder ID: ${data.orderId}\nPeriod: ${data.period}\nExpires: ${formattedDate}`
      );
      showToast('Receipt details copied');
    } catch {}
  };

  const handleGoToAnalytics = () => {
    onClose();
    navigate('/dashboard/analytics');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-success-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[460px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.14)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Animated Checkmark Badge */}
        <div className="w-12 h-12 rounded-full bg-ink text-surface flex items-center justify-center mb-5 shadow-[0_2px_8px_rgba(10,10,10,0.15)]">
          <Check size={24} strokeWidth={2.5} />
        </div>

        <div className="flex items-center gap-2">
          <ProBadge />
          <span className="text-[14px] text-muted font-medium">Payment confirmed</span>
        </div>

        <h2
          id="payment-success-title"
          className="mt-2 text-[24px] font-semibold text-ink leading-tight"
        >
          Welcome to iveo Pro
        </h2>

        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Your payment was processed successfully. All Pro features including link scheduling, rich embeds, advanced analytics, and footer mark removal are unlocked.
        </p>

        {/* Receipt Box */}
        <div className="mt-6 rounded-[12px] bg-surface-2 border border-border p-4 text-[13px] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-muted">Plan</span>
            <span className="font-medium text-ink capitalize">
              Pro ({data.period})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Valid until</span>
            <span className="font-medium text-ink">{formattedDate}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Payment ID</span>
            <span className="font-mono text-[12px] text-ink">{data.paymentId}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Order ID</span>
            <span className="font-mono text-[12px] text-ink">{data.orderId}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button variant="primary" size="lg" onClick={onClose} fullWidth>
            Start using Pro
          </Button>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={handleGoToAnalytics}
              fullWidth
              iconRight={<ArrowRight size={14} />}
            >
              View analytics
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={handleCopyReceipt}
            >
              <Copy size={14} className="mr-1.5 inline-block" />
              <span>Copy receipt</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Check, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { ProBadge } from './ProBadge';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { ProFeature, PRO_PLAN_HIGHLIGHTS, getProFeatureName } from '../../lib/plan';
import {
  PlanPeriod,
  PaymentCurrency,
  startProSubscriptionCheckout,
  SubscriptionVerificationResult,
} from '../../lib/razorpay';
import { useIvioSession } from '../../auth/useIvioSession';
import { copy } from '../../content/copy';

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: ProFeature | null;
  onSuccess: (data: SubscriptionVerificationResult) => void;
}

export const UpgradeDialog: React.FC<UpgradeDialogProps> = ({
  isOpen,
  onClose,
  feature,
  onSuccess,
}) => {
  const session = useIvioSession();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [period, setPeriod] = useState<PlanPeriod>('monthly');
  const [currency, setCurrency] = useState<PaymentCurrency>('INR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      setErrorMessage(null);
      setIsProcessing(false);

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

      if (e.key === 'Escape' && !isProcessing) {
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
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const priceFormatted =
    currency === 'INR'
      ? period === 'yearly'
        ? '₹4,999/yr'
        : '₹499/mo'
      : period === 'yearly'
        ? '$60/yr'
        : '$6/mo';

  const monthlyEquivalent =
    currency === 'INR'
      ? period === 'yearly'
        ? 'approx. ₹416/month'
        : 'billed monthly'
      : period === 'yearly'
        ? 'approx. $5/month'
        : 'billed monthly';

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    await startProSubscriptionCheckout({
      period,
      currency,
      user: {
        userId: session.userId || session.username || undefined,
        username: session.username || undefined,
        displayName: session.displayName || undefined,
        email: session.primaryEmail || undefined,
      },
      onSuccess: (result) => {
        setIsProcessing(false);
        onSuccess(result);
      },
      onError: (msg) => {
        setIsProcessing(false);
        setErrorMessage(msg);
      },
      onDismiss: () => {
        setIsProcessing(false);
      },
    });
  };

  const proFeaturesList = PRO_PLAN_HIGHLIGHTS.filter((item) => item !== 'Everything in Free');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 p-0 sm:p-4"
      onClick={() => {
        if (!isProcessing) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[480px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.15)] max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ProBadge />
            {feature ? (
              <span className="text-[13px] text-ink-2 font-medium">
                {getProFeatureName(feature)} {copy.plan.featureNoticeSuffix}
              </span>
            ) : (
              <span className="text-[13px] text-muted font-medium">
                Membership
              </span>
            )}
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5 text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setCurrency('INR')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                currency === 'INR'
                  ? 'bg-surface text-ink font-semibold shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                currency === 'USD'
                  ? 'bg-surface text-ink font-semibold shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        <h2
          id="upgrade-dialog-title"
          className="mt-3 text-[22px] sm:text-[24px] font-semibold text-ink leading-tight"
        >
          {copy.plan.upgradeHeading}
        </h2>

        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {copy.plan.upgradeSubheading}
        </p>

        {/* Billing Period Selector */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {/* Monthly option */}
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`p-3.5 rounded-[12px] border text-left flex flex-col transition-all cursor-pointer ${
              period === 'monthly'
                ? 'border-ink bg-surface shadow-[0_0_0_1px_#0A0A0A]'
                : 'border-border bg-surface-2 hover:border-border-2'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">
                {copy.plan.monthlyLabel}
              </span>
            </div>
            <span className="text-[18px] font-semibold text-ink mt-1">
              {currency === 'INR' ? '₹499' : '$6'}
            </span>
            <span className="text-[11px] text-muted mt-0.5">per month</span>
          </button>

          {/* Yearly option */}
          <button
            type="button"
            onClick={() => setPeriod('yearly')}
            className={`p-3.5 rounded-[12px] border text-left flex flex-col transition-all cursor-pointer relative ${
              period === 'yearly'
                ? 'border-ink bg-surface shadow-[0_0_0_1px_#0A0A0A]'
                : 'border-border bg-surface-2 hover:border-border-2'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">
                {copy.plan.yearlyLabel}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ink text-surface">
                Save 17%
              </span>
            </div>
            <span className="text-[18px] font-semibold text-ink mt-1">
              {currency === 'INR' ? '₹4,999' : '$60'}
            </span>
            <span className="text-[11px] text-muted mt-0.5">billed annually</span>
          </button>
        </div>

        {/* Feature List */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[12px] font-medium text-muted uppercase tracking-wider mb-2.5">
            What's included in Pro
          </p>
          <ul className="space-y-2 text-[13px] text-ink">
            {proFeaturesList.map((feat, idx) => {
              const isVerifiedRow = feat.toLowerCase().includes('verified pro tick');
              return (
                <li key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0 mt-0.5">
                    {isVerifiedRow ? (
                      <VerifiedTick size={12} />
                    ) : (
                      <Check size={12} strokeWidth={2.5} />
                    )}
                  </div>
                  <span>{feat}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="lg"
            onClick={handleCheckout}
            disabled={isProcessing}
            fullWidth
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Connecting to Razorpay...
              </span>
            ) : (
              `Pay ${priceFormatted} with Razorpay`
            )}
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isProcessing}
            fullWidth
          >
            {copy.plan.closeButton}
          </Button>
        </div>

        {/* Security Assurance */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted text-center">
          <ShieldCheck size={14} className="text-muted shrink-0" />
          <span>{copy.plan.securePaymentNotice}</span>
        </div>
      </div>
    </div>
  );
};

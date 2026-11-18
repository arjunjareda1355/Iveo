import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  FileDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { ProBadge } from './ProBadge';
import { PRO_PLAN_HIGHLIGHTS, SubscriptionRecord } from '../../lib/plan';
import { downloadInvoicePdf } from '../../lib/invoicePdf';

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  subInfo: SubscriptionRecord | null;
  subStatus: 'active' | 'cancelled' | 'expired';
  formattedExpiry: string | null;
  username: string;
  displayName?: string | null;
  primaryEmail?: string | null;
  isUpdatingSub: boolean;
  onCancelSubscription: () => Promise<void>;
  onReactivateSubscription: () => Promise<void>;
  onOpenUpgrade: () => void;
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  isOpen,
  onClose,
  isPro,
  subInfo,
  subStatus,
  formattedExpiry,
  username,
  displayName,
  primaryEmail,
  isUpdatingSub,
  onCancelSubscription,
  onReactivateSubscription,
  onOpenUpgrade,
}) => {
  const [confirmCancel, setConfirmCancel] = useState(false);

  const proHighlights = PRO_PLAN_HIGHLIGHTS.filter(
    (item) => item !== 'Everything in Free'
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setConfirmCancel(false);
        onClose();
      }}
      title={isPro ? 'iveo Pro' : 'iveo free'}
      subtitle={
        isPro
          ? subStatus === 'cancelled' && formattedExpiry
            ? `Cancelled · access until ${formattedExpiry}`
            : formattedExpiry
              ? `Active · valid until ${formattedExpiry}`
              : 'All Pro features are active on your account'
          : 'You are on the Free plan.'
      }
      maxWidthClass="sm:max-w-xl"
    >
      <div className="flex flex-col gap-5">
        {/* Status & Billing Summary */}
        {isPro ? (
          <div className="rounded-[14px] border border-border bg-surface-2/50 divide-y divide-divider text-[13px]">
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-muted">Plan</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">iveo Pro</span>
                <ProBadge />
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-muted">Status</span>
              <span
                className={`font-medium capitalize ${
                  subStatus === 'active'
                    ? 'text-[color:var(--success,#047857)]'
                    : subStatus === 'cancelled'
                      ? 'text-amber-700'
                      : 'text-[color:var(--error,#B3261E)]'
                }`}
              >
                {subStatus}
              </span>
            </div>

            {subInfo?.cycle && (
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-muted">Billing cycle</span>
                <span className="font-medium text-ink capitalize">{subInfo.cycle}</span>
              </div>
            )}

            {formattedExpiry && (
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-muted">
                  {subStatus === 'cancelled' ? 'Access ends' : 'Valid until'}
                </span>
                <span className="font-medium text-ink tabular-nums">{formattedExpiry}</span>
              </div>
            )}

            {subInfo?.paymentId && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-muted shrink-0">Payment ID</span>
                <span className="font-mono text-[12px] text-ink truncate">
                  {subInfo.paymentId}
                </span>
              </div>
            )}

            {subInfo?.orderId && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-muted shrink-0">Order ID</span>
                <span className="font-mono text-[12px] text-ink truncate">
                  {subInfo.orderId}
                </span>
              </div>
            )}

            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-muted">Billing provider</span>
              <span className="font-medium text-ink">Razorpay (256-bit SSL)</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-[14px] border border-border bg-surface-2/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-ink">Upgrade to iveo Pro</p>
              <p className="text-[12px] text-muted mt-0.5">
                Plans start at ₹499/mo or $6/mo. Cancel anytime.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose();
                onOpenUpgrade();
              }}
              className="shrink-0"
            >
              <Sparkles size={15} className="mr-1.5" />
              <span>Upgrade to Pro</span>
            </Button>
          </div>
        )}

        {/* Billing Actions for Pro */}
        {isPro && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => {
                  downloadInvoicePdf({
                    customerName: displayName || username,
                    customerEmail: primaryEmail,
                    username,
                    plan: 'pro',
                    period: subInfo?.cycle === 'yearly' ? 'yearly' : 'monthly',
                    paymentId: subInfo?.paymentId || 'pay_live_verified',
                    orderId: subInfo?.orderId || 'order_iveo_pro',
                    date: subInfo?.startedAt || new Date().toISOString(),
                    expiresAt: subInfo?.currentPeriodEnd || undefined,
                  });
                }}
              >
                <FileDown size={16} className="mr-1.5" />
                <span>Download PDF invoice</span>
              </Button>

              {subInfo?.cycle && subStatus === 'cancelled' && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={onReactivateSubscription}
                  disabled={isUpdatingSub}
                >
                  <RotateCcw size={15} className="mr-1.5" />
                  <span>Reactivate plan</span>
                </Button>
              )}

              {subInfo?.cycle && subStatus === 'active' && !confirmCancel && (
                <Button
                  variant="destructive"
                  size="md"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel subscription
                </Button>
              )}
            </div>

            {confirmCancel && (
              <div className="p-3.5 rounded-[12px] bg-red-50/80 border border-red-200 flex flex-col gap-3">
                <div className="flex items-start gap-2 text-[13px] text-red-900">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Cancel auto-renewal? Your Pro features stay active until{' '}
                    {formattedExpiry || 'the end of your billing period'}.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isUpdatingSub}
                    onClick={() => setConfirmCancel(false)}
                  >
                    Keep plan
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isUpdatingSub}
                    onClick={onCancelSubscription}
                    className="bg-[color:var(--error,#B3261E)] hover:bg-red-700 text-white"
                  >
                    {isUpdatingSub ? 'Cancelling...' : 'Confirm cancel'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pro Benefits Checklist (moved out of Settings body into Plan details modal) */}
        <div className="pt-2 border-t border-divider">
          <h3 className="text-[13px] font-semibold text-ink mb-3">
            Included with iveo Pro
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px] text-ink">
            {proHighlights.map((item) => {
              const isVerifiedRow = item.toLowerCase().includes('verified pro tick');
              return (
                <div key={item} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0 mt-0.5">
                    {isVerifiedRow ? (
                      <VerifiedTick size={12} />
                    ) : (
                      <Check size={11} strokeWidth={2.5} />
                    )}
                  </span>
                  <span className="leading-snug">{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

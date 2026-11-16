import React, { useEffect, useState } from 'react';
import { Sparkles, Check, ChevronRight, FileDown, RotateCcw, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { ProBadge } from './ProBadge';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import { PRO_PLAN_HIGHLIGHTS, SubscriptionRecord } from '../../lib/plan';

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isUpdatingSub, setIsUpdatingSub] = useState(false);
  const [serverSub, setServerSub] = useState<SubscriptionRecord | null>(null);

  const uname = session.username?.toLowerCase() || '';

  useEffect(() => {
    let active = true;
    if (!uname) return;
    fetch(`/api/subscription?username=${encodeURIComponent(uname)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.subscription) {
          setServerSub(data.subscription);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uname]);

  let localSub: any = null;
  if (typeof window !== 'undefined' && uname) {
    try {
      const stored = localStorage.getItem(`iveo_subscription_${uname}`);
      if (stored) {
        localSub = JSON.parse(stored);
      }
    } catch {}
  }

  const subInfo = session.subscription || serverSub || localSub;
  const subStatus: 'active' | 'cancelled' | 'expired' =
    subInfo?.status === 'cancelled'
      ? 'cancelled'
      : subInfo?.status === 'expired'
        ? 'expired'
        : 'active';

  const isPro = session.isPro;
  const proHighlights = PRO_PLAN_HIGHLIGHTS.filter((item) => item !== 'Everything in Free');

  const persistLocalSub = (next: any) => {
    if (!uname || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`iveo_subscription_${uname}`, JSON.stringify(next));
    } catch {}
  };

  const handleCancelSubscription = async () => {
    if (!uname) return;
    setIsUpdatingSub(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not cancel subscription');
      }
      if (data?.subscription) {
        setServerSub(data.subscription);
        persistLocalSub(data.subscription);
      }
      await session.refreshSession?.();
      setConfirmCancel(false);
      showToast('Subscription cancelled. Access continues until the end of your period.');
    } catch (err: any) {
      showToast(err?.message || 'Could not cancel subscription');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!uname) return;
    setIsUpdatingSub(true);
    try {
      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not reactivate subscription');
      }
      if (data?.subscription) {
        setServerSub(data.subscription);
        persistLocalSub(data.subscription);
      }
      await session.refreshSession?.();
      showToast('Subscription reactivated');
    } catch (err: any) {
      showToast(err?.message || 'Could not reactivate subscription');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const formattedExpiry = subInfo?.expiresAt
    ? new Date(subInfo.expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Subscription &amp; Billing
        </h3>
        {isPro && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-medium text-ink whitespace-nowrap shrink-0">
            <VerifiedTick size={14} />
            <span>{subStatus === 'cancelled' ? 'Pro · Cancels at period end' : 'Verified Pro'}</span>
          </div>
        )}
      </div>

      {isPro ? (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-[12px] bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-ink text-surface flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[16px] font-semibold text-ink">
                    iveo Pro Member
                  </span>
                  <ProBadge />
                </div>
                <p className="text-[13px] text-muted mt-0.5 truncate">
                  {subInfo?.period
                    ? subStatus === 'cancelled' && formattedExpiry
                      ? `Billed ${subInfo.period} · Ends ${formattedExpiry}`
                      : `Billed ${subInfo.period}`
                    : 'Verified tick, all 12 vibes, 19 fonts & full Pro tools'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {subInfo?.period && subStatus === 'cancelled' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReactivateSubscription}
                  disabled={isUpdatingSub}
                >
                  <RotateCcw size={13} className="mr-1.5" />
                  <span>Reactivate</span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowReceiptDetails(!showReceiptDetails)}
                iconRight={<ChevronRight size={14} className={showReceiptDetails ? 'rotate-90 transition-transform' : 'transition-transform'} />}
              >
                {showReceiptDetails ? 'Hide details' : 'Manage & details'}
              </Button>
            </div>
          </div>

          {showReceiptDetails && (
            <div className="p-4 rounded-[12px] bg-surface border border-border text-[13px] flex flex-col gap-2.5 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span
                  className={`font-medium capitalize ${
                    subStatus === 'active'
                      ? 'text-emerald-700'
                      : subStatus === 'cancelled'
                        ? 'text-amber-700'
                        : 'text-red-600'
                  }`}
                >
                  {subStatus}
                </span>
              </div>
              {subInfo?.period && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Billing Cycle</span>
                  <span className="font-medium text-ink capitalize">{subInfo.period}</span>
                </div>
              )}
              {formattedExpiry && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">
                    {subStatus === 'cancelled' ? 'Access Ends' : 'Valid Until'}
                  </span>
                  <span className="font-medium text-ink tabular-nums">{formattedExpiry}</span>
                </div>
              )}
              {subInfo?.paymentId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted shrink-0">Payment ID</span>
                  <span className="font-mono text-[12px] text-ink truncate">{subInfo.paymentId}</span>
                </div>
              )}
              {subInfo?.orderId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted shrink-0">Order ID</span>
                  <span className="font-mono text-[12px] text-ink truncate">{subInfo.orderId}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-muted">Provider</span>
                <span className="font-medium text-ink">Razorpay (256-bit SSL)</span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    downloadInvoicePdf({
                      customerName: session.displayName || uname,
                      customerEmail: session.primaryEmail,
                      username: uname,
                      plan: 'pro',
                      period: subInfo?.period === 'yearly' ? 'yearly' : 'monthly',
                      paymentId: subInfo?.paymentId || 'pay_live_verified',
                      orderId: subInfo?.orderId || 'order_iveo_pro',
                      date: subInfo?.subscribedAt || new Date().toISOString(),
                      expiresAt: subInfo?.expiresAt,
                    });
                  }}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <FileDown size={14} />
                    <span>Download PDF Invoice</span>
                  </span>
                </Button>

                {subInfo?.period && subStatus === 'active' && !confirmCancel && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmCancel(true)}
                    className="text-red-600 hover:border-red-300"
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>

              {confirmCancel && (
                <div className="mt-1 p-3 rounded-[10px] bg-red-50/70 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-[12px] text-red-800">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Cancel auto-renewal? Your Pro features stay active until{' '}
                      {formattedExpiry || 'the end of this billing period'}.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isUpdatingSub}
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep plan
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isUpdatingSub}
                      onClick={handleCancelSubscription}
                      className="text-red-700 border-red-300 hover:bg-red-100"
                    >
                      {isUpdatingSub ? 'Cancelling...' : 'Confirm cancel'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-ink pt-1">
            {proHighlights.map((item) => {
              const isVerifiedRow = item.toLowerCase().includes('verified pro tick');
              return (
                <div key={item} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0 mt-0.5">
                    {isVerifiedRow ? (
                      <VerifiedTick size={12} />
                    ) : (
                      <Check size={12} strokeWidth={2.5} />
                    )}
                  </div>
                  <span className="leading-snug">{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-[12px] bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">
                  Free Plan
                </span>
              </div>
              <p className="text-[13px] text-muted mt-0.5">
                1 page, 6 Free vibes, 8 free fonts, 15 showcase blocks &amp; standard analytics.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => openUpgrade()}
            >
              <Sparkles size={15} className="mr-1.5 inline-block" />
              <span>Upgrade to Pro</span>
            </Button>
          </div>

          <p className="text-[13px] text-muted leading-relaxed">
            Upgrade to Pro for your Verified Pro tick, all 12 vibes, 19 fonts, custom photo backdrops, embeds, scheduling, password links, signup forms, and advanced analytics. Plans start at ₹499/mo or $6/mo.
          </p>
        </div>
      )}
    </Card>
  );
};

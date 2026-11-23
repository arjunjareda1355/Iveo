import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Check,
  Copy,
  CreditCard,
  FileDown,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { ProBadge } from './ProBadge';
import {
  BillingHistoryRecord,
  BillingNotification,
  GracePeriodInfo,
  InvoiceRecord,
  PlanSource,
  SubscriptionCycle,
  SubscriptionLifecycleState,
  SubscriptionRecord,
  formatMinorCurrency,
} from '../../lib/plan';

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  planSource: PlanSource;
  lifecycleState: SubscriptionLifecycleState;
  gracePeriod: GracePeriodInfo;
  subInfo: SubscriptionRecord | null;
  formattedExpiry: string | null;
  username: string;
  billingHistory: BillingHistoryRecord[];
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  invoices: InvoiceRecord[];
  notifications: BillingNotification[];
  downloadingInvoiceId: string | null;
  isUpdatingSub: boolean;
  onSwitchCycle: (targetCycle: SubscriptionCycle) => Promise<void>;
  onCancelSubscription: (options?: {
    mode?: 'end_of_period' | 'immediate';
    reason?: string;
  }) => Promise<void>;
  onReactivateSubscription: () => Promise<void>;
  onLoadMoreHistory: () => Promise<void>;
  onDownloadInvoice: (invoice: InvoiceRecord) => Promise<void>;
  onOpenUpgrade: () => void;
}

const STATE_LABELS: Record<SubscriptionLifecycleState, { label: string; tone: string }> = {
  free: {
    label: 'Free',
    tone: 'bg-surface-2 text-muted border-border',
  },
  checkout_pending: {
    label: 'Checkout pending',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  payment_authentication: {
    label: 'Authorizing payment',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  active: {
    label: 'Active',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  renewal: {
    label: 'Renewed · Active',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  scheduled_cancellation: {
    label: 'Cancels at period end',
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  immediate_cancellation: {
    label: 'Cancelled immediately',
    tone: 'bg-red-50 text-red-800 border-red-200',
  },
  expired: {
    label: 'Expired',
    tone: 'bg-red-50 text-red-800 border-red-200',
  },
};

const HISTORY_STATUS_BADGE: Record<
  BillingHistoryRecord['status'],
  { label: string; cls: string }
> = {
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-800 border-red-200' },
  refunded: { label: 'Refunded', cls: 'bg-surface-2 text-ink border-border' },
  partially_refunded: {
    label: 'Partially refunded',
    cls: 'bg-surface-2 text-ink border-border',
  },
};

function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  isOpen,
  onClose,
  isPro,
  planSource,
  lifecycleState,
  gracePeriod,
  subInfo,
  formattedExpiry,
  billingHistory,
  hasMoreHistory,
  isLoadingMoreHistory,
  invoices,
  notifications,
  downloadingInvoiceId,
  isUpdatingSub,
  onSwitchCycle,
  onCancelSubscription,
  onReactivateSubscription,
  onLoadMoreHistory,
  onDownloadInvoice,
  onOpenUpgrade,
}) => {
  const [cancelPanel, setCancelPanel] = useState<'none' | 'scheduled' | 'immediate'>('none');
  const [cancelReason, setCancelReason] = useState('');
  const [ackImmediateNoRefund, setAckImmediateNoRefund] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasPaidContext = Boolean(
    subInfo?.paymentId || subInfo?.orderId || subInfo?.subscriptionId
  );

  const periodProgress = useMemo(() => {
    const startIso = subInfo?.currentPeriodStart || subInfo?.startedAt;
    const endIso = subInfo?.currentPeriodEnd;
    if (!startIso || !endIso) return null;
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    const nowMs = Date.now();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return null;
    }
    const elapsedPct = Math.max(
      0,
      Math.min(100, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100))
    );
    const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / 86_400_000));
    return { elapsedPct, daysRemaining };
  }, [subInfo?.currentPeriodStart, subInfo?.startedAt, subInfo?.currentPeriodEnd]);

  const handleCopyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1500);
    } catch {}
  };

  const resetCancelState = () => {
    setCancelPanel('none');
    setCancelReason('');
    setAckImmediateNoRefund(false);
  };

  const stateMeta = STATE_LABELS[lifecycleState] || STATE_LABELS.free;
  const amountText =
    typeof subInfo?.amountMinor === 'number' && subInfo.amountMinor > 0
      ? formatMinorCurrency(
          subInfo.amountMinor,
          subInfo.currency === 'USD' ? 'USD' : 'INR'
        )
      : typeof subInfo?.amountInr === 'number' && subInfo.amountInr > 0
        ? `₹${subInfo.amountInr.toLocaleString('en-IN')}`
        : null;

  const latestPaidMethod =
    subInfo?.paymentMethodSummary ||
    billingHistory.find((h) => h.status === 'paid' && h.paymentMethodSummary)
      ?.paymentMethodSummary ||
    null;

  const idRows = [
    subInfo?.subscriptionId
      ? { key: 'sub', label: 'Subscription ID', value: subInfo.subscriptionId }
      : null,
    subInfo?.orderId
      ? { key: 'order', label: 'Order ID', value: subInfo.orderId }
      : null,
    subInfo?.paymentId
      ? { key: 'pay', label: 'Payment ID', value: subInfo.paymentId }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;

  const canManagePaidActive =
    isPro &&
    planSource === 'paid' &&
    hasPaidContext &&
    (lifecycleState === 'active' || lifecycleState === 'renewal');

  const canReactivate =
    hasPaidContext &&
    lifecycleState === 'scheduled_cancellation' &&
    (periodProgress === null || periodProgress.daysRemaining > 0);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        resetCancelState();
        onClose();
      }}
      title="Plan & Billing"
      subtitle={
        isPro
          ? lifecycleState === 'scheduled_cancellation' && formattedExpiry
            ? `iveo Pro · cancels on ${formattedExpiry}`
            : formattedExpiry
              ? `iveo Pro · active until ${formattedExpiry}`
              : 'iveo Pro · all features unlocked'
          : 'iveo free · manage your plan & billing records'
      }
      maxWidthClass="sm:max-w-xl"
    >
      <div className="flex flex-col gap-5 text-[13px]">
        {/* 1. Current Plan Overview */}
        <section className="rounded-[14px] border border-border bg-surface-2/50 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[15px] font-semibold text-ink">
                {isPro ? 'iveo Pro' : 'iveo free'}
              </span>
              {isPro && <ProBadge />}
              {planSource === 'early_bird' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface border border-border text-muted">
                  Early Access
                </span>
              )}
              {planSource === 'owner' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface border border-border text-muted">
                  Creator Admin
                </span>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${stateMeta.tone}`}
            >
              {stateMeta.label}
            </span>
          </div>

          {gracePeriod.inGracePeriod && (
            <div className="p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[12px]">
                  3-Day Payment Grace Period Active ({gracePeriod.daysRemaining}{' '}
                  {gracePeriod.daysRemaining === 1 ? 'day' : 'days'} left)
                </p>
                <p className="text-[12px] text-amber-800 mt-0.5">
                  Your last renewal payment needs attention. Complete checkout before{' '}
                  {formatDateShort(gracePeriod.gracePeriodEndsAt)} to avoid interruption.
                </p>
              </div>
            </div>
          )}

          {periodProgress && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[12px] text-muted">
                <span>
                  {lifecycleState === 'scheduled_cancellation'
                    ? `Access ends ${formattedExpiry}`
                    : `Renews ${formattedExpiry}`}
                </span>
                <span className="tabular-nums font-medium text-ink">
                  {periodProgress.daysRemaining}{' '}
                  {periodProgress.daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-300"
                  style={{ width: `${periodProgress.elapsedPct}%` }}
                />
              </div>
            </div>
          )}

          {!periodProgress && (
            <p className="text-[12px] text-muted">
              {isPro
                ? planSource === 'early_bird'
                  ? 'Complimentary Pro access granted for early Iveo creators.'
                  : 'All Pro themes, blocks, analytics, and customization controls are active.'
                : 'Your links, blocks, themes, and profile settings stay safely stored across upgrades or cancellations.'}
            </p>
          )}
        </section>

        {/* 2. Subscription Details */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            Subscription Details
          </h3>
          <div className="rounded-[14px] border border-border bg-surface divide-y divide-divider">
            <div className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-muted">Plan</span>
              <span className="font-medium text-ink">
                {isPro ? 'iveo Pro' : 'iveo free'}
              </span>
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-muted">Billing cycle</span>
              <span className="font-medium text-ink capitalize">
                {subInfo?.cycle || (isPro ? 'Complimentary' : 'None')}
              </span>
            </div>

            {amountText && (
              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-muted">Plan rate</span>
                <span className="font-medium text-ink tabular-nums">
                  {amountText}
                  {subInfo?.cycle === 'yearly' ? ' / year' : subInfo?.cycle === 'monthly' ? ' / month' : ''}
                </span>
              </div>
            )}

            <div className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-muted">Billing provider</span>
              <span className="font-medium text-ink inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-muted" />
                Razorpay (256-bit SSL)
              </span>
            </div>

            {idRows.map((row) => (
              <div
                key={row.key}
                className="px-4 py-2.5 flex items-center justify-between gap-2 min-w-0"
              >
                <span className="text-muted shrink-0">{row.label}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[12px] text-ink truncate max-w-[190px] sm:max-w-[260px]">
                    {row.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(row.key, row.value)}
                    aria-label={`Copy ${row.label}`}
                    className="p-1 rounded-md hover:bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer shrink-0"
                  >
                    {copiedId === row.key ? (
                      <Check size={13} className="text-emerald-700" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Plan Management */}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            Plan Management
          </h3>

          {!isPro || gracePeriod.inGracePeriod ? (
            <div className="p-4 rounded-[14px] border border-border bg-surface-2/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  {gracePeriod.inGracePeriod ? 'Renew Pro Membership' : 'Upgrade to iveo Pro'}
                </p>
                <p className="text-[12px] text-muted mt-0.5">
                  ₹499/mo or ₹4,999/yr ($6/mo or $60/yr). Cancel anytime.
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
                <span>{gracePeriod.inGracePeriod ? 'Complete payment' : 'Upgrade to Pro'}</span>
              </Button>
            </div>
          ) : null}

          {canManagePaidActive && (
            <div className="flex flex-wrap items-center gap-2">
              {subInfo?.cycle && (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isUpdatingSub}
                  onClick={() =>
                    onSwitchCycle(subInfo.cycle === 'yearly' ? 'monthly' : 'yearly')
                  }
                  className="flex-1 min-w-[180px]"
                >
                  <ArrowLeftRight size={14} className="mr-1.5" />
                  <span>
                    {subInfo.cycle === 'yearly'
                      ? 'Switch to Monthly'
                      : 'Switch to Yearly (Save 17%)'}
                  </span>
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                disabled={isUpdatingSub}
                onClick={() => {
                  resetCancelState();
                  setCancelPanel('scheduled');
                }}
              >
                Cancel at period end
              </Button>

              <Button
                variant="destructive"
                size="md"
                disabled={isUpdatingSub}
                onClick={() => {
                  resetCancelState();
                  setCancelPanel('immediate');
                }}
              >
                Cancel immediately
              </Button>
            </div>
          )}

          {canReactivate && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={onReactivateSubscription}
                disabled={isUpdatingSub}
              >
                <RotateCcw size={14} className="mr-1.5" />
                <span>Reactivate auto-renewal</span>
              </Button>
              <Button
                variant="destructive"
                size="md"
                disabled={isUpdatingSub}
                onClick={() => {
                  resetCancelState();
                  setCancelPanel('immediate');
                }}
              >
                End immediately
              </Button>
            </div>
          )}

          {cancelPanel === 'scheduled' && (
            <div className="p-3.5 rounded-[12px] bg-surface-2 border border-border flex flex-col gap-3">
              <div className="flex items-start gap-2 text-[13px] text-ink">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                <span>
                  Turn off auto-renewal? Your Pro features remain active until{' '}
                  {formattedExpiry || 'the end of your billing period'}.
                </span>
              </div>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Optional feedback or cancellation reason..."
                aria-label="Cancellation reason"
                className="w-full h-9 px-3 rounded-lg bg-surface border border-border text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isUpdatingSub}
                  onClick={resetCancelState}
                >
                  Keep plan
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isUpdatingSub}
                  onClick={async () => {
                    await onCancelSubscription({
                      mode: 'end_of_period',
                      reason: cancelReason.trim() || undefined,
                    });
                    resetCancelState();
                  }}
                >
                  {isUpdatingSub ? 'Updating...' : 'Confirm end-of-period cancel'}
                </Button>
              </div>
            </div>
          )}

          {cancelPanel === 'immediate' && (
            <div className="p-3.5 rounded-[12px] bg-red-50/90 border border-red-200 flex flex-col gap-3">
              <div className="flex items-start gap-2 text-[13px] text-red-900">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-700" />
                <div>
                  <p className="font-semibold">Immediate Cancellation · No Refund Issued</p>
                  <p className="text-[12px] mt-0.5 text-red-800">
                    Ending immediately revokes Pro access right now with no partial or prorated refund. Your links, themes, and profile data will remain saved.
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Optional cancellation reason..."
                aria-label="Immediate cancellation reason"
                className="w-full h-9 px-3 rounded-lg bg-white border border-red-200 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-red-700"
              />
              <label className="flex items-start gap-2 text-[12px] text-red-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ackImmediateNoRefund}
                  onChange={(e) => setAckImmediateNoRefund(e.target.checked)}
                  className="mt-0.5 rounded border-red-300"
                />
                <span>
                  I understand my Pro access ends immediately and no refund will be issued.
                </span>
              </label>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isUpdatingSub}
                  onClick={resetCancelState}
                >
                  Keep plan
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isUpdatingSub || !ackImmediateNoRefund}
                  onClick={async () => {
                    await onCancelSubscription({
                      mode: 'immediate',
                      reason: cancelReason.trim() || undefined,
                    });
                    resetCancelState();
                  }}
                  className="bg-[color:var(--error,#B3261E)] hover:bg-red-700 text-white"
                >
                  {isUpdatingSub ? 'Cancelling...' : 'Confirm immediate cancel'}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 4. Billing History */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            Billing History
          </h3>
          {billingHistory.length === 0 ? (
            <div className="p-4 rounded-[12px] border border-border bg-surface-2/40 text-[12px] text-muted">
              No billing transactions yet.
            </div>
          ) : (
            <div className="rounded-[14px] border border-border bg-surface divide-y divide-divider">
              {billingHistory.map((tx) => {
                const badge = HISTORY_STATUS_BADGE[tx.status] || HISTORY_STATUS_BADGE.pending;
                return (
                  <div
                    key={tx.id}
                    className="px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">
                        {tx.description || `iveo Pro (${tx.cycle || 'subscription'})`}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {formatDateShort(tx.date)}
                        {tx.paymentMethodSummary ? ` · ${tx.paymentMethodSummary}` : ''}
                      </p>
                      {tx.failureReason && (
                        <p className="text-[11px] text-red-700 mt-0.5">{tx.failureReason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-semibold text-ink tabular-nums">
                        {tx.amountDisplay}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {hasMoreHistory && (
                <div className="px-4 py-2.5 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadMoreHistory}
                    disabled={isLoadingMoreHistory}
                  >
                    {isLoadingMoreHistory ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. Invoice Management */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Receipt size={13} />
            <span>Invoices</span>
          </h3>
          {invoices.length === 0 ? (
            <div className="p-4 rounded-[12px] border border-border bg-surface-2/40 text-[12px] text-muted">
              No paid invoices available yet. Tax invoices unlock automatically after verified payments.
            </div>
          ) : (
            <div className="rounded-[14px] border border-border bg-surface divide-y divide-divider">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-semibold text-ink truncate">
                      {inv.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Issued {formatDateShort(inv.issuedAt)} ·{' '}
                      {formatMinorCurrency(inv.amountMinor, inv.currency)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={downloadingInvoiceId === inv.id}
                    onClick={() => onDownloadInvoice(inv)}
                  >
                    <FileDown size={14} className="mr-1.5" />
                    <span>
                      {downloadingInvoiceId === inv.id ? 'Preparing...' : 'Download PDF'}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Payment Information */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <CreditCard size={13} />
            <span>Payment Information</span>
          </h3>
          <div className="px-4 py-3 rounded-[14px] border border-border bg-surface flex items-center justify-between gap-2">
            <span className="text-muted">Verified payment method</span>
            <span className="font-medium text-ink">
              {latestPaidMethod || 'No payment method on file'}
            </span>
          </div>
        </section>

        {/* 7. Billing Notifications */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Bell size={13} />
            <span>Billing Notifications</span>
          </h3>
          {notifications.length === 0 ? (
            <div className="p-4 rounded-[12px] border border-border bg-surface-2/40 text-[12px] text-muted">
              No billing notifications yet.
            </div>
          ) : (
            <div className="rounded-[14px] border border-border bg-surface divide-y divide-divider">
              {notifications.slice(0, 6).map((notif) => (
                <div key={notif.id} className="px-4 py-3 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{notif.title}</span>
                    <span className="text-[11px] text-muted shrink-0">
                      {formatDateShort(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted leading-snug">{notif.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </BottomSheet>
  );
};

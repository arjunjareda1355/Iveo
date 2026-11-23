import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PlanDetailsModal } from './PlanDetailsModal';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import {
  BillingHistoryRecord,
  BillingNotification,
  GracePeriodInfo,
  InvoiceRecord,
  PlanSource,
  SubscriptionCycle,
  SubscriptionLifecycleState,
  SubscriptionRecord,
  getGracePeriodInfo,
  normalizeSubscriptionLifecycleState,
} from '../../lib/plan';

export interface BillingSnapshotData {
  plan?: 'free' | 'pro';
  isPro?: boolean;
  planSource?: PlanSource;
  lifecycleState: SubscriptionLifecycleState;
  gracePeriod: GracePeriodInfo;
  subscription: SubscriptionRecord | null;
  billingHistory: BillingHistoryRecord[];
  historyTotal: number;
  hasMoreHistory: boolean;
  invoices: InvoiceRecord[];
  notifications: BillingNotification[];
}

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUpdatingSub, setIsUpdatingSub] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BillingSnapshotData | null>(null);

  const uname = session.username?.toLowerCase() || '';
  const userId = session.userId || '';
  const email = session.primaryEmail || '';

  const buildAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;
    if (email) headers['x-user-email'] = email;
    return headers;
  }, [userId, email]);

  const persistLocalSub = useCallback(
    (next: SubscriptionRecord | null) => {
      if (!uname || typeof localStorage === 'undefined' || !next) return;
      try {
        localStorage.setItem(`iveo_subscription_${uname}`, JSON.stringify(next));
      } catch {}
    },
    [uname]
  );

  const fetchBillingSnapshot = useCallback(async () => {
    if (!uname && !userId && !email) return;
    try {
      const qs = new URLSearchParams();
      if (uname) qs.set('username', uname);
      if (userId) qs.set('userId', userId);
      if (email) qs.set('email', email);
      qs.set('limit', '10');
      qs.set('offset', '0');

      const res = await fetch(`/api/subscription?${qs.toString()}`, {
        cache: 'no-store',
        headers: buildAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data?.ok) return;

      setSnapshot({
        plan: data.plan,
        isPro: Boolean(data.isPro),
        planSource: data.planSource,
        lifecycleState:
          data.lifecycleState ||
          normalizeSubscriptionLifecycleState(data.subscription, Boolean(data.isPro)),
        gracePeriod:
          data.gracePeriod || getGracePeriodInfo(data.subscription),
        subscription: data.subscription || null,
        billingHistory: Array.isArray(data.billingHistory) ? data.billingHistory : [],
        historyTotal: typeof data.historyTotal === 'number' ? data.historyTotal : 0,
        hasMoreHistory: Boolean(data.hasMoreHistory),
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
      });
      if (data.subscription) {
        persistLocalSub(data.subscription);
      }
    } catch {}
  }, [uname, userId, email, buildAuthHeaders, persistLocalSub]);

  useEffect(() => {
    fetchBillingSnapshot();
  }, [fetchBillingSnapshot]);

  useEffect(() => {
    if (isDetailsOpen) {
      fetchBillingSnapshot();
    }
  }, [isDetailsOpen, fetchBillingSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      fetchBillingSnapshot();
      session.refreshSession?.();
    };
    window.addEventListener('iveo_subscription_updated', handler);
    return () => window.removeEventListener('iveo_subscription_updated', handler);
  }, [fetchBillingSnapshot, session]);

  let localSub: SubscriptionRecord | null = null;
  if (typeof window !== 'undefined' && uname) {
    try {
      const stored = localStorage.getItem(`iveo_subscription_${uname}`);
      if (stored) {
        localSub = JSON.parse(stored);
      }
    } catch {}
  }

  const subInfo: SubscriptionRecord | null =
    snapshot?.subscription || session.subscription || localSub;
  const isPro = snapshot?.isPro ?? session.isPro;
  const planSource: PlanSource = snapshot?.planSource ?? session.planSource;
  const lifecycleState: SubscriptionLifecycleState =
    snapshot?.lifecycleState ||
    normalizeSubscriptionLifecycleState(subInfo, isPro);
  const gracePeriod: GracePeriodInfo =
    snapshot?.gracePeriod || getGracePeriodInfo(subInfo);

  const applyMutationResponse = async (data: any) => {
    if (data?.subscription) {
      persistLocalSub(data.subscription);
    }
    setSnapshot((prev) => ({
      plan: data.plan ?? prev?.plan,
      isPro: data.isPro ?? prev?.isPro,
      planSource: data.planSource ?? prev?.planSource,
      lifecycleState:
        data.lifecycleState ||
        normalizeSubscriptionLifecycleState(data.subscription, Boolean(data.isPro)),
      gracePeriod: data.gracePeriod || getGracePeriodInfo(data.subscription),
      subscription: data.subscription ?? prev?.subscription ?? null,
      billingHistory: Array.isArray(data.billingHistory)
        ? data.billingHistory
        : prev?.billingHistory || [],
      historyTotal:
        typeof data.historyTotal === 'number'
          ? data.historyTotal
          : prev?.historyTotal || 0,
      hasMoreHistory:
        typeof data.hasMoreHistory === 'boolean'
          ? data.hasMoreHistory
          : prev?.hasMoreHistory || false,
      invoices: Array.isArray(data.invoices) ? data.invoices : prev?.invoices || [],
      notifications: Array.isArray(data.notifications)
        ? data.notifications
        : prev?.notifications || [],
    }));
    await session.refreshSession?.();
  };

  const handleCancelSubscription = async (options?: {
    mode?: 'end_of_period' | 'immediate';
    reason?: string;
  }) => {
    if (!uname && !userId) return;
    setIsUpdatingSub(true);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          username: uname || undefined,
          userId: userId || undefined,
          email: email || undefined,
          mode: options?.mode === 'immediate' ? 'immediate' : 'end_of_period',
          reason: options?.reason || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not cancel subscription');
      }
      await applyMutationResponse(data);
      showToast(
        options?.mode === 'immediate'
          ? 'Subscription cancelled immediately'
          : 'Auto-renewal cancelled'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not cancel subscription');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!uname && !userId) return;
    setIsUpdatingSub(true);
    try {
      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          username: uname || undefined,
          userId: userId || undefined,
          email: email || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not reactivate subscription');
      }
      await applyMutationResponse(data);
      showToast('Subscription reactivated');
    } catch (err: any) {
      showToast(err?.message || 'Could not reactivate subscription');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const handleSwitchCycle = async (targetCycle: SubscriptionCycle) => {
    if (!uname && !userId) return;
    setIsUpdatingSub(true);
    try {
      const res = await fetch('/api/subscription/switch-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          username: uname || undefined,
          userId: userId || undefined,
          email: email || undefined,
          cycle: targetCycle,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not update billing cycle');
      }
      await applyMutationResponse(data);
      showToast(`Billing cycle switched to ${targetCycle}`);
    } catch (err: any) {
      showToast(err?.message || 'Could not switch billing cycle');
    } finally {
      setIsUpdatingSub(false);
    }
  };

  const handleLoadMoreHistory = async () => {
    if (!uname && !userId && !email) return;
    setIsLoadingMoreHistory(true);
    try {
      const currentLen = snapshot?.billingHistory.length || 0;
      const qs = new URLSearchParams();
      if (uname) qs.set('username', uname);
      if (userId) qs.set('userId', userId);
      if (email) qs.set('email', email);
      qs.set('limit', '10');
      qs.set('offset', String(currentLen));

      const res = await fetch(`/api/subscription/history?${qs.toString()}`, {
        cache: 'no-store',
        headers: buildAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Could not load more history');
      }
      const nextRows: BillingHistoryRecord[] = Array.isArray(data.billingHistory)
        ? data.billingHistory
        : [];
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              billingHistory: [
                ...prev.billingHistory,
                ...nextRows.filter(
                  (r) => !prev.billingHistory.some((existing) => existing.id === r.id)
                ),
              ],
              historyTotal:
                typeof data.historyTotal === 'number'
                  ? data.historyTotal
                  : prev.historyTotal,
              hasMoreHistory: Boolean(data.hasMoreHistory),
            }
          : prev
      );
    } catch (err: any) {
      showToast(err?.message || 'Unable to load older transactions');
    } finally {
      setIsLoadingMoreHistory(false);
    }
  };

  const handleDownloadInvoice = async (invoice: InvoiceRecord) => {
    setDownloadingInvoiceId(invoice.id);
    try {
      const qs = new URLSearchParams({ invoiceId: invoice.id });
      if (uname) qs.set('username', uname);
      if (userId) qs.set('userId', userId);
      if (email) qs.set('email', email);

      const res = await fetch(`/api/subscription/invoice?${qs.toString()}`, {
        cache: 'no-store',
        headers: buildAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.invoice) {
        throw new Error(data?.message || 'Invoice unavailable for this transaction.');
      }

      const verified: InvoiceRecord = data.invoice;
      downloadInvoicePdf({
        invoiceNumber: verified.invoiceNumber,
        customerName: verified.customerName || session.displayName || uname,
        customerEmail: verified.customerEmail || email,
        username: verified.username || uname,
        plan: 'pro',
        period: verified.cycle,
        amount: verified.amountMinor / 100,
        currency: verified.currency,
        paymentId: verified.paymentId,
        orderId: verified.orderId,
        date: verified.issuedAt,
        expiresAt: verified.periodEnd,
        status: verified.status,
        paymentMethodSummary: verified.paymentMethodSummary,
      });
    } catch (err: any) {
      showToast(err?.message || 'Unable to download invoice');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const formattedExpiry = subInfo?.currentPeriodEnd
    ? new Date(subInfo.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const statusLine = isPro
    ? gracePeriod.inGracePeriod
      ? `Payment attention needed · ${gracePeriod.daysRemaining}d grace remaining`
      : lifecycleState === 'scheduled_cancellation' && formattedExpiry
        ? `Cancels at period end · ${formattedExpiry}`
        : formattedExpiry
          ? `Active · renews on ${formattedExpiry}`
          : subInfo?.cycle
            ? `Active · billed ${subInfo.cycle}`
            : 'Active · all Pro features enabled'
    : lifecycleState === 'checkout_pending'
      ? 'Checkout initiated · awaiting confirmation'
      : lifecycleState === 'payment_authentication'
        ? 'Payment authorizing · awaiting capture'
        : lifecycleState === 'expired'
          ? 'Subscription expired · on Free plan'
          : lifecycleState === 'immediate_cancellation'
            ? 'Cancelled immediately · on Free plan'
            : '1 page, 6 vibes, 8 fonts & standard analytics';

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                isPro
                  ? 'bg-ink text-surface'
                  : 'bg-surface-2 border border-border text-ink'
              }`}
            >
              <Sparkles size={18} strokeWidth={1.75} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-ink leading-tight whitespace-nowrap">
                  {isPro ? 'iveo Pro' : 'iveo free'}
                </h3>
                {gracePeriod.inGracePeriod && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    Grace period
                  </span>
                )}
              </div>
              <p className="text-[13px] text-muted mt-0.5 truncate">
                {statusLine}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isPro && (
              <Button
                variant="primary"
                size="md"
                onClick={() => openUpgrade()}
                className="flex-1 sm:flex-initial"
              >
                Upgrade to Pro
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsDetailsOpen(true)}
              className="w-full sm:w-auto"
            >
              Manage plan
            </Button>
          </div>
        </div>
      </Card>

      <PlanDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        isPro={isPro}
        planSource={planSource}
        lifecycleState={lifecycleState}
        gracePeriod={gracePeriod}
        subInfo={subInfo}
        formattedExpiry={formattedExpiry}
        username={uname}
        billingHistory={snapshot?.billingHistory || []}
        hasMoreHistory={Boolean(snapshot?.hasMoreHistory)}
        isLoadingMoreHistory={isLoadingMoreHistory}
        invoices={snapshot?.invoices || []}
        notifications={snapshot?.notifications || []}
        downloadingInvoiceId={downloadingInvoiceId}
        isUpdatingSub={isUpdatingSub}
        onSwitchCycle={handleSwitchCycle}
        onCancelSubscription={handleCancelSubscription}
        onReactivateSubscription={handleReactivateSubscription}
        onLoadMoreHistory={handleLoadMoreHistory}
        onDownloadInvoice={handleDownloadInvoice}
        onOpenUpgrade={() => openUpgrade()}
      />
    </>
  );
};

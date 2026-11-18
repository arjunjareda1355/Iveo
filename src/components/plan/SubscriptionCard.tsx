import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from './ProBadge';
import { PlanDetailsModal } from './PlanDetailsModal';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { SubscriptionRecord } from '../../lib/plan';

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
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

  let localSub: SubscriptionRecord | null = null;
  if (typeof window !== 'undefined' && uname) {
    try {
      const stored = localStorage.getItem(`iveo_subscription_${uname}`);
      if (stored) {
        localSub = JSON.parse(stored);
      }
    } catch {}
  }

  const subInfo: SubscriptionRecord | null = session.subscription || serverSub || localSub;
  const subStatus: 'active' | 'cancelled' | 'expired' =
    subInfo?.status === 'cancelled'
      ? 'cancelled'
      : subInfo?.status === 'expired'
        ? 'expired'
        : 'active';

  const isPro = session.isPro;

  const persistLocalSub = (next: SubscriptionRecord) => {
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
      showToast('Subscription cancelled');
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

  const formattedExpiry = subInfo?.currentPeriodEnd
    ? new Date(subInfo.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const statusLine = isPro
    ? subStatus === 'cancelled' && formattedExpiry
      ? `Cancels at period end · ${formattedExpiry}`
      : formattedExpiry
        ? `Active · renews on ${formattedExpiry}`
        : subInfo?.cycle
          ? `Active · billed ${subInfo.cycle}`
          : 'Active · all Pro features enabled'
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
                {isPro && <ProBadge />}
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
        subInfo={subInfo}
        subStatus={subStatus}
        formattedExpiry={formattedExpiry}
        username={uname}
        displayName={session.displayName}
        primaryEmail={session.primaryEmail}
        isUpdatingSub={isUpdatingSub}
        onCancelSubscription={handleCancelSubscription}
        onReactivateSubscription={handleReactivateSubscription}
        onOpenUpgrade={() => openUpgrade()}
      />
    </>
  );
};

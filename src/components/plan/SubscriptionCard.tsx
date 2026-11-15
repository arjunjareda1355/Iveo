import React, { useState } from 'react';
import { Sparkles, Check, ChevronRight, FileDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { ProBadge } from './ProBadge';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import { PRO_PLAN_HIGHLIGHTS } from '../../lib/plan';

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);

  const uname = session.username?.toLowerCase() || '';
  let subInfo: any = null;
  if (typeof window !== 'undefined' && uname) {
    try {
      const stored = localStorage.getItem(`iveo_subscription_${uname}`);
      if (stored) {
        subInfo = JSON.parse(stored);
      }
    } catch {}
  }

  const isPro = session.isPro;
  const proHighlights = PRO_PLAN_HIGHLIGHTS.filter((item) => item !== 'Everything in Free');

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Subscription &amp; Billing
        </h3>
        {isPro && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-medium text-ink whitespace-nowrap shrink-0">
            <VerifiedTick size={14} />
            <span>Verified Pro</span>
          </div>
        )}
      </div>

      {isPro ? (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-[12px] bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ink text-surface flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-semibold text-ink">
                    iveo Pro Member
                  </span>
                  <ProBadge />
                </div>
                <p className="text-[13px] text-muted mt-0.5">
                  {subInfo?.period
                    ? `Billed ${subInfo.period}`
                    : 'Verified tick, all 12 vibes, 19 fonts & full Pro tools'}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowReceiptDetails(!showReceiptDetails)}
              iconRight={<ChevronRight size={14} className={showReceiptDetails ? 'rotate-90' : ''} />}
            >
              {showReceiptDetails ? 'Hide details' : 'Receipt details'}
            </Button>
          </div>

          {showReceiptDetails && (
            <div className="p-4 rounded-[12px] bg-surface border border-border text-[13px] flex flex-col gap-2.5 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span className="font-medium text-emerald-700">Active</span>
              </div>
              {subInfo?.period && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Billing Cycle</span>
                  <span className="font-medium text-ink capitalize">{subInfo.period}</span>
                </div>
              )}
              {subInfo?.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Valid Until</span>
                  <span className="font-medium text-ink tabular-nums">
                    {new Date(subInfo.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {subInfo?.paymentId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Payment ID</span>
                  <span className="font-mono text-[12px] text-ink">{subInfo.paymentId}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-muted">Provider</span>
                <span className="font-medium text-ink">Razorpay (256-bit SSL)</span>
              </div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
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
              </div>
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

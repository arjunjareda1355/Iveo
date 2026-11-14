import React, { useState } from 'react';
import { Sparkles, Check, Minus, ChevronRight, ChevronDown, FileDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { ProBadge } from './ProBadge';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import { PLAN_COMPARISON_SECTIONS, PRO_PLAN_HIGHLIGHTS } from '../../lib/plan';

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-medium text-ink">
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

      {/* Expandable Free vs. Pro Feature Breakdown */}
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setShowComparison((prev) => !prev)}
          aria-expanded={showComparison}
          className="w-full flex items-center justify-between py-1.5 text-[13px] font-medium text-ink hover:text-ink-2 transition-colors cursor-pointer"
        >
          <span>Compare Free vs. Pro features</span>
          <ChevronDown
            size={15}
            className={`text-muted transition-transform duration-150 ${
              showComparison ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showComparison && (
          <div className="mt-3 rounded-[10px] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="bg-surface-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th className="py-2 px-3">Feature</th>
                    <th className="py-2 px-3 text-center">Free</th>
                    <th className="py-2 px-3 text-center text-ink">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARISON_SECTIONS.map((section) => (
                    <React.Fragment key={section.category}>
                      <tr className="bg-surface-2/50 border-b border-border">
                        <th
                          colSpan={3}
                          className="py-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted"
                        >
                          {section.category}
                        </th>
                      </tr>
                      {section.rows.map((row) => {
                        const renderVal = (val: string | boolean, isProCol: boolean) => {
                          if (val === true) {
                            return <Check size={13} strokeWidth={2.5} className="inline text-ink" />;
                          }
                          if (val === false) {
                            return <Minus size={13} strokeWidth={2} className="inline text-subtle" />;
                          }
                          if (isProCol && row.feature.toLowerCase().includes('verified pro tick')) {
                            return (
                              <span className="inline-flex items-center justify-center gap-1 font-medium text-ink">
                                <VerifiedTick size={12} />
                                <span>{val}</span>
                              </span>
                            );
                          }
                          return (
                            <span className={isProCol ? 'font-medium text-ink' : 'text-muted'}>
                              {val}
                            </span>
                          );
                        };

                        return (
                          <tr
                            key={row.feature}
                            className="border-b border-border/60 last:border-b-0"
                          >
                            <td className="py-2 px-3 text-ink">{row.feature}</td>
                            <td className="py-2 px-3 text-center">{renderVal(row.free, false)}</td>
                            <td className="py-2 px-3 text-center">{renderVal(row.pro, true)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

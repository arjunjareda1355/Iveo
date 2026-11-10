import { Sparkles, Check, Receipt, ChevronRight, FileDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from './ProBadge';
import { useUpgradeDialog } from './UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';
import { downloadInvoicePdf } from '../../lib/invoicePdf';

export const SubscriptionCard: React.FC = () => {
  const session = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);

  // Check stored subscription info if available
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

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Subscription & Billing
        </h3>
        {isPro && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-medium text-ink">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active</span>
          </div>
        )}
      </div>

      {isPro ? (
        // Pro State
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
                    : 'Full access to all Pro features'}
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

          {/* Receipt and subscription metadata */}
          {showReceiptDetails && (
            <div className="p-4 rounded-[12px] bg-surface border border-border text-[13px] flex flex-col gap-2.5 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span className="font-medium text-emerald-600">Active</span>
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
                  <span className="font-medium text-ink">
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
                  iconLeft={<FileDown size={14} />}
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
                  Download PDF Invoice
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-ink pt-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0">
                <Check size={12} strokeWidth={2.5} />
              </div>
              <span>Link scheduling & expiration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0">
                <Check size={12} strokeWidth={2.5} />
              </div>
              <span>YouTube & Spotify embeds</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0">
                <Check size={12} strokeWidth={2.5} />
              </div>
              <span>Sources & Devices breakdown</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-ink/5 text-ink flex items-center justify-center shrink-0">
                <Check size={12} strokeWidth={2.5} />
              </div>
              <span>Remove iveo mark anytime</span>
            </div>
          </div>
        </div>
      ) : (
        // Free State
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-[12px] bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">
                  Free Plan
                </span>
              </div>
              <p className="text-[13px] text-muted mt-0.5">
                1 page, unlimited basic links, all 6 vibes, and standard analytics.
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
            Upgrade to Pro to unlock YouTube/Spotify embeds, link scheduling, audience source analytics, and remove the iveo footer mark. Plans start at ₹499/mo or $6/mo.
          </p>
        </div>
      )}
    </Card>
  );
};

import React, { useEffect } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import { Flag, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface ReportPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
}

const REPORT_REASONS = [
  'Spam or misleading links',
  'Impersonation or fake account',
  'Phishing, scam, or malware',
  'Harassment or hate speech',
  'Copyright or trademark infringement',
  'Other policy violation',
];

export const ReportPageModal: React.FC<ReportPageModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
}) => {
  const [state, handleSubmit, reset] = useForm('xaeooqpj');
  const cleanHandle = (username || '').replace(/^@+/, '').toLowerCase().trim();
  const pageLink = cleanHandle ? `https://iveo.site/@${cleanHandle}` : 'https://iveo.site';

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (state.succeeded) {
      reset();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-page-dialog-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[440px] bg-surface border-t sm:border border-border rounded-t-[24px] sm:rounded-[20px] p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-border mx-auto -mt-1 mb-3" />

        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Flag size={16} strokeWidth={2} />
            </div>
            <div>
              <h2
                id="report-page-dialog-title"
                className="text-[17px] font-semibold text-ink leading-tight"
              >
                Report this page
              </h2>
              <p className="text-[12px] font-mono text-muted mt-0.5">
                iveo.site/@{cleanHandle || 'profile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close report dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {state.succeeded ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-ink">Report submitted</h3>
              <p className="text-[13px] text-muted mt-1 leading-relaxed max-w-[34ch]">
                Thank you for helping keep Iveo safe. Our Trust &amp; Safety team will review{' '}
                <span className="font-mono text-ink">@{cleanHandle}</span>.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={handleClose} className="mt-2 min-w-[140px]">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
            <input type="hidden" name="reportedHandle" value={`@${cleanHandle}`} />
            <input type="hidden" name="reportedPage" value={pageLink} />
            <input
              type="hidden"
              name="reportedDisplayName"
              value={displayName || cleanHandle}
            />

            <div className="p-2.5 rounded-xl bg-surface-2 border border-border/80 flex items-center gap-2 text-[12px] text-muted">
              <ShieldAlert size={15} className="shrink-0 text-amber-600" />
              <span>
                Reporting <strong className="text-ink font-mono">@{cleanHandle}</strong> for review.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-reason" className="text-[13px] font-medium text-ink">
                Reason
              </label>
              <select
                id="report-reason"
                name="reason"
                required
                defaultValue={REPORT_REASONS[0]}
                className="h-10 px-3 rounded-[10px] border border-border bg-surface text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-email" className="text-[13px] font-medium text-ink">
                Your Email
              </label>
              <input
                id="report-email"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="h-10 px-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink"
              />
              <ValidationError
                prefix="Email"
                field="email"
                errors={state.errors}
                className="text-[12px] text-error"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-message" className="text-[13px] font-medium text-ink">
                Details
              </label>
              <textarea
                id="report-message"
                name="message"
                required
                rows={3}
                placeholder="Describe the issue or link on this page..."
                className="p-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink placeholder:text-muted resize-y min-h-[88px] focus-visible:outline-2 focus-visible:outline-ink"
              />
              <ValidationError
                prefix="Message"
                field="message"
                errors={state.errors}
                className="text-[12px] text-error"
              />
            </div>

            <ValidationError errors={state.errors} className="text-[12px] text-error" />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
              <Button type="button" variant="ghost" size="md" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={state.submitting}
              >
                {state.submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

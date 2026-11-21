import React, { useEffect } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import { Flag, X, CheckCircle2 } from 'lucide-react';
import type { Vibe } from '../../lib/vibes';
import { isLightHexColor } from '../../lib/colors';

interface ReportPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
  vibe?: Vibe;
}

const REPORT_REASONS = [
  'Spam or misleading links',
  'Impersonation or fake account',
  'Phishing, scam, or malware',
  'Harassment or hate speech',
  'Copyright or trademark infringement',
  'Other policy violation',
];

function resolveThemeBorder(vibe?: Vibe): string {
  const tokens = vibe?.tokens;
  if (!tokens) return '#0A0A0A';
  const candidate = tokens.buttonBorder || tokens.buttonBg;
  if (candidate && candidate !== 'transparent') {
    const trimmed = candidate.trim();
    if (trimmed.startsWith('#') && isLightHexColor(trimmed)) {
      return isLightHexColor(tokens.text) ? '#171717' : tokens.text;
    }
    if (/^rgba?\(/i.test(trimmed)) {
      return isLightHexColor(tokens.text) ? 'rgba(10,10,10,0.28)' : tokens.text;
    }
    return trimmed;
  }
  return isLightHexColor(tokens.text) ? '#171717' : tokens.text;
}

function resolveThemeAccentFill(vibe?: Vibe): { bg: string; fg: string } {
  const tokens = vibe?.tokens;
  if (!tokens) return { bg: '#0A0A0A', fg: '#FFFFFF' };
  const rawBg = tokens.buttonBg && tokens.buttonBg !== 'transparent' ? tokens.buttonBg : tokens.text;
  if (rawBg.startsWith('#') && isLightHexColor(rawBg)) {
    const darkInk = isLightHexColor(tokens.text) ? '#0A0A0A' : tokens.text;
    return { bg: darkInk, fg: '#FFFFFF' };
  }
  return { bg: rawBg, fg: tokens.buttonText || '#FFFFFF' };
}

export const ReportPageModal: React.FC<ReportPageModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  vibe,
}) => {
  const [state, handleSubmit, reset] = useForm('xaeooqpj');
  const cleanHandle = (username || '').replace(/^@+/, '').toLowerCase().trim();
  const pageLink = cleanHandle ? `https://iveo.site/@${cleanHandle}` : 'https://iveo.site';

  const themeBorder = resolveThemeBorder(vibe);
  const accentFill = resolveThemeAccentFill(vibe);
  const rawRadius = vibe?.tokens?.buttonRadius;
  const controlRadius =
    rawRadius === undefined
      ? 12
      : rawRadius >= 999
        ? 999
        : Math.max(4, Math.min(16, rawRadius));

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: themeBorder }}
        className="w-full sm:max-w-[420px] bg-white text-[#0A0A0A] border-t sm:border rounded-t-[24px] sm:rounded-[22px] p-5 sm:p-6 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.28)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-black/15 mx-auto -mt-1 mb-3" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                border: `1.5px solid ${themeBorder}`,
                color: '#0A0A0A',
              }}
            >
              <Flag size={14} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2
                id="report-page-dialog-title"
                className="text-[16px] font-semibold tracking-tight text-[#0A0A0A] leading-tight truncate"
              >
                Report @{cleanHandle || 'profile'}
              </h2>
              <p className="text-[11px] font-mono text-[#6B6B6B] truncate">
                iveo.site/@{cleanHandle || 'profile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close report dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-black/5 transition-colors cursor-pointer shrink-0"
          >
            <X size={17} />
          </button>
        </div>

        {state.succeeded ? (
          <div className="py-7 flex flex-col items-center text-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                border: `1.5px solid ${themeBorder}`,
                color: '#16A34A',
                backgroundColor: '#F0FDF4',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#0A0A0A]">Report received</h3>
              <p className="text-[13px] text-[#6B6B6B] mt-1 leading-relaxed max-w-[32ch]">
                Thanks for flagging <span className="font-mono text-[#0A0A0A]">@{cleanHandle}</span>. Our team will review it shortly.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 h-10 px-6 text-[13px] font-semibold transition-transform active:scale-[0.98] cursor-pointer"
              style={{
                backgroundColor: accentFill.bg,
                color: accentFill.fg,
                border: `1.5px solid ${themeBorder}`,
                borderRadius: `${controlRadius}px`,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
            <input type="hidden" name="reportedHandle" value={`@${cleanHandle}`} />
            <input type="hidden" name="reportedPage" value={pageLink} />
            <input
              type="hidden"
              name="reportedDisplayName"
              value={displayName || cleanHandle}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-reason" className="text-[12px] font-medium text-[#3F3F46]">
                Reason
              </label>
              <select
                id="report-reason"
                name="reason"
                required
                defaultValue={REPORT_REASONS[0]}
                className="h-10 px-3 rounded-[11px] border border-black/15 bg-[#FAFAFA] text-[13px] text-[#0A0A0A] focus:outline-none focus:border-black transition-colors"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-email" className="text-[12px] font-medium text-[#3F3F46]">
                Your email
              </label>
              <input
                id="report-email"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="h-10 px-3 rounded-[11px] border border-black/15 bg-[#FAFAFA] text-[13px] text-[#0A0A0A] placeholder:text-[#9CA3AF] focus:outline-none focus:border-black transition-colors"
              />
              <ValidationError
                prefix="Email"
                field="email"
                errors={state.errors}
                className="text-[12px] text-red-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-message" className="text-[12px] font-medium text-[#3F3F46]">
                Details
              </label>
              <textarea
                id="report-message"
                name="message"
                required
                rows={3}
                placeholder="Briefly describe what looks wrong..."
                className="p-3 rounded-[11px] border border-black/15 bg-[#FAFAFA] text-[13px] text-[#0A0A0A] placeholder:text-[#9CA3AF] resize-y min-h-[84px] focus:outline-none focus:border-black transition-colors"
              />
              <ValidationError
                prefix="Message"
                field="message"
                errors={state.errors}
                className="text-[12px] text-red-600"
              />
            </div>

            <ValidationError errors={state.errors} className="text-[12px] text-red-600" />

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-10 px-4 text-[13px] font-medium text-[#0A0A0A] bg-transparent hover:bg-black/5 transition-colors cursor-pointer"
                style={{
                  border: `1.5px solid ${themeBorder}`,
                  borderRadius: `${controlRadius}px`,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state.submitting}
                className="flex-1 h-10 px-4 text-[13px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                style={{
                  backgroundColor: accentFill.bg,
                  color: accentFill.fg,
                  border: `1.5px solid ${themeBorder}`,
                  borderRadius: `${controlRadius}px`,
                }}
              >
                {state.submitting ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

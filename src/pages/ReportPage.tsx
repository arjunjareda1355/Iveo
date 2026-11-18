import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, ValidationError } from '@formspree/react';
import { ArrowLeft, CheckCircle2, Flag } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const REPORT_REASONS = [
  'Spam or misleading links',
  'Impersonation or fake account',
  'Phishing, scam, or malware',
  'Harassment or hate speech',
  'Copyright or trademark infringement',
  'Other policy violation',
];

export const ReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawUser = (searchParams.get('u') || searchParams.get('page') || '').replace(/^@+/, '').trim();
  const [state, handleSubmit] = useForm('xaeooqpj');

  return (
    <div className="min-h-[100dvh] bg-bg text-ink flex flex-col">
      <header className="w-full max-w-[680px] mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" aria-label="Iveo Home">
          <Logo tone="light" size="md" />
        </Link>
        <Button as={Link} to="/" variant="ghost" size="sm">
          <ArrowLeft size={14} />
          <span>Back to Iveo</span>
        </Button>
      </header>

      <main className="flex-1 w-full max-w-[520px] mx-auto px-5 py-8 flex flex-col justify-center">
        <Card className="p-6 sm:p-7">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Flag size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-ink leading-tight">Report a Page</h1>
              <p className="text-[13px] text-muted mt-0.5">
                Submit a Trust &amp; Safety report for any Iveo profile.
              </p>
            </div>
          </div>

          {state.succeeded ? (
            <div className="py-8 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-[17px] font-semibold text-ink">Report received</h2>
              <p className="text-[14px] text-muted max-w-[36ch]">
                Thanks for letting us know. Our team will review this report promptly.
              </p>
              <Button as={Link} to="/" variant="primary" size="md" className="mt-2">
                Return home
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="page-handle" className="text-[13px] font-medium text-ink">
                  Page URL or @username
                </label>
                <input
                  id="page-handle"
                  type="text"
                  name="reportedPage"
                  required
                  defaultValue={rawUser ? `https://iveo.site/@${rawUser}` : ''}
                  placeholder="https://iveo.site/@username"
                  className="h-10 px-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="standalone-reason" className="text-[13px] font-medium text-ink">
                  Reason
                </label>
                <select
                  id="standalone-reason"
                  name="reason"
                  required
                  defaultValue={REPORT_REASONS[0]}
                  className="h-10 px-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="standalone-email" className="text-[13px] font-medium text-ink">
                  Your Email
                </label>
                <input
                  id="standalone-email"
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="h-10 px-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                />
                <ValidationError
                  prefix="Email"
                  field="email"
                  errors={state.errors}
                  className="text-[12px] text-error"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="standalone-message" className="text-[13px] font-medium text-ink">
                  Details
                </label>
                <textarea
                  id="standalone-message"
                  name="message"
                  required
                  rows={4}
                  placeholder="Tell us what happened..."
                  className="p-3 rounded-[10px] border border-border bg-surface text-[14px] text-ink resize-y focus-visible:outline-2 focus-visible:outline-ink"
                />
                <ValidationError
                  prefix="Message"
                  field="message"
                  errors={state.errors}
                  className="text-[12px] text-error"
                />
              </div>

              <ValidationError errors={state.errors} className="text-[12px] text-error" />

              <Button type="submit" variant="primary" size="md" disabled={state.submitting} fullWidth>
                {state.submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default ReportPage;

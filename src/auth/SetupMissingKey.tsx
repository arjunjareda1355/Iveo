import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { KEY_ERROR_IS_SECRET } from '../lib/env';

export const SetupMissingKey: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top bar */}
      <header className="w-full max-w-[1120px] mx-auto h-16 flex items-center justify-between">
        <Logo tone="light" size="md" />
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-ink-2 py-2 px-3 rounded-[10px] hover:bg-surface-2 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>Back to home</span>
        </Link>
      </header>

      {/* Main card */}
      <main className="w-full max-w-[440px] mx-auto my-auto py-8">
        <div className="bg-surface border border-border rounded-[14px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)]">
          <h1 className="text-[24px] font-medium text-ink leading-tight tracking-[-0.02em]">
            Add your Clerk key
          </h1>

          {KEY_ERROR_IS_SECRET && (
            <div className="mt-4 p-3 rounded-[10px] bg-red-50 border border-red-200 text-error text-[14px]">
              A secret key (sk_...) was entered. Never paste secret keys into the frontend. Use the Publishable key (pk_test_... or pk_live_...).
            </div>
          )}

          <ol className="mt-5 space-y-3 text-[15px] text-muted list-decimal list-inside leading-relaxed">
            <li>
              Open the{' '}
              <a
                href="https://dashboard.clerk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline underline-offset-[3px] font-medium"
              >
                Clerk Dashboard
              </a>{' '}
              for application <code className="text-ink font-mono text-[12px]">app_3KiygJnkoVqPjp00NAhi1XjtR8u</code>.
            </li>
            <li>
              Go to <strong>API keys</strong> and copy your <strong>Publishable key</strong> (starts with <code className="text-ink font-mono text-[12px]">pk_test_</code> or <code className="text-ink font-mono text-[12px]">pk_live_</code>).
            </li>
            <li>
              Set it as <code className="text-ink font-mono text-[12px]">VITE_CLERK_PUBLISHABLE_KEY</code> or paste into <code className="text-ink font-mono text-[12px]">src/lib/env.ts</code>.
            </li>
          </ol>

          <p className="mt-6 text-[14px] text-muted border-t border-border pt-4">
            Never use the secret key (sk_...) in this app.
          </p>
        </div>

        {/* Footer lines */}
        <div className="mt-6 text-center text-[13px] text-muted space-y-1">
          <p>
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-ink underline underline-offset-[3px]">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-ink underline underline-offset-[3px]">
              Privacy Policy
            </Link>
            .
          </p>
          <p>
            Need help? Email{' '}
            <a
              href="mailto:help@ivio.site"
              className="text-ink underline underline-offset-[3px]"
            >
              help@ivio.site
            </a>
          </p>
        </div>
      </main>

      <div className="h-6" aria-hidden="true" />
    </div>
  );
};

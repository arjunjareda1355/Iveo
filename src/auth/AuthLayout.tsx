import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { copy } from '../content/copy';

interface AuthLayoutProps {
  title: string;
  contextElement?: React.ReactNode;
  children: React.ReactNode;
}

export const AuthSkeletonCard: React.FC = () => {
  return (
    <div
      className="w-full h-[440px] bg-surface border border-border rounded-[14px] p-6 flex flex-col justify-between"
      aria-hidden="true"
    >
      <div className="space-y-4">
        <div className="w-1/3 h-6 bg-[#F5F5F5] rounded-[6px]" />
        <div className="w-full h-10 bg-[#F5F5F5] rounded-[10px]" />
        <div className="w-full h-10 bg-[#F5F5F5] rounded-[10px]" />
      </div>
      <div className="w-full h-10 bg-[#F5F5F5] rounded-[10px]" />
    </div>
  );
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  contextElement,
  children,
}) => {
  useEffect(() => {
    document.title = title;
  }, [title]);

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
          <span>{copy.auth.backLink}</span>
        </Link>
      </header>

      {/* Main Column */}
      <main className="w-full max-w-[420px] mx-auto my-auto py-8 flex flex-col items-center">
        {contextElement && <div className="w-full mb-4">{contextElement}</div>}
        <div className="w-full">{children}</div>

        {/* Footer lines under the card */}
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
            {copy.auth.helpLinePrefix}{' '}
            <a
              href="mailto:help@iveo.site"
              className="text-ink underline underline-offset-[3px]"
            >
              help@iveo.site
            </a>
          </p>
        </div>
      </main>

      {/* Spacing footer balance */}
      <div className="h-6" aria-hidden="true" />
    </div>
  );
};

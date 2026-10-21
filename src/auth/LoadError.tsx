import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const LoadError: React.FC = () => {
  return (
    <div className="w-full max-w-[420px] mx-auto text-center bg-surface border border-border rounded-[14px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)]">
      <h1 className="text-[24px] font-medium text-ink leading-tight tracking-[-0.02em]">
        We couldn't reach the sign-in service
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Check your connection and try again. If it keeps happening, email{' '}
        <a
          href="mailto:help@iveo.site"
          className="text-ink underline underline-offset-[3px] font-medium"
        >
          help@iveo.site
        </a>
        .
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
        <Button as={Link} to="/" variant="ghost" size="md" fullWidth>
          Back to home
        </Button>
      </div>
    </div>
  );
};

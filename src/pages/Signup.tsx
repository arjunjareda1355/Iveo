import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { copy } from '../content/copy';

export const Signup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('u');
  const plan = searchParams.get('plan');

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
        <Logo tone="light" size="lg" />

        <h1 className="mt-6 text-[24px] font-semibold text-ink leading-tight">
          Create your account
        </h1>

        {/* Query parameter tags */}
        <div className="mt-4 flex flex-col gap-2 items-center">
          {username && (
            <div className="font-mono text-[14px] font-medium text-ink bg-surface-2 px-3 py-1.5 rounded-[8px] border border-border">
              {copy.placeholders.reservingPrefix}
              <span className="font-semibold">{username}</span>
            </div>
          )}

          {plan === 'pro' && (
            <div className="text-[13px] font-medium text-ink bg-surface-2 px-3 py-1 rounded-full border border-border">
              {copy.placeholders.proPlanSelected}
            </div>
          )}
        </div>

        <p className="mt-4 text-[15px] text-muted">
          {copy.placeholders.accountSetup}
        </p>

        <div className="mt-8 w-full">
          <Button as={Link} to="/" variant="secondary" size="md" fullWidth>
            {copy.placeholders.backHome}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Signup;

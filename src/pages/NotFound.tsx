import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { copy } from '../content/copy';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
        <Logo tone="light" size="lg" />

        <h1 className="mt-6 text-[24px] font-semibold text-ink leading-tight">
          {copy.placeholders.notFoundHeading}
        </h1>

        <p className="mt-4 text-[15px] text-muted">
          {copy.placeholders.notFoundBody}
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

export default NotFound;

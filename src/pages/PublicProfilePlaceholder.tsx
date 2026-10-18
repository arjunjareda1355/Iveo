import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { validateUsername, normalizeUsername } from '../lib/username-rules';
import { copy } from '../content/copy';

// Replace with the real public profile once links are stored in the database.

export const PublicProfilePlaceholder: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const clean = normalizeUsername(username || '');
  const validation = validateUsername(clean);

  // If reserved or invalid username format, treat as not found
  if (!validation.ok) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
        <Logo tone="light" size="lg" />

        <div className="mt-5 font-mono text-[20px] font-medium text-ink">
          ivio.site/{clean}
        </div>

        <h1 className="mt-3 text-[24px] font-medium text-ink leading-tight tracking-[-0.02em]">
          {copy.publicPlaceholder.heading}
        </h1>

        <p className="mt-2 text-[15px] text-muted">
          {copy.publicPlaceholder.body}
        </p>

        <div className="mt-8 w-full">
          <Button as={Link} to="/" variant="secondary" size="md" fullWidth>
            {copy.publicPlaceholder.button}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePlaceholder;

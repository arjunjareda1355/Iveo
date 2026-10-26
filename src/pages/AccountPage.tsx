import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile } from '@clerk/react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Container } from '../components/ui/Container';
import { AddressPill } from '../components/dashboard/AddressPill';
import { IveoUserButton } from '../auth/IvioUserButton';
import { RequireAuth } from '../auth/guards';
import { iveoAppearance } from '../auth/appearance';
import { useIveoSession } from '../auth/useIvioSession';
import { usePageMeta } from '../hooks/usePageMeta';
import { copy } from '../content/copy';

export const AccountPage: React.FC = () => {
  usePageMeta({ robots: 'noindex, nofollow' });
  const session = useIveoSession();

  useEffect(() => {
    document.title = copy.dashboard.titles.account;
  }, []);

  const accountAppearance = {
    ...iveoAppearance,
    elements: {
      ...iveoAppearance.elements,
      rootBox: {
        width: '100%',
      },
      card: {
        border: '1px solid #E5E5E5',
        boxShadow: 'none',
        borderRadius: '14px',
        width: '100%',
      },
      profileSection__username: {
        display: 'none',
      },
    },
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-bg flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 w-full bg-surface border-b border-border">
          <Container className="h-full flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <Logo tone="light" size="md" />
              {session.username && <AddressPill username={session.username} />}
            </div>

            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-ink-2 py-2 px-3 rounded-[10px] hover:bg-surface-2 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink"
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
                <span>Back to dashboard</span>
              </Link>
              <IveoUserButton />
            </div>
          </Container>
        </header>

        {/* Content Area */}
        <main id="main" className="flex-1 py-8 sm:py-10">
          <div className="w-full max-w-[880px] mx-auto px-4 sm:px-6">
            <UserProfile routing="path" path="/account" appearance={accountAppearance} />
          </div>
        </main>
      </div>
    </RequireAuth>
  );
};

export default AccountPage;

import React from 'react';
import { UserButton } from '@clerk/react';
import { LayoutDashboard, Palette, BarChart3, CreditCard } from 'lucide-react';
import { useIveoSession } from './useIvioSession';

export const IveoUserButton: React.FC = () => {
  const { isLoaded, isSignedIn } = useIveoSession();

  if (!isLoaded || !isSignedIn) {
    return <div className="w-8 h-8 rounded-full bg-surface-2 shrink-0" aria-hidden="true" />;
  }

  return (
    <div className="w-8 h-8 flex items-center justify-center shrink-0">
      <UserButton
        userProfileMode="navigation"
        userProfileUrl="/account"
        appearance={{
          elements: {
            avatarBox: { width: '32px', height: '32px' },
            userButtonPopoverCard: {
              border: 'none',
              boxShadow: '0 10px 32px rgba(10, 10, 10, 0.14)',
              borderRadius: '14px',
            },
            userButtonPopoverMain: {
              border: 'none',
            },
          },
        }}
      >
        <UserButton.MenuItems>
          <UserButton.Link
            label="Dashboard"
            labelIcon={<LayoutDashboard size={16} strokeWidth={1.5} />}
            href="/dashboard"
          />
          <UserButton.Link
            label="Appearance"
            labelIcon={<Palette size={16} strokeWidth={1.5} />}
            href="/dashboard/appearance"
          />
          <UserButton.Link
            label="Analytics"
            labelIcon={<BarChart3 size={16} strokeWidth={1.5} />}
            href="/dashboard/analytics"
          />
          <UserButton.Link
            label="Subscription"
            labelIcon={<CreditCard size={16} strokeWidth={1.5} />}
            href="/account#subscription"
          />
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  );
};

// Backward-compatible alias
export const IvioUserButton = IveoUserButton;

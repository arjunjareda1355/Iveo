import React from 'react';
import { UserButton } from '@clerk/react';
import { LayoutDashboard } from 'lucide-react';
import { useIvioSession } from './useIvioSession';

export const IvioUserButton: React.FC = () => {
  const { isLoaded, isSignedIn } = useIvioSession();

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
          },
        }}
      >
        <UserButton.MenuItems>
          <UserButton.Link
            label="Dashboard"
            labelIcon={<LayoutDashboard size={16} strokeWidth={1.5} />}
            href="/dashboard"
          />
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  );
};

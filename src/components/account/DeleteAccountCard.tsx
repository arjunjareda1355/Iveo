import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface DeleteAccountCardProps {
  username: string;
  email?: string | null;
}

export const DeleteAccountCard: React.FC<DeleteAccountCardProps> = ({
  username,
  email,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-red-200 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-[color:var(--error,#B3261E)] leading-tight">
            Delete account
          </h3>
          <p className="text-[13px] text-muted mt-1">
            Permanently delete your account, page and all data. This cannot be undone.
          </p>
        </div>

        <Button
          variant="destructive"
          size="md"
          onClick={() => setIsDialogOpen(true)}
          className="shrink-0 self-start sm:self-center"
        >
          Delete account
        </Button>
      </Card>

      <DeleteAccountDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        username={username}
        email={email}
      />
    </>
  );
};

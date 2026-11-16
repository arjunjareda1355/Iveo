import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { SUPPORT_EMAIL } from '../../lib/site';
import { copy } from '../../content/copy';

interface DeleteAccountCardProps {
  username: string;
}

export const DeleteAccountCard: React.FC<DeleteAccountCardProps> = ({ username }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {copy.deleteAccount.cardTitle}
          </h3>
          <p className="text-[12px] text-muted mt-0.5">
            {copy.deleteAccount.cardBody}{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline hover:text-ink transition-colors"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="text-[#B3261E] hover:text-[#B3261E] border-border hover:border-[#B3261E]/40 shrink-0 self-start sm:self-center"
        >
          {copy.deleteAccount.deleteButton}
        </Button>
      </Card>

      <DeleteAccountDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        username={username}
      />
    </>
  );
};

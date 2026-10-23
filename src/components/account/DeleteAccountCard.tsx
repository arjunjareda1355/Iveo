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
      <Card className="flex flex-col items-start gap-4 p-5 sm:p-6">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
          {copy.deleteAccount.cardTitle}
        </h3>

        <p className="text-[14px] text-muted leading-relaxed">
          {copy.deleteAccount.cardBody}
        </p>

        <Button
          variant="secondary"
          size="md"
          onClick={() => setIsDialogOpen(true)}
          className="text-[#B3261E] hover:text-[#B3261E] border-border hover:border-[#B3261E]/40"
        >
          {copy.deleteAccount.deleteButton}
        </Button>

        <p className="text-[13px] text-muted">
          {copy.deleteAccount.helpLinePrefix}{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline hover:text-ink transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Card>

      <DeleteAccountDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        username={username}
      />
    </>
  );
};

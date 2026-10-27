import React from 'react';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';

interface DeleteAllDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const DeleteAllDialog: React.FC<DeleteAllDialogProps> = ({
  isOpen,
  isLoading,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-all-contacts-title"
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-[16px] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-all-contacts-title" className="text-[18px] font-semibold text-ink">
          {copy.contacts.deleteAllDialog.title}
        </h3>
        <p className="mt-2 text-[14px] text-muted leading-relaxed">
          {copy.contacts.deleteAllDialog.body}
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {copy.contacts.deleteAllDialog.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isLoading}
            className="bg-error hover:bg-error/90 text-white"
            onClick={onConfirm}
          >
            {isLoading ? 'Deleting all...' : copy.contacts.deleteAllDialog.delete}
          </Button>
        </div>
      </div>
    </div>
  );
};

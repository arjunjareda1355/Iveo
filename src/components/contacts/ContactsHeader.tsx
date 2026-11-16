import React from 'react';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';
import { Download, Trash2 } from 'lucide-react';

interface ContactsHeaderProps {
  total: number;
  isPro: boolean;
  isExporting: boolean;
  onExportCsv: () => void;
  onDeleteAll: () => void;
}

export const ContactsHeader: React.FC<ContactsHeaderProps> = ({
  total,
  isPro,
  isExporting,
  onExportCsv,
  onDeleteAll,
}) => {
  const countLabel =
    total === 1
      ? copy.contacts.countSingle
      : copy.contacts.countMultiple.replace('{n}', total.toLocaleString());

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
      <div>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">
          {copy.contacts.title}
        </h1>
        <p className="text-[14px] text-muted mt-0.5">{countLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="secondary"
          size="md"
          disabled={total === 0 || isExporting}
          onClick={onExportCsv}
          className="shrink-0"
        >
          {isExporting ? (
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-1.5" />
          ) : (
            <Download size={16} className="mr-1.5" />
          )}
          <span>{copy.contacts.downloadCsv}</span>
        </Button>

        {isPro && total > 0 && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDeleteAll}
            className="text-error hover:bg-red-50 hover:text-error shrink-0"
          >
            <Trash2 size={16} className="mr-1.5" />
            <span>{copy.contacts.deleteAll}</span>
          </Button>
        )}
      </div>
    </div>
  );
};

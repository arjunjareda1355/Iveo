import React from 'react';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContactsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export const ContactsPagination: React.FC<ContactsPaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
}) => {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  const text = copy.contacts.paginationText
    .replace('{from}', from.toLocaleString())
    .replace('{to}', to.toLocaleString())
    .replace('{total}', total.toLocaleString());

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border text-[13px] text-muted">
      <span>{text}</span>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} className="mr-1" />
          <span>{copy.contacts.previous}</span>
        </Button>
        <span className="text-ink px-2 font-medium">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>{copy.contacts.next}</span>
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
};

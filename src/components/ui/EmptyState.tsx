import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <Card className={cn('flex flex-col items-center text-center gap-3 p-6 sm:p-8', className)}>
      <div className="w-11 h-11 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center text-muted">
        {icon}
      </div>
      <div className="max-w-[38ch]">
        <h3 className="text-[16px] font-semibold text-ink leading-tight">{title}</h3>
        <p className="mt-1 text-[13px] text-muted leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </Card>
  );
};

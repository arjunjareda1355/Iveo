import React from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps {
  variant?: 'default' | 'pro';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
}) => {
  if (variant === 'pro') {
    return (
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-full bg-ink px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-white border border-ink select-none',
          className
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full bg-surface-2 px-2 text-[12px] font-medium text-ink-2 border border-border select-none',
        className
      )}
    >
      {children}
    </span>
  );
};

import React from 'react';
import { cn } from '../../lib/cn';

interface ProBadgeProps {
  className?: string;
}

export const ProBadge: React.FC<ProBadgeProps> = ({ className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-[5px] text-[11px] font-semibold tracking-wider uppercase bg-ink text-white select-none leading-none',
        className
      )}
    >
      Pro
    </span>
  );
};

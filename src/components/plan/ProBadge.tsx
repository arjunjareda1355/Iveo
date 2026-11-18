import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ProBadgeProps {
  className?: string;
  locked?: boolean;
}

export const ProBadge: React.FC<ProBadgeProps> = ({ className, locked = false }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold tracking-wider uppercase bg-ink text-white select-none leading-none shrink-0',
        className
      )}
    >
      {locked && <Lock size={9} strokeWidth={2.5} aria-hidden="true" />}
      <span>PRO</span>
    </span>
  );
};

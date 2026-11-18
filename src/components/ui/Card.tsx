import React from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-[16px] bg-surface p-4 sm:p-5 border border-border shadow-[0_1px_2px_rgba(10,10,10,0.04)]',
        interactive && 'transition-colors duration-120 hover:border-border-strong cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

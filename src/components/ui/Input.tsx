import React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-12 w-full rounded-[10px] bg-surface px-[14px] text-[16px] text-ink',
          'border border-border-strong placeholder:text-subtle',
          'transition-colors duration-120 hover:border-[#A3A3A3]',
          'focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.08)] focus:outline-none',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

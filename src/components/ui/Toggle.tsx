import React from 'react';
import { cn } from '../../lib/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  locked?: boolean;
  ariaLabel: string;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  locked = false,
  ariaLabel,
  className,
}) => {
  const isVisualOn = checked && !locked;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isVisualOn}
      aria-disabled={disabled || locked || undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={cn(
        'min-w-[44px] min-h-[44px] inline-flex items-center justify-center shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'w-11 h-6 rounded-full flex items-center p-0.5 transition-colors duration-150 border',
          isVisualOn
            ? 'bg-ink border-ink'
            : 'bg-toggle-off border-border-strong'
        )}
      >
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] transform transition-transform duration-150',
            isVisualOn ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
};

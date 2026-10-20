import React, { useRef } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly (SegmentedControlOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const normalizedOptions: SegmentedControlOption<T>[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt as T, label: opt } : opt
  );

  const activeIndex = normalizedOptions.findIndex((opt) => opt.value === value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % normalizedOptions.length;
      if (!normalizedOptions[nextIndex].disabled) {
        onChange(normalizedOptions[nextIndex].value);
        buttonRefs.current[nextIndex]?.focus();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + normalizedOptions.length) % normalizedOptions.length;
      if (!normalizedOptions[prevIndex].disabled) {
        onChange(normalizedOptions[prevIndex].value);
        buttonRefs.current[prevIndex]?.focus();
      }
    }
  };

  const optionWidthPercent = 100 / normalizedOptions.length;

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-9 w-full max-w-full items-center rounded-[10px] bg-surface-2 p-[3px] border border-border select-none',
        className
      )}
    >
      {/* Sliding thumb */}
      <div
        className="absolute top-[3px] bottom-[3px] rounded-[8px] bg-surface shadow-[0_1px_2px_rgba(10,10,10,0.04)] transition-all duration-200 ease-out"
        style={{
          left: `calc(${activeIndex * optionWidthPercent}% + 3px)`,
          width: `calc(${optionWidthPercent}% - 6px)`,
        }}
        aria-hidden="true"
      />

      {normalizedOptions.map((option, index) => {
        const isSelected = option.value === value;
        const isDisabled = option.disabled === true;

        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isDisabled) onChange(option.value);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative z-10 flex-1 h-full flex items-center justify-center text-[13px] font-medium leading-none px-3',
              'transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink rounded-[8px]',
              isDisabled
                ? 'opacity-40 cursor-not-allowed text-muted'
                : 'cursor-pointer',
              isSelected ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

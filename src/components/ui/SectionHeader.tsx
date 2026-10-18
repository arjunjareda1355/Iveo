import React from 'react';
import { cn } from '../../lib/cn';

export interface SectionHeaderProps {
  id?: string;
  eyebrow?: string;
  heading: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
  headingClassName?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  id,
  eyebrow,
  heading,
  lead,
  align = 'left',
  tone = 'light',
  className,
  headingClassName,
}) => {
  const isDark = tone === 'dark';
  const isCenter = align === 'center';

  return (
    <div
      id={id}
      className={cn(
        'flex flex-col',
        isCenter ? 'items-center text-center' : 'items-start text-left',
        className
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            'font-mono text-[12px] font-medium uppercase tracking-[0.08em] mb-3 select-none',
            isDark ? 'text-inverse-muted' : 'text-muted'
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          'text-[clamp(2rem,1.4rem+2.2vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]',
          isCenter ? 'max-w-[20ch]' : 'max-w-[20ch]',
          isDark ? 'text-inverse-text' : 'text-ink',
          headingClassName
        )}
      >
        {heading}
      </h2>
      {lead && (
        <p
          className={cn(
            'mt-4 text-[clamp(1.0625rem,1rem+0.3vw,1.25rem)] font-normal leading-[1.55] tracking-[-0.005em] max-w-[56ch]',
            isDark ? 'text-inverse-muted' : 'text-muted'
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
};

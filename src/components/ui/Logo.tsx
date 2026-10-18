import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

interface LogoProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  tone = 'light',
  size = 'md',
  className,
  isLink = true,
}) => {
  const isDark = tone === 'dark';
  const markSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-[20px]';

  const content = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="24"
          height="24"
          rx="7"
          fill={isDark ? '#FAFAFA' : '#0A0A0A'}
        />
        <circle
          cx="12"
          cy="7.25"
          r="1.75"
          fill={isDark ? '#0A0A0A' : '#FFFFFF'}
        />
        <rect
          x="10.5"
          y="10.5"
          width="3"
          height="8"
          rx="1.5"
          fill={isDark ? '#0A0A0A' : '#FFFFFF'}
        />
      </svg>
      <span
        style={{ letterSpacing: '-0.04em' }}
        className={cn(
          'ml-2 font-semibold font-sans leading-none',
          textSize,
          isDark ? 'text-inverse-text' : 'text-ink'
        )}
      >
        ivio
      </span>
    </span>
  );

  if (isLink) {
    return (
      <Link to="/" aria-label="ivio home" className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
};

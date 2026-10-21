import React from 'react';
import { Link } from 'react-router-dom';
import wordmarkImg from '../../assets/wordmark.png';
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
  // 1280x427 aspect ratio (3:1)
  const heightClass = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6';

  const content = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src={wordmarkImg}
        alt="iveo"
        className={cn(
          'w-auto object-contain transition-all duration-120',
          heightClass,
          isDark && 'brightness-0 invert'
        )}
      />
    </span>
  );

  if (isLink) {
    return (
      <Link to="/" aria-label="iveo home" className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
};

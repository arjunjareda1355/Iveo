import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export const SITE_LOGO_SRC = 'https://i.postimg.cc/HkbTTdWH/File-Kit-1000252682-compress-image.jpg';
export const SITE_LOGO_ALT = 'File-Kit-1000252682-compress-image';
export const SITE_LOGO_HREF = 'https://postimg.cc/9DX6p3qN';

interface LogoProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLink?: boolean;
  externalLink?: boolean;
  compactMobile?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  tone = 'light',
  size = 'md',
  className,
  isLink = true,
  externalLink = false,
  compactMobile = false,
}) => {
  const isDark = tone === 'dark';
  const heightClass = size === 'sm' ? 'h-6' : size === 'lg' ? 'h-9' : 'h-7';

  const content = (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src={SITE_LOGO_SRC}
        alt={SITE_LOGO_ALT}
        className={cn(
          'w-auto object-contain rounded-[6px] shadow-2xs transition-transform duration-150 group-hover:scale-[1.03]',
          heightClass
        )}
        loading="eager"
      />
      <span
        className={cn(
          'font-semibold tracking-[-0.03em] text-[17px] text-ink transition-colors',
          compactMobile && 'hidden sm:inline',
          isDark && 'text-white'
        )}
      >
        iveo
      </span>
    </span>
  );

  if (isLink) {
    if (externalLink) {
      return (
        <a
          href={SITE_LOGO_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="iveo logo"
          className="inline-flex items-center group focus-visible:outline-2 focus-visible:outline-ink rounded-[8px]"
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        to="/"
        aria-label="iveo home"
        className="inline-flex items-center group focus-visible:outline-2 focus-visible:outline-ink rounded-[8px]"
      >
        {content}
      </Link>
    );
  }

  return content;
};

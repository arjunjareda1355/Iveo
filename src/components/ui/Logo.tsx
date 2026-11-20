import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export const SITE_LOGO_SRC = 'https://i.postimg.cc/d1cqB7Dm/iveo-logo-04-tile-white-shadow-4k.png';
export const SITE_LOGO_ALT = 'iveo';
export const SITE_LOGO_HREF = 'https://postimg.cc/t1DQR43Y';

export const SITE_WORDMARK_SRC = 'https://i.postimg.cc/1t19Hg43/iveo-logo-12-wordmark-i-mark-black-4k.png';
export const SITE_WORDMARK_ALT = 'iveo';
export const SITE_WORDMARK_HREF = 'https://postimg.cc/SXVFQxWB';

interface LogoProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLink?: boolean;
  externalLink?: boolean;
  compactMobile?: boolean;
  showWordmark?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  tone = 'light',
  size = 'md',
  className,
  isLink = true,
  externalLink = false,
  compactMobile = false,
  showWordmark = true,
}) => {
  const isDark = tone === 'dark';
  const tileHeightClass = size === 'sm' ? 'h-6' : size === 'lg' ? 'h-9' : 'h-7';
  const wordmarkHeightClass = size === 'sm' ? 'h-3.5' : size === 'lg' ? 'h-5' : 'h-4';

  const content = (
    <span className={cn('inline-flex items-center gap-2 select-none shrink-0', className)}>
      <img
        src={SITE_LOGO_SRC}
        alt={showWordmark ? '' : SITE_LOGO_ALT}
        className={cn(
          'w-auto object-contain rounded-[7px] transition-transform duration-150 group-hover:scale-[1.03]',
          tileHeightClass
        )}
        loading="eager"
      />
      {showWordmark && (
        <img
          src={SITE_WORDMARK_SRC}
          alt={SITE_WORDMARK_ALT}
          className={cn(
            'w-auto object-contain transition-opacity duration-150',
            wordmarkHeightClass,
            compactMobile && 'hidden sm:inline-block',
            isDark && 'brightness-0 invert'
          )}
          loading="eager"
        />
      )}
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

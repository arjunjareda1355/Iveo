import React, { useState, useEffect } from 'react';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  fallbackInitials?: string;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-24 h-24 text-3xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  className = '',
  fallbackInitials = '?',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error & loaded state whenever src changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const cleanSrc = src && typeof src === 'string' ? src.trim() : null;
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  const initials = fallbackInitials
    ? fallbackInitials.slice(0, 2).toUpperCase()
    : (alt ? alt.replace(/^@/, '').slice(0, 2).toUpperCase() : '?');

  if (!cleanSrc || hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-sand-200 text-ink/70 font-medium select-none shrink-0 ${sizeClasses} ${className}`}
        aria-label={alt}
      >
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-sand-200 ${sizeClasses} ${className}`}
    >
      <img
        src={cleanSrc}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sand-200 text-ink/40 font-medium animate-pulse">
          <span>{initials}</span>
        </div>
      )}
    </div>
  );
};

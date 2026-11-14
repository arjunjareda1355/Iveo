import React, { useState } from 'react';

export const VERIFIED_TICK_IMAGE_URL =
  'https://i.postimg.cc/Bv0Hqx92/verified-tick-black.png';

export interface VerifiedTickProps {
  size?: number;
  className?: string;
  title?: string;
  onDark?: boolean;
}

export const VerifiedTick: React.FC<VerifiedTickProps> = ({
  size = 15,
  className = '',
  title = 'Verified Iveo Pro',
  onDark = false,
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      data-testid="verified-pro-tick"
      className={`inline-flex items-center justify-center shrink-0 align-middle select-none leading-none ${
        onDark ? 'rounded-full bg-white/95 ring-1 ring-white/80' : ''
      } ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        padding: onDark ? '1px' : undefined,
      }}
    >
      {!failed ? (
        <img
          src={VERIFIED_TICK_IMAGE_URL}
          alt="verified-tick-black"
          referrerPolicy="no-referrer"
          decoding="async"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="w-full h-full object-contain block"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          aria-hidden="true"
          className="w-full h-full block"
        >
          <circle cx="12" cy="12" r="10.5" fill={onDark ? '#0A0A0A' : '#0A0A0A'} />
          <path
            d="M7.5 12.3l3 3 6-6.2"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
};

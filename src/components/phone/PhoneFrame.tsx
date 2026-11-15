import React from 'react';
import { Vibe } from '../../lib/vibes';

interface PhoneFrameProps {
  width?: number; // default 300
  vibe: Vibe;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  width = 300,
  vibe,
  children,
  ariaLabel,
  className,
}) => {
  const scale = width / 300;
  const height = Math.round(width * (618 / 300));
  const outerRadius = Math.round(44 * scale);
  const innerRadius = Math.round(36 * scale);
  const outerPadding = Math.round(8 * scale);

  const islandWidth = Math.round(84 * scale);
  const islandHeight = Math.round(24 * scale);
  const islandRadius = Math.round(12 * scale);
  const islandTop = Math.round(10 * scale);

  const statusBarHeight = Math.round(44 * scale);
  const statusBarPaddingX = Math.round(24 * scale);

  const homeIndicatorWidth = Math.round(112 * scale);
  const homeIndicatorHeight = Math.round(4 * scale);
  const homeIndicatorBottom = Math.round(8 * scale);

  const label =
    ariaLabel ||
    `Example iveo page in the ${vibe.name} vibe, for ${vibe.persona.name}`;

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${outerRadius}px`,
        padding: `${outerPadding}px`,
        boxShadow:
          '0 24px 48px -12px rgba(10,10,10,0.14), 0 2px 6px rgba(10,10,10,0.05), inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
      className={`relative bg-[#0A0A0A] select-none shrink-0 ${className || ''}`}
    >
      {/* Screen container */}
      <div
        aria-hidden="true"
        style={{
          borderRadius: `${innerRadius}px`,
          backgroundColor: vibe.tokens.bg,
        }}
        className="relative w-full h-full overflow-hidden flex flex-col"
      >
        {/* Dynamic Island */}
        <div
          style={{
            width: `${islandWidth}px`,
            height: `${islandHeight}px`,
            borderRadius: `${islandRadius}px`,
            top: `${islandTop}px`,
          }}
          className="absolute left-1/2 -translate-x-1/2 bg-black z-30 shadow-xs pointer-events-none"
        />

        {/* Status Bar */}
        <div
          style={{
            height: `${statusBarHeight}px`,
            paddingLeft: `${statusBarPaddingX}px`,
            paddingRight: `${statusBarPaddingX}px`,
            color: vibe.tokens.text,
            fontFamily: "'Inter', sans-serif",
            fontSize: `${Math.round(12 * scale)}px`,
          }}
          className="relative z-20 w-full flex items-center justify-between shrink-0 font-semibold opacity-85 select-none pointer-events-none"
        >
          <span>9:41</span>
          <div className="flex items-center gap-1.5" style={{ height: `${Math.round(14 * scale)}px` }}>
            {/* Cellular Signal Bars */}
            <svg
              width={Math.round(14 * scale)}
              height={Math.round(11 * scale)}
              viewBox="0 0 17 11"
              fill="currentColor"
            >
              <rect x="0" y="8" width="3" height="3" rx="0.5" />
              <rect x="4.5" y="5.5" width="3" height="5.5" rx="0.5" />
              <rect x="9" y="3" width="3" height="8" rx="0.5" />
              <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
            </svg>
            {/* Wi-Fi */}
            <svg
              width={Math.round(14 * scale)}
              height={Math.round(11 * scale)}
              viewBox="0 0 16 12"
              fill="currentColor"
            >
              <path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.2-3a5.9 5.9 0 0 1 8.4 0 .9.9 0 0 1-.2 1.3.9.9 0 0 1-1.3-.2 4.1 4.1 0 0 0-5.6 0 .9.9 0 0 1-1.3.2.9.9 0 0 1 0-1.3zm-3.2-3.1a10.4 10.4 0 0 1 14.8 0 .9.9 0 0 1 0 1.3.9.9 0 0 1-1.3 0 8.6 8.6 0 0 0-12.2 0 .9.9 0 0 1-1.3 0 .9.9 0 0 1 0-1.3z" />
            </svg>
            {/* Battery */}
            <svg
              width={Math.round(20 * scale)}
              height={Math.round(10 * scale)}
              viewBox="0 0 22 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="0.5" y="0.5" width="18" height="10" rx="3" />
              <rect x="2" y="2" width="12" height="7" rx="1.5" fill="currentColor" />
              <path d="M20 3.5v4" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Screen Content (scrollable vertically in live dashboard/onboarding previews) */}
        <div
          data-testid="phone-scroll-viewport"
          className="relative w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(128,128,128,0.3)_transparent]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Home Indicator */}
        <div
          style={{
            width: `${homeIndicatorWidth}px`,
            height: `${homeIndicatorHeight}px`,
            borderRadius: '2px',
            bottom: `${homeIndicatorBottom}px`,
            backgroundColor: vibe.tokens.text,
          }}
          className="absolute left-1/2 -translate-x-1/2 z-30 opacity-30 pointer-events-none"
        />
      </div>
    </div>
  );
};

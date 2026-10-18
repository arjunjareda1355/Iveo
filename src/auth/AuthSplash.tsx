import React from 'react';

export const AuthSplash: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-bg z-50 flex flex-col items-center justify-center">
      {/* 2px ink progress line at top of viewport */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] bg-ink z-[100] animate-pulse"
        aria-hidden="true"
      />

      {/* Centered ivio mark (32px) */}
      <div className="select-none" aria-label="Loading ivio">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="7" fill="#0A0A0A" />
          <circle cx="12" cy="7.25" r="1.75" fill="#FFFFFF" />
          <rect x="10.5" y="10.5" width="3" height="8" rx="1.5" fill="#FFFFFF" />
        </svg>
      </div>
    </div>
  );
};

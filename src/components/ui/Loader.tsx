import React from 'react';
import { cn } from '../../lib/cn';

export type LoaderSize = 'xs' | 'sm' | 'md' | 'lg';

const LOADER_WIDTH_PX: Record<LoaderSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
};

export interface LoaderProps {
  size?: LoaderSize;
  className?: string;
  label?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'sm',
  className,
  label = 'Loading',
}) => {
  const width = LOADER_WIDTH_PX[size] ?? 24;

  return (
    <span
      className={cn('inline-flex items-center justify-center shrink-0', className)}
      role="status"
      aria-live="polite"
    >
      <svg
        className="iveo-loader"
        width={width}
        style={{ width: `${width}px`, maxWidth: '40px' }}
        viewBox="290 150 220 500"
        role="img"
        aria-label={label}
      >
        <circle className="s d" pathLength={1} cx="401" cy="237" r="63" />
        <path
          className="s"
          pathLength={1}
          d="M324 410 C324 392 332 380 348 370 L440 310 C458 298 476 306 476 330 L476 520 C476 538 468 548 452 558 L365 620 C345 633 324 622 324 595 Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
};

export default Loader;

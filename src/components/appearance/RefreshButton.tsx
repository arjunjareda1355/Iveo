import React, { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onClick: () => void;
  busy?: boolean;
  announceText?: string;
  label?: string;
  onLongPressPrevious?: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onClick,
  busy = false,
  announceText = '',
  label = 'Show new ideas',
  onLongPressPrevious,
}) => {
  const [spinning, setSpinning] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const handlePress = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (busy || cooldown) return;

    setCooldown(true);
    setSpinning(true);
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {}

    onClick();

    setTimeout(() => setSpinning(false), 500);
    setTimeout(() => setCooldown(false), 600);
  };

  const handlePointerDown = () => {
    if (!onLongPressPrevious) return;
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPressPrevious();
    }, 550);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        onClick={handlePress}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        disabled={busy || cooldown}
        aria-label={label}
        title="New ideas"
        className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <RefreshCw
          size={20}
          strokeWidth={1.75}
          className={
            spinning
              ? 'transition-transform duration-500 rotate-[360deg] motion-reduce:rotate-0 motion-reduce:opacity-60'
              : 'transition-transform duration-150'
          }
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {announceText}
      </span>
    </div>
  );
};

import React, { useRef } from 'react';
import { RangeKey } from '../../lib/analytics/types';
import { RANGES } from '../../lib/analytics/ranges';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { copy } from '../../content/copy';

interface RangeSelectorProps {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  isPro: boolean;
  clamped?: boolean;
}

const RANGE_KEYS: RangeKey[] = ['7d', '30d', '90d', '12m'];

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  value,
  onChange,
  isPro,
  clamped = false,
}) => {
  const { openUpgrade } = useUpgradeDialog();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleSelect = (key: RangeKey) => {
    const config = RANGES[key];
    if (config.pro && !isPro) {
      openUpgrade('analytics_detail');
      return;
    }
    onChange(key);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % RANGE_KEYS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + RANGE_KEYS.length) % RANGE_KEYS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = RANGE_KEYS.length - 1;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleSelect(RANGE_KEYS[index]);
      return;
    } else {
      return;
    }

    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      {clamped && (
        <p className="text-[13px] text-muted leading-normal">
          {copy.dashboard.analytics.clampedNotice}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label={copy.dashboard.analytics.rangeAriaLabel}
        className="inline-flex items-center p-1 bg-surface-2 border border-border rounded-[12px] gap-1 self-start max-w-full overflow-x-auto no-scrollbar"
      >
        {RANGE_KEYS.map((key, index) => {
          const config = RANGES[key];
          const isSelected = value === key;
          const isLocked = config.pro && !isPro;

          return (
            <button
              key={key}
              ref={(el) => (buttonsRef.current[index] = el)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isLocked ? 'true' : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors duration-120 whitespace-nowrap cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-ink ${
                isSelected
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>{copy.dashboard.analytics.ranges[key]}</span>
              {isLocked && <ProBadge />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

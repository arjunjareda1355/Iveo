import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { ProLockNotice } from '../plan/ProLockNotice';
import { formatScheduleTime } from '../../lib/time';

interface ScheduleSectionProps {
  isPro: boolean;
  startAt: string | null;
  endAt: string | null;
  onChange: (startAt: string | null, endAt: string | null) => void;
  onClearScheduleImmediate?: () => Promise<void>;
  errorMessage?: string | null;
}

// Convert ISO string to local YYYY-MM-DDTHH:mm for datetime-local input
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  } catch {
    return '';
  }
}

// Convert local YYYY-MM-DDTHH:mm to ISO string
function localInputToIso(val: string): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  isPro,
  startAt,
  endAt,
  onChange,
  onClearScheduleImmediate,
  errorMessage,
}) => {
  const hasSchedule = !!startAt || !!endAt;
  const [isEnabled, setIsEnabled] = useState(hasSchedule);
  const userTimeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'local';

  const handleToggle = () => {
    if (!isPro) return;
    if (isEnabled) {
      setIsEnabled(false);
      onChange(null, null);
    } else {
      setIsEnabled(true);
    }
  };

  // Locked state for Free accounts
  if (!isPro) {
    return (
      <div className="flex flex-col gap-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-ink">Schedule</p>
            <p className="text-[13px] text-muted">
              Show this item from a date and hide it after a date.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked="false"
            aria-disabled="true"
            disabled
            className="w-11 h-6 rounded-full bg-border flex items-center p-0.5 cursor-not-allowed opacity-60"
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        <ProLockNotice feature="scheduling" />

        {hasSchedule && (
          <div className="p-3 bg-surface-2 border border-border rounded-[10px] flex items-center justify-between gap-3 text-[14px] text-muted">
            <div className="flex flex-col gap-0.5">
              {startAt && <span>Show from {formatScheduleTime(startAt)}</span>}
              {endAt && <span>Hide after {formatScheduleTime(endAt)}</span>}
            </div>
            {onClearScheduleImmediate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearScheduleImmediate}
                className="shrink-0"
              >
                Clear schedule
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <label htmlFor="schedule-switch" className="text-[14px] font-medium text-ink">
            Schedule
          </label>
          <p className="text-[13px] text-muted">
            Show this item from a date and hide it after a date.
          </p>
        </div>
        <button
          id="schedule-switch"
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={handleToggle}
          className={`w-11 h-6 rounded-full flex items-center p-0.5 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink ${
            isEnabled ? 'bg-ink' : 'bg-border'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-120 ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="flex flex-col gap-3.5 mt-1">
          {/* Show from */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink">Show from</label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                step={60}
                value={isoToLocalInput(startAt)}
                onChange={(e) => onChange(localInputToIso(e.target.value), endAt)}
                className="flex-1 h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
              {startAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(null, endAt)}
                  className="shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Hide after */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink">Hide after</label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                step={60}
                value={isoToLocalInput(endAt)}
                onChange={(e) => onChange(startAt, localInputToIso(e.target.value))}
                className="flex-1 h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
              {endAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(startAt, null)}
                  className="shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <p className="text-[13px] text-muted">
            Times use your time zone ({userTimeZone}).
          </p>

          {errorMessage && (
            <p className="text-[13px] text-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

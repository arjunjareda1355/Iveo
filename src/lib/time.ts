import { useState, useEffect } from 'react';

export type ScheduleState = 'none' | 'upcoming' | 'live' | 'ended';

export interface SchedulableBlock {
  startAt?: string | null;
  endAt?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
  kind?: string;
}

export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setNow(new Date());
    };

    timer = setInterval(tick, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setNow(new Date());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}

export function getScheduleState(block: SchedulableBlock, now: Date): ScheduleState {
  const { startAt, endAt } = block;
  if (!startAt && !endAt) return 'none';

  if (startAt) {
    const startDate = new Date(startAt);
    if (!isNaN(startDate.getTime()) && startDate > now) {
      return 'upcoming';
    }
  }

  if (endAt) {
    const endDate = new Date(endAt);
    if (!isNaN(endDate.getTime()) && endDate <= now) {
      return 'ended';
    }
  }

  return 'live';
}

export function isBlockVisibleNow(
  block: SchedulableBlock,
  plan: 'free' | 'pro',
  now: Date
): boolean {
  if (block.isActive === false || block.isArchived === true) {
    return false;
  }

  // Downgraded or free users: embeds and scheduled items are not shown
  const isPro = plan === 'pro';
  const hasSchedule = !!block.startAt || !!block.endAt;
  const isEmbed = block.kind === 'embed';

  if (!isPro && (hasSchedule || isEmbed)) {
    return false;
  }

  const state = getScheduleState(block, now);
  if (state === 'upcoming' || state === 'ended') {
    return false;
  }

  return true;
}

export function formatScheduleTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return '';
  }
}

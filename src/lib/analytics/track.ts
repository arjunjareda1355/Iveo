import { TrackSource } from './sources';
import { detectDevice } from './device';
import { shouldTrack } from './shouldTrack';
import { validateUsername } from '../username-rules';
import { recordPageEvent } from '../../data/analyticsApi';

export interface AnalyticsContextState {
  enabled: boolean;
  username: string | null;
  source: TrackSource | null;
}

export const analyticsState: AnalyticsContextState = {
  enabled: true,
  username: null,
  source: null,
};

export function setAnalyticsContext(ctx: Partial<AnalyticsContextState>): void {
  Object.assign(analyticsState, ctx);
}

const BLOCK_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;

function scheduleView(task: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(task, { timeout: 600 });
  } else {
    setTimeout(task, 0);
  }
}

/**
 * Fires a page view event. Never throws, blocks or logs.
 */
export function trackView(username: string, source: TrackSource): void {
  try {
    const clean = (username || '').replace(/^@+/, '').trim();
    if (!clean || !validateUsername(clean).ok) {
      return;
    }
    if (!shouldTrack()) {
      return;
    }

    const device =
      typeof navigator !== 'undefined' ? detectDevice(navigator.userAgent || '') : 'other';

    scheduleView(() => {
      recordPageEvent({
        username: clean,
        event: 'view',
        linkId: null,
        source: source || '',
        device,
      }).catch(() => {
        // Silently drop
      });
    });
  } catch {
    // Fire-and-forget
  }
}

/**
 * Fires a link, social icon, or embed click event immediately (keepalive-safe).
 */
export function trackClick(username: string, linkId: string, source: TrackSource): void {
  try {
    const clean = (username || '').replace(/^@+/, '').trim();
    if (!clean || !validateUsername(clean).ok) {
      return;
    }
    if (!linkId || !BLOCK_ID_PATTERN.test(linkId)) {
      return;
    }
    if (!shouldTrack()) {
      return;
    }

    const device =
      typeof navigator !== 'undefined' ? detectDevice(navigator.userAgent || '') : 'other';

    // Dispatch immediately so keepalive survives navigation away from the profile page
    recordPageEvent({
      username: clean,
      event: 'click',
      linkId,
      source: source || '',
      device,
    }).catch(() => {
      // Silently drop
    });
  } catch {
    // Fire-and-forget
  }
}

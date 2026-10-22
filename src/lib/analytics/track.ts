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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function schedule(task: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 0);
  }
}

/**
 * Fires a page view event. Never throws, blocks or logs.
 */
export function trackView(username: string, source: TrackSource): void {
  try {
    if (!username || !validateUsername(username).ok) {
      return;
    }
    if (!shouldTrack()) {
      return;
    }

    const device =
      typeof navigator !== 'undefined' ? detectDevice(navigator.userAgent || '') : 'other';

    schedule(() => {
      recordPageEvent({
        username,
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
 * Fires a link or embed click event. Never throws, blocks or logs.
 */
export function trackClick(username: string, linkId: string, source: TrackSource): void {
  try {
    if (!username || !validateUsername(username).ok) {
      return;
    }
    if (!linkId || !UUID_PATTERN.test(linkId)) {
      return;
    }
    if (!shouldTrack()) {
      return;
    }

    const device =
      typeof navigator !== 'undefined' ? detectDevice(navigator.userAgent || '') : 'other';

    schedule(() => {
      recordPageEvent({
        username,
        event: 'click',
        linkId,
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

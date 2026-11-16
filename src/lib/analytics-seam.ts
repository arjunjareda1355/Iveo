import { analyticsState, trackClick } from './analytics/track';

// Dispatches public page link, embed, and interactive block click events to analytics counters.
export function trackLinkClick(block: { id: string; kind?: string }): void {
  try {
    if (!block || !block.id) return;
    if (!analyticsState.username) return;

    trackClick(analyticsState.username, block.id, analyticsState.source ?? '');
  } catch {
    // Fire-and-forget: never throws or disrupts visitor navigation
  }
}

import { analyticsState } from './track';

interface ExtendedNavigator {
  doNotTrack?: string;
  msDoNotTrack?: string;
  globalPrivacyControl?: boolean;
  webdriver?: boolean;
}

interface ExtendedWindow {
  doNotTrack?: string;
}

const BOT_PATTERN =
  /bot|crawl|spider|headless|lighthouse|pagespeed|prerender|phantomjs|puppeteer|playwright/i;

/**
 * Determines whether analytics tracking is permitted for the current visitor.
 * Respects Do Not Track, Global Privacy Control, automation detection, and owner exclusion.
 */
export function shouldTrack(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Manually disabled (e.g. page owner viewing their page or missing config)
  if (!analyticsState.enabled) {
    return false;
  }

  const nav = navigator as unknown as ExtendedNavigator;
  const win = window as unknown as ExtendedWindow;

  // 2. Do Not Track signal
  if (nav.doNotTrack === '1' || win.doNotTrack === '1' || nav.msDoNotTrack === '1') {
    return false;
  }

  // 3. Global Privacy Control signal
  if (nav.globalPrivacyControl === true) {
    return false;
  }

  // 4. Automated visitors / webdrivers / bot user agents
  if (nav.webdriver === true) {
    return false;
  }

  if (BOT_PATTERN.test(navigator.userAgent || '')) {
    return false;
  }

  return true;
}

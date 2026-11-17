export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'other';

/**
 * Detects visitor device type locally based on User-Agent.
 * The User-Agent string is evaluated strictly on the client and never sent or stored.
 */
export function detectDevice(userAgent: string): DeviceType {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'other';
  }

  // 1. Explicit tablet tokens (must run before mobile/Android checks)
  if (/iPad|Tablet|PlayBook|Kindle|Silk|SM-T|SM-X|Lenovo.*Tab|Pixel Tablet/i.test(userAgent)) {
    return 'tablet';
  }

  // 2. Mobile check (includes iPhone/iPod, Android Mobile/WebView, Windows Phone, and social in-app WebViews)
  if (
    /Mobi|iPhone|iPod|Android.*Mobile|Android.*wv|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile|FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|BytedanceWebview|Musical_ly|Line\/|MicroMessenger|CriOS|FxiOS|EdgiOS/i.test(
      userAgent
    )
  ) {
    return 'mobile';
  }

  // 3. Remaining Android tablets (Android without Mobile/Mobi/wv or known phone WebView tokens)
  if (/Android/i.test(userAgent)) {
    return 'tablet';
  }

  // 4. Desktop check (iPad reporting Mac user agent is treated as desktop per spec)
  if (/Windows|Macintosh|Mac OS X|Linux|Ubuntu|Fedora|Debian|CrOS|X11|Win64|WOW64/i.test(userAgent)) {
    return 'desktop';
  }

  return 'other';
}

/**
 * Client-side detector using User-Agent plus navigator.userAgentData / viewport hints
 * so real phones or desktop browsers never fall through to 'other'.
 */
export function detectClientDevice(): DeviceType {
  if (typeof navigator === 'undefined') {
    return 'other';
  }

  const detected = detectDevice(navigator.userAgent || '');
  if (detected !== 'other') {
    return detected;
  }

  try {
    const uaData = (navigator as any).userAgentData;
    if (uaData && typeof uaData.mobile === 'boolean') {
      return uaData.mobile ? 'mobile' : 'desktop';
    }
  } catch {}

  if (typeof window !== 'undefined') {
    const width = window.innerWidth || window.screen?.width || 0;
    const hasTouch = (navigator.maxTouchPoints || 0) > 0;
    if (hasTouch && width > 0) {
      return width >= 768 && width <= 1180 ? 'tablet' : 'mobile';
    }
    if (width > 0) {
      return 'desktop';
    }
  }

  return 'other';
}

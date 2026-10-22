export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'other';

/**
 * Detects visitor device type locally based on User-Agent.
 * The User-Agent string is evaluated strictly on the client and never sent or stored.
 */
export function detectDevice(userAgent: string): DeviceType {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'other';
  }

  // 1. Tablet check
  if (
    /iPad|Tablet|PlayStation|Kindle|Silk/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
  ) {
    return 'tablet';
  }

  // 2. Mobile check
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent)) {
    return 'mobile';
  }

  // 3. Desktop check (iPad reporting Mac user agent is treated as desktop per spec)
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS|X11/i.test(userAgent)) {
    return 'desktop';
  }

  return 'other';
}

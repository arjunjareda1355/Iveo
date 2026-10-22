/**
 * Source classification examples and expected outputs:
 * 1.  search="?src=instagram", referrer=""                  => "instagram"
 * 2.  search="?utm_source=twitter", referrer=""             => null (unknown value -> fallback)
 * 3.  search="?src=qr", referrer=""                         => "qr"
 * 4.  search="?utm_source=tiktok", referrer=""              => "tiktok"
 * 5.  search="?ref=email", referrer=""                      => "email"
 * 6.  search="?src=INVALID%20HACK", referrer=""             => null (ignored)
 * 7.  search="", referrer="https://www.google.com/search"   => "google"
 * 8.  search="", referrer="https://mail.google.com/"        => "email"
 * 9.  search="", referrer="https://l.instagram.com/"        => "instagram"
 * 10. search="", referrer="https://t.co/abc123xyz"          => "x"
 * 11. search="", referrer="https://web.whatsapp.com/"       => "whatsapp"
 * 12. search="", referrer="android-app://com.discord"       => "discord"
 * 13. search="", referrer="https://random-blog.net/post"    => "other"
 * 14. search="", referrer="https://iveo.site/maya" (own)    => "" (direct)
 * 15. search="", referrer="not a valid url!@#$"             => "" (direct)
 */

export const TRACK_SOURCES = [
  '',
  'qr',
  'google',
  'bing',
  'duckduckgo',
  'instagram',
  'facebook',
  'x',
  'tiktok',
  'youtube',
  'linkedin',
  'pinterest',
  'reddit',
  'whatsapp',
  'telegram',
  'snapchat',
  'threads',
  'github',
  'discord',
  'email',
  'other',
] as const;

export type TrackSource = (typeof TRACK_SOURCES)[number];

export const TRACK_SOURCES_SET = new Set<string>(TRACK_SOURCES);

export const SOURCE_LABELS: Record<TrackSource, string> = {
  '': 'Direct',
  qr: 'QR code',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  snapchat: 'Snapchat',
  threads: 'Threads',
  github: 'GitHub',
  discord: 'Discord',
  email: 'Email',
  other: 'Other',
};

/**
 * Extracts and validates trackable source query parameters.
 * Checks in priority: src, utm_source, ref.
 * Returns null if not found or not in allowed TRACK_SOURCES list.
 */
export function parseSourceParam(search: string): TrackSource | null {
  if (!search) return null;
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);

  const raw = params.get('src') || params.get('utm_source') || params.get('ref');
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();
  if (normalized === '' || !TRACK_SOURCES_SET.has(normalized)) {
    return null;
  }

  return normalized as TrackSource;
}

/**
 * Android application package to TrackSource mapping.
 */
const ANDROID_PACKAGES: Record<string, TrackSource> = {
  'com.instagram.android': 'instagram',
  'com.facebook.katana': 'facebook',
  'com.facebook.orca': 'facebook',
  'com.twitter.android': 'x',
  'com.zhiliaoapp.musically': 'tiktok',
  'com.ss.android.ugc.trill': 'tiktok',
  'com.google.android.youtube': 'youtube',
  'com.linkedin.android': 'linkedin',
  'com.reddit.frontpage': 'reddit',
  'com.whatsapp': 'whatsapp',
  'org.telegram.messenger': 'telegram',
  'com.snapchat.android': 'snapchat',
  'com.google.android.gm': 'email',
  'com.discord': 'discord',
  'com.pinterest': 'pinterest',
  'com.google.android.googlequicksearchbox': 'google',
};

/**
 * Classifies HTTP referrer string into a standard TrackSource category on the visitor device.
 * Never stores or returns the full referrer URL.
 */
export function classifyReferrer(referrer: string, ownHost: string): TrackSource {
  if (!referrer || typeof referrer !== 'string') {
    return '';
  }

  const trimmed = referrer.trim();
  if (!trimmed) {
    return '';
  }

  // Handle android-app:// referrers
  if (trimmed.startsWith('android-app://')) {
    const pkg = trimmed.replace('android-app://', '').split('/')[0].toLowerCase();
    return ANDROID_PACKAGES[pkg] || 'other';
  }

  try {
    const parsed = new URL(trimmed);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }

    const cleanOwn = ownHost.toLowerCase().replace(/^www\./, '');

    // Own host is direct
    if (cleanOwn && (host === cleanOwn || host.endsWith('.' + cleanOwn))) {
      return '';
    }

    // Email providers
    if (
      host === 'mail.google.com' ||
      host === 'outlook.live.com' ||
      host === 'outlook.office.com' ||
      host === 'outlook.office365.com'
    ) {
      return 'email';
    }

    // Google search
    if (/(^|\.)google\.[a-z.]+$/.test(host)) {
      return 'google';
    }

    // Known services
    if (host === 'bing.com' || host.endsWith('.bing.com')) return 'bing';
    if (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) return 'duckduckgo';
    if (host === 'instagram.com' || host === 'l.instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (
      host === 'facebook.com' ||
      host === 'l.facebook.com' ||
      host === 'lm.facebook.com' ||
      host === 'm.facebook.com' ||
      host === 'fb.com' ||
      host === 'fb.me' ||
      host.endsWith('.facebook.com')
    ) {
      return 'facebook';
    }
    if (host === 'x.com' || host === 'twitter.com' || host === 't.co' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return 'x';
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) return 'youtube';
    if (host === 'linkedin.com' || host === 'lnkd.in' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'pinterest.com' || host === 'pin.it' || /(^|\.)pinterest\.[a-z.]+$/.test(host)) return 'pinterest';
    if (host === 'reddit.com' || host === 'out.reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (host === 'whatsapp.com' || host === 'web.whatsapp.com' || host === 'wa.me' || host.endsWith('.whatsapp.com')) return 'whatsapp';
    if (host === 'telegram.org' || host === 'web.telegram.org' || host === 't.me' || host.endsWith('.telegram.org')) return 'telegram';
    if (host === 'snapchat.com' || host.endsWith('.snapchat.com')) return 'snapchat';
    if (host === 'threads.net' || host === 'threads.com' || host.endsWith('.threads.net')) return 'threads';
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    if (host === 'discord.com' || host === 'discord.gg' || host.endsWith('.discord.com')) return 'discord';

    return 'other';
  } catch {
    return '';
  }
}

/**
 * Resolves visitor source once per page mount.
 */
export function resolveSource(): TrackSource {
  if (typeof window === 'undefined') return '';
  const fromParam = parseSourceParam(window.location.search);
  if (fromParam) return fromParam;
  return classifyReferrer(
    typeof document !== 'undefined' ? document.referrer : '',
    window.location.hostname
  );
}

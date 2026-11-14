export const PRO_FEATURES = [
  'embeds',
  'scheduling',
  'hide_footer',
  'analytics_detail',
  'password_links',
  'contact_forms',
  'backgrounds',
  'fonts',
  'pro_vibes',
  'verified_badge',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_NAMES: Record<ProFeature, string> = {
  embeds: 'Playable media embeds',
  scheduling: 'Link scheduling & expiration',
  hide_footer: 'Removing the iveo mark',
  analytics_detail: 'Advanced analytics',
  password_links: 'Password-protected links',
  contact_forms: 'Email and phone collection',
  backgrounds: 'Pro backdrops & custom photo uploads',
  fonts: 'Pro designer fonts & pairings',
  pro_vibes: 'Pro Vibes (6 exclusive themes)',
  verified_badge: 'Verified Pro tick next to your handle',
};

export function getProFeatureName(feature: ProFeature): string {
  return PRO_FEATURE_NAMES[feature] || 'Pro feature';
}

export const FREE_PLAN_HIGHLIGHTS: readonly string[] = [
  '1 public iveo.site/username page with live preview',
  'Unlimited standard links, section headers & dividers',
  '15 showcase blocks (YouTube, Instagram, Buy Me a Coffee, Products, Bookings, Countdowns, Coupons, vCard, FAQ)',
  '6 Free Vibes + all 3 button shapes (Square, Rounded, Pill)',
  '8 curated fonts, custom hex button colors & layout styles',
  '5 Studio backdrops + Theme Default + custom-color QR & Business Card PNG',
  '30-day views, clicks, CTR & top links analytics',
] as const;

export const PRO_PLAN_HIGHLIGHTS: readonly string[] = [
  'Everything in Free',
  'Verified Pro tick shown next to your @username everywhere',
  'All 12 Vibes (unlocks 6 Pro themes: Cyberpunk, Sunset, Glass, Brutalist, Emerald, Pastel)',
  'All 19 fonts + Pro pairings (Fraunces, Playfair Display, Syne, Instrument Serif & more)',
  '10 Pro backdrops + custom photo upload with blur & opacity controls',
  'Playable YouTube, Spotify & SoundCloud embeds + Audience Signup Forms (CSV export)',
  'Link scheduling, expiration dates & password-protected links',
  '90-day & 12-month analytics with Traffic Sources, Countries & Devices',
  'Option to remove the iveo footer mark + priority email support',
] as const;

export interface PlanComparisonRow {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
}

export interface PlanComparisonSection {
  category: string;
  rows: readonly PlanComparisonRow[];
}

export const PLAN_COMPARISON_SECTIONS: readonly PlanComparisonSection[] = [
  {
    category: 'Identity & Verified Status',
    rows: [
      { feature: 'Public iveo.site/username page', free: true, pro: true },
      { feature: 'Verified Pro tick beside @username', free: false, pro: 'Included' },
      { feature: 'Custom SEO title, meta & automatic sitemap', free: true, pro: true },
      { feature: 'Remove the iveo footer mark', free: false, pro: true },
    ],
  },
  {
    category: 'Themes, Fonts & Appearance',
    rows: [
      { feature: 'Vibes (theme palettes)', free: '6 Free vibes', pro: 'All 12 vibes (6 Pro)' },
      { feature: 'Custom typography (Name, Bio & Buttons)', free: '8 Free fonts', pro: 'All 19 fonts (11 Pro)' },
      { feature: 'Page backgrounds', free: '5 Studio + Default', pro: 'All 15 + Custom photo upload' },
      { feature: 'Button shapes, hex colors & layout effects', free: true, pro: true },
    ],
  },
  {
    category: 'Links, Blocks & Controls',
    rows: [
      { feature: 'Unlimited standard links, headers & dividers', free: true, pro: true },
      { feature: 'Creator blocks (YouTube, Instagram, BMAC, Store, Booking, FAQ)', free: '15 Free blocks', pro: 'All 17 blocks' },
      { feature: 'Playable YouTube, Spotify & SoundCloud embeds', free: false, pro: true },
      { feature: 'Audience Signup Form & CSV subscriber export', free: false, pro: true },
      { feature: 'Link scheduling & expiration dates', free: false, pro: true },
      { feature: 'Password-protected links', free: false, pro: true },
    ],
  },
  {
    category: 'Analytics, QR & Business Card',
    rows: [
      { feature: 'Custom-color QR studio (PNG & SVG)', free: true, pro: true },
      { feature: 'Digital Business Card & HD 2040×1200 PNG', free: true, pro: true },
      { feature: 'Analytics date range', free: '30 days', pro: '30d, 90d & 12 months' },
      { feature: 'Traffic sources, countries & devices', free: false, pro: true },
      { feature: 'Support', free: 'Standard email', pro: 'Priority email' },
    ],
  },
] as const;

/**
 * Designated owner emails who automatically have full Pro privileges for lifetime
 * and can use reserved usernames. Any email ending with @iveo.site is also included.
 */
export const OWNER_EMAILS = [
  'arjunjareda2007@gmail.com',
  'arjunjareda1355@gmail.com',
] as const;

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  if (/^[^@\s]+@iveo\.site$/i.test(clean)) return true;
  return OWNER_EMAILS.some((owner) => owner.toLowerCase() === clean);
}

export function canUseReservedUsername(email: string | null | undefined): boolean {
  return isOwnerEmail(email);
}


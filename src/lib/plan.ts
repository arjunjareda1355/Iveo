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
  '1 public iveo.site/@username page with live preview',
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
      { feature: 'Public iveo.site/@username page', free: true, pro: true },
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

/**
 * Accounts registered strictly before 01/01/2027 (UTC midnight) receive Pro
 * automatically in the background without any UI promo clutter.
 */
export const EARLY_BIRD_PRO_DEADLINE_ISO = '2027-01-01T00:00:00.000Z';
export const EARLY_BIRD_PRO_DEADLINE_MS = Date.parse(EARLY_BIRD_PRO_DEADLINE_ISO);

export type PlanSource = 'owner' | 'paid' | 'early_bird' | 'free';
export type SubscriptionLifecycleState =
  | 'free'
  | 'checkout_pending'
  | 'payment_authentication'
  | 'active'
  | 'renewal'
  | 'scheduled_cancellation'
  | 'immediate_cancellation'
  | 'expired';

export type SubscriptionStatus =
  | SubscriptionLifecycleState
  | 'cancelled'
  | 'none';

export type SubscriptionCycle = 'monthly' | 'yearly';
export type BillingCurrency = 'INR' | 'USD';
export type BillingHistoryStatus =
  | 'paid'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  cycle: SubscriptionCycle | null;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentId: string | null;
  orderId: string | null;
  amountInr: number | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  currency?: BillingCurrency | null;
  amountMinor?: number | null;
  paymentMethodSummary?: string | null;
  currentPeriodStart?: string | null;
  nextBillingAt?: string | null;
  gracePeriodEndsAt?: string | null;
  cancelReason?: string | null;
  lastPaymentFailedAt?: string | null;
  lastEventId?: string | null;
  updatedAt?: string | null;
}

export interface BillingHistoryRecord {
  id: string;
  date: string;
  amountMinor: number;
  amountDisplay: string;
  currency: BillingCurrency;
  status: BillingHistoryStatus;
  cycle: SubscriptionCycle | null;
  orderId?: string | null;
  paymentId?: string | null;
  subscriptionId?: string | null;
  invoiceNumber?: string | null;
  invoiceAvailable: boolean;
  paymentMethodSummary?: string | null;
  description?: string;
  failureReason?: string | null;
  refundedAmountMinor?: number | null;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  transactionId: string;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  cycle: SubscriptionCycle;
  amountMinor: number;
  currency: BillingCurrency;
  paymentId: string;
  orderId: string;
  status: 'paid';
  paymentMethodSummary?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  username: string;
}

export interface BillingNotification {
  id: string;
  kind: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  createdAt: string;
  eventKey?: string | null;
  read?: boolean;
}

export interface SubscriptionAuditLog {
  id: string;
  action: string;
  actor: 'user' | 'webhook' | 'system' | 'admin';
  actorEmail?: string | null;
  fromState: string;
  toState: string;
  reason?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  createdAt: string;
}

export interface UserBillingStore {
  billingHistory: BillingHistoryRecord[];
  invoices: InvoiceRecord[];
  notifications: BillingNotification[];
  auditLogs: SubscriptionAuditLog[];
  processedWebhookEvents: string[];
}

export interface GracePeriodInfo {
  inGracePeriod: boolean;
  gracePeriodEndsAt: string | null;
  daysRemaining: number;
}

export const GRACE_PERIOD_DAYS = 3;

export function formatMinorCurrency(amountMinor: number, currency: BillingCurrency = 'INR'): string {
  const safeMinor = Number.isFinite(amountMinor) ? amountMinor : 0;
  if (currency === 'USD') {
    const dollars = safeMinor / 100;
    return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  }
  const rupees = Math.round(safeMinor / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function getGracePeriodInfo(
  sub?: Partial<SubscriptionRecord> | null,
  nowMs: number = Date.now()
): GracePeriodInfo {
  const graceIso = sub?.gracePeriodEndsAt || null;
  if (!graceIso) {
    return { inGracePeriod: false, gracePeriodEndsAt: null, daysRemaining: 0 };
  }
  const graceMs = Date.parse(graceIso);
  if (!Number.isFinite(graceMs) || graceMs <= nowMs) {
    return { inGracePeriod: false, gracePeriodEndsAt: graceIso, daysRemaining: 0 };
  }
  const daysRemaining = Math.max(1, Math.ceil((graceMs - nowMs) / (24 * 60 * 60 * 1000)));
  return {
    inGracePeriod: true,
    gracePeriodEndsAt: graceIso,
    daysRemaining,
  };
}

export function normalizeSubscriptionLifecycleState(
  sub?: Partial<SubscriptionRecord> | null,
  isPro: boolean = false,
  nowMs: number = Date.now()
): SubscriptionLifecycleState {
  const raw = sub?.status;
  if (raw === 'immediate_cancellation') return 'immediate_cancellation';
  if (raw === 'expired') return 'expired';
  if (raw === 'checkout_pending') return 'checkout_pending';
  if (raw === 'payment_authentication') return 'payment_authentication';

  const endMs = sub?.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : NaN;
  const grace = getGracePeriodInfo(sub, nowMs);

  if (raw === 'scheduled_cancellation' || raw === 'cancelled' || (sub?.cancelAtPeriodEnd && (sub?.paymentId || sub?.orderId))) {
    if (Number.isFinite(endMs) && endMs <= nowMs && !grace.inGracePeriod) {
      return 'expired';
    }
    return 'scheduled_cancellation';
  }

  if (raw === 'renewal') {
    if (Number.isFinite(endMs) && endMs <= nowMs && !grace.inGracePeriod) {
      return 'expired';
    }
    return 'renewal';
  }

  if (raw === 'active') {
    if (Number.isFinite(endMs) && endMs <= nowMs && !grace.inGracePeriod) {
      return 'expired';
    }
    return 'active';
  }

  if (grace.inGracePeriod) return 'active';
  if (isPro) return 'active';
  return 'free';
}

export function isEarlyBirdEligible(
  createdAt?: string | number | Date | null,
  fallbackNowMs: number = Date.now()
): boolean {
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    const ms =
      createdAt instanceof Date
        ? createdAt.getTime()
        : typeof createdAt === 'number'
          ? createdAt
          : Date.parse(String(createdAt));
    if (Number.isFinite(ms)) {
      return ms < EARLY_BIRD_PRO_DEADLINE_MS;
    }
  }
  return fallbackNowMs < EARLY_BIRD_PRO_DEADLINE_MS;
}

export function resolveEffectivePlan(params: {
  email?: string | null;
  storedPlan?: string | null;
  isProFlag?: boolean | null;
  createdAt?: string | number | Date | null;
  subscription?: Partial<SubscriptionRecord> | null;
  nowMs?: number;
}): { plan: 'free' | 'pro'; isPro: boolean; planSource: PlanSource } {
  const nowMs = params.nowMs ?? Date.now();

  if (isOwnerEmail(params.email)) {
    return { plan: 'pro', isPro: true, planSource: 'owner' };
  }

  const sub = params.subscription;
  if (sub?.status === 'immediate_cancellation') {
    return { plan: 'free', isPro: false, planSource: 'free' };
  }

  const subEndMs = sub?.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : NaN;
  const grace = getGracePeriodInfo(sub, nowMs);
  const hasPaidPeriodRemaining =
    sub?.status === 'active' ||
    sub?.status === 'renewal' ||
    ((sub?.status === 'scheduled_cancellation' || sub?.status === 'cancelled') &&
      Number.isFinite(subEndMs) &&
      subEndMs > nowMs) ||
    grace.inGracePeriod;

  // If paid active/renewal period has explicitly elapsed without grace period remaining, drop to expired -> free
  if (
    (sub?.status === 'active' || sub?.status === 'renewal') &&
    Number.isFinite(subEndMs) &&
    subEndMs <= nowMs &&
    !grace.inGracePeriod
  ) {
    return { plan: 'free', isPro: false, planSource: 'free' };
  }

  if (hasPaidPeriodRemaining) {
    if (sub?.paymentId || sub?.orderId || sub?.subscriptionId || grace.inGracePeriod || sub?.status === 'active' || sub?.status === 'renewal') {
      return { plan: 'pro', isPro: true, planSource: 'paid' };
    }
  }

  const explicitExpiredOrCancelled =
    sub?.status === 'expired' ||
    sub?.status === 'cancelled' ||
    sub?.status === 'scheduled_cancellation';

  if (explicitExpiredOrCancelled) {
    return { plan: 'free', isPro: false, planSource: 'free' };
  }

  if (isEarlyBirdEligible(params.createdAt, nowMs)) {
    return { plan: 'pro', isPro: true, planSource: 'early_bird' };
  }

  if (params.storedPlan === 'pro' || params.isProFlag === true) {
    return { plan: 'pro', isPro: true, planSource: 'paid' };
  }

  return { plan: 'free', isPro: false, planSource: 'free' };
}



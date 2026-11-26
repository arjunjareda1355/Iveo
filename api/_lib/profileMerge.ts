import type { SubscriptionRecord } from '../../src/lib/plan.ts';

export interface ProfileSaveInput {
  userId: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  avatarData?: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  vibeId?: string;
  buttonShape?: string | null;
  socials?: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  primaryEmail?: string | null;
  plan?: string;
  createdAt?: string | null;
  subscription?: Partial<SubscriptionRecord> | null;
  status?: 'active' | 'private' | 'unpublished' | 'deleted' | 'deleted_pending' | 'suspended';
  isPublished?: boolean;
  hideFooter?: boolean;
  hideFromSearch?: boolean;
  background?: any;
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
  whatsappNumber?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
  fontSettings?: any;
  buttonColors?: any;
  businessCard?: any;
  layoutSettings?: any;
  appearance?: any;
  deletedAt?: string | null;
  purgeAt?: string | null;
  updatedAt?: string | null;
}

export interface MergedProfileSave {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarData: string | null;
  avatarType: 'default' | 'uploaded';
  avatarId: string | null;
  vibeId: string;
  buttonShape: string | null;
  socials: Record<string, string>;
  socialsPosition: 'top' | 'bottom' | 'both';
  primaryEmail: string | null;
  plan: string;
  createdAt: string;
  subscription: SubscriptionRecord | null;
  status: 'active' | 'private' | 'unpublished' | 'deleted' | 'deleted_pending' | 'suspended';
  isPublished: boolean;
  hideFooter: boolean;
  hideFromSearch: boolean;
  background: any;
  googleAnalyticsId: string | null;
  metaPixelId: string | null;
  whatsappNumber: string | null;
  customSeoTitle: string | null;
  customSeoDescription: string | null;
  fontSettings: any;
  buttonColors: any;
  businessCard: any;
  layoutSettings: any;
  appearance: any;
  deletedAt: string | null;
  purgeAt: string | null;
  updatedAt: string;
}

export function isNewerTimestamp(candidate?: string | null, baseline?: string | null): boolean {
  if (!candidate) return false;
  if (!baseline) return true;
  const candMs = Date.parse(candidate);
  const baseMs = Date.parse(baseline);
  if (!Number.isNaN(candMs) && !Number.isNaN(baseMs)) {
    return candMs > baseMs;
  }
  return candidate > baseline;
}

export function isDeletedPurgeExpired(
  profile: { status?: string | null; purgeAt?: string | null } | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!profile || profile.status !== 'deleted_pending') return false;
  if (!profile.purgeAt) return false;
  const purgeMs = Date.parse(String(profile.purgeAt));
  return !Number.isNaN(purgeMs) && nowMs >= purgeMs;
}

/**
 * Selects the freshest profile without letting stale/cleared fields from an older copy leak back.
 */
export function selectFresherProfile<T extends Record<string, any>>(
  localProf: T | null | undefined,
  fbProf: T | null | undefined
): { profile: T | null; cameFromFirebase: boolean } {
  if (!localProf && !fbProf) return { profile: null, cameFromFirebase: false };
  if (!localProf && fbProf) return { profile: fbProf, cameFromFirebase: true };
  if (localProf && !fbProf) return { profile: localProf, cameFromFirebase: false };
  if (localProf && fbProf && isNewerTimestamp(fbProf.updatedAt, localProf.updatedAt)) {
    // Prefer the newer Firebase record cleanly while preserving essential identity metadata if absent
    return {
      profile: {
        ...fbProf,
        userId: fbProf.userId || localProf.userId,
        primaryEmail: fbProf.primaryEmail ?? localProf.primaryEmail ?? null,
        createdAt: fbProf.createdAt || localProf.createdAt || null,
        subscription: fbProf.subscription !== undefined ? fbProf.subscription : (localProf.subscription ?? null),
      },
      cameFromFirebase: true,
    };
  }
  return { profile: localProf || null, cameFromFirebase: false };
}

export function mergeProfileForSave(
  existing: Record<string, any> | null | undefined,
  incoming: ProfileSaveInput,
  isPrivilegedEmail: boolean
): MergedProfileSave {
  const cleanUsername = (incoming.username || '').replace(/^@+/, '').toLowerCase().trim();
  const prev = existing || {};

  const finalUserId =
    prev.userId && prev.userId !== 'owner'
      ? String(prev.userId)
      : incoming.userId || 'owner';

  const primaryEmail =
    incoming.primaryEmail !== undefined
      ? incoming.primaryEmail
      : (prev.primaryEmail ?? null);

  const createdAt: string =
    prev.createdAt ||
    prev.claimedAt ||
    incoming.createdAt ||
    new Date().toISOString();

  const mergedSubscription: SubscriptionRecord | null =
    incoming.subscription === null
      ? null
      : incoming.subscription
        ? {
            status: incoming.subscription.status || prev.subscription?.status || 'none',
            cycle: incoming.subscription.cycle !== undefined ? incoming.subscription.cycle : (prev.subscription?.cycle ?? null),
            startedAt: incoming.subscription.startedAt !== undefined ? incoming.subscription.startedAt : (prev.subscription?.startedAt ?? null),
            currentPeriodEnd:
              incoming.subscription.currentPeriodEnd !== undefined
                ? incoming.subscription.currentPeriodEnd
                : (prev.subscription?.currentPeriodEnd ?? null),
            cancelledAt: incoming.subscription.cancelledAt !== undefined ? incoming.subscription.cancelledAt : (prev.subscription?.cancelledAt ?? null),
            cancelAtPeriodEnd:
              incoming.subscription.cancelAtPeriodEnd !== undefined
                ? incoming.subscription.cancelAtPeriodEnd
                : (prev.subscription?.cancelAtPeriodEnd ?? false),
            paymentId: incoming.subscription.paymentId !== undefined ? incoming.subscription.paymentId : (prev.subscription?.paymentId ?? null),
            orderId: incoming.subscription.orderId !== undefined ? incoming.subscription.orderId : (prev.subscription?.orderId ?? null),
            amountInr: incoming.subscription.amountInr !== undefined ? incoming.subscription.amountInr : (prev.subscription?.amountInr ?? null),
            subscriptionId: incoming.subscription.subscriptionId !== undefined ? incoming.subscription.subscriptionId : (prev.subscription?.subscriptionId ?? null),
            customerId: incoming.subscription.customerId !== undefined ? incoming.subscription.customerId : (prev.subscription?.customerId ?? null),
            currency: incoming.subscription.currency !== undefined ? incoming.subscription.currency : (prev.subscription?.currency ?? null),
            amountMinor: incoming.subscription.amountMinor !== undefined ? incoming.subscription.amountMinor : (prev.subscription?.amountMinor ?? null),
            paymentMethodSummary: incoming.subscription.paymentMethodSummary !== undefined ? incoming.subscription.paymentMethodSummary : (prev.subscription?.paymentMethodSummary ?? null),
            currentPeriodStart: incoming.subscription.currentPeriodStart !== undefined ? incoming.subscription.currentPeriodStart : (prev.subscription?.currentPeriodStart ?? null),
            nextBillingAt: incoming.subscription.nextBillingAt !== undefined ? incoming.subscription.nextBillingAt : (prev.subscription?.nextBillingAt ?? null),
            gracePeriodEndsAt: incoming.subscription.gracePeriodEndsAt !== undefined ? incoming.subscription.gracePeriodEndsAt : (prev.subscription?.gracePeriodEndsAt ?? null),
            cancelReason: incoming.subscription.cancelReason !== undefined ? incoming.subscription.cancelReason : (prev.subscription?.cancelReason ?? null),
            lastPaymentFailedAt: incoming.subscription.lastPaymentFailedAt !== undefined ? incoming.subscription.lastPaymentFailedAt : (prev.subscription?.lastPaymentFailedAt ?? null),
            lastEventId: incoming.subscription.lastEventId !== undefined ? incoming.subscription.lastEventId : (prev.subscription?.lastEventId ?? null),
            updatedAt: incoming.subscription.updatedAt || new Date().toISOString(),
          }
        : (prev.subscription ?? null);

  const rawPlan =
    incoming.plan !== undefined ? incoming.plan : (prev.plan || 'free');
  const plan = isPrivilegedEmail || rawPlan === 'pro' ? 'pro' : 'free';

  const status: MergedProfileSave['status'] =
    incoming.status !== undefined
      ? incoming.status
      : incoming.isPublished === false
        ? 'unpublished'
        : incoming.isPublished === true
          ? 'active'
          : prev.status || (prev.isPublished === false ? 'unpublished' : 'active');

  const isPublished =
    incoming.isPublished !== undefined
      ? incoming.isPublished
      : status === 'active';

  const deletedAt: string | null =
    status === 'deleted_pending'
      ? (incoming.deletedAt !== undefined ? incoming.deletedAt : (prev.deletedAt ?? null))
      : incoming.deletedAt !== undefined
        ? incoming.deletedAt
        : null;

  const purgeAt: string | null =
    status === 'deleted_pending'
      ? (incoming.purgeAt !== undefined ? incoming.purgeAt : (prev.purgeAt ?? null))
      : incoming.purgeAt !== undefined
        ? incoming.purgeAt
        : null;

  const avatarUrl =
    incoming.avatarUrl !== undefined ? incoming.avatarUrl : (prev.avatarUrl ?? null);
  const avatarId =
    incoming.avatarId !== undefined ? incoming.avatarId : (prev.avatarId ?? null);
  const avatarType: 'default' | 'uploaded' =
    incoming.avatarType !== undefined
      ? incoming.avatarType
      : prev.avatarType || (avatarId ? 'default' : avatarUrl ? 'uploaded' : 'default');

  const clearedUploadedAvatar =
    incoming.avatarUrl !== undefined &&
    (!incoming.avatarUrl || (!incoming.avatarUrl.startsWith('/api/avatar/') && !incoming.avatarUrl.startsWith('data:image/')));

  const avatarData: string | null =
    incoming.avatarData !== undefined
      ? incoming.avatarData
      : clearedUploadedAvatar
        ? null
        : (prev.avatarData ?? null);

  return {
    userId: finalUserId,
    username: cleanUsername,
    displayName:
      incoming.displayName !== undefined
        ? incoming.displayName
        : prev.displayName || cleanUsername,
    bio: incoming.bio !== undefined ? incoming.bio : prev.bio || '',
    avatarUrl,
    avatarData,
    avatarType,
    avatarId,
    vibeId: incoming.vibeId !== undefined ? incoming.vibeId : prev.vibeId || 'clean',
    buttonShape:
      incoming.buttonShape !== undefined
        ? incoming.buttonShape
        : prev.buttonShape !== undefined
          ? prev.buttonShape
          : 'rounded',
    socials:
      incoming.socials !== undefined
        ? incoming.socials || {}
        : prev.socials || {},
    socialsPosition:
      incoming.socialsPosition !== undefined
        ? incoming.socialsPosition
        : prev.socialsPosition || 'top',
    primaryEmail,
    plan,
    createdAt,
    subscription: mergedSubscription,
    status,
    isPublished,
    hideFooter:
      incoming.hideFooter !== undefined
        ? Boolean(incoming.hideFooter)
        : Boolean(prev.hideFooter),
    hideFromSearch:
      incoming.hideFromSearch !== undefined
        ? Boolean(incoming.hideFromSearch)
        : Boolean(prev.hideFromSearch),
    background:
      incoming.background !== undefined
        ? (incoming.background === null ? null : (incoming.background && typeof incoming.background === 'object' ? incoming.background : null))
        : (prev.background ?? null),
    googleAnalyticsId:
      incoming.googleAnalyticsId !== undefined
        ? incoming.googleAnalyticsId
        : (prev.googleAnalyticsId ?? null),
    metaPixelId:
      incoming.metaPixelId !== undefined
        ? incoming.metaPixelId
        : (prev.metaPixelId ?? null),
    whatsappNumber:
      incoming.whatsappNumber !== undefined
        ? incoming.whatsappNumber
        : (prev.whatsappNumber ?? null),
    customSeoTitle:
      incoming.customSeoTitle !== undefined
        ? incoming.customSeoTitle
        : (prev.customSeoTitle ?? null),
    customSeoDescription:
      incoming.customSeoDescription !== undefined
        ? incoming.customSeoDescription
        : (prev.customSeoDescription ?? null),
    fontSettings:
      incoming.fontSettings !== undefined
        ? incoming.fontSettings
        : (prev.fontSettings ?? null),
    buttonColors:
      incoming.buttonColors !== undefined
        ? incoming.buttonColors
        : (prev.buttonColors ?? null),
    businessCard:
      incoming.businessCard !== undefined
        ? incoming.businessCard
        : (prev.businessCard ?? null),
    layoutSettings:
      incoming.layoutSettings !== undefined
        ? incoming.layoutSettings
        : (prev.layoutSettings ?? null),
    appearance:
      incoming.appearance !== undefined
        ? incoming.appearance
        : (prev.appearance ?? null),
    deletedAt,
    purgeAt,
    updatedAt: incoming.updatedAt || new Date().toISOString(),
  };
}

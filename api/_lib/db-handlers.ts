import type { Request as ExpressReq, Response as ExpressRes } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_DELETE_GRACE_DAYS,
  checkDatabaseReadiness,
  dbClaimUsername,
  dbGetProfileByUserId,
  dbVerifyOwnership,
  dbSaveProfile,
  dbGetProfile,
  dbSaveBlocks,
  dbGetBlocks,
  dbGetBlockSyncMeta,
  dbSaveContact,
  dbGetContacts,
  dbDeleteContact,
  dbDeleteAllContacts,
  dbSoftDeleteAccount,
  dbReactivateAccount,
  dbPurgeAccountPermanently,
  dbSetLinkPassword,
  dbClearLinkPassword,
  dbVerifyLinkPassword,
  dbFindBlockForUnlock,
  dbGetProtectedLinkIds,
  dbRecordAnalyticsEvent,
  dbGetAnalytics,
  dbGetRedirectTarget,
  dbReadAppearanceState,
  dbWriteAppearanceState,
} from './azureSql.ts';
import { normalizeAnalyticsSource } from '../../src/lib/analytics/sources.ts';
import { detectDevice } from '../../src/lib/analytics/device.ts';
import {
  saveUploadedBackgroundImage,
  resolveBackgroundFilePath,
  deleteUserUploadedBackgrounds,
  pruneOrphanedUserBackgrounds,
} from './backgroundUpload.ts';
import { cleanupUnreferencedUserCardBanners } from './cardBannerUpload.ts';
import {
  collectReferencedCardBannerUrls,
  sanitizeEmbedMetaBannerForSave,
} from '../../src/lib/cardBanner.ts';
import {
  DEFAULT_BACKGROUND_CONFIG,
  parseBackgroundConfig,
} from '../../src/lib/preferences.ts';
import { isAllowedAvatarHost } from './publicPage.ts';
import { isDeletedPurgeExpired, selectFresherProfile } from './profileMerge.ts';
import { RESERVED, isPrivilegedEmailServer } from './usernames.ts';
import { getCanonicalSiteOrigin, getSiteOrigin } from './env.ts';
import {
  FirebasePersistError,
  firebaseIsUsernameClaimed,
  firebaseGetProfile,
  firebaseGetProfileByUserId,
  firebaseGetBlocks,
  firebaseGetContacts,
  firebaseDeleteContact,
  firebaseDeleteAllContacts,
  firebaseMigrateUsernameData,
  firebaseSaveProfile,
  firebaseSaveBlocks,
  firebaseSaveContact,
  firebaseSaveRedirect,
  firebaseReleaseUsername,
  firebaseSoftDeleteAccount,
  firebaseReactivateAccount,
  firebasePurgeAccountPermanently,
  firebaseSaveAppearanceState,
} from './firebaseServer.ts';
import { verifyClerkRequest } from './clerkAuth.ts';
import { fetchBuyMeACoffeeProfile } from './buymeacoffee.ts';
import {
  buildYouTubeOAuthUrl,
  exchangeYouTubeOAuthCode,
  fetchYouTubeShowcase,
} from './youtube.ts';
import {
  evaluateProfileIndexability,
  getAllUnifiedProfiles,
  getSeoHealthReport,
  isSyntheticTestHandle,
  notifyProfileSeoChanged,
  regenerateAndPingSitemap,
  validateProfileSeo,
} from './seoService.ts';
import {
  clearGscRuntimeConfig,
  getGscSafeConfigSummary,
  inspectUrlWithGsc,
  saveGscRuntimeConfig,
  testGscConnection,
} from './searchEngines.ts';
import {
  EARLY_BIRD_PRO_DEADLINE_ISO,
  resolveEffectivePlan,
  type SubscriptionRecord,
} from '../../src/lib/plan.ts';
import {
  adminInspectBilling,
  adminReconcileBilling,
  cancelBillingSubscription,
  getBillingSnapshot,
  getVerifiedInvoice,
  reactivateBillingSubscription,
  switchBillingCycle,
} from './billingService.ts';
import {
  buildSocialOAuthUrl,
  checkBlockRefreshCooldown,
  checkEmbedLookupRateLimit,
  exchangeSocialOAuthCode,
  fetchPinterestAccountFromToken,
  fetchSocialEmbedMetadata,
  fetchUniversalSocialLinkMetadata,
  getOAuthAvailability,
  isPinterestOAuthEnabled,
  isValidSocialOAuthProvider,
  extractProviderFromOAuthState,
  validateExternalFetchUrl,
} from './socialIntegrations.ts';
import {
  consumeOAuthRedirectResult,
  consumeOAuthState,
  sanitizeOAuthReturnTo,
  storeOAuthRedirectResult,
} from './oauthStateStore.ts';
import { redactSecrets } from './serverConfig.ts';
import {
  BlueskyProxyError,
  checkBlueskyRateLimit,
  getBlueskyFeed,
  getBlueskyProfile,
  getBlueskySinglePost,
} from './bluesky.ts';

function getBlueskyClientIp(req: ExpressReq): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.ip || req.socket?.remoteAddress || 'anon');
}

export async function handleBlueskyProfile(req: ExpressReq, res: ExpressRes) {
  const rate = checkBlueskyRateLimit(getBlueskyClientIp(req));
  if (!rate.allowed) {
    if (rate.retryAfterSec) res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({ error: 'rate_limited', message: 'Bluesky is slow right now, try again' });
  }
  const actor = typeof req.query.actor === 'string' ? req.query.actor.trim() : '';
  if (!actor) {
    return res.status(400).json({ error: 'missing_actor', message: 'Enter a Bluesky handle or profile link.' });
  }
  try {
    const profile = await getBlueskyProfile(actor);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=900, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, profile });
  } catch (err: any) {
    const status = err instanceof BlueskyProxyError ? err.status : 502;
    return res.status(status).json({
      ok: false,
      error: err?.code || 'bluesky_error',
      message: err?.message || 'Bluesky is slow right now, try again',
    });
  }
}

export async function handleBlueskyFeed(req: ExpressReq, res: ExpressRes) {
  const rate = checkBlueskyRateLimit(getBlueskyClientIp(req));
  if (!rate.allowed) {
    if (rate.retryAfterSec) res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({ error: 'rate_limited', message: 'Bluesky is slow right now, try again' });
  }
  const actor = typeof req.query.actor === 'string' ? req.query.actor.trim() : '';
  if (!actor) {
    return res.status(400).json({ error: 'missing_actor', message: 'Enter a Bluesky handle or profile link.' });
  }
  const limit = Number(req.query.limit || 3);
  const filter = typeof req.query.filter === 'string' ? req.query.filter.trim() : 'posts_no_replies';
  const includeReposts = req.query.reposts === '1' || req.query.reposts === 'true';

  try {
    const feed = await getBlueskyFeed({ actor, limit, filter, includeReposts });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, ...feed });
  } catch (err: any) {
    const status = err instanceof BlueskyProxyError ? err.status : 502;
    return res.status(status).json({
      ok: false,
      error: err?.code || 'bluesky_error',
      message: err?.message || 'Bluesky is slow right now, try again',
    });
  }
}

export async function handleBlueskyPost(req: ExpressReq, res: ExpressRes) {
  const rate = checkBlueskyRateLimit(getBlueskyClientIp(req));
  if (!rate.allowed) {
    if (rate.retryAfterSec) res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({ error: 'rate_limited', message: 'Bluesky is slow right now, try again' });
  }
  const uri = typeof req.query.uri === 'string' ? req.query.uri.trim() : '';
  if (!uri) {
    return res.status(400).json({ error: 'missing_uri', message: 'Paste a bsky.app post link or at:// URI.' });
  }
  try {
    const data = await getBlueskySinglePost(uri);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, ...data });
  } catch (err: any) {
    const status = err instanceof BlueskyProxyError ? err.status : 502;
    return res.status(status).json({
      ok: false,
      error: err?.code || 'bluesky_error',
      message: err?.message || 'Bluesky is slow right now, try again',
    });
  }
}

/**
 * GET /api/db/readiness
 * Secure readiness diagnostic for Azure SQL and backend persistence
 */
export async function handleDbReadiness(_req: ExpressReq, res: ExpressRes) {
  try {
    const result = await checkDatabaseReadiness();
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      status: 'error',
      error: err?.message || 'Readiness check failed',
    });
  }
}

interface CachedPublicPageEntry {
  status: number;
  payload: Record<string, any>;
  expiresAt: number;
}

const PUBLIC_PAGE_CACHE_TTL_MS = 20_000;
const DISCOVER_CACHE_TTL_MS = 30_000;
const FIREBASE_TIMEOUT_MS = 6_000;
const publicPageCache = new Map<string, CachedPublicPageEntry>();
const discoverCache = new Map<string, { payload: Record<string, any>; expiresAt: number }>();

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = FIREBASE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.catch(() => fallback),
    timeoutPromise,
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function awaitFirebaseWrite<T>(
  promise: Promise<T>,
  operation: string,
  ms = FIREBASE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new FirebasePersistError(operation, new Error(`Timed out after ${ms}ms`)));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sendMutationError(res: ExpressRes, err: unknown, fallbackCode: string) {
  if (err instanceof FirebasePersistError) {
    return res.status(502).json({
      ok: false,
      error: 'firebase_sync_failed',
      message: err.message,
    });
  }
  const msg = err instanceof Error ? err.message : String(err || 'Operation failed');
  return res.status(500).json({ ok: false, error: fallbackCode, message: msg });
}

export function invalidatePublicPageCache(username?: string | null) {
  if (username) {
    publicPageCache.delete(username.replace(/^@+/, '').toLowerCase().trim());
  } else {
    publicPageCache.clear();
  }
  discoverCache.clear();
}

/**
 * GET /api/public-page?u=username
 * Returns public page data for any browser / visitor
 */
export async function handleGetPublicPage(req: ExpressReq, res: ExpressRes) {
  let raw = ((req.query.u || req.query.username) as string) || '';

  // If not provided in query param, extract from Host header subdomain
  if (!raw) {
    const host = (req.headers.host || req.hostname || '').toLowerCase().split(':')[0];
    if (host.endsWith('.iveo.site')) {
      const sub = host.slice(0, -'.iveo.site'.length);
      if (sub && !RESERVED.has(sub)) {
        raw = sub;
      }
    } else if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      if (sub && !RESERVED.has(sub)) {
        raw = sub;
      }
    }
  }

  const clean = raw.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) {
    return res.status(400).json({ error: 'missing_username' });
  }

  const bypassCache = Boolean(
    req.query?._t ||
    String(req.headers['cache-control'] || '').toLowerCase().includes('no-cache')
  );
  const cached = !bypassCache ? publicPageCache.get(clean) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(cached.status).json(cached.payload);
  }

  try {
    // Query local SQL/isolated profile & blocks in parallel with bounded Firebase profile check
    let fbTimedOut = false;
    const [dbProf, dbBlocksInitial, fbProf] = await Promise.all([
      dbGetProfile(clean).catch(() => null),
      dbGetBlocks(clean).catch(() => []),
      Promise.race([
        firebaseGetProfile(clean).catch(() => null),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            fbTimedOut = true;
            resolve(null);
          }, FIREBASE_TIMEOUT_MS)
        ),
      ]),
    ]);

    const merged = selectFresherProfile(dbProf, fbProf);
    let profile = merged.profile;
    const cameFromFirebase = merged.cameFromFirebase;

    if (!profile) {
      const redirectTo = await dbGetRedirectTarget(clean).catch(() => null);
      if (redirectTo && redirectTo !== clean) {
        return res.status(200).json({ profile: null, links: [], redirectTo });
      }
      if (!fbTimedOut) {
        publicPageCache.set(clean, {
          status: 404,
          payload: { error: 'not_found', confirmed: true },
          expiresAt: Date.now() + 1_500,
        });
      }
      return res.status(404).json({ error: 'not_found', confirmed: !fbTimedOut });
    }

    const effectiveStatus = profile.status || (profile.isPublished === false ? 'unpublished' : 'active');
    if (
      effectiveStatus === 'deleted' ||
      effectiveStatus === 'deleted_pending' ||
      effectiveStatus === 'suspended' ||
      effectiveStatus === 'private' ||
      effectiveStatus === 'unpublished'
    ) {
      if (effectiveStatus === 'deleted_pending' && isDeletedPurgeExpired(profile)) {
        dbPurgeAccountPermanently(clean, profile.userId, profile.primaryEmail).catch(() => {});
        firebasePurgeAccountPermanently(clean, profile.userId).catch(() => {});
      }
      const terminal = effectiveStatus === 'deleted' || effectiveStatus === 'deleted_pending';
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return res.status(404).json({ error: 'not_found', status: effectiveStatus, confirmed: terminal });
    }

    if (cameFromFirebase && !dbProf && profile.username) {
      dbSaveProfile({ ...profile, username: clean }).catch(() => {});
    }

    let allBlocks = dbBlocksInitial;
    const syncMeta = await dbGetBlockSyncMeta(clean).catch(() => ({
      blocksInitialized: false,
      deletedBlockIds: new Set<string>(),
    }));
    const shouldTryFirebaseBlocks =
      cameFromFirebase ||
      (!syncMeta.blocksInitialized && (!allBlocks || allBlocks.length === 0));
    if (shouldTryFirebaseBlocks) {
      const fbBlocks = await withTimeout(firebaseGetBlocks(clean, profile.userId), [] as any[]);
      const filteredFb = (fbBlocks || []).filter(
        (b) => cameFromFirebase || !syncMeta.deletedBlockIds.has(String(b?.id || ''))
      );
      if (cameFromFirebase && (filteredFb.length > 0 || (fbProf?.blocksInitialized && (!dbBlocksInitial || dbBlocksInitial.length === 0)))) {
        allBlocks = filteredFb;
        dbSaveBlocks(clean, filteredFb, profile.userId, profile.primaryEmail).catch(() => {});
      } else if (filteredFb.length > 0 && (!allBlocks || allBlocks.length === 0)) {
        allBlocks = filteredFb;
        if (!dbBlocksInitial || dbBlocksInitial.length === 0) {
          dbSaveBlocks(clean, filteredFb, profile.userId, profile.primaryEmail).catch(() => {});
        }
      }
    }
    const protectedIdsSet = new Set(await dbGetProtectedLinkIds(clean).catch(() => []));
    allBlocks = allBlocks.map((b) =>
      protectedIdsSet.has(String(b.id)) && !b.isProtected ? { ...b, isProtected: true } : b
    );
    const now = new Date();

    // Map public blocks (strip URLs from protected links until unlocked)
    const filteredBlocks = allBlocks
      .filter((b) => {
        if (b.isActive === false || b.isArchived) return false;
        if (b.startAt && new Date(b.startAt) > now) return false;
        if (b.endAt && new Date(b.endAt) <= now) return false;
        return true;
      })
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        title: b.title || '',
        url: b.isProtected ? null : (b.url || null),
        icon: b.icon || null,
        thumbnailPath: b.thumbnailPath || null,
        thumbnailUrl: b.thumbnailUrl || null,
        layout: b.layout || 'classic',
        embedProvider: b.embedProvider || null,
        embedMeta: b.embedMeta || null,
        isProtected: Boolean(b.isProtected),
        signup: b.signup || null,
        tipJar: b.tipJar || null,
        coffee: b.coffee || null,
        faq: b.faq || null,
        vcard: b.vcard || null,
        animation: b.animation || null,
        badge: b.badge || null,
        youtube: b.youtube || null,
        product: b.product || null,
        booking: b.booking || null,
        countdown: b.countdown || null,
        promo: b.promo || null,
        location: b.location || null,
        download: b.download || null,
        bluesky: b.bluesky || null,
      }));

    const resolvedPlan = resolveEffectivePlan({
      email: profile.primaryEmail,
      storedPlan: profile.plan,
      isProFlag: profile.isPro,
      createdAt: profile.createdAt || profile.claimedAt || null,
      subscription: profile.subscription || null,
    });
    const isPro = resolvedPlan.isPro;
    const rawAvatar = isAllowedAvatarHost(profile.avatarUrl) ? profile.avatarUrl : null;
    const resolvedAvatarUrl =
      rawAvatar || (profile.avatarData ? `/api/avatar/${encodeURIComponent(clean)}` : null);

    const responsePayload = {
      profile: {
        username: profile.username,
        displayName: profile.displayName || profile.username,
        bio: profile.bio || '',
        avatarUrl: resolvedAvatarUrl,
        avatarType: profile.avatarType || (profile.avatarId ? 'default' : (resolvedAvatarUrl ? 'uploaded' : 'default')),
        avatarId: profile.avatarId || null,
        vibeId: profile.vibeId || 'clean',
        plan: resolvedPlan.plan,
        isPro,
        planSource: resolvedPlan.planSource,
        isVerified: isPro,
        isOwnerProfile: isPrivilegedEmailServer(profile.primaryEmail),
        buttonShape: profile.buttonShape ?? null,
        socials: profile.socials || {},
        socialsPosition: profile.socialsPosition || 'top',
        hideFromSearch: Boolean(profile.hideFromSearch),
        hideFooter: Boolean(profile.hideFooter),
        background: parseBackgroundConfig(profile.background) || { ...DEFAULT_BACKGROUND_CONFIG },
        googleAnalyticsId: profile.googleAnalyticsId || null,
        metaPixelId: profile.metaPixelId || null,
        whatsappNumber: profile.whatsappNumber || null,
        customSeoTitle: profile.customSeoTitle || null,
        customSeoDescription: profile.customSeoDescription || null,
        fontSettings: profile.fontSettings || null,
        buttonColors: profile.buttonColors || null,
        businessCard: profile.businessCard || null,
        layoutSettings: profile.layoutSettings || null,
        appearance: profile.appearance || null,
        updatedAt: profile.updatedAt || null,
      },
      links: filteredBlocks,
    };

    publicPageCache.set(clean, {
      status: 200,
      payload: responsePayload,
      expiresAt: Date.now() + PUBLIC_PAGE_CACHE_TTL_MS,
    });
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(200).json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({ error: 'server_error', message: err?.message });
  }
}

/**
 * POST /api/claim-username
 * Atomically validates, reserves, and claims a username in the database
 */
export async function handleClaimUsername(req: ExpressReq, res: ExpressRes) {
  const clerkAuth = await verifyClerkRequest(req);
  if (clerkAuth.enforced && !clerkAuth.verifiedByJwt) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in to claim an address.' });
  }

  const body = req.body || {};
  const userId = (clerkAuth.verifiedByJwt && clerkAuth.userId
    ? clerkAuth.userId
    : (body.userId as string || req.headers['x-user-id'] as string || '')).trim();
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const previousUsernameHint = (body.previousUsername as string || '').replace(/^@+/, '').toLowerCase().trim() || null;
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;
  const profileData = body.profile || body.profileData || body;

  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in to claim an address.' });
  }

  if (!username) {
    return res.status(400).json({ error: 'missing_username', message: 'Username is required.' });
  }

  try {
    // Check Firebase Cloud claims first so cross-instance usernames cannot be double-claimed
    try {
      const fbClaim = await withTimeout(
        firebaseIsUsernameClaimed(username, userId),
        { claimed: false }
      );
      if (fbClaim.claimed && !fbClaim.isOwn && !isPrivilegedEmailServer(primaryEmail)) {
        return res.status(409).json({
          ok: false,
          error: 'already_claimed',
          message: `iveo.site/@${username} is already claimed by another creator. Please pick another address.`,
        });
      }
    } catch {
      return res.status(503).json({
        ok: false,
        error: 'check_failed',
        message: 'Could not verify username availability right now. Please try again.',
      });
    }

    const result = await dbClaimUsername(userId, username, profileData, primaryEmail, previousUsernameHint);
    if (!result.ok) {
      const statusCode = result.error === 'already_claimed' ? 409 : 400;
      return res.status(statusCode).json({
        ok: false,
        error: result.error,
        message: result.message || 'That address is unavailable.',
      });
    }

    const releasedOld = result.previousUsername || (previousUsernameHint && previousUsernameHint !== result.username ? previousUsernameHint : null);

    if (result.username) {
      if (releasedOld) {
        await awaitFirebaseWrite(firebaseMigrateUsernameData(releasedOld, result.username, userId), 'migrateUsernameData');
        await awaitFirebaseWrite(firebaseSaveRedirect(releasedOld, result.username), 'saveRedirect');
        await awaitFirebaseWrite(firebaseReleaseUsername(releasedOld, userId), 'releaseUsername');
      }
      const claimCreatedAt = profileData?.createdAt || new Date().toISOString();
      const resolvedClaimPlan = resolveEffectivePlan({
        email: primaryEmail,
        storedPlan: profileData?.plan,
        createdAt: claimCreatedAt,
        subscription: profileData?.subscription,
      });
      await awaitFirebaseWrite(
        firebaseSaveProfile(
          result.username,
          {
            ...(profileData || {}),
            createdAt: claimCreatedAt,
            primaryEmail,
            plan: resolvedClaimPlan.plan,
          },
          userId
        ),
        'saveProfile'
      );

      notifyProfileSeoChanged(releasedOld ? 'renamed' : 'created', result.username, releasedOld).catch(() => {});
      invalidatePublicPageCache(result.username);
      if (releasedOld) invalidatePublicPageCache(releasedOld);
    }

    return res.status(200).json({
      ok: true,
      username: result.username,
      releasedUsername: releasedOld,
      profileUrl: result.profileUrl,
      message: `iveo.site/@${result.username} successfully claimed!`,
    });
  } catch (err: any) {
    return sendMutationError(res, err, 'claim_failed');
  }
}

/**
 * GET /api/me
 * Retrieves user's claimed username and settings across any browser/device
 */
export async function handleGetMe(req: ExpressReq, res: ExpressRes) {
  const userId = (req.query.userId as string || req.headers['x-user-id'] as string || '').trim();
  const email = (req.query.email as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!userId && !email) {
    return res.status(400).json({ error: 'missing_user_id', message: 'User identifier required.' });
  }

  try {
    const [dbProf, fbProf] = await Promise.all([
      dbGetProfileByUserId(userId, email).catch(() => null),
      withTimeout(firebaseGetProfileByUserId(userId, email, { includePendingDelete: true }), null),
    ]);

    const merged = selectFresherProfile(dbProf, fbProf);
    let profile = merged.profile;
    const cameFromFirebase = merged.cameFromFirebase;

    if (!profile || profile.status === 'deleted') {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return res.status(200).json({ ok: true, claimed: false });
    }

    let cleanUname = String(profile.username || '').replace(/^@+/, '').toLowerCase().trim();
    let reactivated = false;

    if (profile.status === 'deleted_pending') {
      if (isDeletedPurgeExpired(profile)) {
        if (cleanUname) {
          await Promise.all([
            dbPurgeAccountPermanently(cleanUname, profile.userId || userId, profile.primaryEmail || email).catch(() => {}),
            withTimeout(firebasePurgeAccountPermanently(cleanUname, profile.userId || userId), undefined),
          ]);
          invalidatePublicPageCache(cleanUname);
        }
        res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return res.status(200).json({ ok: true, claimed: false, purgedExpired: true });
      }

      if (cleanUname) {
        const [restoredDb] = await Promise.all([
          dbReactivateAccount(cleanUname, profile.userId || userId).catch(() => ({ ok: false, profile: null })),
          withTimeout(firebaseReactivateAccount(cleanUname, profile.userId || userId), undefined),
        ]);
        profile = {
          ...profile,
          ...(restoredDb?.profile || {}),
          status: 'active',
          isPublished: true,
          hideFromSearch: false,
          deletedAt: null,
          purgeAt: null,
        };
        reactivated = true;
        invalidatePublicPageCache(cleanUname);
        notifyProfileSeoChanged('created', cleanUname).catch(() => {});
      }
    }

    const createdAt = profile.createdAt || profile.claimedAt || null;
    const resolvedPlan = resolveEffectivePlan({
      email: email || profile.primaryEmail,
      storedPlan: profile.plan,
      isProFlag: profile.isPro,
      createdAt,
      subscription: profile.subscription || null,
    });
    cleanUname = String(profile.username || '').replace(/^@+/, '').toLowerCase().trim();
    const resolvedAvatarUrl =
      profile.avatarUrl || (profile.avatarData && cleanUname ? `/api/avatar/${encodeURIComponent(cleanUname)}` : null);
    const { avatarData: _omittedAvatarData, ...profileWithoutRawData } = profile;
    profile = {
      ...profileWithoutRawData,
      username: cleanUname || profile.username,
      avatarUrl: resolvedAvatarUrl,
      plan: resolvedPlan.plan,
      isPro: resolvedPlan.isPro,
      planSource: resolvedPlan.planSource,
      createdAt,
      subscription: profile.subscription || null,
      isVerified: resolvedPlan.isPro,
    };

    let blocks = await dbGetBlocks(profile.username);
    const syncMeta = await dbGetBlockSyncMeta(profile.username).catch(() => ({
      blocksInitialized: false,
      deletedBlockIds: new Set<string>(),
    }));
    if (!syncMeta.blocksInitialized && (cameFromFirebase || !blocks || blocks.length === 0)) {
      const fbBlocks = await withTimeout(firebaseGetBlocks(profile.username, profile.userId), [] as any[]);
      const filteredFb = (fbBlocks || []).filter(
        (b) => !syncMeta.deletedBlockIds.has(String(b?.id || ''))
      );
      if (filteredFb.length > 0 && (!blocks || blocks.length === 0 || cameFromFirebase)) {
        blocks = filteredFb;
      }
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return res.status(200).json({
      ok: true,
      claimed: true,
      reactivated,
      username: profile.username,
      profile,
      blocks,
      updatedAt: profile.updatedAt || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'fetch_failed', message: err?.message });
  }
}

/**
 * POST /api/migrate-legacy
 * Safely migrates legacy local storage data into centralized database
 */
export async function handleMigrateLegacy(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const userId = (body.userId as string || '').trim();
  const username = (body.username as string || '').toLowerCase().trim();
  const primaryEmail = (body.primaryEmail as string || '').toLowerCase().trim() || null;
  const profileData = body.profile || {};
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];

  if (!userId || !username) {
    return res.status(400).json({ error: 'invalid_migration_payload' });
  }

  try {
    // Check if username can be claimed / already owned
    const claimRes = await dbClaimUsername(userId, username, profileData, primaryEmail);
    if (!claimRes.ok && claimRes.error === 'already_claimed') {
      return res.status(409).json({ ok: false, error: 'already_claimed' });
    }

    if (blocks.length > 0) {
      await dbSaveBlocks(username, blocks, userId, primaryEmail);
    }

    return res.status(200).json({ ok: true, migrated: true, username });
  } catch (err: any) {
    return res.status(500).json({ error: 'migration_failed', message: err?.message });
  }
}

/**
 * POST /api/profile
 * Saves or updates profile in database with server-side ownership verification
 */
export async function handleSaveProfile(req: ExpressReq, res: ExpressRes) {
  const clerkAuth = await verifyClerkRequest(req);
  if (clerkAuth.enforced && !clerkAuth.verifiedByJwt) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid session required to save profile.' });
  }

  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }
  const actorUserId = (clerkAuth.verifiedByJwt && clerkAuth.userId
    ? clerkAuth.userId
    : (body.userId || req.headers['x-user-id'] as string || 'owner')).trim();

  try {
    const existing = await dbGetProfile(username).catch(() => null);
    const resolvedEmail = body.primaryEmail || existing?.primaryEmail || req.headers['x-user-email'] as string || null;
    const resolvedPlanInfo = resolveEffectivePlan({
      email: resolvedEmail,
      storedPlan: body.plan ?? existing?.plan,
      createdAt: body.createdAt ?? existing?.createdAt ?? null,
      subscription: body.subscription !== undefined ? body.subscription : existing?.subscription,
    });
    const resolvedPlan = resolvedPlanInfo.plan;
    const saveResult = await dbSaveProfile({
      userId: actorUserId,
      username,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      avatarType: body.avatarType,
      avatarId: body.avatarId,
      vibeId: body.vibeId,
      buttonShape: body.buttonShape,
      socials: body.socials,
      socialsPosition: body.socialsPosition,
      primaryEmail: resolvedEmail,
      plan: resolvedPlan,
      createdAt: body.createdAt,
      subscription: body.subscription,
      status: body.status,
      isPublished: body.isPublished,
      hideFooter: body.hideFooter,
      hideFromSearch: body.hideFromSearch,
      background:
        body.background === undefined
          ? undefined
          : body.background === null
            ? null
            : parseBackgroundConfig(body.background) || { ...DEFAULT_BACKGROUND_CONFIG },
      googleAnalyticsId: body.googleAnalyticsId,
      metaPixelId: body.metaPixelId,
      whatsappNumber: body.whatsappNumber,
      customSeoTitle: body.customSeoTitle,
      customSeoDescription: body.customSeoDescription,
      fontSettings: body.fontSettings,
      buttonColors: body.buttonColors,
      businessCard: body.businessCard,
      layoutSettings: body.layoutSettings,
      appearance: body.appearance,
    });

    if (saveResult && !saveResult.ok) {
      if (saveResult.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to edit this page.' });
      }
      return res.status(400).json({ error: saveResult.error });
    }

    const savedAt = saveResult?.updatedAt || new Date().toISOString();
    const firebasePayload = saveResult?.profile || {
      ...body,
      primaryEmail: resolvedEmail,
      plan: resolvedPlan,
      updatedAt: savedAt,
    };

    await awaitFirebaseWrite(
      firebaseSaveProfile(username, firebasePayload, actorUserId),
      'saveProfile'
    );

    if (body.background !== undefined) {
      try {
        const keepUrls = new Set<string>();
        const savedBg = parseBackgroundConfig(firebasePayload.background ?? body.background);
        if (savedBg && 'imageUrl' in savedBg && typeof savedBg.imageUrl === 'string' && savedBg.imageUrl) {
          keepUrls.add(savedBg.imageUrl);
        }
        const appRef = firebasePayload.appearance || existing?.appearance;
        if (appRef?.background?.type === 'image' && appRef.background.assetId) {
          keepUrls.add(appRef.background.assetId);
        }
        const appState = await dbReadAppearanceState(username).catch(() => null);
        if (appState?.themes) {
          for (const t of appState.themes) {
            if (t?.data?.background?.type === 'image' && t.data.background.assetId) {
              keepUrls.add(t.data.background.assetId);
            }
          }
        }
        pruneOrphanedUserBackgrounds(username, Array.from(keepUrls));
      } catch {}
    }

    notifyProfileSeoChanged('updated', username).catch(() => {});
    invalidatePublicPageCache(username);

    return res.status(200).json({
      ok: true,
      plan: resolvedPlan,
      isPro: resolvedPlanInfo.isPro,
      planSource: resolvedPlanInfo.planSource,
      updatedAt: savedAt,
    });
  } catch (err: any) {
    return sendMutationError(res, err, 'save_failed');
  }
}

const AVATAR_DIR = path.resolve(process.cwd(), 'data', 'avatars');

/**
 * POST /api/avatar
 * Securely uploads and stores user avatar on server disk + durable DB/Firestore fallback
 */
export async function handleUploadAvatar(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const dataUrl = body.dataUrl as string;
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username || !/^[a-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ error: 'missing_username' });
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'missing_data_url' });
  }

  try {
    // Verify ownership before overwriting avatar
    const existing = await dbGetProfile(username);
    if (existing) {
      const authorized = await dbVerifyOwnership(username, userId || existing.userId, primaryEmail || existing.primaryEmail);
      if (!authorized) {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to update this avatar.' });
      }
    }

    const matches = dataUrl.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'invalid_data_url' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 300_000) {
      return res.status(400).json({ error: 'avatar_too_large', message: 'Please upload a smaller image (under 300 KB).' });
    }

    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }

    const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
    fs.writeFileSync(avatarFile, buffer);

    const avatarUrl = `/api/avatar/${username}?v=${Date.now()}`;

    // Update in database + durable avatarData fallback immediately while preserving existing fields
    const updatedAvatarProfile = {
      userId: userId || existing?.userId || 'owner',
      username,
      displayName: existing?.displayName || username,
      bio: existing?.bio || '',
      avatarUrl,
      avatarData: dataUrl,
      avatarType: 'uploaded' as const,
      avatarId: null,
      vibeId: existing?.vibeId || 'clean',
      buttonShape: existing?.buttonShape ?? null,
      socials: existing?.socials || {},
      socialsPosition: (existing?.socialsPosition || 'top') as 'top' | 'bottom' | 'both',
      primaryEmail: primaryEmail || existing?.primaryEmail || null,
      plan: isPrivilegedEmailServer(primaryEmail || existing?.primaryEmail) ? 'pro' : (existing?.plan || 'free'),
      hideFooter: existing?.hideFooter,
      hideFromSearch: existing?.hideFromSearch,
      background: existing?.background ?? null,
      googleAnalyticsId: existing?.googleAnalyticsId ?? null,
      metaPixelId: existing?.metaPixelId ?? null,
      whatsappNumber: existing?.whatsappNumber ?? null,
      customSeoTitle: existing?.customSeoTitle ?? null,
      customSeoDescription: existing?.customSeoDescription ?? null,
      fontSettings: existing?.fontSettings ?? null,
      buttonColors: existing?.buttonColors ?? null,
      businessCard: existing?.businessCard ?? null,
      layoutSettings: existing?.layoutSettings ?? null,
      appearance: existing?.appearance ?? null,
    };
    await dbSaveProfile(updatedAvatarProfile);
    await awaitFirebaseWrite(
      firebaseSaveProfile(username, updatedAvatarProfile, updatedAvatarProfile.userId),
      'saveProfile'
    );

    invalidatePublicPageCache(username);
    notifyProfileSeoChanged('updated', username).catch(() => {});
    return res.status(200).json({ ok: true, avatarUrl, avatarType: 'uploaded', avatarId: null });
  } catch (err: any) {
    return sendMutationError(res, err, 'upload_failed');
  }
}

/**
 * GET /api/avatar/:username
 * Serves user avatar image with disk cache and durable DB/Firestore avatarData fallback
 */
export async function handleServeAvatar(req: ExpressReq, res: ExpressRes) {
  const username = (req.params.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username || !/^[a-z0-9._-]+$/.test(username)) {
    return res.status(400).end();
  }

  const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
  if (fs.existsSync(avatarFile)) {
    const stats = fs.statSync(avatarFile);
    const etag = `"${Math.floor(stats.mtimeMs).toString(36)}-${stats.size.toString(36)}"`;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=86400');
    res.setHeader('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    return res.sendFile(avatarFile);
  }

  // Fallback to durable avatarData stored in DB/Firestore when container disk is ephemeral
  try {
    let prof = await dbGetProfile(username).catch(() => null);
    if (!prof?.avatarData) {
      prof = await withTimeout(firebaseGetProfile(username), null);
    }
    if (prof?.avatarData && typeof prof.avatarData === 'string') {
      const matches = prof.avatarData.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
      if (matches && matches.length === 3) {
        const mime = matches[1].toLowerCase();
        const buffer = Buffer.from(matches[2], 'base64');
        try {
          if (!fs.existsSync(AVATAR_DIR)) {
            fs.mkdirSync(AVATAR_DIR, { recursive: true });
          }
          fs.writeFileSync(avatarFile, buffer);
        } catch {}
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=86400');
        return res.status(200).send(buffer);
      }
    }
  } catch {}

  return res.status(404).end();
}

/**
 * POST /api/background/upload
 * Validates & stores custom uploaded background image (PNG/JPG/WebP/AVIF <= 5MB)
 */
export async function handleUploadBackground(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const dataUrl = body.dataUrl as string;
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_data_url' });
  }

  try {
    const existing = await dbGetProfile(username).catch(() => null);
    if (existing) {
      const authorized = await dbVerifyOwnership(username, userId || existing.userId, primaryEmail || existing.primaryEmail);
      if (!authorized) {
        return res.status(403).json({ ok: false, error: 'unauthorized', message: 'Not authorized to upload background for this profile.' });
      }
    }

    const saved = saveUploadedBackgroundImage(username, dataUrl);
    if (!saved.ok) {
      return res.status(saved.status).json({ ok: false, error: saved.error });
    }
    return res.status(200).json({ ok: true, url: saved.url, mime: saved.mime, size: saved.size });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'upload_failed', message: err?.message });
  }
}

/**
 * GET /api/backgrounds/:username/:file
 * Securely serves uploaded profile background image
 */
export async function handleServeBackground(req: ExpressReq, res: ExpressRes) {
  const username = (req.params.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const file = String(req.params.file || '').trim();
  if (!username || !file) {
    return res.status(400).end();
  }

  const found = resolveBackgroundFilePath(username, file);
  if (!found) {
    return res.status(404).end();
  }

  const stats = fs.statSync(found.filePath);
  const etag = `"${Math.floor(stats.mtimeMs).toString(36)}-${stats.size.toString(36)}"`;
  res.setHeader('Content-Type', found.mime);
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  return res.sendFile(found.filePath);
}

/**
 * GET /api/blocks?username=...
 * Retrieves owner's blocks
 */
export async function handleGetBlocks(req: ExpressReq, res: ExpressRes) {
  const username = (req.query.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    let blocks = await dbGetBlocks(username);
    const syncMeta = await dbGetBlockSyncMeta(username).catch(() => ({
      blocksInitialized: false,
      deletedBlockIds: new Set<string>(),
    }));
    if (!syncMeta.blocksInitialized && (!blocks || blocks.length === 0)) {
      const fbBlocks = await withTimeout(firebaseGetBlocks(username), [] as any[]);
      const filteredFb = (fbBlocks || []).filter(
        (b) => !syncMeta.deletedBlockIds.has(String(b?.id || ''))
      );
      if (filteredFb.length > 0) {
        blocks = filteredFb;
        dbSaveBlocks(username, filteredFb).catch(() => {});
      }
    }
    const protectedSet = new Set(await dbGetProtectedLinkIds(username).catch(() => []));
    const synced = blocks.map((b) =>
      protectedSet.has(String(b.id)) && !b.isProtected ? { ...b, isProtected: true } : b
    );
    return res.status(200).json(synced);
  } catch (err: any) {
    return res.status(500).json({ error: 'fetch_failed', message: err?.message });
  }
}

/**
 * POST /api/blocks
 * Saves owner's blocks
 */
export async function handleSaveBlocks(req: ExpressReq, res: ExpressRes) {
  const clerkAuth = await verifyClerkRequest(req);
  if (clerkAuth.enforced && !clerkAuth.verifiedByJwt) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid session required to save blocks.' });
  }

  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const userId = (clerkAuth.verifiedByJwt && clerkAuth.userId
    ? clerkAuth.userId
    : (body.userId as string || req.headers['x-user-id'] as string || '')).trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  const sanitizedBlocks = blocks.map((b: any) => {
    if (!b || typeof b !== 'object' || !b.embedMeta) return b;
    const explicitLook =
      typeof b.embedMeta.lookStyle === 'string' && b.embedMeta.lookStyle
        ? b.embedMeta.lookStyle
        : null;
    return {
      ...b,
      embedMeta: sanitizeEmbedMetaBannerForSave(b.embedMeta, explicitLook, {
        allowDataUrl: false,
      }),
    };
  });

  try {
    const prevBlocks = await dbGetBlocks(username).catch(() => []);
    const prevBannerUrls = Array.from(collectReferencedCardBannerUrls(prevBlocks));

    const result = await dbSaveBlocks(username, sanitizedBlocks, userId || undefined, primaryEmail);
    if (result && !result.ok) {
      if (result.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to edit this page.' });
      }
      return res.status(400).json({ error: result.error });
    }
    try {
      cleanupUnreferencedUserCardBanners(username, sanitizedBlocks, prevBannerUrls);
    } catch {}
    await awaitFirebaseWrite(firebaseSaveBlocks(username, sanitizedBlocks, userId || undefined), 'saveBlocks');
    notifyProfileSeoChanged('updated', username).catch(() => {});
    invalidatePublicPageCache(username);

    return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return sendMutationError(res, err, 'save_failed');
  }
}

/**
 * POST /api/contacts
 * Visitor submits contact details
 */
export async function handleSaveContact(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  const linkId = body.linkId as string;

  if (!username || !linkId) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  if (body.hp) {
    // Honeypot caught spam bot
    return res.status(200).json({ ok: true });
  }

  try {
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const contactData = {
      id,
      userId: body.userId || 'owner',
      username,
      linkId,
      email: body.email || null,
      phone: body.phone || null,
      consentText: body.consentText || null,
      source: body.source || null,
      formTitle: body.formTitle || body.source || null,
    };
    await dbSaveContact(contactData);
    await awaitFirebaseWrite(firebaseSaveContact(username, contactData), 'saveContact');

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return sendMutationError(res, err, 'submit_failed');
  }
}

/**
 * GET /api/contacts?username=...
 * Owner retrieves collected contacts (strictly scoped to username)
 */
export async function handleGetContacts(req: ExpressReq, res: ExpressRes) {
  const username = (req.query.username as string || '').toLowerCase().trim();
  const search = (req.query.search as string || '').toLowerCase().trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize as string, 10) || 20);

  if (!username) {
    return res.status(200).json({ rows: [], total: 0 });
  }

  try {
    let contacts = await dbGetContacts(username);
    if (!contacts || contacts.length === 0) {
      const fbContacts = await Promise.race([
        firebaseGetContacts(username).catch(() => []),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1800)),
      ]);
      if (fbContacts && fbContacts.length > 0) {
        contacts = fbContacts;
      }
    }
    if (search) {
      contacts = contacts.filter((c: any) =>
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.phone && c.phone.toLowerCase().includes(search)) ||
        (c.formTitle && c.formTitle.toLowerCase().includes(search))
      );
    }
    const total = contacts.length;
    const from = (page - 1) * pageSize;
    const rows = contacts.slice(from, from + pageSize);
    return res.status(200).json({ rows, total });
  } catch (err: any) {
    return res.status(500).json({ error: 'fetch_failed', message: err?.message });
  }
}

/**
 * DELETE /api/contacts
 * Owner deletes contact(s)
 */
export async function handleDeleteContacts(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (req.query.username as string || body.username as string || '').toLowerCase().trim();
  const contactId = (req.query.id as string || req.query.contactId as string || body.contactId as string || body.id as string || '').trim();
  const all = Boolean(req.query.all === 'true' || body.all);

  try {
    if (all) {
      await dbDeleteAllContacts(username || undefined);
      if (username) await awaitFirebaseWrite(firebaseDeleteAllContacts(username), 'deleteAllContacts');
    } else if (contactId) {
      await dbDeleteContact(username || undefined, contactId);
      if (username) await awaitFirebaseWrite(firebaseDeleteContact(username, contactId), 'deleteContact');
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return sendMutationError(res, err, 'delete_failed');
  }
}

/**
 * POST /api/unlock-link
 * Visitor provides password to unlock a link
 */
export async function handleUnlockLink(req: ExpressReq, res: ExpressRes) {
  const { linkId, password, username } = req.body || {};
  const cleanLinkId = typeof linkId === 'string' ? linkId.trim() : '';
  const cleanPwd = typeof password === 'string' ? password.trim() : '';
  const cleanUser = typeof username === 'string' ? username.replace(/^@+/, '').toLowerCase().trim() : '';

  if (!cleanLinkId || !cleanPwd) {
    return res.status(400).json({ ok: false, reason: 'wrong_password' });
  }

  try {
    const isMatch = await dbVerifyLinkPassword(cleanLinkId, cleanPwd, cleanUser || undefined);
    if (!isMatch) {
      return res.status(200).json({ ok: false, reason: 'wrong_password' });
    }

    // Locate real target URL across local per-user store and Firebase fallback
    const localFound = await dbFindBlockForUnlock(cleanLinkId, cleanUser || undefined);
    let realUrl: string | null = localFound.block?.url || null;
    const ownerUsername = localFound.username || cleanUser || null;

    if (!realUrl && ownerUsername) {
      const fbBlocks = await Promise.race([
        firebaseGetBlocks(ownerUsername).catch(() => []),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500)),
      ]);
      const fbTarget = fbBlocks.find((b) => b.id === cleanLinkId);
      if (fbTarget?.url) {
        realUrl = fbTarget.url;
      }
    }

    if (!realUrl) {
      return res.status(200).json({ ok: false, reason: 'not_found' });
    }

    return res.status(200).json({ ok: true, url: realUrl });
  } catch {
    return res.status(500).json({ ok: false, reason: 'network' });
  }
}

/**
 * POST /api/link-password
 * Owner sets or removes password on a link and syncs block.isProtected state
 */
export async function handleSetLinkPassword(req: ExpressReq, res: ExpressRes) {
  const { linkId, password, remove, username } = req.body || {};
  const cleanLinkId = typeof linkId === 'string' ? linkId.trim() : '';
  const cleanUser = typeof username === 'string' ? username.replace(/^@+/, '').toLowerCase().trim() : '';
  if (!cleanLinkId) {
    return res.status(400).json({ ok: false, error: 'missing_link_id' });
  }

  try {
    let resolvedOwner: string | null = cleanUser || null;
    if (remove) {
      resolvedOwner = (await dbClearLinkPassword(cleanLinkId, cleanUser || undefined)) || resolvedOwner;
    } else {
      if (!password || typeof password !== 'string' || password.trim().length < 4 || password.trim().length > 64) {
        return res.status(400).json({ ok: false, error: 'invalid_password' });
      }
      resolvedOwner = (await dbSetLinkPassword(cleanLinkId, password.trim(), cleanUser || undefined)) || resolvedOwner;
    }

    if (resolvedOwner) {
      const updatedBlocks = await dbGetBlocks(resolvedOwner).catch(() => []);
      if (updatedBlocks.length > 0) {
        await Promise.race([
          firebaseSaveBlocks(resolvedOwner, updatedBlocks).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);
      }
      invalidatePublicPageCache(resolvedOwner);
    }

    return res.status(200).json({ ok: true, isProtected: !remove });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'password_failed', message: err?.message });
  }
}

/**
 * GET /api/link-password/status?username=...
 * Returns list of block IDs currently password-protected for the user
 */
export async function handleGetProtectedLinkIds(req: ExpressReq, res: ExpressRes) {
  const username = String(req.query.username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username) {
    return res.status(200).json({ ok: true, protectedIds: [] });
  }
  try {
    const protectedIds = await dbGetProtectedLinkIds(username);
    return res.status(200).json({ ok: true, protectedIds });
  } catch {
    return res.status(200).json({ ok: true, protectedIds: [] });
  }
}

/**
 * POST /api/account/delete
 * Soft-deletes account for 3-day grace window (takes page offline, locks username, preserves data until expiry or re-login)
 */
export async function handleDeleteAccount(req: ExpressReq, res: ExpressRes) {
  const clerkAuth = await verifyClerkRequest(req);
  if (clerkAuth.enforced && !clerkAuth.verifiedByJwt) {
    return res.status(401).json({ error: 'unauthorized', message: 'Valid session required to delete account.' });
  }

  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = (clerkAuth.verifiedByJwt && clerkAuth.userId
    ? clerkAuth.userId
    : (body.userId as string || req.headers['x-user-id'] as string || '')).trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const result = await dbSoftDeleteAccount(username, userId || undefined, primaryEmail);
    if (result && !result.ok) {
      if (result.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to delete this page.' });
      }
      return res.status(400).json({ error: result.error });
    }
    await awaitFirebaseWrite(
      firebaseSoftDeleteAccount(username, userId || undefined, result.deletedAt, result.purgeAt),
      'softDeleteAccount'
    );
    notifyProfileSeoChanged('deleted', username).catch(() => {});
    invalidatePublicPageCache(username);
    return res.status(200).json({
      ok: true,
      status: 'deleted_pending',
      deletedAt: result.deletedAt,
      purgeAt: result.purgeAt,
      gracePeriodDays: ACCOUNT_DELETE_GRACE_DAYS,
    });
  } catch (err: any) {
    return sendMutationError(res, err, 'delete_failed');
  }
}

/**
 * POST /api/analytics/event
 * Persists page view & link click analytics events cross-device
 */
export async function handleRecordAnalyticsEvent(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  const isClick =
    body.eventType === 'link_click' ||
    body.eventType === 'click' ||
    body.type === 'click' ||
    body.type === 'link_click';
  const eventType = isClick ? 'link_click' : 'page_view';
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const ua = String(req.headers['user-agent'] || '');
    const rawDev = typeof body.device === 'string' ? body.device.trim().toLowerCase() : '';
    const uaDevice = detectDevice(ua);
    const device =
      rawDev === 'mobile' || rawDev === 'tablet' || rawDev === 'desktop'
        ? rawDev
        : uaDevice !== 'other'
          ? uaDevice
          : rawDev === 'other'
            ? 'other'
            : 'desktop';

    const rawSource = typeof (body.referrer ?? body.source) === 'string'
      ? String(body.referrer ?? body.source)
      : '';
    const normSource = normalizeAnalyticsSource(rawSource, 'iveo.site');
    const referrer = normSource === '' ? 'direct' : normSource;

    const country = body.country || String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'IN');

    await dbRecordAnalyticsEvent({
      username,
      eventType,
      blockId: body.blockId || null,
      country,
      referrer,
      device,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'analytics_record_failed', message: err?.message });
  }
}

/**
 * GET /api/analytics?username=...&from=...&to=...&isPro=...
 */
export async function handleGetAnalytics(req: ExpressReq, res: ExpressRes) {
  const username = (req.query.username as string || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const rawFrom = req.query.from ? String(req.query.from).trim() : '';
  const rawTo = req.query.to ? String(req.query.to).trim() : '';
  const fromDate = rawFrom ? new Date(rawFrom) : defaultFrom;
  const toDate = rawTo ? new Date(rawTo) : now;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawTo) && !Number.isNaN(toDate.getTime())) {
    toDate.setUTCHours(23, 59, 59, 999);
  }
  const isPro = req.query.isPro === 'true' || req.query.isPro === '1';

  try {
    const data = await dbGetAnalytics(
      username,
      Number.isNaN(fromDate.getTime()) ? defaultFrom : fromDate,
      Number.isNaN(toDate.getTime()) ? now : toDate,
      isPro
    );
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'analytics_fetch_failed', message: err?.message });
  }
}

/**
 * GET /api/integrations/buymeacoffee?url=...
 * Server-side Buy Me a Coffee profile & live Creator API fetcher (token stays server-only)
 */
export async function handleBuyMeACoffee(req: ExpressReq, res: ExpressRes) {
  const rawUrl = String(req.query.url || req.query.slug || '').trim();
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'missing_url' });
  }

  try {
    const profile = await fetchBuyMeACoffeeProfile(rawUrl);
    if (!profile) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_buymeacoffee_url',
        message: 'Enter a valid buymeacoffee.com/username link.',
      });
    }
    return res.status(200).json({ ok: true, profile });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'bmc_fetch_failed', message: err?.message });
  }
}

function getExpressRequestOrigin(req: ExpressReq): string {
  const host = req.get?.('x-forwarded-host') || req.get?.('host') || req.headers?.host || 'iveo.site';
  const protoHeader = (req.headers?.['x-forwarded-proto'] as string) || req.protocol || 'https';
  const proto = String(protoHeader).split(',')[0].trim();
  const effectiveProto = String(host).includes('localhost') || String(host).startsWith('127.') ? proto : 'https';
  return `${effectiveProto}://${host}`;
}

/**
 * GET /api/integrations/youtube?url=...
 */
export async function handleYouTubeShowcase(req: ExpressReq, res: ExpressRes) {
  const rawUrl = String(req.query.url || req.query.channel || '').trim();
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'missing_url', message: 'Enter a YouTube channel or @handle.' });
  }

  try {
    const channel = await fetchYouTubeShowcase(rawUrl);
    if (!channel) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_youtube_url',
        message: 'Enter a valid YouTube @handle, channel URL, or video URL.',
      });
    }
    return res.status(200).json({ ok: true, channel });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'youtube_fetch_failed', message: err?.message });
  }
}

/**
 * GET /api/oauth/youtube/url?origin=...
 * Builds Google OAuth URL pointing to /api/oauth/youtube/callback
 */
export async function handleYouTubeOAuthUrl(req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
  const origin = /^https?:\/\//i.test(clientOrigin) ? clientOrigin : getExpressRequestOrigin(req);
  const mode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
  const returnTo =
    typeof req.query.returnTo === 'string' ? sanitizeOAuthReturnTo(req.query.returnTo) : null;
  const ownerKey = String(
    req.query.username || req.query.userId || req.headers['x-user-id'] || ''
  ).trim() || null;

  const built = buildYouTubeOAuthUrl(origin, { mode, returnTo, ownerKey });
  if (!built) {
    return res.status(503).json({
      ok: false,
      error: 'oauth_not_configured',
      message: 'Google YouTube OAuth is not configured on the server.',
    });
  }
  return res.status(200).json({ ok: true, url: built.url, redirectUri: built.redirectUri });
}

/**
 * GET /api/oauth/youtube/callback (and trailing slash)
 * Exchanges Google OAuth code for tokens & returns popup HTML or safe redirect token
 */
export async function handleYouTubeOAuthCallback(req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error.trim() : '';
  const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined;

  const sendPopupHtml = (payload: Record<string, any>) => {
    const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>YouTube Connection</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#111;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:15px;font-weight:600;margin:0 0 8px;">${payload.type === 'IVEO_YOUTUBE_OAUTH_SUCCESS' ? 'YouTube connected to Iveo' : 'Could not connect YouTube'}</p>
    <p style="font-size:13px;color:#666;margin:0 0 12px;">This window will close automatically.</p>
    <a href="/dashboard" style="font-size:12px;color:#555;text-decoration:underline;">Return to dashboard</a>
  </div>
  <script>
    (function(){
      var data = ${safeJson};
      try {
        if (window.opener) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var bc = new BroadcastChannel('iveo_yt_oauth');
          bc.postMessage(data);
          bc.close();
        }
      } catch (e) {}
      try {
        localStorage.setItem('iveo_yt_oauth_result', JSON.stringify(data));
      } catch (e) {}
      setTimeout(function(){ window.close(); }, 350);
    })();
  </script>
</body>
</html>`);
  };

  const consumed = consumeOAuthState(stateParam, 'youtube');
  if (consumed.ok === false) {
    return sendPopupHtml({
      type: 'IVEO_YOUTUBE_OAUTH_ERROR',
      error: 'Authorization session expired or invalid. Try connecting again.',
    });
  }

  const sendResult = (payload: Record<string, any>) => {
    if (consumed.record.mode === 'redirect') {
      const targetPath = sanitizeOAuthReturnTo(consumed.record.returnTo) || '/dashboard';
      const sep = targetPath.includes('?') ? '&' : '?';
      if (payload.type === 'IVEO_YOUTUBE_OAUTH_ERROR') {
        return res.redirect(
          302,
          `${targetPath}${sep}iveo_oauth_error=${encodeURIComponent(String(payload.error || 'Authorization failed.'))}`
        );
      }
      const token = storeOAuthRedirectResult(payload);
      return res.redirect(302, `${targetPath}${sep}iveo_oauth_result=${encodeURIComponent(token)}`);
    }
    return sendPopupHtml(payload);
  };

  if (oauthError || !code) {
    return sendResult({
      type: 'IVEO_YOUTUBE_OAUTH_ERROR',
      error: oauthError || 'Authorization was cancelled.',
    });
  }

  try {
    const channel = await exchangeYouTubeOAuthCode(
      code,
      consumed.record.redirectUri,
      consumed.record.ownerKey
    );
    return sendResult({
      type: 'IVEO_YOUTUBE_OAUTH_SUCCESS',
      channel,
    });
  } catch (err: any) {
    return sendResult({
      type: 'IVEO_YOUTUBE_OAUTH_ERROR',
      error: redactSecrets(err?.message || 'Failed to read YouTube channel details.'),
    });
  }
}

/**
 * GET /api/integrations/embed?url=...&forceRefresh=1&blockId=...
 * Server-side metadata enrichment for social & media links via APIs and OpenGraph
 */
export async function handleSocialEmbedLookup(req: ExpressReq, res: ExpressRes) {
  const rawUrl = String(req.query.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'missing_url', message: 'Paste a link to inspect.' });
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    const ssrf = await validateExternalFetchUrl(rawUrl);
    if (ssrf.ok === false) {
      return res.status(400).json({
        ok: false,
        error: 'forbidden_url',
        message: 'That URL cannot be inspected.',
      });
    }
  }

  const rateKey =
    String(req.headers['x-user-id'] || req.ip || req.socket?.remoteAddress || 'anon').trim();
  const rate = checkEmbedLookupRateLimit(rateKey, 20);
  if (!rate.allowed) {
    if (rate.retryAfterSec) res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      message: 'Too many lookups right now. Wait a moment and try again.',
    });
  }

  const forceRefresh = req.query.forceRefresh === '1' || req.query.forceRefresh === 'true';
  const blockId = String(req.query.blockId || '').trim();
  if (forceRefresh && blockId) {
    const cooldown = checkBlockRefreshCooldown(blockId);
    if (!cooldown.allowed) {
      if (cooldown.retryAfterSec) res.setHeader('Retry-After', String(cooldown.retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: 'refresh_cooldown',
        message: `Wait ${cooldown.retryAfterSec || 60} seconds before refreshing this card again.`,
      });
    }
  }

  try {
    const result = await fetchSocialEmbedMetadata(rawUrl, { forceRefresh });
    if (result) {
      return res.status(200).json({
        ok: true,
        provider: result.parsed.provider,
        canonicalUrl: result.parsed.canonicalUrl,
        suggestedTitle: result.suggestedTitle,
        embed: result.embedMeta,
        embedMeta: result.embedMeta,
      });
    }

    const universal = await fetchUniversalSocialLinkMetadata(rawUrl, { forceRefresh });
    if (universal) {
      return res.status(200).json({
        ok: true,
        provider: universal.provider,
        canonicalUrl: universal.canonicalUrl,
        suggestedTitle: universal.suggestedTitle,
        embed: universal.embedMeta,
        embedMeta: universal.embedMeta,
        isGenericLink: Boolean(universal.isGenericLink),
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'unsupported_embed_url',
      message: 'Paste a valid web link (for example https://example.com).',
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: 'embed_lookup_failed',
      message: redactSecrets(err?.message || 'Could not inspect link.'),
    });
  }
}

/**
 * GET /api/integrations/pinterest/me
 * Owner-only development helper for importing the owner's configured Pinterest token profile.
 * Never serves the owner's token to other creators or public visitors.
 */
export async function handlePinterestTokenProfile(req: ExpressReq, res: ExpressRes) {
  const email = String(req.headers['x-user-email'] || '').toLowerCase().trim();
  if (!email || !isPrivilegedEmailServer(email)) {
    return res.status(403).json({
      ok: false,
      error: 'forbidden',
      message: 'Pinterest app token import is restricted to the platform owner account.',
    });
  }

  try {
    const connection = await fetchPinterestAccountFromToken();
    return res.status(200).json({
      ok: true,
      provider: connection.provider,
      url: connection.url,
      title: connection.title,
      embed: connection.embedMeta,
      embedMeta: connection.embedMeta,
    });
  } catch (err: any) {
    return res.status(502).json({
      ok: false,
      error: 'pinterest_token_failed',
      message: redactSecrets(err?.message || 'Could not read Pinterest account from configured access token.'),
    });
  }
}

/**
 * GET /api/oauth/status
 * Reports which OAuth providers have valid credentials configured on the server
 */
export async function handleOAuthStatus(_req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json({
    ok: true,
    providers: getOAuthAvailability(),
  });
}

/**
 * GET /api/oauth/:provider/url?origin=...
 * Generates authorization URL for creator page card connections (Discord, GitHub, LinkedIn, X, etc.)
 */
export async function handleSocialOAuthUrl(req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const providerRaw = String(req.params?.provider || req.query?.provider || '').toLowerCase().trim();
  if (!isValidSocialOAuthProvider(providerRaw)) {
    return res.status(400).json({ ok: false, error: 'unsupported_provider' });
  }
  if (providerRaw === 'pinterest' && !isPinterestOAuthEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'pinterest_oauth_disabled',
      message: 'Pinterest account connection is not enabled yet. Paste a public Pinterest link instead.',
    });
  }
  try {
    const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
    const origin = /^https?:\/\//i.test(clientOrigin) ? clientOrigin : getExpressRequestOrigin(req);
    const mode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
    const returnTo =
      typeof req.query.returnTo === 'string' ? sanitizeOAuthReturnTo(req.query.returnTo) : null;
    const ownerKey = String(
      req.query.username || req.query.userId || req.headers['x-user-id'] || ''
    ).trim() || null;

    const built = buildSocialOAuthUrl(providerRaw, origin, { mode, returnTo, ownerKey });
    return res.status(200).json({
      ok: true,
      provider: providerRaw,
      url: built.url,
      redirectUri: built.redirectUri,
    });
  } catch (err: any) {
    return res.status(503).json({
      ok: false,
      error: 'oauth_not_configured',
      message: redactSecrets(err?.message || `${providerRaw} connection is not configured.`),
    });
  }
}

/**
 * GET /api/oauth/:provider/callback (and trailing slash, plus /callback)
 */
export async function handleSocialOAuthCallback(req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined;
  const providerParam = String(req.params?.provider || req.query?.provider || '').toLowerCase().trim();
  const providerRaw = providerParam || extractProviderFromOAuthState(stateParam) || '';
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error.trim() : '';

  const sendPopupHtml = (payload: Record<string, any>) => {
    const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Account connection · iveo</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#111;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:15px;font-weight:600;margin:0 0 8px;">${payload.type === 'IVEO_SOCIAL_OAUTH_SUCCESS' ? 'Account connected to iveo' : 'Could not connect account'}</p>
    <p style="font-size:13px;color:#666;margin:0 0 12px;">This window will close automatically.</p>
    <a href="/dashboard" style="font-size:12px;color:#555;text-decoration:underline;">Return to dashboard</a>
  </div>
  <script>
    (function(){
      var data = ${safeJson};
      try { if (window.opener) { window.opener.postMessage(data, '*'); } } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var bc = new BroadcastChannel('iveo_social_oauth');
          bc.postMessage(data);
          bc.close();
        }
      } catch (e) {}
      try { localStorage.setItem('iveo_social_oauth_result', JSON.stringify(data)); } catch (e) {}
      setTimeout(function(){ window.close(); }, 350);
    })();
  </script>
</body>
</html>`);
  };

  if (!isValidSocialOAuthProvider(providerRaw)) {
    return sendPopupHtml({
      type: 'IVEO_SOCIAL_OAUTH_ERROR',
      error: 'Unsupported provider.',
    });
  }

  const consumed = consumeOAuthState(stateParam, providerRaw);
  if (consumed.ok === false) {
    return sendPopupHtml({
      type: 'IVEO_SOCIAL_OAUTH_ERROR',
      provider: providerRaw,
      error: 'Authorization session expired or invalid. Try connecting again.',
    });
  }

  const sendResult = (payload: Record<string, any>) => {
    if (consumed.record.mode === 'redirect') {
      const targetPath = sanitizeOAuthReturnTo(consumed.record.returnTo) || '/dashboard';
      const sep = targetPath.includes('?') ? '&' : '?';
      if (payload.type === 'IVEO_SOCIAL_OAUTH_ERROR') {
        return res.redirect(
          302,
          `${targetPath}${sep}iveo_oauth_error=${encodeURIComponent(String(payload.error || 'Authorization failed.'))}`
        );
      }
      const token = storeOAuthRedirectResult(payload);
      return res.redirect(302, `${targetPath}${sep}iveo_oauth_result=${encodeURIComponent(token)}`);
    }
    return sendPopupHtml(payload);
  };

  const oauthErrorDesc =
    typeof req.query.error_description === 'string' ? req.query.error_description.trim() : '';

  if (oauthError || !code) {
    const redirectUri = consumed.record.redirectUri;
    const readableErr = redactSecrets(oauthErrorDesc || oauthError || 'Authorization was cancelled.');
    return sendResult({
      type: 'IVEO_SOCIAL_OAUTH_ERROR',
      provider: providerRaw,
      redirectUri,
      error: /redirect_uri/i.test(readableErr)
        ? `${readableErr} (Callback URL: ${redirectUri})`
        : readableErr,
    });
  }

  try {
    const connected = await exchangeSocialOAuthCode(
      providerRaw,
      code,
      consumed.record.redirectUri,
      consumed.record.codeVerifier,
      consumed.record.ownerKey
    );
    return sendResult({
      type: 'IVEO_SOCIAL_OAUTH_SUCCESS',
      provider: providerRaw,
      profile: {
        displayName: connected.title || connected.embedMeta?.title || null,
        handle: connected.embedMeta?.handle || connected.embedMeta?.subtitle || null,
        avatarUrl: connected.embedMeta?.avatarUrl || null,
        coverUrl: connected.embedMeta?.coverUrl || null,
        bio: connected.embedMeta?.description || null,
        statsLabel: connected.embedMeta?.statsLabel || null,
        url: connected.url || null,
      },
      embed: {
        ...connected.embedMeta,
        url: connected.url,
        title: connected.title,
      },
      connection: connected,
    });
  } catch (err: any) {
    return sendResult({
      type: 'IVEO_SOCIAL_OAUTH_ERROR',
      provider: providerRaw,
      error: redactSecrets(err?.message || 'Failed to read profile details.'),
    });
  }
}

/**
 * GET /api/oauth/result?token=...
 * Consumes a single-use server-stored OAuth result after a mobile redirect fallback.
 */
export async function handleConsumeOAuthResult(req: ExpressReq, res: ExpressRes) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const result = consumeOAuthRedirectResult(token);
  if (!result) {
    return res.status(404).json({ ok: false, error: 'oauth_result_not_found' });
  }
  return res.status(200).json({ ok: true, result });
}

/**
 * GET /api/subscription
 * POST /api/subscription/cancel
 * POST /api/subscription/reactivate
 * POST /api/subscription/switch-cycle
 * GET /api/subscription/history
 * GET /api/subscription/invoice
 */
export async function handleGetSubscription(req: ExpressReq, res: ExpressRes) {
  const rawUsername = String(req.query.username || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
  const email = String(req.query.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;
  const limitRaw = parseInt(String(req.query.limit || '10'), 10);
  const offsetRaw = parseInt(String(req.query.offset || '0'), 10);

  try {
    if (rawUsername && (userId || email) && !isPrivilegedEmailServer(email)) {
      const existing = await dbGetProfile(rawUsername).catch(() => null);
      if (existing) {
        const authorized = await dbVerifyOwnership(existing.username, userId || undefined, email || undefined);
        if (!authorized) {
          return res.status(403).json({ ok: false, error: 'unauthorized', message: 'Not authorized to view billing details for this account.' });
        }
      }
    }

    const snapshot = await getBillingSnapshot({
      username: rawUsername || null,
      userId: userId || null,
      email,
      limit: Number.isFinite(limitRaw) ? limitRaw : 10,
      offset: Number.isFinite(offsetRaw) ? offsetRaw : 0,
    });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(snapshot);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'subscription_fetch_failed', message: err?.message });
  }
}

export async function handleCancelSubscription(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const rawUsername = String(body.username || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = String(body.userId || req.headers['x-user-id'] || '').trim();
  const email = String(body.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;
  const mode = body.mode === 'immediate' ? 'immediate' : 'end_of_period';
  const reason = typeof body.reason === 'string' ? body.reason : null;

  if (!rawUsername && !userId) {
    return res.status(400).json({ ok: false, error: 'missing_identifier' });
  }

  try {
    const result = await cancelBillingSubscription({
      username: rawUsername || null,
      userId: userId || null,
      email,
      mode,
      reason,
      actor: 'user',
    });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    if (result.username) {
      invalidatePublicPageCache(result.username);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'subscription_cancel_failed', message: err?.message });
  }
}

export async function handleReactivateSubscription(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const rawUsername = String(body.username || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = String(body.userId || req.headers['x-user-id'] || '').trim();
  const email = String(body.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;

  if (!rawUsername && !userId) {
    return res.status(400).json({ ok: false, error: 'missing_identifier' });
  }

  try {
    const result = await reactivateBillingSubscription({
      username: rawUsername || null,
      userId: userId || null,
      email,
    });

    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error, message: (result as any).message });
    }

    if (result.username) {
      invalidatePublicPageCache(result.username);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'subscription_reactivate_failed', message: err?.message });
  }
}

export async function handleSwitchSubscriptionCycle(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const rawUsername = String(body.username || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = String(body.userId || req.headers['x-user-id'] || '').trim();
  const email = String(body.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;
  const targetCycle = body.cycle === 'yearly' || body.period === 'yearly' ? 'yearly' : 'monthly';

  if (!rawUsername && !userId) {
    return res.status(400).json({ ok: false, error: 'missing_identifier' });
  }

  try {
    const result = await switchBillingCycle({
      username: rawUsername || null,
      userId: userId || null,
      email,
      targetCycle,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        message: (result as any).message,
      });
    }

    if (result.username) {
      invalidatePublicPageCache(result.username);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'cycle_switch_failed', message: err?.message });
  }
}

export async function handleGetSubscriptionHistory(req: ExpressReq, res: ExpressRes) {
  const rawUsername = String(req.query.username || '').replace(/^@+/, '').toLowerCase().trim();
  const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
  const email = String(req.query.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;
  const limitRaw = parseInt(String(req.query.limit || '10'), 10);
  const offsetRaw = parseInt(String(req.query.offset || '0'), 10);

  if (!userId && !email) {
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Authentication required to access billing history.' });
  }

  try {
    const target = rawUsername
      ? await dbGetProfile(rawUsername).catch(() => null)
      : await dbGetProfileByUserId(userId, email).catch(() => null);
    if (!target) {
      return res.status(200).json({ ok: true, billingHistory: [], historyTotal: 0, hasMoreHistory: false });
    }

    const authorized =
      isPrivilegedEmailServer(email) ||
      (await dbVerifyOwnership(target.username, userId || undefined, email || undefined));
    if (!authorized) {
      return res.status(403).json({ ok: false, error: 'unauthorized' });
    }

    const snapshot = await getBillingSnapshot({
      username: target.username,
      userId: target.userId,
      email: target.primaryEmail,
      limit: Number.isFinite(limitRaw) ? limitRaw : 10,
      offset: Number.isFinite(offsetRaw) ? offsetRaw : 0,
    });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({
      ok: true,
      username: snapshot.username,
      billingHistory: snapshot.billingHistory,
      historyTotal: snapshot.historyTotal,
      hasMoreHistory: snapshot.hasMoreHistory,
      invoices: snapshot.invoices,
      notifications: snapshot.notifications,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'history_fetch_failed', message: err?.message });
  }
}

export async function handleGetSubscriptionInvoice(req: ExpressReq, res: ExpressRes) {
  const rawUsername = String(req.query.username || '').replace(/^@+/, '').toLowerCase().trim();
  const invoiceId = String(req.query.invoiceId || req.query.id || '').trim();
  const userId = String(req.query.userId || req.headers['x-user-id'] || '').trim();
  const email = String(req.query.email || req.headers['x-user-email'] || '').toLowerCase().trim() || null;

  if (!invoiceId) {
    return res.status(400).json({ ok: false, error: 'missing_invoice_id' });
  }
  if (!userId && !email) {
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Authentication required to download invoices.' });
  }

  try {
    const result = await getVerifiedInvoice({
      username: rawUsername || null,
      userId: userId || null,
      email,
      invoiceId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error, message: result.message });
    }
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ ok: true, invoice: result.invoice });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'invoice_fetch_failed', message: err?.message });
  }
}

export async function handleAdminBillingInspect(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'Admin access required.' });
  }

  const rawUsername = String(req.query.username || req.query.u || '').replace(/^@+/, '').toLowerCase().trim();
  if (!rawUsername) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }

  try {
    const result = await adminInspectBilling(rawUsername);
    return res.status(result.status).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'admin_inspect_failed', message: err?.message });
  }
}

export async function handleAdminBillingReconcile(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'Admin access required.' });
  }

  const body = req.body || {};
  const adminEmail = String(req.query.adminEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
  const rawUsername = String(body.username || '').replace(/^@+/, '').toLowerCase().trim();
  const action = String(body.action || '').trim() as any;

  if (!rawUsername) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }
  if (!['activate_paid', 'grant_grace_period', 'expire_now', 'cancel_immediate'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'invalid_action' });
  }

  try {
    const result = await adminReconcileBilling({
      adminEmail,
      username: rawUsername,
      action,
      period: body.period === 'yearly' ? 'yearly' : 'monthly',
      paymentId: typeof body.paymentId === 'string' ? body.paymentId : null,
      orderId: typeof body.orderId === 'string' ? body.orderId : null,
      note: typeof body.note === 'string' ? body.note : null,
    });
    if (result.ok) {
      invalidatePublicPageCache(rawUsername);
    }
    return res.status(result.status).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'admin_reconcile_failed', message: err?.message });
  }
}

/**
 * GET /api/discover
 * Returns public indexable creator profiles for crawlable internal linking & search discovery
 */
export async function handleDiscoverProfiles(req: ExpressReq, res: ExpressRes) {
  const q = String(req.query.q || '').toLowerCase().trim();
  const pageRaw = parseInt(String(req.query.page || '1'), 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize = 24;
  const origin = getCanonicalSiteOrigin();
  const cacheKey = `${q || '__all__'}::p${page}`;
  const cachedDiscover = discoverCache.get(cacheKey);
  if (cachedDiscover && cachedDiscover.expiresAt > Date.now()) {
    res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=60');
    return res.status(200).json(cachedDiscover.payload);
  }

  try {
    const all = await getAllUnifiedProfiles();
    const allIndexable = all
      .filter((p) => !isSyntheticTestHandle(p.username) && evaluateProfileIndexability(p).indexable);

    const matching = q
      ? allIndexable.filter((p) =>
          p.username.includes(q) ||
          (p.displayName || '').toLowerCase().includes(q) ||
          (p.bio || '').toLowerCase().includes(q)
        )
      : allIndexable;

    const totalCount = matching.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;

    const sliced = matching.slice(startIdx, startIdx + pageSize).map((p) => ({
      username: p.username,
      displayName: p.displayName || p.username,
      bio: p.bio || '',
      avatarUrl: isAllowedAvatarHost(p.avatarUrl) ? p.avatarUrl : null,
      vibeId: p.vibeId || 'clean',
      isPro: Boolean(p.isPro || p.plan === 'pro'),
      isVerified: Boolean(p.isPro || p.plan === 'pro'),
      url: `${origin}/@${encodeURIComponent(p.username.replace(/^@+/, ''))}`,
      updatedAt: p.updatedAt,
    }));

    const payload = {
      ok: true,
      profiles: sliced,
      totalCount,
      page: safePage,
      totalPages,
      pageSize,
    };
    discoverCache.set(cacheKey, { payload, expiresAt: Date.now() + DISCOVER_CACHE_TTL_MS });
    res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=60');
    return res.status(200).json(payload);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'discover_failed', message: err?.message });
  }
}

function isSeoAdminRequest(req: ExpressReq): boolean {
  const email = String(req.query.adminEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
  return isPrivilegedEmailServer(email);
}

/**
 * GET /api/seo/admin/overview
 */
export async function handleSeoAdminOverview(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'SEO admin access required.' });
  }

  try {
    const origin = getSiteOrigin({
      headers: {
        get: (name: string) => {
          const val = req.headers[name.toLowerCase()];
          return Array.isArray(val) ? val[0] : (val ? String(val) : null);
        },
      },
    } as any);
    const report = await getSeoHealthReport(origin);
    return res.status(200).json({ ok: true, report });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'seo_overview_failed', message: err?.message });
  }
}

/**
 * POST /api/seo/admin/regenerate-sitemap
 */
export async function handleSeoAdminRegenerate(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  try {
    const result = await regenerateAndPingSitemap(getCanonicalSiteOrigin());
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'regenerate_failed', message: err?.message });
  }
}

/**
 * GET /api/seo/admin/validate?u=username
 */
export async function handleSeoAdminValidate(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const username = String(req.query.u || req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }

  try {
    const result = await validateProfileSeo(getCanonicalSiteOrigin(), username);
    return res.status(200).json({ ok: true, validation: result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'validate_failed', message: err?.message });
  }
}

/**
 * POST /api/seo/admin/inspect
 */
export async function handleSeoAdminInspect(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const rawUsername = String(req.body?.username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!rawUsername) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }

  try {
    const canonical = `${getCanonicalSiteOrigin()}/@${encodeURIComponent(rawUsername)}`;
    const [localValidation, gsc] = await Promise.all([
      validateProfileSeo(getCanonicalSiteOrigin(), rawUsername),
      inspectUrlWithGsc(canonical),
    ]);
    return res.status(200).json({ ok: true, targetUrl: canonical, localValidation, gsc });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'inspect_failed', message: err?.message });
  }
}

/**
 * POST /api/seo/admin/moderate-background
 * Allows SEO/Platform admin to reset a user's custom/uploaded background to Pure White default
 */
export async function handleSeoAdminModerateBackground(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const username = String(req.body?.username || '').replace(/^@+/, '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }

  try {
    let existing = await dbGetProfile(username);
    if (!existing) {
      existing = await withTimeout(firebaseGetProfile(username), null);
    }
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'profile_not_found' });
    }
    deleteUserUploadedBackgrounds(username);
    const updatedAt = new Date().toISOString();
    const resetBg = { ...DEFAULT_BACKGROUND_CONFIG };
    const nextAppearance =
      existing.appearance && existing.appearance.schemaVersion === 2
        ? {
            ...existing.appearance,
            background: { type: 'solid', color: '#FFFFFF' },
            updatedAt,
          }
        : existing.appearance ?? null;

    if (nextAppearance) {
      await dbWriteAppearanceState(username, (cur) => ({
        nextProfile: {
          ...(cur.profile || existing),
          background: resetBg,
          appearance: nextAppearance,
          updatedAt,
        },
        result: true,
      }));
    }

    const saveRes = await dbSaveProfile({
      userId: existing.userId || 'owner',
      username,
      primaryEmail: existing.primaryEmail,
      background: resetBg,
      ...(nextAppearance !== null ? { appearance: nextAppearance } : {}),
      updatedAt,
    });

    await Promise.all([
      awaitFirebaseWrite(
        firebaseSaveProfile(
          username,
          saveRes?.profile || {
            ...existing,
            background: resetBg,
            ...(nextAppearance !== null ? { appearance: nextAppearance } : {}),
            updatedAt,
          },
          existing.userId
        ),
        'saveProfile'
      ),
      nextAppearance
        ? awaitFirebaseWrite(
            firebaseSaveAppearanceState(
              username,
              { appearance: nextAppearance },
              existing.userId
            ),
            'saveAppearanceState'
          )
        : Promise.resolve(),
    ]);

    invalidatePublicPageCache(username);
    return res.status(200).json({ ok: true, username, background: resetBg });
  } catch (err: any) {
    return sendMutationError(res, err, 'moderate_failed');
  }
}

/**
 * GET /api/seo/admin/gsc-config
 * Returns redacted GSC service account summary (never returns private_key)
 */
export async function handleSeoAdminGetGscConfig(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'SEO admin access required.' });
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json({ ok: true, gsc: getGscSafeConfigSummary() });
}

/**
 * POST /api/seo/admin/gsc-config
 * Saves a Google Cloud Service Account JSON and/or property URL on the server runtime store
 */
export async function handleSeoAdminSaveGscConfig(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'SEO admin access required.' });
  }
  try {
    const body = req.body || {};
    const rawJson =
      typeof body.json === 'string'
        ? body.json
        : typeof body.rawJson === 'string'
          ? body.rawJson
          : body.json && typeof body.json === 'object'
            ? JSON.stringify(body.json)
            : undefined;
    const propertyUrl = typeof body.propertyUrl === 'string' ? body.propertyUrl : undefined;

    const saved = saveGscRuntimeConfig({ rawJson, propertyUrl });
    if (!saved.ok) {
      return res.status(saved.status).json({
        ok: false,
        error: saved.error,
        gsc: saved.summary,
      });
    }
    const connection = body.test === false ? null : await testGscConnection();
    return res.status(200).json({
      ok: true,
      gsc: saved.summary,
      connection,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: redactSecrets(err?.message || 'Failed to save GSC configuration.'),
    });
  }
}

/**
 * DELETE /api/seo/admin/gsc-config
 * Clears the runtime GSC service account JSON file
 */
export async function handleSeoAdminDeleteGscConfig(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'SEO admin access required.' });
  }
  const summary = clearGscRuntimeConfig();
  return res.status(200).json({ ok: true, gsc: summary });
}

/**
 * POST /api/seo/admin/gsc-test
 * Tests live OAuth JWT exchange and Google Search Console /sites access
 */
export async function handleSeoAdminTestGsc(req: ExpressReq, res: ExpressRes) {
  if (!isSeoAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden', message: 'SEO admin access required.' });
  }
  try {
    const result = await testGscConnection();
    return res.status(200).json({
      ok: result.ok,
      connection: result,
      gsc: getGscSafeConfigSummary(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: redactSecrets(err?.message || 'GSC connection test failed.'),
    });
  }
}



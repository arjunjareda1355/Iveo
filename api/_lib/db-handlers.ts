import type { Request as ExpressReq, Response as ExpressRes } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkDatabaseReadiness,
  dbClaimUsername,
  dbGetProfileByUserId,
  dbVerifyOwnership,
  dbSaveProfile,
  dbGetProfile,
  dbSaveBlocks,
  dbGetBlocks,
  dbSaveContact,
  dbGetContacts,
  dbDeleteContact,
  dbDeleteAllContacts,
  dbDeleteAccount,
  dbSetLinkPassword,
  dbClearLinkPassword,
  dbVerifyLinkPassword,
  dbRecordAnalyticsEvent,
  dbGetAnalytics,
} from './azureSql.ts';
import { isAllowedAvatarHost } from './publicPage.ts';
import { RESERVED, isPrivilegedEmailServer } from './usernames.ts';
import { getCanonicalSiteOrigin, getSiteOrigin } from './env.ts';
import {
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
  firebaseReleaseUsername,
} from './firebaseServer.ts';
import { fetchBuyMeACoffeeProfile } from './buymeacoffee.ts';
import {
  buildYouTubeOAuthUrl,
  exchangeYouTubeOAuthCode,
  fetchYouTubeShowcase,
  parseRedirectUriFromState,
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
import { inspectUrlWithGsc } from './searchEngines.ts';

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

  const clean = raw.toLowerCase().trim();
  if (!clean) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const [dbProf, fbProf] = await Promise.all([
      dbGetProfile(clean).catch(() => null),
      Promise.race([
        firebaseGetProfile(clean).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
      ]),
    ]);

    let profile = dbProf;
    let cameFromFirebase = false;
    if (!profile && fbProf) {
      profile = fbProf;
      cameFromFirebase = true;
    } else if (profile && fbProf && (fbProf.updatedAt || '') > (profile.updatedAt || '')) {
      profile = { ...profile, ...fbProf };
      cameFromFirebase = true;
    }

    if (!profile || isSyntheticTestHandle(clean)) {
      return res.status(404).json({ error: 'not_found' });
    }

    const effectiveStatus = profile.status || (profile.isPublished === false ? 'unpublished' : 'active');
    if (effectiveStatus === 'deleted' || effectiveStatus === 'suspended' || effectiveStatus === 'private' || effectiveStatus === 'unpublished') {
      return res.status(404).json({ error: 'not_found', status: effectiveStatus });
    }

    let allBlocks = await dbGetBlocks(clean);
    if (cameFromFirebase || !allBlocks || allBlocks.length === 0) {
      const fbBlocks = await Promise.race([
        firebaseGetBlocks(clean).catch(() => []),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1800)),
      ]);
      if (fbBlocks && fbBlocks.length > 0 && (!allBlocks || allBlocks.length === 0 || cameFromFirebase)) {
        allBlocks = fbBlocks;
      }
    }
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
      }));

    const isPro = Boolean(
      profile.isPro ||
      profile.plan === 'pro' ||
      isPrivilegedEmailServer(profile.primaryEmail)
    );

    return res.status(200).json({
      profile: {
        username: profile.username,
        displayName: profile.displayName || profile.username,
        bio: profile.bio || '',
        avatarUrl: isAllowedAvatarHost(profile.avatarUrl) ? profile.avatarUrl : null,
        avatarType: profile.avatarType || (profile.avatarId ? 'default' : (profile.avatarUrl ? 'uploaded' : 'default')),
        avatarId: profile.avatarId || null,
        vibeId: profile.vibeId || 'clean',
        plan: isPro ? 'pro' : 'free',
        isPro,
        isVerified: isPro,
        buttonShape: profile.buttonShape ?? null,
        socials: profile.socials || {},
        socialsPosition: profile.socialsPosition || 'top',
        hideFromSearch: Boolean(profile.hideFromSearch),
        hideFooter: Boolean(profile.hideFooter),
        background: profile.background || null,
        googleAnalyticsId: profile.googleAnalyticsId || null,
        metaPixelId: profile.metaPixelId || null,
        whatsappNumber: profile.whatsappNumber || null,
        customSeoTitle: profile.customSeoTitle || null,
        customSeoDescription: profile.customSeoDescription || null,
        fontSettings: profile.fontSettings || null,
        buttonColors: profile.buttonColors || null,
        businessCard: profile.businessCard || null,
        layoutSettings: profile.layoutSettings || null,
      },
      links: filteredBlocks,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'server_error', message: err?.message });
  }
}

/**
 * POST /api/claim-username
 * Atomically validates, reserves, and claims a username in the database
 */
export async function handleClaimUsername(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const username = (body.username as string || '').toLowerCase().trim();
  const previousUsernameHint = (body.previousUsername as string || '').toLowerCase().trim() || null;
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
      const fbClaim = await Promise.race([
        firebaseIsUsernameClaimed(username, userId),
        new Promise<{ claimed: boolean; isOwn?: boolean }>((resolve) =>
          setTimeout(() => resolve({ claimed: false }), 2000)
        ),
      ]);
      if (fbClaim.claimed && !fbClaim.isOwn && !isPrivilegedEmailServer(primaryEmail)) {
        return res.status(409).json({
          ok: false,
          error: 'already_claimed',
          message: `iveo.site/${username} is already claimed by another creator. Please pick another address.`,
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
        // Migrate existing blocks, contacts, clicks before releasing old username
        await Promise.race([
          firebaseMigrateUsernameData(releasedOld, result.username, userId).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
        await Promise.race([
          firebaseReleaseUsername(releasedOld, userId).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
      // Sync new claim and profile to Firebase (bounded await so subsequent renames never race)
      await Promise.race([
        firebaseSaveProfile(
          result.username,
          {
            ...(profileData || {}),
            primaryEmail,
            plan: isPrivilegedEmailServer(primaryEmail) ? 'pro' : (profileData?.plan || 'free'),
          },
          userId
        ).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);

      notifyProfileSeoChanged(releasedOld ? 'renamed' : 'created', result.username, releasedOld).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      username: result.username,
      releasedUsername: releasedOld,
      profileUrl: result.profileUrl,
      message: `iveo.site/${result.username} successfully claimed!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'claim_failed', message: err?.message });
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
      Promise.race([
        firebaseGetProfileByUserId(userId, email).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
      ]),
    ]);

    let profile = dbProf;
    let cameFromFirebase = false;
    if (!profile && fbProf) {
      profile = fbProf;
      cameFromFirebase = true;
    } else if (profile && fbProf && (fbProf.updatedAt || '') > (profile.updatedAt || '')) {
      profile = { ...profile, ...fbProf };
      cameFromFirebase = true;
    }

    if (!profile) {
      return res.status(200).json({ ok: true, claimed: false });
    }

    const isPro = Boolean(
      profile.isPro ||
      profile.plan === 'pro' ||
      isPrivilegedEmailServer(email || profile.primaryEmail)
    );
    profile = {
      ...profile,
      plan: isPro ? 'pro' : 'free',
      isPro,
      isVerified: isPro,
    };

    let blocks = await dbGetBlocks(profile.username);
    if (cameFromFirebase || !blocks || blocks.length === 0) {
      const fbBlocks = await Promise.race([
        firebaseGetBlocks(profile.username).catch(() => []),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1800)),
      ]);
      if (fbBlocks && fbBlocks.length > 0 && (!blocks || blocks.length === 0 || cameFromFirebase)) {
        blocks = fbBlocks;
      }
    }

    return res.status(200).json({
      ok: true,
      claimed: true,
      username: profile.username,
      profile,
      blocks,
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
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const resolvedEmail = body.primaryEmail || req.headers['x-user-email'] as string || null;
    const resolvedPlan = isPrivilegedEmailServer(resolvedEmail) ? 'pro' : body.plan;
    const saveResult = await dbSaveProfile({
      userId: body.userId || req.headers['x-user-id'] as string || 'owner',
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
      status: body.status,
      isPublished: body.isPublished,
      hideFooter: body.hideFooter,
      hideFromSearch: body.hideFromSearch,
      background: body.background,
      googleAnalyticsId: body.googleAnalyticsId,
      metaPixelId: body.metaPixelId,
      whatsappNumber: body.whatsappNumber,
      customSeoTitle: body.customSeoTitle,
      customSeoDescription: body.customSeoDescription,
      fontSettings: body.fontSettings,
      buttonColors: body.buttonColors,
      businessCard: body.businessCard,
      layoutSettings: body.layoutSettings,
    });

    if (saveResult && !saveResult.ok) {
      if (saveResult.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to edit this page.' });
      }
      return res.status(400).json({ error: saveResult.error });
    }

    // Bounded await sync to Firebase Cloud Database so immediate page loads stay consistent
    await Promise.race([
      firebaseSaveProfile(
        username,
        { ...body, primaryEmail: resolvedEmail, plan: resolvedPlan },
        body.userId || req.headers['x-user-id'] as string || 'owner'
      ).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    notifyProfileSeoChanged('updated', username).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'save_failed', message: err?.message });
  }
}

const AVATAR_DIR = path.resolve(process.cwd(), 'data', 'avatars');

/**
 * POST /api/avatar
 * Securely uploads and stores user avatar on server disk with ownership verification
 */
export async function handleUploadAvatar(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  const dataUrl = body.dataUrl as string;
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
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

    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'invalid_data_url' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
    fs.writeFileSync(avatarFile, buffer);

    const avatarUrl = `/api/avatar/${username}?v=${Date.now()}`;

    // Update in database immediately while preserving existing background and integrations
    const updatedAvatarProfile = {
      userId: userId || existing?.userId || 'owner',
      username,
      displayName: existing?.displayName || username,
      bio: existing?.bio || '',
      avatarUrl,
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
    };
    await dbSaveProfile(updatedAvatarProfile);
    await Promise.race([
      firebaseSaveProfile(username, updatedAvatarProfile, updatedAvatarProfile.userId).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    return res.status(200).json({ ok: true, avatarUrl, avatarType: 'uploaded', avatarId: null });
  } catch (err: any) {
    return res.status(500).json({ error: 'upload_failed', message: err?.message });
  }
}

/**
 * GET /api/avatar/:username
 * Serves user avatar image with short cache and stale-while-revalidate for immediate updates
 */
export async function handleServeAvatar(req: ExpressReq, res: ExpressRes) {
  const username = (req.params.username as string || '').toLowerCase().trim();
  if (!username) {
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

  return res.status(404).end();
}

/**
 * GET /api/blocks?username=...
 * Retrieves owner's blocks
 */
export async function handleGetBlocks(req: ExpressReq, res: ExpressRes) {
  const username = (req.query.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    let blocks = await dbGetBlocks(username);
    if (!blocks || blocks.length === 0) {
      const fbBlocks = await Promise.race([
        firebaseGetBlocks(username).catch(() => []),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1800)),
      ]);
      if (fbBlocks && fbBlocks.length > 0) {
        blocks = fbBlocks;
      }
    }
    return res.status(200).json(blocks);
  } catch (err: any) {
    return res.status(500).json({ error: 'fetch_failed', message: err?.message });
  }
}

/**
 * POST /api/blocks
 * Saves owner's blocks
 */
export async function handleSaveBlocks(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const result = await dbSaveBlocks(username, blocks, userId || undefined, primaryEmail);
    if (result && !result.ok) {
      if (result.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to edit this page.' });
      }
      return res.status(400).json({ error: result.error });
    }
    // Bounded-await sync to Firebase Cloud Database so deletions & edits never leave ghost items
    await Promise.race([
      firebaseSaveBlocks(username, blocks, userId || undefined).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    notifyProfileSeoChanged('updated', username).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'save_failed', message: err?.message });
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

    // Bounded-await sync contact to Firebase
    await Promise.race([
      firebaseSaveContact(username, contactData).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'submit_failed', message: err?.message });
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
      if (username) await firebaseDeleteAllContacts(username).catch(() => {});
    } else if (contactId) {
      await dbDeleteContact(username || undefined, contactId);
      if (username) await firebaseDeleteContact(username, contactId).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'delete_failed', message: err?.message });
  }
}

/**
 * POST /api/unlock-link
 * Visitor provides password to unlock a link
 */
export async function handleUnlockLink(req: ExpressReq, res: ExpressRes) {
  const { linkId, password, username } = req.body || {};
  if (!linkId || !password) {
    return res.status(400).json({ ok: false, reason: 'wrong_password' });
  }

  try {
    const isMatch = await dbVerifyLinkPassword(linkId, password.trim());
    if (!isMatch) {
      return res.status(200).json({ ok: false, reason: 'wrong_password' });
    }

    // Find the real link URL from database
    let realUrl = 'https://iveo.site';
    if (username) {
      const blocks = await dbGetBlocks(username.toLowerCase().trim());
      const target = blocks.find((b) => b.id === linkId);
      if (target?.url) realUrl = target.url;
    }

    return res.status(200).json({ ok: true, url: realUrl });
  } catch {
    return res.status(500).json({ ok: false, reason: 'network' });
  }
}

/**
 * POST /api/link-password
 * Owner sets or removes password on a link
 */
export async function handleSetLinkPassword(req: ExpressReq, res: ExpressRes) {
  const { linkId, password, remove } = req.body || {};
  if (!linkId) {
    return res.status(400).json({ error: 'missing_link_id' });
  }

  try {
    if (remove) {
      await dbClearLinkPassword(linkId);
    } else {
      if (!password || password.length < 4 || password.length > 64) {
        return res.status(400).json({ error: 'invalid_password' });
      }
      await dbSetLinkPassword(linkId, password);
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'password_failed', message: err?.message });
  }
}

/**
 * POST /api/account/delete
 * Deletes user profile and data from database
 */
export async function handleDeleteAccount(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  const userId = (body.userId as string || req.headers['x-user-id'] as string || '').trim();
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const result = await dbDeleteAccount(username, userId || undefined, primaryEmail);
    if (result && !result.ok) {
      if (result.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to delete this page.' });
      }
      return res.status(400).json({ error: result.error });
    }
    await firebaseReleaseUsername(username, userId || undefined).catch(() => {});
    notifyProfileSeoChanged('deleted', username).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'delete_failed', message: err?.message });
  }
}

/**
 * POST /api/analytics/event
 * Persists page view & link click analytics events cross-device
 */
export async function handleRecordAnalyticsEvent(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
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
    const device = body.device || (/mobile|iphone|android/i.test(ua) ? 'Mobile' : 'Desktop');
    const country = body.country || String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'IN');

    await dbRecordAnalyticsEvent({
      username,
      eventType,
      blockId: body.blockId || null,
      country,
      referrer: body.referrer || body.source || 'Direct',
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
  const username = (req.query.username as string || '').toLowerCase().trim();
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
  const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
  const origin = /^https?:\/\//i.test(clientOrigin) ? clientOrigin : getExpressRequestOrigin(req);
  const built = buildYouTubeOAuthUrl(origin);
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
 * Exchanges Google OAuth code for tokens & returns lightweight popup HTML sending postMessage
 */
export async function handleYouTubeOAuthCallback(req: ExpressReq, res: ExpressRes) {
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
    <p style="font-size:13px;color:#666;margin:0;">This window will close automatically.</p>
  </div>
  <script>
    (function(){
      var data = ${safeJson};
      try {
        if (window.opener) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      setTimeout(function(){ window.close(); }, 350);
    })();
  </script>
</body>
</html>`);
  };

  if (oauthError || !code) {
    return sendPopupHtml({
      type: 'IVEO_YOUTUBE_OAUTH_ERROR',
      error: oauthError || 'Authorization was cancelled.',
    });
  }

  try {
    const fallbackOrigin = getExpressRequestOrigin(req);
    const redirectUri = parseRedirectUriFromState(stateParam, fallbackOrigin);
    const channel = await exchangeYouTubeOAuthCode(code, redirectUri);
    return sendPopupHtml({
      type: 'IVEO_YOUTUBE_OAUTH_SUCCESS',
      channel,
    });
  } catch (err: any) {
    return sendPopupHtml({
      type: 'IVEO_YOUTUBE_OAUTH_ERROR',
      error: err?.message || 'Failed to read YouTube channel details.',
    });
  }
}

/**
 * GET /api/discover
 * Returns public indexable creator profiles for crawlable internal linking & search discovery
 */
export async function handleDiscoverProfiles(req: ExpressReq, res: ExpressRes) {
  const q = String(req.query.q || '').toLowerCase().trim();
  const origin = getCanonicalSiteOrigin();

  try {
    const all = await getAllUnifiedProfiles();
    const allIndexable = all
      .filter((p) => !isSyntheticTestHandle(p.username) && evaluateProfileIndexability(p).indexable);

    const totalCount = allIndexable.length;

    const filtered = (q
      ? allIndexable.filter((p) =>
          p.username.includes(q) ||
          (p.displayName || '').toLowerCase().includes(q) ||
          (p.bio || '').toLowerCase().includes(q)
        ).slice(0, 50)
      : allIndexable.slice(0, 16)
    ).map((p) => ({
      username: p.username,
      displayName: p.displayName || p.username,
      bio: p.bio || '',
      avatarUrl: isAllowedAvatarHost(p.avatarUrl) ? p.avatarUrl : null,
      vibeId: p.vibeId || 'clean',
      isPro: Boolean(p.isPro || p.plan === 'pro'),
      isVerified: Boolean(p.isPro || p.plan === 'pro'),
      url: `${origin}/${encodeURIComponent(p.username)}`,
      updatedAt: p.updatedAt,
    }));

    return res.status(200).json({ ok: true, profiles: filtered, totalCount });
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

  const username = String(req.body?.username || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ ok: false, error: 'missing_username' });
  }

  try {
    const canonical = `${getCanonicalSiteOrigin()}/${encodeURIComponent(username)}`;
    const [localValidation, gsc] = await Promise.all([
      validateProfileSeo(getCanonicalSiteOrigin(), username),
      inspectUrlWithGsc(canonical),
    ]);
    return res.status(200).json({ ok: true, targetUrl: canonical, localValidation, gsc });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'inspect_failed', message: err?.message });
  }
}


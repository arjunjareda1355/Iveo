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
} from './azureSql.ts';
import { isAllowedAvatarHost } from './publicPage.ts';
import { RESERVED } from './usernames.ts';
import {
  firebaseGetProfile,
  firebaseGetProfileByUserId,
  firebaseGetBlocks,
  firebaseSaveProfile,
  firebaseSaveBlocks,
  firebaseSaveContact,
} from './firebaseServer.ts';
import { VIBES } from '../../src/lib/vibes.ts';

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
    let profile = await dbGetProfile(clean);
    if (!profile) {
      profile = await firebaseGetProfile(clean);
    }

    if (!profile) {
      // Demo persona fallback so demo creator addresses always render
      const personaVibe = VIBES.find((v) => v.persona.handle === clean);
      if (personaVibe) {
        return res.status(200).json({
          profile: {
            username: clean,
            displayName: personaVibe.persona.name,
            bio: personaVibe.persona.bio,
            avatarUrl: null,
            avatarType: 'default',
            avatarId: null,
            vibeId: personaVibe.id,
            buttonShape: 'rounded',
            socials: {},
            socialsPosition: 'top',
            hideFromSearch: false,
            hideFooter: false,
          },
          links: personaVibe.persona.links.map((l, i) => ({
            id: `persona-${i}`,
            kind: 'link',
            title: l,
            url: 'https://iveo.site',
            layout: 'classic',
            isActive: true,
          })),
        });
      }
      return res.status(404).json({ error: 'not_found' });
    }

    let allBlocks = await dbGetBlocks(clean);
    if (!allBlocks || allBlocks.length === 0) {
      const fbBlocks = await firebaseGetBlocks(clean);
      if (fbBlocks && fbBlocks.length > 0) {
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
        faq: b.faq || null,
        vcard: b.vcard || null,
        animation: b.animation || null,
        badge: b.badge || null,
      }));

    return res.status(200).json({
      profile: {
        username: profile.username,
        displayName: profile.displayName || profile.username,
        bio: profile.bio || '',
        avatarUrl: isAllowedAvatarHost(profile.avatarUrl) ? profile.avatarUrl : null,
        avatarType: profile.avatarType || (profile.avatarId ? 'default' : (profile.avatarUrl ? 'uploaded' : 'default')),
        avatarId: profile.avatarId || null,
        vibeId: profile.vibeId || 'clean',
        buttonShape: profile.buttonShape || 'rounded',
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
  const primaryEmail = (body.primaryEmail as string || req.headers['x-user-email'] as string || '').toLowerCase().trim() || null;
  const profileData = body.profile || body.profileData || body;

  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in to claim an address.' });
  }

  if (!username) {
    return res.status(400).json({ error: 'missing_username', message: 'Username is required.' });
  }

  try {
    const result = await dbClaimUsername(userId, username, profileData, primaryEmail);
    if (!result.ok) {
      const statusCode = result.error === 'already_claimed' ? 409 : 400;
      return res.status(statusCode).json({
        ok: false,
        error: result.error,
        message: result.message || 'That address is unavailable.',
      });
    }

    if (result.username) {
      // Sync claim and profile to Firebase in background
      firebaseSaveProfile(result.username, profileData || {}, userId).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      username: result.username,
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
    let profile = await dbGetProfileByUserId(userId, email);
    if (!profile) {
      profile = await firebaseGetProfileByUserId(userId, email);
    }
    if (!profile) {
      return res.status(200).json({ ok: true, claimed: false });
    }

    let blocks = await dbGetBlocks(profile.username);
    if (!blocks || blocks.length === 0) {
      blocks = await firebaseGetBlocks(profile.username);
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
      primaryEmail: body.primaryEmail || req.headers['x-user-email'] as string || null,
      plan: body.plan,
      hideFooter: body.hideFooter,
      hideFromSearch: body.hideFromSearch,
      background: body.background,
      googleAnalyticsId: body.googleAnalyticsId,
      metaPixelId: body.metaPixelId,
      whatsappNumber: body.whatsappNumber,
      customSeoTitle: body.customSeoTitle,
      customSeoDescription: body.customSeoDescription,
    });

    if (saveResult && !saveResult.ok) {
      if (saveResult.error === 'unauthorized') {
        return res.status(403).json({ error: 'unauthorized', message: 'You are not authorized to edit this page.' });
      }
      return res.status(400).json({ error: saveResult.error });
    }

    // Sync to Firebase Cloud Database in background
    firebaseSaveProfile(username, body, body.userId || req.headers['x-user-id'] as string || 'owner').catch(() => {});

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

    // Update in database immediately
    await dbSaveProfile({
      userId: userId || existing?.userId || 'owner',
      username,
      displayName: existing?.displayName || username,
      bio: existing?.bio || '',
      avatarUrl,
      avatarType: 'uploaded',
      avatarId: null,
      vibeId: existing?.vibeId || 'clean',
      buttonShape: existing?.buttonShape || 'rounded',
      socials: existing?.socials || {},
      socialsPosition: existing?.socialsPosition || 'top',
      primaryEmail: primaryEmail || existing?.primaryEmail || null,
      plan: existing?.plan || 'free',
      hideFooter: existing?.hideFooter,
      hideFromSearch: existing?.hideFromSearch,
    });

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
    const blocks = await dbGetBlocks(username);
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
    // Sync to Firebase Cloud Database in background
    firebaseSaveBlocks(username, blocks, userId || undefined).catch(() => {});

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
    };
    await dbSaveContact(contactData);

    // Sync contact to Firebase in background
    firebaseSaveContact(username, contactData).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'submit_failed', message: err?.message });
  }
}

/**
 * GET /api/contacts?username=...
 * Owner retrieves collected contacts
 */
export async function handleGetContacts(req: ExpressReq, res: ExpressRes) {
  const username = (req.query.username as string || '').toLowerCase().trim();
  const search = (req.query.search as string || '').toLowerCase().trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize as string, 10) || 20);

  try {
    let contacts = await dbGetContacts(username || undefined);
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
    } else if (contactId) {
      await dbDeleteContact(username || undefined, contactId);
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
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'delete_failed', message: err?.message });
  }
}

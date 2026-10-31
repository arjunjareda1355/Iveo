import type { Request as ExpressReq, Response as ExpressRes } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkDatabaseReadiness,
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
} from './_lib/azureSql.ts';
import { isAllowedAvatarHost } from './_lib/publicPage.ts';

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
  const raw = (req.query.u as string) || '';
  const clean = raw.toLowerCase().trim();
  if (!clean) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    const profile = await dbGetProfile(clean);
    if (!profile) {
      return res.status(404).json({ error: 'not_found' });
    }

    const allBlocks = await dbGetBlocks(clean);
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
        vibeId: profile.vibeId || 'clean',
        buttonShape: profile.buttonShape || 'rounded',
        socials: profile.socials || {},
        socialsPosition: profile.socialsPosition || 'top',
        hideFromSearch: Boolean(profile.hideFromSearch),
        hideFooter: Boolean(profile.hideFooter),
      },
      links: filteredBlocks,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'server_error', message: err?.message });
  }
}

/**
 * POST /api/profile
 * Saves or updates profile in database
 */
export async function handleSaveProfile(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    await dbSaveProfile({
      userId: body.userId || 'owner',
      username,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      vibeId: body.vibeId,
      buttonShape: body.buttonShape,
      socials: body.socials,
      socialsPosition: body.socialsPosition,
      primaryEmail: body.primaryEmail,
      plan: body.plan,
      hideFooter: body.hideFooter,
      hideFromSearch: body.hideFromSearch,
    });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'save_failed', message: err?.message });
  }
}

const AVATAR_DIR = path.resolve(process.cwd(), 'data', 'avatars');

/**
 * POST /api/avatar
 * Securely uploads and stores user avatar on server disk (works without Clerk metadata size limits)
 */
export async function handleUploadAvatar(req: ExpressReq, res: ExpressRes) {
  const body = req.body || {};
  const username = (body.username as string || '').toLowerCase().trim();
  const dataUrl = body.dataUrl as string;

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'missing_data_url' });
  }

  try {
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
    const existing = await dbGetProfile(username);
    if (existing) {
      await dbSaveProfile({
        ...existing,
        avatarUrl,
      });
    }

    return res.status(200).json({ ok: true, avatarUrl });
  } catch (err: any) {
    return res.status(500).json({ error: 'upload_failed', message: err?.message });
  }
}

/**
 * GET /api/avatar/:username
 * Serves user avatar image
 */
export async function handleServeAvatar(req: ExpressReq, res: ExpressRes) {
  const username = (req.params.username as string || '').toLowerCase().trim();
  if (!username) {
    return res.status(400).end();
  }

  const avatarFile = path.join(AVATAR_DIR, `${username}.jpg`);
  if (fs.existsSync(avatarFile)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
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

  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    await dbSaveBlocks(username, blocks);
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
    await dbSaveContact({
      id,
      userId: body.userId || 'owner',
      username,
      linkId,
      email: body.email || null,
      phone: body.phone || null,
      consentText: body.consentText || null,
      source: body.source || null,
    });
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
  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  try {
    await dbDeleteAccount(username.toLowerCase().trim());
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'delete_failed', message: err?.message });
  }
}

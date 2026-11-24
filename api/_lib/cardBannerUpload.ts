import type { Request as ExpressReq, Response as ExpressRes } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  dbGetBlocks,
  dbGetProfile,
  dbGetProfileByUserId,
  dbVerifyOwnership,
} from './azureSql.ts';
import { inspectAndSanitizeRasterBuffer } from './imageSanitizer.ts';
import {
  BANNER_ERROR_MESSAGES,
  BANNER_MIN_HEIGHT,
  BANNER_MIN_WIDTH,
  BANNER_UPLOAD_LIMIT_BYTES,
  collectReferencedCardBannerUrls,
  extractBannerFilePathFromUrl,
} from '../../src/lib/cardBanner.ts';

const CARD_BANNER_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CARD_BANNER_RATE_MAX_UPLOADS = 10;
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const uploadTimestampsByUser = new Map<string, number[]>();

export function resetCardBannerRateLimitForTests() {
  uploadTimestampsByUser.clear();
}

export function checkCardBannerUploadRateLimit(actorKey: string, now = Date.now()): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const recent = (uploadTimestampsByUser.get(actorKey) || []).filter(
    (ts) => now - ts < CARD_BANNER_RATE_WINDOW_MS
  );
  if (recent.length >= CARD_BANNER_RATE_MAX_UPLOADS) {
    const oldest = recent[0] || now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((CARD_BANNER_RATE_WINDOW_MS - (now - oldest)) / 1000)
    );
    uploadTimestampsByUser.set(actorKey, recent);
    return { allowed: false, retryAfterSec };
  }
  recent.push(now);
  uploadTimestampsByUser.set(actorKey, recent);
  return { allowed: true };
}

export function getCardBannersBaseDir(): string {
  const dataRoot = process.env.IVEO_DATA_DIR
    ? path.resolve(process.env.IVEO_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  return path.join(dataRoot, 'card-banners');
}

function sanitizeSafeSegment(seg: string): string | null {
  const clean = (seg || '').replace(/^@+/, '').toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(clean) || clean.includes('..')) {
    return null;
  }
  return clean;
}

export function resolveCardBannerFilePath(
  username: string,
  fileName: string
): { filePath: string; mime: string } | null {
  const safeUser = sanitizeSafeSegment(username);
  if (!safeUser) return null;
  if (!/^[a-z0-9_-]{8,128}\.(png|jpg|jpeg|webp)$/i.test(fileName || '')) {
    return null;
  }

  const userDir = path.resolve(getCardBannersBaseDir(), safeUser);
  const candidate = path.resolve(userDir, fileName);
  if (!candidate.startsWith(userDir + path.sep)) {
    return null;
  }
  if (!fs.existsSync(candidate)) return null;

  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg';

  return { filePath: candidate, mime };
}

export function saveCardBannerBuffer(params: {
  username: string;
  rawBuf: Buffer;
  smallRawBuf?: Buffer | null;
}):
  | {
      ok: true;
      url: string;
      smallUrl: string | null;
      width: number;
      height: number;
      size: number;
      mime: string;
      hash: string;
    }
  | { ok: false; status: number; error: string; message: string } {
  const safeUser = sanitizeSafeSegment(params.username);
  if (!safeUser) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_username',
      message: 'Valid username is required.',
    };
  }

  const inspected = inspectAndSanitizeRasterBuffer(params.rawBuf, {
    maxBytes: BANNER_UPLOAD_LIMIT_BYTES,
    rejectAnimatedWebp: true,
  });
  if (!inspected.ok) {
    return {
      ok: false,
      status: inspected.status,
      error: inspected.code,
      message:
        inspected.code === 'file_too_large'
          ? BANNER_ERROR_MESSAGES.tooLarge
          : BANNER_ERROR_MESSAGES.unsupported,
    };
  }

  const { info } = inspected;
  if (info.width < BANNER_MIN_WIDTH || info.height < BANNER_MIN_HEIGHT) {
    return {
      ok: false,
      status: 422,
      error: 'image_too_small',
      message: BANNER_ERROR_MESSAGES.tooSmall,
    };
  }

  const userDir = path.join(getCardBannersBaseDir(), safeUser);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const hash = crypto
    .createHash('sha256')
    .update(info.sanitizedBuffer)
    .digest('hex')
    .slice(0, 24);
  const fileName = `${hash}.${info.format}`;
  const finalPath = path.join(userDir, fileName);
  const tmpPath = `${finalPath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmpPath, info.sanitizedBuffer);
  fs.renameSync(tmpPath, finalPath);

  let smallUrl: string | null = null;
  if (params.smallRawBuf && params.smallRawBuf.byteLength > 0) {
    const smallCheck = inspectAndSanitizeRasterBuffer(params.smallRawBuf, {
      maxBytes: BANNER_UPLOAD_LIMIT_BYTES,
      rejectAnimatedWebp: true,
    });
    if (smallCheck.ok && smallCheck.info.width >= 320 && smallCheck.info.height >= 80) {
      const smallName = `${hash}-sm.${smallCheck.info.format}`;
      const smallPath = path.join(userDir, smallName);
      const smallTmp = `${smallPath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(smallTmp, smallCheck.info.sanitizedBuffer);
      fs.renameSync(smallTmp, smallPath);
      smallUrl = `/api/cards/banner/${safeUser}/${smallName}`;
    }
  }

  return {
    ok: true,
    url: `/api/cards/banner/${safeUser}/${fileName}`,
    smallUrl,
    width: info.width,
    height: info.height,
    size: info.sanitizedBuffer.byteLength,
    mime: info.mime,
    hash,
  };
}

export function deleteCardBannerFilesForUrls(
  username: string,
  urls: string[],
  referencedUrls: Set<string>
): number {
  const safeUser = sanitizeSafeSegment(username);
  if (!safeUser) return 0;
  const userDir = path.resolve(getCardBannersBaseDir(), safeUser);
  let deleted = 0;

  for (const rawUrl of urls) {
    if (!rawUrl || referencedUrls.has(rawUrl.trim())) continue;
    const parsed = extractBannerFilePathFromUrl(rawUrl);
    if (!parsed || parsed.username !== safeUser) continue;

    const target = path.resolve(userDir, parsed.fileName);
    if (!target.startsWith(userDir + path.sep)) continue;
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        deleted++;
      }
    } catch {}
  }
  return deleted;
}

export function cleanupUnreferencedUserCardBanners(
  username: string,
  nextBlocks: Array<{ embedMeta?: any }>,
  removedCandidateUrls?: string[],
  nowMs = Date.now()
): number {
  const safeUser = sanitizeSafeSegment(username);
  if (!safeUser) return 0;
  const userDir = path.resolve(getCardBannersBaseDir(), safeUser);
  if (!fs.existsSync(userDir)) return 0;

  const referencedUrls = collectReferencedCardBannerUrls(nextBlocks);
  const referencedFiles = new Set<string>();
  for (const url of referencedUrls) {
    const parsed = extractBannerFilePathFromUrl(url);
    if (parsed && parsed.username === safeUser) {
      referencedFiles.add(parsed.fileName);
    }
  }

  let deleted = 0;
  if (removedCandidateUrls && removedCandidateUrls.length > 0) {
    deleted += deleteCardBannerFilesForUrls(safeUser, removedCandidateUrls, referencedUrls);
  }

  // Also prune orphaned / temp files older than 24 hours that aren't referenced by any saved block
  try {
    for (const file of fs.readdirSync(userDir)) {
      if (referencedFiles.has(file)) continue;
      const full = path.resolve(userDir, file);
      if (!full.startsWith(userDir + path.sep)) continue;
      try {
        const stat = fs.statSync(full);
        if (nowMs - stat.mtimeMs >= ORPHAN_MAX_AGE_MS) {
          fs.unlinkSync(full);
          deleted++;
        }
      } catch {}
    }
  } catch {}

  return deleted;
}

export function deleteUserCardBanners(username: string): void {
  const safeUser = sanitizeSafeSegment(username);
  if (!safeUser) return;
  const userDir = path.resolve(getCardBannersBaseDir(), safeUser);
  try {
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  } catch {}
}

async function resolveCardBannerActor(req: ExpressReq): Promise<
  | { ok: true; userId: string; email: string | null; username: string }
  | { ok: false; status: number; error: string; message: string }
> {
  const userId = String(
    req.headers['x-user-id'] ||
      req.headers['x-iveo-user-id'] ||
      req.query?.userId ||
      req.body?.userId ||
      ''
  ).trim();
  const email =
    String(
      req.headers['x-user-email'] ||
        req.headers['x-iveo-email'] ||
        req.query?.email ||
        req.body?.primaryEmail ||
        ''
    )
      .toLowerCase()
      .trim() || null;
  const requestedUsername = String(
    req.query?.username || req.body?.username || req.headers['x-iveo-username'] || ''
  )
    .replace(/^@+/, '')
    .toLowerCase()
    .trim();

  if (!userId && !email) {
    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: 'Authentication required to manage card banners.',
    };
  }

  let profile: any = null;
  if (requestedUsername) {
    profile = await dbGetProfile(requestedUsername).catch(() => null);
    if (!profile) {
      return {
        ok: false,
        status: 404,
        error: 'profile_not_found',
        message: 'Profile not found.',
      };
    }
    const authorized = await dbVerifyOwnership(requestedUsername, userId || '', email);
    if (!authorized) {
      return {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'You are not authorized to upload banners for this page.',
      };
    }
  } else {
    profile = await dbGetProfileByUserId(userId, email).catch(() => null);
    if (!profile || !profile.username) {
      return {
        ok: false,
        status: 404,
        error: 'profile_not_found',
        message: 'Claim your Iveo handle first.',
      };
    }
  }

  const cleanUsername = String(profile.username).replace(/^@+/, '').toLowerCase().trim();
  return {
    ok: true,
    userId: userId || String(profile.userId || cleanUsername),
    email: email || profile.primaryEmail || null,
    username: cleanUsername,
  };
}

function parseImageDataUrl(dataUrl: string): Buffer | null {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (mime === 'image/gif' || mime === 'image/svg+xml') {
    return Buffer.from(match[2].replace(/\s+/g, ''), 'base64'); // Let sanitizer reject explicitly with 415
  }
  return Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
}

export async function handleUploadCardBanner(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveCardBannerActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const rate = checkCardBannerUploadRateLimit(actor.userId || actor.username);
  if (!rate.allowed) {
    return res.status(429).json({
      error: 'rate_limited',
      retryAfterSec: rate.retryAfterSec,
      message: 'Too many banner uploads right now. Please try again later.',
    });
  }

  const rawDataUrl = String(req.body?.dataUrl || '');
  const rawBuf = parseImageDataUrl(rawDataUrl);
  if (!rawBuf) {
    return res.status(415).json({
      error: 'unsupported_image_format',
      message: BANNER_ERROR_MESSAGES.unsupported,
    });
  }

  const smallDataUrl = typeof req.body?.smallDataUrl === 'string' ? req.body.smallDataUrl : '';
  const smallRawBuf = smallDataUrl ? parseImageDataUrl(smallDataUrl) : null;

  const saved = saveCardBannerBuffer({
    username: actor.username,
    rawBuf,
    smallRawBuf,
  });
  if (!saved.ok) {
    return res.status(saved.status).json({ error: saved.error, message: saved.message });
  }

  // Optional immediate cleanup of an uncommitted previous upload URL
  const replaceUrls: string[] = [];
  if (typeof req.body?.replaceUrl === 'string') replaceUrls.push(req.body.replaceUrl);
  if (typeof req.body?.replaceSmallUrl === 'string') replaceUrls.push(req.body.replaceSmallUrl);
  if (replaceUrls.length > 0) {
    const existingBlocks = await dbGetBlocks(actor.username).catch(() => []);
    const referenced = collectReferencedCardBannerUrls(existingBlocks);
    referenced.add(saved.url);
    if (saved.smallUrl) referenced.add(saved.smallUrl);
    deleteCardBannerFilesForUrls(actor.username, replaceUrls, referenced);
  }

  return res.status(200).json({
    ok: true,
    url: saved.url,
    smallUrl: saved.smallUrl,
    width: saved.width,
    height: saved.height,
    size: saved.size,
    mime: saved.mime,
    hash: saved.hash,
  });
}

export async function handleServeCardBanner(req: ExpressReq, res: ExpressRes) {
  const username = String(req.params?.username || req.query?.username || '');
  const fileName = String(req.params?.file || req.query?.file || '');
  const resolved = resolveCardBannerFilePath(username, fileName);
  if (!resolved) {
    return res.status(404).json({ error: 'banner_not_found' });
  }

  res.setHeader('Content-Type', resolved.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(resolved.filePath);
}

export async function handleDeleteCardBanner(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveCardBannerActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const rawUrls: string[] = Array.isArray(req.body?.urls)
    ? req.body.urls.map((u: unknown) => String(u || ''))
    : typeof req.body?.url === 'string'
      ? [req.body.url]
      : [];

  if (rawUrls.length === 0) {
    return res.status(200).json({ ok: true, deleted: 0 });
  }

  const existingBlocks = await dbGetBlocks(actor.username).catch(() => []);
  const referenced = collectReferencedCardBannerUrls(existingBlocks);
  const deleted = deleteCardBannerFilesForUrls(actor.username, rawUrls, referenced);
  return res.status(200).json({ ok: true, deleted });
}

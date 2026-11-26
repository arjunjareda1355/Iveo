import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_BG_BYTES = 5 * 1024 * 1024; // 5MB raw limit

export function getBackgroundsBaseDir(): string {
  const dataRoot = process.env.IVEO_DATA_DIR
    ? path.resolve(process.env.IVEO_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  return path.join(dataRoot, 'backgrounds');
}

function sanitizeSafeSegment(seg: string): string | null {
  const clean = (seg || '').toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(clean) || clean.includes('..')) {
    return null;
  }
  return clean;
}

function detectImageTypeFromMagic(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.byteLength < 12) return null;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // WEBP: RIFF....WEBP
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // AVIF: ....ftypavif / ....ftypavis / ....ftypmif1
  const box = buf.toString('ascii', 4, 12);
  if (box.startsWith('ftyp') && /avif|avis|mif1/i.test(buf.toString('ascii', 8, 16))) {
    return { ext: 'avif', mime: 'image/avif' };
  }
  return null;
}

export function saveUploadedBackgroundImage(
  username: string,
  dataUrl: string
): { ok: true; url: string; mime: string; size: number } | { ok: false; error: string; status: number } {
  const safeUser = sanitizeSafeSegment(username.replace(/^@+/, ''));
  if (!safeUser) {
    return { ok: false, error: 'invalid_username', status: 400 };
  }

  if (typeof dataUrl !== 'string') {
    return { ok: false, error: 'missing_data_url', status: 400 };
  }

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|avif));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return {
      ok: false,
      error: 'unsupported_image_format',
      status: 415,
    };
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (buffer.byteLength === 0) {
    return { ok: false, error: 'empty_image', status: 400 };
  }
  if (buffer.byteLength > MAX_BG_BYTES) {
    return { ok: false, error: 'file_too_large_max_5mb', status: 413 };
  }

  const detected = detectImageTypeFromMagic(buffer);
  if (!detected) {
    return { ok: false, error: 'corrupted_or_unsupported_image', status: 415 };
  }

  const userDir = path.join(getBackgroundsBaseDir(), safeUser);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Keep user folder tidy: prune older uploaded background files (> 5) so disk stays bounded
  try {
    const existing = fs
      .readdirSync(userDir)
      .filter((f) => !f.endsWith('.tmp'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(userDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    existing.slice(4).forEach((old) => {
      try {
        fs.unlinkSync(path.join(userDir, old.name));
      } catch {}
    });
  } catch {}

  const fileName = `bg_${crypto.randomUUID()}.${detected.ext}`;
  const finalPath = path.join(userDir, fileName);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, finalPath);

  return {
    ok: true,
    url: `/api/backgrounds/${safeUser}/${fileName}`,
    mime: detected.mime,
    size: buffer.byteLength,
  };
}

export function resolveBackgroundFilePath(
  username: string,
  fileName: string
): { filePath: string; mime: string } | null {
  const safeUser = sanitizeSafeSegment(username.replace(/^@+/, ''));
  if (!safeUser) return null;
  if (!/^bg_[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp|avif)$/i.test(fileName || '')) {
    return null;
  }

  const userDir = path.resolve(getBackgroundsBaseDir(), safeUser);
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
        : ext === '.avif'
          ? 'image/avif'
          : 'image/jpeg';

  return { filePath: candidate, mime };
}

export function deleteUserUploadedBackgrounds(username: string): void {
  const safeUser = sanitizeSafeSegment(username.replace(/^@+/, ''));
  if (!safeUser) return;
  const userDir = path.resolve(getBackgroundsBaseDir(), safeUser);
  try {
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  } catch {}
}

export function pruneOrphanedUserBackgrounds(username: string, keepUrls: Iterable<string | null | undefined>): void {
  const safeUser = sanitizeSafeSegment(username.replace(/^@+/, ''));
  if (!safeUser) return;
  const userDir = path.resolve(getBackgroundsBaseDir(), safeUser);
  if (!fs.existsSync(userDir)) return;

  const keepFiles = new Set<string>();
  const prefix = `/api/backgrounds/${safeUser}/`;
  for (const rawUrl of keepUrls) {
    if (typeof rawUrl !== 'string') continue;
    const cleaned = rawUrl.split('?')[0].trim();
    if (cleaned.startsWith(prefix)) {
      const file = cleaned.slice(prefix.length);
      if (file && !file.includes('/') && !file.includes('..')) {
        keepFiles.add(file);
      }
    }
  }

  try {
    for (const file of fs.readdirSync(userDir)) {
      if (file.endsWith('.tmp')) continue;
      if (!keepFiles.has(file)) {
        const candidate = path.resolve(userDir, file);
        if (candidate.startsWith(userDir + path.sep)) {
          try { fs.unlinkSync(candidate); } catch {}
        }
      }
    }
    if (fs.readdirSync(userDir).length === 0) {
      try { fs.rmdirSync(userDir); } catch {}
    }
  } catch {}
}

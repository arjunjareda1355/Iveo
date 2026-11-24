import {
  BANNER_ERROR_MESSAGES,
  BANNER_MIN_HEIGHT,
  BANNER_MIN_WIDTH,
  BANNER_SMALL_HEIGHT,
  BANNER_SMALL_WIDTH,
  BANNER_TARGET_HEIGHT,
  BANNER_TARGET_WIDTH,
  BANNER_UPLOAD_LIMIT_BYTES,
} from './cardBanner';

export interface DecodedBannerFile {
  width: number;
  height: number;
  sourceUrl: string;
  fileName: string;
  originalSize: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CroppedBannerPayload {
  dataUrl: string;
  smallDataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

function isAnimatedWebpBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 16) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const fourcc = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const size = view.getUint32(offset + 4, true);
    if (fourcc === 'ANIM' || fourcc === 'ANMF') return true;
    if (fourcc === 'VP8X' && offset + 9 <= bytes.byteLength && (bytes[offset + 8] & 0x02) !== 0) {
      return true;
    }
    const padded = size + (size % 2);
    offset += 8 + (padded > 0 ? padded : 0);
    if (padded === 0 && size === 0) break;
  }
  return false;
}

export async function validateBannerImageFile(file: File): Promise<
  | { ok: true; decoded: DecodedBannerFile }
  | { ok: false; message: string }
> {
  if (!file) {
    return { ok: false, message: BANNER_ERROR_MESSAGES.unsupported };
  }

  if (file.size > BANNER_UPLOAD_LIMIT_BYTES) {
    return { ok: false, message: BANNER_ERROR_MESSAGES.tooLarge };
  }

  const headerSlice = await file.slice(0, Math.min(file.size, 256)).arrayBuffer();
  const bytes = new Uint8Array(headerSlice);
  let detectedMime: 'image/jpeg' | 'image/png' | 'image/webp' | null = null;

  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    detectedMime = 'image/png';
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedMime = 'image/jpeg';
  } else if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const fullHeader = new Uint8Array(await file.slice(0, Math.min(file.size, 4096)).arrayBuffer());
    if (isAnimatedWebpBytes(fullHeader)) {
      return { ok: false, message: BANNER_ERROR_MESSAGES.unsupported };
    }
    detectedMime = 'image/webp';
  }

  if (!detectedMime) {
    return { ok: false, message: BANNER_ERROR_MESSAGES.unsupported };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    let width = 0;
    let height = 0;

    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } else {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode_failed'));
        el.src = objectUrl;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
    }

    if (width < BANNER_MIN_WIDTH || height < BANNER_MIN_HEIGHT) {
      URL.revokeObjectURL(objectUrl);
      return { ok: false, message: BANNER_ERROR_MESSAGES.tooSmall };
    }

    return {
      ok: true,
      decoded: {
        width,
        height,
        sourceUrl: objectUrl,
        fileName: file.name || 'banner',
        originalSize: file.size,
        mimeType: detectedMime,
      },
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return { ok: false, message: BANNER_ERROR_MESSAGES.loadFailed };
  }
}

function estimateDataUrlByteSize(dataUrl: string): number {
  const idx = dataUrl.indexOf(',');
  if (idx < 0) return 0;
  const b64 = dataUrl.slice(idx + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function canvasToWebpOrJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.82
): string {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  const jpg = canvas.toDataURL('image/jpeg', 0.86);
  if (!jpg.startsWith('data:image/')) {
    throw new Error('encode_failed');
  }
  return jpg;
}

function isCrossOriginHttpUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Renders a 4:1 banner image (1584x396 + 792x198) from a source image URL using
 * the chosen focalX (0-100), focalY (0-100), and zoom (1.0-3.0).
 */
export async function renderCroppedBannerWebp(params: {
  sourceUrl: string;
  focalX?: number;
  focalY?: number;
  zoom?: number;
}): Promise<CroppedBannerPayload> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    if (isCrossOriginHttpUrl(params.sourceUrl)) {
      el.crossOrigin = 'anonymous';
    }
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('load_failed'));
    el.src = params.sourceUrl;
  });

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const targetRatio = BANNER_TARGET_WIDTH / BANNER_TARGET_HEIGHT; // 4:1
  const srcRatio = srcW / Math.max(1, srcH);

  const zoom = Math.max(1, Math.min(3, params.zoom ?? 1));
  const focalX = Math.max(0, Math.min(100, params.focalX ?? 50)) / 100;
  const focalY = Math.max(0, Math.min(100, params.focalY ?? 40)) / 100;

  // Base cover crop rectangle in source pixel space at zoom = 1
  let baseCropW = srcW;
  let baseCropH = srcH;
  if (srcRatio > targetRatio) {
    // Source is wider than 4:1
    baseCropH = srcH;
    baseCropW = srcH * targetRatio;
  } else {
    // Source is taller than 4:1
    baseCropW = srcW;
    baseCropH = srcW / targetRatio;
  }

  const cropW = baseCropW / zoom;
  const cropH = baseCropH / zoom;
  const sx = Math.max(0, Math.min(srcW - cropW, (srcW - cropW) * focalX));
  const sy = Math.max(0, Math.min(srcH - cropH, (srcH - cropH) * focalY));

  // Output dimensions: 1584x396 when source supports it (clamped >= 800x200)
  const outW = Math.max(
    BANNER_MIN_WIDTH,
    Math.min(
      BANNER_TARGET_WIDTH,
      Math.round(srcW >= BANNER_TARGET_WIDTH ? BANNER_TARGET_WIDTH : Math.max(BANNER_MIN_WIDTH, cropW))
    )
  );
  const outH = Math.round(outW / 4);

  const mainCanvas = document.createElement('canvas');
  mainCanvas.width = outW;
  mainCanvas.height = outH;
  const mainCtx = mainCanvas.getContext('2d');
  if (!mainCtx) throw new Error('canvas_unavailable');
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.imageSmoothingQuality = 'medium';
  mainCtx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = BANNER_SMALL_WIDTH;
  smallCanvas.height = BANNER_SMALL_HEIGHT;
  const smallCtx = smallCanvas.getContext('2d');
  if (!smallCtx) throw new Error('canvas_unavailable');
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.imageSmoothingQuality = 'medium';
  smallCtx.drawImage(mainCanvas, 0, 0, BANNER_SMALL_WIDTH, BANNER_SMALL_HEIGHT);

  const dataUrl = canvasToWebpOrJpegDataUrl(mainCanvas, 0.82);
  const smallDataUrl = canvasToWebpOrJpegDataUrl(smallCanvas, 0.8);

  return {
    dataUrl,
    smallDataUrl,
    width: outW,
    height: outH,
    sizeBytes: estimateDataUrlByteSize(dataUrl),
  };
}

export function uploadBannerToServerWithProgress(params: {
  dataUrl: string;
  smallDataUrl?: string;
  username: string;
  userId: string;
  primaryEmail?: string | null;
  replaceUrl?: string | null;
  replaceSmallUrl?: string | null;
  onProgress?: (percent: number) => void;
}): Promise<{
  ok: true;
  url: string;
  smallUrl: string | null;
  width: number;
  height: number;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/cards/banner', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-user-id', params.userId);
    xhr.setRequestHeader('x-iveo-username', params.username);
    if (params.primaryEmail) {
      xhr.setRequestHeader('x-user-email', params.primaryEmail);
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && params.onProgress) {
        const pct = Math.min(95, Math.max(10, Math.round((ev.loaded / ev.total) * 90)));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && parsed?.ok && parsed?.url) {
          params.onProgress?.(100);
          resolve(parsed);
        } else {
          reject(new Error(parsed?.message || BANNER_ERROR_MESSAGES.uploadFailed));
        }
      } catch {
        reject(new Error(BANNER_ERROR_MESSAGES.uploadFailed));
      }
    };

    xhr.onerror = () => reject(new Error(BANNER_ERROR_MESSAGES.uploadFailed));
    xhr.onabort = () => reject(new Error('upload_aborted'));

    xhr.send(
      JSON.stringify({
        username: params.username,
        userId: params.userId,
        primaryEmail: params.primaryEmail || undefined,
        dataUrl: params.dataUrl,
        smallDataUrl: params.smallDataUrl || undefined,
        replaceUrl: params.replaceUrl || undefined,
        replaceSmallUrl: params.replaceSmallUrl || undefined,
      })
    );
  });
}

export async function deleteCardBannersFromServer(params: {
  urls: string[];
  username?: string | null;
  userId?: string | null;
  primaryEmail?: string | null;
}): Promise<void> {
  const validUrls = params.urls.filter(
    (u) => typeof u === 'string' && u.startsWith('/api/cards/banner/')
  );
  if (validUrls.length === 0 || !params.userId || !params.username) return;

  try {
    await fetch('/api/cards/banner', {
      method: 'DELETE',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': params.userId,
        'x-iveo-username': params.username,
        ...(params.primaryEmail ? { 'x-user-email': params.primaryEmail } : {}),
      },
      body: JSON.stringify({
        username: params.username,
        userId: params.userId,
        primaryEmail: params.primaryEmail || undefined,
        urls: validUrls,
      }),
    });
  } catch {}
}

export function formatFileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

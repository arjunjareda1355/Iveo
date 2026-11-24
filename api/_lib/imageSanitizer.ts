export type SupportedRasterFormat = 'png' | 'jpg' | 'webp';

export interface ParsedImageInfo {
  format: SupportedRasterFormat;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  sanitizedBuffer: Buffer;
}

export interface ImageValidationFailure {
  ok: false;
  code:
    | 'empty_image'
    | 'file_too_large'
    | 'unsupported_image_format'
    | 'animated_image_not_allowed'
    | 'corrupted_or_unsupported_image';
  status: number;
  message: string;
}

export interface ImageValidationSuccess {
  ok: true;
  info: ParsedImageInfo;
}

export function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 24) return null;
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47 ||
    buf[4] !== 0x0d ||
    buf[5] !== 0x0a ||
    buf[6] !== 0x1a ||
    buf[7] !== 0x0a
  ) {
    return null;
  }
  const chunkType = buf.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 && width <= 32768 && height <= 32768
    ? { width, height }
    : null;
}

export function stripPngMetadata(buf: Buffer): Buffer {
  // Keep critical & color rendering chunks; strip eXIf, tEXt, zTXt, iTXt, tIME, etc.
  const keepTypes = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM', 'tRNS', 'pHYs']);
  const chunks: Buffer[] = [buf.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= buf.byteLength) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const total = 12 + len;
    if (offset + total > buf.byteLength) break;
    if (keepTypes.has(type)) {
      chunks.push(buf.subarray(offset, offset + total));
    }
    offset += total;
    if (type === 'IEND') break;
  }
  return chunks.length > 1 ? Buffer.concat(chunks) : buf;
}

export function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.byteLength) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.byteLength) break;
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 9 <= buf.byteLength) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
      }
    }
    offset += 2 + segLen;
  }
  return null;
}

export function stripJpegExif(buf: Buffer): Buffer {
  if (buf.byteLength < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let offset = 2;
  while (offset + 2 <= buf.byteLength) {
    if (buf[offset] !== 0xff) {
      parts.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    if (marker === 0xda) {
      parts.push(buf.subarray(offset));
      break;
    }
    if (marker === 0xd9) {
      parts.push(buf.subarray(offset, offset + 2));
      break;
    }
    if (offset + 4 > buf.byteLength) {
      parts.push(buf.subarray(offset));
      break;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) {
      parts.push(buf.subarray(offset));
      break;
    }
    const segEnd = Math.min(buf.byteLength, offset + 2 + segLen);
    // Strip APP1..APP15 (EXIF/XMP/IPTC) and COM comments; preserve APP0 JFIF & APP2 ICC
    const isStrippableApp = (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2) || marker === 0xfe;
    if (!isStrippableApp) {
      parts.push(buf.subarray(offset, segEnd));
    }
    offset = segEnd;
  }
  return Buffer.concat(parts);
}

export function isAnimatedWebp(buf: Buffer): boolean {
  if (
    buf.byteLength < 16 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return false;
  }
  let offset = 12;
  while (offset + 8 <= buf.byteLength) {
    const fourcc = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (fourcc === 'ANIM' || fourcc === 'ANMF') {
      return true;
    }
    if (fourcc === 'VP8X' && offset + 9 <= buf.byteLength) {
      const flags = buf[offset + 8];
      if ((flags & 0x02) !== 0) return true;
    }
    const paddedSize = size + (size % 2);
    if (paddedSize <= 0 && size === 0) {
      offset += 8;
    } else {
      offset += 8 + paddedSize;
    }
  }
  return false;
}

export function stripWebpMetadata(buf: Buffer): Buffer {
  if (
    buf.byteLength < 16 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return buf;
  }
  const keptChunks: Buffer[] = [];
  let offset = 12;
  let strippedAny = false;
  while (offset + 8 <= buf.byteLength) {
    const fourcc = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const paddedSize = size + (size % 2);
    const end = Math.min(buf.byteLength, offset + 8 + paddedSize);

    if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      strippedAny = true;
      offset = end;
      continue;
    }

    const chunkBuf = Buffer.from(buf.subarray(offset, end));
    if (fourcc === 'VP8X' && chunkBuf.byteLength >= 9) {
      // Clear EXIF (0x08) and XMP (0x04) feature flags in VP8X payload byte 0
      chunkBuf[8] = chunkBuf[8] & ~0x0c;
    }
    keptChunks.push(chunkBuf);
    offset = end;
  }

  if (!strippedAny) return buf;
  const body = Buffer.concat(keptChunks);
  const out = Buffer.allocUnsafe(12 + body.byteLength);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(4 + body.byteLength, 4);
  out.write('WEBP', 8, 'ascii');
  body.copy(out, 12);
  return out;
}

export function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (
    buf.byteLength < 25 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ' && buf.byteLength >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (chunk === 'VP8L' && buf.byteLength >= 25) {
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (chunk === 'VP8X' && buf.byteLength >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  return null;
}

export function inspectAndSanitizeRasterBuffer(
  rawBuf: Buffer,
  options?: { maxBytes?: number; rejectAnimatedWebp?: boolean }
): ImageValidationSuccess | ImageValidationFailure {
  if (!rawBuf || rawBuf.byteLength === 0) {
    return {
      ok: false,
      code: 'empty_image',
      status: 400,
      message: 'Image file is empty.',
    };
  }

  const maxBytes = options?.maxBytes ?? 5 * 1024 * 1024;
  if (rawBuf.byteLength > maxBytes) {
    return {
      ok: false,
      code: 'file_too_large',
      status: 413,
      message: `That file is too large. Choose an image under ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  // Explicitly reject SVG / XML / GIF
  const headText = rawBuf.subarray(0, 64).toString('utf8').trimStart().toLowerCase();
  if (headText.startsWith('<svg') || headText.startsWith('<?xml') || headText.startsWith('<!doctype svg')) {
    return {
      ok: false,
      code: 'unsupported_image_format',
      status: 415,
      message: 'Use a JPG, PNG, or WebP image.',
    };
  }
  if (rawBuf.byteLength >= 6) {
    const gifSig = rawBuf.toString('ascii', 0, 6);
    if (gifSig === 'GIF87a' || gifSig === 'GIF89a') {
      return {
        ok: false,
        code: 'unsupported_image_format',
        status: 415,
        message: 'Use a JPG, PNG, or WebP image.',
      };
    }
  }

  // PNG
  if (rawBuf.byteLength >= 8 && rawBuf[0] === 0x89 && rawBuf[1] === 0x50 && rawBuf[2] === 0x4e && rawBuf[3] === 0x47) {
    const dims = parsePngDimensions(rawBuf);
    if (!dims) {
      return {
        ok: false,
        code: 'corrupted_or_unsupported_image',
        status: 415,
        message: 'Use a JPG, PNG, or WebP image.',
      };
    }
    return {
      ok: true,
      info: {
        format: 'png',
        mime: 'image/png',
        width: dims.width,
        height: dims.height,
        sanitizedBuffer: stripPngMetadata(rawBuf),
      },
    };
  }

  // JPEG
  if (rawBuf.byteLength >= 3 && rawBuf[0] === 0xff && rawBuf[1] === 0xd8 && rawBuf[2] === 0xff) {
    const dims = parseJpegDimensions(rawBuf);
    if (!dims) {
      return {
        ok: false,
        code: 'corrupted_or_unsupported_image',
        status: 415,
        message: 'Use a JPG, PNG, or WebP image.',
      };
    }
    return {
      ok: true,
      info: {
        format: 'jpg',
        mime: 'image/jpeg',
        width: dims.width,
        height: dims.height,
        sanitizedBuffer: stripJpegExif(rawBuf),
      },
    };
  }

  // WebP
  if (
    rawBuf.byteLength >= 12 &&
    rawBuf.toString('ascii', 0, 4) === 'RIFF' &&
    rawBuf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    if (options?.rejectAnimatedWebp !== false && isAnimatedWebp(rawBuf)) {
      return {
        ok: false,
        code: 'animated_image_not_allowed',
        status: 415,
        message: 'Use a JPG, PNG, or WebP image.',
      };
    }
    const dims = parseWebpDimensions(rawBuf);
    if (!dims) {
      return {
        ok: false,
        code: 'corrupted_or_unsupported_image',
        status: 415,
        message: 'Use a JPG, PNG, or WebP image.',
      };
    }
    return {
      ok: true,
      info: {
        format: 'webp',
        mime: 'image/webp',
        width: dims.width,
        height: dims.height,
        sanitizedBuffer: stripWebpMetadata(rawBuf),
      },
    };
  }

  return {
    ok: false,
    code: 'unsupported_image_format',
    status: 415,
    message: 'Use a JPG, PNG, or WebP image.',
  };
}

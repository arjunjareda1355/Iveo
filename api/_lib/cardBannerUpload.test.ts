import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectAndSanitizeRasterBuffer } from './imageSanitizer.ts';
import {
  checkCardBannerUploadRateLimit,
  cleanupUnreferencedUserCardBanners,
  deleteUserCardBanners,
  resetCardBannerRateLimitForTests,
  resolveCardBannerFilePath,
  saveCardBannerBuffer,
} from './cardBannerUpload.ts';
import { BANNER_UPLOAD_LIMIT_BYTES } from '../../src/lib/cardBanner.ts';

function buildMinimalPng(width: number, height: number, extraChunks: Array<{ type: string; data: Buffer }> = []): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB

  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.byteLength, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); // zeroed CRC sufficient for chunk framing tests
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const chunks = [
    sig,
    makeChunk('IHDR', ihdrData),
    ...extraChunks.map((c) => makeChunk(c.type, c.data)),
    makeChunk('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])),
    makeChunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

function buildMinimalJpegWithApp1Exif(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  // APP1 EXIF segment containing GPS/camera string
  const exifPayload = Buffer.from('Exif\0\0TestCameraGPSLocationSecret');
  const app1 = Buffer.alloc(4 + exifPayload.byteLength);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(2 + exifPayload.byteLength, 2);
  exifPayload.copy(app1, 4);

  // SOF0 marker: FF C0 [len=11] [prec=8] [height:2] [width:2] [components=1] [c1:3]
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 1;
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x00, 0xff, 0xd9]);
  return Buffer.concat([soi, app1, sof0, sos]);
}

function buildAnimatedWebp(): Buffer {
  const vp8x = Buffer.alloc(18);
  vp8x.write('VP8X', 0, 'ascii');
  vp8x.writeUInt32LE(10, 4);
  vp8x[8] = 0x02; // Animation flag
  // width-1 = 999, height-1 = 299
  vp8x[12] = 999 & 0xff;
  vp8x[13] = (999 >> 8) & 0xff;
  vp8x[14] = (999 >> 16) & 0xff;
  vp8x[15] = 299 & 0xff;
  vp8x[16] = (299 >> 8) & 0xff;
  vp8x[17] = (299 >> 16) & 0xff;

  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + vp8x.byteLength, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, vp8x]);
}

test('rejects SVG, GIF, animated WebP, and oversized uploads', () => {
  const svgRes = inspectAndSanitizeRasterBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  assert.equal(svgRes.ok, false);
  if (!svgRes.ok) assert.equal(svgRes.code, 'unsupported_image_format');

  const gifRes = inspectAndSanitizeRasterBuffer(Buffer.from('GIF89a\x01\x00\x01\x00'));
  assert.equal(gifRes.ok, false);
  if (!gifRes.ok) assert.equal(gifRes.code, 'unsupported_image_format');

  const animWebp = inspectAndSanitizeRasterBuffer(buildAnimatedWebp(), { rejectAnimatedWebp: true });
  assert.equal(animWebp.ok, false);
  if (!animWebp.ok) assert.equal(animWebp.code, 'animated_image_not_allowed');

  const tooBig = inspectAndSanitizeRasterBuffer(Buffer.alloc(BANNER_UPLOAD_LIMIT_BYTES + 1));
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.code, 'file_too_large');
});

test('strips EXIF from JPEG and tEXt/eXIf from PNG', () => {
  const jpeg = buildMinimalJpegWithApp1Exif(1200, 300);
  const resJpg = inspectAndSanitizeRasterBuffer(jpeg);
  assert.equal(resJpg.ok, true);
  if (resJpg.ok) {
    assert.equal(resJpg.info.width, 1200);
    assert.equal(resJpg.info.height, 300);
    assert.equal(resJpg.info.sanitizedBuffer.includes('TestCameraGPSLocationSecret'), false);
  }

  const png = buildMinimalPng(1200, 300, [
    { type: 'tEXt', data: Buffer.from('Author\0SecretMetadata') },
    { type: 'eXIf', data: Buffer.from('FakeExifPayload') },
  ]);
  const resPng = inspectAndSanitizeRasterBuffer(png);
  assert.equal(resPng.ok, true);
  if (resPng.ok) {
    assert.equal(resPng.info.width, 1200);
    assert.equal(resPng.info.height, 300);
    assert.equal(resPng.info.sanitizedBuffer.includes('SecretMetadata'), false);
    assert.equal(resPng.info.sanitizedBuffer.includes('FakeExifPayload'), false);
  }
});

test('rejects images smaller than 800x200 and writes content-hashed files cleanly with cleanup', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-banner-test-'));
  const prevDir = process.env.IVEO_DATA_DIR;
  process.env.IVEO_DATA_DIR = tmpRoot;

  try {
    const tooSmall = saveCardBannerBuffer({
      username: 'tester',
      rawBuf: buildMinimalPng(799, 250),
    });
    assert.equal(tooSmall.ok, false);
    if (!tooSmall.ok) {
      assert.equal(tooSmall.status, 422);
      assert.equal(tooSmall.error, 'image_too_small');
    }

    const valid = saveCardBannerBuffer({
      username: 'tester',
      rawBuf: buildMinimalPng(1584, 396),
      smallRawBuf: buildMinimalPng(792, 198),
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.match(valid.url, /^\/api\/cards\/banner\/tester\/[a-f0-9]{24}\.png$/);
      assert.ok(valid.smallUrl?.endsWith('-sm.png'));
      const fileName = path.basename(valid.url);
      const resolved = resolveCardBannerFilePath('tester', fileName);
      assert.ok(resolved);
      assert.equal(fs.existsSync(resolved.filePath), true);

      // Traversal blocked
      assert.equal(resolveCardBannerFilePath('tester', '../secret.png'), null);

      // Cleanup unreferenced file when removed from saved blocks
      const deleted = cleanupUnreferencedUserCardBanners(
        'tester',
        [],
        [valid.url, valid.smallUrl!]
      );
      assert.equal(deleted, 2);
      assert.equal(fs.existsSync(resolved.filePath), false);
    }

    deleteUserCardBanners('tester');
  } finally {
    if (prevDir === undefined) delete process.env.IVEO_DATA_DIR;
    else process.env.IVEO_DATA_DIR = prevDir;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('enforces per-user sliding-window upload rate limit (10/hour)', () => {
  resetCardBannerRateLimitForTests();
  const baseNow = 1_700_000_000_000;
  for (let i = 0; i < 10; i++) {
    const check = checkCardBannerUploadRateLimit('user_1', baseNow + i * 1000);
    assert.equal(check.allowed, true);
  }
  const blocked = checkCardBannerUploadRateLimit('user_1', baseNow + 20_000);
  assert.equal(blocked.allowed, false);
  assert.ok((blocked.retryAfterSec ?? 0) > 0);
  resetCardBannerRateLimitForTests();
});

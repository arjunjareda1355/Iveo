import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

// Isolate test storage inside a temporary directory before importing DB modules
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-appearance-api-test-'));
process.env.IVEO_DATA_DIR = TEMP_DIR;
process.env.LOCAL_DATA_DIR = TEMP_DIR;
process.env.IVEO_DISABLE_REMOTE_DB = '1';

const { dbSaveProfile, dbWriteAppearanceState } = await import('../api/_lib/azureSql.ts');
const {
  handleCreateTheme,
  handleDeleteTheme,
  handleGetAppearance,
  handlePatchAppearance,
  handleRedoAppearance,
  handleRenameTheme,
  handleApplyTheme,
  handleUndoAppearance,
  handleUploadAppearanceBgImage,
  resetAppearanceRateLimitForTests,
} = await import('../api/_lib/appearance-handlers.ts');

function createMockRes() {
  const headers: Record<string, string> = {};
  const state: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.body = payload;
      return res;
    },
    getHeaders() {
      return headers;
    },
    get state() {
      return state;
    },
  };
  return res;
}

function makeReq(opts: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}) {
  return {
    headers: opts.headers || {},
    query: opts.query || {},
    params: opts.params || {},
    body: opts.body || {},
  } as any;
}

function makeMinimalPng(width: number, height: number, includeExif = false): Buffer {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  const row = Buffer.alloc(4); // filter + 1 pixel RGB
  const idat = zlib.deflateSync(row);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [sig, chunk('IHDR', ihdr)];
  if (includeExif) {
    parts.push(chunk('eXIf', Buffer.from('FAKE_GPS_EXIF_DATA', 'ascii')));
    parts.push(chunk('tEXt', Buffer.from('Comment\0secret', 'ascii')));
  }
  parts.push(chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

describe('Appearance REST API & Security Enforcement', () => {
  after(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    resetAppearanceRateLimitForTests();
    for (const uname of ['freeuser', 'prouser']) {
      await dbWriteAppearanceState(uname, () => ({
        nextProfile: null,
        nextHistory: { undoStack: [], redoStack: [], lastCoalesceKey: null, lastCoalesceAt: 0 },
        nextThemes: [],
        result: true,
      }));
    }
    await dbSaveProfile({
      userId: 'user-free-1',
      username: 'freeuser',
      primaryEmail: 'free@example.com',
      displayName: 'Free User',
      plan: 'free',
      createdAt: '2027-02-01T00:00:00.000Z',
      vibeId: 'clean',
    });
    await dbSaveProfile({
      userId: 'user-pro-1',
      username: 'prouser',
      primaryEmail: 'pro@example.com',
      displayName: 'Pro User',
      plan: 'pro',
      vibeId: 'obsidian',
    });
  });

  it('rejects unauthenticated (401) and cross-user (403) requests', async () => {
    const r401 = createMockRes();
    await handleGetAppearance(makeReq({ query: { username: 'freeuser' } }), r401);
    assert.equal(r401.state.statusCode, 401);

    const r403 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-free-1', 'x-user-email': 'free@example.com' },
        body: { username: 'prouser', patch: { buttons: { shape: 'pill' } } },
      }),
      r403
    );
    assert.equal(r403.state.statusCode, 403);
  });

  it('validates colors, gradient stops, and bio font rules (400)', async () => {
    const badHexRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-pro-1' },
        body: { username: 'prouser', patch: { background: { type: 'solid', color: '#ZZZZZZ' } } },
      }),
      badHexRes
    );
    assert.equal(badHexRes.state.statusCode, 400);

    const badStopsRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-pro-1' },
        body: {
          username: 'prouser',
          patch: {
            background: {
              type: 'gradient',
              kind: 'linear',
              angle: 90,
              stops: [
                { color: '#000000', at: 0 },
                { color: '#222222', at: 25 },
                { color: '#444444', at: 50 },
                { color: '#666666', at: 75 },
                { color: '#888888', at: 100 },
              ],
            },
          },
        },
      }),
      badStopsRes
    );
    assert.equal(badStopsRes.state.statusCode, 400);

    const badBioRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-pro-1' },
        body: {
          username: 'prouser',
          patch: {
            typography: {
              bio: { family: 'Caveat', weight: 400, size: 'm', tracking: 'normal', source: 'user' },
            },
          },
        },
      }),
      badBioRes
    );
    assert.equal(badBioRes.state.statusCode, 400);
  });

  it('enforces server-side Pro gating with 402 PRO_REQUIRED', async () => {
    const blockedRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-free-1' },
        body: { username: 'freeuser', patch: { vibeId: 'oat-milk' } },
      }),
      blockedRes
    );
    assert.equal(blockedRes.state.statusCode, 402);
    assert.equal(blockedRes.state.body.code, 'PRO_REQUIRED');

    // Partial patch saves allowed free field and reports gated Pro field
    const partialRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: { 'x-user-id': 'user-free-1' },
        body: {
          username: 'freeuser',
          patch: {
            buttons: { shape: 'pill', surface: 'glass' },
          },
        },
      }),
      partialRes
    );
    assert.equal(partialRes.state.statusCode, 402);
    assert.equal(partialRes.state.body.partialApplied, true);
    assert.equal(partialRes.state.body.appearance.buttons.shape, 'pill');
    assert.notEqual(partialRes.state.body.appearance.buttons.surface, 'glass');
  });

  it('supports 20-step Undo/Redo, 2s coalescing, and 409 optimistic conflicts', async () => {
    const h = { 'x-user-id': 'user-pro-1' };

    const getRes = createMockRes();
    await handleGetAppearance(makeReq({ headers: h, query: { username: 'prouser' } }), getRes);
    const initialUpdatedAt = getRes.state.body.updatedAt;

    // Two edits with same coalesceKey merge into 1 undo step
    for (let r = 8; r <= 12; r += 4) {
      const p = createMockRes();
      await handlePatchAppearance(
        makeReq({
          headers: h,
          body: { username: 'prouser', coalesceKey: 'btn-radius', patch: { buttons: { shape: 'custom', radius: r } } },
        }),
        p
      );
      assert.equal(p.state.statusCode, 200);
    }

    const getAfterCoalesce = createMockRes();
    await handleGetAppearance(makeReq({ headers: h, query: { username: 'prouser' } }), getAfterCoalesce);
    assert.equal(getAfterCoalesce.state.body.historyMeta.undoCount, 1);

    // Undo restores previous state cleanly
    const undoRes = createMockRes();
    await handleUndoAppearance(makeReq({ headers: h, body: { username: 'prouser' } }), undoRes);
    assert.equal(undoRes.state.statusCode, 200);

    // Redo re-applies custom radius 12
    const redoRes = createMockRes();
    await handleRedoAppearance(makeReq({ headers: h, body: { username: 'prouser' } }), redoRes);
    assert.equal(redoRes.state.statusCode, 200);
    assert.equal(redoRes.state.body.appearance.buttons.radius, 12);

    // Stale ifUpdatedAt triggers 409 CONFLICT
    const conflictRes = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: h,
        body: {
          username: 'prouser',
          ifUpdatedAt: initialUpdatedAt || '1999-01-01T00:00:00.000Z',
          patch: { buttons: { shape: 'square' } },
        },
      }),
      conflictRes
    );
    assert.equal(conflictRes.state.statusCode, 409);
    assert.equal(conflictRes.state.body.code, 'CONFLICT');
  });

  it('enforces saved theme limits (Free=1, Pro=10) & CRUD', async () => {
    const freeHdrs = { 'x-user-id': 'user-free-1' };
    const t1 = createMockRes();
    await handleCreateTheme(makeReq({ headers: freeHdrs, body: { username: 'freeuser', name: 'First' } }), t1);
    assert.equal(t1.state.statusCode, 201);

    const t2 = createMockRes();
    await handleCreateTheme(makeReq({ headers: freeHdrs, body: { username: 'freeuser', name: 'Second' } }), t2);
    assert.equal(t2.state.statusCode, 402);

    const themeId = t1.state.body.theme.id;
    const ren = createMockRes();
    await handleRenameTheme(
      makeReq({ headers: freeHdrs, params: { id: themeId }, query: { username: 'freeuser' }, body: { name: 'Renamed' } }),
      ren
    );
    assert.equal(ren.state.statusCode, 200);
    assert.equal(ren.state.body.theme.name, 'Renamed');

    const appRes = createMockRes();
    await handleApplyTheme(
      makeReq({ headers: freeHdrs, params: { id: themeId }, body: { username: 'freeuser' } }),
      appRes
    );
    assert.equal(appRes.state.statusCode, 200);

    const delRes = createMockRes();
    await handleDeleteTheme(
      makeReq({ headers: freeHdrs, params: { id: themeId }, query: { username: 'freeuser' } }),
      delRes
    );
    assert.equal(delRes.state.statusCode, 200);
    assert.equal(delRes.state.body.themes.length, 0);
  });

  it('rejects small background photos (<1080px) with 422 and strips PNG EXIF/tEXt metadata', async () => {
    const proHdrs = { 'x-user-id': 'user-pro-1' };
    const smallPng = `data:image/png;base64,${makeMinimalPng(800, 600).toString('base64')}`;
    const smallRes = createMockRes();
    await handleUploadAppearanceBgImage(
      makeReq({ headers: proHdrs, body: { username: 'prouser', dataUrl: smallPng } }),
      smallRes
    );
    assert.equal(smallRes.state.statusCode, 422);

    const bigPng = `data:image/png;base64,${makeMinimalPng(1200, 1400, true).toString('base64')}`;
    const okRes = createMockRes();
    await handleUploadAppearanceBgImage(
      makeReq({ headers: proHdrs, body: { username: 'prouser', dataUrl: bigPng } }),
      okRes
    );
    assert.equal(okRes.state.statusCode, 200);
    assert.match(okRes.state.body.assetId, /^\/api\/backgrounds\/prouser\/bg_.*\.png$/);

    // Verify stored file has NO eXIf or tEXt metadata chunks
    const fileName = path.basename(okRes.state.body.assetId);
    const savedBytes = fs.readFileSync(path.join(TEMP_DIR, 'backgrounds', 'prouser', fileName));
    assert.equal(savedBytes.includes(Buffer.from('eXIf')), false);
    assert.equal(savedBytes.includes(Buffer.from('tEXt')), false);
  });

  it('rate-limits writes beyond 60 requests per minute (429)', async () => {
    const proHdrs = { 'x-user-id': 'user-pro-1' };
    for (let i = 0; i < 60; i++) {
      const r = createMockRes();
      await handlePatchAppearance(
        makeReq({
          headers: proHdrs,
          body: { username: 'prouser', coalesceKey: 'rate-test', patch: { buttons: { radius: i % 20 } } },
        }),
        r
      );
      assert.equal(r.state.statusCode, 200);
    }

    const r61 = createMockRes();
    await handlePatchAppearance(
      makeReq({
        headers: proHdrs,
        body: { username: 'prouser', patch: { buttons: { radius: 10 } } },
      }),
      r61
    );
    assert.equal(r61.state.statusCode, 429);
  });
});

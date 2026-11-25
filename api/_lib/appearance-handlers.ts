import type { Request as ExpressReq, Response as ExpressRes } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  dbGetProfile,
  dbGetProfileByUserId,
  dbReadAppearanceState,
  dbSaveProfile,
  dbVerifyOwnership,
  dbWriteAppearanceState,
} from './azureSql.ts';
import {
  firebaseGetAppearanceState,
  firebaseGetProfile,
  firebaseGetProfileByUserId,
  firebaseSaveAppearanceState,
  firebaseSaveProfile,
} from './firebaseServer.ts';
import { invalidatePublicPageCache } from './db-handlers.ts';
import { notifyProfileSeoChanged } from './seoService.ts';
import { getBackgroundsBaseDir } from './backgroundUpload.ts';
import { inspectAndSanitizeRasterBuffer } from './imageSanitizer.ts';
import { isPrivilegedEmailServer } from './usernames.ts';
import { resolveEffectivePlan } from '../../src/lib/plan.ts';
import {
  HISTORY_COALESCE_MS,
  MAX_HISTORY_SNAPSHOTS,
  THEME_LIMITS,
  type Appearance,
  type AppearanceLock,
  type Background,
  type ButtonShapeV2,
  type ButtonSurface,
  type ButtonTokens,
  type Color,
  type FontRole,
  type Hex,
  type HistorySnapshot,
  type LayoutTokens,
  type PatternOverlayType,
  type ResolvedTokens,
  type ThemePreset,
} from '../../src/lib/appearance/types.ts';
import {
  appearanceToLegacyMirror,
  migrateLegacyProfileToAppearanceV2,
} from '../../src/lib/appearance/migrate.ts';
import { resolveTokens } from '../../src/lib/appearance/resolveTokens.ts';
import { CATALOG_VIBES, findCatalogVibe } from '../../src/lib/appearance/catalog/vibes.ts';
import { CATALOG_BACKGROUNDS, findCatalogBackground } from '../../src/lib/appearance/catalog/backgrounds.ts';
import { CATALOG_FONTS, clampWeightToFont, findCatalogFont } from '../../src/lib/appearance/catalog/fonts.ts';
import { CATALOG_SURFACES, checkSurfaceCompatibility } from '../../src/lib/appearance/catalog/surfaces.ts';
import { CATALOG_AVATAR_FRAMES } from '../../src/lib/appearance/catalog/layouts.ts';
import { contrastRatio } from '../../src/lib/color/contrast.ts';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_WRITES = 60;
const writeRateLimitMap = new Map<string, number[]>();

function checkAppearanceWriteRateLimit(actorKey: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const timestamps = (writeRateLimitMap.get(actorKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX_WRITES) {
    const oldest = timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    writeRateLimitMap.set(actorKey, timestamps);
    return { allowed: false, retryAfterSec };
  }
  timestamps.push(now);
  writeRateLimitMap.set(actorKey, timestamps);
  return { allowed: true };
}

export function resetAppearanceRateLimitForTests() {
  writeRateLimitMap.clear();
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

interface ResolvedActor {
  ok: true;
  userId: string;
  email: string | null;
  username: string;
  profile: Record<string, any>;
  isPro: boolean;
  plan: 'free' | 'pro';
}

interface RejectedActor {
  ok: false;
  status: number;
  error: string;
  message: string;
}

async function resolveAppearanceActor(req: ExpressReq): Promise<ResolvedActor | RejectedActor> {
  const userId = String(
    req.headers['x-user-id'] || req.headers['x-iveo-user-id'] || req.query?.userId || req.body?.userId || ''
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
      message: 'Authentication required to manage appearance.',
    };
  }

  let profile: any = null;
  if (requestedUsername) {
    const [dbProf, fbProf] = await Promise.all([
      dbGetProfile(requestedUsername).catch(() => null),
      withTimeout(firebaseGetProfile(requestedUsername), null),
    ]);
    profile =
      dbProf && fbProf && (fbProf.updatedAt || '') > (dbProf.updatedAt || '')
        ? { ...dbProf, ...fbProf }
        : dbProf || fbProf;

    if (!profile) {
      return {
        ok: false,
        status: 404,
        error: 'profile_not_found',
        message: 'Profile not found.',
      };
    }

    const authorized = await dbVerifyOwnership(
      requestedUsername,
      userId || '',
      email
    );
    if (!authorized) {
      return {
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'You are not authorized to edit this page appearance.',
      };
    }
  } else {
    const [dbProf, fbProf] = await Promise.all([
      dbGetProfileByUserId(userId, email).catch(() => null),
      withTimeout(firebaseGetProfileByUserId(userId, email), null),
    ]);
    profile =
      dbProf && fbProf && (fbProf.updatedAt || '') > (dbProf.updatedAt || '')
        ? { ...dbProf, ...fbProf }
        : dbProf || fbProf;

    if (!profile || !profile.username) {
      return {
        ok: false,
        status: 404,
        error: 'profile_not_found',
        message: 'Claim your Iveo handle before customizing appearance.',
      };
    }
  }

  const cleanUsername = String(profile.username).replace(/^@+/, '').toLowerCase().trim();
  const resolvedEmail = email || profile.primaryEmail || null;
  const planInfo = resolveEffectivePlan({
    email: resolvedEmail,
    storedPlan: profile.plan,
    isProFlag: profile.isPro,
    createdAt: profile.createdAt || profile.claimedAt || null,
    subscription: profile.subscription || null,
  });

  return {
    ok: true,
    userId: userId || String(profile.userId || 'owner'),
    email: resolvedEmail,
    username: cleanUsername,
    profile,
    isPro: planInfo.isPro,
    plan: planInfo.plan,
  };
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const HEX6_RE = /^#([0-9a-fA-F]{6})$/;
const RGBA_RE = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/;

function validateHex6(val: unknown): Hex | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!HEX6_RE.test(trimmed)) return null;
  return trimmed.toUpperCase() as Hex;
}

function validateColorOrTransparent(val: unknown, allowTransparent: boolean): Color | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (allowTransparent && trimmed === 'transparent') return 'transparent';
  const hex = validateHex6(trimmed);
  if (hex) return hex;
  if (RGBA_RE.test(trimmed)) return trimmed.replace(/\s+/g, '') as Color;
  return null;
}

const VALID_VIBE_IDS = new Set(CATALOG_VIBES.map((v) => v.id));
const VALID_BG_IDS = new Set(CATALOG_BACKGROUNDS.map((b) => b.id));
const VALID_SURFACE_IDS = new Set(CATALOG_SURFACES.map((s) => s.id));
const VALID_FRAME_IDS = new Set(CATALOG_AVATAR_FRAMES.map((f) => f.id));
const VALID_LOCKS = new Set<AppearanceLock>([
  'background',
  'btn.fill',
  'btn.text',
  'btn.border',
  'font.name',
  'font.bio',
  'font.button',
  'layout',
]);
const VALID_PATTERNS = new Set<PatternOverlayType>(['none', 'dots', 'grid', 'lines', 'contours']);

interface ValidatedPatchResult {
  ok: true;
  nextAppearance: Appearance;
  proFields: string[];
  hadNonProChanges: boolean;
}

interface ValidationError {
  ok: false;
  status: number;
  error: string;
  message: string;
}

function validateAndMergeAppearancePatch(
  current: Appearance,
  rawPatch: Record<string, any>,
  isPro: boolean
): ValidatedPatchResult | ValidationError {
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    return { ok: false, status: 400, error: 'invalid_patch', message: 'Appearance patch must be an object.' };
  }

  let next: Appearance = JSON.parse(JSON.stringify(current));
  const proFields: string[] = [];
  let hadNonProChanges = false;

  // 1. vibeId
  if (rawPatch.vibeId !== undefined) {
    if (typeof rawPatch.vibeId !== 'string' || !VALID_VIBE_IDS.has(rawPatch.vibeId)) {
      return { ok: false, status: 400, error: 'invalid_vibe_id', message: 'Unknown vibe ID.' };
    }
    const v = findCatalogVibe(rawPatch.vibeId);
    if (!isPro && v?.tier === 'pro') {
      proFields.push('vibeId');
    } else {
      next.vibeId = rawPatch.vibeId;
      hadNonProChanges = true;
    }
  }

  // 2. background
  if (rawPatch.background !== undefined) {
    const rawBg = rawPatch.background;
    if (!rawBg || typeof rawBg !== 'object') {
      return { ok: false, status: 400, error: 'invalid_background', message: 'Invalid background object.' };
    }
    if (rawBg.type === 'preset') {
      if (typeof rawBg.id !== 'string' || !VALID_BG_IDS.has(rawBg.id)) {
        return { ok: false, status: 400, error: 'invalid_background_preset', message: 'Unknown background preset ID.' };
      }
      const pMeta = findCatalogBackground(rawBg.id);
      const patternKind: PatternOverlayType =
        rawBg.pattern?.kind && VALID_PATTERNS.has(rawBg.pattern.kind) ? rawBg.pattern.kind : 'none';
      const cleanedPreset: Background = {
        type: 'preset',
        id: rawBg.id,
        ...(rawBg.grain !== undefined ? { grain: clampNum(rawBg.grain, 0, 40, 0) } : {}),
        ...(rawBg.blur !== undefined ? { blur: clampNum(rawBg.blur, 0, 60, 0) } : {}),
        ...(rawBg.vignette !== undefined ? { vignette: clampNum(rawBg.vignette, 0, 50, 0) } : {}),
        ...(rawBg.tone !== undefined ? { tone: clampNum(rawBg.tone, -20, 20, 0) } : {}),
        ...(rawBg.pattern
          ? {
              pattern: {
                kind: patternKind,
                opacity: clampNum(rawBg.pattern.opacity, 0, 30, 12),
              },
            }
          : {}),
        ...(rawBg.animate !== undefined ? { animate: Boolean(rawBg.animate) } : {}),
      };

      const needsProPreset = pMeta?.tier === 'pro';
      const needsProAnimate = cleanedPreset.animate === true;
      if (!isPro && (needsProPreset || needsProAnimate)) {
        if (needsProPreset) proFields.push('background.preset');
        if (needsProAnimate) proFields.push('background.animate');
      } else {
        next.background = cleanedPreset;
        hadNonProChanges = true;
      }
    } else if (rawBg.type === 'solid') {
      const hex = validateHex6(rawBg.color);
      if (!hex) {
        return { ok: false, status: 400, error: 'invalid_hex_color', message: 'Solid background color must be 6-digit hex.' };
      }
      next.background = { type: 'solid', color: hex };
      hadNonProChanges = true;
    } else if (rawBg.type === 'gradient') {
      const kind = rawBg.kind === 'radial' || rawBg.kind === 'conic' ? rawBg.kind : 'linear';
      const angle = clampNum(rawBg.angle, 0, 360, 135);
      if (!Array.isArray(rawBg.stops) || rawBg.stops.length < 2 || rawBg.stops.length > 4) {
        return { ok: false, status: 400, error: 'invalid_gradient_stops', message: 'Gradient must have 2 to 4 stops.' };
      }
      const parsedStops: Array<{ color: Hex; at: number }> = [];
      for (const st of rawBg.stops) {
        const c = validateHex6(st?.color);
        if (!c) {
          return { ok: false, status: 400, error: 'invalid_gradient_color', message: 'Gradient stop color must be 6-digit hex.' };
        }
        parsedStops.push({ color: c, at: clampNum(st?.at, 0, 100, 0) });
      }
      parsedStops.sort((a, b) => a.at - b.at);
      next.background = { type: 'gradient', kind, angle, stops: parsedStops };
      hadNonProChanges = true;
    } else if (rawBg.type === 'image') {
      if (typeof rawBg.assetId !== 'string' || !rawBg.assetId.trim()) {
        return { ok: false, status: 400, error: 'invalid_image_asset', message: 'Background image requires assetId.' };
      }
      if (!isPro) {
        proFields.push('background.image');
      } else {
        let overlayParsed: { color: Hex; alpha: number } | undefined;
        if (rawBg.overlay && typeof rawBg.overlay === 'object') {
          const ovHex = validateHex6(rawBg.overlay.color);
          if (!ovHex) {
            return { ok: false, status: 400, error: 'invalid_overlay_color', message: 'Overlay color must be 6-digit hex.' };
          }
          overlayParsed = {
            color: ovHex,
            alpha: clampNum(rawBg.overlay.alpha, 0, 0.85, 0.3),
          };
        }
        const domColors = Array.isArray(rawBg.dominantColors)
          ? rawBg.dominantColors.map((c: unknown) => validateHex6(c)).filter((c: Hex | null): c is Hex => c !== null).slice(0, 6)
          : undefined;
        const lumGrid =
          Array.isArray(rawBg.luminanceGrid) && rawBg.luminanceGrid.length === 64
            ? rawBg.luminanceGrid.map((v: unknown) => clampNum(v, 0, 1, 0.5))
            : undefined;
        next.background = {
          type: 'image',
          assetId: rawBg.assetId.trim().slice(0, 512),
          blur: clampNum(rawBg.blur, 0, 40, 0),
          opacity: clampNum(rawBg.opacity, 30, 100, 100),
          brightness: clampNum(rawBg.brightness, 60, 120, 100),
          ...(overlayParsed ? { overlay: overlayParsed } : {}),
          focal: {
            x: clampNum(rawBg.focal?.x, 0, 100, 50),
            y: clampNum(rawBg.focal?.y, 0, 100, 50),
          },
          smartScrim: rawBg.smartScrim !== false,
          ...(domColors && domColors.length > 0 ? { dominantColors: domColors } : {}),
          ...(lumGrid ? { luminanceGrid: lumGrid } : {}),
        };
        hadNonProChanges = true;
      }
    } else if (rawBg.type === 'legacy') {
      next.background = {
        type: 'legacy',
        css: String(rawBg.css || '#FFFFFF').slice(0, 1024),
        isDark: Boolean(rawBg.isDark),
        baseHex: validateHex6(rawBg.baseHex) || '#FFFFFF',
      };
      hadNonProChanges = true;
    } else {
      return { ok: false, status: 400, error: 'invalid_background_type', message: 'Unsupported background type.' };
    }
  }

  // 3. typography
  if (rawPatch.typography !== undefined) {
    if (!rawPatch.typography || typeof rawPatch.typography !== 'object') {
      return { ok: false, status: 400, error: 'invalid_typography', message: 'Invalid typography object.' };
    }
    const roles: Array<'name' | 'bio' | 'button'> = ['name', 'bio', 'button'];
    const proposedTypo = { ...next.typography };
    let typoChanged = false;
    for (const role of roles) {
      const incomingRole = rawPatch.typography[role];
      if (incomingRole === undefined) continue;
      if (!incomingRole || typeof incomingRole !== 'object') {
        return { ok: false, status: 400, error: 'invalid_font_role', message: `Invalid ${role} font configuration.` };
      }
      const catFont = incomingRole.family ? findCatalogFont(String(incomingRole.family)) : findCatalogFont(proposedTypo[role].family);
      if (!catFont) {
        return { ok: false, status: 400, error: 'unknown_font_family', message: `Unknown font family for ${role}.` };
      }
      if (!isPro && catFont.tier === 'pro') {
        proFields.push(`typography.${role}`);
        continue;
      }
      if (role === 'bio' && catFont.excludeFromBio) {
        return { ok: false, status: 400, error: 'bio_font_excluded', message: `${catFont.family} cannot be used for Bio body text.` };
      }
      const curRole = proposedTypo[role];
      const nextRole: FontRole = {
        family: catFont.family,
        weight: clampWeightToFont(catFont, Number(incomingRole.weight ?? curRole.weight)),
        size: incomingRole.size === 's' || incomingRole.size === 'm' || incomingRole.size === 'l' ? incomingRole.size : curRole.size,
        tracking: incomingRole.tracking === 'tight' || incomingRole.tracking === 'normal' || incomingRole.tracking === 'wide' ? incomingRole.tracking : curRole.tracking,
        case: incomingRole.case === 'upper' || incomingRole.case === 'normal' ? incomingRole.case : curRole.case,
        lineHeight: incomingRole.lineHeight === 'compact' || incomingRole.lineHeight === 'normal' || incomingRole.lineHeight === 'relaxed'
          ? incomingRole.lineHeight
          : curRole.lineHeight,
        source: incomingRole.source === 'vibe' || incomingRole.source === 'user' || incomingRole.source === 'suggestion' ? incomingRole.source : 'user',
      };
      proposedTypo[role] = nextRole;
      typoChanged = true;
    }
    if (typoChanged) {
      const distinct = new Set([proposedTypo.name.family, proposedTypo.bio.family, proposedTypo.button.family]);
      if (distinct.size > 3) {
        return { ok: false, status: 400, error: 'max_font_families', message: 'At most 3 distinct font families allowed.' };
      }
      next.typography = proposedTypo;
      hadNonProChanges = true;
    }
  }

  // 4. buttons
  if (rawPatch.buttons !== undefined) {
    const rb = rawPatch.buttons;
    if (!rb || typeof rb !== 'object') {
      return { ok: false, status: 400, error: 'invalid_buttons', message: 'Invalid buttons object.' };
    }
    const nextBtn: ButtonTokens = { ...next.buttons, states: { ...(next.buttons.states || {}) } };
    if (rb.shape !== undefined) {
      if (!['square', 'rounded', 'pill', 'custom'].includes(rb.shape)) {
        return { ok: false, status: 400, error: 'invalid_button_shape', message: 'Invalid button shape.' };
      }
      nextBtn.shape = rb.shape as ButtonShapeV2;
      hadNonProChanges = true;
    }
    if (rb.radius !== undefined) {
      nextBtn.radius = Math.round(clampNum(rb.radius, 0, 40, nextBtn.radius));
      hadNonProChanges = true;
    }
    if (rb.fill !== undefined) {
      const c = validateColorOrTransparent(rb.fill, true);
      if (!c) {
        return { ok: false, status: 400, error: 'invalid_button_fill', message: 'Invalid button fill color.' };
      }
      nextBtn.fill = c;
      hadNonProChanges = true;
    }
    if (rb.text !== undefined) {
      const c = validateColorOrTransparent(rb.text, false);
      if (!c) {
        return { ok: false, status: 400, error: 'invalid_button_text', message: 'Invalid button text color.' };
      }
      nextBtn.text = c;
      hadNonProChanges = true;
    }
    if (rb.border !== undefined) {
      const c = validateColorOrTransparent(rb.border, true);
      if (!c) {
        return { ok: false, status: 400, error: 'invalid_button_border', message: 'Invalid button border color.' };
      }
      nextBtn.border = c;
      hadNonProChanges = true;
    }
    if (rb.borderWidth !== undefined) {
      const bw = Math.round(clampNum(rb.borderWidth, 0, 4, nextBtn.borderWidth));
      nextBtn.borderWidth = bw as 0 | 1 | 2 | 3 | 4;
      hadNonProChanges = true;
    }
    if (rb.surface !== undefined) {
      if (typeof rb.surface !== 'string' || !VALID_SURFACE_IDS.has(rb.surface as ButtonSurface)) {
        return { ok: false, status: 400, error: 'invalid_button_surface', message: 'Unknown button surface.' };
      }
      const surfMeta = CATALOG_SURFACES.find((s) => s.id === rb.surface);
      if (!isPro && surfMeta?.tier === 'pro') {
        proFields.push('buttons.surface');
      } else {
        nextBtn.surface = rb.surface as ButtonSurface;
        hadNonProChanges = true;
      }
    }
    if (rb.gradient !== undefined) {
      if (rb.gradient === null) {
        delete nextBtn.gradient;
      } else {
        const gHex = validateHex6(rb.gradient?.to);
        if (!gHex) {
          return { ok: false, status: 400, error: 'invalid_button_gradient', message: 'Invalid button gradient color.' };
        }
        nextBtn.gradient = { to: gHex, angle: clampNum(rb.gradient?.angle, 0, 360, 135) };
      }
      hadNonProChanges = true;
    }
    if (rb.size !== undefined && ['s', 'm', 'l'].includes(rb.size)) {
      nextBtn.size = rb.size;
      hadNonProChanges = true;
    }
    if (rb.shadow !== undefined && ['none', 'soft', 'deep'].includes(rb.shadow)) {
      nextBtn.shadow = rb.shadow;
      hadNonProChanges = true;
    }
    if (rb.align !== undefined && ['center', 'left'].includes(rb.align)) {
      nextBtn.align = rb.align;
      hadNonProChanges = true;
    }
    if (rb.icon !== undefined && ['left', 'right', 'none'].includes(rb.icon)) {
      nextBtn.icon = rb.icon;
      hadNonProChanges = true;
    }
    if (rb.motion !== undefined && ['none', 'lift', 'press', 'shine'].includes(rb.motion)) {
      nextBtn.motion = rb.motion;
      hadNonProChanges = true;
    }
    if (rb.tracking !== undefined && ['tight', 'normal', 'wide'].includes(rb.tracking)) {
      nextBtn.tracking = rb.tracking;
      hadNonProChanges = true;
    }
    if (rb.case !== undefined && ['normal', 'upper'].includes(rb.case)) {
      nextBtn.case = rb.case;
      hadNonProChanges = true;
    }
    if (rb.weight !== undefined && [400, 500, 600, 700].includes(Number(rb.weight))) {
      nextBtn.weight = Number(rb.weight) as 400 | 500 | 600 | 700;
      hadNonProChanges = true;
    }
    next.buttons = nextBtn;
  }

  // 5. layout
  if (rawPatch.layout !== undefined) {
    const rl = rawPatch.layout;
    if (!rl || typeof rl !== 'object') {
      return { ok: false, status: 400, error: 'invalid_layout', message: 'Invalid layout object.' };
    }
    const nextLayout: LayoutTokens = {
      ...next.layout,
      avatar: { ...next.layout.avatar },
    };
    if (rl.header !== undefined) {
      if (!['centered', 'editorial', 'compact', 'hero'].includes(rl.header)) {
        return { ok: false, status: 400, error: 'invalid_header_layout', message: 'Invalid header layout.' };
      }
      nextLayout.header = rl.header;
      hadNonProChanges = true;
    }
    if (rl.avatar && typeof rl.avatar === 'object') {
      if (rl.avatar.frame !== undefined) {
        if (!VALID_FRAME_IDS.has(rl.avatar.frame)) {
          return { ok: false, status: 400, error: 'invalid_avatar_frame', message: 'Unknown avatar frame.' };
        }
        nextLayout.avatar.frame = rl.avatar.frame;
        hadNonProChanges = true;
      }
      if (rl.avatar.size !== undefined && ['s', 'm', 'l', 'xl'].includes(rl.avatar.size)) {
        nextLayout.avatar.size = rl.avatar.size;
        hadNonProChanges = true;
      }
      if (rl.avatar.glow !== undefined && ['none', 'soft', 'accent'].includes(rl.avatar.glow)) {
        nextLayout.avatar.glow = rl.avatar.glow;
        hadNonProChanges = true;
      }
    }
    if (rl.linkLayout !== undefined && ['stack', 'grid2', 'chips'].includes(rl.linkLayout)) {
      nextLayout.linkLayout = rl.linkLayout;
      hadNonProChanges = true;
    }
    if (rl.spacing !== undefined && ['compact', 'balanced', 'airy'].includes(rl.spacing)) {
      nextLayout.spacing = rl.spacing;
      hadNonProChanges = true;
    }
    if (rl.width !== undefined && ['focused', 'standard', 'wide'].includes(rl.width)) {
      nextLayout.width = rl.width;
      hadNonProChanges = true;
    }
    if (rl.entrance !== undefined && ['none', 'fade-up', 'stagger-scale'].includes(rl.entrance)) {
      nextLayout.entrance = rl.entrance;
      hadNonProChanges = true;
    }
    if (rl.socialIcons !== undefined && ['outline', 'filled', 'glass'].includes(rl.socialIcons)) {
      nextLayout.socialIcons = rl.socialIcons;
      hadNonProChanges = true;
    }
    next.layout = nextLayout;
  }

  // 6. locks & autoMatchButtons
  if (rawPatch.locks !== undefined) {
    if (!Array.isArray(rawPatch.locks)) {
      return { ok: false, status: 400, error: 'invalid_locks', message: 'Locks must be an array.' };
    }
    next.locks = Array.from(new Set(rawPatch.locks.filter((l: unknown): l is AppearanceLock => VALID_LOCKS.has(l as AppearanceLock))));
    hadNonProChanges = true;
  }
  if (rawPatch.autoMatchButtons !== undefined) {
    next.autoMatchButtons = Boolean(rawPatch.autoMatchButtons);
    hadNonProChanges = true;
  }
  if (rawPatch.migratedFrom === null) {
    delete next.migratedFrom;
  }

  next.schemaVersion = 2;
  next.updatedAt = new Date().toISOString();

  return { ok: true, nextAppearance: next, proFields, hadNonProChanges };
}

function computeAppearanceWarnings(resolved: ResolvedTokens, appearance: Appearance) {
  const warnings: Array<{ code: string; message: string; severity: 'info' | 'warn' }> = [];

  if (resolved.buttons.fill !== 'transparent') {
    const cr = contrastRatio(resolved.buttons.text, resolved.buttons.fill);
    if (cr < 4.5) {
      warnings.push({
        code: 'BUTTON_TEXT_CONTRAST',
        message: `Button text contrast (${cr.toFixed(1)}:1) is below 4.5:1. Tap Auto contrast to fix.`,
        severity: 'warn',
      });
    }
  }

  const compat = checkSurfaceCompatibility(
    resolved.buttons.surface,
    resolved.bgProfile,
    resolved.background,
    resolved.pageAccent,
    resolved.pageText
  );
  if (!compat.allowed && compat.reason) {
    warnings.push({
      code: 'SURFACE_INCOMPATIBLE',
      message: `${resolved.buttons.surface}: ${compat.reason}`,
      severity: 'info',
    });
  }

  if (appearance.layout.header === 'hero' && (appearance.layout.avatar.size === 's' || appearance.layout.avatar.size === 'm')) {
    warnings.push({
      code: 'HERO_AVATAR_BUMP',
      message: 'Hero header automatically upgrades avatar size for framing.',
      severity: 'info',
    });
  }

  return warnings;
}

async function persistAppearanceUpdate(
  actor: ResolvedActor,
  nextAppearance: Appearance,
  nextHistory?: { undoStack: HistorySnapshot[]; redoStack: HistorySnapshot[]; lastCoalesceKey?: string | null; lastCoalesceAt?: number },
  nextThemes?: ThemePreset[]
): Promise<{ updatedAt: string; themes: ThemePreset[]; profile?: any; history: { undoCount: number; redoCount: number } }> {
  const updatedAt = nextAppearance.updatedAt || new Date().toISOString();
  const normalizedAppearance: Appearance = { ...nextAppearance, schemaVersion: 2, updatedAt };
  const legacy = appearanceToLegacyMirror(normalizedAppearance, actor.profile.layoutSettings);

  const persisted = await dbWriteAppearanceState(actor.username, (cur) => {
    const baseProf = cur.profile || actor.profile || { username: actor.username, userId: actor.userId };
    const finalThemes = nextThemes !== undefined ? nextThemes : cur.themes;
    const finalHistory = nextHistory !== undefined ? nextHistory : cur.history;
    const nextProf = {
      ...baseProf,
      vibeId: normalizedAppearance.vibeId,
      buttonShape: legacy.buttonShape,
      buttonColors: legacy.buttonColors,
      fontSettings: legacy.fontSettings,
      layoutSettings: legacy.layoutSettings,
      appearance: normalizedAppearance,
      updatedAt,
    };
    return {
      nextProfile: nextProf,
      nextHistory: finalHistory,
      nextThemes: finalThemes,
      result: {
        updatedAt,
        themes: finalThemes as ThemePreset[],
        profile: nextProf,
        history: {
          undoCount: Array.isArray(finalHistory?.undoStack) ? finalHistory.undoStack.length : 0,
          redoCount: Array.isArray(finalHistory?.redoStack) ? finalHistory.redoStack.length : 0,
        },
      },
    };
  });

  const savedProfileRes = await dbSaveProfile({
    userId: actor.userId,
    username: actor.username,
    primaryEmail: actor.email,
    vibeId: normalizedAppearance.vibeId,
    buttonShape: legacy.buttonShape,
    buttonColors: legacy.buttonColors,
    fontSettings: legacy.fontSettings,
    layoutSettings: legacy.layoutSettings,
    appearance: normalizedAppearance,
    updatedAt,
  }).catch(() => null);

  const fullProfileForFirebase = savedProfileRes?.profile || {
    ...persisted.profile,
    primaryEmail: actor.email || persisted.profile?.primaryEmail || null,
    updatedAt,
  };

  await Promise.all([
    withTimeout(
      firebaseSaveProfile(
        actor.username,
        fullProfileForFirebase,
        actor.userId
      ),
      undefined
    ),
    withTimeout(
      firebaseSaveAppearanceState(
        actor.username,
        {
          appearance: normalizedAppearance,
          history: nextHistory,
          themes: persisted.themes,
        },
        actor.userId
      ),
      undefined
    ),
  ]);

  invalidatePublicPageCache(actor.username);
  notifyProfileSeoChanged('updated', actor.username).catch(() => {});
  return persisted;
}

/**
 * GET /api/appearance
 */
export async function handleGetAppearance(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const [localState, fbState] = await Promise.all([
    dbReadAppearanceState(actor.username).catch(() => ({
      profile: actor.profile,
      history: { undoStack: [], redoStack: [] },
      themes: [],
    })),
    withTimeout(firebaseGetAppearanceState(actor.username), null),
  ]);

  const prof = localState.profile || actor.profile;
  const localUpdatedAt = prof?.updatedAt || '';
  const fbUpdatedAt = (fbState as any)?.updatedAt || '';
  const useFbAppearance =
    fbState?.appearance?.schemaVersion === 2 &&
    (prof?.appearance?.schemaVersion !== 2 || fbUpdatedAt > localUpdatedAt);
  const rawAppearance = useFbAppearance
    ? fbState!.appearance
    : prof?.appearance?.schemaVersion === 2
      ? prof.appearance
      : fbState?.appearance?.schemaVersion === 2
        ? fbState.appearance
        : null;

  const appearance = migrateLegacyProfileToAppearanceV2({
    vibeId: prof?.vibeId,
    buttonShape: prof?.buttonShape,
    background: prof?.background,
    fontSettings: prof?.fontSettings,
    buttonColors: prof?.buttonColors,
    layoutSettings: prof?.layoutSettings,
    appearance: rawAppearance,
    onboardingComplete: true,
  });

  const resolved = resolveTokens(appearance, { isPro: actor.isPro });
  const warnings = computeAppearanceWarnings(resolved, appearance);
  const themes = (localState.themes?.length ? localState.themes : fbState?.themes) || [];
  const history =
    (localState.history?.undoStack?.length || localState.history?.redoStack?.length)
      ? localState.history
      : fbState?.history || localState.history || { undoStack: [], redoStack: [] };

  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({
    ok: true,
    appearance,
    resolved,
    entitlements: {
      plan: actor.plan,
      isPro: actor.isPro,
      themeLimit: THEME_LIMITS[actor.isPro ? 'pro' : 'free'],
      isOwner: isPrivilegedEmailServer(actor.email),
    },
    warnings,
    themes,
    historyMeta: {
      undoCount: Array.isArray(history.undoStack) ? history.undoStack.length : 0,
      redoCount: Array.isArray(history.redoStack) ? history.redoStack.length : 0,
    },
    updatedAt: prof?.updatedAt || appearance.updatedAt || null,
  });
}

/**
 * PATCH /api/appearance
 */
export async function handlePatchAppearance(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const rate = checkAppearanceWriteRateLimit(actor.userId || actor.username);
  if (!rate.allowed) {
    if (rate.retryAfterSec) res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({ error: 'rate_limited', message: 'Too many appearance saves. Slow down slightly.' });
  }

  const body = req.body || {};
  const patch =
    body.patch && typeof body.patch === 'object'
      ? body.patch
      : body.appearance && typeof body.appearance === 'object'
        ? body.appearance
        : body;
  const ifUpdatedAt = typeof body.ifUpdatedAt === 'string' ? body.ifUpdatedAt : null;
  const coalesceKey = typeof body.coalesceKey === 'string' ? body.coalesceKey : null;

  const state = await dbReadAppearanceState(actor.username);
  const currentUpdatedAt = state.profile?.updatedAt || actor.profile?.updatedAt || null;
  if (ifUpdatedAt && currentUpdatedAt && ifUpdatedAt !== currentUpdatedAt) {
    const currentAppearance = migrateLegacyProfileToAppearanceV2({
      vibeId: actor.profile.vibeId,
      buttonShape: actor.profile.buttonShape,
      background: actor.profile.background,
      fontSettings: actor.profile.fontSettings,
      buttonColors: actor.profile.buttonColors,
      layoutSettings: actor.profile.layoutSettings,
      appearance: actor.profile.appearance || null,
      onboardingComplete: true,
    });
    return res.status(409).json({
      code: 'CONFLICT',
      error: 'conflict',
      message: 'Appearance was updated in another tab or device.',
      appearance: currentAppearance,
      updatedAt: currentUpdatedAt,
    });
  }

  const currentAppearance = migrateLegacyProfileToAppearanceV2({
    vibeId: (state.profile || actor.profile).vibeId,
    buttonShape: (state.profile || actor.profile).buttonShape,
    background: (state.profile || actor.profile).background,
    fontSettings: (state.profile || actor.profile).fontSettings,
    buttonColors: (state.profile || actor.profile).buttonColors,
    layoutSettings: (state.profile || actor.profile).layoutSettings,
    appearance: (state.profile || actor.profile).appearance || null,
    onboardingComplete: true,
  });

  const validated = validateAndMergeAppearancePatch(currentAppearance, patch, actor.isPro);
  if (!validated.ok) {
    return res.status(validated.status).json({ error: validated.error, message: validated.message });
  }

  // If the entire request was gated Pro fields for a Free account, return 402 without mutating
  if (validated.proFields.length > 0 && !validated.hadNonProChanges) {
    return res.status(402).json({
      code: 'PRO_REQUIRED',
      error: 'pro_required',
      fields: validated.proFields,
      message: 'Upgrade to Pro to apply this style.',
    });
  }

  const nowMs = Date.now();
  const prevHistory = state.history || { undoStack: [], redoStack: [] };
  const canCoalesce =
    Boolean(coalesceKey) &&
    coalesceKey === prevHistory.lastCoalesceKey &&
    nowMs - (prevHistory.lastCoalesceAt || 0) <= HISTORY_COALESCE_MS;

  const nextUndoStack = canCoalesce
    ? prevHistory.undoStack || []
    : [
        ...(prevHistory.undoStack || []).slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
        {
          id: crypto.randomUUID(),
          data: currentAppearance,
          createdAt: new Date().toISOString(),
        } as HistorySnapshot,
      ];

  const nextHistory = {
    undoStack: nextUndoStack,
    redoStack: [],
    lastCoalesceKey: coalesceKey || null,
    lastCoalesceAt: nowMs,
  };

  const persisted = await persistAppearanceUpdate(actor, validated.nextAppearance, nextHistory);
  const resolved = resolveTokens(validated.nextAppearance, { isPro: actor.isPro });
  const warnings = computeAppearanceWarnings(resolved, validated.nextAppearance);

  if (validated.proFields.length > 0) {
    return res.status(402).json({
      code: 'PRO_REQUIRED',
      error: 'pro_required',
      fields: validated.proFields,
      partialApplied: true,
      appearance: validated.nextAppearance,
      resolved,
      warnings,
      historyMeta: persisted.history,
      updatedAt: persisted.updatedAt,
    });
  }

  return res.status(200).json({
    ok: true,
    appearance: validated.nextAppearance,
    resolved,
    warnings,
    historyMeta: persisted.history,
    updatedAt: persisted.updatedAt,
  });
}

/**
 * POST /api/appearance/undo
 */
export async function handleUndoAppearance(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const state = await dbReadAppearanceState(actor.username);
  const undoStack = [...(state.history?.undoStack || [])];
  if (undoStack.length === 0) {
    return res.status(400).json({ error: 'nothing_to_undo', message: 'No previous appearance step to undo.' });
  }

  const currentAppearance = migrateLegacyProfileToAppearanceV2({
    ...(state.profile || actor.profile),
    onboardingComplete: true,
  });

  const popped = undoStack.pop()!;
  const targetAppearance: Appearance = {
    ...popped.data,
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
  };

  const redoStack = [
    ...(state.history?.redoStack || []).slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
    {
      id: crypto.randomUUID(),
      data: currentAppearance,
      createdAt: new Date().toISOString(),
    } as HistorySnapshot,
  ];

  const persisted = await persistAppearanceUpdate(actor, targetAppearance, {
    undoStack,
    redoStack,
    lastCoalesceKey: null,
    lastCoalesceAt: 0,
  });
  const resolved = resolveTokens(targetAppearance, { isPro: actor.isPro });

  return res.status(200).json({
    ok: true,
    appearance: targetAppearance,
    resolved,
    warnings: computeAppearanceWarnings(resolved, targetAppearance),
    historyMeta: persisted.history,
    updatedAt: persisted.updatedAt,
  });
}

/**
 * POST /api/appearance/redo
 */
export async function handleRedoAppearance(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const state = await dbReadAppearanceState(actor.username);
  const redoStack = [...(state.history?.redoStack || [])];
  if (redoStack.length === 0) {
    return res.status(400).json({ error: 'nothing_to_redo', message: 'No appearance step to redo.' });
  }

  const currentAppearance = migrateLegacyProfileToAppearanceV2({
    ...(state.profile || actor.profile),
    onboardingComplete: true,
  });

  const popped = redoStack.pop()!;
  const targetAppearance: Appearance = {
    ...popped.data,
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
  };

  const undoStack = [
    ...(state.history?.undoStack || []).slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
    {
      id: crypto.randomUUID(),
      data: currentAppearance,
      createdAt: new Date().toISOString(),
    } as HistorySnapshot,
  ];

  const persisted = await persistAppearanceUpdate(actor, targetAppearance, {
    undoStack,
    redoStack,
    lastCoalesceKey: null,
    lastCoalesceAt: 0,
  });
  const resolved = resolveTokens(targetAppearance, { isPro: actor.isPro });

  return res.status(200).json({
    ok: true,
    appearance: targetAppearance,
    resolved,
    warnings: computeAppearanceWarnings(resolved, targetAppearance),
    historyMeta: persisted.history,
    updatedAt: persisted.updatedAt,
  });
}

/**
 * GET /api/appearance/themes
 */
export async function handleListThemes(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }
  const state = await dbReadAppearanceState(actor.username);
  let themes = state.themes || [];
  if (themes.length === 0) {
    const fbState = await withTimeout(firebaseGetAppearanceState(actor.username), null);
    if (fbState?.themes && fbState.themes.length > 0) {
      themes = fbState.themes;
      await dbWriteAppearanceState(actor.username, () => ({ nextThemes: themes, result: true })).catch(() => {});
    }
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({
    ok: true,
    themes,
    limit: THEME_LIMITS[actor.isPro ? 'pro' : 'free'],
  });
}

/**
 * POST /api/appearance/themes
 */
export async function handleCreateTheme(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  const rate = checkAppearanceWriteRateLimit(actor.userId || actor.username);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const rawName = String(req.body?.name || '').trim();
  if (!rawName || rawName.length > 40) {
    return res.status(400).json({ error: 'invalid_theme_name', message: 'Theme name must be 1 to 40 characters.' });
  }

  const state = await dbReadAppearanceState(actor.username);
  const existingThemes: ThemePreset[] = Array.isArray(state.themes) ? [...state.themes] : [];
  const limit = THEME_LIMITS[actor.isPro ? 'pro' : 'free'];

  if (existingThemes.length >= limit) {
    return res.status(402).json({
      code: 'PRO_REQUIRED',
      error: 'theme_limit_reached',
      limit,
      fields: ['themes'],
      message: actor.isPro
        ? `Maximum of ${limit} saved themes reached.`
        : 'Free accounts include 1 saved theme. Upgrade to Pro for up to 10.',
    });
  }

  const baseAppearance = migrateLegacyProfileToAppearanceV2({
    ...(state.profile || actor.profile),
    onboardingComplete: true,
  });

  let currentAppearance = baseAppearance;
  if (req.body?.appearance && typeof req.body.appearance === 'object') {
    const validated = validateAndMergeAppearancePatch(baseAppearance, req.body.appearance, actor.isPro);
    if (!validated.ok) {
      return res.status(validated.status).json({ error: validated.error, message: validated.message });
    }
    currentAppearance = validated.nextAppearance;
  }

  const newTheme: ThemePreset = {
    id: `theme_${crypto.randomUUID().slice(0, 12)}`,
    name: rawName,
    data: currentAppearance,
    createdAt: new Date().toISOString(),
  };

  const nextThemes = [newTheme, ...existingThemes];
  await dbWriteAppearanceState(actor.username, () => ({
    nextThemes,
    result: newTheme,
  }));
  await withTimeout(
    firebaseSaveAppearanceState(actor.username, {
      appearance: currentAppearance,
      history: state.history,
      themes: nextThemes,
    }, actor.userId),
    undefined
  );

  return res.status(201).json({ ok: true, theme: newTheme, themes: nextThemes });
}

/**
 * PATCH /api/appearance/themes/:id (rename)
 */
export async function handleRenameTheme(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }
  const id = String(req.params?.id || req.query?.id || '').trim();
  const rawName = String(req.body?.name || '').trim();
  if (!id || !rawName || rawName.length > 40) {
    return res.status(400).json({ error: 'invalid_theme_update', message: 'Valid theme ID and name (1-40 chars) required.' });
  }

  const state = await dbReadAppearanceState(actor.username);
  let themes: ThemePreset[] = Array.isArray(state.themes) ? [...state.themes] : [];
  if (themes.length === 0) {
    const fbState = await withTimeout(firebaseGetAppearanceState(actor.username), null);
    if (fbState?.themes && fbState.themes.length > 0) {
      themes = [...fbState.themes];
    }
  }
  const idx = themes.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'theme_not_found', message: 'Theme not found.' });
  }

  themes[idx] = { ...themes[idx], name: rawName, updatedAt: new Date().toISOString() };
  await dbWriteAppearanceState(actor.username, () => ({ nextThemes: themes, result: true }));
  await withTimeout(
    firebaseSaveAppearanceState(actor.username, { themes }, actor.userId),
    undefined
  );

  return res.status(200).json({ ok: true, theme: themes[idx], themes });
}

/**
 * POST /api/appearance/themes/:id/apply
 */
export async function handleApplyTheme(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }
  const id = String(req.params?.id || req.query?.id || '').trim();
  const state = await dbReadAppearanceState(actor.username);
  let availableThemes = Array.isArray(state.themes) ? state.themes : [];
  if (availableThemes.length === 0) {
    const fbState = await withTimeout(firebaseGetAppearanceState(actor.username), null);
    if (fbState?.themes && fbState.themes.length > 0) {
      availableThemes = fbState.themes;
      await dbWriteAppearanceState(actor.username, () => ({ nextThemes: availableThemes, result: true })).catch(() => {});
    }
  }
  const theme = availableThemes.find((t: ThemePreset) => t.id === id);
  if (!theme) {
    return res.status(404).json({ error: 'theme_not_found', message: 'Theme not found.' });
  }

  const currentAppearance = migrateLegacyProfileToAppearanceV2({
    ...(state.profile || actor.profile),
    onboardingComplete: true,
  });

  const nextAppearance: Appearance = {
    ...theme.data,
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
  };

  const nextUndoStack = [
    ...(state.history?.undoStack || []).slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
    {
      id: crypto.randomUUID(),
      data: currentAppearance,
      createdAt: new Date().toISOString(),
    } as HistorySnapshot,
  ];

  const persisted = await persistAppearanceUpdate(actor, nextAppearance, {
    undoStack: nextUndoStack,
    redoStack: [],
    lastCoalesceKey: null,
    lastCoalesceAt: 0,
  });
  const resolved = resolveTokens(nextAppearance, { isPro: actor.isPro });

  return res.status(200).json({
    ok: true,
    appearance: nextAppearance,
    resolved,
    warnings: computeAppearanceWarnings(resolved, nextAppearance),
    historyMeta: persisted.history,
    updatedAt: persisted.updatedAt,
  });
}

/**
 * DELETE /api/appearance/themes/:id
 */
export async function handleDeleteTheme(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }
  const id = String(req.params?.id || req.query?.id || '').trim();
  const state = await dbReadAppearanceState(actor.username);
  let existing = Array.isArray(state.themes) ? state.themes : [];
  if (existing.length === 0) {
    const fbState = await withTimeout(firebaseGetAppearanceState(actor.username), null);
    if (fbState?.themes && fbState.themes.length > 0) {
      existing = fbState.themes;
    }
  }
  const nextThemes = existing.filter((t: ThemePreset) => t.id !== id);
  if (nextThemes.length === existing.length) {
    return res.status(404).json({ error: 'theme_not_found', message: 'Theme not found.' });
  }

  await dbWriteAppearanceState(actor.username, () => ({ nextThemes, result: true }));
  await withTimeout(
    firebaseSaveAppearanceState(actor.username, { themes: nextThemes }, actor.userId),
    undefined
  );

  return res.status(200).json({ ok: true, themes: nextThemes });
}

// =========================================================================
// Pro Image Upload (<= 8MB, >= 1080px short side, EXIF stripped cleanly)
// =========================================================================

const MAX_APPEARANCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_SHORT_SIDE_PX = 1080;

/**
 * POST /api/appearance/background-image
 * Pro-only background photo upload (JPG/PNG/WebP <= 8MB, short side >= 1080px, EXIF stripped).
 */
export async function handleUploadAppearanceBgImage(req: ExpressReq, res: ExpressRes) {
  const actor = await resolveAppearanceActor(req);
  if (!actor.ok) {
    return res.status(actor.status).json({ error: actor.error, message: actor.message });
  }

  if (!actor.isPro) {
    return res.status(402).json({
      code: 'PRO_REQUIRED',
      error: 'pro_required',
      fields: ['background.image'],
      message: 'Custom background photos require Iveo Pro.',
    });
  }

  const rate = checkAppearanceWriteRateLimit(actor.userId || actor.username);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const dataUrl = String(req.body?.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return res.status(415).json({
      error: 'unsupported_image_format',
      message: 'Upload a JPG, PNG, or WebP image.',
    });
  }

  const rawBuf = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  const validated = inspectAndSanitizeRasterBuffer(rawBuf, {
    maxBytes: MAX_APPEARANCE_IMAGE_BYTES,
    rejectAnimatedWebp: false,
  });
  if (!validated.ok) {
    const code = validated.code === 'file_too_large' ? 'file_too_large_max_8mb' : validated.code;
    return res.status(validated.status).json({
      error: code,
      message: validated.message,
    });
  }

  const ext = validated.info.format;
  const dims = { width: validated.info.width, height: validated.info.height };
  const cleanedBuf = validated.info.sanitizedBuffer;

  if (Math.min(dims.width, dims.height) < MIN_SHORT_SIDE_PX) {
    return res.status(422).json({
      error: 'image_too_small',
      width: dims.width,
      height: dims.height,
      message: `Photo is ${dims.width}x${dims.height}px. Minimum short side is ${MIN_SHORT_SIDE_PX}px.`,
    });
  }

  const safeUser = actor.username.replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  const userDir = path.join(getBackgroundsBaseDir(), safeUser);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const fileName = `bg_${crypto.randomUUID()}.${ext}`;
  const finalPath = path.join(userDir, fileName);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, cleanedBuf);
  fs.renameSync(tmpPath, finalPath);

  const url = `/api/backgrounds/${safeUser}/${fileName}`;

  const dominantColors = Array.isArray(req.body?.dominantColors)
    ? req.body.dominantColors
        .map((c: unknown) => validateHex6(c))
        .filter((c: Hex | null): c is Hex => c !== null)
        .slice(0, 5)
    : ['#18181B', '#3F3F46', '#71717A', '#A1A1AA', '#F4F4F5'];

  const luminanceGrid =
    Array.isArray(req.body?.luminanceGrid) && req.body.luminanceGrid.length === 64
      ? req.body.luminanceGrid.map((v: unknown) => clampNum(v, 0, 1, 0.35))
      : Array(64).fill(0.35);

  return res.status(200).json({
    ok: true,
    assetId: url,
    url,
    width: dims.width,
    height: dims.height,
    dominantColors,
    luminanceGrid,
  });
}

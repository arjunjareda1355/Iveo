import type { BannerSource, CardBannerConfig, EmbedMetaData } from '../data/types.ts';
import { darkenHex, ensureContrastText, hexWithAlpha, isLightHexColor, normalizeHexColor } from './colors.ts';

export const DEFAULT_CARD_BANNER_CONFIG: Required<CardBannerConfig> = {
  source: 'auto',
  imageUrl: null,
  smallImageUrl: null,
  color: null,
  focalX: 50,
  focalY: 40,
  zoom: 1,
  dim: 20,
};

export const BANNER_COLOR_SWATCHES = [
  '#0A66C2',
  '#111111',
  '#5E7D63',
  '#B5654A',
  '#6B3F7A',
] as const;

export const BANNER_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
export const BANNER_MIN_WIDTH = 800;
export const BANNER_MIN_HEIGHT = 200;
export const BANNER_TARGET_WIDTH = 1584;
export const BANNER_TARGET_HEIGHT = 396;
export const BANNER_SMALL_WIDTH = 792;
export const BANNER_SMALL_HEIGHT = 198;

export const BANNER_ERROR_MESSAGES = {
  tooLarge: 'That file is too large. Choose an image under 5 MB.',
  unsupported: 'Use a JPG, PNG, or WebP image.',
  tooSmall: 'That image is too small. Use an image at least 800 pixels wide and 200 tall.',
  uploadFailed: "Couldn't upload that image. Try again.",
  loadFailed: "Couldn't read that image. Choose another JPG, PNG, or WebP file.",
} as const;

const HEX6_RE = /^#([0-9a-fA-F]{6})$/;
const RELATIVE_BANNER_PATH_RE = /^\/api\/cards\/banner\/[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9_-]{8,128}\.(png|jpg|jpeg|webp)$/i;

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeBannerHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!HEX6_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function isAllowedBannerStorageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(trimmed)) {
    return trimmed.length <= 2 * 1024 * 1024;
  }

  if (trimmed.length > 512) return false;
  if (RELATIVE_BANNER_PATH_RE.test(trimmed)) return true;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Restrict HTTPS URLs to known storage hosts or same site origin
    if (
      host === 'iveo.site' ||
      host.endsWith('.iveo.site') ||
      host.endsWith('.iveo.app') ||
      host.endsWith('.firebasestorage.app') ||
      host.endsWith('.googleapis.com') ||
      host.endsWith('.supabase.co') ||
      host.endsWith('.blob.core.windows.net')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isPersistentBannerUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (RELATIVE_BANNER_PATH_RE.test(trimmed)) return true;
  if (!trimmed.startsWith('https://')) return false;
  return isAllowedBannerStorageUrl(trimmed);
}

export function normalizeCardBannerConfig(
  raw: CardBannerConfig | null | undefined
): Required<CardBannerConfig> {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CARD_BANNER_CONFIG };
  }

  const rawSource = raw.source;
  const source: BannerSource =
    rawSource === 'upload' || rawSource === 'color' || rawSource === 'auto'
      ? rawSource
      : 'auto';

  const imageUrl = isAllowedBannerStorageUrl(raw.imageUrl) ? raw.imageUrl.trim() : null;
  const smallImageUrl = isAllowedBannerStorageUrl(raw.smallImageUrl) ? raw.smallImageUrl.trim() : null;
  const color = normalizeBannerHexColor(raw.color);

  const focalX = Math.round(clampNumber(raw.focalX, 0, 100, DEFAULT_CARD_BANNER_CONFIG.focalX));
  const focalY = Math.round(clampNumber(raw.focalY, 0, 100, DEFAULT_CARD_BANNER_CONFIG.focalY));
  const zoom = Math.round(clampNumber(raw.zoom, 1, 3, DEFAULT_CARD_BANNER_CONFIG.zoom) * 100) / 100;
  const dim = Math.round(clampNumber(raw.dim, 0, 60, DEFAULT_CARD_BANNER_CONFIG.dim));

  return {
    source,
    imageUrl,
    smallImageUrl,
    color,
    focalX,
    focalY,
    zoom,
    dim,
  };
}

export function sanitizeEmbedMetaBannerForSave(
  meta: EmbedMetaData | null | undefined,
  effectiveLook?: string | null,
  options?: { allowDataUrl?: boolean }
): EmbedMetaData | null | undefined {
  if (!meta) return meta;
  const rawBanner = meta.banner;
  if (!rawBanner) return meta;

  const normalized = normalizeCardBannerConfig(rawBanner);
  if (!options?.allowDataUrl) {
    if (normalized.imageUrl && normalized.imageUrl.startsWith('data:')) {
      normalized.imageUrl = null;
    }
    if (normalized.smallImageUrl && normalized.smallImageUrl.startsWith('data:')) {
      normalized.smallImageUrl = null;
    }
  }

  // If look is explicitly not banner, preserve cleanly without keeping invalid data
  if (effectiveLook && effectiveLook !== 'banner') {
    const next: EmbedMetaData = { ...meta };
    delete next.banner;
    return next;
  }

  return {
    ...meta,
    banner: normalized,
  };
}

export interface BannerBackgroundResolution {
  mode: 'image' | 'color' | 'gradient';
  imageUrl: string | null;
  smallImageUrl: string | null;
  backgroundCss: string;
  dimAlpha: number;
  focalX: number;
  focalY: number;
  zoom: number;
}

export function buildBannerFallbackGradient(provider: string, accentHex?: string | null): string {
  if (provider === 'linkedin') {
    return 'linear-gradient(120deg, #0A66C2 0%, #0B2F5C 100%)';
  }
  const base = normalizeHexColor(accentHex) || '#0A66C2';
  const end = darkenHex(base, 0.42);
  return `linear-gradient(120deg, ${base} 0%, ${end} 100%)`;
}

export function resolveBannerBackgroundStyle(params: {
  banner?: CardBannerConfig | null;
  fetchedCoverUrl?: string | null;
  allowAutoFetchedCover?: boolean;
  fetchedCoverFailed?: boolean;
  uploadedFailed?: boolean;
  provider: string;
  accentHex?: string | null;
}): BannerBackgroundResolution {
  const cfg = normalizeCardBannerConfig(params.banner);
  const fallbackGradient = buildBannerFallbackGradient(params.provider, params.accentHex);
  const dimAlpha = Math.round((cfg.dim / 100) * 1000) / 1000;

  if (cfg.source === 'upload' && cfg.imageUrl && !params.uploadedFailed) {
    return {
      mode: 'image',
      imageUrl: cfg.imageUrl,
      smallImageUrl: cfg.smallImageUrl,
      backgroundCss: fallbackGradient,
      dimAlpha,
      focalX: cfg.focalX,
      focalY: cfg.focalY,
      zoom: cfg.zoom,
    };
  }

  if (cfg.source === 'color') {
    const chosenColor = cfg.color || BANNER_COLOR_SWATCHES[0];
    return {
      mode: 'color',
      imageUrl: null,
      smallImageUrl: null,
      backgroundCss: chosenColor,
      dimAlpha,
      focalX: cfg.focalX,
      focalY: cfg.focalY,
      zoom: cfg.zoom,
    };
  }

  const fetched =
    params.allowAutoFetchedCover !== false &&
    typeof params.fetchedCoverUrl === 'string' &&
    params.fetchedCoverUrl.trim().length > 0 &&
    !params.fetchedCoverFailed
      ? params.fetchedCoverUrl.trim()
      : null;

  if (cfg.source === 'auto' && fetched) {
    return {
      mode: 'image',
      imageUrl: fetched,
      smallImageUrl: null,
      backgroundCss: fallbackGradient,
      dimAlpha,
      focalX: cfg.focalX,
      focalY: cfg.focalY,
      zoom: cfg.zoom,
    };
  }

  return {
    mode: 'gradient',
    imageUrl: null,
    smallImageUrl: null,
    backgroundCss: fallbackGradient,
    dimAlpha,
    focalX: cfg.focalX,
    focalY: cfg.focalY,
    zoom: cfg.zoom,
  };
}

export function computeBannerImagePresentation(params: {
  focalX: number;
  focalY: number;
  zoom: number;
}): {
  backgroundPosition: string;
  backgroundSize: string;
  objectPosition: string;
  transformOrigin: string;
  transform: string | undefined;
} {
  const focalX = Math.round(clampNumber(params.focalX, 0, 100, 50));
  const focalY = Math.round(clampNumber(params.focalY, 0, 100, 40));
  const zoom = Math.round(clampNumber(params.zoom, 1, 3, 1) * 100) / 100;
  return {
    backgroundPosition: `${focalX}% ${focalY}%`,
    backgroundSize: zoom > 1 ? `${Math.round(zoom * 1000) / 10}% auto` : 'cover',
    objectPosition: `${focalX}% ${focalY}%`,
    transformOrigin: `${focalX}% ${focalY}%`,
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
  };
}

export interface BannerResponsiveMetrics {
  compact: boolean;
  bannerHeight: number;
  avatarSize: number;
  avatarMarginTop: number;
  avatarRingPx: number;
  nameFontSize: number;
  platformBadgeHeight: number;
  platformTileSize: number;
}

export function resolveBannerResponsiveMetrics(cardWidth: number | null | undefined, scale = 1): BannerResponsiveMetrics {
  const compact = typeof cardWidth === 'number' && cardWidth > 0 && cardWidth < 320;
  return {
    compact,
    bannerHeight: Math.round((compact ? 84 : 108) * scale),
    avatarSize: Math.round((compact ? 56 : 72) * scale),
    avatarMarginTop: Math.round((compact ? -28 : -36) * scale),
    avatarRingPx: Math.max(3, Math.round(4 * scale)),
    nameFontSize: Math.max(13, Math.round((compact ? 15 : 17) * scale)),
    platformBadgeHeight: Math.round(28 * scale),
    platformTileSize: Math.round(18 * scale),
  };
}

export type BannerAvatarResolved =
  | { type: 'image'; url: string; source: 'fetched' | 'iveo' }
  | { type: 'initial'; letter: string; bgCss: string; textColor: string };

/**
 * Strict avatar fallback chain for the Banner Look:
 * 1) fetched profile photo -> 2) user's Iveo avatar -> 3) initial on a tinted circle.
 * NEVER returns the generic platform icon.
 */
export function resolveBannerAvatarChain(params: {
  fetchedAvatarUrl?: string | null;
  fetchedError?: boolean;
  userIveoAvatarUrl?: string | null;
  userIveoError?: boolean;
  title?: string | null;
  handle?: string | null;
  userDisplayName?: string | null;
  accentHex?: string | null;
  cardSurfaceHex?: string | null;
}): BannerAvatarResolved {
  const fetched =
    typeof params.fetchedAvatarUrl === 'string' && params.fetchedAvatarUrl.trim().length > 0
      ? params.fetchedAvatarUrl.trim()
      : null;

  if (fetched && !params.fetchedError) {
    return { type: 'image', url: fetched, source: 'fetched' };
  }

  const userAvatar =
    typeof params.userIveoAvatarUrl === 'string' && params.userIveoAvatarUrl.trim().length > 0
      ? params.userIveoAvatarUrl.trim()
      : null;

  if (userAvatar && !params.userIveoError) {
    return { type: 'image', url: userAvatar, source: 'iveo' };
  }

  const labelCandidate =
    (params.title || '').trim() ||
    (params.userDisplayName || '').trim() ||
    (params.handle || '').replace(/^@+/, '').trim() ||
    'I';
  const match = labelCandidate.match(/[A-Za-z0-9]/);
  const letter = (match ? match[0] : labelCandidate.charAt(0) || 'I').toUpperCase();

  const accent = normalizeHexColor(params.accentHex) || '#0A66C2';
  const surface = normalizeHexColor(params.cardSurfaceHex) || '#FFFFFF';
  const bgCss = hexWithAlpha(accent, 0.16);
  const textColor = ensureContrastText(accent, surface, 3.0, surface);

  return {
    type: 'initial',
    letter,
    bgCss,
    textColor,
  };
}

export function extractBannerFilePathFromUrl(url: string | null | undefined): {
  username: string;
  fileName: string;
} | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/^\/api\/cards\/banner\/([a-z0-9][a-z0-9._-]{0,63})\/([a-z0-9_-]{8,128}\.(?:png|jpg|jpeg|webp))$/i);
  if (!match) return null;
  return {
    username: match[1].toLowerCase(),
    fileName: match[2],
  };
}

export function collectReferencedCardBannerUrls(blocks: Array<{ embedMeta?: EmbedMetaData | null }>): Set<string> {
  const urls = new Set<string>();
  for (const b of blocks || []) {
    const banner = b?.embedMeta?.banner;
    if (!banner || typeof banner !== 'object') continue;
    if (typeof banner.imageUrl === 'string' && banner.imageUrl.trim()) {
      urls.add(banner.imageUrl.trim());
    }
    if (typeof banner.smallImageUrl === 'string' && banner.smallImageUrl.trim()) {
      urls.add(banner.smallImageUrl.trim());
    }
  }
  return urls;
}

export function resolveBannerMutedTextColor(
  cardSurfaceHex: string | null | undefined,
  primaryTextHex?: string | null
): string {
  const normPrimary = normalizeHexColor(primaryTextHex);
  if (normPrimary) {
    return isLightHexColor(normPrimary)
      ? 'rgba(248, 250, 252, 0.78)'
      : 'rgba(10, 10, 10, 0.68)';
  }
  return isLightHexColor(cardSurfaceHex)
    ? 'rgba(10, 10, 10, 0.68)'
    : 'rgba(248, 250, 252, 0.78)';
}

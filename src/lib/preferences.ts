import type { VibeId } from './vibes.ts';
import { type FontSettings, parseFontSettings } from './fonts.ts';
import { type ButtonColors, parseButtonColors } from './colors.ts';
import { type BusinessCardConfig, parseBusinessCardConfig } from './businessCardConfig.ts';

export type ButtonShape = 'square' | 'rounded' | 'pill';

export interface BackgroundConfig {
  type: 'none' | 'gradient' | 'mesh' | 'image' | 'pattern';
  value?: string;
  blur?: number;
  opacity?: number;
  presetId?: string;
}

export type AvatarShape = 'circle' | 'squircle' | 'rounded' | 'ring';
export type HeaderAlign = 'center' | 'left';
export type ButtonStyleEffect = 'solid' | 'soft' | 'offset' | 'glass' | 'gradient' | 'outline';
export type LinkSpacing = 'compact' | 'normal' | 'airy';
export type PageWidth = 'compact' | 'standard' | 'wide';

export interface LayoutSettings {
  avatarShape?: AvatarShape;
  headerAlign?: HeaderAlign;
  buttonStyle?: ButtonStyleEffect;
  linkSpacing?: LinkSpacing;
  pageWidth?: PageWidth;
}

export const DEFAULT_LAYOUT_SETTINGS: Required<LayoutSettings> = {
  avatarShape: 'circle',
  headerAlign: 'center',
  buttonStyle: 'solid',
  linkSpacing: 'normal',
  pageWidth: 'standard',
};

const VALID_AVATAR_SHAPES = new Set<AvatarShape>(['circle', 'squircle', 'rounded', 'ring']);
const VALID_HEADER_ALIGNS = new Set<HeaderAlign>(['center', 'left']);
const VALID_BUTTON_STYLES = new Set<ButtonStyleEffect>(['solid', 'soft', 'offset', 'glass', 'gradient', 'outline']);
const VALID_LINK_SPACINGS = new Set<LinkSpacing>(['compact', 'normal', 'airy']);
const VALID_PAGE_WIDTHS = new Set<PageWidth>(['compact', 'standard', 'wide']);

export function parseLayoutSettings(raw: unknown): LayoutSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const avatarShape =
    typeof r.avatarShape === 'string' && VALID_AVATAR_SHAPES.has(r.avatarShape as AvatarShape)
      ? (r.avatarShape as AvatarShape)
      : undefined;
  const headerAlign =
    typeof r.headerAlign === 'string' && VALID_HEADER_ALIGNS.has(r.headerAlign as HeaderAlign)
      ? (r.headerAlign as HeaderAlign)
      : undefined;
  const buttonStyle =
    typeof r.buttonStyle === 'string' && VALID_BUTTON_STYLES.has(r.buttonStyle as ButtonStyleEffect)
      ? (r.buttonStyle as ButtonStyleEffect)
      : undefined;
  const linkSpacing =
    typeof r.linkSpacing === 'string' && VALID_LINK_SPACINGS.has(r.linkSpacing as LinkSpacing)
      ? (r.linkSpacing as LinkSpacing)
      : undefined;
  const pageWidth =
    typeof r.pageWidth === 'string' && VALID_PAGE_WIDTHS.has(r.pageWidth as PageWidth)
      ? (r.pageWidth as PageWidth)
      : undefined;

  if (!avatarShape && !headerAlign && !buttonStyle && !linkSpacing && !pageWidth) {
    return null;
  }
  return {
    avatarShape: avatarShape || 'circle',
    headerAlign: headerAlign || 'center',
    buttonStyle: buttonStyle || 'solid',
    linkSpacing: linkSpacing || 'normal',
    pageWidth: pageWidth || 'standard',
  };
}

export interface IveoPreferences {
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  onboardingComplete: boolean;
  onboardedAt: string | null;
  plan: 'free' | 'pro';
  hideIveoFooter: boolean;
  hideIvioFooter?: boolean;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  category?: string | null;
  socials?: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  background?: BackgroundConfig | null;
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
  whatsappNumber?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
  fontSettings?: FontSettings | null;
  buttonColors?: ButtonColors | null;
  layoutSettings?: LayoutSettings | null;
  businessCard?: BusinessCardConfig | null;
}

export type IvioPreferences = IveoPreferences;

export const DEFAULT_PREFERENCES: IveoPreferences = {
  vibeId: 'clean',
  buttonShape: null,
  onboardingComplete: false,
  onboardedAt: null,
  plan: 'free',
  hideIveoFooter: false,
  hideIvioFooter: false,
  displayName: null,
  bio: null,
  avatarUrl: null,
  category: null,
  socials: {},
  socialsPosition: 'top',
  background: null,
  googleAnalyticsId: null,
  metaPixelId: null,
  whatsappNumber: null,
  customSeoTitle: null,
  customSeoDescription: null,
  fontSettings: null,
  buttonColors: null,
  layoutSettings: null,
  businessCard: null,
};

const VALID_VIBE_IDS = new Set<VibeId>([
  'clean',
  'midnight',
  'paper',
  'sage',
  'clay',
  'mono',
  'cyberpunk',
  'sunset',
  'glass',
  'brutalist',
  'emerald',
  'pastel',
]);

const VALID_BUTTON_SHAPES = new Set<ButtonShape>(['square', 'rounded', 'pill']);

/**
 * Defensively parses client metadata/database preferences.
 * Unknown or malformed values fall back to defaults.
 */
export function parsePreferences(raw: unknown): IveoPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  const record = raw as Record<string, unknown>;

  const vibeId =
    typeof record.vibeId === 'string' && VALID_VIBE_IDS.has(record.vibeId as VibeId)
      ? (record.vibeId as VibeId)
      : DEFAULT_PREFERENCES.vibeId;

  const buttonShape =
    typeof record.buttonShape === 'string' &&
    VALID_BUTTON_SHAPES.has(record.buttonShape as ButtonShape)
      ? (record.buttonShape as ButtonShape)
      : null;

  const onboardingComplete = record.onboardingComplete === true;

  const onboardedAt =
    typeof record.onboardedAt === 'string' && record.onboardedAt.length > 0
      ? record.onboardedAt
      : null;

  const plan = record.plan === 'pro' ? 'pro' : 'free';
  const hideFooter =
    record.hideIveoFooter === true ||
    record.hideIvioFooter === true ||
    record.hide_iveo_footer === true ||
    record.hide_ivio_footer === true;

  const displayName =
    typeof record.displayName === 'string' && record.displayName.trim().length > 0
      ? record.displayName.trim()
      : null;

  const bio =
    typeof record.bio === 'string'
      ? record.bio.trim()
      : null;

  const avatarUrl =
    typeof record.avatarUrl === 'string' && record.avatarUrl.length > 0
      ? record.avatarUrl
      : null;

  const category =
    typeof record.category === 'string' && record.category.length > 0
      ? record.category
      : null;

  const socials: Record<string, string> =
    record.socials && typeof record.socials === 'object' && !Array.isArray(record.socials)
      ? (record.socials as Record<string, string>)
      : {};

  const socialsPosition =
    record.socialsPosition === 'bottom'
      ? 'bottom'
      : record.socialsPosition === 'both'
        ? 'both'
        : 'top';

  const background =
    record.background && typeof record.background === 'object'
      ? (record.background as BackgroundConfig)
      : null;

  const googleAnalyticsId =
    typeof record.googleAnalyticsId === 'string' && record.googleAnalyticsId.trim().length > 0
      ? record.googleAnalyticsId.trim().toUpperCase()
      : null;

  const metaPixelId =
    typeof record.metaPixelId === 'string' && record.metaPixelId.trim().length > 0
      ? record.metaPixelId.trim()
      : null;

  const whatsappNumber =
    typeof record.whatsappNumber === 'string' && record.whatsappNumber.trim().length > 0
      ? record.whatsappNumber.trim()
      : null;

  const customSeoTitle =
    typeof record.customSeoTitle === 'string' && record.customSeoTitle.trim().length > 0
      ? record.customSeoTitle.trim()
      : null;

  const customSeoDescription =
    typeof record.customSeoDescription === 'string' && record.customSeoDescription.trim().length > 0
      ? record.customSeoDescription.trim()
      : null;

  const fontSettings = parseFontSettings(record.fontSettings);
  const buttonColors = parseButtonColors(record.buttonColors);
  const layoutSettings = parseLayoutSettings(record.layoutSettings);
  const businessCard = parseBusinessCardConfig(record.businessCard);

  return {
    vibeId,
    buttonShape,
    onboardingComplete,
    onboardedAt,
    plan,
    hideIveoFooter: hideFooter,
    hideIvioFooter: hideFooter,
    displayName,
    bio,
    avatarUrl,
    category,
    socials,
    socialsPosition,
    background,
    googleAnalyticsId,
    metaPixelId,
    whatsappNumber,
    customSeoTitle,
    customSeoDescription,
    fontSettings,
    buttonColors,
    layoutSettings,
    businessCard,
  };
}

/**
 * Resolves a safe border-radius in pixels across button shapes (square=0, rounded=12, pill=999)
 * so tall/multi-row cards never morph into squished ovals when 'pill' is active.
 */
export function resolveCardBorderRadius(
  effectiveRadius: number,
  scale = 1,
  variant: 'bar' | 'card' | 'inner' = 'card'
): number {
  const safe = Number.isFinite(effectiveRadius) ? Math.max(0, effectiveRadius) : 12;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (variant === 'bar') {
    return safe >= 999 ? 9999 : Math.round(safe * safeScale);
  }
  if (variant === 'inner') {
    if (safe <= 0) return 0;
    if (safe >= 999) return Math.round(12 * safeScale);
    return Math.round(Math.min(safe, 10) * safeScale);
  }
  // 'card' variant: square stays sharp (0), rounded stays balanced, pill uses crisp 22px card radius
  if (safe <= 0) return 0;
  return Math.round(Math.min(safe, 22) * safeScale);
}

/**
 * Resolves control/CTA chip border-radius inside showcase cards so inner buttons
 * mirror square, rounded, or pill shapes cleanly.
 */
export function resolveButtonControlRadius(
  effectiveRadius: number,
  scale = 1
): number {
  const safe = Number.isFinite(effectiveRadius) ? Math.max(0, effectiveRadius) : 12;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (safe <= 0) return 0;
  if (safe >= 999) return 9999;
  return Math.round(Math.min(safe, 14) * safeScale);
}


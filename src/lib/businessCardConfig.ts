import { normalizeHexColor } from './colors';
import { getFontOption } from './fonts';

export type BusinessCardTemplate =
  | 'classic'
  | 'executive'
  | 'editorial'
  | 'gradient'
  | 'midnight';

export type BusinessCardCornerStyle = 'rounded' | 'sharp' | 'pill';

export interface BusinessCardConfig {
  template?: BusinessCardTemplate;
  bgColor?: string | null;
  bgColor2?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  fontId?: string | null;
  role?: string | null;
  companyOrLocation?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  badgeText?: string | null;
  showAvatar?: boolean;
  showBio?: boolean;
  showHandle?: boolean;
  showQr?: boolean;
  qrFgColor?: string | null;
  qrBgColor?: string | null;
  cornerStyle?: BusinessCardCornerStyle;
}

export const DEFAULT_BUSINESS_CARD_CONFIG: Required<BusinessCardConfig> = {
  template: 'classic',
  bgColor: null,
  bgColor2: null,
  accentColor: null,
  textColor: null,
  fontId: null,
  role: null,
  companyOrLocation: null,
  contactEmail: null,
  contactPhone: null,
  websiteUrl: null,
  badgeText: null,
  showAvatar: true,
  showBio: true,
  showHandle: true,
  showQr: true,
  qrFgColor: null,
  qrBgColor: null,
  cornerStyle: 'rounded',
};

export const BUSINESS_CARD_TEMPLATES: readonly {
  id: BusinessCardTemplate;
  label: string;
  description: string;
}[] = [
  { id: 'classic', label: 'Classic', description: 'Clean avatar & QR balance' },
  { id: 'executive', label: 'Executive', description: 'Accent rail & contact lines' },
  { id: 'editorial', label: 'Editorial', description: 'Framed border & refined type' },
  { id: 'gradient', label: 'Gradient', description: 'Rich two-tone ambient card' },
  { id: 'midnight', label: 'Midnight', description: 'Matte obsidian & crisp contrast' },
];

const VALID_TEMPLATES = new Set<BusinessCardTemplate>([
  'classic',
  'executive',
  'editorial',
  'gradient',
  'midnight',
]);

const VALID_CORNERS = new Set<BusinessCardCornerStyle>(['rounded', 'sharp', 'pill']);

export function parseBusinessCardConfig(raw: unknown): BusinessCardConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const template =
    typeof r.template === 'string' && VALID_TEMPLATES.has(r.template as BusinessCardTemplate)
      ? (r.template as BusinessCardTemplate)
      : 'classic';

  const cornerStyle =
    typeof r.cornerStyle === 'string' && VALID_CORNERS.has(r.cornerStyle as BusinessCardCornerStyle)
      ? (r.cornerStyle as BusinessCardCornerStyle)
      : 'rounded';

  const cleanStr = (v: unknown, maxLen: number): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim().slice(0, maxLen);
    return t.length > 0 ? t : null;
  };

  return {
    template,
    bgColor: normalizeHexColor(typeof r.bgColor === 'string' ? r.bgColor : null),
    bgColor2: normalizeHexColor(typeof r.bgColor2 === 'string' ? r.bgColor2 : null),
    accentColor: normalizeHexColor(typeof r.accentColor === 'string' ? r.accentColor : null),
    textColor: normalizeHexColor(typeof r.textColor === 'string' ? r.textColor : null),
    fontId:
      typeof r.fontId === 'string' && getFontOption(r.fontId)
        ? r.fontId.trim().toLowerCase()
        : null,
    role: cleanStr(r.role, 60),
    companyOrLocation: cleanStr(r.companyOrLocation, 60),
    contactEmail: cleanStr(r.contactEmail, 100),
    contactPhone: cleanStr(r.contactPhone, 32),
    websiteUrl: cleanStr(r.websiteUrl, 80),
    badgeText: cleanStr(r.badgeText, 28),
    showAvatar: r.showAvatar !== false,
    showBio: r.showBio !== false,
    showHandle: r.showHandle !== false,
    showQr: r.showQr !== false,
    qrFgColor: normalizeHexColor(typeof r.qrFgColor === 'string' ? r.qrFgColor : null),
    qrBgColor: normalizeHexColor(typeof r.qrBgColor === 'string' ? r.qrBgColor : null),
    cornerStyle,
  };
}

import { isLightHexColor } from './colors';

export function mergeBusinessCardConfig(
  base?: BusinessCardConfig | null,
  patch?: Partial<BusinessCardConfig> | null
): Required<BusinessCardConfig> {
  return {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(base || {}),
    ...(patch || {}),
    showAvatar: (patch?.showAvatar ?? base?.showAvatar) !== false,
    showBio: (patch?.showBio ?? base?.showBio) !== false,
    showHandle: (patch?.showHandle ?? base?.showHandle) !== false,
    showQr: (patch?.showQr ?? base?.showQr) !== false,
  };
}

export const CARD_BASE_WIDTH = 600;
export const CARD_BASE_HEIGHT = 353; // exact 2040 / 3.4
export const CARD_EXPORT_SCALE = 3.4; // 600*3.4 = 2040, 353*3.4 = 1200.2 -> 1200

export interface ResolvedCardAppearance {
  template: BusinessCardTemplate;
  bgColor: string;
  bgColor2: string | null;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  isLight: boolean;
  qrFg: string;
  qrBg: string;
  cornerRadius: number; // in 600x353 base coordinates
  innerCornerRadius: number;
  backgroundCssImage?: string;
}

export function resolveBusinessCardAppearance(
  cfg: BusinessCardConfig,
  vibeTheme?: {
    bg?: string;
    text?: string;
    muted?: string;
    accent?: string;
    buttonBg?: string;
  }
): ResolvedCardAppearance {
  const template: BusinessCardTemplate = cfg.template || 'classic';

  let bgColor = cfg.bgColor || vibeTheme?.bg || '#0F172A';
  let accentColor = cfg.accentColor || vibeTheme?.accent || vibeTheme?.buttonBg || '#4F46E5';
  let textColor = cfg.textColor || vibeTheme?.text || '#FFFFFF';

  if (template === 'gradient' && !cfg.bgColor) {
    bgColor = '#0F172A';
    accentColor = cfg.accentColor || '#38BDF8';
    textColor = cfg.textColor || '#FFFFFF';
  } else if (template === 'midnight') {
    bgColor = cfg.bgColor || '#09090B';
    textColor = cfg.textColor || '#FAFAFA';
    accentColor = cfg.accentColor || '#A855F7';
  } else if (template === 'executive' && !cfg.bgColor) {
    bgColor = '#111827';
    textColor = cfg.textColor || '#F9FAFB';
    accentColor = cfg.accentColor || '#38BDF8';
  } else if (template === 'editorial' && !cfg.bgColor) {
    bgColor = '#FAF8F5';
    textColor = cfg.textColor || '#1C1917';
    accentColor = cfg.accentColor || '#B45309';
  }

  const isLight = isLightHexColor(bgColor);
  if (!cfg.textColor && (template === 'classic' || !vibeTheme?.text)) {
    textColor = vibeTheme?.text || (isLight ? '#0A0A0A' : '#FFFFFF');
  }

  const mutedColor = isLight ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.72)';
  const borderColor = isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.18)';

  const cornerRadius =
    cfg.cornerStyle === 'sharp' ? 5 : cfg.cornerStyle === 'pill' ? 32 : 20;
  const innerCornerRadius = Math.max(3, cornerRadius - 7);

  let backgroundCssImage: string | undefined;
  const bgColor2 = cfg.bgColor2 || null;

  if (cfg.bgColor && bgColor2) {
    backgroundCssImage = `linear-gradient(135deg, ${cfg.bgColor} 0%, ${bgColor2} 100%)`;
  } else if (template === 'gradient') {
    backgroundCssImage = `linear-gradient(135deg, ${bgColor} 0%, ${bgColor2 || `${accentColor}44`} 100%)`;
  } else if (template === 'midnight') {
    backgroundCssImage = `radial-gradient(circle at 85% 15%, ${accentColor}3D 0%, transparent 56%)`;
  }

  return {
    template,
    bgColor,
    bgColor2,
    accentColor,
    textColor,
    mutedColor,
    borderColor,
    isLight,
    qrFg: cfg.qrFgColor || '#0A0A0A',
    qrBg: cfg.qrBgColor || '#FFFFFF',
    cornerRadius,
    innerCornerRadius,
    backgroundCssImage,
  };
}

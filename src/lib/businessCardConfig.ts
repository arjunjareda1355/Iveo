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
  accentColor?: string | null;
  textColor?: string | null;
  fontId?: string | null;
  role?: string | null;
  companyOrLocation?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  badgeText?: string | null;
  showAvatar?: boolean;
  showQr?: boolean;
  cornerStyle?: BusinessCardCornerStyle;
}

export const DEFAULT_BUSINESS_CARD_CONFIG: Required<BusinessCardConfig> = {
  template: 'classic',
  bgColor: null,
  accentColor: null,
  textColor: null,
  fontId: null,
  role: null,
  companyOrLocation: null,
  contactEmail: null,
  contactPhone: null,
  badgeText: null,
  showAvatar: true,
  showQr: true,
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
    badgeText: cleanStr(r.badgeText, 28),
    showAvatar: r.showAvatar !== false,
    showQr: r.showQr !== false,
    cornerStyle,
  };
}

export function mergeBusinessCardConfig(
  base?: BusinessCardConfig | null,
  patch?: Partial<BusinessCardConfig> | null
): Required<BusinessCardConfig> {
  return {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(base || {}),
    ...(patch || {}),
    showAvatar: (patch?.showAvatar ?? base?.showAvatar) !== false,
    showQr: (patch?.showQr ?? base?.showQr) !== false,
  };
}

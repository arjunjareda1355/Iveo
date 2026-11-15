import { isLightHexColor, normalizeHexColor } from './colors.ts';
import { getFontOption } from './fonts.ts';

export type BusinessCardTemplate =
  | 'classic'
  | 'executive'
  | 'editorial'
  | 'gradient'
  | 'midnight';

export type BusinessCardCornerStyle = 'rounded' | 'sharp' | 'pill';

export type MetallicCardVibe =
  | 'obsidian'
  | 'titanium'
  | 'champagne'
  | 'rose-bronze'
  | 'cobalt'
  | 'emerald'
  | 'page-vibe';

export interface MetallicCardVibePreset {
  id: MetallicCardVibe;
  label: string;
  description: string;
  frontBg: string;
  frontBg2: string;
  frontText: string;
  frontAccent: string;
  backBg: string;
  backBg2: string;
  backText: string;
  backAccent: string;
  qrFg: string;
  qrBg: string;
}

export const METALLIC_CARD_VIBES: readonly MetallicCardVibePreset[] = [
  {
    id: 'obsidian',
    label: 'Brushed Obsidian',
    description: 'Signature dark metal front & pearl silver back',
    frontBg: '#1C1C21',
    frontBg2: '#070709',
    frontText: '#FFFFFF',
    frontAccent: '#D4D4D8',
    backBg: '#FFFFFF',
    backBg2: '#ECEFF4',
    backText: '#0A0A0A',
    backAccent: '#27272A',
    qrFg: '#0A0A0A',
    qrBg: '#FFFFFF',
  },
  {
    id: 'titanium',
    label: 'Brushed Titanium',
    description: 'Cool slate alloy front & frost steel back',
    frontBg: '#334155',
    frontBg2: '#0F172A',
    frontText: '#F8FAFC',
    frontAccent: '#CBD5E1',
    backBg: '#F8FAFC',
    backBg2: '#E2E8F0',
    backText: '#0F172A',
    backAccent: '#334155',
    qrFg: '#0F172A',
    qrBg: '#FFFFFF',
  },
  {
    id: 'champagne',
    label: 'Champagne Gold',
    description: 'Warm bronze noir front & gilded cream back',
    frontBg: '#2B2115',
    frontBg2: '#0E0A06',
    frontText: '#FEF9C3',
    frontAccent: '#FACC15',
    backBg: '#FFFDF5',
    backBg2: '#FDE68A',
    backText: '#292117',
    backAccent: '#B45309',
    qrFg: '#292117',
    qrBg: '#FFFDF5',
  },
  {
    id: 'rose-bronze',
    label: 'Rose Bronze',
    description: 'Deep plum alloy front & rose pearl back',
    frontBg: '#311722',
    frontBg2: '#11070B',
    frontText: '#FFF1F2',
    frontAccent: '#FDA4AF',
    backBg: '#FFF5F7',
    backBg2: '#FFE4E6',
    backText: '#311722',
    backAccent: '#BE123C',
    qrFg: '#311722',
    qrBg: '#FFFFFF',
  },
  {
    id: 'cobalt',
    label: 'Cobalt Alloy',
    description: 'Sapphire anodized front & ice blue back',
    frontBg: '#1E3A8A',
    frontBg2: '#090F29',
    frontText: '#F8FAFC',
    frontAccent: '#93C5FD',
    backBg: '#F0F7FF',
    backBg2: '#DBEAFE',
    backText: '#0F172A',
    backAccent: '#1D4ED8',
    qrFg: '#0F172A',
    qrBg: '#FFFFFF',
  },
  {
    id: 'emerald',
    label: 'Emerald Steel',
    description: 'Forest anodized front & mint silver back',
    frontBg: '#065F46',
    frontBg2: '#022C22',
    frontText: '#ECFDF5',
    frontAccent: '#6EE7B7',
    backBg: '#F0FDF9',
    backBg2: '#D1FAE5',
    backText: '#064E3B',
    backAccent: '#047857',
    qrFg: '#064E3B',
    qrBg: '#FFFFFF',
  },
];

export interface BusinessCardConfig {
  template?: BusinessCardTemplate;
  metallicVibe?: MetallicCardVibe | null;
  metallicFinish?: boolean;
  // Front Dual Color Tone
  bgColor?: string | null;
  bgColor2?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  // Back Dual Color Tone
  backBgColor?: string | null;
  backBgColor2?: string | null;
  backTextColor?: string | null;
  backAccentColor?: string | null;
  backHeadline?: string | null;
  backSubheadline?: string | null;
  showSocialsOnBack?: boolean;
  // Typography & Details
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
  metallicVibe: 'obsidian',
  metallicFinish: true,
  bgColor: null,
  bgColor2: null,
  accentColor: null,
  textColor: null,
  backBgColor: null,
  backBgColor2: null,
  backTextColor: null,
  backAccentColor: null,
  backHeadline: 'Scan to',
  backSubheadline: 'open my page.',
  showSocialsOnBack: true,
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
  { id: 'classic', label: 'Signature Metallic', description: 'Refined logo mark & brushed metallic depth' },
  { id: 'executive', label: 'Executive Rail', description: 'Accent spine & structured contact details' },
  { id: 'editorial', label: 'Editorial Frame', description: 'Inner hairline bezel & gallery typography' },
  { id: 'gradient', label: 'Dual Tone Glow', description: 'Deep diagonal alloy blend on both sides' },
  { id: 'midnight', label: 'Carbon Matte', description: 'Subtle radial sheen & crisp contrast' },
];

const VALID_TEMPLATES = new Set<BusinessCardTemplate>([
  'classic',
  'executive',
  'editorial',
  'gradient',
  'midnight',
]);

const VALID_CORNERS = new Set<BusinessCardCornerStyle>(['rounded', 'sharp', 'pill']);

const VALID_METALLIC_VIBES = new Set<MetallicCardVibe>([
  'obsidian',
  'titanium',
  'champagne',
  'rose-bronze',
  'cobalt',
  'emerald',
  'page-vibe',
]);

export function getMetallicCardPreset(vibe?: MetallicCardVibe | null): MetallicCardVibePreset {
  return METALLIC_CARD_VIBES.find((v) => v.id === vibe) || METALLIC_CARD_VIBES[0];
}

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

  const metallicVibe =
    typeof r.metallicVibe === 'string' && VALID_METALLIC_VIBES.has(r.metallicVibe as MetallicCardVibe)
      ? (r.metallicVibe as MetallicCardVibe)
      : 'obsidian';

  const cleanStr = (v: unknown, maxLen: number): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim().slice(0, maxLen);
    return t.length > 0 ? t : null;
  };

  return {
    template,
    metallicVibe,
    metallicFinish: r.metallicFinish !== false,
    bgColor: normalizeHexColor(typeof r.bgColor === 'string' ? r.bgColor : null),
    bgColor2: normalizeHexColor(typeof r.bgColor2 === 'string' ? r.bgColor2 : null),
    accentColor: normalizeHexColor(typeof r.accentColor === 'string' ? r.accentColor : null),
    textColor: normalizeHexColor(typeof r.textColor === 'string' ? r.textColor : null),
    backBgColor: normalizeHexColor(typeof r.backBgColor === 'string' ? r.backBgColor : null),
    backBgColor2: normalizeHexColor(typeof r.backBgColor2 === 'string' ? r.backBgColor2 : null),
    backTextColor: normalizeHexColor(typeof r.backTextColor === 'string' ? r.backTextColor : null),
    backAccentColor: normalizeHexColor(typeof r.backAccentColor === 'string' ? r.backAccentColor : null),
    backHeadline: cleanStr(r.backHeadline, 36),
    backSubheadline: cleanStr(r.backSubheadline, 44),
    showSocialsOnBack: r.showSocialsOnBack !== false,
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

export function mergeBusinessCardConfig(
  base?: BusinessCardConfig | null,
  patch?: Partial<BusinessCardConfig> | null
): Required<BusinessCardConfig> {
  return {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(base || {}),
    ...(patch || {}),
    metallicFinish: (patch?.metallicFinish ?? base?.metallicFinish) !== false,
    showSocialsOnBack: (patch?.showSocialsOnBack ?? base?.showSocialsOnBack) !== false,
    showAvatar: (patch?.showAvatar ?? base?.showAvatar) !== false,
    showBio: (patch?.showBio ?? base?.showBio) !== false,
    showHandle: (patch?.showHandle ?? base?.showHandle) !== false,
    showQr: (patch?.showQr ?? base?.showQr) !== false,
  };
}

export const CARD_BASE_WIDTH = 600;
export const CARD_BASE_HEIGHT = 353; // exact 2040 / 3.4
export const CARD_EXPORT_SCALE = 3.4; // 600*3.4 = 2040, 353*3.4 = 1200.2 -> 1200

export interface VibeCardThemeInput {
  bg?: string;
  text?: string;
  muted?: string;
  accent?: string;
  buttonBg?: string;
}

export interface ResolvedCardAppearance {
  template: BusinessCardTemplate;
  metallicVibe: MetallicCardVibe;
  metallicFinish: boolean;
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

export function resolveFrontCardAppearance(
  cfg: BusinessCardConfig,
  vibeTheme?: VibeCardThemeInput
): ResolvedCardAppearance {
  const template: BusinessCardTemplate = cfg.template || 'classic';
  const metallicVibe: MetallicCardVibe = cfg.metallicVibe || 'obsidian';
  const metallicFinish = cfg.metallicFinish !== false;
  const preset = getMetallicCardPreset(metallicVibe === 'page-vibe' ? 'obsidian' : metallicVibe);

  let bgColor: string;
  let bgColor2: string | null;
  let accentColor: string;
  let textColor: string;

  if (metallicVibe === 'page-vibe' && vibeTheme?.bg) {
    bgColor = cfg.bgColor || vibeTheme.bg;
    bgColor2 = cfg.bgColor2 || (metallicFinish ? '#0F172A' : null);
    accentColor = cfg.accentColor || vibeTheme.accent || vibeTheme.buttonBg || '#4F46E5';
    textColor = cfg.textColor || vibeTheme.text || (isLightHexColor(bgColor) ? '#0A0A0A' : '#FFFFFF');
  } else {
    bgColor = cfg.bgColor || preset.frontBg;
    bgColor2 = cfg.bgColor2 !== undefined && cfg.bgColor2 !== null ? cfg.bgColor2 : (cfg.bgColor ? null : preset.frontBg2);
    accentColor = cfg.accentColor || preset.frontAccent;
    textColor = cfg.textColor || preset.frontText;
  }

  // Template-specific fallbacks when user leaves custom front color unset
  if (!cfg.bgColor && metallicVibe === 'page-vibe') {
    if (template === 'gradient') {
      bgColor = '#0F172A';
      accentColor = cfg.accentColor || '#38BDF8';
      textColor = cfg.textColor || '#FFFFFF';
    } else if (template === 'midnight') {
      bgColor = '#09090B';
      textColor = cfg.textColor || '#FAFAFA';
      accentColor = cfg.accentColor || '#A855F7';
    } else if (template === 'executive') {
      bgColor = '#111827';
      textColor = cfg.textColor || '#F9FAFB';
      accentColor = cfg.accentColor || '#38BDF8';
    } else if (template === 'editorial') {
      bgColor = '#FAF8F5';
      textColor = cfg.textColor || '#1C1917';
      accentColor = cfg.accentColor || '#B45309';
    }
  }

  const isLight = isLightHexColor(bgColor);
  if (!cfg.textColor) {
    textColor = isLight ? (isLightHexColor(textColor) ? '#0A0A0A' : textColor) : (isLightHexColor(textColor) ? textColor : '#FFFFFF');
  }

  const mutedColor = isLight ? 'rgba(15, 23, 42, 0.70)' : 'rgba(255, 255, 255, 0.72)';
  const borderColor = isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.18)';

  const cornerRadius =
    cfg.cornerStyle === 'sharp' ? 5 : cfg.cornerStyle === 'pill' ? 32 : 20;
  const innerCornerRadius = Math.max(3, cornerRadius - 7);

  let backgroundCssImage: string | undefined;
  const metallicSheen = metallicFinish
    ? isLight
      ? 'linear-gradient(122deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.12) 44%, rgba(15,23,42,0.04) 100%)'
      : 'radial-gradient(circle at 86% 14%, rgba(255,255,255,0.12) 0%, transparent 52%), linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.0) 42%, rgba(0,0,0,0.22) 100%)'
    : '';

  const dualGradient = bgColor2
    ? `linear-gradient(138deg, ${bgColor} 0%, ${bgColor2} 100%)`
    : template === 'gradient'
      ? `linear-gradient(138deg, ${bgColor} 0%, ${accentColor}44 100%)`
      : '';

  if (metallicSheen && dualGradient) {
    backgroundCssImage = `${metallicSheen}, ${dualGradient}`;
  } else if (dualGradient) {
    backgroundCssImage = dualGradient;
  } else if (metallicSheen) {
    backgroundCssImage = metallicSheen;
  } else if (template === 'midnight') {
    backgroundCssImage = `radial-gradient(circle at 85% 15%, ${accentColor}3D 0%, transparent 56%)`;
  }

  return {
    template,
    metallicVibe,
    metallicFinish,
    bgColor,
    bgColor2,
    accentColor,
    textColor,
    mutedColor,
    borderColor,
    isLight,
    qrFg: cfg.qrFgColor || preset.qrFg,
    qrBg: cfg.qrBgColor || preset.qrBg,
    cornerRadius,
    innerCornerRadius,
    backgroundCssImage,
  };
}

export function resolveBackCardAppearance(
  cfg: BusinessCardConfig,
  vibeTheme?: VibeCardThemeInput
): ResolvedCardAppearance {
  const template: BusinessCardTemplate = cfg.template || 'classic';
  const metallicVibe: MetallicCardVibe = cfg.metallicVibe || 'obsidian';
  const metallicFinish = cfg.metallicFinish !== false;
  const preset = getMetallicCardPreset(metallicVibe === 'page-vibe' ? 'obsidian' : metallicVibe);

  const bgColor = cfg.backBgColor || preset.backBg;
  const bgColor2 =
    cfg.backBgColor2 !== undefined && cfg.backBgColor2 !== null
      ? cfg.backBgColor2
      : cfg.backBgColor
        ? null
        : preset.backBg2;

  const isLight = isLightHexColor(bgColor);
  const textColor =
    cfg.backTextColor ||
    (cfg.backBgColor ? (isLight ? '#0A0A0A' : '#FFFFFF') : preset.backText);
  const accentColor =
    cfg.backAccentColor ||
    (metallicVibe === 'page-vibe' ? vibeTheme?.accent || preset.backAccent : preset.backAccent);

  const mutedColor = isLight ? 'rgba(15, 23, 42, 0.66)' : 'rgba(255, 255, 255, 0.72)';
  const borderColor = isLight ? 'rgba(15, 23, 42, 0.13)' : 'rgba(255, 255, 255, 0.18)';

  const cornerRadius =
    cfg.cornerStyle === 'sharp' ? 5 : cfg.cornerStyle === 'pill' ? 32 : 20;
  const innerCornerRadius = Math.max(3, cornerRadius - 7);

  const metallicSheen = metallicFinish
    ? isLight
      ? 'radial-gradient(circle at 18% 15%, rgba(255,255,255,0.85) 0%, transparent 55%), linear-gradient(128deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.06) 48%, rgba(15,23,42,0.05) 100%)'
      : 'radial-gradient(circle at 86% 14%, rgba(255,255,255,0.12) 0%, transparent 52%), linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.0) 42%, rgba(0,0,0,0.22) 100%)'
    : '';
  const dualGradient = bgColor2
    ? `linear-gradient(140deg, ${bgColor} 0%, ${bgColor2} 100%)`
    : '';

  const backgroundCssImage =
    metallicSheen && dualGradient
      ? `${metallicSheen}, ${dualGradient}`
      : dualGradient || metallicSheen || undefined;

  const qrFg = cfg.qrFgColor || (isLight ? '#0A0A0A' : '#FFFFFF');
  const qrBg = cfg.qrBgColor || (isLight ? '#FFFFFF' : '#111827');

  return {
    template,
    metallicVibe,
    metallicFinish,
    bgColor,
    bgColor2,
    accentColor,
    textColor,
    mutedColor,
    borderColor,
    isLight,
    qrFg,
    qrBg,
    cornerRadius,
    innerCornerRadius,
    backgroundCssImage,
  };
}

/**
 * Backward-compatible alias for resolving the Front face appearance.
 */
export function resolveBusinessCardAppearance(
  cfg: BusinessCardConfig,
  vibeTheme?: VibeCardThemeInput
): ResolvedCardAppearance {
  return resolveFrontCardAppearance(cfg, vibeTheme);
}

export interface BackSocialLinkItem {
  platform: string;
  label: string;
  valueLabel: string;
  url: string;
}

const PRIORITY_SOCIAL_ORDER = [
  'instagram',
  'x',
  'twitter',
  'youtube',
  'website',
  'linkedin',
  'github',
  'tiktok',
  'threads',
  'telegram',
  'discord',
  'whatsapp',
  'mail',
  'spotify',
  'twitch',
  'patreon',
  'substack',
];

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  x: 'X',
  twitter: 'X',
  youtube: 'YouTube',
  website: 'Website',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  tiktok: 'TikTok',
  threads: 'Threads',
  telegram: 'Telegram',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  mail: 'Email',
  spotify: 'Spotify',
  twitch: 'Twitch',
  patreon: 'Patreon',
  substack: 'Substack',
};

export function formatSocialHandleLabel(platform: string, rawVal: string): string {
  const trimmed = (rawVal || '').trim();
  if (!trimmed) return '';

  if (platform === 'mail' || platform === 'email') {
    return trimmed.replace(/^mailto:/i, '');
  }

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, '');
    const segs = u.pathname.split('/').filter(Boolean);
    if (platform === 'website' || platform === 'globe') {
      return `${host}${u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : ''}`.slice(0, 28);
    }
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      if (platform === 'linkedin' && segs[0] === 'in' && segs[1]) {
        return `in/${segs[1]}`;
      }
      if (platform === 'youtube') {
        const handleSeg = segs.find((s) => s.startsWith('@')) || last;
        return handleSeg.startsWith('@') ? handleSeg : `@${handleSeg}`;
      }
      if (['instagram', 'x', 'twitter', 'tiktok', 'threads'].includes(platform)) {
        return last.startsWith('@') ? last : `@${last}`;
      }
      return last;
    }
    return host;
  } catch {
    return trimmed.slice(0, 26);
  }
}

export function buildBackSocialLinks(
  socials?: Record<string, string> | null,
  websiteUrl?: string | null,
  cleanUsername?: string
): BackSocialLinkItem[] {
  const entries = Object.entries(socials || {}).filter(
    ([, val]) => typeof val === 'string' && val.trim().length > 0
  );

  const hasWebsiteInSocials = entries.some(([k]) => k.toLowerCase().trim() === 'website');
  if (!hasWebsiteInSocials && websiteUrl && websiteUrl.trim()) {
    entries.push(['website', websiteUrl.trim()]);
  }

  const items: BackSocialLinkItem[] = [];
  const seen = new Set<string>();

  const pushEntry = (platformRaw: string, rawVal: string) => {
    const platform = platformRaw.toLowerCase().trim() === 'twitter' ? 'x' : platformRaw.toLowerCase().trim();
    if (seen.has(platform)) return;
    seen.add(platform);

    const url = /^https?:\/\/|^mailto:|^tel:/i.test(rawVal.trim())
      ? rawVal.trim()
      : platform === 'mail' && rawVal.includes('@')
        ? `mailto:${rawVal.trim()}`
        : `https://${rawVal.trim()}`;

    items.push({
      platform,
      label: PLATFORM_NAMES[platform] || platform,
      valueLabel: formatSocialHandleLabel(platform, rawVal),
      url,
    });
  };

  for (const key of PRIORITY_SOCIAL_ORDER) {
    const match = entries.find(([k]) => k.toLowerCase() === key);
    if (match) {
      pushEntry(match[0], match[1]);
    }
  }

  for (const [k, v] of entries) {
    pushEntry(k, v);
  }

  if (!seen.has('website') && cleanUsername && items.length < 4) {
    pushEntry('website', `https://iveo.site/${cleanUsername}`);
  }

  return items.slice(0, 6);
}

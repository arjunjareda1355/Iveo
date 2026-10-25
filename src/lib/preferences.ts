import type { VibeId } from './vibes.ts';

export type ButtonShape = 'square' | 'rounded' | 'pill';

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
  category?: string | null;
  socials?: Record<string, string>;
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
};

const VALID_VIBE_IDS = new Set<VibeId>([
  'clean',
  'midnight',
  'paper',
  'sage',
  'clay',
  'mono',
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
  };
}

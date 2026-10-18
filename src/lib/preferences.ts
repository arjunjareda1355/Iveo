import { VibeId } from './vibes';

export type ButtonShape = 'square' | 'rounded' | 'pill';

export interface IvioPreferences {
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  onboardingComplete: boolean;
  onboardedAt: string | null;
}

export const DEFAULT_PREFERENCES: IvioPreferences = {
  vibeId: 'clean',
  buttonShape: null,
  onboardingComplete: false,
  onboardedAt: null,
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
 * Defensively parses client-writable unsafeMetadata.
 * Unknown or malformed values fall back to defaults.
 */
export function parsePreferences(raw: unknown): IvioPreferences {
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

  return {
    vibeId,
    buttonShape,
    onboardingComplete,
    onboardedAt,
  };
}

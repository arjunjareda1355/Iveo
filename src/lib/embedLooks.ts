import type { CardLookStyle, EmbedLookStyle, EmbedProvider } from '../data/types.ts';
import { getProviderDefaultButtonText } from './providers/definitions.ts';
import { normalizeCardLookKey } from './preferences.ts';

export interface CardLookOption {
  id: CardLookStyle;
  label: string;
  description: string;
}

/**
 * LK-1: Unified card looks shared across every provider and Appearance > Cards.
 */
export const CARD_LOOK_OPTIONS: readonly CardLookOption[] = [
  {
    id: 'match_page',
    label: 'Match page',
    description: 'Uses your page colors and button style.',
  },
  {
    id: 'brand',
    label: 'Brand',
    description: "Clean card with the platform's color on the icon and button.",
  },
  {
    id: 'banner',
    label: 'Banner',
    description: 'Colored banner with the avatar overlapping it.',
  },
  {
    id: 'glass',
    label: 'Glass',
    description: 'Frosted card that lets your background show through.',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'One slim row: picture, name and button.',
  },
  {
    id: 'profile_card',
    label: 'Profile Card',
    description: 'Centered spotlight card with larger avatar & bold CTA pill.',
  },
  {
    id: 'with_posts',
    label: 'With Posts',
    description: 'Profile header paired with latest activity & highlights strip.',
  },
] as const;

export function getCardLookOption(look?: EmbedLookStyle | string | null): CardLookOption {
  const canonical = normalizeEmbedLookStyle(look, 'match_page');
  return CARD_LOOK_OPTIONS.find((opt) => opt.id === canonical) || CARD_LOOK_OPTIONS[0];
}

export function getEmbedLookOptions(_provider?: EmbedProvider): CardLookOption[] {
  return [...CARD_LOOK_OPTIONS];
}

export function getLookLabelForProvider(
  _provider: EmbedProvider | string,
  lookStyle?: EmbedLookStyle | string | null
): string {
  return getCardLookOption(lookStyle).label;
}

/**
 * LK-1 alias resolver: reads legacy presets ('signature', 'spotlight', 'theme', 'minimal',
 * 'glass', 'Executive Blue', etc.) into the 5 canonical looks without rewriting DB data.
 */
export function normalizeEmbedLookStyle(
  value: unknown,
  fallback: CardLookStyle = 'match_page'
): CardLookStyle {
  return normalizeCardLookKey(value, fallback);
}

export function getDefaultEmbedCtaLabel(
  provider: EmbedProvider | string,
  subtype?: string | null
): string {
  return getProviderDefaultButtonText(provider, subtype);
}

export function isSocialEmbedProvider(
  provider: EmbedProvider | string | null | undefined
): boolean {
  return (
    provider === 'discord' ||
    provider === 'github' ||
    provider === 'linkedin' ||
    provider === 'x' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'threads' ||
    provider === 'pinterest' ||
    provider === 'twitch' ||
    provider === 'snapchat' ||
    provider === 'linktree' ||
    provider === 'bluesky'
  );
}

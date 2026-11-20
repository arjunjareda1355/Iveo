export type ProviderId =
  | 'youtube'
  | 'x'
  | 'github'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'discord'
  | 'linktree'
  | 'spotify'
  | 'pinterest'
  | 'soundcloud'
  | 'bluesky'
  | 'generic';

export type CardLookId = 'match_page' | 'brand' | 'banner' | 'glass' | 'compact';
export type LegacyEmbedLookId = 'signature' | 'spotlight' | 'glass' | 'minimal' | 'theme';
export type AnyCardLookId = CardLookId | LegacyEmbedLookId;

export type CardAccentMode = 'brand' | 'page' | 'custom';
export type CardCornerMode = 'page' | 'sharp' | 'rounded' | 'pill';
export type CardButtonStyle = 'filled' | 'outline' | 'text' | 'hidden';
export type DisplayAsMode = 'card' | 'player';
export type PlayerSize = 'compact' | 'standard' | 'large';
export type ContentKind = 'profile' | 'item';

export interface ProviderKindCapabilities {
  avatar: boolean;
  artwork: boolean;
  banner: boolean;
  name: boolean;
  handle: boolean;
  summary: boolean;
  stats: boolean;
  player: boolean;
}

export interface ProviderBrandRestrictions {
  unmodifiedArtwork?: boolean;
  logoRequired?: boolean;
  linkBackRequired?: boolean;
  noArtworkBanner?: boolean;
  restrictionReason?: string;
}

export interface ProviderKindDefinition {
  label: string;
  contentKind: ContentKind;
  placeholder: string;
  defaultButtonText: string;
  capabilities: ProviderKindCapabilities;
}

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  brandColor: string;
  brandTextOnFill: '#000000' | '#FFFFFF';
  category: 'social' | 'player' | 'link';
  supportsOAuth: boolean;
  oauthScopes?: string[];
  oauthCopy?: string;
  supportsRefresh: boolean;
  refreshIntervalHours: 6 | 24;
  allowedDisplayModes: readonly DisplayAsMode[];
  defaultDisplayMode: DisplayAsMode;
  playerSizes?: readonly PlayerSize[];
  defaultPlayerSize?: PlayerSize;
  restrictions?: ProviderBrandRestrictions;
  strategies: readonly ('api' | 'oembed' | 'opengraph' | 'manual')[];
  kinds: Record<string, ProviderKindDefinition>;
  defaultKind: string;
}

export interface DetectedProviderUrl {
  provider: ProviderId;
  subtype: string;
  label: string;
  contentKind: ContentKind;
  canonicalUrl: string;
  identifier: string;
  embedSrc: string | null;
  defaultDisplayAs: DisplayAsMode;
  aspect?: '16/9';
  height?: number;
  isShortLink?: boolean;
}

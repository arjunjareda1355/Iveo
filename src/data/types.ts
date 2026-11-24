import { VibeId } from '../lib/vibes';
import {
  ButtonShape,
  BackgroundConfig,
  BackgroundType,
  GradientDirection,
  BackgroundImageFit,
  DEFAULT_BACKGROUND_CONFIG,
  LayoutSettings,
} from '../lib/preferences';
import type { FontSettings } from '../lib/fonts';
import type { ButtonColors } from '../lib/colors';
import type { BusinessCardConfig } from '../lib/businessCardConfig';
import type { PlanSource, SubscriptionRecord } from '../lib/plan';
import type { Appearance } from '../lib/appearance/types';

export { DEFAULT_BACKGROUND_CONFIG };
export type {
  BackgroundConfig,
  BackgroundType,
  GradientDirection,
  BackgroundImageFit,
  FontSettings,
  ButtonColors,
  BusinessCardConfig,
  LayoutSettings,
};

export type BlockKind =
  | 'link'
  | 'header'
  | 'divider'
  | 'embed'
  | 'signup'
  | 'tip_jar'
  | 'faq'
  | 'vcard'
  | 'coffee'
  | 'instagram'
  | 'youtube'
  | 'product'
  | 'booking'
  | 'countdown'
  | 'promo'
  | 'location'
  | 'download'
  | 'bluesky';

export type BlockLayout = 'classic' | 'featured';
export type EmbedProvider =
  | 'youtube'
  | 'spotify'
  | 'soundcloud'
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'pinterest'
  | 'linktree'
  | 'bluesky'
  | 'generic';
export type LinkAnimation = 'none' | 'pulse' | 'shimmer' | 'bounce' | 'glow';
export type CardLookStyle =
  | 'match_page'
  | 'brand'
  | 'banner'
  | 'glass'
  | 'compact'
  | 'profile_card'
  | 'with_posts';
export type EmbedLookStyle = CardLookStyle | 'signature' | 'spotlight' | 'minimal' | 'theme';

export type BannerSource = 'auto' | 'upload' | 'color';

export interface CardBannerConfig {
  source?: BannerSource;
  imageUrl?: string | null;
  smallImageUrl?: string | null;
  color?: string | null;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  dim?: number;
}

export interface EmbedMetaData {
  provider: EmbedProvider;
  subtype?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  banner?: CardBannerConfig | null;
  badgeText?: string | null;
  statsLabel?: string | null;
  stats?: Array<{ key: string; value: string }>;
  handle?: string | null;
  htmlSnippet?: string | null;
  accentColor?: string | null;
  accentMode?: 'brand' | 'page' | 'custom';
  corners?: 'page' | 'sharp' | 'rounded' | 'pill';
  lookStyle?: EmbedLookStyle | null;
  showAvatar?: boolean;
  showStats?: boolean;
  showDescription?: boolean;
  showPlatformLabel?: boolean;
  ctaLabel?: string | null;
  buttonStyle?: 'filled' | 'outline' | 'text' | 'hidden';
  displayAs?: 'card' | 'player';
  playerSize?: 'compact' | 'standard' | 'large';
  connectedViaOAuth?: boolean;
  needsAttention?: boolean;
  failureCount?: number;
  staleSnapshot?: boolean;
  source?: 'api' | 'oembed' | 'opengraph' | 'manual';
  fetchedAt?: string | null;
  override?: {
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  };
}

export type SignupCollectMode = 'email' | 'phone' | 'both';
export type SignupBlockStyle = 'classic' | 'compact' | 'minimal' | 'spotlight';

export interface SignupConfig {
  collect: SignupCollectMode;
  button: string;
  consent: string;
  description: string | null;
  heading?: string;
  style?: SignupBlockStyle;
}

export interface TipJarConfig {
  amounts: number[];
  currency: string;
  buttonText: string;
  paymentUrl: string;
  description?: string | null;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqConfig {
  items: FaqItem[];
}

export interface VCardConfig {
  fullName: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  note?: string;
}

export interface CoffeeSupporter {
  id: string;
  supporterName: string;
  coffees: number;
  note?: string | null;
  createdAt?: string | null;
}

export interface CoffeeExtra {
  id: string;
  title: string;
  price?: string | null;
  description?: string | null;
  image?: string | null;
  url?: string | null;
}

export interface CoffeeData {
  slug?: string;
  creatorName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coffeePrice?: string | null;
  supportersCount?: number | null;
  supportersLabel?: string | null;
  extrasCount?: number;
  recentSupporters?: CoffeeSupporter[];
  extras?: CoffeeExtra[];
  buttonLabel?: string | null;
  notePlaceholder?: string | null;
  fetchedAt?: string | null;
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  url: string;
  publishedAt?: string | null;
}

export interface YouTubeData {
  channelId?: string | null;
  handle?: string | null;
  channelTitle?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  subscriberText?: string | null;
  subscriberCount?: number | null;
  videoCount?: number | null;
  latestVideos?: YouTubeVideoItem[];
  showLatestVideo?: boolean;
  connectedViaOAuth?: boolean;
  buttonLabel?: string | null;
  fetchedAt?: string | null;
}

export interface ProductConfig {
  price: string;
  compareAtPrice?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  buttonLabel?: string | null;
  tag?: string | null;
}

export interface BookingConfig {
  duration: string;
  priceLabel?: string | null;
  platform?: string | null;
  description?: string | null;
  buttonLabel?: string | null;
}

export interface CountdownConfig {
  targetAt: string;
  venueOrSubtitle?: string | null;
  expiredLabel?: string | null;
  buttonLabel?: string | null;
}

export interface PromoConfig {
  code: string;
  discountLabel?: string | null;
  merchant?: string | null;
  expiresLabel?: string | null;
}

export interface LocationConfig {
  placeName: string;
  address: string;
  hours?: string | null;
  buttonLabel?: string | null;
}

export interface DownloadConfig {
  fileFormat: string;
  fileSize?: string | null;
  description?: string | null;
  buttonLabel?: string | null;
}

export type BlueskyBlockVariant = 'profile' | 'posts' | 'post' | 'button';

export interface BlueskyBlockOptions {
  limit?: number;
  layout?: 'list' | 'carousel';
  showReplies?: boolean;
  showReposts?: boolean;
  showCounts?: boolean;
  mediaOnly?: boolean;
  compact?: boolean;
  showBanner?: boolean;
  showStats?: boolean;
  showBio?: boolean;
  buttonLabel?: string | null;
  includeFollowerBadge?: boolean;
}

export interface BlueskyConfig {
  type?: 'bluesky_profile' | 'bluesky_posts' | 'bluesky_post' | 'bluesky_button';
  variant: BlueskyBlockVariant;
  handle: string;
  did?: string | null;
  postUri?: string | null;
  verified?: boolean;
  verificationCode?: string | null;
  options: BlueskyBlockOptions;
  displayName?: string | null;
  avatarUrl?: string | null;
  followersCount?: number | null;
}

export interface Block {
  id: string;
  kind: BlockKind;
  title: string;
  url: string | null;
  icon: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  layout: BlockLayout;
  embedProvider: EmbedProvider | null;
  embedMeta?: EmbedMetaData | null;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
  youtube?: YouTubeData | null;
  product?: ProductConfig | null;
  booking?: BookingConfig | null;
  countdown?: CountdownConfig | null;
  promo?: PromoConfig | null;
  location?: LocationConfig | null;
  download?: DownloadConfig | null;
  bluesky?: BlueskyConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
  isProtected?: boolean;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  isArchived: boolean;
  position: number;
}

export interface PublicBlock {
  id: string;
  kind: BlockKind;
  title: string;
  url: string | null;
  icon: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  layout: BlockLayout;
  embedProvider: EmbedProvider | null;
  embedMeta?: EmbedMetaData | null;
  isProtected?: boolean;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
  youtube?: YouTubeData | null;
  product?: ProductConfig | null;
  booking?: BookingConfig | null;
  countdown?: CountdownConfig | null;
  promo?: PromoConfig | null;
  location?: LocationConfig | null;
  download?: DownloadConfig | null;
  bluesky?: BlueskyConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
}

export interface PageBlock {
  id: string;
  kind: BlockKind;
  title: string;
  url: string | null;
  icon?: string | null;
  thumbnailPath?: string | null;
  thumbnailUrl?: string | null;
  layout?: BlockLayout;
  embedProvider?: EmbedProvider | null;
  embedMeta?: EmbedMetaData | null;
  isProtected?: boolean;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
  youtube?: YouTubeData | null;
  product?: ProductConfig | null;
  booking?: BookingConfig | null;
  countdown?: CountdownConfig | null;
  promo?: PromoConfig | null;
  location?: LocationConfig | null;
  download?: DownloadConfig | null;
  bluesky?: BlueskyConfig | null;
  animation?: LinkAnimation | null;
  badge?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
  position?: number;
}

export interface Contact {
  id: string;
  linkId: string | null;
  formTitle: string;
  email: string | null;
  phone: string | null;
  consentText: string;
  source: string;
  createdAt: string;
}

export interface Profile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  isPublished: boolean;
  hideFromSearch: boolean;
  onboardingComplete: boolean;
  plan: 'free' | 'pro';
  planSource?: PlanSource;
  createdAt?: string | null;
  subscription?: SubscriptionRecord | null;
  hideIveoFooter: boolean;
  hideIvioFooter: boolean;
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
  appearance?: Appearance | null;
  updatedAt?: string | null;
}

export interface PublicProfileData {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  vibeId: VibeId;
  plan?: 'free' | 'pro';
  isPro?: boolean;
  isVerified?: boolean;
  isOwnerProfile?: boolean;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  socialsPosition?: 'top' | 'bottom' | 'both';
  hideFromSearch: boolean;
  hideFooter: boolean;
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
  appearance?: Appearance | null;
  updatedAt?: string | null;
}

export interface PublicPageData {
  profile: PublicProfileData | null;
  links: PublicBlock[];
  redirectTo?: string | null;
}

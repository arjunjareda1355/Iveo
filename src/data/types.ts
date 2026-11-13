import { VibeId } from '../lib/vibes';
import { ButtonShape, BackgroundConfig } from '../lib/preferences';
import type { FontSettings } from '../lib/fonts';
import type { ButtonColors } from '../lib/colors';
import type { BusinessCardConfig } from '../lib/businessCardConfig';

export type { BackgroundConfig, FontSettings, ButtonColors, BusinessCardConfig };

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
  | 'youtube';
export type BlockLayout = 'classic' | 'featured';
export type EmbedProvider = 'youtube' | 'spotify' | 'soundcloud';
export type LinkAnimation = 'none' | 'pulse' | 'shimmer' | 'bounce' | 'glow';

export type SignupCollectMode = 'email' | 'phone' | 'both';

export interface SignupConfig {
  collect: SignupCollectMode;
  button: string;
  consent: string;
  description: string | null;
  heading?: string;
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
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
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
  isProtected?: boolean;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
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
  isProtected?: boolean;
  signup?: SignupConfig | null;
  tipJar?: TipJarConfig | null;
  faq?: FaqConfig | null;
  vcard?: VCardConfig | null;
  coffee?: CoffeeData | null;
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
  businessCard?: BusinessCardConfig | null;
}

export interface PublicProfileData {
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
  businessCard?: BusinessCardConfig | null;
}

export interface PublicPageData {
  profile: PublicProfileData | null;
  links: PublicBlock[];
}

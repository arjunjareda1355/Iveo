import { VibeId } from '../lib/vibes';
import { ButtonShape } from '../lib/preferences';

export type BlockKind = 'link' | 'header' | 'divider' | 'embed' | 'signup';
export type BlockLayout = 'classic' | 'featured';
export type EmbedProvider = 'youtube' | 'spotify' | 'soundcloud';

export type SignupCollectMode = 'email' | 'phone' | 'both';

export interface SignupConfig {
  collect: SignupCollectMode;
  button: string;
  consent: string;
  description: string | null;
  heading?: string;
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
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  isPublished: boolean;
  hideFromSearch: boolean;
  onboardingComplete: boolean;
  plan: 'free' | 'pro';
  hideIveoFooter: boolean;
  hideIvioFooter: boolean;
}

export interface PublicProfileData {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  vibeId: VibeId;
  buttonShape: ButtonShape | null;
  socials: Record<string, string>;
  hideFromSearch: boolean;
  hideFooter: boolean;
}

export interface PublicPageData {
  profile: PublicProfileData | null;
  links: PublicBlock[];
}

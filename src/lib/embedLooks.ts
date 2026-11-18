import type { EmbedLookStyle, EmbedProvider } from '../data/types';

export interface EmbedLookOption {
  id: EmbedLookStyle;
  label: string;
  description: string;
  swatchBg: string;
  swatchAccent: string;
  swatchText: string;
}

const PROVIDER_LOOKS: Record<EmbedProvider, EmbedLookOption[]> = {
  discord: [
    {
      id: 'signature',
      label: 'Blurple Server',
      description: 'Discord dark card with online status & blurple CTA',
      swatchBg: '#1E1F22',
      swatchAccent: '#5865F2',
      swatchText: '#FFFFFF',
    },
    {
      id: 'spotlight',
      label: 'Nitro Banner',
      description: 'Gradient header strip & elevated community highlight',
      swatchBg: '#2B2D31',
      swatchAccent: '#8045DD',
      swatchText: '#FFFFFF',
    },
    {
      id: 'glass',
      label: 'Frosted Community',
      description: 'Translucent glass card adapting over your backdrop',
      swatchBg: 'rgba(88, 101, 242, 0.16)',
      swatchAccent: '#5865F2',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Invite',
      description: 'Single-row sleek invite bar with quick join chip',
      swatchBg: '#FFFFFF',
      swatchAccent: '#5865F2',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  github: [
    {
      id: 'signature',
      label: 'Developer Dark',
      description: 'GitHub dark card with monospace handle & repo metrics',
      swatchBg: '#0D1117',
      swatchAccent: '#2EA043',
      swatchText: '#F0F6FC',
    },
    {
      id: 'spotlight',
      label: 'Terminal Showcase',
      description: 'Code window header bar with repo badge & stars',
      swatchBg: '#161B22',
      swatchAccent: '#58A6FF',
      swatchText: '#F0F6FC',
    },
    {
      id: 'glass',
      label: 'Frosted Code',
      description: 'Glassmorphic developer card with monospace path',
      swatchBg: 'rgba(13, 17, 23, 0.14)',
      swatchAccent: '#24292F',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Repo Bar',
      description: 'Slim horizontal GitHub row for dense link stacks',
      swatchBg: '#FFFFFF',
      swatchAccent: '#24292F',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  linkedin: [
    {
      id: 'signature',
      label: 'Executive Blue',
      description: 'Crisp corporate card with LinkedIn blue accent & CTA',
      swatchBg: '#FFFFFF',
      swatchAccent: '#0A66C2',
      swatchText: '#111827',
    },
    {
      id: 'spotlight',
      label: 'Cover Banner',
      description: 'LinkedIn gradient top banner with overlapping avatar',
      swatchBg: '#EEF3F8',
      swatchAccent: '#0A66C2',
      swatchText: '#0F172A',
    },
    {
      id: 'glass',
      label: 'Frosted Network',
      description: 'Translucent glass card with subtle LinkedIn tint',
      swatchBg: 'rgba(10, 102, 194, 0.12)',
      swatchAccent: '#0A66C2',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Business',
      description: 'Streamlined horizontal networking strip',
      swatchBg: '#FFFFFF',
      swatchAccent: '#0A66C2',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  x: [
    {
      id: 'signature',
      label: 'Obsidian X',
      description: 'High-contrast pure black X card with crisp white pill',
      swatchBg: '#000000',
      swatchAccent: '#FFFFFF',
      swatchText: '#FFFFFF',
    },
    {
      id: 'spotlight',
      label: 'Editorial Post',
      description: 'Featured quote frame highlighting your bio or post',
      swatchBg: '#101419',
      swatchAccent: '#1D9BF0',
      swatchText: '#FFFFFF',
    },
    {
      id: 'glass',
      label: 'Frosted X',
      description: 'Translucent card with monochrome X emblem',
      swatchBg: 'rgba(15, 20, 25, 0.12)',
      swatchAccent: '#0F1419',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Handle',
      description: 'Sleek one-line X handle bar with Follow chip',
      swatchBg: '#FFFFFF',
      swatchAccent: '#000000',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  youtube: [
    {
      id: 'signature',
      label: 'Cinema Dark',
      description: 'Sleek theater frame with crimson YouTube play button',
      swatchBg: '#0F0F0F',
      swatchAccent: '#FF0000',
      swatchText: '#FFFFFF',
    },
    {
      id: 'spotlight',
      label: 'Thumbnail Poster',
      description: 'Rich video thumbnail cover with bold watch trigger',
      swatchBg: '#18181B',
      swatchAccent: '#FF0000',
      swatchText: '#FFFFFF',
    },
    {
      id: 'glass',
      label: 'Frosted Player',
      description: 'Translucent video facade over your page backdrop',
      swatchBg: 'rgba(255, 0, 0, 0.10)',
      swatchAccent: '#FF0000',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Video Bar',
      description: 'Space-saving play bar that expands when clicked',
      swatchBg: '#FFFFFF',
      swatchAccent: '#FF0000',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  spotify: [
    {
      id: 'signature',
      label: 'Spotify Stage',
      description: 'Deep charcoal stage with Spotify green play button',
      swatchBg: '#121212',
      swatchAccent: '#1DB954',
      swatchText: '#FFFFFF',
    },
    {
      id: 'spotlight',
      label: 'Album Spotlight',
      description: 'Cover-art banner with audio equalizer bars',
      swatchBg: '#181818',
      swatchAccent: '#1ED760',
      swatchText: '#FFFFFF',
    },
    {
      id: 'glass',
      label: 'Frosted Audio',
      description: 'Translucent music card blending into your theme',
      swatchBg: 'rgba(29, 185, 84, 0.14)',
      swatchAccent: '#1DB954',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Track',
      description: 'Slim audio player strip with instant load button',
      swatchBg: '#FFFFFF',
      swatchAccent: '#1DB954',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  soundcloud: [
    {
      id: 'signature',
      label: 'SoundCloud Wave',
      description: 'Warm audio card with signature orange waveform bars',
      swatchBg: '#181818',
      swatchAccent: '#FF5500',
      swatchText: '#FFFFFF',
    },
    {
      id: 'spotlight',
      label: 'Orange Studio',
      description: 'Sunset orange top accent with track cover highlight',
      swatchBg: '#FFF5F0',
      swatchAccent: '#FF5500',
      swatchText: '#1C1917',
    },
    {
      id: 'glass',
      label: 'Frosted Sound',
      description: 'Translucent waveform card adapting to your background',
      swatchBg: 'rgba(255, 85, 0, 0.12)',
      swatchAccent: '#FF5500',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Wave Bar',
      description: 'Single-row audio bar with waveform & play button',
      swatchBg: '#FFFFFF',
      swatchAccent: '#FF5500',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  instagram: [
    {
      id: 'signature',
      label: 'Gradient Studio',
      description: 'Signature Instagram gradient ring with crisp creator card',
      swatchBg: '#FFFFFF',
      swatchAccent: '#E1306C',
      swatchText: '#111827',
    },
    {
      id: 'spotlight',
      label: 'Creator Banner',
      description: 'Warm sunset-to-magenta header banner with Follow CTA',
      swatchBg: '#FFF1F5',
      swatchAccent: '#C13584',
      swatchText: '#111827',
    },
    {
      id: 'glass',
      label: 'Frosted Gram',
      description: 'Translucent glass card with subtle rose-amber highlight',
      swatchBg: 'rgba(225, 48, 108, 0.12)',
      swatchAccent: '#E1306C',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Handle',
      description: 'Slim horizontal Instagram bar with gradient avatar badge',
      swatchBg: '#FFFFFF',
      swatchAccent: '#E1306C',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  facebook: [
    {
      id: 'signature',
      label: 'Classic Meta Blue',
      description: 'Clean white card with Facebook blue accent & CTA button',
      swatchBg: '#FFFFFF',
      swatchAccent: '#1877F2',
      swatchText: '#1C1E21',
    },
    {
      id: 'spotlight',
      label: 'Page Cover',
      description: 'Facebook blue header strip showcasing your Page or group',
      swatchBg: '#F0F2F5',
      swatchAccent: '#1877F2',
      swatchText: '#050505',
    },
    {
      id: 'glass',
      label: 'Frosted Meta',
      description: 'Translucent glass card with crisp Facebook blue badge',
      swatchBg: 'rgba(24, 119, 242, 0.12)',
      swatchAccent: '#1877F2',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact Page Bar',
      description: 'One-row networking bar linking straight to Facebook',
      swatchBg: '#FFFFFF',
      swatchAccent: '#1877F2',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
  threads: [
    {
      id: 'signature',
      label: 'Monochrome Thread',
      description: 'Stark high-contrast Threads dark card with crisp white CTA',
      swatchBg: '#101010',
      swatchAccent: '#FFFFFF',
      swatchText: '#F5F5F5',
    },
    {
      id: 'spotlight',
      label: 'Quoted Thread',
      description: 'Featured conversation header highlighting your bio or post',
      swatchBg: '#18181B',
      swatchAccent: '#FFFFFF',
      swatchText: '#FFFFFF',
    },
    {
      id: 'glass',
      label: 'Frosted Thread',
      description: 'Translucent card with monochrome @ emblem',
      swatchBg: 'rgba(16, 16, 16, 0.12)',
      swatchAccent: '#101010',
      swatchText: '#0A0A0A',
    },
    {
      id: 'minimal',
      label: 'Compact @Handle',
      description: 'Single-row Threads bar with instant Follow chip',
      swatchBg: '#FFFFFF',
      swatchAccent: '#101010',
      swatchText: '#111827',
    },
    {
      id: 'theme',
      label: 'Match Page Vibe',
      description: 'Follows your selected Vibe colors & button borders',
      swatchBg: '#F4F4F5',
      swatchAccent: '#18181B',
      swatchText: '#18181B',
    },
  ],
};

export function getEmbedLookOptions(provider: EmbedProvider): EmbedLookOption[] {
  return PROVIDER_LOOKS[provider] || PROVIDER_LOOKS.youtube;
}

export function normalizeEmbedLookStyle(
  value: unknown,
  fallback: EmbedLookStyle = 'signature'
): EmbedLookStyle {
  if (
    value === 'signature' ||
    value === 'spotlight' ||
    value === 'glass' ||
    value === 'minimal' ||
    value === 'theme'
  ) {
    return value;
  }
  return fallback;
}

export function getDefaultEmbedCtaLabel(
  provider: EmbedProvider,
  subtype?: string | null
): string {
  switch (provider) {
    case 'discord':
      return subtype === 'user' ? 'Add on Discord' : 'Join Server';
    case 'github':
      return subtype === 'repo' ? 'View Repo' : 'View on GitHub';
    case 'linkedin':
      return subtype === 'company' ? 'View Page' : 'Connect';
    case 'x':
      return subtype === 'post' ? 'Read Post' : 'Follow on X';
    case 'instagram':
      return subtype === 'reel' ? 'Watch Reel' : subtype === 'post' ? 'View Post' : 'Follow';
    case 'facebook':
      return subtype === 'group' ? 'Join Group' : 'View on Facebook';
    case 'threads':
      return subtype === 'post' ? 'View Thread' : 'Follow';
    case 'youtube':
      return 'Play';
    case 'spotify':
      return 'Listen';
    case 'soundcloud':
      return 'Play Track';
    default:
      return 'Open';
  }
}

export function isSocialEmbedProvider(
  provider: EmbedProvider | string | null | undefined
): provider is 'discord' | 'github' | 'linkedin' | 'x' | 'instagram' | 'facebook' | 'threads' {
  return (
    provider === 'discord' ||
    provider === 'github' ||
    provider === 'linkedin' ||
    provider === 'x' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'threads'
  );
}

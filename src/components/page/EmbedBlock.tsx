import React, { useState, useEffect } from 'react';
import {
  Play,
  Music,
  Headphones,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  Star,
  Terminal,
  Instagram,
} from 'lucide-react';
import { EmbedLookStyle, EmbedProvider, PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { parseEmbedUrl } from '../../lib/embeds';
import { formatExternalUrl } from '../../lib/urls';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';
import {
  getDefaultEmbedCtaLabel,
  normalizeEmbedLookStyle,
} from '../../lib/embedLooks';

interface EmbedBlockProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  embedMode: 'placeholder' | 'live';
  activeEmbedId: string | null;
  onActivate: (id: string) => void;
  fontFamily?: string;
  scale?: number;
  onLinkClick?: (block: PageBlock) => void;
  surfaceStyle?: React.CSSProperties;
}

export const DiscordGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
  </svg>
);

export const XMarkGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const FacebookGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
  </svg>
);

export const ThreadsGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.182c.98-1.454 2.513-2.259 4.47-2.259h.044c3.194.02 5.097 1.973 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z" />
  </svg>
);

function buildAutoplayEmbedUrl(embedSrc: string, provider: string): string {
  if (provider === 'youtube') {
    let next = embedSrc.includes('?') ? `${embedSrc}&autoplay=1` : `${embedSrc}?autoplay=1`;
    if (typeof window !== 'undefined' && window.location?.origin) {
      next += `&origin=${encodeURIComponent(window.location.origin)}`;
    }
    return next;
  }
  if (provider === 'soundcloud') {
    return embedSrc.replace('auto_play=false', 'auto_play=true');
  }
  return embedSrc;
}

interface ProviderPalette {
  bg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  bannerGradient: string;
}

function getProviderPalette(
  provider: EmbedProvider,
  look: EmbedLookStyle,
  vibe: Vibe,
  baseSurface: React.CSSProperties
): ProviderPalette {
  const { tokens } = vibe;
  const themeFallback: ProviderPalette = {
    bg: String(baseSurface.backgroundColor || tokens.buttonBg),
    text: String(baseSurface.color || tokens.buttonText),
    muted: 'rgba(120,120,128,0.85)',
    border: tokens.buttonBorder || 'rgba(128,128,128,0.22)',
    accent: tokens.text,
    accentText: tokens.bg,
    badgeBg: 'rgba(128,128,128,0.12)',
    badgeText: String(baseSurface.color || tokens.buttonText),
    bannerGradient: `linear-gradient(135deg, ${tokens.text}, ${tokens.buttonBg})`,
  };

  if (look === 'theme') return themeFallback;

  if (look === 'glass') {
    const accentMap: Record<EmbedProvider, string> = {
      discord: '#5865F2',
      github: '#24292F',
      linkedin: '#0A66C2',
      x: '#0F1419',
      instagram: '#E1306C',
      facebook: '#1877F2',
      threads: '#101010',
      youtube: '#FF0000',
      spotify: '#1DB954',
      soundcloud: '#FF5500',
    };
    return {
      bg: 'rgba(255, 255, 255, 0.72)',
      text: '#0F172A',
      muted: '#475569',
      border: 'rgba(255, 255, 255, 0.55)',
      accent: accentMap[provider],
      accentText: '#FFFFFF',
      badgeBg: 'rgba(15, 23, 42, 0.08)',
      badgeText: '#0F172A',
      bannerGradient: `linear-gradient(135deg, ${accentMap[provider]}33, rgba(255,255,255,0.2))`,
    };
  }

  if (look === 'minimal') {
    const accentMap: Record<EmbedProvider, string> = {
      discord: '#5865F2',
      github: '#24292F',
      linkedin: '#0A66C2',
      x: '#000000',
      instagram: '#E1306C',
      facebook: '#1877F2',
      threads: '#101010',
      youtube: '#FF0000',
      spotify: '#1DB954',
      soundcloud: '#FF5500',
    };
    return {
      bg: '#FFFFFF',
      text: '#111827',
      muted: '#6B7280',
      border: '#E5E7EB',
      accent: accentMap[provider],
      accentText: '#FFFFFF',
      badgeBg: '#F3F4F6',
      badgeText: '#374151',
      bannerGradient: accentMap[provider],
    };
  }

  switch (provider) {
    case 'discord':
      return look === 'spotlight'
        ? {
            bg: '#2B2D31',
            text: '#FFFFFF',
            muted: '#B5BAC1',
            border: 'rgba(88, 101, 242, 0.45)',
            accent: '#5865F2',
            accentText: '#FFFFFF',
            badgeBg: 'rgba(88, 101, 242, 0.25)',
            badgeText: '#E0E3FF',
            bannerGradient: 'linear-gradient(135deg, #5865F2 0%, #8045DD 100%)',
          }
        : {
            bg: '#1E1F22',
            text: '#F2F3F5',
            muted: '#949BA4',
            border: '#313338',
            accent: '#5865F2',
            accentText: '#FFFFFF',
            badgeBg: 'rgba(88, 101, 242, 0.22)',
            badgeText: '#C9CDFB',
            bannerGradient: '#5865F2',
          };
    case 'github':
      return look === 'spotlight'
        ? {
            bg: '#161B22',
            text: '#F0F6FC',
            muted: '#8B949E',
            border: '#30363D',
            accent: '#2EA043',
            accentText: '#FFFFFF',
            badgeBg: 'rgba(88, 166, 255, 0.14)',
            badgeText: '#79C0FF',
            bannerGradient: 'linear-gradient(135deg, #0D1117 0%, #1F2937 100%)',
          }
        : {
            bg: '#0D1117',
            text: '#F0F6FC',
            muted: '#8B949E',
            border: '#30363D',
            accent: '#F0F6FC',
            accentText: '#0D1117',
            badgeBg: '#21262D',
            badgeText: '#C9D1D9',
            bannerGradient: '#161B22',
          };
    case 'linkedin':
      return look === 'spotlight'
        ? {
            bg: '#FFFFFF',
            text: '#0F172A',
            muted: '#475569',
            border: '#CBD5E1',
            accent: '#0A66C2',
            accentText: '#FFFFFF',
            badgeBg: '#E8F2FC',
            badgeText: '#0A66C2',
            bannerGradient: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
          }
        : {
            bg: '#FFFFFF',
            text: '#111827',
            muted: '#4B5563',
            border: '#D1D5DB',
            accent: '#0A66C2',
            accentText: '#FFFFFF',
            badgeBg: '#EFF6FF',
            badgeText: '#0A66C2',
            bannerGradient: '#0A66C2',
          };
    case 'x':
      return look === 'spotlight'
        ? {
            bg: '#101419',
            text: '#FFFFFF',
            muted: '#8B98A5',
            border: '#2F3336',
            accent: '#1D9BF0',
            accentText: '#FFFFFF',
            badgeBg: 'rgba(29, 155, 240, 0.16)',
            badgeText: '#71C9F8',
            bannerGradient: 'linear-gradient(135deg, #000000 0%, #16202A 100%)',
          }
        : {
            bg: '#000000',
            text: '#FFFFFF',
            muted: '#A1A1AA',
            border: '#27272A',
            accent: '#FFFFFF',
            accentText: '#000000',
            badgeBg: '#18181B',
            badgeText: '#E4E4E7',
            bannerGradient: '#000000',
          };
    case 'instagram':
      return look === 'spotlight'
        ? {
            bg: '#FFF8FA',
            text: '#111827',
            muted: '#6B7280',
            border: '#FBCFE8',
            accent: '#E1306C',
            accentText: '#FFFFFF',
            badgeBg: '#FCE7F3',
            badgeText: '#BE185D',
            bannerGradient: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 52%, #8134AF 100%)',
          }
        : {
            bg: '#FFFFFF',
            text: '#111827',
            muted: '#6B7280',
            border: '#F3E8FF',
            accent: '#E1306C',
            accentText: '#FFFFFF',
            badgeBg: '#FDF2F8',
            badgeText: '#BE185D',
            bannerGradient: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 52%, #8134AF 100%)',
          };
    case 'facebook':
      return look === 'spotlight'
        ? {
            bg: '#FFFFFF',
            text: '#050505',
            muted: '#65676B',
            border: '#CBD5E1',
            accent: '#1877F2',
            accentText: '#FFFFFF',
            badgeBg: '#E7F3FF',
            badgeText: '#1877F2',
            bannerGradient: 'linear-gradient(135deg, #1877F2 0%, #0C5DC7 100%)',
          }
        : {
            bg: '#FFFFFF',
            text: '#1C1E21',
            muted: '#65676B',
            border: '#DCE1E8',
            accent: '#1877F2',
            accentText: '#FFFFFF',
            badgeBg: '#E7F3FF',
            badgeText: '#1877F2',
            bannerGradient: '#1877F2',
          };
    case 'threads':
      return look === 'spotlight'
        ? {
            bg: '#18181B',
            text: '#FFFFFF',
            muted: '#A1A1AA',
            border: '#27272A',
            accent: '#FFFFFF',
            accentText: '#101010',
            badgeBg: '#27272A',
            badgeText: '#F4F4F5',
            bannerGradient: 'linear-gradient(135deg, #101010 0%, #27272A 100%)',
          }
        : {
            bg: '#101010',
            text: '#F5F5F5',
            muted: '#A1A1AA',
            border: '#262626',
            accent: '#FFFFFF',
            accentText: '#101010',
            badgeBg: '#1F1F1F',
            badgeText: '#E5E5E5',
            bannerGradient: '#101010',
          };
    case 'youtube':
      return {
        bg: '#0F0F0F',
        text: '#FFFFFF',
        muted: '#AAAAAA',
        border: '#272727',
        accent: '#FF0000',
        accentText: '#FFFFFF',
        badgeBg: 'rgba(255, 0, 0, 0.18)',
        badgeText: '#FF8A8A',
        bannerGradient: 'linear-gradient(135deg, #280808 0%, #0F0F0F 100%)',
      };
    case 'spotify':
      return {
        bg: '#121212',
        text: '#FFFFFF',
        muted: '#B3B3B3',
        border: '#282828',
        accent: '#1DB954',
        accentText: '#000000',
        badgeBg: 'rgba(29, 185, 84, 0.18)',
        badgeText: '#1ED760',
        bannerGradient: 'linear-gradient(135deg, #12331D 0%, #121212 100%)',
      };
    case 'soundcloud':
      return look === 'spotlight'
        ? {
            bg: '#FFF7F2',
            text: '#1C1917',
            muted: '#78716C',
            border: '#FED7AA',
            accent: '#FF5500',
            accentText: '#FFFFFF',
            badgeBg: '#FFEDD5',
            badgeText: '#C2410C',
            bannerGradient: 'linear-gradient(135deg, #FF5500 0%, #FF8800 100%)',
          }
        : {
            bg: '#18181B',
            text: '#FFFFFF',
            muted: '#A1A1AA',
            border: '#27272A',
            accent: '#FF5500',
            accentText: '#FFFFFF',
            badgeBg: 'rgba(255, 85, 0, 0.2)',
            badgeText: '#FDBA74',
            bannerGradient: 'linear-gradient(135deg, #431407 0%, #18181B 100%)',
          };
  }
}

export const EmbedBlock: React.FC<EmbedBlockProps> = ({
  block,
  vibe,
  effectiveRadius,
  embedMode,
  activeEmbedId,
  onActivate,
  fontFamily,
  scale = 1,
  onLinkClick,
  surfaceStyle,
}) => {
  const { tokens } = vibe;
  const parsed = parseEmbedUrl(block.url || '');
  const provider = parsed?.provider || block.embedProvider || 'youtube';
  const meta = block.embedMeta;
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [meta?.avatarUrl]);

  const isSocialCardProvider =
    provider === 'discord' ||
    provider === 'github' ||
    provider === 'linkedin' ||
    provider === 'x' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'threads';

  const lookStyle = normalizeEmbedLookStyle(meta?.lookStyle, 'signature');
  const showDescription = meta?.showDescription !== false;
  const showStats = meta?.showStats !== false;

  const providerLabel =
    provider === 'youtube'
      ? 'YouTube'
      : provider === 'spotify'
        ? 'Spotify'
        : provider === 'soundcloud'
          ? 'SoundCloud'
          : provider === 'discord'
            ? 'Discord'
            : provider === 'github'
              ? 'GitHub'
              : provider === 'linkedin'
                ? 'LinkedIn'
                : provider === 'instagram'
                  ? 'Instagram'
                  : provider === 'facebook'
                    ? 'Facebook'
                    : provider === 'threads'
                      ? 'Threads'
                      : 'X';

  const renderProviderGlyph = (iconSize: number) => {
    switch (provider) {
      case 'youtube':
        return <Play size={iconSize} strokeWidth={1.7} fill="currentColor" />;
      case 'spotify':
        return <Music size={iconSize} strokeWidth={1.7} />;
      case 'soundcloud':
        return <Headphones size={iconSize} strokeWidth={1.7} />;
      case 'discord':
        return <DiscordGlyph size={iconSize} />;
      case 'github':
        return <Github size={iconSize} strokeWidth={1.8} />;
      case 'linkedin':
        return <Linkedin size={iconSize} strokeWidth={1.8} />;
      case 'x':
        return <XMarkGlyph size={Math.max(13, iconSize - 2)} />;
      case 'instagram':
        return <Instagram size={iconSize} strokeWidth={1.9} />;
      case 'facebook':
        return <FacebookGlyph size={Math.max(13, iconSize - 1)} />;
      case 'threads':
        return <ThreadsGlyph size={Math.max(13, iconSize - 1)} />;
      default:
        return <Globe size={iconSize} strokeWidth={1.7} />;
    }
  };

  const isActivePlayer = activeEmbedId === block.id;
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const baseSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    color: tokens.buttonText,
    border: tokens.buttonBorder
      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
      : 'none',
    boxShadow: tokens.buttonShadow || 'none',
  };

  const palette = getProviderPalette(provider, lookStyle, vibe, baseSurface);

  // ============================================================================
  // 1. SOCIAL / DEVELOPER EMBED CARDS (Discord, GitHub, LinkedIn, X)
  // ============================================================================
  if (isSocialCardProvider) {
    const targetUrl = parsed?.canonicalUrl || (block.url ? formatExternalUrl(block.url) : '#');
    const cardTitle = meta?.title || block.title || parsed?.label || `${providerLabel} link`;
    const cardSubtitle = meta?.subtitle || (parsed?.identifier ? `@${parsed.identifier}` : undefined);
    const cardDesc = showDescription ? meta?.description : null;
    const statsLabel = showStats ? meta?.statsLabel : null;
    const badgeText = meta?.badgeText || providerLabel;
    const customCta = meta?.ctaLabel?.trim();
    const ctaText = customCta || getDefaultEmbedCtaLabel(provider, parsed?.subtype);

    const cardSurfaceStyle: React.CSSProperties =
      lookStyle === 'theme'
        ? {
            ...baseSurface,
            fontFamily: fontFamily || vibe.fontFamily,
            borderRadius: `${cardRadius}px`,
          }
        : {
            backgroundColor: palette.bg,
            color: palette.text,
            border: `1px solid ${palette.border}`,
            backdropFilter: lookStyle === 'glass' ? 'blur(14px)' : undefined,
            WebkitBackdropFilter: lookStyle === 'glass' ? 'blur(14px)' : undefined,
            boxShadow:
              lookStyle === 'spotlight'
                ? '0 10px 26px rgba(10, 10, 18, 0.16)'
                : lookStyle === 'glass'
                  ? '0 6px 20px rgba(10, 10, 18, 0.08)'
                  : '0 2px 8px rgba(10, 10, 10, 0.06)',
            fontFamily: fontFamily || vibe.fontFamily,
            borderRadius: `${cardRadius}px`,
          };

    // MINIMAL LOOK: Compact one-row sleek bar with distinct provider emblem
    if (lookStyle === 'minimal') {
      const minimalContent = (
        <div
          className="w-full flex items-center justify-between gap-2.5 text-left transition-all duration-150"
          style={{
            ...cardSurfaceStyle,
            padding: `${Math.round(10 * scale)}px ${Math.round(12 * scale)}px`,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {meta?.avatarUrl && !avatarError ? (
              <img
                src={meta.avatarUrl}
                alt={cardTitle}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="rounded-full object-cover border border-black/10 shrink-0"
                style={{
                  width: `${Math.round(32 * scale)}px`,
                  height: `${Math.round(32 * scale)}px`,
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: `${Math.round(32 * scale)}px`,
                  height: `${Math.round(32 * scale)}px`,
                  backgroundColor: palette.accent,
                  color: palette.accentText,
                }}
              >
                {renderProviderGlyph(Math.round(16 * scale))}
              </div>
            )}
            <div className="min-w-0">
              <div
                className="font-semibold truncate leading-tight"
                style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
              >
                {cardTitle}
              </div>
              <div
                className="truncate leading-tight mt-0.5 flex items-center gap-1"
                style={{
                  fontSize: `${Math.max(10, Math.round(11 * scale))}px`,
                  color: palette.muted,
                  fontFamily: provider === 'github' ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                }}
              >
                <span className="truncate">{cardSubtitle || badgeText}</span>
                {statsLabel && <span className="shrink-0">· {statsLabel}</span>}
              </div>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 font-semibold px-2.5 py-1 shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: palette.accent,
              color: palette.accentText,
              borderRadius: `${controlRadius}px`,
              fontSize: `${Math.max(10, Math.round(11.5 * scale))}px`,
            }}
          >
            <span>{ctaText}</span>
            <ExternalLink size={Math.max(10, Math.round(10 * scale))} />
          </span>
        </div>
      );

      return embedMode === 'placeholder' ? (
        minimalContent
      ) : (
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onLinkClick?.(block)}
          className="block w-full hover:scale-[1.01] transition-transform duration-150"
          aria-label={`${cardTitle} on ${providerLabel}`}
        >
          {minimalContent}
        </a>
      );
    }

    // SPOTLIGHT, SIGNATURE, GLASS, THEME LOOKS (with provider-distinct chrome & accents)
    const isSpotlight = lookStyle === 'spotlight';
    const isGitHubMonospace = provider === 'github';
    const isDiscordOnlineDot = provider === 'discord' && lookStyle !== 'theme';
    const isLinkedInLeftStripe = provider === 'linkedin' && lookStyle === 'signature';

    const richContent = (
      <div
        className="w-full flex flex-col overflow-hidden text-left transition-all duration-150 relative"
        style={{
          ...cardSurfaceStyle,
          borderLeft: isLinkedInLeftStripe ? '4px solid #0A66C2' : cardSurfaceStyle.border,
        }}
      >
        {/* Spotlight Banner Header (bespoke per provider) */}
        {isSpotlight && (
          <div
            className="w-full flex items-center justify-between px-3 py-1.5"
            style={{
              background: palette.bannerGradient,
              color: '#FFFFFF',
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
              {provider === 'github' ? (
                <>
                  <span className="inline-flex items-center gap-1 mr-1" aria-hidden="true">
                    <span className="w-2 h-2 rounded-full bg-red-400/90" />
                    <span className="w-2 h-2 rounded-full bg-amber-300/90" />
                    <span className="w-2 h-2 rounded-full bg-emerald-400/90" />
                  </span>
                  <Terminal size={11} />
                  <span>{badgeText}</span>
                </>
              ) : (
                <>
                  {renderProviderGlyph(12)}
                  <span>{badgeText}</span>
                </>
              )}
            </div>
            {meta?.handle && (
              <span
                className="text-[10px] opacity-90 truncate max-w-[130px]"
                style={{ fontFamily: isGitHubMonospace ? 'ui-monospace, SFMono-Regular, monospace' : undefined }}
              >
                {meta.handle}
              </span>
            )}
          </div>
        )}

        <div
          className="w-full flex flex-col gap-2.5"
          style={{ padding: `${Math.round(13 * scale)}px` }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {meta?.avatarUrl && !avatarError ? (
                  <img
                    src={meta.avatarUrl}
                    alt={cardTitle}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className={`${
                      provider === 'discord' ? 'rounded-[12px]' : 'rounded-full'
                    } object-cover border border-current/20 shrink-0`}
                    style={{
                      width: `${Math.round(40 * scale)}px`,
                      height: `${Math.round(40 * scale)}px`,
                    }}
                  />
                ) : (
                  <div
                    className={`${
                      provider === 'discord' ? 'rounded-[12px]' : 'rounded-full'
                    } flex items-center justify-center shrink-0`}
                    style={{
                      width: `${Math.round(38 * scale)}px`,
                      height: `${Math.round(38 * scale)}px`,
                      backgroundColor: palette.accent,
                      color: palette.accentText,
                    }}
                  >
                    {renderProviderGlyph(Math.round(18 * scale))}
                  </div>
                )}
                {isDiscordOnlineDot && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#23A55A] border-2"
                    style={{ borderColor: palette.bg }}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span
                  className="font-semibold leading-tight truncate"
                  style={{ fontSize: `${Math.max(13, Math.round(14 * scale))}px` }}
                >
                  {cardTitle}
                </span>
                {cardSubtitle && (
                  <span
                    className="truncate leading-tight mt-0.5"
                    style={{
                      fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
                      color: lookStyle === 'theme' ? undefined : palette.muted,
                      opacity: lookStyle === 'theme' ? 0.78 : 1,
                      fontFamily: isGitHubMonospace ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                    }}
                  >
                    {cardSubtitle}
                  </span>
                )}
              </div>
            </div>

            {!isSpotlight && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 font-semibold shrink-0 whitespace-nowrap"
                style={{
                  fontSize: `${Math.max(10, Math.round(11 * scale))}px`,
                  borderRadius: `${controlRadius}px`,
                  backgroundColor: palette.badgeBg,
                  color: palette.badgeText,
                  border: lookStyle === 'theme' ? '1px solid currentColor' : 'none',
                }}
              >
                {renderProviderGlyph(Math.max(10, Math.round(11 * scale)))}
                <span>{badgeText}</span>
              </span>
            )}
          </div>

          {cardDesc && (
            <p
              className={`line-clamp-2 leading-snug ${
                provider === 'x' && lookStyle === 'spotlight'
                  ? 'pl-2.5 border-l-2 border-sky-400/70 italic'
                  : ''
              }`}
              style={{
                fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
                color: lookStyle === 'theme' ? undefined : palette.muted,
                opacity: lookStyle === 'theme' ? 0.85 : 1,
              }}
            >
              {cardDesc}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            {statsLabel ? (
              <span
                className="inline-flex items-center gap-1 font-medium truncate"
                style={{
                  fontSize: `${Math.max(10, Math.round(11 * scale))}px`,
                  color: lookStyle === 'theme' ? undefined : palette.muted,
                  opacity: lookStyle === 'theme' ? 0.85 : 1,
                }}
              >
                {provider === 'github' && <Star size={11} className="text-amber-400 shrink-0" />}
                {provider === 'discord' && (
                  <span className="w-2 h-2 rounded-full bg-[#23A55A] shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{statsLabel}</span>
              </span>
            ) : (
              <span />
            )}

            <span
              className="inline-flex items-center gap-1 font-semibold px-3 py-1 shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: palette.accent,
                color: palette.accentText,
                borderRadius: `${controlRadius}px`,
                fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
              }}
            >
              <span>{ctaText}</span>
              <ExternalLink size={Math.max(10, Math.round(11 * scale))} />
            </span>
          </div>
        </div>
      </div>
    );

    if (embedMode === 'placeholder') {
      return richContent;
    }

    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] transition-transform duration-150"
        aria-label={`${cardTitle} on ${providerLabel}`}
      >
        {richContent}
      </a>
    );
  }

  // ============================================================================
  // 2. PLAYABLE MEDIA PLAYER EMBEDS (YouTube, Spotify, SoundCloud)
  // ============================================================================
  const defaultHeight =
    lookStyle === 'minimal'
      ? Math.round(78 * scale)
      : provider === 'youtube'
        ? Math.round(190 * scale)
        : parsed?.height
          ? Math.round(Math.min(parsed.height, 220) * scale)
          : Math.round(152 * scale);

  const mediaTitle = block.title || meta?.title || parsed?.label || `${providerLabel} player`;
  const mediaSubtitle = meta?.subtitle && !meta.subtitle.startsWith('http')
    ? meta.subtitle
    : parsed?.label || `${providerLabel} media`;
  const ctaPlayText =
    meta?.ctaLabel?.trim() || getDefaultEmbedCtaLabel(provider, parsed?.subtype);
  const externalFallbackUrl = parsed?.canonicalUrl || (block.url ? formatExternalUrl(block.url) : '');

  const mediaCardSurface: React.CSSProperties =
    lookStyle === 'theme'
      ? {
          ...baseSurface,
          fontFamily: fontFamily || vibe.fontFamily,
          borderRadius: `${cardRadius}px`,
        }
      : {
          backgroundColor: palette.bg,
          color: palette.text,
          border: `1px solid ${palette.border}`,
          backdropFilter: lookStyle === 'glass' ? 'blur(14px)' : undefined,
          WebkitBackdropFilter: lookStyle === 'glass' ? 'blur(14px)' : undefined,
          fontFamily: fontFamily || vibe.fontFamily,
          borderRadius: `${cardRadius}px`,
        };

  // Live active iframe player once user clicks Play / Load
  if (embedMode === 'live' && isActivePlayer && parsed) {
    const activeSrc = buildAutoplayEmbedUrl(parsed.embedSrc, parsed.provider);
    return (
      <div className="w-full flex flex-col gap-1.5">
        <div
          className="w-full overflow-hidden transition-all duration-150 bg-black/5"
          style={{
            borderRadius: `${cardRadius}px`,
            height: parsed.height ? `${parsed.height}px` : undefined,
            aspectRatio: parsed.aspect || undefined,
          }}
        >
          <iframe
            src={activeSrc}
            title={block.title || parsed.label}
            loading="eager"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0 block"
            style={{ borderRadius: `${cardRadius}px` }}
          />
        </div>
        {externalFallbackUrl && (
          <a
            href={externalFallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-end inline-flex items-center gap-1 text-[11px] font-medium opacity-65 hover:opacity-100 transition-opacity px-1"
            style={{ color: tokens.muted }}
          >
            <span>Open on {providerLabel}</span>
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    );
  }

  // Minimal bar facade for playable media (works cleanly in placeholder + live)
  if (lookStyle === 'minimal') {
    const minimalMediaInner = (
      <div
        className="w-full flex items-center justify-between gap-2.5 text-left transition-all duration-150"
        style={{
          ...mediaCardSurface,
          padding: `${Math.round(10 * scale)}px ${Math.round(12 * scale)}px`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: `${Math.round(34 * scale)}px`,
              height: `${Math.round(34 * scale)}px`,
              backgroundColor: palette.accent,
              color: palette.accentText,
            }}
          >
            {renderProviderGlyph(Math.round(16 * scale))}
          </div>
          <div className="min-w-0">
            <div
              className="font-semibold truncate leading-tight"
              style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
            >
              {mediaTitle}
            </div>
            <div
              className="truncate leading-tight mt-0.5"
              style={{
                fontSize: `${Math.max(10, Math.round(11 * scale))}px`,
                color: palette.muted,
              }}
            >
              {mediaSubtitle}
            </div>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1 font-semibold px-3 py-1.5 shrink-0 whitespace-nowrap"
          style={{
            backgroundColor: palette.accent,
            color: palette.accentText,
            borderRadius: `${controlRadius}px`,
            fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
          }}
        >
          <Play size={12} fill="currentColor" />
          <span>{ctaPlayText}</span>
        </span>
      </div>
    );

    if (embedMode === 'placeholder') {
      return minimalMediaInner;
    }

    if (!parsed && externalFallbackUrl) {
      return (
        <a
          href={externalFallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onLinkClick?.(block)}
          className="block w-full hover:scale-[1.01] transition-transform"
        >
          {minimalMediaInner}
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          onActivate(block.id);
          onLinkClick?.(block);
        }}
        className="w-full cursor-pointer hover:scale-[1.01] transition-transform"
      >
        {minimalMediaInner}
      </button>
    );
  }

  // Rich Media Facade (placeholder OR live before user presses play)
  const renderMediaArtworkHeader = () => {
    if (lookStyle === 'spotlight' && meta?.avatarUrl && !avatarError) {
      return (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
          style={{ backgroundImage: `url(${meta.avatarUrl})` }}
          aria-hidden="true"
        />
      );
    }
    if (provider === 'soundcloud' && lookStyle !== 'theme') {
      const bars = [12, 22, 16, 28, 19, 25, 14, 24, 30, 17, 22, 13, 26, 18];
      return (
        <div className="flex items-end justify-center gap-1 h-7 mb-2 opacity-85" aria-hidden="true">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full"
              style={{
                height: `${Math.round(h * scale)}px`,
                backgroundColor: i < 7 ? palette.accent : 'rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </div>
      );
    }
    if (provider === 'spotify' && lookStyle === 'spotlight') {
      return (
        <div className="flex items-end justify-center gap-1 h-5 mb-2" aria-hidden="true">
          {[10, 18, 14, 20, 12].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full"
              style={{
                height: `${Math.round(h * scale)}px`,
                backgroundColor: palette.accent,
              }}
            />
          ))}
        </div>
      );
    }
    return null;
  };

  if (embedMode === 'placeholder') {
    return (
      <div
        className="w-full relative flex flex-col items-center justify-center overflow-hidden transition-all duration-150 p-4 text-center"
        style={{
          minHeight: `${defaultHeight}px`,
          ...mediaCardSurface,
        }}
      >
        {renderMediaArtworkHeader()}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shrink-0 shadow-sm"
            style={{
              backgroundColor: palette.accent,
              color: palette.accentText,
            }}
          >
            {renderProviderGlyph(19)}
          </div>
          <span className="text-[13px] font-semibold leading-tight max-w-[92%] truncate">
            {mediaTitle}
          </span>
          <span
            className="text-[11px] mt-1 max-w-[90%] truncate"
            style={{ color: lookStyle === 'theme' ? undefined : palette.muted, opacity: lookStyle === 'theme' ? 0.78 : 1 }}
          >
            {mediaSubtitle}
          </span>
          <span
            className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: palette.accent,
              color: palette.accentText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            <Play size={10} fill="currentColor" />
            <span>{ctaPlayText}</span>
          </span>
        </div>
      </div>
    );
  }

  // Fallback card if a saved media embed URL could not be parsed cleanly into an iframe
  if (!parsed && externalFallbackUrl) {
    return (
      <a
        href={externalFallbackUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="w-full overflow-hidden relative flex flex-col items-center justify-center p-6 text-center transition-all duration-150 hover:scale-[1.01]"
        style={{
          minHeight: `${defaultHeight}px`,
          ...mediaCardSurface,
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-3 shrink-0"
          style={{
            backgroundColor: palette.accent,
            color: palette.accentText,
          }}
        >
          {renderProviderGlyph(22)}
        </div>
        {mediaTitle && (
          <h4 className="text-[15px] font-semibold mb-1 max-w-[85%] truncate">
            {mediaTitle}
          </h4>
        )}
        <span
          className="h-9 px-5 font-semibold text-[13px] inline-flex items-center gap-1.5 mt-2 whitespace-nowrap"
          style={{
            backgroundColor: palette.accent,
            color: palette.accentText,
            borderRadius: `${controlRadius}px`,
          }}
        >
          <span>Open on {providerLabel}</span>
          <ExternalLink size={13} />
        </span>
      </a>
    );
  }

  const accessibleName =
    provider === 'youtube'
      ? `Play YouTube video ${block.title || ''}`.trim()
      : provider === 'spotify'
        ? `Load Spotify player ${block.title || ''}`.trim()
        : `Load SoundCloud player ${block.title || ''}`.trim();

  return (
    <div
      className="w-full overflow-hidden relative flex flex-col items-center justify-center p-6 text-center transition-all duration-150"
      style={{
        minHeight: `${defaultHeight}px`,
        aspectRatio: parsed?.aspect || undefined,
        ...mediaCardSurface,
      }}
    >
      {renderMediaArtworkHeader()}
      <div className="relative z-10 flex flex-col items-center w-full">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-3 shrink-0 shadow-md"
          style={{
            backgroundColor: palette.accent,
            color: palette.accentText,
          }}
        >
          {renderProviderGlyph(22)}
        </div>

        {mediaTitle && (
          <h4 className="text-[15px] font-semibold mb-1 max-w-[85%] truncate">
            {mediaTitle}
          </h4>
        )}

        <p
          className="text-[13px] font-medium mb-4"
          style={{ color: lookStyle === 'theme' ? undefined : palette.muted, opacity: lookStyle === 'theme' ? 0.85 : 1 }}
        >
          {mediaSubtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            aria-label={accessibleName}
            onClick={() => {
              onActivate(block.id);
              onLinkClick?.(block);
            }}
            className="h-10 px-6 font-semibold text-[14px] inline-flex items-center justify-center gap-2 transition-transform duration-120 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: palette.accent,
              color: palette.accentText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            <Play size={15} fill="currentColor" />
            <span>{ctaPlayText}</span>
          </button>

          {externalFallbackUrl && (
            <a
              href={externalFallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${block.title || providerLabel} in ${providerLabel}`}
              title={`Open on ${providerLabel}`}
              className="h-10 w-10 inline-flex items-center justify-center border border-current/25 opacity-80 hover:opacity-100 transition-opacity shrink-0"
              style={{
                borderRadius: `${controlRadius}px`,
                color: mediaCardSurface.color || tokens.text,
              }}
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>

        <p
          className="mt-3 text-[12px]"
          style={{ color: lookStyle === 'theme' ? undefined : palette.muted, opacity: lookStyle === 'theme' ? 0.75 : 1 }}
        >
          Content loads from {providerLabel} when you press play.
        </p>
      </div>
    </div>
  );
};

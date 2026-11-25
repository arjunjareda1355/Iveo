import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Music,
  Headphones,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  Instagram,
} from 'lucide-react';
import { CardLookStyle, EmbedProvider, PageBlock, BackgroundConfig } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { parseEmbedUrl, detectProviderUrl } from '../../lib/embeds';
import { formatExternalUrl } from '../../lib/urls';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';
import { normalizeEmbedLookStyle } from '../../lib/embedLooks';
import { BannerLookCard } from './BannerLookCard';
import {
  getProviderDefinition,
  getProviderKindDefinition,
} from '../../lib/providers/definitions';
import {
  darkenHex,
  ensureContrastText,
  ensureUiAccentContrast,
  hexWithAlpha,
  normalizeHexColor,
  resolveCssColorToHex,
  resolveGlassSurfaceConfig,
} from '../../lib/colors';
import {
  BlueskySocialIcon,
  DiscordIcon,
  FacebookSocialIcon,
  LinktreeSocialIcon,
  PinterestSocialIcon,
  SnapchatIcon,
  ThreadsSocialIcon,
  TwitchIcon,
  XIcon,
} from '../phone/SocialIcons';

export interface EmbedBlockProps {
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
  pageCardLook?: CardLookStyle;
  background?: BackgroundConfig | null;
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
}

export const DiscordGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <DiscordIcon size={size} />
);
export const XMarkGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <XIcon size={size} />
);
export const FacebookGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <FacebookSocialIcon size={size} />
);
export const ThreadsGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <ThreadsSocialIcon size={size} />
);
export const PinterestGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <PinterestSocialIcon size={size} />
);
export const TwitchGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <TwitchIcon size={size} />
);
export const SnapchatGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <SnapchatIcon size={size} />
);

/**
 * Deduplicated official Pinterest pinit.js loader (PV-9 & PV-10):
 * Loads at most once per page, never on initial first paint unless visible/activated.
 */
let pinitLoadPromise: Promise<void> | null = null;
function ensurePinterestScriptLoaded(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  const win = window as unknown as { PinUtils?: { build?: (el?: HTMLElement) => void } };
  if (win.PinUtils?.build) {
    return Promise.resolve();
  }
  if (pinitLoadPromise) return pinitLoadPromise;

  pinitLoadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="assets.pinterest.com/js/pinit.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://assets.pinterest.com/js/pinit.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
  return pinitLoadPromise;
}

export const ProviderGlyph: React.FC<{ provider: string; size?: number }> = ({
  provider,
  size = 16,
}) => {
  switch (provider) {
    case 'youtube':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"
            fill="currentColor"
          />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#FFFFFF" />
        </svg>
      );
    case 'spotify':
      return <Music size={size} strokeWidth={1.8} />;
    case 'soundcloud':
      return <Headphones size={size} strokeWidth={1.8} />;
    case 'discord':
      return <DiscordIcon size={size} />;
    case 'github':
      return <Github size={size} strokeWidth={1.8} />;
    case 'linkedin':
      return <Linkedin size={size} strokeWidth={1.8} />;
    case 'x':
      return <XIcon size={Math.max(12, size - 2)} />;
    case 'instagram':
      return <Instagram size={size} strokeWidth={1.8} />;
    case 'facebook':
      return <FacebookSocialIcon size={Math.max(12, size - 1)} />;
    case 'threads':
      return <ThreadsSocialIcon size={Math.max(12, size - 1)} />;
    case 'pinterest':
      return <PinterestSocialIcon size={Math.max(12, size - 1)} />;
    case 'linktree':
      return <LinktreeSocialIcon size={Math.max(12, size - 1)} />;
    case 'bluesky':
      return <BlueskySocialIcon size={Math.max(12, size - 1)} />;
    case 'twitch':
      return <TwitchIcon size={Math.max(12, size - 1)} />;
    case 'snapchat':
      return <SnapchatIcon size={Math.max(12, size - 1)} />;
    default:
      return <Globe size={size} strokeWidth={1.7} />;
  }
};

/**
 * Official Spotify logo lock-up complying with Spotify Design & Branding Guidelines (PV-8):
 * - Green (#1DB954) only on pure black/near-black or pure white backgrounds; monochrome otherwise.
 * - Full logo >= 70px wide, or standalone icon >= 21px when compact.
 */
const SpotifyBrandLogo: React.FC<{
  compact?: boolean;
  surfaceHex: string;
  textColor: string;
}> = ({ compact = false, surfaceHex, textColor }) => {
  const normBg = surfaceHex.toUpperCase();
  const isNeutralBw =
    normBg === '#FFFFFF' || normBg === '#FAFAFA' || normBg === '#0A0A0A' || normBg === '#121212' || normBg === '#000000';
  const fill = isNeutralBw ? '#1DB954' : textColor;

  if (compact) {
    return (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill={fill}
        aria-label="Spotify"
        role="img"
        className="shrink-0"
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" style={{ minWidth: '72px' }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={fill} aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
      <span
        className="font-semibold tracking-tight leading-none"
        style={{ fontSize: '13px', color: textColor }}
      >
        Spotify
      </span>
    </span>
  );
};

function sanitizePublicOwnerCopy(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^connected\s+(via\s+oauth|.*profile)/i.test(trimmed)) return null;
  if (/\boauth\b/i.test(trimmed)) return null;
  return trimmed;
}

function buildAutoplayEmbedUrl(embedSrc: string, provider: string): string {
  if (provider === 'youtube') {
    let next = embedSrc.includes('?') ? `${embedSrc}&autoplay=1` : `${embedSrc}?autoplay=1`;
    if (typeof window !== 'undefined' && window.location?.origin) {
      next += `&origin=${encodeURIComponent(window.location.origin)}`;
    }
    return next;
  }
  if (provider === 'twitch') {
    try {
      const u = new URL(embedSrc);
      u.searchParams.set('autoplay', 'true');
      if (typeof window !== 'undefined' && window.location?.hostname) {
        u.searchParams.delete('parent');
        u.searchParams.append('parent', window.location.hostname);
        if (typeof document !== 'undefined' && document.referrer) {
          try {
            const refHost = new URL(document.referrer).hostname;
            if (refHost && refHost !== window.location.hostname) {
              u.searchParams.append('parent', refHost);
            }
          } catch {
            // ignore
          }
        }
      }
      return u.toString();
    } catch {
      return embedSrc;
    }
  }
  if (provider === 'soundcloud') {
    return embedSrc.replace('auto_play=false', 'auto_play=true');
  }
  return embedSrc;
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
  pageCardLook = 'match_page',
  background,
  userAvatarUrl,
  userDisplayName,
}) => {
  const { tokens } = vibe;
  const meta = block.embedMeta;
  const strictParsed = parseEmbedUrl(block.url || '');
  const smartDetected = detectProviderUrl(block.url || '');

  const provider: EmbedProvider =
    (meta?.provider as EmbedProvider) ||
    strictParsed?.provider ||
    smartDetected?.provider ||
    block.embedProvider ||
    'generic';

  const subtype = meta?.subtype || strictParsed?.subtype || smartDetected?.subtype || null;
  const providerDef = getProviderDefinition(provider);
  const kindDef = getProviderKindDefinition(provider, subtype);

  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const pinterestContainerRef = useRef<HTMLDivElement | null>(null);

  const effectivePictureUrl =
    meta?.override?.imageUrl?.trim() ||
    (kindDef.contentKind === 'item' ? meta?.coverUrl || meta?.avatarUrl : meta?.avatarUrl || meta?.coverUrl) ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [effectivePictureUrl]);

  useEffect(() => {
    setCoverError(false);
  }, [meta?.coverUrl, meta?.override?.imageUrl]);

  //Corners override (LK-11)
  const resolvedBaseCornerPx =
    meta?.corners === 'sharp'
      ? 6
      : meta?.corners === 'rounded'
        ? 16
        : meta?.corners === 'pill'
          ? 28
          : effectiveRadius;
  const cardRadius = resolveCardBorderRadius(resolvedBaseCornerPx, scale, 'card');
  const controlRadius = resolveButtonControlRadius(resolvedBaseCornerPx, scale);

  // Look resolution order: block override -> page default -> Match page (LK-9)
  const look: CardLookStyle = meta?.lookStyle
    ? normalizeEmbedLookStyle(meta.lookStyle, pageCardLook)
    : normalizeEmbedLookStyle(pageCardLook, 'match_page');

  // Display mode resolution: Player vs Card (ED-6)
  const requestedDisplayAs = meta?.displayAs || (kindDef.capabilities.player ? providerDef.defaultDisplayMode : 'card');
  const displayAs: 'card' | 'player' =
    requestedDisplayAs === 'player' && kindDef.capabilities.player ? 'player' : 'card';
  const playerSize = meta?.playerSize || providerDef.defaultPlayerSize || 'standard';

  // Surface & color tokens with contrast guards (LK-4..LK-7, LK-10)
  const pageBgHex = resolveCssColorToHex(tokens.bg, '#FFFFFF');
  const vibeSurfaceCss =
    surfaceStyle?.backgroundColor && surfaceStyle.backgroundColor !== 'transparent'
      ? String(surfaceStyle.backgroundColor)
      : tokens.buttonBg === 'transparent'
        ? tokens.bg
        : tokens.buttonBg;
  const vibeSurfaceHex = resolveCssColorToHex(vibeSurfaceCss, pageBgHex);
  const cardTextOnSurface = ensureContrastText(
    surfaceStyle?.color ? String(surfaceStyle.color) : tokens.text,
    vibeSurfaceHex,
    4.5,
    pageBgHex
  );
  const cardMutedOnSurface =
    cardTextOnSurface === '#FFFFFF' ? 'rgba(248, 250, 252, 0.76)' : 'rgba(10, 10, 10, 0.68)';

  // Accent computation (LK-10): Brand | Page | Custom
  const accentMode = meta?.accentMode || (look === 'match_page' ? 'page' : 'brand');
  const rawPageAccentHex = resolveCssColorToHex(
    tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg,
    pageBgHex
  );
  const rawChosenAccent =
    accentMode === 'custom'
      ? normalizeHexColor(meta?.accentColor) || providerDef.brandColor
      : accentMode === 'page'
        ? rawPageAccentHex
        : providerDef.brandColor;

  // Guarded UI accent (>=3:1 against card surface, otherwise page text)
  const guardedAccent = ensureUiAccentContrast(
    rawChosenAccent,
    vibeSurfaceHex,
    cardTextOnSurface,
    3.0,
    pageBgHex
  );
  const buttonFillColor =
    look === 'match_page' ? rawPageAccentHex : normalizeHexColor(rawChosenAccent) || providerDef.brandColor;
  const buttonFillText = ensureContrastText(
    accentMode === 'brand' && rawChosenAccent === providerDef.brandColor ? providerDef.brandTextOnFill : null,
    buttonFillColor,
    4.5,
    vibeSurfaceHex
  );

  // Content fields respecting overrides & capabilities (ED-13, PV-8, AK-5)
  const canonicalUrl =
    strictParsed?.canonicalUrl ||
    smartDetected?.canonicalUrl ||
    (block.url ? formatExternalUrl(block.url) : '#');

  const rawTitle =
    meta?.override?.title?.trim() ||
    meta?.title?.trim() ||
    block.title?.trim() ||
    kindDef.label;

  const rawSubtitle =
    meta?.override?.subtitle?.trim() ||
    meta?.handle?.trim() ||
    sanitizePublicOwnerCopy(meta?.subtitle) ||
    (canonicalUrl !== '#' ? canonicalUrl.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') : '');

  const rawSummary =
    meta?.showDescription !== false
      ? sanitizePublicOwnerCopy(meta?.override?.description?.trim() || meta?.description)
      : null;

  // Spotify has no stats per 2026 API (PV-8)
  const statsLabel =
    kindDef.capabilities.stats && meta?.showStats !== false
      ? sanitizePublicOwnerCopy(meta?.statsLabel)
      : null;
  const firstStat =
    meta?.stats && meta.stats.length > 0
      ? `${meta.stats[0].value} ${meta.stats[0].key}`.trim()
      : statsLabel?.split(/[·•]/)[0]?.trim() || null;

  const ctaText =
    meta?.ctaLabel?.trim() ||
    kindDef.defaultButtonText ||
    'Open';

  const defaultButtonStyleForLook =
    look === 'match_page' ? 'text' : look === 'glass' ? 'outline' : 'filled';
  const effectiveButtonStyle = meta?.buttonStyle || defaultButtonStyleForLook;

  const showPicture = meta?.showAvatar !== false;
  const showPlatformLabel = meta?.showPlatformLabel !== false;
  const isSpotify = provider === 'spotify';
  const isItemArtwork = kindDef.contentKind === 'item';

  // ==========================================================================
  // RENDER PLAYER MODE (Lazy & click-to-load for YouTube/Spotify/SoundCloud/Meta/X/Pinterest)
  // ==========================================================================
  const isActivePlayer = activeEmbedId === block.id;

  // Official Pinterest Widget renderer (PV-9 & PV-10: script loaded once & on view/click)
  useEffect(() => {
    if (
      embedMode === 'live' &&
      displayAs === 'player' &&
      provider === 'pinterest' &&
      (isActivePlayer || playerSize !== 'compact')
    ) {
      const el = pinterestContainerRef.current;
      if (!el || typeof IntersectionObserver === 'undefined') return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            obs.disconnect();
            void ensurePinterestScriptLoaded().then(() => {
              const win = window as unknown as { PinUtils?: { build?: (node?: HTMLElement) => void } };
              win.PinUtils?.build?.(el);
            });
          }
        },
        { rootMargin: '120px' }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }
  }, [embedMode, displayAs, provider, isActivePlayer, playerSize]);

  if (displayAs === 'player') {
    const embedSrc = strictParsed?.embedSrc || smartDetected?.embedSrc || null;
    const basePlayerHeight =
      provider === 'spotify'
        ? playerSize === 'compact'
          ? 152
          : 352
        : provider === 'soundcloud'
          ? playerSize === 'compact'
            ? 166
            : 300
          : provider === 'pinterest'
            ? playerSize === 'compact'
              ? 220
              : playerSize === 'large'
                ? 440
                : 320
            : undefined;

    const scaledHeight = basePlayerHeight ? Math.round(basePlayerHeight * scale) : undefined;
    const aspectRatio =
      provider === 'youtube' || provider === 'twitch'
        ? '16 / 9'
        : strictParsed?.aspect || (smartDetected?.aspect === '16/9' ? '16 / 9' : undefined);

    // 1. Live active iframe for YouTube / Spotify / SoundCloud / Instagram / Facebook / Threads
    if (embedMode === 'live' && isActivePlayer && embedSrc && provider !== 'pinterest' && provider !== 'x') {
      const activeSrc = buildAutoplayEmbedUrl(embedSrc, provider);
      return (
        <div className="w-full flex flex-col gap-1.5" style={{ fontFamily: fontFamily || vibe.fontFamily }}>
          <div
            className="w-full overflow-hidden bg-black/5 border"
            style={{
              borderRadius: `${cardRadius}px`,
              borderColor: tokens.buttonBorder || 'rgba(128,128,128,0.2)',
              height: scaledHeight ? `${scaledHeight}px` : undefined,
              aspectRatio: !scaledHeight ? aspectRatio : undefined,
            }}
          >
            <iframe
              src={activeSrc}
              title={isSpotify ? `${rawTitle} on Spotify` : rawTitle}
              loading="lazy"
              allow={
                isSpotify
                  ? 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
                  : 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share'
              }
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0 block"
              style={{ borderRadius: `${cardRadius}px` }}
            />
          </div>
          {canonicalUrl !== '#' && (
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-end inline-flex items-center gap-1 text-[12px] font-medium hover:underline px-1"
              style={{ color: tokens.muted }}
            >
              <span>{isSpotify ? 'Listen on Spotify' : `Open on ${providerDef.name}`}</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      );
    }

    // 2. Live Pinterest Widget when activated
    if (embedMode === 'live' && provider === 'pinterest' && isActivePlayer) {
      const pinDo =
        subtype === 'board' ? 'embedBoard' : subtype === 'profile' ? 'embedUser' : 'embedPin';
      return (
        <div
          ref={pinterestContainerRef}
          className="w-full overflow-hidden flex flex-col items-center justify-center p-3 border bg-white"
          style={{
            borderRadius: `${cardRadius}px`,
            borderColor: tokens.buttonBorder || '#E5E7EB',
            minHeight: scaledHeight ? `${scaledHeight}px` : '240px',
          }}
        >
          <a
            data-pin-do={pinDo}
            data-pin-width={playerSize === 'large' ? 'large' : playerSize === 'compact' ? 'medium' : 'medium'}
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-[#0A0A0A] underline"
          >
            {rawTitle} on Pinterest
          </a>
        </div>
      );
    }

    // 3. Click-to-load Facade (zero third-party script or iframe on first paint per PV-10!)
    const facadeSurfaceBg = vibeSurfaceHex;
    const facadeText = cardTextOnSurface;
    const facadeMuted = cardMutedOnSurface;
    const facadeBtnBg = look === 'match_page' ? buttonFillColor : providerDef.brandColor;
    const facadeBtnText = ensureContrastText(
      providerDef.brandTextOnFill,
      facadeBtnBg,
      4.5,
      facadeSurfaceBg
    );

    const facadeInner = (
      <div
        className="w-full overflow-hidden transition-all duration-150 flex flex-col justify-between text-left"
        style={{
          backgroundColor: vibeSurfaceCss,
          ...(look === 'match_page' && surfaceStyle?.backgroundImage
            ? { backgroundImage: surfaceStyle.backgroundImage }
            : {}),
          color: facadeText,
          border:
            look === 'match_page' && surfaceStyle?.border
              ? surfaceStyle.border
              : `1px solid ${tokens.buttonBorder || hexWithAlpha(facadeText, 0.16)}`,
          ...(look === 'match_page' && surfaceStyle?.boxShadow
            ? { boxShadow: surfaceStyle.boxShadow }
            : {}),
          ...(look === 'match_page' && surfaceStyle?.backdropFilter
            ? {
                backdropFilter: surfaceStyle.backdropFilter,
                WebkitBackdropFilter: surfaceStyle.WebkitBackdropFilter || surfaceStyle.backdropFilter,
              }
            : {}),
          borderRadius: `${cardRadius}px`,
          fontFamily: fontFamily || vibe.fontFamily,
          minHeight: `${Math.round((playerSize === 'compact' ? 88 : 168) * scale)}px`,
          padding: `${Math.round(16 * scale)}px`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {showPicture && effectivePictureUrl && !avatarError ? (
              <img
                src={effectivePictureUrl}
                alt={rawTitle}
                width={isSpotify ? 64 : 56}
                height={isSpotify ? 64 : 56}
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setAvatarError(true)}
                className="object-cover shrink-0 bg-black/5"
                style={{
                  width: `${Math.round((isSpotify ? 64 : 56) * scale)}px`,
                  height: `${Math.round((isSpotify ? 64 : 56) * scale)}px`,
                  borderRadius: isSpotify ? '8px' : '8px',
                }}
              />
            ) : (
              <div
                className="shrink-0 flex items-center justify-center rounded-[8px]"
                style={{
                  width: `${Math.round(56 * scale)}px`,
                  height: `${Math.round(56 * scale)}px`,
                  backgroundColor: hexWithAlpha(guardedAccent, 0.12),
                  color: guardedAccent,
                }}
              >
                <ProviderGlyph provider={provider} size={Math.round(22 * scale)} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div
                dir="auto"
                title={rawTitle}
                className="font-semibold leading-[22px] line-clamp-2 break-words"
                style={{ fontSize: `${Math.max(14, Math.round(16 * scale))}px`, color: facadeText }}
              >
                {rawTitle}
              </div>
              {rawSubtitle && (
                <div
                  dir="auto"
                  className="truncate leading-[20px] mt-0.5"
                  style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px`, color: facadeMuted }}
                >
                  {rawSubtitle}
                </div>
              )}
            </div>
          </div>

          {isSpotify ? (
            <SpotifyBrandLogo compact surfaceHex={facadeSurfaceBg} textColor={facadeText} />
          ) : (
            showPlatformLabel && (
              <span style={{ color: guardedAccent }} aria-label={providerDef.name}>
                <ProviderGlyph provider={provider} size={Math.round(16 * scale)} />
              </span>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 mt-auto">
          {isSpotify ? (
            <SpotifyBrandLogo surfaceHex={facadeSurfaceBg} textColor={facadeText} />
          ) : (
            <span className="text-[12px] truncate" style={{ color: facadeMuted }}>
              {providerDef.name} player
            </span>
          )}

          <span
            className="inline-flex items-center justify-center gap-1.5 font-semibold shrink-0 whitespace-nowrap"
            style={{
              height: `${Math.round(36 * scale)}px`,
              paddingInline: `${Math.round(14 * scale)}px`,
              backgroundColor: facadeBtnBg,
              color: facadeBtnText,
              borderRadius: `${controlRadius}px`,
              fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
            }}
          >
            <Play size={12} fill="currentColor" />
            <span>{isSpotify ? 'Listen on Spotify' : ctaText}</span>
          </span>
        </div>
      </div>
    );

    if (embedMode === 'placeholder') return facadeInner;

    // X post in live mode opens target on click unless we render interactive tweet load
    if (provider === 'x' || (!embedSrc && provider !== 'pinterest')) {
      return (
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onLinkClick?.(block)}
          className="block w-full hover:scale-[1.01] transition-transform duration-150"
          aria-label={`${rawTitle} on ${providerDef.name}`}
        >
          {facadeInner}
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
        className="block w-full text-left cursor-pointer hover:scale-[1.01] transition-transform duration-150"
        aria-label={`Play ${rawTitle} on ${providerDef.name}`}
      >
        {facadeInner}
      </button>
    );
  }

  // ==========================================================================
  // RENDER CARD MODE — 5 UNIFIED LOOKS (LK-1..LK-12)
  // ==========================================================================

  // Surface styles per look
  const glassCfg = look === 'glass' ? resolveGlassSurfaceConfig(tokens, guardedAccent, background) : null;

  const resolvedCardBg =
    look === 'glass' && glassCfg
      ? glassCfg.backgroundCss
      : vibeSurfaceCss;
  const resolvedSurfaceHex =
    look === 'glass' && glassCfg
      ? resolveCssColorToHex(glassCfg.backgroundCss, pageBgHex)
      : vibeSurfaceHex;

  const textPrimary =
    look === 'glass' && glassCfg
      ? glassCfg.textColor
      : ensureContrastText(cardTextOnSurface, resolvedSurfaceHex, 4.5, pageBgHex);
  const textMuted =
    look === 'glass' && glassCfg
      ? glassCfg.mutedColor
      : textPrimary === '#FFFFFF'
        ? 'rgba(248, 250, 252, 0.76)'
        : 'rgba(10, 10, 10, 0.68)';

  // 3:1 Border contrast check for Brand / Match page / Banner
  const defaultBorderHex =
    tokens.buttonBorder && tokens.buttonBorder !== 'transparent'
      ? resolveCssColorToHex(tokens.buttonBorder, pageBgHex)
      : hexWithAlpha(textPrimary, 0.16);
  const brandTintedBorder = hexWithAlpha(
    ensureUiAccentContrast(rawChosenAccent, pageBgHex, textPrimary, 2.2, pageBgHex),
    0.34
  );

  const cardContainerStyle: React.CSSProperties = {
    backgroundColor: resolvedCardBg,
    ...(look === 'match_page' && surfaceStyle?.backgroundImage
      ? { backgroundImage: surfaceStyle.backgroundImage }
      : {}),
    color: textPrimary,
    border:
      look === 'match_page' && surfaceStyle?.border
        ? surfaceStyle.border
        : `1px solid ${
            look === 'brand'
              ? brandTintedBorder
              : look === 'glass' && glassCfg
                ? glassCfg.borderColor
                : defaultBorderHex
          }`,
    ...(look === 'match_page' && surfaceStyle?.boxShadow
      ? { boxShadow: surfaceStyle.boxShadow }
      : {}),
    borderRadius: `${cardRadius}px`,
    fontFamily: fontFamily || vibe.fontFamily,
    backdropFilter:
      look === 'glass'
        ? 'blur(16px)'
        : look === 'match_page' && surfaceStyle?.backdropFilter
          ? surfaceStyle.backdropFilter
          : undefined,
    WebkitBackdropFilter:
      look === 'glass'
        ? 'blur(16px)'
        : look === 'match_page' && surfaceStyle?.WebkitBackdropFilter
          ? surfaceStyle.WebkitBackdropFilter
          : undefined,
    minHeight: `${Math.round(64 * scale)}px`,
  };

  // Icon & CTA rendering helpers
  const glyphColor =
    look === 'match_page'
      ? textPrimary
      : ensureUiAccentContrast(rawChosenAccent, resolvedSurfaceHex, textPrimary, 3.0, pageBgHex);

  const renderCtaButton = (isCompactBtn = false) => {
    if (effectiveButtonStyle === 'hidden') return null;

    const btnHeight = Math.round((isCompactBtn ? 32 : 36) * scale);

    if (effectiveButtonStyle === 'text') {
      return (
        <span
          className="inline-flex items-center gap-1.5 font-semibold shrink-0 whitespace-nowrap"
          style={{
            color: textPrimary,
            fontSize: `${Math.max(12, Math.round(14 * scale))}px`,
            lineHeight: '20px',
          }}
        >
          {!isCompactBtn && <span>{ctaText}</span>}
          {isCompactBtn && <span className="hidden min-[340px]:inline">{ctaText}</span>}
          <ExternalLink size={Math.max(12, Math.round(14 * scale))} />
        </span>
      );
    }

    if (effectiveButtonStyle === 'outline') {
      const outlineBorder = ensureUiAccentContrast(
        buttonFillColor,
        resolvedSurfaceHex,
        textPrimary,
        3.0,
        pageBgHex
      );
      return (
        <span
          className="inline-flex items-center justify-center gap-1.5 font-semibold shrink-0 whitespace-nowrap border"
          style={{
            height: `${btnHeight}px`,
            paddingInline: `${Math.round((isCompactBtn ? 10 : 14) * scale)}px`,
            borderRadius: `${controlRadius}px`,
            borderColor: outlineBorder,
            color: outlineBorder,
            fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
          }}
        >
          {isCompactBtn ? (
            <>
              <span className="hidden min-[340px]:inline">{ctaText}</span>
              <ExternalLink size={12} />
            </>
          ) : (
            <>
              <span>{ctaText}</span>
              <ExternalLink size={12} />
            </>
          )}
        </span>
      );
    }

    // Filled button
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 font-semibold shrink-0 whitespace-nowrap"
        style={{
          height: `${btnHeight}px`,
          paddingInline: `${Math.round((isCompactBtn ? 10 : 14) * scale)}px`,
          borderRadius: `${controlRadius}px`,
          backgroundColor: buttonFillColor,
          color: buttonFillText,
          fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
        }}
      >
        {isCompactBtn ? (
          <>
            <span className="hidden min-[340px]:inline">{ctaText}</span>
            <ExternalLink size={12} />
          </>
        ) : (
          <>
            <span>{ctaText}</span>
            <ExternalLink size={12} />
          </>
        )}
      </span>
    );
  };

  // Picture slot renderer (LK-3 & PV-8)
  const renderPicture = (sizePx: number, extraRingColor?: string) => {
    if (!showPicture) return null;
    const isSquareItem = isSpotify || isItemArtwork;
    const radiusCss = isSpotify
      ? `${sizePx >= 60 ? 8 : 4}px`
      : isSquareItem
        ? '8px'
        : '9999px';

    if (effectivePictureUrl && !avatarError) {
      return (
        <img
          src={effectivePictureUrl}
          alt={rawTitle}
          width={sizePx}
          height={sizePx}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setAvatarError(true)}
          className="object-cover shrink-0 block"
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            borderRadius: radiusCss,
            border: extraRingColor ? `3px solid ${extraRingColor}` : undefined,
            backgroundColor: isSpotify ? resolvedSurfaceHex : undefined,
          }}
        />
      );
    }

    return (
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          borderRadius: radiusCss,
          border: extraRingColor ? `3px solid ${extraRingColor}` : undefined,
          backgroundColor: look === 'match_page' ? hexWithAlpha(textPrimary, 0.08) : hexWithAlpha(glyphColor, 0.14),
          color: look === 'match_page' ? textPrimary : glyphColor,
        }}
      >
        <ProviderGlyph provider={provider} size={Math.round(sizePx * 0.45)} />
      </div>
    );
  };

  // ---------- LOOK 5: COMPACT (LK-8) ----------
  if (look === 'compact') {
    const picSize = Math.round((isItemArtwork ? 48 : 40) * scale);
    const compactSubtitle = firstStat && rawSubtitle
      ? `${rawSubtitle} · ${firstStat}`
      : firstStat || rawSubtitle;

    const compactEl = (
      <div
        className="w-full flex items-center justify-between gap-3 text-left transition-all duration-150"
        style={{
          ...cardContainerStyle,
          padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {renderPicture(picSize)}
          <div className="min-w-0 flex-1">
            <div
              dir="auto"
              title={rawTitle}
              className="font-semibold truncate leading-[22px]"
              style={{ fontSize: `${Math.max(14, Math.round(16 * scale))}px`, color: textPrimary }}
            >
              {rawTitle}
            </div>
            {(compactSubtitle || rawSummary) && (
              <div
                dir="auto"
                className="truncate leading-[20px]"
                style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px`, color: textMuted }}
              >
                {rawSummary || compactSubtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSpotify && <SpotifyBrandLogo compact surfaceHex={resolvedSurfaceHex} textColor={textPrimary} />}
          {renderCtaButton(true)}
        </div>
      </div>
    );

    return embedMode === 'placeholder' ? (
      compactEl
    ) : (
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] transition-transform duration-150"
        aria-label={`${rawTitle} — ${ctaText}`}
      >
        {compactEl}
      </a>
    );
  }

  // ---------- LOOK 3: BANNER (LK-6) ----------
  if (look === 'banner') {
    const bannerContent = (
      <BannerLookCard
        provider={provider}
        providerName={providerDef.name}
        brandColor={providerDef.brandColor}
        meta={meta}
        title={rawTitle}
        subtitle={rawSubtitle}
        summary={rawSummary}
        statsLabel={statsLabel}
        showPicture={showPicture}
        showPlatformLabel={showPlatformLabel}
        isItemArtwork={isItemArtwork}
        isSpotify={isSpotify}
        userAvatarUrl={userAvatarUrl}
        userDisplayName={userDisplayName}
        cardContainerStyle={cardContainerStyle}
        resolvedSurfaceHex={resolvedSurfaceHex}
        textPrimary={textPrimary}
        textMuted={textMuted}
        rawChosenAccent={rawChosenAccent}
        scale={scale}
        platformGlyph={<ProviderGlyph provider={provider} size={Math.max(10, Math.round(12 * scale))} />}
        spotifyLogo={<SpotifyBrandLogo surfaceHex={resolvedSurfaceHex} textColor={textPrimary} />}
        ctaButton={renderCtaButton(false)}
      />
    );

    return embedMode === 'placeholder' ? (
      bannerContent
    ) : (
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] motion-reduce:hover:scale-100 transition-transform duration-150 motion-reduce:transition-none"
        aria-label={`${rawTitle} — ${ctaText}`}
      >
        {bannerContent}
      </a>
    );
  }

  // ---------- LOOK 6: PROFILE CARD ----------
  if (look === 'profile_card') {
    const spotlightPicSize = Math.round((isItemArtwork ? 68 : 64) * scale);
    const spotlightRing = ensureUiAccentContrast(rawChosenAccent, resolvedSurfaceHex, textPrimary, 2.4, pageBgHex);

    const profileCardContent = (
      <div
        className="w-full overflow-hidden flex flex-col items-center text-center transition-all duration-150"
        style={{
          ...cardContainerStyle,
          borderColor: brandTintedBorder,
          padding: `${Math.round(18 * scale)}px ${Math.round(16 * scale)}px`,
          gap: `${Math.round(10 * scale)}px`,
        }}
      >
        {showPlatformLabel && (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: hexWithAlpha(guardedAccent, 0.12),
              color: guardedAccent,
            }}
          >
            <ProviderGlyph provider={provider} size={12} />
            <span>{providerDef.name}</span>
          </div>
        )}

        {showPicture && (
          <div className="mt-0.5">
            {renderPicture(spotlightPicSize, spotlightRing)}
          </div>
        )}

        <div className="min-w-0 w-full flex flex-col items-center gap-0.5">
          <div
            dir="auto"
            title={rawTitle}
            className="font-semibold leading-[22px] line-clamp-2 break-words"
            style={{ fontSize: `${Math.max(15, Math.round(17 * scale))}px`, color: textPrimary }}
          >
            {rawTitle}
          </div>
          {rawSubtitle && (
            <div
              dir="auto"
              className="truncate max-w-full leading-[18px]"
              style={{
                fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`,
                color: textMuted,
              }}
            >
              {rawSubtitle}
            </div>
          )}
        </div>

        {rawSummary && (
          <p
            dir="auto"
            className="line-clamp-2 leading-[19px] max-w-[34ch] break-words"
            style={{ fontSize: `${Math.max(12, Math.round(13 * scale))}px`, color: textMuted }}
          >
            {rawSummary}
          </p>
        )}

        {statsLabel && (
          <span
            className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium"
            style={{
              backgroundColor: hexWithAlpha(textPrimary, 0.06),
              color: textMuted,
            }}
          >
            {statsLabel}
          </span>
        )}

        <div className="pt-1 flex items-center justify-center w-full">
          {renderCtaButton(false)}
        </div>
      </div>
    );

    return embedMode === 'placeholder' ? (
      profileCardContent
    ) : (
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] transition-transform duration-150"
        aria-label={`${rawTitle} — ${ctaText}`}
      >
        {profileCardContent}
      </a>
    );
  }

  // ---------- LOOK 7: WITH POSTS / LATEST HIGHLIGHTS ----------
  if (look === 'with_posts') {
    const headerPicSize = Math.round((isItemArtwork ? 54 : 46) * scale);
    const innerCardBg = hexWithAlpha(textPrimary, 0.045);
    const innerCardBorder = hexWithAlpha(textPrimary, 0.11);
    const statsItems =
      kindDef.capabilities.stats && meta?.showStats !== false && meta?.stats && meta.stats.length > 0
        ? meta.stats.slice(0, 2)
        : null;

    const withPostsContent = (
      <div
        className="w-full overflow-hidden flex flex-col text-left transition-all duration-150"
        style={{
          ...cardContainerStyle,
          borderColor: brandTintedBorder,
          padding: `${Math.round(15 * scale)}px`,
          gap: `${Math.round(12 * scale)}px`,
        }}
      >
        {/* Top Profile Row */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {renderPicture(headerPicSize)}
            <div className="min-w-0 flex-1 flex flex-col">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  dir="auto"
                  title={rawTitle}
                  className="font-semibold truncate leading-[20px]"
                  style={{ fontSize: `${Math.max(14, Math.round(15.5 * scale))}px`, color: textPrimary }}
                >
                  {rawTitle}
                </span>
                {showPlatformLabel && (
                  <span className="shrink-0" style={{ color: glyphColor }} aria-label={providerDef.name}>
                    <ProviderGlyph provider={provider} size={Math.round(14 * scale)} />
                  </span>
                )}
              </div>
              {rawSubtitle && (
                <span
                  dir="auto"
                  className="truncate leading-[18px]"
                  style={{ fontSize: `${Math.max(11.5, Math.round(13 * scale))}px`, color: textMuted }}
                >
                  {rawSubtitle}
                </span>
              )}
            </div>
          </div>

          {renderCtaButton(true)}
        </div>

        {/* Bottom Posts / Activity Highlights Strip */}
        <div
          className="flex flex-col gap-2 pt-2.5 border-t"
          style={{ borderColor: innerCardBorder }}
        >
          {rawSummary && (
            <div
              className="rounded-[10px] px-3 py-2 border"
              style={{
                backgroundColor: innerCardBg,
                borderColor: innerCardBorder,
              }}
            >
              <p
                dir="auto"
                className="line-clamp-2 leading-[18px] break-words"
                style={{ fontSize: `${Math.max(11.5, Math.round(13 * scale))}px`, color: textPrimary }}
              >
                {rawSummary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {statsItems ? (
              statsItems.map((st, idx) => (
                <div
                  key={`${st.key}-${idx}`}
                  className="rounded-[10px] px-2.5 py-2 border flex flex-col justify-center"
                  style={{
                    backgroundColor: innerCardBg,
                    borderColor: innerCardBorder,
                  }}
                >
                  <span
                    className="font-bold leading-tight truncate"
                    style={{ fontSize: `${Math.max(13, Math.round(14 * scale))}px`, color: textPrimary }}
                  >
                    {st.value}
                  </span>
                  <span
                    className="truncate uppercase tracking-wider"
                    style={{ fontSize: `${Math.max(9.5, Math.round(10.5 * scale))}px`, color: textMuted }}
                  >
                    {st.key}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div
                  className="rounded-[10px] px-2.5 py-2 border flex items-center gap-2 min-w-0"
                  style={{
                    backgroundColor: innerCardBg,
                    borderColor: innerCardBorder,
                  }}
                >
                  <span style={{ color: glyphColor }} className="shrink-0">
                    <ProviderGlyph provider={provider} size={13} />
                  </span>
                  <span
                    className="truncate font-medium"
                    style={{ fontSize: `${Math.max(11, Math.round(12 * scale))}px`, color: textPrimary }}
                  >
                    {statsLabel || `${providerDef.name} feed`}
                  </span>
                </div>
                <div
                  className="rounded-[10px] px-2.5 py-2 border flex items-center justify-between gap-1.5 min-w-0"
                  style={{
                    backgroundColor: innerCardBg,
                    borderColor: innerCardBorder,
                  }}
                >
                  <span
                    className="truncate font-medium"
                    style={{ fontSize: `${Math.max(11, Math.round(12 * scale))}px`, color: textPrimary }}
                  >
                    Latest posts
                  </span>
                  <ExternalLink size={11} style={{ color: textMuted }} className="shrink-0" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );

    return embedMode === 'placeholder' ? (
      withPostsContent
    ) : (
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] transition-transform duration-150"
        aria-label={`${rawTitle} — ${ctaText}`}
      >
        {withPostsContent}
      </a>
    );
  }

  // ---------- LOOKS 1, 2, 4: MATCH PAGE, BRAND, GLASS (LK-4, LK-5, LK-7) ----------
  const standardPictureSize = Math.round((isItemArtwork ? 64 : 48) * scale);

  const cardInner = (
    <div
      className="w-full flex flex-col text-left transition-all duration-150 overflow-hidden"
      style={{
        ...cardContainerStyle,
        padding: `${Math.round(16 * scale)}px`,
        gap: `${Math.round(12 * scale)}px`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {renderPicture(standardPictureSize)}
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <div
              dir="auto"
              title={rawTitle}
              className="font-semibold leading-[22px] line-clamp-2 break-words"
              style={{ fontSize: `${Math.max(14, Math.round(16 * scale))}px`, color: textPrimary }}
            >
              {rawTitle}
            </div>
            {rawSubtitle && (
              <div
                dir="auto"
                className="truncate leading-[20px]"
                style={{
                  fontSize: `${Math.max(12, Math.round(14 * scale))}px`,
                  color: textMuted,
                  fontFamily: provider === 'github' ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                }}
              >
                {rawSubtitle}
              </div>
            )}
          </div>
        </div>

        {showPlatformLabel && (
          <span
            className="shrink-0 mt-0.5"
            style={{ color: glyphColor }}
            aria-label={providerDef.name}
            title={providerDef.name}
          >
            <ProviderGlyph provider={provider} size={Math.round(16 * scale)} />
          </span>
        )}
      </div>

      {rawSummary && (
        <p
          dir="auto"
          className="line-clamp-2 leading-[20px] break-words"
          style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px`, color: textMuted }}
        >
          {rawSummary}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {isSpotify ? (
            <SpotifyBrandLogo surfaceHex={resolvedSurfaceHex} textColor={textPrimary} />
          ) : statsLabel ? (
            <span
              className="truncate leading-[18px]"
              style={{ fontSize: `${Math.max(11, Math.round(13 * scale))}px`, color: textMuted }}
            >
              {statsLabel}
            </span>
          ) : (
            <span />
          )}
        </div>

        {renderCtaButton(false)}
      </div>
    </div>
  );

  if (embedMode === 'placeholder') {
    return cardInner;
  }

  return (
    <a
      href={canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onLinkClick?.(block)}
      className="block w-full hover:scale-[1.01] transition-transform duration-150"
      aria-label={`${rawTitle} — ${ctaText}`}
    >
      {cardInner}
    </a>
  );
};

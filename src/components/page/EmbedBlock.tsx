import React from 'react';
import {
  Play,
  Music,
  Headphones,
  MessageSquare,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { parseEmbedUrl } from '../../lib/embeds';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';

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

const XMarkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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

  const isSocialCardProvider =
    provider === 'discord' ||
    provider === 'github' ||
    provider === 'linkedin' ||
    provider === 'x';

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
                : 'X';

  const ProviderIcon =
    provider === 'youtube'
      ? Play
      : provider === 'spotify'
        ? Music
        : provider === 'soundcloud'
          ? Headphones
          : provider === 'discord'
            ? MessageSquare
            : provider === 'github'
              ? Github
              : provider === 'linkedin'
                ? Linkedin
                : Globe;

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

  // Rich interactive social / developer card (Discord, GitHub, LinkedIn, X)
  if (isSocialCardProvider) {
    const targetUrl = parsed?.canonicalUrl || block.url || '#';
    const cardTitle = meta?.title || block.title || parsed?.label || `${providerLabel} link`;
    const cardSubtitle = meta?.subtitle || (parsed?.identifier ? `@${parsed.identifier}` : undefined);
    const cardDesc = meta?.description;
    const badgeText = meta?.badgeText || providerLabel;
    const ctaText =
      provider === 'discord'
        ? 'Join Server'
        : provider === 'github'
          ? 'View on GitHub'
          : provider === 'linkedin'
            ? 'View Profile'
            : 'View on X';

    const innerContent = (
      <div
        className="w-full flex flex-col gap-2.5 text-left transition-all duration-150"
        style={{
          ...baseSurface,
          fontFamily: fontFamily || vibe.fontFamily,
          borderRadius: `${cardRadius}px`,
          padding: `${Math.round(14 * scale)}px`,
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {meta?.avatarUrl ? (
              <img
                src={meta.avatarUrl}
                alt={cardTitle}
                className="rounded-full object-cover border border-current/20 shrink-0"
                style={{
                  width: `${Math.round(38 * scale)}px`,
                  height: `${Math.round(38 * scale)}px`,
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: `${Math.round(36 * scale)}px`,
                  height: `${Math.round(36 * scale)}px`,
                  backgroundColor: tokens.text,
                  color: tokens.bg,
                }}
              >
                {provider === 'x' ? (
                  <XMarkIcon size={Math.round(16 * scale)} />
                ) : (
                  <ProviderIcon size={Math.round(18 * scale)} strokeWidth={1.7} />
                )}
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="font-semibold leading-tight truncate"
                  style={{ fontSize: `${Math.max(13, Math.round(14 * scale))}px` }}
                >
                  {cardTitle}
                </span>
              </div>
              {cardSubtitle && (
                <span
                  className="opacity-75 truncate leading-tight mt-0.5"
                  style={{ fontSize: `${Math.max(11, Math.round(12 * scale))}px` }}
                >
                  {cardSubtitle}
                </span>
              )}
            </div>
          </div>

          <span
            className="px-2 py-0.5 border border-current/20 font-medium shrink-0 whitespace-nowrap"
            style={{
              fontSize: `${Math.max(10, Math.round(11 * scale))}px`,
              borderRadius: `${controlRadius}px`,
              opacity: 0.9,
            }}
          >
            {badgeText}
          </span>
        </div>

        {cardDesc && (
          <p
            className="opacity-85 line-clamp-2 leading-snug"
            style={{ fontSize: `${Math.max(11, Math.round(12 * scale))}px` }}
          >
            {cardDesc}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {meta?.statsLabel ? (
            <span
              className="opacity-80 font-medium truncate"
              style={{ fontSize: `${Math.max(10, Math.round(11 * scale))}px` }}
            >
              {meta.statsLabel}
            </span>
          ) : (
            <span />
          )}

          <span
            className="inline-flex items-center gap-1 font-semibold px-3 py-1 shrink-0"
            style={{
              backgroundColor: tokens.text,
              color: tokens.bg,
              borderRadius: `${controlRadius}px`,
              fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
            }}
          >
            <span>{ctaText}</span>
            <ExternalLink size={Math.max(10, Math.round(11 * scale))} />
          </span>
        </div>
      </div>
    );

    if (embedMode === 'placeholder') {
      return innerContent;
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
        {innerContent}
      </a>
    );
  }

  // Height calculations for media players (YouTube, Spotify, SoundCloud)
  const defaultHeight =
    provider === 'youtube'
      ? Math.round(200 * scale)
      : parsed?.height
        ? Math.round(parsed.height * scale)
        : Math.round(152 * scale);

  // If in placeholder mode (phone previews), render non-interactive facade card
  if (embedMode === 'placeholder') {
    return (
      <div
        className="w-full relative flex flex-col items-center justify-center overflow-hidden transition-all duration-150 p-4 text-center"
        style={{
          minHeight: `${defaultHeight}px`,
          ...baseSurface,
          fontFamily: fontFamily || vibe.fontFamily,
          borderRadius: `${cardRadius}px`,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shrink-0"
          style={{
            backgroundColor: tokens.text,
            color: tokens.bg,
          }}
        >
          <ProviderIcon size={20} strokeWidth={1.5} />
        </div>
        <span className="text-[13px] font-medium leading-tight">
          {parsed?.label || `${providerLabel} player`}
        </span>
        {block.title && (
          <span
            className="text-[12px] opacity-75 mt-1 max-w-[90%] truncate leading-normal"
            style={{ color: String(baseSurface.color || tokens.text) }}
          >
            {block.title}
          </span>
        )}
      </div>
    );
  }

  // Live mode on public page:
  // If active, render iframe
  if (isActivePlayer && parsed) {
    return (
      <div
        className="w-full overflow-hidden transition-all duration-150"
        style={{
          borderRadius: `${cardRadius}px`,
          height: parsed.height ? `${parsed.height}px` : undefined,
          aspectRatio: parsed.aspect || undefined,
        }}
      >
        <iframe
          src={parsed.embedSrc}
          title={block.title || parsed.label}
          loading="eager"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen={provider === 'youtube'}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          className="w-full h-full border-0 block"
          style={{ borderRadius: `${cardRadius}px` }}
        />
      </div>
    );
  }

  // Initial facade in live mode
  const playLabel = provider === 'youtube' ? 'Play' : 'Load player';
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
        ...baseSurface,
        fontFamily: fontFamily || vibe.fontFamily,
        borderRadius: `${cardRadius}px`,
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 shrink-0"
        style={{
          backgroundColor: tokens.text,
          color: tokens.bg,
        }}
      >
        <ProviderIcon size={24} strokeWidth={1.5} />
      </div>

      {block.title && (
        <h4 className="text-[15px] font-semibold mb-1 max-w-[85%] truncate">
          {block.title}
        </h4>
      )}

      <p className="text-[13px] font-medium opacity-85 mb-4">
        {parsed?.label || `${providerLabel} audio`}
      </p>

      <button
        type="button"
        aria-label={accessibleName}
        onClick={() => {
          onActivate(block.id);
          onLinkClick?.(block);
        }}
        className="h-10 px-6 font-semibold text-[14px] flex items-center justify-center gap-2 transition-transform duration-120 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
        style={{
          backgroundColor: tokens.text,
          color: tokens.bg,
          borderRadius: `${controlRadius}px`,
        }}
      >
        <Play size={15} fill="currentColor" />
        <span>{playLabel}</span>
      </button>

      <p className="mt-3 text-[12px] opacity-75">
        Content loads from {providerLabel} when you press play.
      </p>
    </div>
  );
};

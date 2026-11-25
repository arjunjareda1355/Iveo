import React, { useEffect, useRef, useState } from 'react';
import {
  computeBannerImagePresentation,
  normalizeCardBannerConfig,
  resolveBannerAvatarChain,
  resolveBannerBackgroundStyle,
  resolveBannerMutedTextColor,
  resolveBannerResponsiveMetrics,
} from '../../lib/cardBanner';
import type { EmbedMetaData, EmbedProvider } from '../../data/types';

export interface BannerLookCardProps {
  provider: EmbedProvider;
  providerName: string;
  brandColor: string;
  meta?: EmbedMetaData | null;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  statsLabel?: string | null;
  showPicture: boolean;
  showPlatformLabel: boolean;
  isItemArtwork: boolean;
  isSpotify: boolean;
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
  cardContainerStyle: React.CSSProperties;
  resolvedSurfaceHex: string;
  textPrimary: string;
  textMuted: string;
  rawChosenAccent: string;
  scale?: number;
  platformGlyph: React.ReactNode;
  spotifyLogo?: React.ReactNode;
  ctaButton: React.ReactNode;
  previewBannerImageOverride?: string | null;
}

export const BannerLookCard: React.FC<BannerLookCardProps> = ({
  provider,
  providerName,
  brandColor,
  meta,
  title,
  subtitle,
  summary,
  statsLabel,
  showPicture,
  showPlatformLabel,
  isItemArtwork,
  isSpotify,
  userAvatarUrl,
  userDisplayName,
  cardContainerStyle,
  resolvedSurfaceHex,
  textPrimary,
  textMuted: _textMuted,
  rawChosenAccent,
  scale = 1,
  platformGlyph,
  spotifyLogo,
  ctaButton,
  previewBannerImageOverride,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  const [uploadedFailed, setUploadedFailed] = useState(false);
  const [fetchedCoverFailed, setFetchedCoverFailed] = useState(false);
  const [fetchedAvatarFailed, setFetchedAvatarFailed] = useState(false);
  const [userAvatarFailed, setUserAvatarFailed] = useState(false);

  const normalizedBanner = normalizeCardBannerConfig(meta?.banner);
  const fetchedAvatarUrl =
    meta?.override?.imageUrl?.trim() ||
    (isItemArtwork ? meta?.coverUrl || meta?.avatarUrl : meta?.avatarUrl || meta?.coverUrl) ||
    null;

  useEffect(() => {
    setUploadedFailed(false);
  }, [normalizedBanner.imageUrl, normalizedBanner.smallImageUrl, normalizedBanner.source]);

  useEffect(() => {
    setFetchedCoverFailed(false);
  }, [meta?.coverUrl]);

  useEffect(() => {
    setFetchedAvatarFailed(false);
  }, [fetchedAvatarUrl]);

  useEffect(() => {
    setUserAvatarFailed(false);
  }, [userAvatarUrl]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = el.getBoundingClientRect().width;
      if (next > 0) setCardWidth(next);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setCardWidth(entry.contentRect.width);
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const metrics = resolveBannerResponsiveMetrics(cardWidth, scale);

  const bgResolution = resolveBannerBackgroundStyle({
    banner: normalizedBanner,
    fetchedCoverUrl: meta?.coverUrl || null,
    allowAutoFetchedCover: !(provider === 'spotify'),
    fetchedCoverFailed,
    uploadedFailed,
    provider,
    accentHex: rawChosenAccent || brandColor,
  });

  const presentation = computeBannerImagePresentation({
    focalX: bgResolution.focalX,
    focalY: bgResolution.focalY,
    zoom: bgResolution.zoom,
  });

  const activeBannerImgSrc =
    previewBannerImageOverride
      ? previewBannerImageOverride
      : bgResolution.mode === 'image'
        ? metrics.compact && bgResolution.smallImageUrl
          ? bgResolution.smallImageUrl
          : bgResolution.imageUrl
        : null;

  const avatarResolved = resolveBannerAvatarChain({
    fetchedAvatarUrl,
    fetchedError: fetchedAvatarFailed,
    userIveoAvatarUrl: userAvatarUrl,
    userIveoError: userAvatarFailed,
    title,
    handle: meta?.handle || subtitle,
    userDisplayName,
    accentHex: rawChosenAccent || brandColor,
    cardSurfaceHex: resolvedSurfaceHex,
  });

  const effectiveTextMuted = resolveBannerMutedTextColor(resolvedSurfaceHex, textPrimary);

  // Outer card uses 16px radius (or scaled) WITHOUT overflow:hidden so avatar overlaps cleanly
  const outerBorderRadius =
    scale === 1 ? '16px' : `${Math.max(10, Math.round(16 * scale))}px`;
  const bannerTopRadius =
    scale === 1 ? '15px' : `${Math.max(9, Math.round(15 * scale))}px`;

  const horizontalPad = Math.round((metrics.compact ? 12 : 16) * scale);
  const bottomPad = Math.round((metrics.compact ? 14 : 16) * scale);

  return (
    <div
      ref={cardRef}
      data-testid="banner-look-card"
      className="w-full flex flex-col text-left transition-colors duration-150 motion-reduce:transition-none"
      style={{
        ...cardContainerStyle,
        borderRadius: outerBorderRadius,
        overflow: 'visible',
      }}
    >
      {/* Top Banner (ONLY this container clips overflow + top corners) */}
      <div
        data-testid="banner-look-strip"
        className="w-full relative shrink-0"
        style={{
          height: `${metrics.bannerHeight}px`,
          borderTopLeftRadius: bannerTopRadius,
          borderTopRightRadius: bannerTopRadius,
          overflow: 'hidden',
          background: bgResolution.backgroundCss,
          ...(activeBannerImgSrc
            ? {
                backgroundImage: `url("${activeBannerImgSrc}")`,
                backgroundPosition: presentation.backgroundPosition,
                backgroundSize: presentation.backgroundSize,
                backgroundRepeat: 'no-repeat',
              }
            : {}),
        }}
      >
        {activeBannerImgSrc && (
          <img
            src={activeBannerImgSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              if (normalizedBanner.source === 'upload') {
                setUploadedFailed(true);
              } else {
                setFetchedCoverFailed(true);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none select-none"
          />
        )}

        {/* Readability dim overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundColor: `rgba(10, 10, 10, ${bgResolution.dimAlpha})`,
          }}
        />

        {/* Platform badge: top-left 12px/12px, height 28, rgba(10,10,10,0.55), white 12px/600, 18px white logo tile */}
        {showPlatformLabel && (
          <div
            data-testid="banner-platform-badge"
            className="absolute inline-flex items-center gap-1.5 text-white font-semibold leading-none select-none"
            style={{
              top: `${Math.round(12 * scale)}px`,
              left: `${Math.round(12 * scale)}px`,
              height: `${metrics.platformBadgeHeight}px`,
              paddingLeft: `${Math.round(5 * scale)}px`,
              paddingRight: `${Math.round(10 * scale)}px`,
              borderRadius: '9999px',
              backgroundColor: 'rgba(10, 10, 10, 0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
              fontWeight: 600,
              zIndex: 1,
            }}
          >
            <span
              className="inline-flex items-center justify-center shrink-0 bg-white"
              style={{
                width: `${metrics.platformTileSize}px`,
                height: `${metrics.platformTileSize}px`,
                borderRadius: `${Math.max(3, Math.round(4 * scale))}px`,
                color: brandColor.toUpperCase() === '#FFFC00' ? '#0A0A0A' : brandColor,
              }}
              aria-hidden="true"
            >
              {platformGlyph}
            </span>
            <span>{providerName}</span>
          </div>
        )}
      </div>

      {/* Card Body: Avatar left overlapping banner + View profile button right-aligned to avatar bottom */}
      <div
        className="w-full flex flex-col"
        style={{
          paddingLeft: `${horizontalPad}px`,
          paddingRight: `${horizontalPad}px`,
          paddingBottom: `${bottomPad}px`,
          paddingTop: showPicture ? '0px' : `${Math.round(14 * scale)}px`,
        }}
      >
        <div
          className={`flex items-end gap-3 ${showPicture ? 'justify-between' : 'justify-end'}`}
        >
          {showPicture && (
            <div
              data-testid="banner-avatar-wrap"
              className="shrink-0 rounded-full"
              style={{
                width: `${metrics.avatarSize}px`,
                height: `${metrics.avatarSize}px`,
                marginTop: `${metrics.avatarMarginTop}px`,
                position: 'relative',
                zIndex: 2,
                border: `${metrics.avatarRingPx}px solid ${resolvedSurfaceHex}`,
                backgroundColor: resolvedSurfaceHex,
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {avatarResolved.type === 'image' ? (
                <img
                  data-testid="banner-avatar-img"
                  src={avatarResolved.url}
                  alt=""
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (avatarResolved.source === 'fetched') {
                      setFetchedAvatarFailed(true);
                    } else {
                      setUserAvatarFailed(true);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    aspectRatio: '1 / 1',
                    borderRadius: '9999px',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  data-testid="banner-avatar-initial"
                  aria-hidden="true"
                  className="w-full h-full rounded-full flex items-center justify-center font-semibold select-none"
                  style={{
                    backgroundColor: avatarResolved.bgCss,
                    color: avatarResolved.textColor,
                    fontSize: `${Math.round(metrics.avatarSize * 0.4)}px`,
                  }}
                >
                  {avatarResolved.letter}
                </div>
              )}
            </div>
          )}

          <div className="shrink-0 pb-0.5">{ctaButton}</div>
        </div>

        {/* Name (17px/600 or 15px <320px, margin-top 8px) */}
        <div
          dir="auto"
          title={title}
          data-testid="banner-profile-name"
          className="font-semibold leading-[1.3] line-clamp-2 break-words"
          style={{
            marginTop: `${Math.round(8 * scale)}px`,
            fontSize: `${metrics.nameFontSize}px`,
            fontWeight: 600,
            color: textPrimary,
          }}
        >
          {title}
        </div>

        {/* Handle / username (13px muted below) */}
        {subtitle && (
          <div
            dir="auto"
            data-testid="banner-profile-handle"
            className="truncate leading-[1.4] mt-0.5"
            style={{
              fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
              color: effectiveTextMuted,
              fontFamily:
                provider === 'github' ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
            }}
          >
            {subtitle}
          </div>
        )}

        {summary && (
          <p
            dir="auto"
            className="line-clamp-2 leading-[1.45] mt-2 break-words"
            style={{
              fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`,
              color: effectiveTextMuted,
            }}
          >
            {summary}
          </p>
        )}

        {(isSpotify || statsLabel) && (
          <div className="flex items-center gap-2 mt-2.5 min-w-0">
            {isSpotify ? (
              spotifyLogo
            ) : (
              <span
                className="truncate leading-[18px]"
                style={{ fontSize: `${Math.max(11, Math.round(12.5 * scale))}px`, color: effectiveTextMuted }}
              >
                {statsLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

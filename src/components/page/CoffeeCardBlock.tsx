import React, { useEffect, useState } from 'react';
import { Coffee, ExternalLink } from 'lucide-react';
import {
  BackgroundConfig,
  CardLookStyle,
  EmbedMetaData,
  PageBlock,
} from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { formatExternalUrl } from '../../lib/urls';
import {
  resolveButtonControlRadius,
  resolveCardBorderRadius,
} from '../../lib/preferences';
import { normalizeEmbedLookStyle } from '../../lib/embedLooks';
import { getProviderDefinition } from '../../lib/providers/definitions';
import {
  ensureContrastText,
  ensureUiAccentContrast,
  hexWithAlpha,
  normalizeHexColor,
  resolveCssColorToHex,
  resolveGlassSurfaceConfig,
} from '../../lib/colors';
import { BannerLookCard } from './BannerLookCard';

export interface CoffeeCardBlockProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  embedMode: 'placeholder' | 'live';
  fontFamily?: string;
  scale?: number;
  onLinkClick?: (block: PageBlock) => void;
  surfaceStyle?: React.CSSProperties;
  pageCardLook?: CardLookStyle;
  background?: BackgroundConfig | null;
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
}

function sanitizePublicCoffeeCopy(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^connected\s+(via\s+oauth|.*profile)/i.test(trimmed)) return null;
  if (/\boauth\b/i.test(trimmed)) return null;
  return trimmed;
}

export const CoffeeCardBlock: React.FC<CoffeeCardBlockProps> = ({
  block,
  vibe,
  effectiveRadius,
  embedMode,
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
  const coffee = block.coffee;
  const rawMeta = block.embedMeta;
  const providerDef = getProviderDefinition('coffee');

  const coffeeUrl = block.url ? formatExternalUrl(block.url) : 'https://buymeacoffee.com';
  const isLive = embedMode === 'live';

  const [avatarError, setAvatarError] = useState(false);

  const defaultButtonText =
    providerDef.kinds[providerDef.defaultKind]?.defaultButtonText || 'Support with a Coffee';

  const mergedMeta: EmbedMetaData = {
    ...(rawMeta || { provider: 'coffee' }),
    provider: 'coffee',
    subtype: rawMeta?.subtype || 'profile',
    title: rawMeta?.title ?? coffee?.creatorName ?? null,
    handle:
      rawMeta?.handle ??
      (coffee?.slug ? `@${coffee.slug.replace(/^@/, '')}` : null),
    subtitle:
      rawMeta?.subtitle ??
      sanitizePublicCoffeeCopy(block.badge) ??
      (coffee?.slug ? `buymeacoffee.com/${coffee.slug}` : null),
    description: rawMeta?.description ?? coffee?.bio ?? null,
    avatarUrl: rawMeta?.avatarUrl ?? coffee?.avatarUrl ?? null,
    coverUrl: rawMeta?.coverUrl ?? coffee?.coverUrl ?? null,
    statsLabel:
      rawMeta?.statsLabel ??
      coffee?.supportersLabel ??
      (typeof coffee?.supportersCount === 'number' && coffee.supportersCount > 0
        ? `${coffee.supportersCount} supporters`
        : null),
    ctaLabel: rawMeta?.ctaLabel ?? coffee?.buttonLabel ?? defaultButtonText,
  };

  const effectivePictureUrl =
    mergedMeta.override?.imageUrl?.trim() ||
    mergedMeta.avatarUrl ||
    mergedMeta.coverUrl ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [effectivePictureUrl]);

  const look: CardLookStyle = rawMeta?.lookStyle
    ? normalizeEmbedLookStyle(rawMeta.lookStyle, pageCardLook)
    : normalizeEmbedLookStyle(pageCardLook, 'match_page');

  const resolvedBaseCornerPx =
    mergedMeta.corners === 'sharp'
      ? 6
      : mergedMeta.corners === 'rounded'
        ? 16
        : mergedMeta.corners === 'pill'
          ? 28
          : effectiveRadius;
  const cardRadius = resolveCardBorderRadius(resolvedBaseCornerPx, scale, 'card');
  const innerRadius = resolveCardBorderRadius(resolvedBaseCornerPx, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(resolvedBaseCornerPx, scale);

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

  const accentMode = mergedMeta.accentMode || (look === 'match_page' ? 'page' : 'brand');
  const rawPageAccentHex = resolveCssColorToHex(
    tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg,
    pageBgHex
  );
  const rawChosenAccent =
    accentMode === 'custom'
      ? normalizeHexColor(mergedMeta.accentColor) || providerDef.brandColor
      : accentMode === 'page'
        ? rawPageAccentHex
        : providerDef.brandColor;

  const guardedAccent = ensureUiAccentContrast(
    rawChosenAccent,
    vibeSurfaceHex,
    cardTextOnSurface,
    3.0,
    pageBgHex
  );

  const buttonFillColor =
    look === 'match_page'
      ? rawPageAccentHex
      : normalizeHexColor(rawChosenAccent) || providerDef.brandColor;
  const buttonFillText = ensureContrastText(
    accentMode === 'brand' && rawChosenAccent.toUpperCase() === providerDef.brandColor
      ? providerDef.brandTextOnFill
      : null,
    buttonFillColor,
    4.5,
    vibeSurfaceHex
  );

  const glassCfg =
    look === 'glass' ? resolveGlassSurfaceConfig(tokens, guardedAccent, background) : null;
  const resolvedCardBg =
    look === 'glass' && glassCfg ? glassCfg.backgroundCss : vibeSurfaceCss;
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

  const defaultBorderHex =
    tokens.buttonBorder && tokens.buttonBorder !== 'transparent'
      ? resolveCssColorToHex(tokens.buttonBorder, pageBgHex)
      : hexWithAlpha(textPrimary, 0.16);
  const brandTintedBorder = hexWithAlpha(
    ensureUiAccentContrast(rawChosenAccent, pageBgHex, textPrimary, 2.2, pageBgHex),
    0.42
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
  };

  const showPicture = mergedMeta.showAvatar !== false;
  const showPlatformLabel = mergedMeta.showPlatformLabel !== false;
  const showSummary = mergedMeta.showDescription !== false;
  const showStats = mergedMeta.showStats !== false;

  const rawTitle =
    mergedMeta.override?.title?.trim() ||
    block.title?.trim() ||
    coffee?.creatorName?.trim() ||
    mergedMeta.title?.trim() ||
    'Buy Me a Coffee';

  const rawHandle =
    mergedMeta.override?.subtitle?.trim() ||
    mergedMeta.handle?.trim() ||
    (coffeeUrl !== 'https://buymeacoffee.com'
      ? coffeeUrl.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
      : '');

  const rawSummary = showSummary
    ? sanitizePublicCoffeeCopy(
        mergedMeta.override?.description?.trim() ||
          mergedMeta.description ||
          coffee?.bio ||
          block.badge
      )
    : null;

  const statsLabel = showStats ? sanitizePublicCoffeeCopy(mergedMeta.statsLabel) : null;
  const ctaText = mergedMeta.ctaLabel?.trim() || defaultButtonText;

  const defaultButtonStyleForLook =
    look === 'match_page' ? 'filled' : look === 'glass' ? 'outline' : 'filled';
  const effectiveButtonStyle = mergedMeta.buttonStyle || defaultButtonStyleForLook;

  const glyphColor =
    look === 'match_page'
      ? textPrimary
      : ensureUiAccentContrast(rawChosenAccent, resolvedSurfaceHex, textPrimary, 3.0, pageBgHex);

  const badgeToneBg =
    rawChosenAccent.toUpperCase() === '#FFDD00'
      ? 'rgba(255, 221, 0, 0.26)'
      : hexWithAlpha(guardedAccent, 0.14);
  const badgeToneFg =
    rawChosenAccent.toUpperCase() === '#FFDD00'
      ? textPrimary
      : glyphColor;

  const parsedCoffeePrice = coffee?.coffeePrice
    ? Number.parseFloat(String(coffee.coffeePrice).replace(/[^0-9.]/g, ''))
    : Number.NaN;
  const unitPrice =
    Number.isFinite(parsedCoffeePrice) && parsedCoffeePrice > 0 ? parsedCoffeePrice : 3;
  const recentSupporters = Array.isArray(coffee?.recentSupporters)
    ? coffee.recentSupporters
    : [];
  const latestSupporter = recentSupporters[0];
  const extras = Array.isArray(coffee?.extras) ? coffee.extras.slice(0, 2) : [];

  const renderAvatar = (sizePx: number, extraRingColor?: string) => {
    if (!showPicture) return null;
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
          className="object-cover shrink-0 block rounded-full"
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            border: extraRingColor ? `3px solid ${extraRingColor}` : `1px solid ${hexWithAlpha(textPrimary, 0.16)}`,
          }}
        />
      );
    }

    return (
      <div
        className="flex items-center justify-center shrink-0 rounded-full"
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          border: extraRingColor ? `3px solid ${extraRingColor}` : undefined,
          backgroundColor: badgeToneBg,
          color: badgeToneFg,
        }}
      >
        <Coffee size={Math.round(sizePx * 0.48)} strokeWidth={1.9} />
      </div>
    );
  };

  const renderCta = (options?: { fullWidth?: boolean; compact?: boolean; asLink?: boolean }) => {
    if (effectiveButtonStyle === 'hidden') return null;
    const fullWidth = options?.fullWidth ?? false;
    const compact = options?.compact ?? false;
    const asLink = options?.asLink ?? false;

    const commonStyle: React.CSSProperties =
      effectiveButtonStyle === 'text'
        ? {
            color: textPrimary,
            fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`,
          }
        : effectiveButtonStyle === 'outline'
          ? {
              height: `${Math.round((compact ? 32 : 38) * scale)}px`,
              paddingInline: `${Math.round((compact ? 11 : 14) * scale)}px`,
              borderRadius: `${controlRadius}px`,
              border: `1.5px solid ${ensureUiAccentContrast(
                buttonFillColor,
                resolvedSurfaceHex,
                textPrimary,
                3.0,
                pageBgHex
              )}`,
              color: ensureUiAccentContrast(
                buttonFillColor,
                resolvedSurfaceHex,
                textPrimary,
                3.0,
                pageBgHex
              ),
              fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
            }
          : {
              height: `${Math.round((compact ? 32 : 38) * scale)}px`,
              paddingInline: `${Math.round((compact ? 11 : 14) * scale)}px`,
              borderRadius: `${controlRadius}px`,
              backgroundColor: buttonFillColor,
              color: buttonFillText,
              fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
            };

    const className = `${fullWidth ? 'w-full' : 'shrink-0'} inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-transform active:scale-[0.98]`;

    const labelInner = (
      <>
        <span>{ctaText}</span>
        {effectiveButtonStyle === 'text' && <ExternalLink size={12} />}
      </>
    );

    if (isLive && asLink) {
      return (
        <a
          href={coffeeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onLinkClick?.(block)}
          className={className}
          style={commonStyle}
        >
          {labelInner}
        </a>
      );
    }

    return (
      <span className={className} style={commonStyle}>
        {labelInner}
      </span>
    );
  };

  const renderTierPills = (justifyClass = 'justify-center') => (
    <div className={`flex items-center flex-wrap gap-1.5 ${justifyClass}`}>
      {[1, 3, 5].map((count) => {
        const pillStyle: React.CSSProperties = {
          color: textPrimary,
          borderRadius: `${controlRadius}px`,
          borderColor: hexWithAlpha(textPrimary, 0.2),
          backgroundColor: hexWithAlpha(textPrimary, 0.04),
        };
        const label = `${count} ☕ ($${count * unitPrice})`;
        return isLive ? (
          <a
            key={count}
            href={coffeeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLinkClick?.(block)}
            className="px-2.5 py-1 text-[11px] font-medium border hover:border-current/60 transition-colors cursor-pointer"
            style={pillStyle}
          >
            {label}
          </a>
        ) : (
          <span
            key={count}
            className="px-2.5 py-1 text-[11px] font-medium border"
            style={pillStyle}
          >
            {label}
          </span>
        );
      })}
    </div>
  );

  const renderSupporterAndExtras = (centered = true) => (
    <>
      {latestSupporter && (
        <div
          className={`w-full px-2.5 py-1.5 border text-[11px] truncate ${centered ? 'text-center' : 'text-left'}`}
          style={{
            borderRadius: `${innerRadius}px`,
            borderColor: hexWithAlpha(textPrimary, 0.14),
            backgroundColor: hexWithAlpha(textPrimary, 0.035),
            color: textMuted,
          }}
        >
          ☕ Latest:{' '}
          <strong style={{ color: textPrimary }}>
            {latestSupporter.supporterName ||
              (latestSupporter as unknown as { name?: string }).name ||
              'Supporter'}
          </strong>{' '}
          ({latestSupporter.coffees}×)
          {latestSupporter.note ? ` · "${latestSupporter.note.slice(0, 42)}"` : ''}
        </div>
      )}

      {extras.length > 0 && (
        <div className={`flex flex-wrap items-center gap-1.5 ${centered ? 'justify-center' : 'justify-start'}`}>
          {extras.map((extra, idx) =>
            isLive ? (
              <a
                key={`${extra.title}-${idx}`}
                href={extra.url ? formatExternalUrl(extra.url) : coffeeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onLinkClick?.(block)}
                className="px-2 py-0.5 border text-[10px] font-medium opacity-90 hover:opacity-100"
                style={{
                  color: textPrimary,
                  borderColor: hexWithAlpha(textPrimary, 0.2),
                  borderRadius: `${innerRadius}px`,
                }}
              >
                ★ {extra.title}
                {extra.price ? ` · ${extra.price}` : ''}
              </a>
            ) : (
              <span
                key={`${extra.title}-${idx}`}
                className="px-2 py-0.5 border text-[10px] font-medium opacity-90"
                style={{
                  color: textPrimary,
                  borderColor: hexWithAlpha(textPrimary, 0.2),
                  borderRadius: `${innerRadius}px`,
                }}
              >
                ★ {extra.title}
                {extra.price ? ` · ${extra.price}` : ''}
              </span>
            )
          )}
        </div>
      )}
    </>
  );

  // ---------- 1. COMPACT LOOK ----------
  if (look === 'compact') {
    const subtitleCompact = statsLabel && rawHandle
      ? `${rawHandle} · ${statsLabel}`
      : statsLabel || rawHandle || rawSummary;

    return (
      <div
        className="w-full flex items-center justify-between gap-3 text-left transition-all duration-150"
        style={{
          ...cardContainerStyle,
          padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {renderAvatar(Math.round(40 * scale))}
          <div className="min-w-0 flex-1">
            <div
              dir="auto"
              title={rawTitle}
              className="font-semibold truncate leading-[22px]"
              style={{ fontSize: `${Math.max(14, Math.round(16 * scale))}px`, color: textPrimary }}
            >
              {rawTitle}
            </div>
            {subtitleCompact && (
              <div
                dir="auto"
                className="truncate leading-[20px]"
                style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`, color: textMuted }}
              >
                {subtitleCompact}
              </div>
            )}
          </div>
        </div>
        {renderCta({ compact: true, asLink: true })}
      </div>
    );
  }

  // ---------- 2. BANNER LOOK ----------
  if (look === 'banner') {
    const coffeeBannerFooter = (
      <div className="flex flex-col gap-2 mt-2.5 pt-2.5 border-t" style={{ borderColor: hexWithAlpha(textPrimary, 0.1) }}>
        {renderTierPills('justify-start')}
        {renderSupporterAndExtras(false)}
      </div>
    );

    const bannerCard = (
      <BannerLookCard
        provider="coffee"
        providerName={providerDef.name}
        brandColor={providerDef.brandColor}
        meta={mergedMeta}
        title={rawTitle}
        subtitle={rawHandle}
        summary={rawSummary}
        statsLabel={statsLabel}
        showPicture={showPicture}
        showPlatformLabel={showPlatformLabel}
        isItemArtwork={false}
        isSpotify={false}
        userAvatarUrl={userAvatarUrl}
        userDisplayName={userDisplayName}
        cardContainerStyle={cardContainerStyle}
        resolvedSurfaceHex={resolvedSurfaceHex}
        textPrimary={textPrimary}
        textMuted={textMuted}
        rawChosenAccent={rawChosenAccent}
        scale={scale}
        platformGlyph={<Coffee size={Math.max(10, Math.round(12 * scale))} strokeWidth={2} />}
        ctaButton={renderCta({ compact: true, asLink: false })}
        footerContent={coffeeBannerFooter}
      />
    );

    return isLive ? (
      <a
        href={coffeeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onLinkClick?.(block)}
        className="block w-full hover:scale-[1.01] motion-reduce:hover:scale-100 transition-transform duration-150"
        aria-label={`${rawTitle} — ${ctaText}`}
      >
        {bannerCard}
      </a>
    ) : (
      bannerCard
    );
  }

  // ---------- 3. PROFILE CARD LOOK ----------
  if (look === 'profile_card') {
    const spotlightRing = ensureUiAccentContrast(
      rawChosenAccent,
      resolvedSurfaceHex,
      textPrimary,
      2.4,
      pageBgHex
    );

    return (
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
              backgroundColor: badgeToneBg,
              color: badgeToneFg,
            }}
          >
            <Coffee size={12} strokeWidth={2} />
            <span>{providerDef.name}</span>
          </div>
        )}

        {showPicture && <div className="mt-0.5">{renderAvatar(Math.round(64 * scale), spotlightRing)}</div>}

        <div className="min-w-0 w-full flex flex-col items-center gap-0.5">
          <div
            dir="auto"
            title={rawTitle}
            className="font-semibold leading-[22px] line-clamp-2 break-words"
            style={{ fontSize: `${Math.max(15, Math.round(17 * scale))}px`, color: textPrimary }}
          >
            {rawTitle}
          </div>
          {rawHandle && (
            <div
              dir="auto"
              className="truncate max-w-full leading-[18px]"
              style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`, color: textMuted }}
            >
              {rawHandle}
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

        {renderTierPills('justify-center')}
        {renderSupporterAndExtras(true)}
        <div className="w-full pt-0.5">{renderCta({ fullWidth: true, asLink: true })}</div>
      </div>
    );
  }

  // ---------- 4. WITH POSTS / LATEST HIGHLIGHTS LOOK ----------
  if (look === 'with_posts') {
    const innerCardBorder = hexWithAlpha(textPrimary, 0.11);

    return (
      <div
        className="w-full overflow-hidden flex flex-col text-left transition-all duration-150"
        style={{
          ...cardContainerStyle,
          borderColor: brandTintedBorder,
          padding: `${Math.round(15 * scale)}px`,
          gap: `${Math.round(12 * scale)}px`,
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {renderAvatar(Math.round(46 * scale))}
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
                  <span className="shrink-0" style={{ color: badgeToneFg }} aria-label={providerDef.name}>
                    <Coffee size={Math.round(14 * scale)} strokeWidth={2} />
                  </span>
                )}
              </div>
              {(rawHandle || statsLabel) && (
                <span
                  dir="auto"
                  className="truncate leading-[18px]"
                  style={{ fontSize: `${Math.max(11.5, Math.round(13 * scale))}px`, color: textMuted }}
                >
                  {[rawHandle, statsLabel].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>

          {renderCta({ compact: true, asLink: true })}
        </div>

        <div className="flex flex-col gap-2 pt-2.5 border-t" style={{ borderColor: innerCardBorder }}>
          {rawSummary && (
            <p
              dir="auto"
              className="line-clamp-2 leading-[18px] break-words"
              style={{ fontSize: `${Math.max(11.5, Math.round(13 * scale))}px`, color: textMuted }}
            >
              {rawSummary}
            </p>
          )}
          {renderTierPills('justify-start')}
          {renderSupporterAndExtras(false)}
        </div>
      </div>
    );
  }

  // ---------- 5, 6, 7. MATCH PAGE / BRAND / GLASS ----------
  return (
    <div
      className="w-full overflow-hidden flex flex-col items-center select-none transition-all duration-150"
      style={{
        ...cardContainerStyle,
        padding: `${Math.round(14 * scale)}px`,
        gap: `${Math.round(8 * scale)}px`,
      }}
    >
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 max-w-full min-w-0">
        {showPicture && renderAvatar(Math.round(32 * scale))}
        <span
          dir="auto"
          className="font-semibold leading-tight text-center break-words"
          style={{ fontSize: `${Math.max(13, Math.round(15 * scale))}px`, color: textPrimary }}
        >
          {rawTitle}
        </span>
        {statsLabel && (
          <span
            className="px-2 py-0.5 text-[10px] font-semibold border shrink-0 whitespace-nowrap"
            style={{
              borderColor: hexWithAlpha(textPrimary, 0.22),
              color: textPrimary,
              opacity: 0.9,
              borderRadius: `${controlRadius}px`,
            }}
          >
            {statsLabel}
          </span>
        )}
        {showPlatformLabel && !statsLabel && (
          <span
            className="px-2 py-0.5 text-[10px] font-semibold shrink-0 whitespace-nowrap rounded-full inline-flex items-center gap-1"
            style={{
              backgroundColor: badgeToneBg,
              color: badgeToneFg,
            }}
          >
            <Coffee size={10} strokeWidth={2.2} />
            <span>Coffee</span>
          </span>
        )}
      </div>

      {rawHandle && (
        <span className="text-[11px] truncate max-w-full" style={{ color: textMuted }}>
          {rawHandle}
        </span>
      )}

      {rawSummary && (
        <p
          dir="auto"
          className="text-[11px] text-center leading-snug max-w-[36ch] line-clamp-2"
          style={{ color: textMuted }}
        >
          {rawSummary}
        </p>
      )}

      {renderTierPills('justify-center')}
      {renderSupporterAndExtras(true)}

      <div className="w-full pt-0.5">{renderCta({ fullWidth: true, asLink: true })}</div>
    </div>
  );
};

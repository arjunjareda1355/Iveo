import React, { useState } from 'react';
import {
  ArrowUpRight,
  Lock,
  Mail,
  Share2,
  Instagram,
  MessageCircle,
} from 'lucide-react';
import { Vibe } from '../../lib/vibes';
import { PageBlock } from '../../data/types';
import { PhoneProfile } from '../phone/PhonePage';
import { SocialIcon } from '../phone/SocialIcons';
import { LinkFaviconOrFallback } from '../ui/LinkFaviconOrFallback';
import { FeaturedLink } from './FeaturedLink';
import { EmbedBlock } from './EmbedBlock';
import { CoffeeCardBlock } from './CoffeeCardBlock';
import { TipJarBlock } from '../public/TipJarBlock';
import { FaqBlock } from '../public/FaqBlock';
import { VCardBlock } from '../public/VCardBlock';
import { ShareModal } from '../public/ShareModal';
import { ReportPageModal } from '../public/ReportPageModal';
import {
  YouTubeShowcaseCard,
  ProductShowcaseCard,
  BookingShowcaseCard,
  CountdownShowcaseCard,
  PromoShowcaseCard,
  LocationShowcaseCard,
  DownloadShowcaseCard,
} from './ShowcaseBlocks';
import { formatExternalUrl } from '../../lib/urls';
import { storagePublicUrl } from '../../data/storageApi';
import { getFontCssFamily, loadGoogleFonts } from '../../lib/fonts';
import {
  resolveEffectiveTokens,
  isLightHexColor,
  isDarkBackgroundConfig,
} from '../../lib/colors';
import { VerifiedTick } from '../ui/VerifiedTick';
import {
  DEFAULT_LAYOUT_SETTINGS,
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';
import { BackgroundLayer } from './BackgroundLayer';
import { SITE_LOGO_SRC, SITE_WORDMARK_SRC } from '../ui/Logo';
import {
  resolveBlockThemeContract,
  getBlockContrastPalette,
} from '../../lib/blockTheme';
import { BlueskyBlock } from './BlueskyBlock';
import { resolveTokens } from '../../lib/appearance/resolveTokens';
import { buildButtonSurfaceCss } from '../../lib/appearance/catalog/surfaces';
import { getAvatarClipAndRadiusCss } from '../../lib/appearance/catalog/layouts';

export interface PageRendererProps {
  vibe: Vibe;
  profile?: PhoneProfile | null;
  blocks?: PageBlock[];
  buttonRadiusOverride?: number;
  hideFooterMark?: boolean;
  embedMode?: 'placeholder' | 'live';
  isPublicPage?: boolean;
  isOwner?: boolean;
  scale?: number;
  onLinkClick?: (block: PageBlock) => void;
  onSocialClick?: (platform: string, url: string) => void;
  onWhatsAppClick?: (phone: string) => void;
  onUnlock?: (block: PageBlock) => void;
  renderSignupForm?: (block: PageBlock, surfaceStyle?: React.CSSProperties) => React.ReactNode;
  protectedIds?: ReadonlySet<string>;
}

export const PageRenderer: React.FC<PageRendererProps> = ({
  vibe,
  profile,
  blocks,
  buttonRadiusOverride,
  hideFooterMark = false,
  embedMode = 'placeholder',
  isPublicPage = false,
  isOwner = false,
  scale = 1,
  onLinkClick,
  onSocialClick,
  onWhatsAppClick,
  onUnlock,
  renderSignupForm,
  protectedIds,
}) => {
  const { persona } = vibe;
  const isVerified = Boolean(profile?.isVerified ?? profile?.isPro);
  const resolvedV2 =
    profile?.appearance && profile.appearance.schemaVersion === 2
      ? resolveTokens(profile.appearance, {
          isPro: profile.isPro ?? profile.isVerified ?? true,
        })
      : null;

  const themeContract = resolveBlockThemeContract({
    vibeId: vibe.id,
    vibeTokens: vibe.tokens,
    vibeFontFamily: vibe.fontFamily,
    buttonColors: profile?.buttonColors,
    background: profile?.background,
    layoutSettings: profile?.layoutSettings,
    fontSettings: profile?.fontSettings,
    appearance: profile?.appearance,
    isPro: profile?.isPro ?? profile?.isVerified ?? true,
    buttonRadiusOverride,
    scale,
  });
  const tokens = themeContract.tokens;
  const effectiveVibe: Vibe = { ...vibe, tokens };
  const onDarkTick = themeContract.isDarkPage;

  const nameFontFamily = themeContract.nameFontFamily;
  const bioFontFamily = themeContract.bioFontFamily;
  const buttonFontFamily = themeContract.buttonFontFamily;
  const effectiveRadius = themeContract.radii.effective;

  const layout = {
    avatarShape: profile?.layoutSettings?.avatarShape || DEFAULT_LAYOUT_SETTINGS.avatarShape,
    headerAlign: profile?.layoutSettings?.headerAlign || DEFAULT_LAYOUT_SETTINGS.headerAlign,
    buttonStyle: themeContract.buttonStyle,
    linkSpacing: profile?.layoutSettings?.linkSpacing || DEFAULT_LAYOUT_SETTINGS.linkSpacing,
    pageWidth: profile?.layoutSettings?.pageWidth || DEFAULT_LAYOUT_SETTINGS.pageWidth,
    cardLook: profile?.layoutSettings?.cardLook || DEFAULT_LAYOUT_SETTINGS.cardLook,
  };

  const headerLayout = resolvedV2
    ? resolvedV2.layout.header
    : layout.headerAlign === 'left'
      ? 'editorial'
      : 'centered';
  const isLeftHeader = headerLayout === 'editorial';
  const isCompactHeader = headerLayout === 'compact';
  const isHeroHeader = headerLayout === 'hero';

  const avatarFrame = resolvedV2
    ? resolvedV2.layout.avatar.frame
    : layout.avatarShape === 'squircle'
      ? 'squircle'
      : layout.avatarShape === 'rounded'
        ? 'rounded'
        : layout.avatarShape === 'ring'
          ? 'halo'
          : 'circle';

  const avatarPx = resolvedV2
    ? isPublicPage
      ? resolvedV2.layout.avatarSizePx
      : Math.round(Math.min(resolvedV2.layout.avatarSizePx * 0.72, 112) * scale)
    : Math.round(72 * scale);

  const avatarClip = getAvatarClipAndRadiusCss(avatarFrame, avatarPx);
  const avatarGlow = resolvedV2?.layout.avatar.glow || 'none';
  const accentHex = resolvedV2?.pageAccent || (tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg);

  const avatarGlowShadow =
    avatarGlow === 'accent'
      ? `0 0 32px ${accentHex}73`
      : avatarGlow === 'soft'
        ? `0 0 24px ${accentHex}40`
        : undefined;

  const avatarFrameShadow = (() => {
    const shadows: string[] = [];
    if (avatarFrame === 'halo') {
      shadows.push(`0 0 0 ${Math.max(2, Math.round(3 * scale))}px ${accentHex}`);
      shadows.push(`0 0 20px ${accentHex}44`);
    } else if (avatarFrame === 'double-ring') {
      shadows.push(`0 0 0 ${Math.max(2, Math.round(2 * scale))}px ${tokens.bg}`);
      shadows.push(`0 0 0 ${Math.max(4, Math.round(4.5 * scale))}px ${tokens.text}`);
      shadows.push(`0 0 0 ${Math.max(6, Math.round(6.5 * scale))}px ${tokens.bg}`);
      shadows.push(`0 0 0 ${Math.max(7, Math.round(8 * scale))}px ${accentHex}`);
    } else if (avatarFrame === 'sticker') {
      shadows.push(`0 0 0 ${Math.max(3, Math.round(4 * scale))}px #FFFFFF`);
      shadows.push(`${Math.round(3 * scale)}px ${Math.round(4 * scale)}px 0 rgba(10,10,12,0.85)`);
    }
    if (avatarGlowShadow) shadows.push(avatarGlowShadow);
    return shadows.length > 0 ? shadows.join(', ') : undefined;
  })();

  const linkGapPx = resolvedV2
    ? Math.round(resolvedV2.layout.gapPx * scale)
    : layout.linkSpacing === 'compact'
      ? Math.round(6 * scale)
      : layout.linkSpacing === 'airy'
        ? Math.round(16 * scale)
        : Math.round(10 * scale);

  const pageMaxWidthClass = resolvedV2
    ? resolvedV2.layout.width === 'focused'
      ? 'max-w-[440px]'
      : resolvedV2.layout.width === 'wide'
        ? 'max-w-[720px]'
        : 'max-w-[560px]'
    : layout.pageWidth === 'compact'
      ? 'max-w-[440px]'
      : layout.pageWidth === 'wide'
        ? 'max-w-[660px]'
        : 'max-w-[540px]';

  const linkLayout = resolvedV2 ? resolvedV2.layout.linkLayout : 'stack';
  const entranceMode = resolvedV2?.layout.entrance || 'none';
  const entranceClass =
    entranceMode === 'fade-up'
      ? 'iveo-entrance-fade-up'
      : entranceMode === 'stagger-scale'
        ? 'iveo-entrance-stagger'
        : '';

  const buttonSurfaceStyle = themeContract.surfaceStyle;
  const buttonPalette = getBlockContrastPalette(buttonSurfaceStyle, tokens);
  const getButtonSurfaceStyle = (overrideGlow?: string): React.CSSProperties =>
    overrideGlow
      ? { ...buttonSurfaceStyle, boxShadow: overrideGlow }
      : buttonSurfaceStyle;
  const socialBorderRadiusCss =
    effectiveRadius >= 999
      ? '9999px'
      : effectiveRadius <= 0
        ? '0px'
        : `${Math.round(Math.max(6, Math.min(12, effectiveRadius)) * scale)}px`;

  const socialIconStyle = resolvedV2?.layout.socialIcons || (layout.buttonStyle === 'glass' ? 'glass' : 'outline');
  const getSocialBtnStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: `${Math.round(36 * scale)}px`,
      height: `${Math.round(36 * scale)}px`,
      borderRadius: socialBorderRadiusCss,
    };
    if (socialIconStyle === 'filled') {
      return {
        ...base,
        ...buttonSurfaceStyle,
        border: buttonSurfaceStyle.border || `1px solid ${tokens.text}1A`,
      };
    }
    if (socialIconStyle === 'glass') {
      return {
        ...base,
        backgroundColor: themeContract.isDarkPage ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.58)',
        color: tokens.text,
        border: themeContract.isDarkPage ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(10,10,12,0.14)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      };
    }
    return {
      ...base,
      backgroundColor: 'transparent',
      color: tokens.text,
      border: `1.5px solid ${tokens.buttonBorder && tokens.buttonBorder !== 'transparent' ? tokens.buttonBorder : `${tokens.text}40`}`,
    };
  };

  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Load any customized Google Fonts used on this page
  React.useEffect(() => {
    loadGoogleFonts([
      resolvedV2?.typography.name.family,
      resolvedV2?.typography.bio.family,
      resolvedV2?.typography.button.family,
      profile?.fontSettings?.nameFont,
      profile?.fontSettings?.bioFont,
      profile?.fontSettings?.buttonFont,
      profile?.businessCard?.fontId,
    ]);
  }, [
    resolvedV2?.typography.name.family,
    resolvedV2?.typography.bio.family,
    resolvedV2?.typography.button.family,
    profile?.fontSettings?.nameFont,
    profile?.fontSettings?.bioFont,
    profile?.fontSettings?.buttonFont,
    profile?.businessCard?.fontId,
  ]);

  // Reset avatar error when avatarUrl changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [profile?.avatarUrl, persona.avatarUrl]);

  // Profile data
  const displayName = profile?.name ?? persona.name;
  const displayHandle = profile?.handle ?? persona.handle;
  const displayBio = profile ? (profile.bio || '') : persona.bio;
  const displayInitials =
    profile?.initials ??
    (profile?.name
      ? profile.name.slice(0, 2).toUpperCase()
      : persona.initials);

  // Social accounts: only render when explicitly provided and non-empty
  const rawSocials = profile?.socials;
  const activeSocialEntries = rawSocials
    ? Object.entries(rawSocials).filter(
        ([_, url]) => typeof url === 'string' && url.trim().length > 0
      )
    : [];

  // If custom blocks are provided, use them. Otherwise fall back to persona links
  const hasCustomBlocks = blocks !== undefined;
  const displayBlocks: PageBlock[] = hasCustomBlocks
    ? blocks
    : persona.links.map((item, idx) => {
        const title = typeof item === 'string' ? item : item.title;
        const url = typeof item === 'string' ? 'https://iveo.site' : item.url;
        return {
          id: `persona-${idx}`,
          kind: 'link',
          title,
          url,
          layout: 'classic',
          isActive: true,
          isArchived: false,
          position: idx,
        };
      });

  let imageCounter = 0;

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleShareClick = () => {
    setIsShareModalOpen(true);
  };

  const containerBgStyle: React.CSSProperties = {
    backgroundColor: isPublicPage ? 'transparent' : tokens.bg,
    color: tokens.text,
    fontFamily: vibe.fontFamily,
    padding: `${Math.round(32 * scale)}px ${Math.round(20 * scale)}px ${Math.round(24 * scale)}px`,
    ...(themeContract.cssVars as React.CSSProperties),
  };

  return (
    <div
      className={`w-full min-h-full flex-1 flex flex-col items-center select-none relative ${
        isPublicPage ? 'overflow-x-hidden' : ''
      }`}
      style={containerBgStyle}
    >
      {/* Background Layer (for Dashboard/Onboarding phone preview; Public page renders full-viewport fixed layer) */}
      {!isPublicPage && (
        <BackgroundLayer
          mode="contained"
          background={profile?.background}
          backgroundV2={resolvedV2?.background || null}
          smartScrim={resolvedV2?.smartScrim || null}
          fallbackBg={tokens.bg}
        />
      )}

      {/* Minimal Top-Right Icon-Only Share Action on Public Page */}
      {isPublicPage && displayHandle && (
        <div className={`w-full ${pageMaxWidthClass} flex justify-end mb-2 relative z-10`}>
          <button
            type="button"
            onClick={handleShareClick}
            aria-label="Share this profile"
            title="Share profile"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            style={{
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
              fontFamily: buttonFontFamily,
              border: `1px solid ${tokens.buttonBorder || 'rgba(0,0,0,0.1)'}`,
            }}
          >
            <Share2 size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      <div
        className={`w-full ${pageMaxWidthClass} flex-1 flex flex-col relative z-10 ${
          isLeftHeader ? 'items-start' : 'items-center'
        }`}
      >
        {/* Hero Banner Strip when header === 'hero' */}
        {isHeroHeader && (
          <div
            aria-hidden="true"
            className="w-full relative overflow-hidden"
            style={{
              height: `${Math.round(92 * scale)}px`,
              borderRadius: `${Math.round(16 * scale)}px`,
              marginBottom: `-${Math.round(avatarPx * 0.42)}px`,
              background: `linear-gradient(135deg, ${accentHex}44 0%, ${tokens.text}18 100%)`,
              border: `1px solid ${tokens.text}18`,
            }}
          />
        )}

        {/* Header: Compact Row vs Centered/Editorial/Hero Stacked */}
        {(() => {
          const avatarCore = (
            <div
              className="overflow-hidden flex items-center justify-center shrink-0 font-medium"
              style={{
                width: `${avatarPx}px`,
                height: `${avatarPx}px`,
                borderRadius: avatarClip.borderRadius,
                clipPath: avatarClip.clipPath,
                boxShadow: avatarFrame === 'gradient-ring' ? undefined : avatarFrameShadow,
                transform: avatarFrame === 'sticker' ? 'rotate(-1.5deg)' : undefined,
                backgroundColor: tokens.avatarBg,
                color: tokens.avatarText,
                fontSize: `${Math.max(16, Math.round(avatarPx * 0.3))}px`,
              }}
            >
              {(profile?.avatarUrl ?? persona.avatarUrl) && !avatarError ? (
                <img
                  src={profile?.avatarUrl ?? persona.avatarUrl}
                  alt={displayName}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover block"
                />
              ) : (
                <span>{displayInitials}</span>
              )}
            </div>
          );

          const avatarNode =
            avatarFrame === 'gradient-ring' ? (
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  padding: `${Math.max(2, Math.round(3 * scale))}px`,
                  borderRadius: avatarClip.borderRadius,
                  background: `conic-gradient(from 0deg, ${accentHex}, ${tokens.text}, ${accentHex})`,
                  boxShadow: avatarGlowShadow,
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    padding: `${Math.max(1, Math.round(2 * scale))}px`,
                    borderRadius: avatarClip.borderRadius,
                    backgroundColor: resolvedV2?.bgProfile.meanHex || tokens.bg,
                  }}
                >
                  {avatarCore}
                </div>
              </div>
            ) : (
              avatarCore
            );

          const nameSizePx = resolvedV2
            ? Math.max(
                14,
                Math.round(
                  (resolvedV2.typography.name.size === 'l'
                    ? 24
                    : resolvedV2.typography.name.size === 's'
                      ? 16
                      : 20) * scale
                )
              )
            : Math.max(14, Math.round(17 * scale));

          const bioSizePx = resolvedV2
            ? Math.max(
                11,
                Math.round(
                  (resolvedV2.typography.bio.size === 'l'
                    ? 16
                    : resolvedV2.typography.bio.size === 's'
                      ? 12
                      : 14) * scale
                )
              )
            : Math.max(12, Math.round(13 * scale));

          const nameWeight = resolvedV2?.typography.name.weight || 600;
          const nameTracking =
            resolvedV2?.typography.name.tracking === 'wide'
              ? '0.04em'
              : resolvedV2?.typography.name.tracking === 'tight'
                ? '-0.025em'
                : '-0.01em';
          const nameUppercase = resolvedV2?.typography.name.case === 'upper';
          const bioLineHeight =
            resolvedV2?.typography.bio.lineHeight === 'compact'
              ? 1.35
              : resolvedV2?.typography.bio.lineHeight === 'relaxed'
                ? 1.75
                : 1.55;

          const metaTextBlock = (
            <div
              className={`w-full flex flex-col min-w-0 ${
                isCompactHeader || isLeftHeader
                  ? 'items-start text-left'
                  : 'items-center text-center'
              }`}
              style={{
                marginTop: isCompactHeader ? '0px' : `${Math.round(12 * scale)}px`,
                gap: `${Math.round(2 * scale)}px`,
              }}
            >
              {isPublicPage ? (
                <h1
                  className={`leading-tight max-w-full truncate ${
                    isCompactHeader || isLeftHeader ? '' : 'px-2'
                  } ${nameUppercase ? 'uppercase' : ''}`}
                  style={{
                    fontSize: `${nameSizePx}px`,
                    fontWeight: nameWeight,
                    letterSpacing: nameTracking,
                    color: tokens.text,
                    fontFamily: nameFontFamily,
                  }}
                >
                  {displayName}
                </h1>
              ) : (
                <div
                  className={`leading-tight max-w-full truncate ${
                    isCompactHeader || isLeftHeader ? '' : 'px-2'
                  } ${nameUppercase ? 'uppercase' : ''}`}
                  style={{
                    fontSize: `${nameSizePx}px`,
                    fontWeight: nameWeight,
                    letterSpacing: nameTracking,
                    color: tokens.text,
                    fontFamily: nameFontFamily,
                  }}
                >
                  {displayName}
                </div>
              )}

              <div
                className={`font-mono tracking-tight max-w-full inline-flex items-center gap-1.5 ${
                  isCompactHeader || isLeftHeader
                    ? 'justify-start text-left'
                    : 'justify-center text-center px-2'
                }`}
                style={{
                  fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
                  color: tokens.muted,
                }}
              >
                <span className="truncate">@{displayHandle}</span>
                {isVerified && (
                  <VerifiedTick
                    size={Math.max(13, Math.round(15 * scale))}
                    onDark={onDarkTick}
                  />
                )}
              </div>

              {displayBio && (
                <p
                  className={`${
                    isCompactHeader || isLeftHeader ? 'text-left' : 'text-center'
                  } max-w-[38ch] break-words`}
                  style={{
                    marginTop: `${Math.round(6 * scale)}px`,
                    fontSize: `${bioSizePx}px`,
                    fontWeight: resolvedV2?.typography.bio.weight || 400,
                    lineHeight: bioLineHeight,
                    color: tokens.muted,
                    fontFamily: bioFontFamily,
                  }}
                >
                  {displayBio}
                </p>
              )}
            </div>
          );

          if (isCompactHeader) {
            return (
              <div
                className="w-full flex items-center gap-3.5 text-left relative z-10"
                style={{ gap: `${Math.round(14 * scale)}px` }}
              >
                {avatarNode}
                {metaTextBlock}
              </div>
            );
          }

          return (
            <div
              className={`w-full flex flex-col relative z-10 ${
                isLeftHeader ? 'items-start' : 'items-center'
              }`}
            >
              {avatarNode}
              {metaTextBlock}
            </div>
          );
        })()}

      {/* Top Socials placement if configured ('top' or 'both') */}
      {(profile?.socialsPosition === 'top' || profile?.socialsPosition === 'both' || !profile?.socialsPosition) &&
        activeSocialEntries.length > 0 && (
        <div
          className={`flex items-center flex-wrap shrink-0 ${
            isLeftHeader || isCompactHeader ? 'justify-start' : 'justify-center'
          }`}
          style={{
            marginTop: `${Math.round(14 * scale)}px`,
            gap: `${Math.round(8 * scale)}px`,
          }}
        >
          {activeSocialEntries.map(([platform, url]) => {
            const cleanUrl = formatExternalUrl(url);
            const btnStyle = getSocialBtnStyle();
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={() => onSocialClick?.(platform, cleanUrl)}
                  onAuxClick={() => onSocialClick?.(platform, cleanUrl)}
                  aria-label={platform}
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  className="flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                  style={btnStyle}
                >
                  <SocialIcon platform={platform} size={Math.round(16 * scale)} />
                </a>
              );
            }
            return (
              <span
                key={platform}
                title={`${platform}: ${url}`}
                className="flex items-center justify-center transition-transform hover:scale-105"
                style={btnStyle}
              >
                <SocialIcon platform={platform} size={Math.round(16 * scale)} />
              </span>
            );
          })}
        </div>
      )}

      {/* Blocks Container */}
      <div
        className={
          linkLayout === 'grid2'
            ? 'w-full iveo-links-grid2'
            : linkLayout === 'chips'
              ? 'w-full flex flex-wrap items-center justify-center'
              : 'w-full flex flex-col'
        }
        style={{
          marginTop: `${Math.round(
            (activeSocialEntries.length > 0 &&
            (profile?.socialsPosition === 'top' || profile?.socialsPosition === 'both' || !profile?.socialsPosition)
              ? 18
              : 24) * scale
          )}px`,
          gap: `${linkGapPx}px`,
        }}
      >
        {displayBlocks.map((block, idx) => {
          // 1. Header
          if (block.kind === 'header') {
            return (
              <div
                key={block.id}
                className={`w-full col-span-full text-center font-semibold pt-2 pb-1 ${entranceClass}`}
                style={{
                  fontSize: `${Math.max(13, Math.round(15 * scale))}px`,
                  color: tokens.text,
                  fontFamily: nameFontFamily,
                  animationDelay: entranceClass ? `${Math.min(idx, 6) * 40}ms` : undefined,
                }}
              >
                {block.title}
              </div>
            );
          }

          // 2. Divider
          if (block.kind === 'divider') {
            return (
              <div
                key={block.id}
                className="w-full col-span-full my-1.5 flex items-center justify-center"
              >
                <div
                  className="w-full border-t opacity-30"
                  style={{
                    borderColor: tokens.buttonBorder || tokens.text,
                  }}
                />
              </div>
            );
          }

          // 3. Embed / Platform card or player
          if (block.kind === 'embed') {
            return (
              <div key={block.id} className="w-full col-span-full">
              <EmbedBlock
                block={block}
                vibe={effectiveVibe}
                effectiveRadius={effectiveRadius}
                embedMode={embedMode}
                activeEmbedId={activeEmbedId}
                onActivate={(id) => setActiveEmbedId(id)}
                fontFamily={buttonFontFamily}
                scale={scale}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
                pageCardLook={layout.cardLook}
                background={profile?.background}
                userAvatarUrl={profile?.avatarUrl ?? persona.avatarUrl ?? null}
                userDisplayName={displayName}
              />
              </div>
            );
          }

          // 3b. Bluesky Block (Profile, Feed, Single Post, Compact Button)
          if (block.kind === 'bluesky') {
            return (
              <div key={block.id} className="w-full col-span-full">
                <BlueskyBlock
                  block={block}
                  tokens={tokens}
                  effectiveRadius={effectiveRadius}
                  fontFamily={buttonFontFamily}
                  scale={scale}
                  isPublicPage={isPublicPage}
                  onLinkClick={onLinkClick}
                  surfaceStyle={buttonSurfaceStyle}
                />
              </div>
            );
          }

          // 4. Signup form
          if (block.kind === 'signup') {
            if (renderSignupForm && isPublicPage) {
              return (
                <div key={block.id} className="w-full col-span-full">
                  {renderSignupForm(block, buttonSurfaceStyle)}
                </div>
              );
            }

            // Placeholder card for preview mockups (matches live SignupFormBlock surfaceStyle & style 1:1)
            const cfg = block.signup;
            const collectMode = cfg?.collect || 'email';
            const formStyle = cfg?.style || 'classic';
            const buttonText = cfg?.button || 'Subscribe';
            const desc = cfg?.description;
            const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
            const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
            const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);
            const numBars = collectMode === 'both' ? 2 : 1;
            const isMinimal = formStyle === 'minimal';
            const isCompact = formStyle === 'compact';
            const isSpotlight = formStyle === 'spotlight';

            const previewContainerStyle: React.CSSProperties = isMinimal
              ? {
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${tokens.buttonBorder || buttonPalette.inputBorder}`,
                  borderRadius: `${cardRadius}px`,
                  padding: `${Math.round(14 * scale)}px`,
                  color: tokens.text,
                  fontFamily: buttonFontFamily,
                }
              : isSpotlight
                ? {
                    ...buttonSurfaceStyle,
                    borderRadius: `${cardRadius}px`,
                    padding: `${Math.round(16 * scale)}px`,
                    boxShadow: '0 10px 26px -8px rgba(0,0,0,0.22)',
                    color: buttonPalette.fg,
                    fontFamily: buttonFontFamily,
                  }
                : {
                    ...buttonSurfaceStyle,
                    borderRadius: `${cardRadius}px`,
                    padding: `${Math.round((isCompact ? 11 : 14) * scale)}px`,
                    color: buttonPalette.fg,
                    fontFamily: buttonFontFamily,
                  };

            const fgColor = isMinimal ? tokens.text : buttonPalette.fg;
            const mutedColor = isMinimal ? tokens.muted : buttonPalette.muted;
            const btnBg = isMinimal ? (tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg) : buttonPalette.btnBg;
            const btnText = isMinimal ? (tokens.buttonBg === 'transparent' ? tokens.bg : tokens.buttonText) : buttonPalette.btnText;

            return (
              <div
                key={block.id}
                className={`w-full col-span-full overflow-hidden flex flex-col select-none ${
                  isCompact || isMinimal ? 'items-start text-left' : 'items-center text-center'
                }`}
                style={previewContainerStyle}
              >
                {isSpotlight ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 mb-1.5 rounded-full font-semibold uppercase tracking-wider"
                    style={{
                      fontSize: `${Math.max(8, Math.round(9 * scale))}px`,
                      backgroundColor: `${buttonPalette.btnBg}1F`,
                      color: fgColor,
                      border: `1px solid ${buttonPalette.inputBorder}`,
                    }}
                  >
                    Stay updated
                  </span>
                ) : !isCompact && !isMinimal ? (
                  <div
                    className="flex items-center justify-center opacity-80"
                    style={{ marginBottom: `${Math.round(6 * scale)}px` }}
                  >
                    <Mail size={Math.round(20 * scale)} strokeWidth={1.5} />
                  </div>
                ) : null}

                <h3
                  className="font-semibold leading-tight w-full"
                  style={{
                    fontSize: `${Math.max(12, Math.round((isSpotlight ? 16 : isCompact ? 14 : 15) * scale))}px`,
                    color: fgColor,
                  }}
                >
                  {cfg?.heading || block.title}
                </h3>
                {desc && (
                  <p
                    className="mt-1 w-full"
                    style={{
                      fontSize: `${Math.max(10, Math.round(12 * scale))}px`,
                      color: mutedColor,
                    }}
                  >
                    {desc}
                  </p>
                )}

                {isCompact && collectMode !== 'both' ? (
                  <div className="w-full flex items-center gap-1.5 mt-2.5" aria-hidden="true">
                    <div
                      className="flex-1 min-w-0"
                      style={{
                        height: `${Math.round(34 * scale)}px`,
                        borderRadius: `${innerRadius}px`,
                        backgroundColor: buttonPalette.inputBg,
                        border: `1px solid ${buttonPalette.inputBorder}`,
                      }}
                    />
                    <div
                      className="px-3 flex items-center justify-center font-medium shrink-0 truncate"
                      style={{
                        height: `${Math.round(34 * scale)}px`,
                        backgroundColor: btnBg,
                        color: btnText,
                        borderRadius: `${controlRadius}px`,
                        fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
                      }}
                    >
                      {buttonText}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full flex flex-col gap-2 my-2.5" aria-hidden="true">
                      {Array.from({ length: numBars }).map((_, barIdx) => (
                        <div
                          key={barIdx}
                          className="w-full"
                          style={{
                            height: `${Math.round(36 * scale)}px`,
                            borderRadius: isMinimal ? '0px' : `${innerRadius}px`,
                            backgroundColor: isMinimal ? 'transparent' : buttonPalette.inputBg,
                            border: isMinimal ? 'none' : `1px solid ${buttonPalette.inputBorder}`,
                            borderBottom: isMinimal ? `1.5px solid ${buttonPalette.inputBorder}` : `1px solid ${buttonPalette.inputBorder}`,
                          }}
                        />
                      ))}
                    </div>
                    <div
                      className="w-full flex items-center justify-center font-medium truncate"
                      style={{
                        height: `${Math.round((isSpotlight ? 40 : 36) * scale)}px`,
                        backgroundColor: btnBg,
                        color: btnText,
                        borderRadius: `${controlRadius}px`,
                        fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
                      }}
                    >
                      {buttonText}
                    </div>
                  </>
                )}
              </div>
            );
          }

          // 4b. Tip Jar Block
          if (block.kind === 'tip_jar' && block.tipJar) {
            return (
              <div key={block.id} className="w-full">
                <TipJarBlock
                  config={block.tipJar}
                  tokens={tokens}
                  buttonRadius={effectiveRadius}
                  fontFamily={buttonFontFamily}
                  scale={scale}
                  surfaceStyle={buttonSurfaceStyle}
                  onAction={isPublicPage ? () => onLinkClick?.(block) : undefined}
                />
              </div>
            );
          }

          // 4c. FAQ Accordion Block
          if (block.kind === 'faq' && block.faq) {
            return (
              <div key={block.id} className="w-full">
                <FaqBlock
                  title={block.title}
                  config={block.faq}
                  tokens={tokens}
                  buttonRadius={effectiveRadius}
                  fontFamily={buttonFontFamily}
                  scale={scale}
                  surfaceStyle={buttonSurfaceStyle}
                />
              </div>
            );
          }

          // 4d. Contact Card (vCard) Block
          if (block.kind === 'vcard' && block.vcard) {
            return (
              <div key={block.id} className="w-full">
                <VCardBlock
                  config={block.vcard}
                  tokens={tokens}
                  buttonRadius={effectiveRadius}
                  fontFamily={buttonFontFamily}
                  scale={scale}
                  surfaceStyle={buttonSurfaceStyle}
                  onAction={isPublicPage ? () => onLinkClick?.(block) : undefined}
                />
              </div>
            );
          }

          // 4e. Buy Me a Coffee Block
          if (block.kind === 'coffee') {
            return (
              <div key={block.id} className="w-full col-span-full">
                <CoffeeCardBlock
                  block={block}
                  vibe={effectiveVibe}
                  effectiveRadius={effectiveRadius}
                  embedMode={embedMode}
                  fontFamily={buttonFontFamily}
                  scale={scale}
                  onLinkClick={onLinkClick}
                  surfaceStyle={buttonSurfaceStyle}
                  pageCardLook={layout.cardLook}
                  background={profile?.background}
                  userAvatarUrl={profile?.avatarUrl ?? persona.avatarUrl ?? null}
                  userDisplayName={displayName}
                />
              </div>
            );
          }

          // 4f. Instagram Showcase Block (use EmbedBlock whenever embedMeta or custom page Card Look is active)
          if (block.kind === 'instagram') {
            if (block.embedMeta || layout.cardLook !== 'match_page') {
              const normalizedIgBlock: PageBlock = {
                ...block,
                embedProvider: 'instagram',
                embedMeta: {
                  provider: 'instagram',
                  subtype: 'profile',
                  title: block.title || 'Instagram',
                  subtitle: block.badge || 'Follow for stories & updates',
                  ctaLabel: 'Follow',
                  displayAs: 'card',
                  ...(block.embedMeta || {}),
                },
              };
              return (
                <div key={block.id} className="w-full">
                  <EmbedBlock
                    block={normalizedIgBlock}
                    vibe={vibe}
                    effectiveRadius={effectiveRadius}
                    embedMode={embedMode}
                    activeEmbedId={activeEmbedId}
                    onActivate={(id) =>
                      setActiveEmbedId((prev) => (prev === id ? null : id))
                    }
                    fontFamily={buttonFontFamily}
                    scale={scale}
                    onLinkClick={onLinkClick}
                    surfaceStyle={buttonSurfaceStyle}
                    pageCardLook={layout.cardLook}
                    background={profile?.background}
                    userAvatarUrl={profile?.avatarUrl ?? persona.avatarUrl ?? null}
                    userDisplayName={displayName}
                  />
                </div>
              );
            }

            const igUrl = block.url ? formatExternalUrl(block.url) : 'https://instagram.com';
            const barRadius = resolveCardBorderRadius(effectiveRadius, scale, 'bar');
            const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
            const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);
            const igFg = buttonPalette.fg;
            const ctaBg = buttonPalette.btnBg;
            const ctaColor = buttonPalette.btnText;
            const igHorizPad = effectiveRadius >= 999 ? Math.round(16 * scale) : Math.round(12 * scale);

            return (
              <div
                key={block.id}
                className="w-full overflow-hidden flex items-center justify-between gap-2.5 transition-all duration-150 select-none"
                style={{
                  ...buttonSurfaceStyle,
                  color: igFg,
                  fontFamily: buttonFontFamily,
                  borderRadius: `${barRadius}px`,
                  padding: `${Math.round(10 * scale)}px ${igHorizPad}px`,
                }}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
                  <div
                    className="w-8 h-8 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{
                      borderRadius: effectiveRadius >= 999 ? '9999px' : `${innerRadius}px`,
                    }}
                  >
                    <Instagram size={16} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="font-semibold truncate text-[13px] leading-tight"
                      style={{ color: igFg }}
                    >
                      {block.title || 'Instagram'}
                    </span>
                    <span className="text-[11px] opacity-75 truncate">
                      {block.badge || 'Follow for stories & updates'}
                    </span>
                  </div>
                </div>

                {isPublicPage ? (
                  <a
                    href={igUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLinkClick?.(block)}
                    className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap transition-transform active:scale-95"
                    style={{
                      backgroundColor: ctaBg,
                      color: ctaColor,
                      borderRadius: `${controlRadius}px`,
                    }}
                  >
                    Follow
                  </a>
                ) : (
                  <span
                    className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap"
                    style={{
                      backgroundColor: ctaBg,
                      color: ctaColor,
                      borderRadius: `${controlRadius}px`,
                    }}
                  >
                    Follow
                  </span>
                )}
              </div>
            );
          }

          // 4g. YouTube Showcase Block (use EmbedBlock whenever embedMeta or custom page Card Look is active)
          if (block.kind === 'youtube') {
            if (block.embedMeta || layout.cardLook !== 'match_page') {
              const yt = block.youtube;
              const normalizedYtBlock: PageBlock = {
                ...block,
                embedProvider: 'youtube',
                embedMeta: {
                  provider: 'youtube',
                  subtype: block.embedMeta?.subtype || 'channel',
                  title: yt?.channelTitle || block.title || 'YouTube',
                  handle: yt?.handle || null,
                  subtitle: yt?.handle || block.badge || null,
                  description: yt?.description || null,
                  avatarUrl: yt?.avatarUrl || null,
                  statsLabel: yt?.subscriberText || null,
                  ctaLabel: yt?.buttonLabel || 'Subscribe',
                  displayAs: block.embedMeta?.displayAs || 'card',
                  ...(block.embedMeta || {}),
                },
              };
              return (
                <div key={block.id} className="w-full">
                  <EmbedBlock
                    block={normalizedYtBlock}
                    vibe={vibe}
                    effectiveRadius={effectiveRadius}
                    embedMode={embedMode}
                    activeEmbedId={activeEmbedId}
                    onActivate={(id) =>
                      setActiveEmbedId((prev) => (prev === id ? null : id))
                    }
                    fontFamily={buttonFontFamily}
                    scale={scale}
                    onLinkClick={onLinkClick}
                    surfaceStyle={buttonSurfaceStyle}
                    pageCardLook={layout.cardLook}
                    background={profile?.background}
                    userAvatarUrl={profile?.avatarUrl ?? persona.avatarUrl ?? null}
                    userDisplayName={displayName}
                  />
                </div>
              );
            }

            return (
              <YouTubeShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4h. Product / Merch Card
          if (block.kind === 'product' && block.product) {
            return (
              <ProductShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4i. 1:1 Booking Card
          if (block.kind === 'booking' && block.booking) {
            return (
              <BookingShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4j. Event / Drop Countdown
          if (block.kind === 'countdown' && block.countdown) {
            return (
              <CountdownShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4k. Promo / Coupon Code
          if (block.kind === 'promo' && block.promo) {
            return (
              <PromoShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4l. Studio / Store Location Card
          if (block.kind === 'location' && block.location) {
            return (
              <LocationShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 4m. Download / Media Kit Card
          if (block.kind === 'download' && block.download) {
            return (
              <DownloadShowcaseCard
                key={block.id}
                block={block}
                tokens={tokens}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isPublicPage={isPublicPage}
                onLinkClick={onLinkClick}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          const isProtected = block.isProtected === true || (protectedIds?.has(block.id) ?? false);

          // 5. Featured link
          if (block.layout === 'featured' && block.thumbnailUrl) {
            imageCounter++;
            const isEager = imageCounter <= 2;
            return (
              <FeaturedLink
                key={block.id}
                block={block}
                vibe={effectiveVibe}
                effectiveRadius={effectiveRadius}
                fontFamily={buttonFontFamily}
                scale={scale}
                isInteractive={isPublicPage}
                isEager={isEager}
                isProtected={isProtected}
                onLinkClick={onLinkClick}
                onUnlock={onUnlock}
                surfaceStyle={buttonSurfaceStyle}
              />
            );
          }

          // 6. Classic link (with uploaded thumbnail or automatic site favicon + fallback icon, plus optional lock)
          const effectiveThumbUrl = block.thumbnailUrl || (block.thumbnailPath ? storagePublicUrl(block.thumbnailPath) : null);
          const hasThumb = Boolean(effectiveThumbUrl);
          if (hasThumb) imageCounter++;
          const isEager = hasThumb && imageCounter <= 2;
          const thumbSize = isPublicPage ? 40 : Math.round(32 * scale);
          const thumbRadius =
            effectiveRadius >= 999
              ? 9999
              : resolveCardBorderRadius(effectiveRadius, 1, 'inner');
          const lockSize = isPublicPage ? 16 : Math.round(14 * scale);
          const barRadius = resolveCardBorderRadius(effectiveRadius, scale, 'bar');

          // Space reservation for centered text with favicon/thumb on left and optional lock on right
          const baseSidePad = effectiveRadius >= 999 ? Math.round(18 * scale) : Math.round(14 * scale);
          const iconSidePad = Math.max(baseSidePad, Math.round(36 * scale));
          const sidePadding = isProtected
            ? Math.max(hasThumb ? thumbSize + 18 : Math.round(38 * scale), Math.round(38 * scale))
            : hasThumb
            ? thumbSize + 18
            : iconSidePad;

          const animClass =
            block.animation === 'pulse'
              ? 'animate-pulse'
              : block.animation === 'bounce'
              ? 'hover:animate-bounce'
              : '';

          const glowOverride =
            block.animation === 'glow'
              ? `0 0 16px ${tokens.text}40`
              : undefined;

          const v2BtnCss = resolvedV2
            ? buildButtonSurfaceCss({
                surface: resolvedV2.buttons.surface,
                fill: resolvedV2.buttons.fill,
                text: resolvedV2.buttons.text,
                border: resolvedV2.buttons.border,
                borderWidth: resolvedV2.buttons.borderWidth,
                shadow: resolvedV2.buttons.shadow,
                gradient: resolvedV2.buttons.gradient,
                bgProfile: resolvedV2.bgProfile,
                index: idx,
              })
            : null;

          const classicSurfaceStyle: React.CSSProperties = v2BtnCss
            ? {
                backgroundColor: v2BtnCss.backgroundColor,
                ...(v2BtnCss.backgroundImage ? { backgroundImage: v2BtnCss.backgroundImage } : {}),
                ...(v2BtnCss.backgroundSize ? { backgroundSize: v2BtnCss.backgroundSize } : {}),
                color: v2BtnCss.color,
                border: v2BtnCss.border,
                ...(v2BtnCss.borderBottom ? { borderBottom: v2BtnCss.borderBottom } : {}),
                boxShadow: glowOverride || v2BtnCss.boxShadow,
                ...(v2BtnCss.backdropFilter
                  ? { backdropFilter: v2BtnCss.backdropFilter, WebkitBackdropFilter: v2BtnCss.backdropFilter }
                  : {}),
                ...(v2BtnCss.textShadow ? { textShadow: v2BtnCss.textShadow } : {}),
                ...(v2BtnCss.transform ? { transform: v2BtnCss.transform } : {}),
                ...(v2BtnCss.fallbackBgCss ? ({ '--iveo-glass-fallback': v2BtnCss.fallbackBgCss } as React.CSSProperties) : {}),
              }
            : getButtonSurfaceStyle(glowOverride);

          const isChips = linkLayout === 'chips';
          const btnHeightPx = resolvedV2
            ? isChips
              ? Math.round(38 * scale)
              : Math.round(resolvedV2.buttons.heightPx * scale)
            : Math.round(44 * scale);

          const btnFontSizePx = resolvedV2
            ? Math.max(12, Math.round(resolvedV2.buttons.fontSizePx * scale))
            : Math.max(12, Math.round(14 * scale));

          const btnWeight = resolvedV2?.buttons.weight || resolvedV2?.typography.button.weight || 500;
          const btnTracking =
            resolvedV2?.buttons.tracking === 'wide'
              ? '0.05em'
              : resolvedV2?.buttons.tracking === 'tight'
                ? '-0.02em'
                : undefined;
          const btnUpper = resolvedV2?.buttons.case === 'upper';
          const btnAlign = resolvedV2?.buttons.align || 'center';
          const btnIconPos = resolvedV2?.buttons.icon || 'left';
          const isGlassSurface = resolvedV2?.buttons.surface === 'glass';
          const isUnderlineSurface = resolvedV2?.buttons.surface === 'underline-only';
          const motionCls =
            resolvedV2?.buttons.motion && resolvedV2.buttons.motion !== 'none'
              ? `iveo-btn-motion-${resolvedV2.buttons.motion}`
              : '';

          const effectiveSidePad = isChips
            ? Math.round(14 * scale)
            : btnIconPos === 'none'
              ? Math.round((resolvedV2?.buttons.paddingXPx ?? 20) * scale)
              : sidePadding;

          const innerButton = (
            <div
              className={`relative flex items-center truncate transition-all duration-150 select-none ${
                isChips ? 'w-auto max-w-full gap-2' : 'w-full'
              } ${
                btnAlign === 'left' && btnIconPos !== 'right'
                  ? 'justify-start'
                  : btnAlign === 'left'
                    ? 'justify-between'
                    : 'justify-center'
              } ${isGlassSurface ? 'iveo-btn-glass' : ''} ${motionCls} ${animClass} ${
                btnUpper ? 'uppercase' : ''
              }`}
              style={{
                height: `${btnHeightPx}px`,
                paddingLeft: `${effectiveSidePad}px`,
                paddingRight: `${effectiveSidePad}px`,
                ...classicSurfaceStyle,
                fontFamily: buttonFontFamily,
                borderRadius: isUnderlineSurface ? '0px' : `${barRadius}px`,
                fontSize: `${btnFontSizePx}px`,
                fontWeight: btnWeight,
                letterSpacing: btnTracking,
              }}
            >
              {/* Badge if specified */}
              {block.badge && (
                <span
                  className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm pointer-events-none z-10"
                  style={{
                    backgroundColor: buttonPalette.btnBg,
                    color: buttonPalette.btnText,
                    border: `1px solid ${tokens.buttonBorder || 'transparent'}`,
                  }}
                >
                  {block.badge}
                </span>
              )}

              {/* Left thumbnail or icon */}
              {btnIconPos === 'left' && !isChips && (
                hasThumb ? (
                  <div
                    className="absolute left-2 top-1/2 -translate-y-1/2 overflow-hidden flex items-center justify-center bg-black/5"
                    style={{
                      width: `${thumbSize}px`,
                      height: `${thumbSize}px`,
                      borderRadius: `${thumbRadius}px`,
                    }}
                  >
                    <img
                      src={effectiveThumbUrl!}
                      alt=""
                      loading={isEager ? 'eager' : 'lazy'}
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover block"
                    />
                  </div>
                ) : (
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center shrink-0"
                    style={{ width: `${Math.round(18 * scale)}px`, height: `${Math.round(18 * scale)}px` }}
                  >
                    <LinkFaviconOrFallback
                      url={block.url}
                      size={Math.round(16 * scale)}
                      className="opacity-85"
                    />
                  </span>
                )
              )}

              {btnIconPos !== 'none' && isChips && (
                <span className="flex items-center justify-center shrink-0">
                  <LinkFaviconOrFallback
                    url={block.url}
                    size={Math.round(14 * scale)}
                    className="opacity-85"
                  />
                </span>
              )}

              <span className={`truncate leading-none ${btnAlign === 'left' ? 'text-left' : 'text-center px-2'}`}>
                {block.title}
              </span>

              {/* Right icon slot (custom right icon, underline trailing arrow, or lock) */}
              {isProtected ? (
                <span
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center shrink-0 opacity-80"
                  style={{ color: String(classicSurfaceStyle.color || tokens.buttonText) }}
                  aria-hidden="true"
                >
                  <Lock size={lockSize} strokeWidth={1.5} />
                </span>
              ) : isUnderlineSurface || (btnIconPos === 'right' && !isChips) ? (
                <span
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center shrink-0 opacity-80"
                  style={{ color: String(classicSurfaceStyle.color || tokens.buttonText) }}
                  aria-hidden="true"
                >
                  <ArrowUpRight size={Math.round(15 * scale)} strokeWidth={1.75} />
                </span>
              ) : null}
            </div>
          );

          const outerMotionWrap = entranceClass
            ? { animationDelay: `${Math.min(idx, 6) * 40}ms` }
            : undefined;

          // Protected link: NEVER render as <a>! Render as interactive button on public page
          if (isProtected) {
            if (isPublicPage) {
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => onUnlock?.(block)}
                  aria-haspopup="dialog"
                  aria-label={`${block.title}, password protected`}
                  className={`${isChips ? 'inline-flex' : 'w-full block'} transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer ${entranceClass}`}
                  style={{ borderRadius: `${barRadius}px`, ...outerMotionWrap }}
                >
                  {innerButton}
                </button>
              );
            }
            return (
              <div key={block.id} className={`${isChips ? 'inline-flex' : 'w-full'} ${entranceClass}`} style={outerMotionWrap}>
                {innerButton}
              </div>
            );
          }

          // Normal classic link
          if (isPublicPage && block.url) {
            return (
              <a
                key={block.id}
                href={formatExternalUrl(block.url)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => onLinkClick?.(block)}
                onAuxClick={() => onLinkClick?.(block)}
                className={`${isChips ? 'inline-flex' : 'w-full block'} transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 ${entranceClass}`}
                style={{ borderRadius: `${barRadius}px`, ...outerMotionWrap }}
              >
                {innerButton}
              </a>
            );
          }

          return (
            <div key={block.id} className={`${isChips ? 'inline-flex' : 'w-full'} ${entranceClass}`} style={outerMotionWrap}>
              {innerButton}
            </div>
          );
        })}
      </div>

      {/* Social Row: Rendered at bottom if user configured bottom or both placement */}
      {(profile?.socialsPosition === 'bottom' || profile?.socialsPosition === 'both') &&
        activeSocialEntries.length > 0 && (
        <div
          className="flex items-center justify-center flex-wrap shrink-0"
          style={{
            marginTop: `${Math.round(20 * scale)}px`,
            gap: `${Math.round(8 * scale)}px`,
          }}
        >
          {activeSocialEntries.map(([platform, url]) => {
            const cleanUrl = formatExternalUrl(url);
            const btnStyle = getSocialBtnStyle();
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={() => onSocialClick?.(platform, cleanUrl)}
                  onAuxClick={() => onSocialClick?.(platform, cleanUrl)}
                  aria-label={platform}
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  className="flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                  style={btnStyle}
                >
                  <SocialIcon platform={platform} size={Math.round(16 * scale)} />
                </a>
              );
            }
            return (
              <span
                key={platform}
                title={`${platform}: ${url}`}
                className="flex items-center justify-center transition-transform hover:scale-105"
                style={btnStyle}
              >
                <SocialIcon platform={platform} size={Math.round(16 * scale)} />
              </span>
            );
          })}
        </div>
      )}

      {/* Footer Area */}
      <div
        className="w-full flex flex-col items-center justify-center shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] mt-auto"
        style={{
          paddingTop: `${Math.round(28 * scale)}px`,
          gap: `${Math.round(6 * scale)}px`,
        }}
      >
        {/* Refined and small iveo mark at the bottom */}
        {!hideFooterMark && (() => {
          const footerIsDark = !isLightHexColor(tokens.bg) || isDarkBackgroundConfig(profile?.background);
          return (
            <a
              href="https://iveo.site"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity duration-150 select-none group"
              aria-label="iveo"
            >
              <img
                src={SITE_LOGO_SRC}
                alt=""
                className="h-3.5 w-auto rounded-[3px] object-contain transition-transform group-hover:scale-105"
              />
              <img
                src={SITE_WORDMARK_SRC}
                alt="iveo"
                className={`h-2.5 w-auto object-contain ${footerIsDark ? 'brightness-0 invert' : ''}`}
              />
            </a>
          );
        })()}

        {/* Clean borderless inline public footer links */}
        {isPublicPage && (
          <nav
            aria-label="Page footer links"
            className="w-full max-w-[460px] flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0 text-[11.5px] font-medium select-none"
            style={{
              fontFamily: buttonFontFamily,
              color: tokens.text,
            }}
          >
            <a
              href="https://iveo.site/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 opacity-65 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 bg-transparent border-0"
            >
              Create your page
            </a>

            {displayHandle && !profile?.isOwnerProfile && (
              <>
                <span aria-hidden="true" className="opacity-35 select-none">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 opacity-65 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 bg-transparent border-0 cursor-pointer"
                >
                  Report
                </button>
              </>
            )}

            <span aria-hidden="true" className="opacity-35 select-none">
              ·
            </span>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 opacity-65 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 bg-transparent border-0"
            >
              Terms
            </a>

            <span aria-hidden="true" className="opacity-35 select-none">
              ·
            </span>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 opacity-65 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 bg-transparent border-0"
            >
              Privacy
            </a>
          </nav>
        )}
      </div>
      </div>

      {/* WhatsApp Direct Chat Floating Widget (when configured in Integrations) */}
      {isPublicPage && profile?.whatsappNumber && (() => {
        const cleanDigits = profile.whatsappNumber.replace(/[^\d]/g, '');
        if (cleanDigits.length < 7) return null;
        return (
          <a
            href={`https://wa.me/${cleanDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onWhatsAppClick?.(cleanDigits)}
            aria-label="Chat on WhatsApp"
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] text-white font-semibold text-[13px] shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            <MessageCircle size={18} strokeWidth={2.2} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        );
      })()}

      {/* Enhanced Share Bottom Sheet Dialog with Business Card & Embed Styles */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        username={displayHandle}
        displayName={displayName}
        bio={displayBio}
        avatarUrl={!avatarError && (profile?.avatarUrl ?? persona.avatarUrl) ? (profile?.avatarUrl ?? persona.avatarUrl) : null}
        vibe={effectiveVibe}
        socials={profile?.socials}
        businessCard={profile?.businessCard}
        isPro={isVerified}
        isOwner={isOwner}
      />

      {/* Embedded Formspree Report Modal */}
      {isPublicPage && displayHandle && !profile?.isOwnerProfile && (
        <ReportPageModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          username={displayHandle}
          displayName={displayName}
          vibe={effectiveVibe}
        />
      )}
    </div>
  );
};

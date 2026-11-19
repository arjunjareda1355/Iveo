import React, { useState } from 'react';
import {
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
  renderSignupForm?: (block: PageBlock) => React.ReactNode;
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
  const tokens = resolveEffectiveTokens(
    vibe.tokens,
    profile?.buttonColors,
    profile?.background
  );
  const effectiveVibe: Vibe = { ...vibe, tokens };
  const isVerified = Boolean(profile?.isVerified ?? profile?.isPro);
  const onDarkTick = !isLightHexColor(tokens.bg) || isDarkBackgroundConfig(profile?.background);

  const nameFontFamily = getFontCssFamily(
    profile?.fontSettings?.nameFont,
    vibe.fontFamily
  );
  const bioFontFamily = getFontCssFamily(
    profile?.fontSettings?.bioFont,
    vibe.fontFamily
  );
  const buttonFontFamily = getFontCssFamily(
    profile?.fontSettings?.buttonFont,
    vibe.fontFamily
  );

  const effectiveRadius =
    buttonRadiusOverride !== undefined ? buttonRadiusOverride : tokens.buttonRadius;

  const layout = {
    avatarShape: profile?.layoutSettings?.avatarShape || DEFAULT_LAYOUT_SETTINGS.avatarShape,
    headerAlign: profile?.layoutSettings?.headerAlign || DEFAULT_LAYOUT_SETTINGS.headerAlign,
    buttonStyle: profile?.layoutSettings?.buttonStyle || DEFAULT_LAYOUT_SETTINGS.buttonStyle,
    linkSpacing: profile?.layoutSettings?.linkSpacing || DEFAULT_LAYOUT_SETTINGS.linkSpacing,
    pageWidth: profile?.layoutSettings?.pageWidth || DEFAULT_LAYOUT_SETTINGS.pageWidth,
  };

  const avatarRadiusCss =
    layout.avatarShape === 'squircle'
      ? `${Math.round(20 * scale)}px`
      : layout.avatarShape === 'rounded'
        ? `${Math.round(12 * scale)}px`
        : '9999px';

  const avatarRingShadow =
    layout.avatarShape === 'ring'
      ? `0 0 0 ${Math.max(2, Math.round(2.5 * scale))}px ${tokens.bg}, 0 0 0 ${Math.max(4, Math.round(5 * scale))}px ${tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg}`
      : undefined;

  const linkGapPx =
    layout.linkSpacing === 'compact'
      ? Math.round(6 * scale)
      : layout.linkSpacing === 'airy'
        ? Math.round(16 * scale)
        : Math.round(10 * scale);

  const pageMaxWidthClass =
    layout.pageWidth === 'compact'
      ? 'max-w-[440px]'
      : layout.pageWidth === 'wide'
        ? 'max-w-[660px]'
        : 'max-w-[540px]';

  const getButtonSurfaceStyle = (overrideGlow?: string): React.CSSProperties => {
    const baseBorder = tokens.buttonBorder
      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
      : '1px solid rgba(0,0,0,0.08)';
    switch (layout.buttonStyle) {
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: tokens.text,
          border: `1.5px solid ${tokens.buttonBorder || tokens.text}`,
          boxShadow: overrideGlow || 'none',
        };
      case 'soft':
        return {
          backgroundColor: `${tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg}20`,
          color: tokens.text,
          border: `1px solid ${tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg}33`,
          boxShadow: overrideGlow || 'none',
        };
      case 'offset':
        return {
          backgroundColor: tokens.buttonBg,
          color: tokens.buttonText,
          border: `1.5px solid ${tokens.buttonBorder || tokens.text}`,
          boxShadow: overrideGlow || `${Math.max(2, Math.round(3 * scale))}px ${Math.max(2, Math.round(3 * scale))}px 0px ${tokens.text}`,
        };
      case 'glass':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.16)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: tokens.text,
          border: `1px solid ${tokens.text}28`,
          boxShadow: overrideGlow || '0 4px 16px rgba(0, 0, 0, 0.08)',
        };
      case 'gradient':
        return {
          background: `linear-gradient(135deg, ${tokens.buttonBg === 'transparent' ? '#0A0A0A' : tokens.buttonBg} 0%, ${tokens.buttonBorder || '#6366F1'} 100%)`,
          color: tokens.buttonText,
          border: tokens.buttonBorder ? baseBorder : 'none',
          boxShadow: overrideGlow || tokens.buttonShadow || '0 4px 14px rgba(0,0,0,0.12)',
        };
      case 'solid':
      default:
        return {
          backgroundColor: tokens.buttonBg,
          color: tokens.buttonText,
          border: tokens.buttonBorder ? baseBorder : 'none',
          boxShadow: overrideGlow || tokens.buttonShadow || 'none',
        };
    }
  };

  const buttonSurfaceStyle = getButtonSurfaceStyle();
  const socialBorderRadiusCss =
    effectiveRadius >= 999
      ? '9999px'
      : effectiveRadius <= 0
        ? '0px'
        : `${Math.round(Math.max(6, Math.min(12, effectiveRadius)) * scale)}px`;
  const isLeftHeader = layout.headerAlign === 'left';

  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Load any customized Google Fonts used on this page
  React.useEffect(() => {
    loadGoogleFonts([
      profile?.fontSettings?.nameFont,
      profile?.fontSettings?.bioFont,
      profile?.fontSettings?.buttonFont,
      profile?.businessCard?.fontId,
    ]);
  }, [
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
    : persona.links.map((linkTitle, idx) => ({
        id: `persona-${idx}`,
        kind: 'link',
        title: linkTitle,
        url: 'https://iveo.site',
        layout: 'classic',
        isActive: true,
        isArchived: false,
        position: idx,
      }));

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
        {/* Avatar */}
        <div
          className="overflow-hidden flex items-center justify-center shrink-0 font-medium"
          style={{
            width: `${Math.round(72 * scale)}px`,
            height: `${Math.round(72 * scale)}px`,
            borderRadius: avatarRadiusCss,
            boxShadow: avatarRingShadow,
            backgroundColor: tokens.avatarBg,
            color: tokens.avatarText,
            fontSize: `${Math.round(22 * scale)}px`,
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

        {/* Name & Handle */}
        <div
          className={`w-full flex flex-col ${
            isLeftHeader ? 'items-start text-left' : 'items-center text-center'
          }`}
          style={{
            marginTop: `${Math.round(12 * scale)}px`,
            gap: `${Math.round(2 * scale)}px`,
          }}
        >
          <h1
            className={`font-medium tracking-tight leading-tight max-w-full truncate ${
              isLeftHeader ? '' : 'px-2'
            }`}
            style={{
              fontSize: `${Math.max(14, Math.round(17 * scale))}px`,
              color: tokens.text,
              fontFamily: nameFontFamily,
            }}
          >
            {displayName}
          </h1>

          <div
            className={`font-mono tracking-tight max-w-full inline-flex items-center gap-1.5 ${
              isLeftHeader ? 'justify-start text-left' : 'justify-center text-center px-2'
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
        </div>

        {/* Bio */}
        {displayBio && (
          <p
            className={`${
              isLeftHeader ? 'text-left' : 'text-center'
            } font-normal leading-relaxed max-w-[34ch] break-words`}
            style={{
              marginTop: `${Math.round(8 * scale)}px`,
              fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
              color: tokens.muted,
              fontFamily: bioFontFamily,
            }}
          >
            {displayBio}
          </p>
        )}

      {/* Top Socials placement if configured ('top' or 'both') */}
      {(profile?.socialsPosition === 'top' || profile?.socialsPosition === 'both' || !profile?.socialsPosition) &&
        activeSocialEntries.length > 0 && (
        <div
          className={`flex items-center flex-wrap shrink-0 ${
            isLeftHeader ? 'justify-start' : 'justify-center'
          }`}
          style={{
            marginTop: `${Math.round(14 * scale)}px`,
            gap: `${Math.round(8 * scale)}px`,
          }}
        >
          {activeSocialEntries.map(([platform, url]) => {
            const cleanUrl = formatExternalUrl(url);
            const btnStyle: React.CSSProperties = {
              width: `${Math.round(36 * scale)}px`,
              height: `${Math.round(36 * scale)}px`,
              borderRadius: socialBorderRadiusCss,
              ...buttonSurfaceStyle,
              border: buttonSurfaceStyle.border || `1px solid ${tokens.text}1A`,
            };
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
        className="w-full flex flex-col"
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
                className="w-full text-center font-semibold pt-2 pb-1"
                style={{
                  fontSize: `${Math.max(13, Math.round(15 * scale))}px`,
                  color: tokens.text,
                  fontFamily: nameFontFamily,
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
                className="w-full my-1.5 flex items-center justify-center"
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

          // 3. Embed
          if (block.kind === 'embed') {
            return (
              <EmbedBlock
                key={block.id}
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
              />
            );
          }

          // 4. Signup form
          if (block.kind === 'signup') {
            if (renderSignupForm && isPublicPage) {
              return (
                <div key={block.id} className="w-full">
                  {renderSignupForm(block)}
                </div>
              );
            }

            // Placeholder card for preview mockups
            const cfg = block.signup;
            const collectMode = cfg?.collect || 'email';
            const buttonText = cfg?.button || 'Subscribe';
            const desc = cfg?.description;
            const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
            const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
            const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);
            const numBars = collectMode === 'both' ? 2 : 1;

            return (
              <div
                key={block.id}
                className="w-full overflow-hidden flex flex-col items-center text-center select-none"
                style={{
                  border: `1px solid ${tokens.buttonBorder || tokens.text}26`,
                  borderRadius: `${cardRadius}px`,
                  padding: `${Math.round(14 * scale)}px`,
                  color: tokens.text,
                  fontFamily: buttonFontFamily,
                }}
              >
                <div
                  className="flex items-center justify-center opacity-80"
                  style={{ marginBottom: `${Math.round(6 * scale)}px` }}
                >
                  <Mail size={Math.round(20 * scale)} strokeWidth={1.5} />
                </div>
                <h3
                  className="font-semibold leading-tight"
                  style={{
                    fontSize: `${Math.max(13, Math.round(15 * scale))}px`,
                    color: tokens.text,
                  }}
                >
                  {block.title}
                </h3>
                {desc && (
                  <p
                    className="mt-1 opacity-80"
                    style={{ fontSize: `${Math.max(11, Math.round(13 * scale))}px` }}
                  >
                    {desc}
                  </p>
                )}
                {/* Input-shaped bar(s) */}
                <div className="w-full flex flex-col gap-2 my-2.5" aria-hidden="true">
                  {Array.from({ length: numBars }).map((_, barIdx) => (
                    <div
                      key={barIdx}
                      className="w-full"
                      style={{
                        height: `${Math.round(38 * scale)}px`,
                        borderRadius: `${innerRadius}px`,
                        border: `1px solid ${tokens.text}4D`,
                      }}
                    />
                  ))}
                </div>
                {/* Button-shaped bar */}
                <div
                  className="w-full flex items-center justify-center font-medium truncate"
                  style={{
                    height: `${Math.round(38 * scale)}px`,
                    ...buttonSurfaceStyle,
                    borderRadius: `${controlRadius}px`,
                    fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
                  }}
                >
                  {buttonText}
                </div>
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
            const coffeeUrl = block.url ? formatExternalUrl(block.url) : 'https://buymeacoffee.com';
            const coffeeMeta = block.coffee;
            const ctaLabel = coffeeMeta?.buttonLabel?.trim() || 'Support with a Coffee';
            const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
            const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
            const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);
            const coffeeFg = String(buttonSurfaceStyle.color || tokens.buttonText || tokens.text);
            const isLightFg =
              coffeeFg.toUpperCase() === '#FFFFFF' ||
              coffeeFg.toUpperCase() === '#FAFAFA' ||
              coffeeFg.toUpperCase() === '#F8FAFC' ||
              coffeeFg.toUpperCase() === '#F5F5F5';
            const ctaBg = coffeeFg;
            const ctaColor =
              typeof buttonSurfaceStyle.backgroundColor === 'string' &&
              buttonSurfaceStyle.backgroundColor.startsWith('#') &&
              buttonSurfaceStyle.backgroundColor !== 'transparent'
                ? buttonSurfaceStyle.backgroundColor
                : isLightFg
                  ? '#0A0A0A'
                  : '#FFFFFF';

            return (
              <div
                key={block.id}
                className="w-full overflow-hidden flex flex-col items-center select-none transition-transform duration-150"
                style={{
                  ...buttonSurfaceStyle,
                  color: coffeeFg,
                  fontFamily: buttonFontFamily,
                  borderRadius: `${cardRadius}px`,
                  padding: `${Math.round(14 * scale)}px`,
                }}
              >
                <div className="flex items-center gap-2.5 mb-1 max-w-full min-w-0">
                  {coffeeMeta?.avatarUrl ? (
                    <img
                      src={coffeeMeta.avatarUrl}
                      alt={coffeeMeta.creatorName || block.title || 'Creator'}
                      className="w-7 h-7 rounded-full object-cover border border-current/20 shrink-0"
                    />
                  ) : (
                    <span className="text-[18px] leading-none shrink-0">☕</span>
                  )}
                  <span
                    className="font-semibold leading-tight truncate"
                    style={{ fontSize: `${Math.max(13, Math.round(15 * scale))}px` }}
                  >
                    {block.title || coffeeMeta?.creatorName || 'Buy Me a Coffee'}
                  </span>
                  {typeof coffeeMeta?.supportersCount === 'number' && coffeeMeta.supportersCount > 0 && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold border border-current/25 shrink-0 whitespace-nowrap"
                      style={{ opacity: 0.9, borderRadius: `${controlRadius}px` }}
                    >
                      {coffeeMeta.supportersCount} supporters
                    </span>
                  )}
                </div>

                {(block.badge || coffeeMeta?.bio) && (
                  <p className="text-[11px] opacity-80 text-center leading-snug mb-1.5 max-w-[36ch]">
                    {block.badge || coffeeMeta?.bio}
                  </p>
                )}

                <div className="flex items-center flex-wrap justify-center gap-1.5 my-1.5">
                  {[1, 3, 5].map((count) => (
                    <a
                      key={count}
                      href={isPublicPage ? coffeeUrl : undefined}
                      target={isPublicPage ? '_blank' : undefined}
                      rel={isPublicPage ? 'noopener noreferrer' : undefined}
                      onClick={isPublicPage ? () => onLinkClick?.(block) : undefined}
                      className="px-2.5 py-1 text-[11px] font-medium border border-current/20 hover:border-current/60 transition-colors cursor-pointer"
                      style={{ color: coffeeFg, borderRadius: `${controlRadius}px` }}
                    >
                      {count} ☕ (${count * 3})
                    </a>
                  ))}
                </div>

                {coffeeMeta?.recentSupporters && coffeeMeta.recentSupporters.length > 0 && (
                  <div
                    className="w-full mt-1 mb-1.5 px-2.5 py-1.5 border border-current/15 text-[11px] opacity-85 text-center truncate"
                    style={{ borderRadius: `${innerRadius}px` }}
                  >
                    ☕ Latest:{' '}
                    <strong>
                      {coffeeMeta.recentSupporters[0].supporterName ||
                        (coffeeMeta.recentSupporters[0] as any).name ||
                        'Supporter'}
                    </strong>{' '}
                    ({coffeeMeta.recentSupporters[0].coffees}×)
                    {coffeeMeta.recentSupporters[0].note
                      ? ` · "${coffeeMeta.recentSupporters[0].note.slice(0, 42)}"`
                      : ''}
                  </div>
                )}

                {coffeeMeta?.extras && coffeeMeta.extras.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
                    {coffeeMeta.extras.slice(0, 2).map((extra, idx) => (
                      <a
                        key={`${extra.title}-${idx}`}
                        href={isPublicPage ? extra.url || coffeeUrl : undefined}
                        target={isPublicPage ? '_blank' : undefined}
                        rel={isPublicPage ? 'noopener noreferrer' : undefined}
                        onClick={isPublicPage ? () => onLinkClick?.(block) : undefined}
                        className="px-2 py-0.5 border border-current/20 text-[10px] font-medium opacity-90 hover:opacity-100"
                        style={{ color: coffeeFg, borderRadius: `${innerRadius}px` }}
                      >
                        ★ {extra.title}
                        {extra.price ? ` · ${extra.price}` : ''}
                      </a>
                    ))}
                  </div>
                )}

                {isPublicPage ? (
                  <a
                    href={coffeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLinkClick?.(block)}
                    className="mt-1 w-full py-2 px-3 text-center text-[13px] font-semibold transition-transform active:scale-[0.98]"
                    style={{
                      backgroundColor: ctaBg,
                      color: ctaColor,
                      borderRadius: `${controlRadius}px`,
                    }}
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <div
                    className="mt-1 w-full py-2 px-3 text-center text-[13px] font-semibold"
                    style={{
                      backgroundColor: ctaBg,
                      color: ctaColor,
                      borderRadius: `${controlRadius}px`,
                    }}
                  >
                    {ctaLabel}
                  </div>
                )}
              </div>
            );
          }

          // 4f. Instagram Showcase Block
          if (block.kind === 'instagram') {
            const igUrl = block.url ? formatExternalUrl(block.url) : 'https://instagram.com';
            const barRadius = resolveCardBorderRadius(effectiveRadius, scale, 'bar');
            const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
            const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);
            const igFg = String(buttonSurfaceStyle.color || tokens.buttonText || tokens.text);
            const isLightFg =
              igFg.toUpperCase() === '#FFFFFF' ||
              igFg.toUpperCase() === '#FAFAFA' ||
              igFg.toUpperCase() === '#F8FAFC' ||
              igFg.toUpperCase() === '#F5F5F5';
            const ctaBg = igFg;
            const ctaColor =
              typeof buttonSurfaceStyle.backgroundColor === 'string' &&
              buttonSurfaceStyle.backgroundColor.startsWith('#') &&
              buttonSurfaceStyle.backgroundColor !== 'transparent'
                ? buttonSurfaceStyle.backgroundColor
                : isLightFg
                  ? '#0A0A0A'
                  : '#FFFFFF';
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

          // 4g. YouTube Showcase Block
          if (block.kind === 'youtube') {
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
          const classicSurfaceStyle = getButtonSurfaceStyle(glowOverride);

          const innerButton = (
            <div
              className={`w-full relative flex items-center justify-center truncate transition-all duration-150 select-none ${animClass}`}
              style={{
                height: `${Math.round(44 * scale)}px`,
                paddingLeft: `${sidePadding}px`,
                paddingRight: `${sidePadding}px`,
                ...classicSurfaceStyle,
                fontFamily: buttonFontFamily,
                borderRadius: `${barRadius}px`,
                fontSize: `${Math.max(12, Math.round(14 * scale))}px`,
                fontWeight: 500,
              }}
            >
              {/* Badge if specified */}
              {block.badge && (
                <span
                  className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm pointer-events-none z-10"
                  style={{
                    backgroundColor: tokens.text,
                    color: tokens.bg,
                    border: `1px solid ${tokens.buttonBorder || 'transparent'}`,
                  }}
                >
                  {block.badge}
                </span>
              )}
              {/* Left thumbnail or icon */}
              {hasThumb ? (
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
              )}

              <span className="truncate text-center leading-none px-2">
                {block.title}
              </span>

              {/* Right Lock icon if protected */}
              {isProtected && (
                <span
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center shrink-0 opacity-80"
                  style={{ color: String(classicSurfaceStyle.color || tokens.buttonText) }}
                  aria-hidden="true"
                >
                  <Lock size={lockSize} strokeWidth={1.5} />
                </span>
              )}
            </div>
          );

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
                  className="w-full block transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ borderRadius: `${barRadius}px` }}
                >
                  {innerButton}
                </button>
              );
            }
            return <div key={block.id}>{innerButton}</div>;
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
                className="w-full block transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderRadius: `${barRadius}px` }}
              >
                {innerButton}
              </a>
            );
          }

          return <div key={block.id}>{innerButton}</div>;
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
            const btnStyle: React.CSSProperties = {
              width: `${Math.round(36 * scale)}px`,
              height: `${Math.round(36 * scale)}px`,
              borderRadius: socialBorderRadiusCss,
              ...buttonSurfaceStyle,
              border: buttonSurfaceStyle.border || `1px solid ${tokens.text}1A`,
            };
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
      {/* Footer Area - Refined, minimal iveo branding & subtle create page link */}
      <div
        className="w-full flex flex-col items-center justify-center shrink-0 pb-8 mt-auto"
        style={{
          paddingTop: `${Math.round(28 * scale)}px`,
          gap: `${Math.round(8 * scale)}px`,
        }}
      >
        {/* Subtle, minimal "Create your page" action */}
        {isPublicPage && (
          <a
            href="https://iveo.site/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-normal transition-all duration-150 opacity-80 hover:opacity-100 hover:underline underline-offset-4 select-none"
            style={{ color: tokens.muted }}
          >
            <span>Create your page</span>
          </a>
        )}

        {/* Refined and small iveo mark at the bottom */}
        {!hideFooterMark && (
          <a
            href="https://iveo.site"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity duration-150 select-none group"
            aria-label="iveo"
          >
            <img
              src="https://i.postimg.cc/HkbTTdWH/File-Kit-1000252682-compress-image.jpg"
              alt=""
              className="h-3.5 w-auto rounded-[3px] object-contain transition-transform group-hover:scale-105"
            />
            <span
              className="font-semibold tracking-[-0.03em] text-[11px]"
              style={{ color: tokens.text }}
            >
              iveo
            </span>
          </a>
        )}

        {/* "Report this page" embedded Formspree trigger (always visible on public page) */}
        {isPublicPage && displayHandle && (
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="text-[10px] opacity-75 hover:opacity-100 underline underline-offset-2 transition-opacity cursor-pointer"
            style={{ color: tokens.muted }}
          >
            Report this page
          </button>
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
      {isPublicPage && displayHandle && (
        <ReportPageModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          username={displayHandle}
          displayName={displayName}
        />
      )}
    </div>
  );
};

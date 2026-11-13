import React, { useState } from 'react';
import {
  Link2,
  ShoppingBag,
  Globe,
  Mail,
  Calendar,
  Lock,
  Share2,
  ArrowRight,
  Instagram,
  Youtube,
  MessageCircle,
} from 'lucide-react';
import { Vibe } from '../../lib/vibes';
import { PageBlock } from '../../data/types';
import { PhoneProfile } from '../phone/PhonePage';
import { SocialIcon } from '../phone/SocialIcons';
import { FeaturedLink } from './FeaturedLink';
import { EmbedBlock } from './EmbedBlock';
import { TipJarBlock } from '../public/TipJarBlock';
import { FaqBlock } from '../public/FaqBlock';
import { VCardBlock } from '../public/VCardBlock';
import { ShareModal } from '../public/ShareModal';
import { formatExternalUrl } from '../../lib/urls';
import { storagePublicUrl } from '../../data/storageApi';
import { Logo } from '../ui/Logo';

export interface PageRendererProps {
  vibe: Vibe;
  profile?: PhoneProfile | null;
  blocks?: PageBlock[];
  buttonRadiusOverride?: number;
  hideFooterMark?: boolean;
  embedMode?: 'placeholder' | 'live';
  isPublicPage?: boolean;
  scale?: number;
  onLinkClick?: (block: PageBlock) => void;
  onUnlock?: (block: PageBlock) => void;
  renderSignupForm?: (block: PageBlock) => React.ReactNode;
  protectedIds?: ReadonlySet<string>;
}

const DEFAULT_BUTTON_ICONS = [Link2, ShoppingBag, Globe, Mail, Calendar];

export const PageRenderer: React.FC<PageRendererProps> = ({
  vibe,
  profile,
  blocks,
  buttonRadiusOverride,
  hideFooterMark = false,
  embedMode = 'placeholder',
  isPublicPage = false,
  scale = 1,
  onLinkClick,
  onUnlock,
  renderSignupForm,
  protectedIds,
}) => {
  const { tokens, persona } = vibe;
  const effectiveRadius =
    buttonRadiusOverride !== undefined ? buttonRadiusOverride : tokens.buttonRadius;

  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

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

  const handleShareClick = () => {
    setIsShareModalOpen(true);
  };

  const bgConfig = profile?.background;
  const hasCustomBg = Boolean(bgConfig && bgConfig.type && bgConfig.type !== 'none');

  const containerBgStyle: React.CSSProperties = {
    backgroundColor: isPublicPage ? 'transparent' : tokens.bg,
    color: tokens.text,
    fontFamily: vibe.fontFamily,
    padding: `${Math.round(32 * scale)}px ${Math.round(20 * scale)}px ${Math.round(24 * scale)}px`,
  };

  if (!isPublicPage && hasCustomBg && (bgConfig?.type === 'gradient' || bgConfig?.type === 'mesh')) {
    containerBgStyle.background = bgConfig.value || tokens.bg;
  }

  return (
    <div
      className="w-full flex-1 flex flex-col items-center select-none relative overflow-hidden"
      style={containerBgStyle}
    >
      {/* Background Image Layer (for Dashboard/Onboarding phone preview; Public page renders full-viewport layer) */}
      {!isPublicPage && hasCustomBg && bgConfig?.type === 'image' && bgConfig.value && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden z-0"
          style={{
            opacity: bgConfig.opacity ?? 0.85,
            filter: bgConfig.blur ? `blur(${bgConfig.blur}px)` : 'none',
            transform: bgConfig.blur ? 'scale(1.05)' : 'none',
          }}
        >
          <img
            src={bgConfig.value}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Background Pattern Layer (for phone preview) */}
      {!isPublicPage && hasCustomBg && bgConfig?.type === 'pattern' && (
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-15"
          style={{
            backgroundImage: bgConfig.value || 'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
      )}

      {/* Minimal Top-Right Share Action on Public Page */}
      {isPublicPage && displayHandle && (
        <div className="w-full max-w-[540px] flex justify-end mb-2 relative z-10">
          <button
            type="button"
            onClick={handleShareClick}
            aria-label="Share this profile"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            style={{
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
              border: `1px solid ${tokens.buttonBorder || 'rgba(0,0,0,0.1)'}`,
            }}
          >
            <Share2 size={13} strokeWidth={2} />
            <span>Share</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-[540px] flex-1 flex flex-col items-center relative z-10">
        {/* Avatar */}
      <div
        className="rounded-full overflow-hidden flex items-center justify-center shrink-0 font-medium"
        style={{
          width: `${Math.round(72 * scale)}px`,
          height: `${Math.round(72 * scale)}px`,
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
        className="w-full text-center flex flex-col items-center"
        style={{
          marginTop: `${Math.round(12 * scale)}px`,
          gap: `${Math.round(2 * scale)}px`,
        }}
      >
        <h1
          className="font-medium tracking-tight leading-tight px-2 max-w-full truncate"
          style={{
            fontSize: `${Math.max(14, Math.round(17 * scale))}px`,
            color: tokens.text,
          }}
        >
          {displayName}
        </h1>

        <div
          className="font-mono text-center tracking-tight truncate max-w-full px-2"
          style={{
            fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
            color: tokens.muted,
          }}
        >
          @{displayHandle}
        </div>
      </div>

      {/* Bio */}
      {displayBio && (
        <p
          className="text-center font-normal leading-relaxed max-w-[34ch] break-words"
          style={{
            marginTop: `${Math.round(8 * scale)}px`,
            fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
            color: tokens.muted,
          }}
        >
          {displayBio}
        </p>
      )}

      {/* Top Socials placement if configured ('top' or 'both') */}
      {(profile?.socialsPosition === 'top' || profile?.socialsPosition === 'both' || !profile?.socialsPosition) &&
        activeSocialEntries.length > 0 && (
        <div
          className="flex items-center justify-center flex-wrap shrink-0"
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
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
              border: tokens.buttonBorder
                ? `1px solid ${tokens.buttonBorder}`
                : `1px solid ${tokens.text}1A`,
              boxShadow: tokens.buttonShadow || '0 1px 2px rgba(0,0,0,0.04)',
            };
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={platform}
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  className="rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
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
                className="rounded-full flex items-center justify-center transition-transform hover:scale-105"
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
          gap: `${Math.round(10 * scale)}px`,
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
                vibe={vibe}
                effectiveRadius={effectiveRadius}
                embedMode={embedMode}
                activeEmbedId={activeEmbedId}
                onActivate={(id) => setActiveEmbedId(id)}
                scale={scale}
                onLinkClick={onLinkClick}
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
            const cardRadius = Math.min(16, effectiveRadius);
            const numBars = collectMode === 'both' ? 2 : 1;

            return (
              <div
                key={block.id}
                className="w-full flex flex-col items-center text-center select-none"
                style={{
                  border: `1px solid ${tokens.buttonBorder || tokens.text}26`,
                  borderRadius: `${Math.round(cardRadius * scale)}px`,
                  padding: `${Math.round(14 * scale)}px`,
                  color: tokens.text,
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
                        borderRadius: `${Math.round(10 * scale)}px`,
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
                    borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                    backgroundColor: tokens.buttonBg,
                    color: tokens.buttonText,
                    border: tokens.buttonBorder
                      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                      : 'none',
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
                  scale={scale}
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
                  scale={scale}
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
                  scale={scale}
                />
              </div>
            );
          }

          // 4e. Buy Me a Coffee Block
          if (block.kind === 'coffee') {
            const coffeeUrl = block.url ? formatExternalUrl(block.url) : 'https://buymeacoffee.com';
            return (
              <div
                key={block.id}
                className="w-full flex flex-col items-center select-none transition-transform duration-150"
                style={{
                  backgroundColor: tokens.buttonBg,
                  color: tokens.buttonText,
                  borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : '1px solid rgba(0,0,0,0.08)',
                  padding: `${Math.round(14 * scale)}px`,
                  boxShadow: tokens.buttonShadow || '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[18px]">☕</span>
                  <span
                    className="font-semibold leading-tight"
                    style={{ fontSize: `${Math.max(13, Math.round(15 * scale))}px` }}
                  >
                    {block.title || 'Buy Me a Coffee'}
                  </span>
                </div>
                {block.badge && (
                  <p className="text-[11px] opacity-75 text-center leading-snug mb-1">
                    {block.badge}
                  </p>
                )}
                <div className="flex items-center gap-2 my-2">
                  {[1, 3, 5].map((count) => (
                    <a
                      key={count}
                      href={isPublicPage ? coffeeUrl : undefined}
                      target={isPublicPage ? '_blank' : undefined}
                      rel={isPublicPage ? 'noopener noreferrer' : undefined}
                      onClick={isPublicPage ? () => onLinkClick?.(block) : undefined}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-current/20 hover:border-current/60 transition-colors cursor-pointer"
                      style={{ color: tokens.buttonText }}
                    >
                      {count} ☕ (${count * 3})
                    </a>
                  ))}
                </div>
                {isPublicPage ? (
                  <a
                    href={coffeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLinkClick?.(block)}
                    className="mt-1 w-full py-2 px-3 text-center rounded-[10px] text-[13px] font-semibold transition-transform active:scale-[0.98]"
                    style={{
                      backgroundColor: tokens.buttonText,
                      color: tokens.buttonBg,
                    }}
                  >
                    Support with a Coffee
                  </a>
                ) : (
                  <div
                    className="mt-1 w-full py-2 px-3 text-center rounded-[10px] text-[13px] font-semibold"
                    style={{
                      backgroundColor: tokens.buttonText,
                      color: tokens.buttonBg,
                    }}
                  >
                    Support with a Coffee
                  </div>
                )}
              </div>
            );
          }

          // 4f. Instagram Showcase Block
          if (block.kind === 'instagram') {
            const igUrl = block.url ? formatExternalUrl(block.url) : 'https://instagram.com';
            return (
              <div
                key={block.id}
                className="w-full flex items-center justify-between transition-all duration-150 select-none"
                style={{
                  backgroundColor: tokens.buttonBg,
                  color: tokens.buttonText,
                  borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : '1px solid rgba(0,0,0,0.08)',
                  padding: `${Math.round(10 * scale)}px ${Math.round(12 * scale)}px`,
                  boxShadow: tokens.buttonShadow || '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Instagram size={16} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-semibold truncate text-[13px] leading-tight"
                      style={{ color: tokens.buttonText }}
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
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-transform active:scale-95"
                    style={{
                      backgroundColor: tokens.buttonText,
                      color: tokens.buttonBg,
                    }}
                  >
                    Follow
                  </a>
                ) : (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                    style={{
                      backgroundColor: tokens.buttonText,
                      color: tokens.buttonBg,
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
            const ytUrl = block.url ? formatExternalUrl(block.url) : 'https://youtube.com';
            return (
              <div
                key={block.id}
                className="w-full flex items-center justify-between transition-all duration-150 select-none"
                style={{
                  backgroundColor: tokens.buttonBg,
                  color: tokens.buttonText,
                  borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : '1px solid rgba(0,0,0,0.08)',
                  padding: `${Math.round(10 * scale)}px ${Math.round(12 * scale)}px`,
                  boxShadow: tokens.buttonShadow || '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Youtube size={16} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-semibold truncate text-[13px] leading-tight"
                      style={{ color: tokens.buttonText }}
                    >
                      {block.title || 'YouTube Channel'}
                    </span>
                    <span className="text-[11px] opacity-75 truncate">
                      {block.badge || 'Subscribe for new videos'}
                    </span>
                  </div>
                </div>

                {isPublicPage ? (
                  <a
                    href={ytUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onLinkClick?.(block)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 bg-red-600 text-white transition-transform active:scale-95"
                  >
                    Subscribe
                  </a>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 bg-red-600 text-white">
                    Subscribe
                  </span>
                )}
              </div>
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
                vibe={vibe}
                effectiveRadius={effectiveRadius}
                scale={scale}
                isInteractive={isPublicPage}
                isEager={isEager}
                isProtected={isProtected}
                onLinkClick={onLinkClick}
                onUnlock={onUnlock}
              />
            );
          }

          // 6. Classic link (with or without thumbnail, with optional lock)
          const DefaultIcon =
            DEFAULT_BUTTON_ICONS[idx % DEFAULT_BUTTON_ICONS.length];

          const effectiveThumbUrl = block.thumbnailUrl || (block.thumbnailPath ? storagePublicUrl(block.thumbnailPath) : null);
          const hasThumb = Boolean(effectiveThumbUrl);
          if (hasThumb) imageCounter++;
          const isEager = hasThumb && imageCounter <= 2;
          const thumbSize = isPublicPage ? 40 : Math.round(32 * scale);
          const thumbRadius = Math.min(8, effectiveRadius);
          const lockSize = isPublicPage ? 16 : Math.round(14 * scale);

          // Space reservation for centered text with icon/thumb on left and optional lock on right
          const sidePadding = isProtected
            ? Math.max(hasThumb ? thumbSize + 16 : Math.round(36 * scale), Math.round(36 * scale))
            : hasThumb
            ? thumbSize + 16
            : Math.round(14 * scale);

          const animClass =
            block.animation === 'pulse'
              ? 'animate-pulse'
              : block.animation === 'bounce'
              ? 'hover:animate-bounce'
              : '';

          const glowShadow =
            block.animation === 'glow'
              ? `0 0 16px ${tokens.text}40`
              : (tokens.buttonShadow || 'none');

          const innerButton = (
            <div
              className={`w-full relative flex items-center justify-center truncate transition-all duration-150 select-none ${animClass}`}
              style={{
                height: `${Math.round(44 * scale)}px`,
                paddingLeft: `${sidePadding}px`,
                paddingRight: `${sidePadding}px`,
                backgroundColor: tokens.buttonBg,
                color: tokens.buttonText,
                borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                border: tokens.buttonBorder
                  ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                  : 'none',
                boxShadow: glowShadow,
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
                  className="absolute left-3.5 flex items-center shrink-0 opacity-70"
                  style={{ width: `${Math.round(16 * scale)}px` }}
                >
                  <DefaultIcon size={Math.round(16 * scale)} strokeWidth={1.5} />
                </span>
              )}

              <span className="truncate text-center leading-none px-2">
                {block.title}
              </span>

              {/* Right Lock icon if protected */}
              {isProtected && (
                <span
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center shrink-0 opacity-80"
                  style={{ color: tokens.buttonText }}
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
                  style={{ borderRadius: `${Math.round(effectiveRadius * scale)}px` }}
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
                style={{ borderRadius: `${Math.round(effectiveRadius * scale)}px` }}
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
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
              border: tokens.buttonBorder
                ? `1px solid ${tokens.buttonBorder}`
                : `1px solid ${tokens.text}1A`,
              boxShadow: tokens.buttonShadow || '0 1px 2px rgba(0,0,0,0.04)',
            };
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={platform}
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  className="rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
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
                className="rounded-full flex items-center justify-center transition-transform hover:scale-105"
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
            className="inline-flex items-center gap-1 text-[11px] font-normal transition-all duration-150 opacity-40 hover:opacity-85 hover:underline underline-offset-4 select-none"
            style={{ color: tokens.muted }}
          >
            <span>Create your page</span>
          </a>
        )}

        {/* Refined and very small iveo mark at the bottom */}
        {!hideFooterMark && (
          <a
            href="https://iveo.site"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-35 hover:opacity-80 transition-opacity duration-150 select-none group"
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

        {/* "Report this page" (always visible on public page) */}
        {isPublicPage && displayHandle && (
          <a
            href={`mailto:help@iveo.site?subject=Report%20page%20iveo.site/${displayHandle}`}
            className="text-[10px] opacity-25 hover:opacity-70 underline underline-offset-2 transition-opacity"
            style={{ color: tokens.muted }}
          >
            Report this page
          </a>
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
            aria-label="Chat on WhatsApp"
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] text-white font-semibold text-[13px] shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            <MessageCircle size={18} strokeWidth={2.2} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        );
      })()}

      {/* Enhanced Share Bottom Sheet Dialog with Business Card */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        username={displayHandle}
        displayName={displayName}
        bio={displayBio}
        avatarUrl={!avatarError && (profile?.avatarUrl ?? persona.avatarUrl) ? (profile?.avatarUrl ?? persona.avatarUrl) : null}
        vibe={vibe}
      />
    </div>
  );
};

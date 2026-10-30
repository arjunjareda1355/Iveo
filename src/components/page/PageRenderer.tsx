import React, { useState } from 'react';
import {
  Link2,
  ShoppingBag,
  Globe,
  Mail,
  Calendar,
  Lock,
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
import { formatExternalUrl } from '../../lib/urls';
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

  return (
    <div
      className="w-full flex-1 flex flex-col items-center select-none"
      style={{
        backgroundColor: tokens.bg,
        color: tokens.text,
        fontFamily: vibe.fontFamily,
        padding: `${Math.round(32 * scale)}px ${Math.round(20 * scale)}px ${Math.round(24 * scale)}px`,
      }}
    >
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
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={displayName}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
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

      {/* Top Socials placement if configured or default */}
      {(profile?.socialsPosition === 'top' || !profile?.socialsPosition) && activeSocialEntries.length > 0 && (
        <div
          className="flex items-center justify-center flex-wrap shrink-0"
          style={{
            marginTop: `${Math.round(14 * scale)}px`,
            gap: `${Math.round(14 * scale)}px`,
            color: tokens.text,
            opacity: 0.85,
          }}
        >
          {activeSocialEntries.map(([platform, url]) => {
            const cleanUrl = formatExternalUrl(url);
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={platform}
                  className="transition-transform duration-120 hover:scale-110 active:scale-95"
                  style={{ color: tokens.text }}
                >
                  <SocialIcon platform={platform} size={Math.round(18 * scale)} />
                </a>
              );
            }
            return (
              <span
                key={platform}
                title={`${platform}: ${url}`}
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                <SocialIcon platform={platform} size={Math.round(18 * scale)} />
              </span>
            );
          })}
        </div>
      )}

      {/* Blocks Container */}
      <div
        className="w-full flex flex-col"
        style={{
          marginTop: `${Math.round((activeSocialEntries.length > 0 && (profile?.socialsPosition === 'top' || !profile?.socialsPosition) ? 16 : 24) * scale)}px`,
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

          const hasThumb = !!block.thumbnailUrl;
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
                    src={block.thumbnailUrl!}
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

      {/* Social Row: Rendered at bottom if user configured bottom placement */}
      {profile?.socialsPosition === 'bottom' && activeSocialEntries.length > 0 && (
        <div
          className="flex items-center justify-center flex-wrap shrink-0"
          style={{
            marginTop: `${Math.round(20 * scale)}px`,
            gap: `${Math.round(14 * scale)}px`,
            color: tokens.text,
            opacity: 0.85,
          }}
        >
          {activeSocialEntries.map(([platform, url]) => {
            const cleanUrl = formatExternalUrl(url);
            if (isPublicPage) {
              return (
                <a
                  key={platform}
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={platform}
                  className="transition-transform duration-120 hover:scale-110 active:scale-95"
                  style={{ color: tokens.text }}
                >
                  <SocialIcon platform={platform} size={Math.round(18 * scale)} />
                </a>
              );
            }
            return (
              <span
                key={platform}
                title={`${platform}: ${url}`}
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                <SocialIcon platform={platform} size={Math.round(18 * scale)} />
              </span>
            );
          })}
        </div>
      )}

      {/* Footer Area */}
      <div
        className="w-full flex flex-col items-center justify-center shrink-0 pb-8 mt-auto"
        style={{
          marginTop: `${Math.round(20 * scale)}px`,
          gap: `${Math.round(6 * scale)}px`,
        }}
      >
        {/* iveo mark and link */}
        {!hideFooterMark && (
          <a
            href="https://iveo.site"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 transition-opacity"
            aria-label="Made with iveo"
          >
            <Logo
              tone={vibe.id === 'midnight' ? 'dark' : 'light'}
              size="sm"
              isLink={false}
            />
          </a>
        )}

        {/* "Report this page" (always visible on public page) */}
        {isPublicPage && displayHandle && (
          <a
            href={`mailto:help@iveo.site?subject=Report%20page%20iveo.site/${displayHandle}`}
            className="text-[12px] opacity-50 hover:opacity-90 underline underline-offset-2 transition-opacity"
            style={{ color: tokens.muted }}
          >
            Report this page
          </a>
        )}
      </div>
    </div>
  );
};

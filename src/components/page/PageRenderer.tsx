import React, { useState } from 'react';
import {
  Link2,
  ShoppingBag,
  Globe,
  Mail,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Vibe } from '../../lib/vibes';
import { PageBlock } from '../../data/types';
import { PhoneProfile } from '../phone/PhonePage';
import { InstagramIcon, PlayIcon, MusicIcon, MailIcon } from '../phone/SocialIcons';
import { FeaturedLink } from './FeaturedLink';
import { EmbedBlock } from './EmbedBlock';
import { pageUrl } from '../../lib/site';
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
      className="w-full h-full flex flex-col items-center select-none overflow-y-auto overflow-x-hidden min-h-full"
      style={{
        backgroundColor: tokens.bg,
        color: tokens.text,
        fontFamily: vibe.fontFamily,
        paddingLeft: `${Math.round(20 * scale)}px`,
        paddingRight: `${Math.round(20 * scale)}px`,
      }}
    >
      {/* Profile Header Area */}
      <div className="w-full flex flex-col items-center shrink-0">
        {/* Avatar */}
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-semibold shadow-xs overflow-hidden select-none"
          style={{
            width: `${Math.round(72 * scale)}px`,
            height: `${Math.round(72 * scale)}px`,
            marginTop: `${Math.round(18 * scale)}px`,
            backgroundColor: tokens.avatarBg,
            color: tokens.avatarText,
            fontSize: `${Math.round(26 * scale)}px`,
            lineHeight: 1,
            fontFamily: "'Geist', sans-serif",
          }}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            displayInitials
          )}
        </div>

        {/* Name */}
        <div
          className="font-semibold text-center w-full px-2 break-words"
          style={{
            fontSize: `${Math.round(18 * scale)}px`,
            lineHeight: `${Math.round(24 * scale)}px`,
            marginTop: `${Math.round(12 * scale)}px`,
          }}
        >
          {displayName}
        </div>

        {/* Handle */}
        {displayHandle && (
          <div
            className="text-center font-mono truncate w-full px-2"
            style={{
              color: tokens.muted,
              fontSize: `${Math.round(13 * scale)}px`,
              lineHeight: `${Math.round(18 * scale)}px`,
              marginTop: `${Math.round(4 * scale)}px`,
            }}
          >
            @{displayHandle}
          </div>
        )}

        {/* Bio */}
        {displayBio && (
          <p
            className="text-center break-words max-w-[270px] px-2 leading-relaxed"
            style={{
              color: tokens.text,
              opacity: 0.85,
              fontSize: `${Math.round(13 * scale)}px`,
              lineHeight: `${Math.round(19 * scale)}px`,
              marginTop: `${Math.round(8 * scale)}px`,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {displayBio}
          </p>
        )}
      </div>

      {/* Blocks Container */}
      <div
        className="w-full flex flex-col"
        style={{
          marginTop: `${Math.round(20 * scale)}px`,
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

          // 4. Featured link
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
                onLinkClick={onLinkClick}
              />
            );
          }

          // 5. Classic link (with or without thumbnail)
          const DefaultIcon =
            DEFAULT_BUTTON_ICONS[idx % DEFAULT_BUTTON_ICONS.length];

          const hasThumb = !!block.thumbnailUrl;
          if (hasThumb) imageCounter++;
          const isEager = hasThumb && imageCounter <= 2;
          const thumbSize = isPublicPage ? 40 : Math.round(32 * scale);
          const thumbRadius = Math.min(8, effectiveRadius);

          const innerButton = (
            <div
              className="w-full relative flex items-center justify-center truncate transition-all duration-150 select-none"
              style={{
                height: `${Math.round(44 * scale)}px`,
                paddingLeft: hasThumb
                  ? `${thumbSize + 16}px`
                  : `${Math.round(14 * scale)}px`,
                paddingRight: hasThumb
                  ? `${thumbSize + 16}px`
                  : `${Math.round(14 * scale)}px`,
                backgroundColor: tokens.buttonBg,
                color: tokens.buttonText,
                borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                border: tokens.buttonBorder
                  ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                  : 'none',
                boxShadow: tokens.buttonShadow || 'none',
                fontSize: `${Math.max(12, Math.round(14 * scale))}px`,
                fontWeight: 500,
              }}
            >
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
            </div>
          );

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

      {/* Social Row */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          marginTop: `${Math.round(20 * scale)}px`,
          gap: `${Math.round(16 * scale)}px`,
          color: tokens.text,
          opacity: 0.75,
        }}
      >
        <InstagramIcon size={Math.round(18 * scale)} />
        <PlayIcon size={Math.round(18 * scale)} />
        <MusicIcon size={Math.round(18 * scale)} />
        <MailIcon size={Math.round(18 * scale)} />
      </div>

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

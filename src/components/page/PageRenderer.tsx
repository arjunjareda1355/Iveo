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

export interface PageRendererProps {
  vibe: Vibe;
  profile?: PhoneProfile | null;
  blocks?: PageBlock[];
  buttonRadiusOverride?: number;
  hideFooterMark?: boolean;
  embedMode?: 'placeholder' | 'live';
  isPublicPage?: boolean;
  scale?: number;
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
        url: 'https://ivio.site',
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
      {/* Avatar */}
      <div
        className="rounded-full flex items-center justify-center shrink-0 font-semibold shadow-xs overflow-hidden"
        style={{
          width: `${Math.round(72 * scale)}px`,
          height: `${Math.round(72 * scale)}px`,
          marginTop: `${Math.round(22 * scale)}px`,
          backgroundColor: tokens.avatarBg,
          color: tokens.avatarText,
          fontSize: `${Math.round(26 * scale)}px`,
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
        className="font-semibold text-center leading-tight truncate w-full"
        style={{
          fontSize: `${Math.round(18 * scale)}px`,
          marginTop: `${Math.round(14 * scale)}px`,
        }}
      >
        {displayName}
      </div>

      {/* Handle */}
      {displayHandle && (
        <div
          className="text-center font-mono truncate w-full"
          style={{
            color: tokens.muted,
            fontSize: `${Math.round(13 * scale)}px`,
            marginTop: `${Math.round(2 * scale)}px`,
          }}
        >
          @{displayHandle}
        </div>
      )}

      {/* Bio */}
      {displayBio && (
        <p
          className="text-center line-clamp-3 max-w-[280px] leading-snug"
          style={{
            color: tokens.text,
            opacity: 0.85,
            fontSize: `${Math.round(13 * scale)}px`,
            marginTop: `${Math.round(10 * scale)}px`,
          }}
        >
          {displayBio}
        </p>
      )}

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
                href={block.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
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
        {/* ivio mark and "Create your own page" link */}
        {!hideFooterMark && (
          <a
            href="https://ivio.site"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: tokens.muted }}
          >
            <svg
              width={Math.round(14 * scale)}
              height={Math.round(14 * scale)}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="24" height="24" rx="7" fill="currentColor" />
              <circle cx="12" cy="7.25" r="1.75" fill={tokens.bg} />
              <rect x="10.5" y="10.5" width="3" height="8" rx="1.5" fill={tokens.bg} />
            </svg>
            <span
              className="font-medium tracking-tight"
              style={{ fontSize: `${Math.max(11, Math.round(12 * scale))}px` }}
            >
              ivio
            </span>
          </a>
        )}

        {/* "Report this page" (always visible on public page) */}
        {isPublicPage && displayHandle && (
          <a
            href={`mailto:help@ivio.site?subject=Report%20page%20ivio.site/${displayHandle}`}
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

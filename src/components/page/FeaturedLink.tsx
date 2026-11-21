import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { formatExternalUrl } from '../../lib/urls';
import { storagePublicUrl } from '../../data/storageApi';
import { resolveCardBorderRadius } from '../../lib/preferences';
import { getBlockContrastPalette } from '../../lib/blockTheme';

interface FeaturedLinkProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  fontFamily?: string;
  scale?: number;
  isInteractive?: boolean;
  isEager?: boolean;
  isProtected?: boolean;
  onLinkClick?: (block: PageBlock) => void;
  onUnlock?: (block: PageBlock) => void;
  surfaceStyle?: React.CSSProperties;
}

export const FeaturedLink: React.FC<FeaturedLinkProps> = ({
  block,
  vibe,
  effectiveRadius,
  fontFamily,
  scale = 1,
  isInteractive = false,
  isEager = false,
  isProtected = false,
  onLinkClick,
  onUnlock,
  surfaceStyle,
}) => {
  const { tokens } = vibe;
  const [imageError, setImageError] = useState(false);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');

  const palette = getBlockContrastPalette(surfaceStyle, tokens);
  const baseStyle: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    color: palette.fg,
    border: tokens.buttonBorder
      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
      : 'none',
    boxShadow: tokens.buttonShadow || 'none',
  };

  const content = (
    <div
      className="w-full relative flex flex-col overflow-hidden transition-all duration-150 select-none text-left"
      style={{
        ...baseStyle,
        fontFamily: fontFamily || vibe.fontFamily,
        borderRadius: `${cardRadius}px`,
      }}
    >
      {/* 16/9 aspect-ratio image */}
      {(() => {
        const effectiveThumbUrl =
          block.thumbnailUrl || (block.thumbnailPath ? storagePublicUrl(block.thumbnailPath) : null);
        if (imageError || !effectiveThumbUrl) return null;
        return (
          <div className="w-full relative aspect-video overflow-hidden bg-black/5">
            <img
              src={effectiveThumbUrl}
              alt=""
              loading={isEager ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover block"
            />

            {/* Badge if present */}
            {block.badge && (
              <div
                className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm pointer-events-none z-10"
                style={{
                  backgroundColor: palette.btnBg,
                  color: palette.btnText,
                }}
              >
                {block.badge}
              </div>
            )}

            {/* Protected chip in top-right corner (8px inset) */}
            {isProtected && (
              <div
                className="absolute top-2 right-2 flex items-center justify-center rounded-full shadow-xs pointer-events-none"
                style={{
                  width: `${Math.round(28 * scale)}px`,
                  height: `${Math.round(28 * scale)}px`,
                  backgroundColor: `${tokens.bg}E6`,
                  border: `1px solid ${tokens.text}26`,
                  color: tokens.text,
                }}
                aria-hidden="true"
              >
                <Lock size={Math.round(14 * scale)} strokeWidth={1.5} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Label row */}
      <div
        className="w-full flex items-center justify-center p-3 text-center"
        style={{
          minHeight: `${Math.round(48 * scale)}px`,
        }}
      >
        <span
          className="line-clamp-2 leading-snug font-medium"
          style={{
            fontSize: `${Math.max(13, Math.round(14 * scale))}px`,
          }}
        >
          {block.title}
        </span>
      </div>
    </div>
  );

  // If protected, it MUST NOT render as an anchor!
  if (isProtected) {
    if (isInteractive) {
      return (
        <button
          type="button"
          onClick={() => onUnlock?.(block)}
          aria-haspopup="dialog"
          aria-label={`${block.title}, password protected`}
          className="w-full block transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
          style={{ borderRadius: `${cardRadius}px` }}
        >
          {content}
        </button>
      );
    }
    return content;
  }

  // Normal interactive link with URL
  if (isInteractive && block.url) {
    return (
      <a
        href={formatExternalUrl(block.url)}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => onLinkClick?.(block)}
        onAuxClick={() => onLinkClick?.(block)}
        className="w-full block transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ borderRadius: `${cardRadius}px` }}
      >
        {content}
      </a>
    );
  }

  return content;
};

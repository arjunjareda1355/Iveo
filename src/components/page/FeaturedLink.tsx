import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { formatExternalUrl } from '../../lib/urls';

interface FeaturedLinkProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  scale?: number;
  isInteractive?: boolean;
  isEager?: boolean;
  isProtected?: boolean;
  onLinkClick?: (block: PageBlock) => void;
  onUnlock?: (block: PageBlock) => void;
}

export const FeaturedLink: React.FC<FeaturedLinkProps> = ({
  block,
  vibe,
  effectiveRadius,
  scale = 1,
  isInteractive = false,
  isEager = false,
  isProtected = false,
  onLinkClick,
  onUnlock,
}) => {
  const { tokens } = vibe;
  const [imageError, setImageError] = useState(false);

  const content = (
    <div
      className="w-full relative flex flex-col overflow-hidden transition-all duration-150 select-none text-left"
      style={{
        backgroundColor: tokens.buttonBg,
        color: tokens.buttonText,
        borderRadius: `${Math.round(effectiveRadius * scale)}px`,
        border: tokens.buttonBorder
          ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
          : 'none',
        boxShadow: tokens.buttonShadow || 'none',
      }}
    >
      {/* 16/9 aspect-ratio image */}
      {!imageError && block.thumbnailUrl && (
        <div className="w-full relative aspect-video overflow-hidden bg-black/5">
          <img
            src={block.thumbnailUrl}
            alt=""
            loading={isEager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover block"
          />

          {/* Protected chip in top-right corner (8px inset) */}
          {isProtected && (
            <div
              className="absolute top-2 right-2 flex items-center justify-center rounded-full shadow-xs pointer-events-none"
              style={{
                width: `${Math.round(28 * scale)}px`,
                height: `${Math.round(28 * scale)}px`,
                backgroundColor: `${tokens.bg}E6`, // 90% opacity
                border: `1px solid ${tokens.text}26`, // 15% opacity
                color: tokens.text,
              }}
              aria-hidden="true"
            >
              <Lock size={Math.round(14 * scale)} strokeWidth={1.5} />
            </div>
          )}
        </div>
      )}

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
          style={{ borderRadius: `${Math.round(effectiveRadius * scale)}px` }}
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
        style={{ borderRadius: `${Math.round(effectiveRadius * scale)}px` }}
      >
        {content}
      </a>
    );
  }

  return content;
};

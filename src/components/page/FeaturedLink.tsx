import React, { useState } from 'react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';

interface FeaturedLinkProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  scale?: number;
  isInteractive?: boolean;
  isEager?: boolean;
}

export const FeaturedLink: React.FC<FeaturedLinkProps> = ({
  block,
  vibe,
  effectiveRadius,
  scale = 1,
  isInteractive = false,
  isEager = false,
}) => {
  const { tokens } = vibe;
  const [imageError, setImageError] = useState(false);

  const content = (
    <div
      className="w-full flex flex-col overflow-hidden transition-all duration-150 select-none"
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
        <div className="w-full aspect-video overflow-hidden bg-black/5">
          <img
            src={block.thumbnailUrl}
            alt=""
            loading={isEager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover block"
          />
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

  if (isInteractive && block.url) {
    return (
      <a
        href={block.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="w-full block transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ borderRadius: `${Math.round(effectiveRadius * scale)}px` }}
      >
        {content}
      </a>
    );
  }

  return content;
};

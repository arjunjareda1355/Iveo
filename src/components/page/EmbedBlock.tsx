import React, { useState } from 'react';
import { Play, Music, Headphones } from 'lucide-react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { parseEmbedUrl } from '../../lib/embeds';

interface EmbedBlockProps {
  block: PageBlock;
  vibe: Vibe;
  effectiveRadius: number;
  embedMode: 'placeholder' | 'live';
  activeEmbedId: string | null;
  onActivate: (id: string) => void;
  scale?: number;
}

export const EmbedBlock: React.FC<EmbedBlockProps> = ({
  block,
  vibe,
  effectiveRadius,
  embedMode,
  activeEmbedId,
  onActivate,
  scale = 1,
}) => {
  const { tokens } = vibe;
  const parsed = parseEmbedUrl(block.url || '');
  const provider = parsed?.provider || block.embedProvider || 'youtube';

  const providerLabel =
    provider === 'youtube'
      ? 'YouTube'
      : provider === 'spotify'
        ? 'Spotify'
        : 'SoundCloud';

  const ProviderIcon =
    provider === 'youtube'
      ? Play
      : provider === 'spotify'
        ? Music
        : Headphones;

  const isActivePlayer = activeEmbedId === block.id;

  // Height calculations
  const defaultHeight =
    provider === 'youtube'
      ? Math.round(200 * scale)
      : parsed?.height
        ? Math.round(parsed.height * scale)
        : Math.round(152 * scale);

  // If in placeholder mode (phone previews), render non-interactive facade card
  if (embedMode === 'placeholder') {
    return (
      <div
        className="w-full relative flex flex-col items-center justify-center overflow-hidden transition-all duration-150 p-4 text-center"
        style={{
          minHeight: `${defaultHeight}px`,
          backgroundColor: tokens.buttonBg,
          color: tokens.buttonText,
          borderRadius: `${Math.round(effectiveRadius * scale)}px`,
          border: tokens.buttonBorder
            ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
            : 'none',
          boxShadow: tokens.buttonShadow || 'none',
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shrink-0"
          style={{
            backgroundColor: tokens.text,
            color: tokens.bg,
          }}
        >
          <ProviderIcon size={20} strokeWidth={1.5} />
        </div>
        <span className="text-[13px] font-medium leading-tight">
          {parsed?.label || `${providerLabel} player`}
        </span>
        {block.title && (
          <span
            className="text-[12px] opacity-75 mt-1 max-w-[90%] truncate leading-normal"
            style={{ color: tokens.text }}
          >
            {block.title}
          </span>
        )}
      </div>
    );
  }

  // Live mode on public page:
  // If active, render iframe
  if (isActivePlayer && parsed) {
    return (
      <div
        className="w-full overflow-hidden transition-all duration-150"
        style={{
          borderRadius: `${effectiveRadius}px`,
          height: parsed.height ? `${parsed.height}px` : undefined,
          aspectRatio: parsed.aspect || undefined,
        }}
      >
        <iframe
          src={parsed.embedSrc}
          title={block.title || parsed.label}
          loading="eager"
          allow="encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen={provider === 'youtube'}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          className="w-full h-full border-0 block"
          style={{ borderRadius: `${effectiveRadius}px` }}
        />
      </div>
    );
  }

  // Initial facade in live mode
  const playLabel = provider === 'youtube' ? 'Play' : 'Load player';
  const accessibleName =
    provider === 'youtube'
      ? `Play YouTube video ${block.title || ''}`.trim()
      : provider === 'spotify'
        ? `Load Spotify player ${block.title || ''}`.trim()
        : `Load SoundCloud player ${block.title || ''}`.trim();

  return (
    <div
      className="w-full relative flex flex-col items-center justify-center p-6 text-center transition-all duration-150"
      style={{
        minHeight: `${defaultHeight}px`,
        aspectRatio: parsed?.aspect || undefined,
        backgroundColor: tokens.buttonBg,
        color: tokens.buttonText,
        borderRadius: `${effectiveRadius}px`,
        border: tokens.buttonBorder
          ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
          : 'none',
        boxShadow: tokens.buttonShadow || 'none',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 shrink-0"
        style={{
          backgroundColor: tokens.text,
          color: tokens.bg,
        }}
      >
        <ProviderIcon size={24} strokeWidth={1.5} />
      </div>

      {block.title && (
        <h4 className="text-[15px] font-semibold mb-1 max-w-[85%] truncate">
          {block.title}
        </h4>
      )}

      <p className="text-[13px] font-medium opacity-85 mb-4">
        {parsed?.label || `${providerLabel} audio`}
      </p>

      <button
        type="button"
        aria-label={accessibleName}
        onClick={() => onActivate(block.id)}
        className="h-10 px-6 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 transition-transform duration-120 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: tokens.text,
          color: tokens.bg,
        }}
      >
        <Play size={15} fill="currentColor" />
        <span>{playLabel}</span>
      </button>

      <p className="mt-3 text-[12px] opacity-75">
        Content loads from {providerLabel} when you press play.
      </p>
    </div>
  );
};

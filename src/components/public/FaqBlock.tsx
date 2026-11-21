import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FaqConfig } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';
import { resolveCardBorderRadius } from '../../lib/preferences';
import { getBlockContrastPalette } from '../../lib/blockTheme';

interface FaqBlockProps {
  title?: string;
  config: FaqConfig;
  tokens: VibeTokens;
  buttonRadius: number;
  fontFamily?: string;
  scale?: number;
  surfaceStyle?: React.CSSProperties;
}

export const FaqBlock: React.FC<FaqBlockProps> = ({
  title,
  config,
  tokens,
  buttonRadius,
  fontFamily,
  scale = 1,
  surfaceStyle,
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const items = config.items || [];
  const cardRadius = resolveCardBorderRadius(buttonRadius, scale, 'card');

  const palette = getBlockContrastPalette(surfaceStyle, tokens);
  const baseSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    borderColor: tokens.buttonBorder,
    borderWidth: tokens.buttonBorderWidth || 1,
    borderStyle: 'solid',
    color: palette.fg,
  };

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="w-full flex flex-col gap-2" style={fontFamily ? { fontFamily } : undefined}>
      {title && (
        <div className="flex items-center gap-1.5 px-1 mb-0.5 opacity-80">
          <HelpCircle size={Math.round(14 * scale)} />
          <span
            className="font-medium uppercase tracking-wider"
            style={{ fontSize: `${Math.round(11 * scale)}px` }}
          >
            {title}
          </span>
        </div>
      )}

      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className="w-full overflow-hidden transition-all duration-200"
            style={{
              ...baseSurface,
              borderRadius: `${cardRadius}px`,
            }}
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="w-full text-left flex items-center justify-between p-3.5 gap-2 cursor-pointer transition-colors"
              aria-expanded={isOpen}
            >
              <span
                className="font-medium leading-snug flex-1 min-w-0"
                style={{ fontSize: `${Math.round(13 * scale)}px` }}
              >
                {item.question}
              </span>
              <ChevronDown
                size={Math.round(16 * scale)}
                className={`transition-transform duration-200 shrink-0 opacity-70 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div
                className="px-3.5 pb-3.5 pt-2 leading-relaxed border-t"
                style={{
                  fontSize: `${Math.round(12 * scale)}px`,
                  color: palette.muted,
                  borderColor: palette.subtleBorder,
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

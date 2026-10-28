import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FaqConfig } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';

interface FaqBlockProps {
  title?: string;
  config: FaqConfig;
  tokens: VibeTokens;
  buttonRadius: number;
  scale?: number;
}

export const FaqBlock: React.FC<FaqBlockProps> = ({
  title,
  config,
  tokens,
  buttonRadius,
  scale = 1,
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const items = config.items || [];

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
    <div className="w-full flex flex-col gap-2">
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
              backgroundColor: tokens.buttonBg,
              borderColor: tokens.buttonBorder,
              borderWidth: tokens.buttonBorderWidth || 1,
              borderStyle: 'solid',
              borderRadius: buttonRadius,
              color: tokens.buttonText || tokens.text,
            }}
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="w-full text-left flex items-center justify-between p-3.5 gap-2 cursor-pointer transition-colors"
              aria-expanded={isOpen}
            >
              <span
                className="font-medium leading-snug"
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
                className="px-3.5 pb-3.5 pt-1 opacity-80 leading-relaxed border-t border-current/10"
                style={{ fontSize: `${Math.round(12 * scale)}px` }}
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

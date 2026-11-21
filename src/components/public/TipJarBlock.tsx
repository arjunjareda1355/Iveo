import React, { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { TipJarConfig } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';
import { getBlockContrastPalette } from '../../lib/blockTheme';

interface TipJarBlockProps {
  config: TipJarConfig;
  tokens: VibeTokens;
  buttonRadius: number;
  fontFamily?: string;
  scale?: number;
  surfaceStyle?: React.CSSProperties;
  onAction?: () => void;
}

export const TipJarBlock: React.FC<TipJarBlockProps> = ({
  config,
  tokens,
  buttonRadius,
  fontFamily,
  scale = 1,
  surfaceStyle,
  onAction,
}) => {
  const currency = config.currency || '$';
  const amounts = config.amounts && config.amounts.length > 0 ? config.amounts : [3, 5, 10, 25];
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(amounts[0]);
  const [customVal, setCustomVal] = useState<string>('');

  const finalAmount = selectedAmount === 'custom' ? parseFloat(customVal) || 0 : selectedAmount;
  const cardRadius = resolveCardBorderRadius(buttonRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(buttonRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(buttonRadius, scale);

  const palette = getBlockContrastPalette(surfaceStyle, tokens);
  const baseSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    borderColor: tokens.buttonBorder,
    borderWidth: tokens.buttonBorderWidth || 1,
    borderStyle: 'solid',
    color: palette.fg,
  };
  const fg = palette.fg;

  const paymentHref = (() => {
    let url = config.paymentUrl || 'https://paypal.me';
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('upi://')) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('paypal.me') && finalAmount > 0) {
        url = `${url.replace(/\/+$/, '')}/${finalAmount}`;
      }
    } catch {}

    return url;
  })();

  return (
    <div
      className="w-full overflow-hidden flex flex-col items-center transition-all duration-200"
      style={{
        ...baseSurface,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(16 * scale)}px`,
        color: fg,
        fontFamily,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 max-w-full">
        <Heart size={Math.round(18 * scale)} className="text-red-500 fill-red-500 animate-pulse shrink-0" />
        <h4
          className="font-semibold text-center leading-tight truncate"
          style={{ fontSize: `${Math.round(15 * scale)}px` }}
        >
          {config.buttonText || 'Support my work'}
        </h4>
      </div>

      {config.description && (
        <p
          className="text-center opacity-75 mb-3 px-2 line-clamp-2"
          style={{ fontSize: `${Math.round(12 * scale)}px` }}
        >
          {config.description}
        </p>
      )}

      {/* Preset Amount Chips */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 w-full mb-3">
        {amounts.map((amt) => {
          const isSelected = selectedAmount === amt;
          return (
            <button
              key={amt}
              type="button"
              onClick={() => setSelectedAmount(amt)}
              className="px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer"
              style={{
                backgroundColor: isSelected ? palette.btnBg : 'transparent',
                color: isSelected ? palette.btnText : fg,
                border: `1px solid ${isSelected ? palette.btnBg : palette.subtleBorder}`,
                borderRadius: `${controlRadius}px`,
              }}
            >
              {currency}{amt}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedAmount('custom')}
          className="px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer"
          style={{
            backgroundColor: selectedAmount === 'custom' ? palette.btnBg : 'transparent',
            color: selectedAmount === 'custom' ? palette.btnText : fg,
            border: `1px solid ${selectedAmount === 'custom' ? palette.btnBg : palette.subtleBorder}`,
            borderRadius: `${controlRadius}px`,
          }}
        >
          Custom
        </button>
      </div>

      {/* Custom Amount Field */}
      {selectedAmount === 'custom' && (
        <div className="w-full flex items-center gap-2 mb-3 max-w-[200px]">
          <span className="font-semibold text-sm">{currency}</span>
          <input
            type="number"
            min="1"
            placeholder="Amount"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            className="w-full px-2.5 py-1 text-sm focus:outline-none"
            style={{
              borderRadius: `${innerRadius}px`,
              backgroundColor: palette.inputBg,
              border: `1px solid ${palette.inputBorder}`,
              color: fg,
            }}
          />
        </div>
      )}

      {/* Native Link Action Button */}
      <a
        href={paymentHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onAction?.()}
        onAuxClick={() => onAction?.()}
        className="w-full font-medium py-2 px-4 flex items-center justify-center gap-2 transition-transform duration-150 active:scale-[0.98] cursor-pointer"
        style={{
          borderRadius: `${controlRadius}px`,
          backgroundColor: palette.btnBg,
          color: palette.btnText,
          fontSize: `${Math.round(13 * scale)}px`,
        }}
      >
        <Sparkles size={Math.round(14 * scale)} />
        <span>
          Support {finalAmount > 0 ? `${currency}${finalAmount}` : ''}
        </span>
      </a>
    </div>
  );
};

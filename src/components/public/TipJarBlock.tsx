import React, { useState } from 'react';
import { Heart, DollarSign, Sparkles } from 'lucide-react';
import { TipJarConfig } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';

interface TipJarBlockProps {
  config: TipJarConfig;
  tokens: VibeTokens;
  buttonRadius: number;
  scale?: number;
}

export const TipJarBlock: React.FC<TipJarBlockProps> = ({
  config,
  tokens,
  buttonRadius,
  scale = 1,
}) => {
  const currency = config.currency || '$';
  const amounts = config.amounts && config.amounts.length > 0 ? config.amounts : [3, 5, 10, 25];
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(amounts[0]);
  const [customVal, setCustomVal] = useState<string>('');

  const finalAmount = selectedAmount === 'custom' ? parseFloat(customVal) || 0 : selectedAmount;

  const handlePay = () => {
    let url = config.paymentUrl || 'https://paypal.me';
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('upi://')) {
      url = `https://${url}`;
    }

    // Append amount if standard platform supported (e.g., paypal.me/user/10)
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('paypal.me') && finalAmount > 0) {
        url = `${url.replace(/\/+$/, '')}/${finalAmount}`;
      } else if (parsed.hostname.includes('buymeacoffee.com') && finalAmount > 0) {
        // BuyMeACoffee price query or direct link
      }
    } catch {}

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="w-full flex flex-col items-center transition-all duration-200"
      style={{
        backgroundColor: tokens.buttonBg,
        borderColor: tokens.buttonBorder,
        borderWidth: tokens.buttonBorderWidth || 1,
        borderStyle: 'solid',
        borderRadius: buttonRadius,
        padding: `${Math.round(18 * scale)}px ${Math.round(16 * scale)}px`,
        color: tokens.buttonText || tokens.text,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Heart size={Math.round(18 * scale)} className="text-red-500 fill-red-500 animate-pulse" />
        <h4
          className="font-semibold text-center leading-tight"
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
              className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer"
              style={{
                backgroundColor: isSelected ? tokens.text : 'transparent',
                color: isSelected ? tokens.bg : tokens.text,
                border: `1px solid ${isSelected ? tokens.text : tokens.buttonBorder || '#ccc'}`,
              }}
            >
              {currency}{amt}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedAmount('custom')}
          className="px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer"
          style={{
            backgroundColor: selectedAmount === 'custom' ? tokens.text : 'transparent',
            color: selectedAmount === 'custom' ? tokens.bg : tokens.text,
            border: `1px solid ${selectedAmount === 'custom' ? tokens.text : tokens.buttonBorder || '#ccc'}`,
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
            className="w-full px-2.5 py-1 text-sm rounded border border-current/30 bg-transparent focus:outline-none focus:border-current"
          />
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        onClick={handlePay}
        className="w-full font-medium py-2 px-4 flex items-center justify-center gap-2 transition-transform duration-150 active:scale-[0.98] cursor-pointer"
        style={{
          borderRadius: Math.max(buttonRadius - 4, 6),
          backgroundColor: tokens.text,
          color: tokens.bg,
          fontSize: `${Math.round(13 * scale)}px`,
        }}
      >
        <Sparkles size={Math.round(14 * scale)} />
        <span>
          Support {finalAmount > 0 ? `${currency}${finalAmount}` : ''}
        </span>
      </button>
    </div>
  );
};

import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import type { CardLookStyle } from '../../data/types';
import { CARD_LOOK_OPTIONS } from '../../lib/embedLooks';
import { normalizeHexColor, ensureContrastText } from '../../lib/colors';

interface CardLookTileGridProps {
  value: CardLookStyle;
  onChange: (look: CardLookStyle) => void;
  brandColor?: string;
  pageBg?: string;
  pageSurface?: string;
  pageText?: string;
  pageBorder?: string;
  pageAccent?: string;
  disabledLooks?: ReadonlySet<CardLookStyle>;
  disabledReason?: string;
  ariaLabel?: string;
}

export const CardLookTileGrid: React.FC<CardLookTileGridProps> = ({
  value,
  onChange,
  brandColor = '#0A66C2',
  pageBg = '#FFFFFF',
  pageSurface = '#FFFFFF',
  pageText = '#0A0A0A',
  pageBorder = '#E5E7EB',
  pageAccent = '#0A0A0A',
  disabledLooks,
  disabledReason,
  ariaLabel = 'Card look',
}) => {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cleanBrand = normalizeHexColor(brandColor) || '#0A66C2';
  const brandFg = ensureContrastText(null, cleanBrand, 4.5);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const enabledIndices = CARD_LOOK_OPTIONS.map((o, i) => (!disabledLooks?.has(o.id) ? i : -1)).filter(
      (i) => i >= 0
    );
    if (enabledIndices.length === 0) return;

    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const pos = enabledIndices.indexOf(idx);
      nextIdx = enabledIndices[(pos + 1) % enabledIndices.length];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pos = enabledIndices.indexOf(idx);
      nextIdx = enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length];
    }
    if (nextIdx !== null) {
      onChange(CARD_LOOK_OPTIONS[nextIdx].id);
      btnRefs.current[nextIdx]?.focus();
    }
  };

  const renderMiniature = (id: CardLookStyle) => {
    const safeSurface = normalizeHexColor(pageSurface) || '#FFFFFF';
    const safeText = ensureContrastText(pageText, safeSurface, 4.5);
    const mutedBar = safeText === '#FFFFFF' ? 'rgba(255,255,255,0.28)' : 'rgba(10,10,10,0.16)';
    const strongBar = safeText === '#FFFFFF' ? 'rgba(255,255,255,0.75)' : 'rgba(10,10,10,0.7)';

    if (id === 'match_page') {
      return (
        <div
          className="w-full h-full rounded-[8px] p-2 flex flex-col justify-between border"
          style={{
            backgroundColor: safeSurface,
            borderColor: pageBorder || '#E5E7EB',
          }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: mutedBar }} />
              <div className="flex flex-col gap-1">
                <span className="w-11 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
                <span className="w-7 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: strongBar }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="w-8 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
            <span className="w-9 h-1.5 rounded-full" style={{ backgroundColor: pageAccent || strongBar }} />
          </div>
        </div>
      );
    }

    if (id === 'brand') {
      return (
        <div
          className="w-full h-full rounded-[8px] p-2 flex flex-col justify-between border"
          style={{
            backgroundColor: safeSurface,
            borderColor: `${cleanBrand}55`,
          }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: `${cleanBrand}24` }} />
              <div className="flex flex-col gap-1">
                <span className="w-11 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
                <span className="w-7 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: cleanBrand }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="w-8 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
            <span
              className="w-10 h-3 rounded-[4px] flex items-center justify-center"
              style={{ backgroundColor: cleanBrand }}
            >
              <span className="w-5 h-1 rounded-full" style={{ backgroundColor: brandFg, opacity: 0.9 }} />
            </span>
          </div>
        </div>
      );
    }

    if (id === 'banner') {
      return (
        <div
          className="w-full h-full rounded-[8px] overflow-hidden flex flex-col justify-between border"
          style={{
            backgroundColor: safeSurface,
            borderColor: pageBorder || '#E5E7EB',
          }}
        >
          <div
            className="h-6 w-full relative shrink-0"
            style={{ background: `linear-gradient(135deg, ${cleanBrand}, #0A0A0A)` }}
          >
            <span
              className="absolute -bottom-2.5 left-2 w-5 h-5 rounded-full border-2"
              style={{ backgroundColor: mutedBar, borderColor: safeSurface }}
            />
          </div>
          <div className="px-2 pb-1.5 pt-2 flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="w-11 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
              <span className="w-7 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
            </div>
            <span className="w-8 h-2.5 rounded-[4px]" style={{ backgroundColor: cleanBrand }} />
          </div>
        </div>
      );
    }

    if (id === 'glass') {
      return (
        <div
          className="w-full h-full rounded-[8px] p-1.5 flex items-center justify-center overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${cleanBrand}55 0%, ${pageBg || '#E2E8F0'} 55%, ${cleanBrand}35 100%)`,
          }}
        >
          <div
            className="w-full h-full rounded-[6px] p-1.5 flex flex-col justify-between border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.68)',
              borderColor: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-black/15 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="w-10 h-1.5 rounded-full bg-black/65" />
                <span className="w-6 h-1 rounded-full bg-black/25" />
              </div>
            </div>
            <div className="flex justify-end">
              <span
                className="w-9 h-2.5 rounded-[4px] border"
                style={{ borderColor: cleanBrand }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (id === 'profile_card') {
      return (
        <div
          className="w-full h-full rounded-[8px] p-2 flex flex-col items-center justify-between border"
          style={{
            backgroundColor: safeSurface,
            borderColor: `${cleanBrand}44`,
          }}
        >
          <span
            className="w-5 h-5 rounded-full border-2 shrink-0"
            style={{
              backgroundColor: `${cleanBrand}22`,
              borderColor: cleanBrand,
            }}
          />
          <div className="flex flex-col items-center gap-1 w-full">
            <span className="w-11 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
            <span className="w-7 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
          </div>
          <span
            className="w-12 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: cleanBrand }}
          />
        </div>
      );
    }

    if (id === 'with_posts') {
      return (
        <div
          className="w-full h-full rounded-[8px] p-1.5 flex flex-col justify-between gap-1 border"
          style={{
            backgroundColor: safeSurface,
            borderColor: pageBorder || '#E5E7EB',
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: cleanBrand }} />
              <span className="w-9 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
            </div>
            <span className="w-5 h-2 rounded-[3px]" style={{ backgroundColor: cleanBrand }} />
          </div>
          <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
            <div
              className="rounded-[4px] p-1 flex flex-col justify-end border"
              style={{
                backgroundColor: `${cleanBrand}14`,
                borderColor: `${cleanBrand}30`,
              }}
            >
              <span className="w-full h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
            </div>
            <div
              className="rounded-[4px] p-1 flex flex-col justify-end border"
              style={{
                backgroundColor: `${cleanBrand}14`,
                borderColor: `${cleanBrand}30`,
              }}
            >
              <span className="w-full h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
            </div>
          </div>
        </div>
      );
    }

    // compact
    return (
      <div
        className="w-full h-full rounded-[8px] px-2 flex items-center justify-between gap-1.5 border"
        style={{
          backgroundColor: safeSurface,
          borderColor: pageBorder || '#E5E7EB',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: `${cleanBrand}2A` }} />
          <div className="flex flex-col gap-1">
            <span className="w-10 h-1.5 rounded-full" style={{ backgroundColor: strongBar }} />
            <span className="w-6 h-1 rounded-full" style={{ backgroundColor: mutedBar }} />
          </div>
        </div>
        <span className="w-7 h-3 rounded-[4px] shrink-0" style={{ backgroundColor: cleanBrand }} />
      </div>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
    >
      {CARD_LOOK_OPTIONS.map((option, idx) => {
        const isSelected = value === option.id;
        const isDisabled = Boolean(disabledLooks?.has(option.id));
        return (
          <button
            key={option.id}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={isDisabled ? disabledReason || `${option.label} is unavailable for this provider` : option.description}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onClick={() => {
              if (!isDisabled) onChange(option.id);
            }}
            className={`group relative flex flex-col gap-1.5 p-2 rounded-[12px] border text-left transition-all focus-visible:outline-2 focus-visible:outline-ink ${
              isDisabled
                ? 'opacity-45 cursor-not-allowed border-border bg-surface-2'
                : isSelected
                  ? 'border-ink ring-1 ring-ink bg-surface cursor-pointer'
                  : 'border-border bg-surface hover:border-border-strong cursor-pointer'
            }`}
          >
            <div className="w-full aspect-[4/3] relative rounded-[8px] overflow-hidden">
              {renderMiniature(option.id)}
              {isSelected && (
                <span
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-ink text-surface flex items-center justify-center shadow-xs"
                  aria-hidden="true"
                >
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </div>
            <span className="text-[13px] font-medium text-ink leading-tight px-0.5 truncate">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

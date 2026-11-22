import React, { useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import type { Color, Hex } from '../../lib/appearance/types';
import { hexToOklch } from '../../lib/color/oklch';
import { cappedOklchToHex, safeOklchToHex } from '../../lib/color/gamut';
import { parseColorToRgba, rgbaToHex } from '../../lib/color/contrast';

const RECENT_COLORS_KEY = 'iveo_recent_colors';

export function readRecentColors(): Hex[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    if (!raw) return ['#121212', '#FFFFFF', '#1F6FEB', '#0F766E', '#FB7185', '#D4AF37'];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 8) : ['#121212', '#FFFFFF'];
  } catch {
    return ['#121212', '#FFFFFF'];
  }
}

export function pushRecentColor(hex: string) {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
  const upper = hex.toUpperCase() as Hex;
  try {
    const prev = readRecentColors().filter((c) => c !== upper);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify([upper, ...prev].slice(0, 8)));
  } catch {}
}

export function normalizeInputHex(raw: string): Hex | null {
  const cleaned = raw.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}` as Hex;
  }
  if (/^[0-9A-F]{6}$/.test(cleaned)) {
    return `#${cleaned}` as Hex;
  }
  if (/^[0-9A-F]{8}$/.test(cleaned)) {
    return `#${cleaned.slice(0, 6)}` as Hex;
  }
  return null;
}

interface OklchColorPickerProps {
  value: Color;
  onChange: (hex: Hex) => void;
  suggestedSwatches?: readonly Hex[];
  suggestedLabel?: string;
  allowTransparent?: boolean;
  onSelectTransparent?: () => void;
}

export const OklchColorPicker: React.FC<OklchColorPickerProps> = ({
  value,
  onChange,
  suggestedSwatches = [],
  suggestedLabel = 'From your background',
  allowTransparent = false,
  onSelectTransparent,
}) => {
  const initialHex = (() => {
    if (value === 'transparent') return '#121212';
    const rgba = parseColorToRgba(value);
    return rgba ? rgbaToHex(rgba) : '#121212';
  })();

  const [oklch, setOklch] = useState(() => hexToOklch(initialHex));
  const [hexDraft, setHexDraft] = useState<string>(initialHex);
  const [recentColors, setRecentColors] = useState<Hex[]>(() => readRecentColors());
  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (value === 'transparent') return;
    const rgba = parseColorToRgba(value);
    if (!rgba) return;
    const hex = rgbaToHex(rgba);
    setHexDraft(hex);
    if (!draggingRef.current) {
      setOklch(hexToOklch(hex));
    }
  }, [value]);

  const commitOklch = (nextL: number, nextC: number, nextH: number) => {
    const L = Math.max(0.05, Math.min(0.99, nextL));
    const C = Math.max(0, Math.min(0.32, nextC));
    const h = ((nextH % 360) + 360) % 360;
    setOklch({ L, C, h });
    const hex = cappedOklchToHex({ L, C, h });
    setHexDraft(hex);
    onChange(hex);
  };

  const handleAreaPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const nextC = x * 0.26;
    const nextL = 0.99 - y * 0.94;
    commitOklch(nextL, nextC, oklch.h);
  };

  const hueColor = safeOklchToHex({ L: 0.68, C: 0.22, h: oklch.h });
  const markerLeftPct = Math.min(100, Math.max(0, (oklch.C / 0.26) * 100));
  const markerTopPct = Math.min(100, Math.max(0, ((0.99 - oklch.L) / 0.94) * 100));
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const handlePickEyedropper = async () => {
    try {
      const ED = (window as any).EyeDropper;
      if (!ED) return;
      const dropper = new ED();
      const res = await dropper.open();
      if (res?.sRGBHex) {
        const norm = normalizeInputHex(res.sRGBHex);
        if (norm) {
          pushRecentColor(norm);
          setRecentColors(readRecentColors());
          setOklch(hexToOklch(norm));
          setHexDraft(norm);
          onChange(norm);
        }
      }
    } catch {}
  };

  const selectSwatch = (hex: Hex) => {
    pushRecentColor(hex);
    setRecentColors(readRecentColors());
    setOklch(hexToOklch(hex));
    setHexDraft(hex);
    onChange(hex);
  };

  return (
    <div className="flex flex-col gap-3.5 select-none">
      {/* 2D OKLCH L x C area */}
      <div
        ref={areaRef}
        role="slider"
        aria-label="Lightness and saturation"
        aria-valuetext={`Lightness ${Math.round(oklch.L * 100)} percent, chroma ${Math.round(oklch.C * 100)}`}
        tabIndex={0}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          handleAreaPointer(e);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) handleAreaPointer(e);
        }}
        onPointerUp={() => {
          if (draggingRef.current) {
            draggingRef.current = false;
            pushRecentColor(hexDraft);
            setRecentColors(readRecentColors());
          }
        }}
        className="relative w-full h-36 rounded-[14px] border border-border overflow-hidden cursor-crosshair touch-none"
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,1) 100%), linear-gradient(90deg, #9CA3AF 0%, ${hueColor} 100%)`,
        }}
      >
        <span
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{
            left: `${markerLeftPct}%`,
            top: `${markerTopPct}%`,
            backgroundColor: hexDraft,
          }}
        />
      </div>

      {/* Hue Slider + Eyedropper */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <label className="sr-only" htmlFor="oklch-hue-range">Hue</label>
          <input
            id="oklch-hue-range"
            type="range"
            min={0}
            max={360}
            value={Math.round(oklch.h)}
            onChange={(e) => commitOklch(oklch.L, oklch.C, Number(e.target.value))}
            className="w-full h-3 rounded-full appearance-none cursor-pointer border border-border"
            style={{
              background:
                'linear-gradient(90deg, #EF4444 0%, #F59E0B 17%, #10B981 34%, #06B6D4 50%, #3B82F6 67%, #8B5CF6 84%, #EF4444 100%)',
            }}
          />
        </div>
        {hasEyeDropper && (
          <button
            type="button"
            onClick={() => void handlePickEyedropper()}
            aria-label="Pick colour from screen"
            title="Eyedropper"
            className="w-10 h-10 min-w-[40px] inline-flex items-center justify-center rounded-[10px] border border-border bg-surface hover:bg-surface-2 text-ink cursor-pointer"
          >
            <Pipette size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Hex Input + Transparent */}
      <div className="flex items-center gap-2">
        <span
          className="w-9 h-9 rounded-[10px] border border-border shrink-0"
          style={{
            backgroundColor: value === 'transparent' ? 'transparent' : hexDraft,
          }}
        />
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
          onBlur={() => {
            const norm = normalizeInputHex(hexDraft);
            if (norm) {
              selectSwatch(norm);
            } else {
              setHexDraft(initialHex);
            }
          }}
          aria-label="Hex colour value"
          placeholder="#121212"
          className="flex-1 min-w-0 h-10 px-3 rounded-[10px] border border-border bg-surface font-mono text-[13px] uppercase text-ink focus-visible:outline-2 focus-visible:outline-ink"
        />
        {allowTransparent && onSelectTransparent && (
          <button
            type="button"
            onClick={onSelectTransparent}
            className={`h-10 px-3 rounded-[10px] border text-[12px] font-medium whitespace-nowrap cursor-pointer ${
              value === 'transparent'
                ? 'border-ink bg-ink text-white'
                : 'border-border bg-surface text-ink hover:bg-surface-2'
            }`}
          >
            Transparent
          </button>
        )}
      </div>

      {/* OKLCH L & C Fine Sliders */}
      <div className="grid grid-cols-2 gap-3 text-[11px] text-muted">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between tabular-nums">
            <span>Lightness</span>
            <span>{Math.round(oklch.L * 100)}%</span>
          </span>
          <input
            type="range"
            min={5}
            max={99}
            value={Math.round(oklch.L * 100)}
            onChange={(e) => commitOklch(Number(e.target.value) / 100, oklch.C, oklch.h)}
            className="w-full accent-ink cursor-pointer"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between tabular-nums">
            <span>Intensity</span>
            <span>{Math.round((oklch.C / 0.28) * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.min(100, Math.round((oklch.C / 0.28) * 100))}
            onChange={(e) => commitOklch(oklch.L, (Number(e.target.value) / 100) * 0.28, oklch.h)}
            className="w-full accent-ink cursor-pointer"
          />
        </label>
      </div>

      {/* Suggested Safe Swatches */}
      {suggestedSwatches.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-divider">
          <span className="text-[11px] font-medium text-muted">{suggestedLabel}</span>
          <div className="flex items-center flex-wrap gap-2">
            {suggestedSwatches.map((sw) => (
              <button
                key={sw}
                type="button"
                onClick={() => selectSwatch(sw)}
                aria-label={`Select colour ${sw}`}
                className="w-9 h-9 min-w-[36px] rounded-full border border-border hover:scale-105 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
                style={{ backgroundColor: sw }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Swatches */}
      {recentColors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted">Recent</span>
          <div className="flex items-center flex-wrap gap-1.5">
            {recentColors.map((rc) => (
              <button
                key={rc}
                type="button"
                onClick={() => selectSwatch(rc)}
                aria-label={`Recent colour ${rc}`}
                className="w-8 h-8 rounded-full border border-border hover:scale-105 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
                style={{ backgroundColor: rc }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

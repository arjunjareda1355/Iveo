import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
import {
  ButtonColors,
  COLOR_SWATCHES,
  isValidHexColor,
  normalizeHexColor,
  resolveEffectiveTokens,
} from '../../lib/colors';
import type { Vibe } from '../../lib/vibes';
import { useToast } from '../ui/Toast';
import type { BackgroundConfig } from '../../data/types';

interface ButtonColorsPanelProps {
  currentColors?: ButtonColors | null;
  activeVibe: Vibe;
  background?: BackgroundConfig | null;
  onColorsChange: (next: ButtonColors | null) => Promise<void> | void;
  onPreviewColorsChange?: (next: ButtonColors | null) => void;
}

type ColorField = 'bg' | 'text' | 'border';

export const ButtonColorsPanel: React.FC<ButtonColorsPanelProps> = ({
  currentColors,
  activeVibe,
  background,
  onColorsChange,
  onPreviewColorsChange,
}) => {
  const { showToast } = useToast();

  const [colors, setColors] = useState<ButtonColors>(currentColors || {});
  const [inputs, setInputs] = useState<Record<ColorField, string>>({
    bg: currentColors?.bg || '',
    text: currentColors?.text || '',
    border: currentColors?.border || '',
  });
  const [errors, setErrors] = useState<Partial<Record<ColorField, string>>>({});

  useEffect(() => {
    setColors(currentColors || {});
    setInputs({
      bg: currentColors?.bg || '',
      text: currentColors?.text || '',
      border: currentColors?.border || '',
    });
    setErrors({});
  }, [currentColors]);

  const effectiveTokens = resolveEffectiveTokens(activeVibe.tokens, colors, background);

  const commitColors = async (next: ButtonColors | null, toastMsg?: string) => {
    const cleaned =
      next && (next.bg || next.text || next.border)
        ? {
            bg: next.bg ?? null,
            text: next.text ?? null,
            border: next.border ?? null,
          }
        : null;

    setColors(cleaned || {});
    onPreviewColorsChange?.(cleaned);

    try {
      await onColorsChange(cleaned);
      if (toastMsg) showToast(toastMsg);
    } catch {
      showToast("Couldn't save button colors");
    }
  };

  const applyFieldColor = async (field: ColorField, rawValue: string) => {
    const trimmed = rawValue.trim();
    setInputs((prev) => ({ ...prev, [field]: rawValue }));

    if (!trimmed) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      const next: ButtonColors = { ...colors, [field]: null };
      await commitColors(next);
      return;
    }

    const allowTransparent = field !== 'text';
    const normalized = normalizeHexColor(trimmed, { allowTransparent });
    if (!normalized) {
      setErrors((prev) => ({
        ...prev,
        [field]: 'Enter a valid 6-digit hex code like #2563EB',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setInputs((prev) => ({ ...prev, [field]: normalized }));
    const next: ButtonColors = { ...colors, [field]: normalized };
    await commitColors(next);
  };

  const handlePickerChange = (field: ColorField, hex: string) => {
    const upper = hex.toUpperCase();
    setInputs((prev) => ({ ...prev, [field]: upper }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    const next: ButtonColors = { ...colors, [field]: upper };
    setColors(next);
    onPreviewColorsChange?.(next);
  };

  const handlePickerCommit = async (field: ColorField, hex: string) => {
    const upper = hex.toUpperCase();
    const next: ButtonColors = { ...colors, [field]: upper };
    await commitColors(next);
  };

  const handleResetAll = async () => {
    setInputs({ bg: '', text: '', border: '' });
    setErrors({});
    await commitColors(null, 'Button colors reset to Vibe default');
  };

  const hasCustomColors = Boolean(colors.bg || colors.text || colors.border);

  const renderField = (
    field: ColorField,
    title: string,
    hint: string,
    defaultColor: string,
    allowTransparent: boolean
  ) => {
    const currentValue = colors[field];
    const pickerValue =
      currentValue && isValidHexColor(currentValue)
        ? currentValue
        : isValidHexColor(defaultColor)
          ? defaultColor
          : '#0A0A0A';
    const inputVal = inputs[field];
    const err = errors[field];

    return (
      <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-3 w-full min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-ink">{title}</h4>
            <p className="text-[12px] text-muted leading-snug">{hint}</p>
          </div>

          {currentValue && (
            <button
              type="button"
              onClick={() => applyFieldColor(field, '')}
              className="text-[11px] font-medium text-muted hover:text-ink underline cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {/* Color Picker + Direct Hex Input */}
        <div className="flex items-center gap-2 min-w-0 w-full">
          <label
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-border overflow-hidden shrink-0 cursor-pointer shadow-2xs"
            title={`Pick ${title.toLowerCase()}`}
            style={{
              backgroundColor:
                currentValue === 'transparent' ? 'transparent' : pickerValue,
              backgroundImage:
                currentValue === 'transparent'
                  ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                  : undefined,
              backgroundSize: '8px 8px',
            }}
          >
            <input
              type="color"
              aria-label={`${title} color picker`}
              value={pickerValue}
              onChange={(e) => handlePickerChange(field, e.target.value)}
              onBlur={(e) => handlePickerCommit(field, e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
            />
          </label>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center h-10 sm:h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-2.5 sm:px-3 focus-within:border-ink transition-colors gap-1.5">
              <span className="text-[12px] sm:text-[13px] font-mono text-muted select-none shrink-0">HEX</span>
              <input
                type="text"
                aria-label={`${title} hex color code`}
                value={inputVal}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputs((prev) => ({ ...prev, [field]: val }));
                  const norm = normalizeHexColor(val, { allowTransparent });
                  if (norm) {
                    setErrors((prev) => ({ ...prev, [field]: undefined }));
                    const next: ButtonColors = { ...colors, [field]: norm };
                    setColors(next);
                    onPreviewColorsChange?.(next);
                  }
                }}
                onBlur={(e) => applyFieldColor(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyFieldColor(field, (e.target as HTMLInputElement).value);
                  }
                }}
                placeholder={defaultColor.startsWith('#') ? defaultColor : '#0A0A0A'}
                className="flex-1 min-w-0 w-full bg-transparent font-mono text-[13px] text-ink outline-none uppercase"
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={() => applyFieldColor(field, inputVal)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md bg-ink text-surface hover:opacity-90 cursor-pointer shrink-0"
                >
                  Apply
                </button>
              )}
            </div>
            {err && <p className="mt-1 text-[11px] text-red-600 font-medium">{err}</p>}
          </div>
        </div>

        {/* Curated Swatches */}
        <div className="flex items-center flex-wrap gap-1.5 w-full">
          {allowTransparent && (
            <button
              type="button"
              onClick={() => applyFieldColor(field, 'transparent')}
              title="Transparent"
              className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                currentValue === 'transparent'
                  ? 'border-ink bg-surface text-ink font-semibold ring-1 ring-ink'
                  : 'border-border bg-surface text-muted hover:text-ink'
              }`}
            >
              Transparent
            </button>
          )}
          {COLOR_SWATCHES.map((swatch) => {
            const active = currentValue?.toUpperCase() === swatch.toUpperCase();
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => applyFieldColor(field, swatch)}
                aria-label={`Set ${title} to ${swatch}`}
                title={swatch}
                className={`w-7 h-7 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                  active
                    ? 'scale-110 ring-2 ring-ink ring-offset-1 border-white'
                    : 'border-black/15 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              >
                {active && (
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={
                      swatch === '#FFFFFF' || swatch === '#F8FAFC' || swatch === '#FACC15'
                        ? 'text-black'
                        : 'text-white'
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full min-w-0 max-w-full overflow-hidden">
      {/* Live Interactive Button Preview */}
      <div
        className="rounded-2xl border border-border p-4 sm:p-5 flex flex-col items-center gap-3 transition-colors w-full min-w-0 overflow-hidden"
        style={{
          backgroundColor: effectiveTokens.bg,
          color: effectiveTokens.text,
        }}
      >
        <div className="w-full flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono opacity-65">
          <span>BUTTON COLOR PREVIEW</span>
          <span className="truncate max-w-full">
            {effectiveTokens.buttonBg} · {effectiveTokens.buttonText}
          </span>
        </div>

        <div
          className="w-full max-w-[300px] h-11 px-4 flex items-center justify-center font-medium text-[14px] transition-all"
          style={{
            backgroundColor: effectiveTokens.buttonBg,
            color: effectiveTokens.buttonText,
            borderRadius: `${activeVibe.tokens.buttonRadius}px`,
            border: effectiveTokens.buttonBorder
              ? `${effectiveTokens.buttonBorderWidth || '1px'} solid ${effectiveTokens.buttonBorder}`
              : 'none',
            boxShadow: effectiveTokens.buttonShadow || 'none',
          }}
        >
          Portfolio &amp; Latest Work
        </div>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5 min-w-0">
          <Palette size={13} className="shrink-0" />
          <span className="truncate">Custom Button Colors (Hex or Picker)</span>
        </span>
        {hasCustomColors && (
          <button
            type="button"
            onClick={handleResetAll}
            className="text-[12px] text-muted hover:text-ink flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw size={12} />
            <span>Reset to Vibe default</span>
          </button>
        )}
      </div>

      {renderField(
        'bg',
        'Button Fill Color',
        'Enter any #RRGGBB hex code, pick a color, or use Transparent.',
        activeVibe.tokens.buttonBg,
        true
      )}

      {renderField(
        'text',
        'Button Text Color',
        'Auto-contrasts when left blank, or set an explicit hex color.',
        activeVibe.tokens.buttonText,
        false
      )}

      {renderField(
        'border',
        'Button Border Color',
        'Outline color around your link buttons (supports Transparent).',
        activeVibe.tokens.buttonBorder || '#0A0A0A',
        true
      )}
    </div>
  );
};

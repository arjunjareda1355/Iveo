import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import {
  BUSINESS_CARD_TEMPLATES,
  BusinessCardConfig,
  BusinessCardCornerStyle,
  BusinessCardTemplate,
  DEFAULT_BUSINESS_CARD_CONFIG,
} from '../../lib/businessCardConfig';
import { FONT_OPTIONS } from '../../lib/fonts';
import { COLOR_SWATCHES, normalizeHexColor } from '../../lib/colors';

interface BusinessCardCustomizerProps {
  value: BusinessCardConfig;
  onChange: (next: BusinessCardConfig) => void;
  onSave?: (next: BusinessCardConfig) => Promise<void> | void;
  isSaving?: boolean;
}

const CORNER_OPTIONS: { id: BusinessCardCornerStyle; label: string }[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'pill', label: 'Soft Pill' },
];

export const BusinessCardCustomizer: React.FC<BusinessCardCustomizerProps> = ({
  value,
  onChange,
  onSave,
  isSaving = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const update = (patch: Partial<BusinessCardConfig>) => {
    onChange({
      ...DEFAULT_BUSINESS_CARD_CONFIG,
      ...value,
      ...patch,
    });
  };

  const handleHexInput = (key: 'bgColor' | 'accentColor' | 'textColor', raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      update({ [key]: null });
      return;
    }
    const normalized = normalizeHexColor(trimmed);
    if (normalized) {
      update({ [key]: normalized });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted" />
          <span>Customize Card Style &amp; Details</span>
        </span>
        {isOpen ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
      </button>

      {isOpen && (
        <div className="px-3.5 pb-4 pt-2 border-t border-border/70 flex flex-col gap-3.5">
          {/* 1. Template Picker */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1.5">
              Card Template
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BUSINESS_CARD_TEMPLATES.map((tpl) => {
                const active = (value.template || 'classic') === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => update({ template: tpl.id as BusinessCardTemplate })}
                    className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-ink bg-surface text-ink shadow-2xs ring-1 ring-ink'
                        : 'border-border bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Colors (Background, Accent, Text) with Color Picker + Hex */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                { key: 'bgColor', label: 'Card BG' },
                { key: 'accentColor', label: 'Accent' },
                { key: 'textColor', label: 'Text' },
              ] as const
            ).map((item) => {
              const currentHex = value[item.key] || '';
              return (
                <div key={item.key} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted">{item.label}</span>
                  <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-surface">
                    <input
                      type="color"
                      aria-label={`${item.label} picker`}
                      value={currentHex || '#0F172A'}
                      onChange={(e) => update({ [item.key]: e.target.value.toUpperCase() })}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      aria-label={`${item.label} hex`}
                      defaultValue={currentHex}
                      key={`${item.key}-${currentHex}`}
                      onBlur={(e) => handleHexInput(item.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleHexInput(item.key, (e.target as HTMLInputElement).value);
                        }
                      }}
                      placeholder="Theme"
                      className="w-full text-[11px] font-mono text-ink bg-transparent outline-none uppercase"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Accent Swatches */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted mr-1">Accent:</span>
            {COLOR_SWATCHES.slice(0, 8).map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => update({ accentColor: hex })}
                aria-label={`Set card accent ${hex}`}
                className={`w-5 h-5 rounded-full border border-black/15 cursor-pointer transition-transform ${
                  value.accentColor === hex ? 'scale-115 ring-2 ring-ink ring-offset-1' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          {/* 3. Font & Corner Shape */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">
                Card Font
              </label>
              <select
                value={value.fontId || ''}
                onChange={(e) => update({ fontId: (e.target.value || null) as any })}
                className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none"
              >
                <option value="">Default (Vibe Font)</option>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.isPro ? '· Pro' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[11px] font-medium text-muted block mb-1">
                Corners
              </span>
              <div className="grid grid-cols-3 gap-1 h-9 p-0.5 rounded-lg border border-border bg-surface">
                {CORNER_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ cornerStyle: c.id })}
                    className={`rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                      (value.cornerStyle || 'rounded') === c.id
                        ? 'bg-ink text-surface'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Optional Details (Role, Company/Location, Email, Phone, Badge) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={value.role || ''}
              onChange={(e) => update({ role: e.target.value.slice(0, 60) })}
              placeholder="Role / Title (e.g. Designer)"
              className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
            />
            <input
              type="text"
              value={value.companyOrLocation || ''}
              onChange={(e) => update({ companyOrLocation: e.target.value.slice(0, 60) })}
              placeholder="Company or City"
              className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
            />
            <input
              type="email"
              value={value.contactEmail || ''}
              onChange={(e) => update({ contactEmail: e.target.value.slice(0, 120) })}
              placeholder="Email on card (optional)"
              className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
            />
            <input
              type="tel"
              value={value.contactPhone || ''}
              onChange={(e) => update({ contactPhone: e.target.value.slice(0, 40) })}
              placeholder="Phone on card (optional)"
              className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
            />
          </div>

          <input
            type="text"
            value={value.badgeText || ''}
            onChange={(e) => update({ badgeText: e.target.value.slice(0, 32) })}
            placeholder="Top badge label (e.g. Available for projects)"
            className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
          />

          {/* 5. Visibility Toggles & Save/Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-3 text-[12px] text-ink">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.showAvatar !== false}
                  onChange={(e) => update({ showAvatar: e.target.checked })}
                  className="accent-ink"
                />
                <span>Show Avatar</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.showQr !== false}
                  onChange={(e) => update({ showQr: e.target.checked })}
                  className="accent-ink"
                />
                <span>Show QR</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...DEFAULT_BUSINESS_CARD_CONFIG })}
                className="text-[11px] text-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
              {onSave && (
                <button
                  type="button"
                  onClick={() => onSave(value)}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-lg bg-ink text-surface text-[12px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  <Save size={12} />
                  <span>{isSaving ? 'Saving...' : 'Save card design'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

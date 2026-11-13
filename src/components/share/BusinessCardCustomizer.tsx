import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Palette,
  FileText,
  LayoutTemplate,
  AlertTriangle,
} from 'lucide-react';
import {
  BUSINESS_CARD_TEMPLATES,
  BusinessCardConfig,
  BusinessCardCornerStyle,
  BusinessCardTemplate,
  DEFAULT_BUSINESS_CARD_CONFIG,
} from '../../lib/businessCardConfig';
import { FONT_OPTIONS } from '../../lib/fonts';
import { COLOR_SWATCHES, normalizeHexColor } from '../../lib/colors';
import { getHexContrastRatio } from '../../lib/qr';

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

type CustomizerTab = 'style' | 'details' | 'layout';

export const BusinessCardCustomizer: React.FC<BusinessCardCustomizerProps> = ({
  value,
  onChange,
  onSave,
  isSaving = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomizerTab>('style');

  const update = (patch: Partial<BusinessCardConfig>) => {
    onChange({
      ...DEFAULT_BUSINESS_CARD_CONFIG,
      ...value,
      ...patch,
    });
  };

  const handleHexInput = (
    key: 'bgColor' | 'bgColor2' | 'accentColor' | 'textColor' | 'qrFgColor' | 'qrBgColor',
    raw: string
  ) => {
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

  const qrFg = value.qrFgColor || '#0A0A0A';
  const qrBg = value.qrBgColor || '#FFFFFF';
  const qrContrast = getHexContrastRatio(qrFg, qrBg);
  const lowQrContrast = value.showQr !== false && qrContrast < 3.0;

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
        <div className="px-3.5 pb-4 pt-2.5 border-t border-border/70 flex flex-col gap-3.5">
          {/* Sub-tab switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface border border-border">
            {(
              [
                { id: 'style', label: 'Style', icon: Palette },
                { id: 'details', label: 'Details', icon: FileText },
                { id: 'layout', label: 'Layout', icon: LayoutTemplate },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-7 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-ink text-surface shadow-2xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: STYLE */}
          {activeTab === 'style' && (
            <div className="flex flex-col gap-3">
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

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'bgColor', label: 'Card BG', fallback: '#0F172A' },
                    { key: 'bgColor2', label: 'Gradient 2 (Opt)', fallback: '#1E293B' },
                    { key: 'accentColor', label: 'Accent', fallback: '#4F46E5' },
                    { key: 'textColor', label: 'Text', fallback: '#FFFFFF' },
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
                          value={currentHex || item.fallback}
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
                          placeholder="Auto"
                          className="w-full text-[11px] font-mono text-ink bg-transparent outline-none uppercase"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

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
            </div>
          )}

          {/* TAB 2: DETAILS */}
          {activeTab === 'details' && (
            <div className="flex flex-col gap-2">
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
                  onChange={(e) => update({ contactEmail: e.target.value.slice(0, 100) })}
                  placeholder="Email on card (optional)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
                <input
                  type="tel"
                  value={value.contactPhone || ''}
                  onChange={(e) => update({ contactPhone: e.target.value.slice(0, 32) })}
                  placeholder="Phone on card (optional)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
              </div>

              <input
                type="text"
                value={value.websiteUrl || ''}
                onChange={(e) => update({ websiteUrl: e.target.value.slice(0, 80) })}
                placeholder="Footer label / Website (defaults to iveo.site/username)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
              />

              <input
                type="text"
                value={value.badgeText || ''}
                onChange={(e) => update({ badgeText: e.target.value.slice(0, 28) })}
                placeholder="Top badge label (e.g. Available for projects)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
              />
            </div>
          )}

          {/* TAB 3: LAYOUT & QR */}
          {activeTab === 'layout' && (
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[11px] font-medium text-muted block mb-1">
                  Card Corners
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

              <div>
                <span className="text-[11px] font-medium text-muted block mb-1.5">
                  Visible Sections
                </span>
                <div className="grid grid-cols-2 gap-2 text-[12px] text-ink">
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
                      checked={value.showBio !== false}
                      onChange={(e) => update({ showBio: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Show Bio</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.showHandle !== false}
                      onChange={(e) => update({ showHandle: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Show @handle</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.showQr !== false}
                      onChange={(e) => update({ showQr: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Show QR Code</span>
                  </label>
                </div>
              </div>

              {value.showQr !== false && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                  <span className="text-[11px] font-medium text-muted">
                    Card QR Colors
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'qrFgColor', label: 'QR Foreground', fallback: '#0A0A0A' },
                        { key: 'qrBgColor', label: 'QR Background', fallback: '#FFFFFF' },
                      ] as const
                    ).map((item) => {
                      const currentHex = value[item.key] || item.fallback;
                      return (
                        <div key={item.key} className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted">{item.label}</span>
                          <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-surface">
                            <input
                              type="color"
                              aria-label={`${item.label} picker`}
                              value={currentHex}
                              onChange={(e) => update({ [item.key]: e.target.value.toUpperCase() })}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                            />
                            <input
                              type="text"
                              aria-label={`${item.label} hex`}
                              defaultValue={value[item.key] || ''}
                              key={`${item.key}-${value[item.key] || ''}`}
                              onBlur={(e) => handleHexInput(item.key, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleHexInput(item.key, (e.target as HTMLInputElement).value);
                                }
                              }}
                              placeholder={item.fallback}
                              className="w-full text-[11px] font-mono text-ink bg-transparent outline-none uppercase"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {lowQrContrast && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span>Low QR contrast ({qrContrast}:1) may reduce phone camera scan reliability.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_BUSINESS_CARD_CONFIG })}
              className="text-[11px] text-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset card</span>
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
      )}
    </div>
  );
};

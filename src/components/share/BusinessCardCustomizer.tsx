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
  Sparkles,
} from 'lucide-react';
import {
  BUSINESS_CARD_TEMPLATES,
  BusinessCardConfig,
  BusinessCardCornerStyle,
  BusinessCardTemplate,
  DEFAULT_BUSINESS_CARD_CONFIG,
  METALLIC_CARD_VIBES,
  MetallicCardVibe,
} from '../../lib/businessCardConfig';
import { FONT_OPTIONS } from '../../lib/fonts';
import { COLOR_SWATCHES, normalizeHexColor } from '../../lib/colors';
import { getHexContrastRatio } from '../../lib/qr';

interface BusinessCardCustomizerProps {
  value: BusinessCardConfig;
  onChange: (next: BusinessCardConfig) => void;
  onSave?: (next: BusinessCardConfig) => Promise<void> | void;
  onSelectSide?: (side: 'front' | 'back') => void;
  isSaving?: boolean;
}

const CORNER_OPTIONS: { id: BusinessCardCornerStyle; label: string }[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'pill', label: 'Soft Pill' },
];

type CustomizerTab = 'vibe' | 'colors' | 'details';

type HexColorKey =
  | 'bgColor'
  | 'bgColor2'
  | 'accentColor'
  | 'textColor'
  | 'backBgColor'
  | 'backBgColor2'
  | 'backAccentColor'
  | 'backTextColor'
  | 'qrFgColor'
  | 'qrBgColor';

export const BusinessCardCustomizer: React.FC<BusinessCardCustomizerProps> = ({
  value,
  onChange,
  onSave,
  onSelectSide,
  isSaving = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomizerTab>('vibe');

  const update = (patch: Partial<BusinessCardConfig>) => {
    onChange({
      ...DEFAULT_BUSINESS_CARD_CONFIG,
      ...value,
      ...patch,
    });
  };

  const applyMetallicVibe = (vibeId: MetallicCardVibe) => {
    const preset = METALLIC_CARD_VIBES.find((v) => v.id === vibeId);
    update({
      metallicVibe: vibeId,
      metallicFinish: true,
      bgColor: null,
      bgColor2: null,
      textColor: null,
      accentColor: null,
      backBgColor: null,
      backBgColor2: null,
      backTextColor: null,
      backAccentColor: null,
      qrFgColor: preset?.qrFg || null,
      qrBgColor: preset?.qrBg || null,
    });
  };

  const handleHexInput = (key: HexColorKey, raw: string) => {
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

  const renderColorInput = (key: HexColorKey, label: string, fallback: string, sideHint?: 'front' | 'back') => {
    const currentHex = value[key] || '';
    return (
      <div key={key} className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">{label}</span>
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-surface">
          <input
            type="color"
            aria-label={`${label} picker`}
            value={currentHex || fallback}
            onChange={(e) => {
              if (sideHint) onSelectSide?.(sideHint);
              update({ [key]: e.target.value.toUpperCase() });
            }}
            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
          />
          <input
            type="text"
            aria-label={`${label} hex`}
            defaultValue={currentHex}
            key={`${key}-${currentHex}`}
            onFocus={() => {
              if (sideHint) onSelectSide?.(sideHint);
            }}
            onBlur={(e) => handleHexInput(key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleHexInput(key, (e.target as HTMLInputElement).value);
              }
            }}
            placeholder="Auto"
            className="w-full text-[11px] font-mono text-ink bg-transparent outline-none uppercase"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        data-testid="card-customizer-toggle"
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted" />
          <span>Customize Metallic Vibe, Front &amp; Back Colors</span>
        </span>
        {isOpen ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
      </button>

      {isOpen && (
        <div className="px-3.5 pb-4 pt-2.5 border-t border-border/70 flex flex-col gap-3.5">
          {/* Sub-tab switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface border border-border">
            {(
              [
                { id: 'vibe', label: 'Metallic Vibes', icon: Sparkles },
                { id: 'colors', label: 'Front & Back', icon: Palette },
                { id: 'details', label: 'Details & QR', icon: FileText },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-7 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
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

          {/* TAB 1: METALLIC VIBES & TEMPLATE */}
          {activeTab === 'vibe' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Metallic Dual-Tone Vibes
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.metallicFinish !== false}
                      onChange={(e) => update({ metallicFinish: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Metallic Sheen</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {METALLIC_CARD_VIBES.map((preset) => {
                    const active = (value.metallicVibe || 'obsidian') === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyMetallicVibe(preset.id)}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'border-ink bg-surface ring-1 ring-ink shadow-2xs'
                            : 'border-border bg-surface hover:border-ink/40'
                        }`}
                      >
                        <div className="w-7 h-5 rounded overflow-hidden border border-black/15 shrink-0 flex">
                          <span
                            className="flex-1 h-full"
                            style={{
                              background: `linear-gradient(135deg, ${preset.frontBg}, ${preset.frontBg2})`,
                            }}
                          />
                          <span
                            className="flex-1 h-full"
                            style={{
                              background: `linear-gradient(135deg, ${preset.backBg}, ${preset.backBg2})`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-ink truncate">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => applyMetallicVibe('page-vibe')}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      value.metallicVibe === 'page-vibe'
                        ? 'border-ink bg-surface ring-1 ring-ink shadow-2xs'
                        : 'border-border bg-surface hover:border-ink/40'
                    }`}
                  >
                    <div className="w-7 h-5 rounded border border-border bg-gradient-to-br from-indigo-500/30 via-surface to-zinc-800/30 shrink-0" />
                    <span className="text-[11px] font-medium text-ink truncate">
                      Match Page Vibe
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1.5">
                  Card Finish &amp; Frame
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
                        className={`rounded-md text-[10px] font-medium cursor-pointer transition-colors ${
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
                  <label className="text-[11px] font-medium text-muted block mb-1">
                    Card Font
                  </label>
                  <select
                    value={value.fontId || ''}
                    onChange={(e) => update({ fontId: (e.target.value || null) as any })}
                    className="w-full h-9 px-2 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none"
                  >
                    <option value="">Default Font</option>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.isPro ? '· Pro' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FRONT & BACK DUAL COLOR TONE */}
          {activeTab === 'colors' && (
            <div className="flex flex-col gap-3.5">
              {/* Front Side Colors */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                    <LayoutTemplate size={12} />
                    <span>Front Side Dual Color Tone</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectSide?.('front')}
                    className="text-[11px] font-medium text-ink hover:underline cursor-pointer"
                  >
                    View Front
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderColorInput('bgColor', 'Front Tone 1', '#1C1C21', 'front')}
                  {renderColorInput('bgColor2', 'Front Tone 2', '#070709', 'front')}
                  {renderColorInput('textColor', 'Front Text', '#FFFFFF', 'front')}
                  {renderColorInput('accentColor', 'Front Accent', '#D4D4D8', 'front')}
                </div>
              </div>

              {/* Back Side Colors */}
              <div className="flex flex-col gap-2 pt-2.5 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                    <Palette size={12} />
                    <span>Back Side Dual Color Tone</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectSide?.('back')}
                    className="text-[11px] font-medium text-ink hover:underline cursor-pointer"
                  >
                    View Back
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderColorInput('backBgColor', 'Back Tone 1', '#FFFFFF', 'back')}
                  {renderColorInput('backBgColor2', 'Back Tone 2', '#ECEFF4', 'back')}
                  {renderColorInput('backTextColor', 'Back Text', '#0A0A0A', 'back')}
                  {renderColorInput('backAccentColor', 'Back Accent', '#27272A', 'back')}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-muted mr-1">Quick Accents:</span>
                {COLOR_SWATCHES.slice(0, 7).map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => update({ accentColor: hex, backAccentColor: hex })}
                    aria-label={`Set front and back accent ${hex}`}
                    className={`w-5 h-5 rounded-full border border-black/15 cursor-pointer transition-transform ${
                      value.accentColor === hex ? 'scale-115 ring-2 ring-ink ring-offset-1' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DETAILS & BACK SETTINGS */}
          {activeTab === 'details' && (
            <div className="flex flex-col gap-3">
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
                  placeholder="Email on front (optional)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
                <input
                  type="tel"
                  value={value.contactPhone || ''}
                  onChange={(e) => update({ contactPhone: e.target.value.slice(0, 32) })}
                  placeholder="Phone on front (optional)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={value.websiteUrl || ''}
                  onChange={(e) => update({ websiteUrl: e.target.value.slice(0, 80) })}
                  placeholder="Website label (defaults to iveo.site/@you)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
                <input
                  type="text"
                  value={value.badgeText || ''}
                  onChange={(e) => update({ badgeText: e.target.value.slice(0, 28) })}
                  placeholder="Front badge (e.g. Founder)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                <input
                  type="text"
                  value={value.backHeadline ?? 'Scan to'}
                  onFocus={() => onSelectSide?.('back')}
                  onChange={(e) => update({ backHeadline: e.target.value.slice(0, 36) })}
                  placeholder="Back line 1 (Scan to)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
                <input
                  type="text"
                  value={value.backSubheadline ?? 'open my page.'}
                  onFocus={() => onSelectSide?.('back')}
                  onChange={(e) => update({ backSubheadline: e.target.value.slice(0, 44) })}
                  placeholder="Back italic line (open my page.)"
                  className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[12px] text-ink outline-none focus:border-ink"
                />
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
                    <span>Show Front Logo</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.showBio !== false}
                      onChange={(e) => update({ showBio: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Show Front Bio</span>
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
                      checked={value.showSocialsOnBack !== false}
                      onChange={(e) => update({ showSocialsOnBack: e.target.checked })}
                      className="accent-ink"
                    />
                    <span>Social Links on Back</span>
                  </label>
                </div>
              </div>

              {value.showQr !== false && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                  <span className="text-[11px] font-medium text-muted">
                    Back QR Colors
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {renderColorInput('qrFgColor', 'QR Dots', '#0A0A0A', 'back')}
                    {renderColorInput('qrBgColor', 'QR Box BG', '#FFFFFF', 'back')}
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

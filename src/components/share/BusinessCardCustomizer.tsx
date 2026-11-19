import React, { useState } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Save,
  Palette,
  FileText,
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
import { Toggle } from '../ui/Toggle';

interface BusinessCardCustomizerProps {
  value: BusinessCardConfig;
  onChange: (next: BusinessCardConfig) => void;
  onSave?: (next: BusinessCardConfig) => Promise<void> | void;
  onSelectSide?: (side: 'front' | 'back') => void;
  isSaving?: boolean;
  hideSave?: boolean;
}

const CORNER_OPTIONS: { id: BusinessCardCornerStyle; label: string }[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'pill', label: 'Pill' },
];

type CustomizerSection = 'vibe' | 'colors' | 'details';

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
  hideSave = false,
}) => {
  const [openSection, setOpenSection] = useState<CustomizerSection | null>(null);

  const toggleSection = (section: CustomizerSection) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

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
      qrFgColor: vibeId === 'page-vibe' ? null : preset?.qrFg || null,
      qrBgColor: vibeId === 'page-vibe' ? null : preset?.qrBg || null,
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
  const currentMetallicVibe = value.metallicVibe || 'page-vibe';

  const renderColorInput = (
    key: HexColorKey,
    label: string,
    fallback: string,
    sideHint?: 'front' | 'back'
  ) => {
    const currentHex = value[key] || '';
    return (
      <div key={key} className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <div className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border bg-surface">
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
            className="w-full text-[12px] font-mono text-ink bg-transparent outline-none uppercase"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid="card-customizer">
      {/* Accordion 1: Card finishes & frame */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('vibe')}
          aria-expanded={openSection === 'vibe'}
          data-testid="card-customizer-vibe-toggle"
          className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-muted shrink-0" />
            <span>Finishes &amp; frame</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-150 ${
              openSection === 'vibe' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSection === 'vibe' && (
          <div className="px-3.5 pb-4 pt-3 border-t border-border/70 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-ink">Metallic sheen</span>
                <span className="text-[12px] text-muted">Subtle brushed highlight on card surfaces</span>
              </div>
              <Toggle
                checked={value.metallicFinish !== false}
                onChange={() => update({ metallicFinish: !(value.metallicFinish !== false) })}
                ariaLabel="Toggle metallic sheen"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">Card finishes</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyMetallicVibe('page-vibe')}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    currentMetallicVibe === 'page-vibe'
                      ? 'border-ink bg-surface ring-1 ring-ink'
                      : 'border-border bg-surface hover:border-ink/40'
                  }`}
                >
                  <div className="w-7 h-5 rounded border border-border bg-gradient-to-br from-indigo-500/30 via-surface to-zinc-800/30 shrink-0" />
                  <span className="text-[12px] font-medium text-ink truncate">
                    Match page vibe
                  </span>
                </button>

                {METALLIC_CARD_VIBES.map((preset) => {
                  const active = currentMetallicVibe === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyMetallicVibe(preset.id)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                        active
                          ? 'border-ink bg-surface ring-1 ring-ink'
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
                      <span className="text-[12px] font-medium text-ink truncate">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">Frame style</span>
              <div className="flex flex-wrap gap-1.5">
                {BUSINESS_CARD_TEMPLATES.map((tpl) => {
                  const active = (value.template || 'classic') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => update({ template: tpl.id as BusinessCardTemplate })}
                      className={`py-1.5 px-2.5 rounded-lg border text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? 'border-ink bg-surface text-ink ring-1 ring-ink'
                          : 'border-border bg-surface text-muted hover:text-ink'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span className="text-[12px] font-medium text-muted block mb-1">
                  Corners
                </span>
                <div className="grid grid-cols-3 gap-1 h-9 p-0.5 rounded-lg border border-border bg-surface-2">
                  {CORNER_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => update({ cornerStyle: c.id })}
                      className={`rounded-md text-[12px] font-medium cursor-pointer transition-colors ${
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
                <label className="text-[12px] font-medium text-muted block mb-1">
                  Card font
                </label>
                <select
                  value={value.fontId || ''}
                  onChange={(e) => update({ fontId: (e.target.value || null) as any })}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none"
                >
                  <option value="">Default font</option>
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
      </div>

      {/* Accordion 2: Front & back colors */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('colors')}
          aria-expanded={openSection === 'colors'}
          data-testid="card-customizer-colors-toggle"
          className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Palette size={15} className="text-muted shrink-0" />
            <span>Front &amp; back colors</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-150 ${
              openSection === 'colors' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSection === 'colors' && (
          <div className="px-3.5 pb-4 pt-3 border-t border-border/70 flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink">Front colors</span>
              <div className="grid grid-cols-2 gap-2">
                {renderColorInput('bgColor', 'Front tone 1', '#1C1C21', 'front')}
                {renderColorInput('bgColor2', 'Front tone 2', '#070709', 'front')}
                {renderColorInput('textColor', 'Front text', '#FFFFFF', 'front')}
                {renderColorInput('accentColor', 'Front accent', '#D4D4D8', 'front')}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2.5 border-t border-border/70">
              <span className="text-[13px] font-medium text-ink">Back colors</span>
              <div className="grid grid-cols-2 gap-2">
                {renderColorInput('backBgColor', 'Back tone 1', '#FFFFFF', 'back')}
                {renderColorInput('backBgColor2', 'Back tone 2', '#ECEFF4', 'back')}
                {renderColorInput('backTextColor', 'Back text', '#0A0A0A', 'back')}
                {renderColorInput('backAccentColor', 'Back accent', '#27272A', 'back')}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[12px] text-muted mr-1">Quick accents:</span>
              {COLOR_SWATCHES.slice(0, 7).map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => update({ accentColor: hex, backAccentColor: hex })}
                  aria-label={`Set front and back accent ${hex}`}
                  className={`w-5 h-5 rounded-full border border-black/15 cursor-pointer transition-transform ${
                    value.accentColor === hex
                      ? 'scale-115 ring-2 ring-ink ring-offset-1'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: Details & QR */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('details')}
          aria-expanded={openSection === 'details'}
          data-testid="card-customizer-details-toggle"
          className="w-full px-3.5 py-3 flex items-center justify-between text-[14px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText size={15} className="text-muted shrink-0" />
            <span>Details &amp; QR</span>
          </span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-150 ${
              openSection === 'details' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSection === 'details' && (
          <div className="px-3.5 pb-4 pt-3 border-t border-border/70 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={value.role || ''}
                onChange={(e) => update({ role: e.target.value.slice(0, 60) })}
                placeholder="Role or title (e.g. Designer)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="text"
                value={value.companyOrLocation || ''}
                onChange={(e) => update({ companyOrLocation: e.target.value.slice(0, 60) })}
                placeholder="Company or city"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="email"
                value={value.contactEmail || ''}
                onChange={(e) => update({ contactEmail: e.target.value.slice(0, 100) })}
                placeholder="Email on front (optional)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="tel"
                value={value.contactPhone || ''}
                onChange={(e) => update({ contactPhone: e.target.value.slice(0, 32) })}
                placeholder="Phone on front (optional)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={value.websiteUrl || ''}
                onChange={(e) => update({ websiteUrl: e.target.value.slice(0, 80) })}
                placeholder="Website label (defaults to iveo.site/@you)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="text"
                value={value.badgeText || ''}
                onChange={(e) => update({ badgeText: e.target.value.slice(0, 28) })}
                placeholder="Front badge (e.g. Founder)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
              <input
                type="text"
                value={value.backHeadline ?? 'Scan to'}
                onFocus={() => onSelectSide?.('back')}
                onChange={(e) => update({ backHeadline: e.target.value.slice(0, 36) })}
                placeholder="Back line 1 (Scan to)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="text"
                value={value.backSubheadline ?? 'open my page.'}
                onFocus={() => onSelectSide?.('back')}
                onChange={(e) => update({ backSubheadline: e.target.value.slice(0, 44) })}
                placeholder="Back italic line (open my page.)"
                className="h-9 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[12px] font-medium text-muted mb-1">
                Visible sections
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">Show front logo</span>
                  <Toggle
                    checked={value.showAvatar !== false}
                    onChange={() => update({ showAvatar: !(value.showAvatar !== false) })}
                    ariaLabel="Show front logo"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">Show front bio</span>
                  <Toggle
                    checked={value.showBio !== false}
                    onChange={() => update({ showBio: !(value.showBio !== false) })}
                    ariaLabel="Show front bio"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">Show @handle</span>
                  <Toggle
                    checked={value.showHandle !== false}
                    onChange={() => update({ showHandle: !(value.showHandle !== false) })}
                    ariaLabel="Show @handle"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">Social links on back</span>
                  <Toggle
                    checked={value.showSocialsOnBack !== false}
                    onChange={() =>
                      update({ showSocialsOnBack: !(value.showSocialsOnBack !== false) })
                    }
                    ariaLabel="Social links on back"
                  />
                </div>
              </div>
            </div>

            {value.showQr !== false && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
                <span className="text-[12px] font-medium text-muted">
                  Back QR colors
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {renderColorInput('qrFgColor', 'QR dots', '#0A0A0A', 'back')}
                  {renderColorInput('qrBgColor', 'QR background', '#FFFFFF', 'back')}
                </div>
                {lowQrContrast && (
                  <div className="flex items-center gap-1.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>
                      Low QR contrast ({qrContrast}:1) may reduce phone camera scan reliability.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reset & optional inline save */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_BUSINESS_CARD_CONFIG })}
          className="text-[12px] text-muted hover:text-ink inline-flex items-center gap-1.5 py-1.5 cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Reset card</span>
        </button>
        {!hideSave && onSave && (
          <button
            type="button"
            onClick={() => onSave(value)}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-ink text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-surface-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={13} />
            <span>{isSaving ? 'Saving...' : 'Save card'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

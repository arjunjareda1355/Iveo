import React, { useEffect, useState } from 'react';
import { Check, Lock, RotateCcw, Sparkles, Type } from 'lucide-react';
import {
  FONT_OPTIONS,
  FontId,
  FontOption,
  FontSettings,
  FontTarget,
  canUseFont,
  getFontCssFamily,
  getFontOption,
  loadAllCatalogFonts,
} from '../../lib/fonts';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useToast } from '../ui/Toast';
import type { Vibe } from '../../lib/vibes';

interface FontSelectorPanelProps {
  currentFonts?: FontSettings | null;
  activeVibe: Vibe;
  isPro: boolean;
  onFontsChange: (next: FontSettings | null) => Promise<void> | void;
  onPreviewFontsChange?: (next: FontSettings | null) => void;
}

const TARGET_TABS: { id: FontTarget; label: string; sample: string }[] = [
  { id: 'name', label: 'Name', sample: 'Your Display Name' },
  { id: 'bio', label: 'Bio', sample: 'Creator, designer & writer.' },
  { id: 'button', label: 'Buttons', sample: 'Listen to my latest release' },
];

const QUICK_PAIRS: {
  label: string;
  description: string;
  isPro: boolean;
  settings: FontSettings;
}[] = [
  {
    label: 'Modern Clean',
    description: 'Plus Jakarta + Inter',
    isPro: false,
    settings: { nameFont: 'plus-jakarta', bioFont: 'inter', buttonFont: 'inter' },
  },
  {
    label: 'Tech Grotesk',
    description: 'Space Grotesk + DM Sans',
    isPro: false,
    settings: { nameFont: 'space-grotesk', bioFont: 'dm-sans', buttonFont: 'dm-sans' },
  },
  {
    label: 'Editorial Serif',
    description: 'Playfair + Lora + DM Sans',
    isPro: true,
    settings: { nameFont: 'playfair', bioFont: 'lora', buttonFont: 'dm-sans' },
  },
  {
    label: 'Bold Display',
    description: 'Syne + Bricolage + Outfit',
    isPro: true,
    settings: { nameFont: 'syne', bioFont: 'bricolage', buttonFont: 'outfit' },
  },
];

export const FontSelectorPanel: React.FC<FontSelectorPanelProps> = ({
  currentFonts,
  activeVibe,
  isPro,
  onFontsChange,
  onPreviewFontsChange,
}) => {
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();

  const [target, setTarget] = useState<FontTarget>('name');
  const [localFonts, setLocalFonts] = useState<FontSettings>(currentFonts || {});

  useEffect(() => {
    setLocalFonts(currentFonts || {});
  }, [currentFonts]);

  useEffect(() => {
    loadAllCatalogFonts();
  }, []);

  const freeFonts = FONT_OPTIONS.filter((f) => !f.isPro);
  const proFonts = FONT_OPTIONS.filter((f) => f.isPro);

  const selectedFontIdForTarget: FontId | null =
    target === 'name'
      ? localFonts.nameFont ?? null
      : target === 'bio'
        ? localFonts.bioFont ?? null
        : localFonts.buttonFont ?? null;

  const commitFonts = async (next: FontSettings | null, toastMsg?: string) => {
    const cleaned: FontSettings | null =
      next && (next.nameFont || next.bioFont || next.buttonFont) ? next : null;
    setLocalFonts(cleaned || {});
    onPreviewFontsChange?.(cleaned);
    try {
      await onFontsChange(cleaned);
      if (toastMsg) showToast(toastMsg);
    } catch {
      showToast("Couldn't save font changes");
    }
  };

  const handleSelectFont = async (font: FontOption) => {
    if (!canUseFont(font.id, isPro)) {
      openUpgrade('fonts');
      return;
    }

    const next: FontSettings = {
      ...localFonts,
      ...(target === 'name' ? { nameFont: font.id } : {}),
      ...(target === 'bio' ? { bioFont: font.id } : {}),
      ...(target === 'button' ? { buttonFont: font.id } : {}),
    };

    await commitFonts(next, `${font.name} applied to ${target}`);
  };

  const handleApplyAllToTarget = async (font: FontOption) => {
    if (!canUseFont(font.id, isPro)) {
      openUpgrade('fonts');
      return;
    }
    await commitFonts(
      { nameFont: font.id, bioFont: font.id, buttonFont: font.id },
      `${font.name} applied to all text`
    );
  };

  const handleApplyPair = async (pair: (typeof QUICK_PAIRS)[number]) => {
    if (pair.isPro && !isPro) {
      openUpgrade('fonts');
      return;
    }
    await commitFonts(pair.settings, `${pair.label} pairing applied`);
  };

  const handleResetTarget = async () => {
    const next: FontSettings = {
      ...localFonts,
      ...(target === 'name' ? { nameFont: null } : {}),
      ...(target === 'bio' ? { bioFont: null } : {}),
      ...(target === 'button' ? { buttonFont: null } : {}),
    };
    await commitFonts(next, `${target.charAt(0).toUpperCase() + target.slice(1)} font reset to theme default`);
  };

  const handleResetAll = async () => {
    await commitFonts(null, 'All fonts reset to theme default');
  };

  const hasAnyOverride = Boolean(localFonts.nameFont || localFonts.bioFont || localFonts.buttonFont);

  const renderFontOptionCard = (font: FontOption) => {
    const isSelected = selectedFontIdForTarget === font.id;
    const isLocked = font.isPro && !isPro;

    return (
      <div
        key={font.id}
        className={`rounded-xl border transition-all duration-150 flex flex-col justify-between p-3 ${
          isSelected
            ? 'border-ink bg-surface ring-1 ring-ink shadow-xs'
            : 'border-border bg-surface hover:border-ink/35'
        }`}
      >
        <button
          type="button"
          onClick={() => handleSelectFont(font)}
          className="text-left w-full cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[16px] font-semibold text-ink truncate leading-snug"
                  style={{ fontFamily: font.cssFamily }}
                >
                  {font.name}
                </span>
                {font.isPro && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ink text-surface shrink-0">
                    {isLocked && <Lock size={9} />}
                    <span>PRO</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted capitalize block mt-0.5">
                {font.category}
              </span>
            </div>

            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                isSelected
                  ? 'bg-ink border-ink text-surface'
                  : 'border-border bg-surface-2 text-transparent group-hover:border-ink/30'
              }`}
            >
              <Check size={12} strokeWidth={2.5} />
            </div>
          </div>

          <p
            className="mt-2.5 text-[14px] text-ink/85 truncate"
            style={{ fontFamily: font.cssFamily }}
          >
            Aa Bb Cc · Simple &amp; Personal
          </p>
        </button>

        {!isLocked && (
          <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
            <span className="text-[10px] text-muted">
              Click to apply to {target}
            </span>
            <button
              type="button"
              onClick={() => handleApplyAllToTarget(font)}
              className="text-[11px] font-medium text-ink hover:underline cursor-pointer"
            >
              Apply to all
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Live Font Preview Strip */}
      <div
        className="rounded-2xl border border-border p-5 flex flex-col items-center text-center gap-2 transition-colors"
        style={{
          backgroundColor: activeVibe.tokens.bg,
          color: activeVibe.tokens.text,
        }}
      >
        <span
          className="text-[10px] uppercase tracking-widest font-mono opacity-60"
          style={{ color: activeVibe.tokens.muted }}
        >
          Typography Live Preview
        </span>
        <h4
          className="text-[20px] font-semibold leading-tight"
          style={{
            fontFamily: getFontCssFamily(localFonts.nameFont, activeVibe.fontFamily),
            color: activeVibe.tokens.text,
          }}
        >
          Maya Ellis
        </h4>
        <p
          className="text-[13px] max-w-[34ch]"
          style={{
            fontFamily: getFontCssFamily(localFonts.bioFont, activeVibe.fontFamily),
            color: activeVibe.tokens.muted,
          }}
        >
          Illustrator and writer sharing zines, prints &amp; creative tools.
        </p>
        <div
          className="mt-1.5 px-5 py-2.5 text-[13px] font-medium shadow-2xs"
          style={{
            fontFamily: getFontCssFamily(localFonts.buttonFont, activeVibe.fontFamily),
            backgroundColor: activeVibe.tokens.buttonBg,
            color: activeVibe.tokens.buttonText,
            borderRadius: `${activeVibe.tokens.buttonRadius}px`,
            border: activeVibe.tokens.buttonBorder
              ? `${activeVibe.tokens.buttonBorderWidth || '1px'} solid ${activeVibe.tokens.buttonBorder}`
              : 'none',
          }}
        >
          Explore latest collection
        </div>
      </div>

      {/* Quick Font Pairings */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Sparkles size={13} />
            <span>Quick Pairings</span>
          </span>
          {hasAnyOverride && (
            <button
              type="button"
              onClick={handleResetAll}
              className="text-[12px] text-muted hover:text-ink flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset all fonts</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_PAIRS.map((pair) => {
            const nameOpt = getFontOption(pair.settings.nameFont);
            const locked = pair.isPro && !isPro;
            return (
              <button
                key={pair.label}
                type="button"
                onClick={() => handleApplyPair(pair)}
                className="p-2.5 rounded-xl border border-border bg-surface hover:border-ink/40 text-left transition-all cursor-pointer flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[13px] font-semibold text-ink truncate"
                    style={{ fontFamily: nameOpt?.cssFamily }}
                  >
                    {pair.label}
                  </span>
                  {pair.isPro && !isPro && <ProBadge className="scale-75 origin-right" />}
                </div>
                <span className="text-[11px] text-muted truncate">
                  {locked ? 'Pro pairing' : pair.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Element Selector (Name / Bio / Buttons) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink flex items-center gap-1.5">
            <Type size={14} />
            <span>Choose element to customize</span>
          </span>
          {selectedFontIdForTarget && (
            <button
              type="button"
              onClick={handleResetTarget}
              className="text-[12px] text-muted hover:text-ink underline cursor-pointer"
            >
              Use theme default for {target}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
          {TARGET_TABS.map((t) => {
            const active = target === t.id;
            const currentId =
              t.id === 'name'
                ? localFonts.nameFont
                : t.id === 'bio'
                  ? localFonts.bioFont
                  : localFonts.buttonFont;
            const currentName = getFontOption(currentId)?.name || 'Default';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarget(t.id)}
                className={`py-2 px-3 rounded-lg text-left transition-all cursor-pointer flex flex-col ${
                  active
                    ? 'bg-surface text-ink shadow-xs border border-border/60'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <span className="text-[13px] font-semibold leading-tight">{t.label}</span>
                <span className="text-[11px] opacity-75 truncate mt-0.5">{currentName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Free Fonts Section */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-[13px] font-semibold text-ink">Free Fonts</h4>
          <span className="text-[11px] text-muted">{freeFonts.length} typefaces</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {freeFonts.map(renderFontOptionCard)}
        </div>
      </div>

      {/* Pro Fonts Section */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-ink">Pro Fonts</h4>
            {!isPro && <ProBadge className="scale-90 origin-left" />}
          </div>
          <span className="text-[11px] text-muted">{proFonts.length} studio &amp; editorial fonts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {proFonts.map(renderFontOptionCard)}
        </div>
      </div>
    </div>
  );
};

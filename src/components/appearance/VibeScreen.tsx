import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { SectionScreenShell } from './SectionScreenShell';
import { useAppearance } from './AppearanceContext';
import {
  CATALOG_VIBES,
  VIBE_COLLECTIONS,
  type CatalogVibe,
} from '../../lib/appearance/catalog/vibes';
import { findCatalogBackground } from '../../lib/appearance/catalog/backgrounds';
import { findCatalogFont } from '../../lib/appearance/catalog/fonts';
import { buildButtonSurfaceCss } from '../../lib/appearance/catalog/surfaces';
import { analyzeBackground } from '../../lib/color/analyze';
import { requestLazyCatalogFont } from '../../lib/fonts';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';

type VibeFilter = 'All' | 'Free' | 'Pro' | (typeof VIBE_COLLECTIONS)[number];

interface VibeScreenProps {
  onOpenPreview: () => void;
}

export const VibeScreen: React.FC<VibeScreenProps> = ({ onOpenPreview }) => {
  const { draft, isPro, hasCustomOverrides, applyVibeChoice, resetSection } = useAppearance();
  const { openUpgrade } = useUpgradeDialog();

  const [filter, setFilter] = useState<VibeFilter>('All');
  const [pendingVibe, setPendingVibe] = useState<CatalogVibe | null>(null);
  const [scope, setScope] = useState<'everything' | 'colors-bg' | 'fonts-layout'>('everything');
  const [keepCustomizations, setKeepCustomizations] = useState(false);

  const filterChips: VibeFilter[] = ['All', 'Free', 'Pro', ...VIBE_COLLECTIONS];

  const visibleVibes = useMemo(() => {
    if (filter === 'All') return CATALOG_VIBES;
    if (filter === 'Free') return CATALOG_VIBES.filter((v) => v.tier === 'free');
    if (filter === 'Pro') return CATALOG_VIBES.filter((v) => v.tier === 'pro');
    return CATALOG_VIBES.filter((v) => v.collection === filter);
  }, [filter]);

  useEffect(() => {
    for (const v of visibleVibes.slice(0, 14)) {
      requestLazyCatalogFont(v.fonts.name.family);
    }
  }, [visibleVibes]);

  const handleCardClick = (v: CatalogVibe) => {
    if (v.tier === 'pro' && !isPro) {
      openUpgrade();
      return;
    }

    if (!hasCustomOverrides) {
      applyVibeChoice(v.id, 'everything', false);
      return;
    }

    setScope('everything');
    setKeepCustomizations(false);
    setPendingVibe(v);
  };

  const handleConfirmApply = () => {
    if (!pendingVibe) return;
    applyVibeChoice(pendingVibe.id, scope, keepCustomizations);
    setPendingVibe(null);
  };

  const stickyFilterRow = (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {filterChips.map((chip) => {
        const active = filter === chip;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => setFilter(chip)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              active
                ? 'bg-ink text-white'
                : 'bg-surface border border-border text-ink hover:bg-surface-2'
            }`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );

  return (
    <SectionScreenShell
      sectionKey="vibe"
      title="Vibe"
      infoText="A vibe sets a starting look for your whole page. You can change anything afterwards."
      stickySubHeader={stickyFilterRow}
      extraMenuItems={[
        {
          label: 'Reset to default vibe',
          onSelect: () => resetSection('vibe'),
        },
      ]}
      onOpenPreview={onOpenPreview}
    >
      <div className="grid grid-cols-2 gap-3">
        {visibleVibes.map((v) => {
          const isSelected = draft.vibeId === v.id;
          const isLocked = v.tier === 'pro' && !isPro;
          const bgPreset = findCatalogBackground(v.backgroundId);
          const bgProfile = analyzeBackground({ type: 'preset', id: v.backgroundId }, { pageTextHex: v.page.text });
          const fontObj = findCatalogFont(v.fonts.name.family);
          const btnCss = buildButtonSurfaceCss({
            surface: v.button.surface,
            fill: v.button.fill,
            text: v.button.text,
            border: v.button.border,
            borderWidth: v.button.borderWidth,
            shadow: v.button.surface === 'solid-soft' ? 'soft' : 'none',
            bgProfile,
          });
          const btnRadius =
            v.button.shape === 'square'
              ? '0px'
              : v.button.shape === 'pill'
                ? '9999px'
                : `${Math.min(12, v.button.radius)}px`;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleCardClick(v)}
              className={`text-left rounded-[18px] p-2.5 bg-surface transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-ink ${
                isSelected
                  ? 'border-2 border-ink shadow-sm'
                  : 'border border-border hover:border-border-strong'
              }`}
            >
              {/* Aspect 1 : 1.15 Live Miniature */}
              <div
                className="relative w-full aspect-[1/1.15] rounded-[12px] overflow-hidden p-3 flex flex-col items-center justify-center gap-2 border border-black/8"
                style={{
                  background: bgPreset?.cssBackground || '#FAFAF9',
                  color: v.page.text,
                }}
              >
                {isLocked && (
                  <span className="absolute top-2 right-2">
                    <ProBadge locked />
                  </span>
                )}
                {isSelected && (
                  <span
                    aria-label="Selected"
                    className="absolute top-2 left-2 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shadow-xs"
                  >
                    <Check size={13} strokeWidth={2.5} />
                  </span>
                )}

                <span
                  className="w-8 h-8 rounded-full border border-current/25"
                  style={{ backgroundColor: `${v.page.accent}33` }}
                />
                <span
                  className="text-[13px] leading-tight text-center max-w-full truncate"
                  style={{
                    fontFamily: fontObj?.cssFamily || 'sans-serif',
                    fontWeight: v.fonts.name.weight,
                    color: v.page.text,
                  }}
                >
                  {v.name}
                </span>

                <div className="w-full flex flex-col gap-1.5 mt-0.5 px-1">
                  <span
                    className="w-full h-5 block"
                    style={{
                      background: btnCss.backgroundImage || btnCss.backgroundColor,
                      border: btnCss.border,
                      borderBottom: btnCss.borderBottom,
                      boxShadow: btnCss.boxShadow,
                      borderRadius: btnRadius,
                    }}
                  />
                  <span
                    className="w-full h-5 block opacity-85"
                    style={{
                      background: btnCss.backgroundImage || btnCss.backgroundColor,
                      border: btnCss.border,
                      borderBottom: btnCss.borderBottom,
                      boxShadow: btnCss.boxShadow,
                      borderRadius: btnRadius,
                    }}
                  />
                </div>
              </div>

              <div className="mt-2.5 px-0.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[16px] font-semibold text-ink leading-snug">
                    {v.name}
                  </span>
                  {isSelected && (draft.migratedFrom || hasCustomOverrides) && (
                    <span className="text-[11px] font-medium text-muted shrink-0">
                      Customised
                    </span>
                  )}
                  {isLocked && <Lock size={13} className="text-muted shrink-0" />}
                </div>
                <p className="text-[14px] text-muted leading-snug">
                  {v.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply Scope Sheet when overrides exist */}
      {pendingVibe && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Apply ${pendingVibe.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingVibe(null);
          }}
        >
          <div className="w-full sm:max-w-md bg-surface rounded-t-[24px] sm:rounded-[20px] border border-border p-5 shadow-xl flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">
                Apply {pendingVibe.name}
              </h2>
              <p className="text-[13px] text-muted mt-0.5">
                Choose what you want to update from this vibe.
              </p>
            </div>

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Apply scope">
              {[
                { id: 'everything', label: 'Everything', desc: 'Background, colours, fonts and layout' },
                { id: 'colors-bg', label: 'Colours and background only', desc: 'Keep your fonts and layout' },
                { id: 'fonts-layout', label: 'Fonts and layout only', desc: 'Keep your background and colours' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                    scope === opt.id ? 'border-ink bg-surface-2' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="vibe-apply-scope"
                    checked={scope === opt.id}
                    onChange={() => setScope(opt.id as typeof scope)}
                    className="mt-1 accent-ink"
                  />
                  <div>
                    <div className="text-[14px] font-medium text-ink">{opt.label}</div>
                    <div className="text-[12px] text-muted">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2.5 text-[13px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={keepCustomizations}
                onChange={(e) => setKeepCustomizations(e.target.checked)}
                className="w-4 h-4 accent-ink"
              />
              <span>Keep my customisations (respect locked fields)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
              <button
                type="button"
                onClick={() => setPendingVibe(null)}
                className="h-11 px-4 rounded-xl border border-border text-[14px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                className="h-11 px-5 rounded-xl bg-ink text-white text-[14px] font-semibold hover:bg-ink-2 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionScreenShell>
  );
};

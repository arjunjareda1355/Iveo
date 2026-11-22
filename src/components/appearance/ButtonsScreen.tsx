import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  MoreHorizontal,
  Unlock,
} from 'lucide-react';
import { SectionScreenShell } from './SectionScreenShell';
import { SuggestionStrip } from './SuggestionStrip';
import { OklchColorPicker, normalizeInputHex } from './OklchColorPicker';
import { useAppearance } from './AppearanceContext';
import {
  CATALOG_SURFACES,
  buildButtonSurfaceCss,
  checkSurfaceCompatibility,
} from '../../lib/appearance/catalog/surfaces';
import { findCatalogVibe } from '../../lib/appearance/catalog/vibes';
import { resolveDerivedButtonRadius } from '../../lib/appearance/resolveTokens';
import type {
  AppearanceLock,
  ButtonMotion,
  ButtonShapeV2,
  ButtonSurface,
  Color,
  Hex,
} from '../../lib/appearance/types';
import { describeBgTone } from '../../lib/color/analyze';
import { contrastRatio, worstCaseContrast } from '../../lib/color/contrast';
import { bestText } from '../../lib/color/gamut';
import {
  appendSeenRing,
  buildSuggestionSeed,
  readSeenRing,
} from '../../lib/color/prng';
import {
  evaluateButtonSetRules,
  getSafeColorsFromBackground,
  suggestButtons,
  type ButtonSetSuggestion,
} from '../../lib/color/recipes';
import { useIvioSession } from '../../auth/useIvioSession';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';

interface ButtonsScreenProps {
  onOpenPreview: () => void;
}

type ColorFieldKey = 'fill' | 'text' | 'border';

export const ButtonsScreen: React.FC<ButtonsScreenProps> = ({ onOpenPreview }) => {
  const session = useIvioSession();
  const {
    draft,
    resolved,
    isPro,
    applyPatch,
    toggleLock,
    resetSection,
    advancedExpanded,
    setAdvancedExpanded,
    trackEvent,
  } = useAppearance();
  const { openUpgrade } = useUpgradeDialog();

  const [refreshCount, setRefreshCount] = useState(0);
  const [historyStack, setHistoryStack] = useState<number[]>([]);
  const [stripMenuId, setStripMenuId] = useState<string | null>(null);
  const [pickerField, setPickerField] = useState<ColorFieldKey | null>(null);
  const [hexDrafts, setHexDrafts] = useState<Record<ColorFieldKey, string>>({
    fill: String(draft.buttons.fill),
    text: String(draft.buttons.text),
    border: String(draft.buttons.border),
  });
  const [hoverOverrideDraft, setHoverOverrideDraft] = useState(
    String(draft.buttons.states?.hover?.fill || '')
  );
  const [pressedOverrideDraft, setPressedOverrideDraft] = useState(
    String(draft.buttons.states?.pressed?.fill || '')
  );
  const [gradColorDraft, setGradColorDraft] = useState(
    String(draft.buttons.gradient?.to || '#6366F1')
  );

  React.useEffect(() => {
    setHexDrafts({
      fill: String(draft.buttons.fill),
      text: String(draft.buttons.text),
      border: String(draft.buttons.border),
    });
  }, [draft.buttons.fill, draft.buttons.text, draft.buttons.border]);

  const activeVibe = useMemo(
    () => findCatalogVibe(draft.vibeId) || findCatalogVibe('porcelain')!,
    [draft.vibeId]
  );

  const suggestions = useMemo(() => {
    const seed = buildSuggestionSeed({
      pageId: session.username || 'owner',
      bgSignature: resolved.bgProfile.signature,
      vibeId: activeVibe.id,
      refreshCount,
    });
    return suggestButtons({
      bgProfile: resolved.bgProfile,
      bg: resolved.background,
      vibe: activeVibe,
      current: draft.buttons,
      locks: draft.locks,
      seed,
      seenSignatures: new Set(readSeenRing('buttons')),
      refreshCount,
    });
  }, [
    session.username,
    resolved.bgProfile,
    resolved.background,
    activeVibe,
    draft.buttons,
    draft.locks,
    refreshCount,
  ]);

  const handleRefreshSuggestions = () => {
    const sigs = suggestions.map(
      (s) => `${s.fill}|${s.text}|${s.border}|${s.surface || 'none'}`
    );
    appendSeenRing('buttons', sigs);
    setHistoryStack((prev) => [refreshCount, ...prev].slice(0, 3));
    const nextCount = refreshCount + 1;
    setRefreshCount(nextCount);
    trackEvent('suggestion_refreshed', { engine: 'buttons', count: suggestions.length });
  };

  const handleRestorePreviousSuggestions = () => {
    if (historyStack.length === 0) return;
    const [prevCount, ...rest] = historyStack;
    setHistoryStack(rest);
    setRefreshCount(prevCount);
  };

  const applySuggestion = (
    item: ButtonSetSuggestion,
    position: number,
    mode: 'colours-plus-style' | 'colours-only' = 'colours-plus-style'
  ) => {
    const useSuggestedSurface =
      mode === 'colours-plus-style' &&
      item.surface &&
      ['R4', 'R6', 'R10', 'R11'].includes(item.recipe);

    if (useSuggestedSurface) {
      const sMeta = CATALOG_SURFACES.find((s) => s.id === item.surface);
      if (sMeta?.tier === 'pro' && !isPro) {
        openUpgrade();
        return;
      }
    }

    trackEvent('suggestion_applied', {
      engine: 'buttons',
      recipe: item.recipe,
      position,
    });

    applyPatch(
      (prev) => ({
        ...prev,
        buttons: {
          ...prev.buttons,
          fill: prev.locks.includes('btn.fill') ? prev.buttons.fill : item.fill,
          text: prev.locks.includes('btn.text') ? prev.buttons.text : item.text,
          border: prev.locks.includes('btn.border') ? prev.buttons.border : item.border,
          borderWidth:
            mode === 'colours-plus-style' ? item.borderWidth : prev.buttons.borderWidth,
          surface: useSuggestedSurface && item.surface ? item.surface : prev.buttons.surface,
        },
      }),
      { snackbarMessage: `Applied ${item.name}`, showUndo: true }
    );
  };

  const updateButtonField = (
    patch: Partial<typeof draft.buttons>,
    opts?: { coalesce?: boolean; snackbar?: boolean; manualField?: ColorFieldKey }
  ) => {
    if (opts?.manualField) {
      trackEvent('manual_color_changed', { field: opts.manualField });
    }
    applyPatch(
      (prev) => ({
        ...prev,
        buttons: {
          ...prev.buttons,
          ...patch,
        },
      }),
      {
        coalesce: opts?.coalesce,
        showUndo: opts?.snackbar ?? false,
      }
    );
  };

  // Live WCAG badges (T1-T4)
  const bgSamples: readonly Hex[] = [resolved.bgProfile.darkest, resolved.bgProfile.lightest];
  const ruleEval = useMemo(
    () =>
      evaluateButtonSetRules(
        draft.buttons.fill,
        draft.buttons.text,
        draft.buttons.border,
        draft.buttons.borderWidth,
        resolved.bgProfile
      ),
    [
      draft.buttons.fill,
      draft.buttons.text,
      draft.buttons.border,
      draft.buttons.borderWidth,
      resolved.bgProfile,
    ]
  );

  const fillVsPage =
    draft.buttons.fill === 'transparent'
      ? worstCaseContrast(String(draft.buttons.text), bgSamples)
      : worstCaseContrast(String(draft.buttons.fill), bgSamples);

  const borderVsPage =
    draft.buttons.border === 'transparent'
      ? 1
      : worstCaseContrast(String(draft.buttons.border), bgSamples);

  const textTier =
    ruleEval.textContrast >= 7 ? 'AAA' : ruleEval.textContrast >= 4.5 ? 'AA' : 'Low';
  const focusContrast = worstCaseContrast(resolved.focusRing, bgSamples);

  const toneChipLabel = describeBgTone(resolved.bgProfile);

  const pickerSuggestedSwatches = useMemo(() => {
    if (!pickerField) return [];
    return getSafeColorsFromBackground(pickerField, resolved.bgProfile, draft.buttons.fill);
  }, [pickerField, resolved.bgProfile, draft.buttons.fill]);

  return (
    <SectionScreenShell
      sectionKey="buttons"
      title="Buttons"
      infoText="Pick your own colours or tap an idea. Ideas are built to be readable on your background."
      extraMenuItems={[
        ...(historyStack.length > 0
          ? [
              {
                label: 'Previous ideas',
                onSelect: handleRestorePreviousSuggestions,
              },
            ]
          : []),
        {
          label: 'Reset buttons to vibe default',
          onSelect: () => resetSection('buttons'),
        },
      ]}
      onOpenPreview={onOpenPreview}
    >
      {/* GROUP 0: Smart Button Colour Suggestions */}
      <SuggestionStrip
        title="Ideas for your background"
        contextChip={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-surface text-[12px] font-medium text-muted">
            <span
              className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
              style={{ backgroundColor: resolved.bgProfile.meanHex }}
              aria-hidden="true"
            />
            <span>{toneChipLabel}</span>
          </span>
        }
        items={suggestions}
        getKey={(item) => item.id}
        onRefresh={handleRefreshSuggestions}
        onLongPressPrevious={handleRestorePreviousSuggestions}
        announceText={`${suggestions.length} new ideas`}
        renderItem={(item, idx) => {
          const itemSurface = item.surface || draft.buttons.surface;
          const btnCss = buildButtonSurfaceCss({
            surface: itemSurface,
            fill: item.fill,
            text: item.text,
            border: item.border,
            borderWidth: item.borderWidth,
            shadow: draft.buttons.shadow,
            gradient: draft.buttons.gradient,
            bgProfile: resolved.bgProfile,
          });
          const itemSurfaceLocked =
            Boolean(item.surface) &&
            ['R4', 'R6', 'R10', 'R11'].includes(item.recipe) &&
            CATALOG_SURFACES.find((s) => s.id === item.surface)?.tier === 'pro' &&
            !isPro;

          return (
            <div className="relative w-[148px] rounded-[16px] border border-border bg-surface p-2.5 flex flex-col gap-2 hover:border-border-strong transition-colors">
              <button
                type="button"
                data-strip-card="1"
                onClick={() => applySuggestion(item, idx, 'colours-plus-style')}
                aria-label={`${item.name}, ${item.badgeLabel}${item.subtle ? ', subtle' : ''}`}
                className="w-full text-left flex flex-col gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-ink rounded-lg"
              >
                {/* Live backdrop preview plate with real 120x40 mini button */}
                <div
                  className="w-full h-14 rounded-[10px] px-2 flex items-center justify-center border border-black/8 relative overflow-hidden"
                  style={{ background: resolved.pageBg }}
                >
                  <span
                    className="w-[120px] h-9 px-2.5 inline-flex items-center justify-center text-[12px] font-semibold truncate"
                    style={{
                      background: btnCss.backgroundImage || btnCss.backgroundColor,
                      color: btnCss.color,
                      border: btnCss.border,
                      borderBottom: btnCss.borderBottom,
                      boxShadow: btnCss.boxShadow,
                      backdropFilter: btnCss.backdropFilter,
                      borderRadius: `${Math.min(18, resolved.buttons.derivedRadius)}px`,
                    }}
                  >
                    Button
                  </span>
                </div>

                <div className="flex flex-col gap-1 px-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[13px] font-semibold text-ink truncate">
                      {item.name}
                    </span>
                    {itemSurfaceLocked && <ProBadge locked />}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${
                        item.lowContrast
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-surface-2 text-ink'
                      }`}
                    >
                      {item.lowContrast ? (
                        <AlertTriangle size={10} />
                      ) : (
                        <CheckCircle2 size={10} className="text-emerald-600" />
                      )}
                      {item.badgeLabel}
                    </span>

                    {/* 3 tiny colour dots */}
                    <span className="inline-flex items-center -space-x-1" aria-hidden="true">
                      {[item.fill, item.text, item.border].map((c, cIdx) => (
                        <span
                          key={cIdx}
                          className="w-3 h-3 rounded-full border border-white shadow-2xs"
                          style={{
                            backgroundColor:
                              c === 'transparent' ? resolved.bgProfile.meanHex : c,
                          }}
                        />
                      ))}
                    </span>
                  </div>

                  {item.subtle && (
                    <span className="text-[10px] font-medium text-muted">Subtle</span>
                  )}
                  {item.lowContrast && (
                    <span className="text-[10px] font-medium text-amber-700">Low contrast</span>
                  )}
                </div>
              </button>

              {/* Ellipsis menu for Colours only vs Colours + style */}
              <div className="flex items-center justify-between pt-0.5 border-t border-divider">
                <span className="text-[10px] text-muted truncate pr-1">{item.why}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStripMenuId(stripMenuId === item.id ? null : item.id);
                  }}
                  aria-label={`Apply options for ${item.name}`}
                  className="w-6 h-6 rounded-md text-muted hover:text-ink hover:bg-surface-2 inline-flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <MoreHorizontal size={13} />
                </button>
              </div>

              {stripMenuId === item.id && (
                <div className="absolute right-2 bottom-9 z-30 w-36 rounded-xl border border-border bg-surface py-1 shadow-lg text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setStripMenuId(null);
                      applySuggestion(item, idx, 'colours-only');
                    }}
                    className="w-full px-3 py-1.5 text-left text-ink hover:bg-surface-2 cursor-pointer"
                  >
                    Colours only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStripMenuId(null);
                      applySuggestion(item, idx, 'colours-plus-style');
                    }}
                    className="w-full px-3 py-1.5 text-left text-ink hover:bg-surface-2 cursor-pointer"
                  >
                    Colours + style
                  </button>
                </div>
              )}
            </div>
          );
        }}
      />

      {/* GROUP 1: Shape (EXACTLY ONCE) */}
      <section aria-label="Shape" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Shape
        </span>
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
          {(
            [
              { id: 'square', label: 'Square', rad: 0 },
              { id: 'rounded', label: 'Rounded', rad: 14 },
              { id: 'pill', label: 'Pill', rad: 9999 },
              { id: 'custom', label: 'Custom', rad: draft.buttons.radius },
            ] as Array<{ id: ButtonShapeV2; label: string; rad: number }>
          ).map((opt) => {
            const active = draft.buttons.shape === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  updateButtonField({
                    shape: opt.id,
                    radius: opt.id === 'custom' ? draft.buttons.radius : opt.rad,
                  })
                }
                className={`h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  active ? 'bg-white text-ink shadow-2xs' : 'text-muted hover:text-ink'
                }`}
              >
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {draft.buttons.shape === 'custom' && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-[13px] text-muted whitespace-nowrap" htmlFor="btn-custom-radius">
              Corner radius
            </label>
            <input
              id="btn-custom-radius"
              type="range"
              min={0}
              max={40}
              value={Math.min(40, Math.max(0, draft.buttons.radius))}
              onChange={(e) =>
                updateButtonField(
                  { shape: 'custom', radius: Number(e.target.value) },
                  { coalesce: true }
                )
              }
              className="flex-1 accent-ink cursor-pointer"
            />
            <input
              type="number"
              min={0}
              max={40}
              aria-label="Custom corner radius pixels"
              value={Math.min(40, Math.max(0, draft.buttons.radius))}
              onChange={(e) =>
                updateButtonField({
                  shape: 'custom',
                  radius: Math.min(40, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="w-16 h-9 px-2 rounded-lg border border-border text-center font-mono text-[13px] text-ink"
            />
          </div>
        )}
      </section>

      {/* GROUP 2: Colours (Fill, Text, Border with badges, Auto, Transparent, Locks, OKLCH Picker) */}
      <section aria-label="Colours" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Colours
        </span>

        {(
          [
            {
              key: 'fill' as const,
              label: 'Fill',
              lockKey: 'btn.fill' as AppearanceLock,
              badgeText: `vs page ${fillVsPage.toFixed(1)}:1`,
              badgeGood: fillVsPage >= 3.0,
              allowTransparent: true,
            },
            {
              key: 'text' as const,
              label: 'Text',
              lockKey: 'btn.text' as AppearanceLock,
              badgeText: `${ruleEval.textContrast.toFixed(1)}:1 ${textTier}`,
              badgeGood: ruleEval.textContrast >= 4.5,
              allowTransparent: false,
            },
            {
              key: 'border' as const,
              label: 'Border',
              lockKey: 'btn.border' as AppearanceLock,
              badgeText:
                draft.buttons.border === 'transparent'
                  ? 'None'
                  : `vs page ${borderVsPage.toFixed(1)}:1`,
              badgeGood: draft.buttons.border === 'transparent' || borderVsPage >= 3.0,
              allowTransparent: true,
            },
          ]
        ).map((row) => {
          const currVal = draft.buttons[row.key];
          const isLocked = draft.locks.includes(row.lockKey);
          const hexUpper = currVal === 'transparent' ? 'TRANSPARENT' : String(currVal).toUpperCase();
          const swatchContrastLabel = `${row.label} colour ${hexUpper.replace('#', '')}, ${row.badgeText}`;

          return (
            <div
              key={row.key}
              className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 py-2 border-b last:border-b-0 border-divider"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setPickerField(row.key)}
                  aria-label={swatchContrastLabel}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-border shrink-0 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-ink relative overflow-hidden"
                  style={{
                    backgroundColor: currVal === 'transparent' ? 'transparent' : String(currVal),
                    backgroundImage:
                      currVal === 'transparent'
                        ? 'linear-gradient(45deg, #E5E7EB 25%, transparent 25%, transparent 75%, #E5E7EB 75%), linear-gradient(45deg, #E5E7EB 25%, transparent 25%, transparent 75%, #E5E7EB 75%)'
                        : undefined,
                    backgroundSize: currVal === 'transparent' ? '10px 10px' : undefined,
                    backgroundPosition: currVal === 'transparent' ? '0 0, 5px 5px' : undefined,
                  }}
                />

                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold text-ink">{row.label}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
                      row.badgeGood ? 'text-muted' : 'text-red-700'
                    }`}
                  >
                    {row.badgeGood ? (
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={12} className="text-red-600 shrink-0" />
                    )}
                    <span>{row.badgeText}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                {row.key === 'text' && (
                  <button
                    type="button"
                    onClick={() => {
                      const refBg =
                        draft.buttons.fill === 'transparent'
                          ? resolved.bgProfile.meanHex
                          : draft.buttons.fill;
                      const bt = bestText(refBg, resolved.bgProfile.darkest, 4.5);
                      updateButtonField({ text: bt.text }, { manualField: 'text' });
                    }}
                    className="h-9 px-2.5 rounded-lg border border-border text-[12px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
                  >
                    Auto
                  </button>
                )}

                {row.allowTransparent && (
                  <button
                    type="button"
                    onClick={() =>
                      updateButtonField(
                        {
                          [row.key]:
                            currVal === 'transparent'
                              ? row.key === 'fill'
                                ? resolved.pageText
                                : resolved.pageText
                              : 'transparent',
                        },
                        { manualField: row.key }
                      )
                    }
                    className={`h-9 px-2.5 rounded-lg border text-[12px] font-medium cursor-pointer ${
                      currVal === 'transparent'
                        ? 'border-ink bg-ink text-white'
                        : 'border-border text-ink hover:bg-surface-2'
                    }`}
                  >
                    Transparent
                  </button>
                )}

                <input
                  type="text"
                  aria-label={`${row.label} hex colour`}
                  value={hexDrafts[row.key]}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setHexDrafts((prev) => ({ ...prev, [row.key]: val }));
                  }}
                  onBlur={() => {
                    const raw = hexDrafts[row.key].trim();
                    if (row.allowTransparent && raw.toLowerCase() === 'transparent') {
                      updateButtonField({ [row.key]: 'transparent' }, { manualField: row.key });
                      return;
                    }
                    const norm = normalizeInputHex(raw);
                    if (norm) {
                      setHexDrafts((prev) => ({ ...prev, [row.key]: norm }));
                      updateButtonField({ [row.key]: norm }, { manualField: row.key });
                    } else {
                      setHexDrafts((prev) => ({ ...prev, [row.key]: String(currVal) }));
                    }
                  }}
                  className="w-24 h-9 px-2 rounded-lg border border-border bg-surface font-mono text-[12px] uppercase text-ink focus-visible:outline-2 focus-visible:outline-ink"
                />

                <button
                  type="button"
                  onClick={() => toggleLock(row.lockKey)}
                  aria-pressed={isLocked}
                  aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${row.label} colour`}
                  title={isLocked ? 'Locked' : 'Lock colour'}
                  className={`w-10 h-10 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    isLocked
                      ? 'border-ink bg-ink text-white'
                      : 'border-border text-muted hover:text-ink hover:bg-surface-2'
                  }`}
                >
                  {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* GROUP 3: Surface & Effect (12 surfaces with C1-C7 compatibility predicates) */}
      <section aria-label="Surface and effect" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Surface & effect
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          {CATALOG_SURFACES.map((s) => {
            const selected = draft.buttons.surface === s.id;
            const lockedPro = s.tier === 'pro' && !isPro;
            const compat = checkSurfaceCompatibility(
              s.id,
              resolved.bgProfile,
              resolved.background,
              resolved.pageAccent,
              resolved.pageText
            );
            const btnCss = buildButtonSurfaceCss({
              surface: s.id,
              fill: draft.buttons.fill,
              text: draft.buttons.text,
              border: draft.buttons.border,
              borderWidth: draft.buttons.borderWidth,
              shadow: draft.buttons.shadow,
              gradient: draft.buttons.gradient,
              bgProfile: resolved.bgProfile,
            });
            const previewRad = Math.min(
              14,
              resolveDerivedButtonRadius(draft.buttons.shape, draft.buttons.radius)
            );

            return (
              <button
                key={s.id}
                type="button"
                disabled={!compat.allowed}
                aria-pressed={selected}
                aria-disabled={!compat.allowed}
                onClick={() => {
                  if (!compat.allowed) return;
                  if (lockedPro) {
                    openUpgrade();
                    return;
                  }
                  updateButtonField({ surface: s.id as ButtonSurface });
                }}
                className={`relative rounded-[14px] border p-2.5 text-left flex flex-col gap-2 transition-all ${
                  !compat.allowed
                    ? 'opacity-45 cursor-not-allowed border-border bg-surface-2'
                    : selected
                      ? 'border-2 border-ink bg-surface cursor-pointer shadow-2xs'
                      : 'border-border bg-surface hover:border-border-strong cursor-pointer'
                }`}
              >
                <div
                  className="w-full h-11 rounded-lg px-2 flex items-center justify-center border border-black/8 overflow-hidden"
                  style={{ background: resolved.pageBg }}
                >
                  <span
                    className="w-full h-7 flex items-center justify-center text-[11px] font-semibold truncate px-1.5"
                    style={{
                      background: btnCss.backgroundImage || btnCss.backgroundColor,
                      color: btnCss.color,
                      border: btnCss.border,
                      borderBottom: btnCss.borderBottom,
                      boxShadow: btnCss.boxShadow,
                      borderRadius: `${previewRad}px`,
                    }}
                  >
                    Link
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-semibold text-ink leading-tight">
                    {s.label}
                  </span>
                  {lockedPro && <ProBadge locked />}
                  {selected && compat.allowed && !lockedPro && (
                    <Check size={13} className="text-ink shrink-0" />
                  )}
                </div>

                {!compat.allowed && compat.reason && (
                  <span className="text-[10px] text-muted leading-tight">{compat.reason}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* GROUP 4: Size & Text */}
      <section aria-label="Size and text" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Size & text
        </span>

        {/* Height S / M / L */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Height</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
            {(
              [
                { id: 's', label: 'Small · 46px' },
                { id: 'm', label: 'Medium · 56px' },
                { id: 'l', label: 'Large · 68px' },
              ] as const
            ).map((hOpt) => (
              <button
                key={hOpt.id}
                type="button"
                onClick={() => updateButtonField({ size: hOpt.id })}
                className={`h-9 rounded-lg text-[12px] font-medium cursor-pointer ${
                  draft.buttons.size === hOpt.id ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {hOpt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border width stepper 0..4 */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink">Border width</span>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border">
            {([0, 1, 2, 3, 4] as const).map((bw) => (
              <button
                key={bw}
                type="button"
                onClick={() => updateButtonField({ borderWidth: bw })}
                className={`w-9 h-8 rounded-lg text-[12px] font-mono font-medium cursor-pointer ${
                  draft.buttons.borderWidth === bw ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {bw}px
              </button>
            ))}
          </div>
        </div>

        {/* Shadow */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">Shadow</span>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border">
            {(['none', 'soft', 'deep'] as const).map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => updateButtonField({ shadow: sh })}
                className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                  draft.buttons.shadow === sh ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {sh}
              </button>
            ))}
          </div>
        </div>

        {/* Text Weight */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">Text weight</span>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-border">
            {([400, 500, 600, 700] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => updateButtonField({ weight: w })}
                className={`px-2.5 h-8 rounded-lg text-[12px] font-mono cursor-pointer ${
                  (draft.buttons.weight || resolved.typography.button.weight) === w
                    ? 'bg-white text-ink shadow-2xs font-semibold'
                    : 'text-muted'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Case & Tracking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">Case</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['normal', 'upper'] as const).map((cOpt) => (
                <button
                  key={cOpt}
                  type="button"
                  onClick={() => updateButtonField({ case: cOpt })}
                  className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    (draft.buttons.case || 'normal') === cOpt
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {cOpt === 'upper' ? 'UPPER' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">Tracking</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['tight', 'normal', 'wide'] as const).map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => updateButtonField({ tracking: tr })}
                  className={`px-2.5 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    (draft.buttons.tracking || 'normal') === tr
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GROUP 5: Motion & Icon */}
      <section aria-label="Motion and icon" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Motion & icon
        </span>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Hover & tap motion</span>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
            {(['none', 'lift', 'press', 'shine'] as ButtonMotion[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateButtonField({ motion: m })}
                className={`h-9 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                  draft.buttons.motion === m ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">Icon position</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['left', 'right', 'none'] as const).map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => updateButtonField({ icon: ic })}
                  className={`px-2.5 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    draft.buttons.icon === ic ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">Text alignment</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['center', 'left'] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => updateButtonField({ align: al })}
                  className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    draft.buttons.align === al ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                  }`}
                >
                  {al}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COLLAPSED ADVANCED DRAWER */}
      <section aria-label="Advanced button states" className="rounded-[20px] border border-[#E6E6E6] bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedExpanded(!advancedExpanded)}
          aria-expanded={advancedExpanded}
          className="w-full px-4 py-3.5 flex items-center justify-between text-[13px] font-semibold text-ink hover:bg-surface-2/60 cursor-pointer"
        >
          <span>Advanced (gradient end, hover/pressed, focus ring)</span>
          {advancedExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>

        {advancedExpanded && (
          <div className="p-4 pt-2 border-t border-divider flex flex-col gap-4 text-[13px]">
            {/* Gradient Flow Second Colour & Angle */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Gradient end colour & angle
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  aria-label="Gradient second colour hex"
                  value={gradColorDraft}
                  onChange={(e) => setGradColorDraft(e.target.value.toUpperCase())}
                  onBlur={() => {
                    const norm = normalizeInputHex(gradColorDraft);
                    if (norm) {
                      setGradColorDraft(norm);
                      updateButtonField({
                        gradient: {
                          to: norm,
                          angle: draft.buttons.gradient?.angle ?? 135,
                        },
                      });
                    }
                  }}
                  className="w-28 h-9 px-2.5 rounded-lg border border-border font-mono text-[12px] uppercase"
                />
                <input
                  type="range"
                  min={0}
                  max={360}
                  aria-label="Gradient angle"
                  value={draft.buttons.gradient?.angle ?? 135}
                  onChange={(e) =>
                    updateButtonField(
                      {
                        gradient: {
                          to: (draft.buttons.gradient?.to || '#6366F1') as Hex,
                          angle: Number(e.target.value),
                        },
                      },
                      { coalesce: true }
                    )
                  }
                  className="flex-1 accent-ink"
                />
                <span className="font-mono text-[12px] text-muted w-10 text-right tabular-nums">
                  {draft.buttons.gradient?.angle ?? 135}°
                </span>
              </div>
            </div>

            {/* Hover & Pressed Overrides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-muted">Hover fill override</span>
                <input
                  type="text"
                  placeholder="Auto"
                  value={hoverOverrideDraft}
                  onChange={(e) => setHoverOverrideDraft(e.target.value.toUpperCase())}
                  onBlur={() => {
                    const clean = hoverOverrideDraft.trim();
                    if (!clean) {
                      const nextStates = { ...draft.buttons.states };
                      delete nextStates.hover;
                      updateButtonField({ states: nextStates });
                      return;
                    }
                    const norm = normalizeInputHex(clean);
                    if (norm) {
                      setHoverOverrideDraft(norm);
                      updateButtonField({
                        states: { ...draft.buttons.states, hover: { fill: norm as Color } },
                      });
                    }
                  }}
                  className="h-9 px-2.5 rounded-lg border border-border font-mono text-[12px]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-muted">Pressed fill override</span>
                <input
                  type="text"
                  placeholder="Auto"
                  value={pressedOverrideDraft}
                  onChange={(e) => setPressedOverrideDraft(e.target.value.toUpperCase())}
                  onBlur={() => {
                    const clean = pressedOverrideDraft.trim();
                    if (!clean) {
                      const nextStates = { ...draft.buttons.states };
                      delete nextStates.pressed;
                      updateButtonField({ states: nextStates });
                      return;
                    }
                    const norm = normalizeInputHex(clean);
                    if (norm) {
                      setPressedOverrideDraft(norm);
                      updateButtonField({
                        states: { ...draft.buttons.states, pressed: { fill: norm as Color } },
                      });
                    }
                  }}
                  className="h-9 px-2.5 rounded-lg border border-border font-mono text-[12px]"
                />
              </label>
            </div>

            {/* Auto Focus Ring (T4) */}
            <div className="flex items-center justify-between pt-2 border-t border-divider">
              <div>
                <span className="text-[13px] font-medium text-ink block">Keyboard focus ring</span>
                <span className="text-[12px] text-muted">
                  Auto-derived against backdrop (WCAG 1.4.11)
                </span>
              </div>
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-surface-2 text-[12px] font-mono tabular-nums">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/15"
                  style={{ backgroundColor: resolved.focusRing }}
                />
                <span>{focusContrast.toFixed(1)}:1</span>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* OKLCH Picker Modal / Bottom Sheet */}
      {pickerField && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Choose button ${pickerField} colour`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerField(null);
          }}
        >
          <div className="w-full sm:max-w-md bg-surface rounded-t-[24px] sm:rounded-[20px] border border-border p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-ink capitalize">
                Button {pickerField} colour
              </h2>
              <button
                type="button"
                onClick={() => setPickerField(null)}
                className="h-9 px-3 rounded-lg bg-ink text-white text-[13px] font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>

            <OklchColorPicker
              value={draft.buttons[pickerField]}
              onChange={(hex) =>
                updateButtonField(
                  { [pickerField]: hex },
                  { coalesce: true, manualField: pickerField }
                )
              }
              suggestedSwatches={pickerSuggestedSwatches}
              suggestedLabel="From your background"
              allowTransparent={pickerField !== 'text'}
              onSelectTransparent={() =>
                updateButtonField(
                  { [pickerField]: 'transparent' },
                  { manualField: pickerField }
                )
              }
            />
          </div>
        </div>
      )}
    </SectionScreenShell>
  );
};

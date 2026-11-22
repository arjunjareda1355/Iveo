import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Lock,
  Search,
  Unlock,
} from 'lucide-react';
import { SectionScreenShell } from './SectionScreenShell';
import { SuggestionStrip } from './SuggestionStrip';
import { useAppearance } from './AppearanceContext';
import {
  CATALOG_FONTS,
  clampWeightToFont,
  findCatalogFont,
  isFontAllowedForRole,
  type CatalogFont,
  type FontCategoryV2,
  type FontRoleFit,
} from '../../lib/appearance/catalog/fonts';
import { findCatalogVibe } from '../../lib/appearance/catalog/vibes';
import {
  appendSeenRing,
  buildSuggestionSeed,
  readSeenRing,
} from '../../lib/color/prng';
import { suggestFonts, type FontComboSuggestion } from '../../lib/color/recipes';
import { loadGoogleFonts, requestLazyCatalogFont } from '../../lib/fonts';
import { useIvioSession } from '../../auth/useIvioSession';
import { useBlocks } from '../../data/BlocksContext';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import type { AppearanceLock, FontRole } from '../../lib/appearance/types';

interface TypographyScreenProps {
  onOpenPreview: () => void;
}

type RoleTab = 'name' | 'bio' | 'button';

const CATEGORY_TABS: ReadonlyArray<{ id: 'all' | FontCategoryV2; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'mono', label: 'Mono' },
  { id: 'script', label: 'Script' },
  { id: 'rounded', label: 'Rounded' },
];

/**
 * Lazy-loaded compact 56px font catalog radio row triggered by IntersectionObserver.
 */
const FontCatalogRow: React.FC<{
  font: CatalogFont;
  selected: boolean;
  lockedPro: boolean;
  sampleText: string;
  onSelect: () => void;
}> = ({ font, selected, lockedPro, sampleText, onSelect }) => {
  const rowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      requestLazyCatalogFont(font.id);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          requestLazyCatalogFont(font.id);
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [font.id]);

  return (
    <button
      ref={rowRef}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full min-h-[56px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
        selected
          ? 'border-2 border-ink bg-surface-2/60'
          : 'border-border bg-surface hover:bg-surface-2/40'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[18px] text-ink leading-tight truncate"
            style={{ fontFamily: font.cssFamily }}
          >
            {font.family}
          </span>
          <span className="text-[11px] text-muted shrink-0">{font.subCategory}</span>
          {lockedPro && <ProBadge locked />}
        </div>
        <p
          className="text-[12px] text-muted truncate mt-0.5"
          style={{ fontFamily: font.cssFamily }}
        >
          {sampleText}
        </p>
      </div>

      <span
        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
          selected ? 'border-ink bg-ink text-white' : 'border-border-strong'
        }`}
        aria-hidden="true"
      >
        {selected && <Check size={12} strokeWidth={2.5} />}
      </span>
    </button>
  );
};

export const TypographyScreen: React.FC<TypographyScreenProps> = ({ onOpenPreview }) => {
  const session = useIvioSession();
  const { blocks } = useBlocks();
  const {
    draft,
    resolved,
    isPro,
    applyPatch,
    toggleLock,
    resetSection,
    trackEvent,
  } = useAppearance();
  const { openUpgrade } = useUpgradeDialog();

  const [activeRole, setActiveRole] = useState<RoleTab>('name');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | FontCategoryV2>('all');
  const [refreshCount, setRefreshCount] = useState(0);
  const [historyStack, setHistoryStack] = useState<number[]>([]);
  const [familyLimitWarning, setFamilyLimitWarning] = useState<string | null>(null);

  const activeVibe = useMemo(
    () => findCatalogVibe(draft.vibeId) || findCatalogVibe('porcelain')!,
    [draft.vibeId]
  );

  const sampleDisplayName = session.displayName || session.username || 'Maya Lin';
  const sampleBio = (session.bio || 'Product designer & creative director').slice(0, 40);
  const sampleButtonLabel =
    blocks.find((b) => b.isActive && !b.isArchived)?.title?.slice(0, 28) || 'My Portfolio';

  const sampleForRole: Record<RoleTab, string> = {
    name: sampleDisplayName,
    bio: sampleBio,
    button: sampleButtonLabel,
  };

  const suggestions = useMemo(() => {
    const seed = buildSuggestionSeed({
      pageId: session.username || 'owner',
      bgSignature: resolved.bgProfile.signature,
      vibeId: activeVibe.id,
      refreshCount,
    });
    return suggestFonts({
      bgProfile: resolved.bgProfile,
      vibe: activeVibe,
      current: draft.typography,
      currentSurface: draft.buttons.surface,
      locks: draft.locks,
      seed,
      seenIds: new Set(readSeenRing('fonts')),
      isPro,
    });
  }, [
    session.username,
    resolved.bgProfile,
    activeVibe,
    draft.typography,
    draft.buttons.surface,
    draft.locks,
    refreshCount,
    isPro,
  ]);

  // Preload Google Fonts for active suggestions cleanly
  useEffect(() => {
    const families = suggestions.flatMap((s) => [
      s.nameFont.family,
      s.bioFont.family,
      s.buttonFont.family,
    ]);
    loadGoogleFonts(families);
  }, [suggestions]);

  const handleRefreshSuggestions = () => {
    appendSeenRing(
      'fonts',
      suggestions.map((s) => s.id)
    );
    setHistoryStack((prev) => [refreshCount, ...prev].slice(0, 3));
    setRefreshCount((c) => c + 1);
    trackEvent('suggestion_refreshed', { engine: 'fonts', count: suggestions.length });
  };

  const handleRestorePrevious = () => {
    if (historyStack.length === 0) return;
    const [prev, ...rest] = historyStack;
    setHistoryStack(rest);
    setRefreshCount(prev);
  };

  const applySuggestionCombo = (combo: FontComboSuggestion, position: number) => {
    if (combo.locked && !isPro) {
      openUpgrade();
      return;
    }

    trackEvent('suggestion_applied', {
      engine: 'fonts',
      recipe: combo.id,
      position,
    });

    applyPatch(
      (prev) => ({
        ...prev,
        typography: {
          name: prev.locks.includes('font.name')
            ? prev.typography.name
            : { ...prev.typography.name, ...combo.nameFont, source: 'suggestion' },
          bio: prev.locks.includes('font.bio')
            ? prev.typography.bio
            : { ...prev.typography.bio, ...combo.bioFont, source: 'suggestion' },
          button: prev.locks.includes('font.button')
            ? prev.typography.button
            : { ...prev.typography.button, ...combo.buttonFont, source: 'suggestion' },
        },
      }),
      { snackbarMessage: `Applied ${combo.name}`, showUndo: true }
    );
  };

  const roleFit: FontRoleFit = activeRole === 'name' ? 'N' : activeRole === 'bio' ? 'B' : 'T';

  const filteredFonts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG_FONTS.filter((f) => {
      if (!isFontAllowedForRole(f, roleFit)) return false;
      if (category !== 'all' && f.category !== category) return false;
      if (!q) return true;
      return (
        f.family.toLowerCase().includes(q) ||
        f.subCategory.toLowerCase().includes(q) ||
        f.moods.some((m) => m.includes(q))
      );
    });
  }, [roleFit, category, search]);

  const currentRoleToken = draft.typography[activeRole];
  const currentCatalogFont =
    findCatalogFont(currentRoleToken.family) || CATALOG_FONTS[0];

  const distinctFamilies = useMemo(
    () =>
      Array.from(
        new Set([
          draft.typography.name.family,
          draft.typography.bio.family,
          draft.typography.button.family,
        ])
      ),
    [draft.typography]
  );

  const handleSelectCatalogFont = (font: CatalogFont) => {
    if (font.tier === 'pro' && !isPro) {
      openUpgrade();
      return;
    }

    // Check 3-family limit explicitly
    const projectedSet = new Set([
      activeRole === 'name' ? font.family : draft.typography.name.family,
      activeRole === 'bio' ? font.family : draft.typography.bio.family,
      activeRole === 'button' ? font.family : draft.typography.button.family,
    ]);
    if (projectedSet.size > 3) {
      setFamilyLimitWarning('At most 3 font families per page. Replace an existing role.');
      return;
    }
    setFamilyLimitWarning(null);

    const nextWeight = clampWeightToFont(font, currentRoleToken.weight);
    applyPatch(
      (prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          [activeRole]: {
            ...prev.typography[activeRole],
            family: font.family,
            weight: nextWeight,
            source: 'user',
          },
        },
      }),
      { snackbarMessage: `${font.family} set for ${activeRole}`, showUndo: true }
    );
  };

  const applyActiveFontToAllRoles = () => {
    const f = currentCatalogFont;
    if (f.tier === 'pro' && !isPro) {
      openUpgrade();
      return;
    }
    applyPatch(
      (prev) => {
        const bioSafeFont = isFontAllowedForRole(f, 'B')
          ? f
          : findCatalogFont(prev.typography.bio.family) || CATALOG_FONTS[0];
        return {
          ...prev,
          typography: {
            name: prev.locks.includes('font.name')
              ? prev.typography.name
              : {
                  ...prev.typography.name,
                  family: f.family,
                  weight: clampWeightToFont(f, prev.typography.name.weight),
                  source: 'user',
                },
            bio: prev.locks.includes('font.bio')
              ? prev.typography.bio
              : {
                  ...prev.typography.bio,
                  family: bioSafeFont.family,
                  weight: clampWeightToFont(bioSafeFont, Math.max(400, prev.typography.bio.weight)),
                  source: 'user',
                },
            button: prev.locks.includes('font.button')
              ? prev.typography.button
              : {
                  ...prev.typography.button,
                  family: f.family,
                  weight: clampWeightToFont(f, prev.typography.button.weight),
                  source: 'user',
                },
          },
        };
      },
      { snackbarMessage: `Applied ${f.family} across roles`, showUndo: true }
    );
  };

  const updateRoleStyle = (patch: Partial<FontRole>) => {
    applyPatch(
      (prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          [activeRole]: {
            ...prev.typography[activeRole],
            ...patch,
            source: 'user',
          },
        },
      }),
      { showUndo: false }
    );
  };

  const roleLockKey: AppearanceLock =
    activeRole === 'name' ? 'font.name' : activeRole === 'bio' ? 'font.bio' : 'font.button';
  const isRoleLocked = draft.locks.includes(roleLockKey);

  // Sticky sub-header: SINGLE row with Name | Bio | Buttons Role Tabs
  const stickyRoleBar = (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
      {(
        [
          { id: 'name', label: 'Name', fam: resolved.typography.name.family },
          { id: 'bio', label: 'Bio', fam: resolved.typography.bio.family },
          { id: 'button', label: 'Buttons', fam: resolved.typography.button.family },
        ] as Array<{ id: RoleTab; label: string; fam: string }>
      ).map((rt) => {
        const active = activeRole === rt.id;
        return (
          <button
            key={rt.id}
            type="button"
            onClick={() => setActiveRole(rt.id)}
            className={`py-1.5 px-2 rounded-lg text-center cursor-pointer transition-colors ${
              active ? 'bg-white text-ink shadow-2xs' : 'text-muted hover:text-ink'
            }`}
          >
            <span className="block text-[12px] font-semibold leading-tight">{rt.label}</span>
            <span className="block text-[11px] opacity-75 truncate">{rt.fam}</span>
          </button>
        );
      })}
    </div>
  );

  // Non-blocking helpful hints
  const isThinOnDark = resolved.bgProfile.tone === 'dark' && currentRoleToken.weight < 400;
  const isUpperLong =
    currentRoleToken.case === 'upper' &&
    activeRole === 'button' &&
    sampleButtonLabel.length > 20;

  return (
    <SectionScreenShell
      sectionKey="typography"
      title="Typography"
      infoText="Choose fonts for your name, bio and buttons. Ideas are matched to your vibe and background."
      stickySubHeader={stickyRoleBar}
      extraMenuItems={[
        ...(historyStack.length > 0
          ? [{ label: 'Previous ideas', onSelect: handleRestorePrevious }]
          : []),
        {
          label: 'Use vibe default',
          onSelect: () => resetSection('typography'),
        },
        {
          label: 'Apply this font to all roles',
          onSelect: applyActiveFontToAllRoles,
        },
      ]}
      onOpenPreview={onOpenPreview}
    >
      {/* GROUP 0: Smart Font Pairings Strip */}
      <SuggestionStrip
        title="Font ideas"
        contextChip={
          <span className="px-2.5 py-0.5 rounded-full border border-border bg-surface text-[12px] font-medium text-muted">
            {activeVibe.name}
          </span>
        }
        items={suggestions}
        getKey={(c) => c.id}
        onRefresh={handleRefreshSuggestions}
        onLongPressPrevious={handleRestorePrevious}
        announceText={`${suggestions.length} new combinations`}
        skeletonWidthClass="w-[188px]"
        skeletonHeightClass="h-[132px]"
        renderItem={(combo, idx) => {
          const nfCss = findCatalogFont(combo.nameFont.family)?.cssFamily || 'sans-serif';
          const bfCss = findCatalogFont(combo.bioFont.family)?.cssFamily || 'sans-serif';
          const tfCss = findCatalogFont(combo.buttonFont.family)?.cssFamily || 'sans-serif';

          return (
            <button
              type="button"
              data-strip-card="1"
              onClick={() => applySuggestionCombo(combo, idx)}
              aria-label={`${combo.name}, ${combo.mood}${combo.locked ? ', Pro' : ''}`}
              className="w-[188px] h-[136px] rounded-[16px] border border-border bg-surface p-3 text-left flex flex-col justify-between hover:border-border-strong transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span
                    className="text-[20px] leading-tight text-ink truncate"
                    style={{
                      fontFamily: nfCss,
                      fontWeight: combo.nameFont.weight,
                    }}
                  >
                    {sampleDisplayName}
                  </span>
                  {combo.locked && <ProBadge locked />}
                </div>
                <p
                  className="text-[12px] text-muted truncate"
                  style={{
                    fontFamily: bfCss,
                    fontWeight: combo.bioFont.weight,
                  }}
                >
                  {sampleBio}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-divider">
                <span
                  className="px-2 py-0.5 rounded-md bg-ink text-white text-[11px] truncate max-w-[100px]"
                  style={{
                    fontFamily: tfCss,
                    fontWeight: combo.buttonFont.weight,
                  }}
                >
                  {sampleButtonLabel}
                </span>
                <span className="text-[10px] font-medium text-muted truncate">
                  {combo.mood}
                </span>
              </div>
            </button>
          );
        }}
      />

      {/* GROUP 1: Role Controls Bar (Lock + Apply All + Distinct Family Counter) */}
      <section aria-label="Role actions" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col">
          <span className="text-[14px] font-semibold text-ink capitalize">
            {activeRole === 'button' ? 'Buttons' : activeRole} font · {currentCatalogFont.family}
          </span>
          <span className="text-[12px] text-muted">
            {distinctFamilies.length}/3 font families in use
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyActiveFontToAllRoles}
            className="h-9 px-3 rounded-lg border border-border text-[12px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
          >
            Apply to all roles
          </button>
          <button
            type="button"
            onClick={() => toggleLock(roleLockKey)}
            aria-pressed={isRoleLocked}
            aria-label={`${isRoleLocked ? 'Unlock' : 'Lock'} ${activeRole} font`}
            className={`h-9 px-3 rounded-lg border inline-flex items-center gap-1.5 text-[12px] font-medium cursor-pointer ${
              isRoleLocked
                ? 'border-ink bg-ink text-white'
                : 'border-border text-ink hover:bg-surface-2'
            }`}
          >
            {isRoleLocked ? <Lock size={13} /> : <Unlock size={13} />}
            <span>{isRoleLocked ? 'Locked' : 'Lock'}</span>
          </button>
        </div>
      </section>

      {familyLimitWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{familyLimitWarning}</span>
        </div>
      )}

      {/* GROUP 2: Font Catalogue List */}
      <section aria-label="Font list" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search fonts for ${activeRole}...`}
              aria-label="Search fonts"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-surface text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_TABS.filter(
              (c) => !(activeRole === 'bio' && c.id === 'script')
            ).map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-ink text-white'
                      : 'bg-surface border border-border text-ink hover:bg-surface-2'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div role="radiogroup" aria-label="Font families" className="flex flex-col gap-2">
          {filteredFonts.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">
              No fonts match that search for {activeRole}.
            </p>
          ) : (
            filteredFonts.map((f) => (
              <FontCatalogRow
                key={f.id}
                font={f}
                selected={currentCatalogFont.id === f.id}
                lockedPro={f.tier === 'pro' && !isPro}
                sampleText={sampleForRole[activeRole]}
                onSelect={() => handleSelectCatalogFont(f)}
              />
            ))
          )}
        </div>
      </section>

      {/* GROUP 3: Style for Selected Role */}
      <section aria-label="Role typography style" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Style for {activeRole === 'button' ? 'buttons' : activeRole}
        </span>

        {/* Size S / M / L */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">Size</span>
          <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
            {(['s', 'm', 'l'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => updateRoleStyle({ size: sz })}
                className={`px-3.5 h-8 rounded-lg text-[12px] font-semibold uppercase cursor-pointer ${
                  currentRoleToken.size === sz ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* Weight (strictly only weights offered by family) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[13px] font-medium text-ink">Weight</span>
          <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
            {currentCatalogFont.weights.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => updateRoleStyle({ weight: w })}
                className={`px-3 h-8 rounded-lg text-[12px] font-mono cursor-pointer ${
                  clampWeightToFont(currentCatalogFont, currentRoleToken.weight) === w
                    ? 'bg-white text-ink shadow-2xs font-semibold'
                    : 'text-muted'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Tracking */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">Tracking</span>
          <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
            {(['tight', 'normal', 'wide'] as const).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => updateRoleStyle({ tracking: tr })}
                className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                  currentRoleToken.tracking === tr ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        {/* Case (Name & Button) */}
        {(activeRole === 'name' || activeRole === 'button') && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink">Case</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['normal', 'upper'] as const).map((cs) => (
                <button
                  key={cs}
                  type="button"
                  onClick={() => updateRoleStyle({ case: cs })}
                  className={`px-3 h-8 rounded-lg text-[12px] font-medium cursor-pointer ${
                    (currentRoleToken.case || 'normal') === cs
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {cs === 'upper' ? 'UPPER' : 'Normal'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Line height (Bio) */}
        {activeRole === 'bio' && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink">Line height</span>
            <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
              {(['compact', 'normal', 'relaxed'] as const).map((lh) => (
                <button
                  key={lh}
                  type="button"
                  onClick={() => updateRoleStyle({ lineHeight: lh })}
                  className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    (currentRoleToken.lineHeight || 'normal') === lh
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Helpful non-blocking readability hints */}
        {(isThinOnDark || isUpperLong || distinctFamilies.length >= 3) && (
          <div className="pt-2 border-t border-divider flex flex-col gap-1 text-[12px] text-amber-800">
            {isThinOnDark && (
              <p>Tip: Weight 400+ stays sharper on dark backgrounds.</p>
            )}
            {isUpperLong && (
              <p>Tip: Long button labels read faster in normal case.</p>
            )}
            {distinctFamilies.length >= 3 && (
              <p>Note: Page uses the maximum of 3 font families.</p>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => resetSection('typography')}
          className="text-[13px] font-medium text-muted hover:text-ink underline cursor-pointer"
        >
          Reset fonts to vibe default
        </button>
      </div>
    </SectionScreenShell>
  );
};

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Lock, Unlock } from 'lucide-react';
import { SectionScreenShell } from './SectionScreenShell';
import { SuggestionStrip } from './SuggestionStrip';
import { useAppearance } from './AppearanceContext';
import {
  CATALOG_AVATAR_FRAMES,
  getAvatarClipAndRadiusCss,
} from '../../lib/appearance/catalog/layouts';
import {
  checkLinkLayoutLabelWarning,
  enforceLayoutInvariants,
} from '../../lib/appearance/catalog/surfaces';
import { findCatalogVibe } from '../../lib/appearance/catalog/vibes';
import {
  appendSeenRing,
  buildSuggestionSeed,
  readSeenRing,
} from '../../lib/color/prng';
import {
  suggestLayouts,
  type LayoutIdeaSuggestion,
} from '../../lib/color/recipes';
import type {
  AvatarFrame,
  AvatarGlowV2,
  AvatarSizeV2,
  EntranceV2,
  HeaderLayoutV2,
  LayoutTokens,
  LinkLayoutV2,
  SocialIconsV2,
  SpacingV2,
  WidthV2,
} from '../../lib/appearance/types';
import { useIvioSession } from '../../auth/useIvioSession';
import { useBlocks } from '../../data/BlocksContext';
import { CardLookTileGrid } from '../links/CardLookTile';

interface LayoutScreenProps {
  onOpenPreview: () => void;
}

const HEADER_OPTIONS: ReadonlyArray<{ id: HeaderLayoutV2; label: string; desc: string }> = [
  { id: 'centered', label: 'Centered', desc: 'Balanced stack' },
  { id: 'editorial', label: 'Editorial', desc: 'Left-aligned bio' },
  { id: 'compact', label: 'Compact row', desc: 'Avatar beside name' },
  { id: 'hero', label: 'Hero', desc: 'Large spotlight' },
];

export const LayoutScreen: React.FC<LayoutScreenProps> = ({ onOpenPreview }) => {
  const session = useIvioSession();
  const { blocks } = useBlocks();
  const {
    draft,
    resolved,
    cardLook,
    setCardLook,
    applyPatch,
    toggleLock,
    resetSection,
    trackEvent,
  } = useAppearance();

  const [refreshCount, setRefreshCount] = useState(0);
  const [historyStack, setHistoryStack] = useState<number[]>([]);

  const activeVibe = useMemo(
    () => findCatalogVibe(draft.vibeId) || findCatalogVibe('porcelain')!,
    [draft.vibeId]
  );

  const linkLabels = useMemo(
    () => blocks.filter((b) => b.isActive && !b.isArchived).map((b) => b.title || ''),
    [blocks]
  );

  const suggestions = useMemo(() => {
    const seed = buildSuggestionSeed({
      pageId: session.username || 'owner',
      bgSignature: resolved.bgProfile.signature,
      vibeId: activeVibe.id,
      refreshCount,
    });
    return suggestLayouts({
      bgProfile: resolved.bgProfile,
      bg: resolved.background,
      vibe: activeVibe,
      buttons: draft.buttons,
      currentLayout: draft.layout,
      locks: draft.locks,
      seed,
      seenIds: new Set(readSeenRing('layout')),
      linkLabels,
    });
  }, [
    session.username,
    resolved.bgProfile,
    resolved.background,
    activeVibe,
    draft.buttons,
    draft.layout,
    draft.locks,
    refreshCount,
    linkLabels,
  ]);

  const handleRefresh = () => {
    appendSeenRing(
      'layout',
      suggestions.map((s) => s.id)
    );
    setHistoryStack((prev) => [refreshCount, ...prev].slice(0, 3));
    setRefreshCount((c) => c + 1);
    trackEvent('suggestion_refreshed', { engine: 'layout', count: suggestions.length });
  };

  const handleRestorePrevious = () => {
    if (historyStack.length === 0) return;
    const [prev, ...rest] = historyStack;
    setHistoryStack(rest);
    setRefreshCount(prev);
  };

  const applyLayoutIdea = (idea: LayoutIdeaSuggestion, position: number) => {
    trackEvent('suggestion_applied', {
      engine: 'layout',
      recipe: idea.id,
      position,
    });

    applyPatch(
      (prev) => {
        const nextLayout: LayoutTokens = prev.locks.includes('layout')
          ? prev.layout
          : enforceLayoutInvariants({
              header: idea.header,
              avatar: idea.avatar,
              linkLayout: idea.linkLayout,
              spacing: idea.spacing,
              width: idea.width,
              entrance: idea.entrance,
              socialIcons: prev.layout.socialIcons,
            });

        return {
          ...prev,
          layout: nextLayout,
          buttons: {
            ...prev.buttons,
            surface: idea.surface || prev.buttons.surface,
            size: idea.buttonSize || prev.buttons.size,
            motion: idea.motion || prev.buttons.motion,
            ...(idea.align ? { align: idea.align } : {}),
            ...(idea.icon ? { icon: idea.icon } : {}),
          },
        };
      },
      { snackbarMessage: `Applied ${idea.name}`, showUndo: true }
    );
  };

  const updateLayout = (
    updater: (prevLayout: LayoutTokens) => LayoutTokens,
    showUndo = false
  ) => {
    applyPatch(
      (prev) => ({
        ...prev,
        layout: enforceLayoutInvariants(updater(prev.layout)),
      }),
      { showUndo }
    );
  };

  const isLayoutLocked = draft.locks.includes('layout');
  const labelWarning = checkLinkLayoutLabelWarning(draft.layout.linkLayout, linkLabels);

  const renderHeaderWireframe = (mode: HeaderLayoutV2) => {
    if (mode === 'editorial') {
      return (
        <div className="w-full h-12 rounded-lg bg-surface-2 p-2 flex flex-col items-start justify-center gap-1">
          <span className="w-3.5 h-3.5 rounded-full bg-ink/80" />
          <span className="w-12 h-1.5 rounded-full bg-ink/70" />
          <span className="w-8 h-1 rounded-full bg-ink/30" />
        </div>
      );
    }
    if (mode === 'compact') {
      return (
        <div className="w-full h-12 rounded-lg bg-surface-2 p-2 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-ink/80 shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
            <span className="w-12 h-1.5 rounded-full bg-ink/70" />
            <span className="w-8 h-1 rounded-full bg-ink/30" />
          </div>
        </div>
      );
    }
    if (mode === 'hero') {
      return (
        <div className="w-full h-12 rounded-lg bg-surface-2 p-1.5 flex flex-col items-center justify-center gap-1">
          <span className="w-6 h-6 rounded-full bg-ink/85 ring-2 ring-ink/20" />
          <span className="w-14 h-1.5 rounded-full bg-ink/70" />
        </div>
      );
    }
    return (
      <div className="w-full h-12 rounded-lg bg-surface-2 p-2 flex flex-col items-center justify-center gap-1">
        <span className="w-4 h-4 rounded-full bg-ink/80" />
        <span className="w-12 h-1.5 rounded-full bg-ink/70" />
        <span className="w-8 h-1 rounded-full bg-ink/30" />
      </div>
    );
  };

  return (
    <SectionScreenShell
      sectionKey="layout"
      title="Layout & effects"
      infoText="Set how your header, links and page are arranged. Ideas are matched to your vibe."
      extraMenuItems={[
        ...(historyStack.length > 0
          ? [{ label: 'Previous ideas', onSelect: handleRestorePrevious }]
          : []),
        {
          label: 'Reset layout to vibe default',
          onSelect: () => resetSection('layout'),
        },
      ]}
      onOpenPreview={onOpenPreview}
    >
      {/* GROUP 0: Layout Ideas Strip */}
      <SuggestionStrip
        title="Layout ideas"
        contextChip={
          <span className="px-2.5 py-0.5 rounded-full border border-border bg-surface text-[12px] font-medium text-muted">
            {activeVibe.name}
          </span>
        }
        items={suggestions}
        getKey={(item) => item.id}
        onRefresh={handleRefresh}
        onLongPressPrevious={handleRestorePrevious}
        announceText={`${suggestions.length} new layouts`}
        skeletonWidthClass="w-[140px]"
        skeletonHeightClass="h-[120px]"
        renderItem={(idea, idx) => (
          <button
            type="button"
            data-strip-card="1"
            onClick={() => applyLayoutIdea(idea, idx)}
            aria-label={`${idea.name}, ${idea.tag}`}
            className="w-[140px] h-[124px] rounded-[16px] border border-border bg-surface p-2.5 text-left flex flex-col justify-between hover:border-border-strong transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
          >
            {/* Tiny Wireframe Preview */}
            <div
              className="w-full h-16 rounded-lg p-2 flex flex-col justify-center gap-1 border border-black/8"
              style={{ background: resolved.pageBg }}
            >
              <div
                className={`flex items-center gap-1.5 ${
                  idea.header === 'editorial'
                    ? 'justify-start'
                    : idea.header === 'compact'
                      ? 'justify-start'
                      : 'justify-center'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: resolved.pageAccent }}
                />
                <span
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: resolved.pageText }}
                />
              </div>
              <div
                className={`grid gap-1 ${
                  idea.linkLayout === 'grid2' ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                <span
                  className="h-2 rounded-sm"
                  style={{
                    backgroundColor:
                      resolved.buttons.fill === 'transparent'
                        ? resolved.pageText
                        : resolved.buttons.fill,
                  }}
                />
                <span
                  className="h-2 rounded-sm opacity-80"
                  style={{
                    backgroundColor:
                      resolved.buttons.fill === 'transparent'
                        ? resolved.pageText
                        : resolved.buttons.fill,
                  }}
                />
              </div>
            </div>

            <div className="px-0.5">
              <div className="text-[12px] font-semibold text-ink truncate">{idea.name}</div>
              <div className="text-[10px] text-muted truncate">{idea.tag}</div>
            </div>
          </button>
        )}
      />

      {/* GROUP 1: Header & Avatar */}
      <section aria-label="Header and avatar" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Header & avatar
          </span>
          <button
            type="button"
            onClick={() => toggleLock('layout')}
            aria-pressed={isLayoutLocked}
            className={`h-8 px-2.5 rounded-lg border inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
              isLayoutLocked
                ? 'border-ink bg-ink text-white'
                : 'border-border text-muted hover:text-ink'
            }`}
          >
            {isLayoutLocked ? <Lock size={12} /> : <Unlock size={12} />}
            <span>{isLayoutLocked ? 'Layout locked' : 'Lock layout'}</span>
          </button>
        </div>

        {/* 2 x 2 Header Alignment Wireframes */}
        <div className="grid grid-cols-2 gap-2.5">
          {HEADER_OPTIONS.map((opt) => {
            const active = draft.layout.header === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, header: opt.id }))}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-2 cursor-pointer transition-colors ${
                  active
                    ? 'border-2 border-ink bg-surface'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                {renderHeaderWireframe(opt.id)}
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{opt.label}</div>
                    <div className="text-[11px] text-muted">{opt.desc}</div>
                  </div>
                  {active && <Check size={14} className="text-ink shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* 2 x 5 Avatar Frame Grid (ALL 10 full names) */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Avatar frame</span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CATALOG_AVATAR_FRAMES.map((frame) => {
              const active = draft.layout.avatar.frame === frame.id;
              const clipStyle = getAvatarClipAndRadiusCss(frame.id, 32);
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() =>
                    updateLayout((l) => ({
                      ...l,
                      avatar: { ...l.avatar, frame: frame.id as AvatarFrame },
                    }))
                  }
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors ${
                    active
                      ? 'border-2 border-ink bg-surface-2/60'
                      : 'border-border bg-surface hover:bg-surface-2/40'
                  }`}
                >
                  <span
                    className={`w-8 h-8 bg-ink/15 block ${
                      frame.id === 'halo'
                        ? 'ring-2 ring-ink/70 ring-offset-2'
                        : frame.id === 'double-ring'
                          ? 'ring-2 ring-ink ring-offset-1'
                          : frame.id === 'gradient-ring'
                            ? 'ring-2 ring-sky-500 ring-offset-1'
                            : frame.id === 'sticker'
                              ? 'border-2 border-white shadow-[2px_2px_0_#111] -rotate-3'
                              : ''
                    }`}
                    style={clipStyle}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-medium text-ink leading-tight">
                    {frame.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Avatar Size & Glow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Avatar size</span>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
              {(
                [
                  { id: 's', label: 'S · 72' },
                  { id: 'm', label: 'M · 96' },
                  { id: 'l', label: 'L · 128' },
                  { id: 'xl', label: 'XL · 160' },
                ] as Array<{ id: AvatarSizeV2; label: string }>
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() =>
                    updateLayout((l) => ({
                      ...l,
                      avatar: { ...l.avatar, size: sz.id },
                    }))
                  }
                  className={`h-8 rounded-lg text-[11px] font-medium cursor-pointer ${
                    resolved.layout.avatar.size === sz.id
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Avatar glow</span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
              {(['none', 'soft', 'accent'] as AvatarGlowV2[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    updateLayout((l) => ({
                      ...l,
                      avatar: { ...l.avatar, glow: g },
                    }))
                  }
                  className={`h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                    (draft.layout.avatar.glow || 'none') === g
                      ? 'bg-white text-ink shadow-2xs'
                      : 'text-muted'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* GROUP 2: Links & Cards */}
      <section aria-label="Links and spacing" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Links & cards
        </span>

        {/* Link Layout Stack | 2-column | Chips */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Link layout</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
            {(
              [
                { id: 'stack', label: 'Stack' },
                { id: 'grid2', label: '2-column' },
                { id: 'chips', label: 'Chips' },
              ] as Array<{ id: LinkLayoutV2; label: string }>
            ).map((ll) => (
              <button
                key={ll.id}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, linkLayout: ll.id }))}
                className={`h-9 rounded-lg text-[13px] font-medium cursor-pointer ${
                  draft.layout.linkLayout === ll.id ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {ll.label}
              </button>
            ))}
          </div>

          {labelWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{labelWarning}</span>
            </div>
          )}
        </div>

        {/* Link Spacing Compact | Balanced | Airy */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[13px] font-medium text-ink">Link spacing</span>
          <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
            {(
              [
                { id: 'compact', label: 'Compact · 8px' },
                { id: 'balanced', label: 'Balanced · 14px' },
                { id: 'airy', label: 'Airy · 22px' },
              ] as Array<{ id: SpacingV2; label: string }>
            ).map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, spacing: sp.id }))}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-medium cursor-pointer ${
                  draft.layout.spacing === sp.id ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Social Icons Outline | Filled | Glass */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">Social icons</span>
          <div className="inline-flex p-1 rounded-xl bg-surface-2 border border-border">
            {(['outline', 'filled', 'glass'] as SocialIconsV2[]).map((si) => (
              <button
                key={si}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, socialIcons: si }))}
                className={`px-3 h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                  draft.layout.socialIcons === si ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {si}
              </button>
            ))}
          </div>
        </div>

        {/* Preserved Embedded Card Look Picker */}
        <div className="pt-2 border-t border-divider flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Embedded cards look</span>
          <CardLookTileGrid
            value={cardLook}
            onChange={setCardLook}
            pageBg={resolved.pageBg}
            pageText={resolved.pageText}
            pageAccent={resolved.pageAccent}
          />
        </div>
      </section>

      {/* GROUP 3: Page (Column Width & Entrance Animation) */}
      <section aria-label="Page settings" className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex flex-col gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Page
        </span>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Column width</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
            {(
              [
                { id: 'focused', label: 'Focused · 440px' },
                { id: 'standard', label: 'Standard · 560px' },
                { id: 'wide', label: 'Wide · 720px' },
              ] as Array<{ id: WidthV2; label: string }>
            ).map((wOpt) => (
              <button
                key={wOpt.id}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, width: wOpt.id }))}
                className={`h-9 rounded-lg text-[12px] font-medium cursor-pointer ${
                  draft.layout.width === wOpt.id ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {wOpt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Entrance animation</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
            {(
              [
                { id: 'none', label: 'None' },
                { id: 'fade-up', label: 'Fade up' },
                { id: 'stagger-scale', label: 'Stagger scale' },
              ] as Array<{ id: EntranceV2; label: string }>
            ).map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => updateLayout((l) => ({ ...l, entrance: ent.id }))}
                className={`h-9 rounded-lg text-[12px] font-medium cursor-pointer ${
                  draft.layout.entrance === ent.id ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                }`}
              >
                {ent.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </SectionScreenShell>
  );
};

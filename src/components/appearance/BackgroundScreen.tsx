import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import { SectionScreenShell } from './SectionScreenShell';
import { OklchColorPicker } from './OklchColorPicker';
import { useAppearance } from './AppearanceContext';
import {
  BACKGROUND_CATEGORIES_V2,
  CATALOG_BACKGROUNDS,
  findCatalogBackground,
  type BackgroundCategoryV2,
} from '../../lib/appearance/catalog/backgrounds';
import { findCatalogVibe } from '../../lib/appearance/catalog/vibes';
import type { Background, Hex, PatternOverlayType } from '../../lib/appearance/types';
import {
  extractPaletteFromImagePixels,
  generateSuggestedSolids,
} from '../../lib/color/analyze';
import { cappedOklchToHex } from '../../lib/color/gamut';
import { hexToOklch } from '../../lib/color/oklch';
import { mulberry32, buildSuggestionSeed } from '../../lib/color/prng';
import { ProBadge } from '../plan/ProBadge';
import { Toggle } from '../ui/Toggle';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useIvioSession } from '../../auth/useIvioSession';

type BgTab = 'presets' | 'color' | 'gradient' | 'image';

interface BackgroundScreenProps {
  onOpenPreview: () => void;
}

export const BackgroundScreen: React.FC<BackgroundScreenProps> = ({ onOpenPreview }) => {
  const session = useIvioSession();
  const {
    draft,
    resolved,
    isPro,
    isDemo,
    applyPatch,
    toggleAutoMatchButtons,
    resetSection,
    trackEvent,
  } = useAppearance();
  const { openUpgrade } = useUpgradeDialog();

  const initialTab: BgTab =
    draft.background.type === 'solid'
      ? 'color'
      : draft.background.type === 'gradient'
        ? 'gradient'
        : draft.background.type === 'image'
          ? 'image'
          : 'presets';

  const [tab, setTab] = useState<BgTab>(initialTab);
  const [category, setCategory] = useState<BackgroundCategoryV2>('all');
  const [search, setSearch] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [photoSwatches, setPhotoSwatches] = useState<Hex[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [gradRefresh, setGradRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focalBoxRef = useRef<HTMLDivElement>(null);

  const activeVibe = useMemo(
    () => findCatalogVibe(draft.vibeId) || findCatalogVibe('porcelain')!,
    [draft.vibeId]
  );

  // Extract "From your photo" swatches client-side on 64x64 downscaled canvas
  useEffect(() => {
    const src =
      draft.background.type === 'image'
        ? draft.background.assetId
        : session.imageUrl;
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 48, 48);
        const data = ctx.getImageData(0, 0, 48, 48).data;
        const palette = extractPaletteFromImagePixels(data, 5);
        if (!cancelled) setPhotoSwatches(palette);
      } catch {}
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [session.imageUrl, draft.background]);

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG_BACKGROUNDS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.moodTags.some((t) => t.includes(q))
      );
    });
  }, [category, search]);

  const suggestedSolids = useMemo(
    () =>
      generateSuggestedSolids(
        activeVibe.page.accent,
        resolved.pageText,
        resolved.bgProfile.tone !== 'dark'
      ),
    [activeVibe.page.accent, resolved.pageText, resolved.bgProfile.tone]
  );

  const setBackground = (bg: Background, coalesce = false) => {
    if (bg.type !== 'legacy') {
      trackEvent('background_changed', {
        type: bg.type,
        preset: bg.type === 'preset' ? bg.id : undefined,
      });
    }
    applyPatch(
      (prev) => ({
        ...prev,
        background: bg,
        migratedFrom: undefined,
      }),
      {
        coalesce,
        checkBgToneShift: !coalesce,
        showUndo: !coalesce,
      }
    );
  };

  const handleSelectPreset = (id: string, tier: 'free' | 'pro') => {
    if (tier === 'pro' && !isPro) {
      openUpgrade();
      return;
    }
    setBackground({ type: 'preset', id });
  };

  const activeGradient =
    draft.background.type === 'gradient'
      ? draft.background
      : {
          type: 'gradient' as const,
          kind: 'linear' as const,
          angle: 135,
          stops: [
            { color: '#6366F1' as Hex, at: 0 },
            { color: '#EC4899' as Hex, at: 100 },
          ],
        };

  const harmonizeGradient = (mode: 'mono' | 'analogous' | 'comp' | 'triad') => {
    const baseHex = activeGradient.stops[0]?.color || '#6366F1';
    const o = hexToOklch(baseHex);
    const makeStop = (L: number, C: number, h: number) =>
      cappedOklchToHex({ L: Math.max(0.12, Math.min(0.95, L)), C: Math.min(0.22, C), h: ((h % 360) + 360) % 360 });

    const stops =
      mode === 'mono'
        ? [
            { color: baseHex, at: 0 },
            { color: makeStop(o.L > 0.5 ? o.L - 0.18 : o.L + 0.18, o.C * 0.9, o.h), at: 100 },
          ]
        : mode === 'analogous'
          ? [
              { color: baseHex, at: 0 },
              { color: makeStop(o.L, Math.max(0.1, o.C), o.h + 30), at: 100 },
            ]
          : mode === 'comp'
            ? [
                { color: baseHex, at: 0 },
                { color: makeStop(o.L, Math.max(0.12, o.C), o.h + 180), at: 100 },
              ]
            : [
                { color: baseHex, at: 0 },
                { color: makeStop(o.L, Math.max(0.11, o.C), o.h + 120), at: 50 },
                { color: makeStop(o.L, Math.max(0.11, o.C), o.h + 240), at: 100 },
              ];

    setBackground({
      ...activeGradient,
      stops,
    });
  };

  const randomizeGradient = () => {
    const nextCount = gradRefresh + 1;
    setGradRefresh(nextCount);
    const rng = mulberry32(
      buildSuggestionSeed({
        pageId: session.username || 'owner',
        bgSignature: resolved.bgProfile.signature,
        vibeId: activeVibe.id,
        refreshCount: nextCount,
      })
    );
    const h = Math.round(rng() * 360);
    const dark = rng() > 0.5;
    const L1 = dark ? 0.18 + rng() * 0.15 : 0.85 + rng() * 0.1;
    const L2 = dark ? 0.25 + rng() * 0.15 : 0.78 + rng() * 0.14;
    const angle = Math.round(rng() * 360);
    setBackground({
      type: 'gradient',
      kind: 'linear',
      angle,
      stops: [
        { color: cappedOklchToHex({ L: L1, C: 0.12, h }), at: 0 },
        { color: cappedOklchToHex({ L: L2, C: 0.14, h: (h + 38) % 360 }), at: 100 },
      ],
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!isPro) {
      openUpgrade();
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Use JPG, PNG or WebP images.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Maximum image size is 8 MB.');
      return;
    }

    // Read dimensions + extract 8x8 luminance grid & dominant colors client-side first
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('READ_FAIL'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('IMAGE_DECODE_FAIL'));
        el.src = dataUrl;
      });

      if (Math.min(img.width, img.height) < 1080) {
        setUploadError('Image must be at least 1080px on the short side.');
        setUploading(false);
        return;
      }

      // Compute 8x8 luminance grid + dominant swatches
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      let dominantColors: Hex[] = ['#0F172A', '#334155'];
      const luminanceGrid: number[] = [];
      if (ctx) {
        ctx.drawImage(img, 0, 0, 48, 48);
        const px = ctx.getImageData(0, 0, 48, 48).data;
        dominantColors = extractPaletteFromImagePixels(px, 4);
        for (let gy = 0; gy < 8; gy++) {
          for (let gx = 0; gx < 8; gx++) {
            const x = gx * 6 + 3;
            const y = gy * 6 + 3;
            const idx = (y * 48 + x) * 4;
            const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
            const lum =
              0.2126 * lin(px[idx] / 255) +
              0.7152 * lin(px[idx + 1] / 255) +
              0.0722 * lin(px[idx + 2] / 255);
            luminanceGrid.push(Number(lum.toFixed(3)));
          }
        }
      }

      let finalAssetUrl = dataUrl;
      if (!isDemo && session.userId && session.username) {
        const res = await fetch('/api/appearance/background-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': session.userId,
            'x-iveo-username': session.username,
            ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
          },
          body: JSON.stringify({
            username: session.username,
            dataUrl,
            mimeType: file.type,
            dominantColors,
            luminanceGrid,
          }),
        });
        if (res.status === 402) {
          setUploading(false);
          openUpgrade();
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(json.error || 'Image upload failed.');
          setUploading(false);
          return;
        }
        finalAssetUrl = json.assetId || dataUrl;
      }

      setBackground({
        type: 'image',
        assetId: finalAssetUrl,
        blur: 0,
        opacity: 100,
        brightness: 100,
        focal: { x: 50, y: 50 },
        smartScrim: true,
        dominantColors,
        luminanceGrid,
      });
    } catch {
      setUploadError('Could not process this image file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stickyControls = (
    <div className="flex flex-col gap-2">
      {/* Segmented Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
        {(
          [
            { id: 'presets', label: 'Presets' },
            { id: 'color', label: 'Color' },
            { id: 'gradient', label: 'Gradient' },
            { id: 'image', label: 'Image', pro: !isPro },
          ] as Array<{ id: BgTab; label: string; pro?: boolean }>
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                active ? 'bg-white text-ink shadow-2xs' : 'text-muted hover:text-ink'
              }`}
            >
              <span>{t.label}</span>
              {t.pro && <Lock size={11} className="text-muted" />}
            </button>
          );
        })}
      </div>

      {/* Presets Search & Category Chips */}
      {tab === 'presets' && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: dark, mesh, grain..."
              aria-label="Search backgrounds"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-surface text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {BACKGROUND_CATEGORIES_V2.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
      )}
    </div>
  );

  const selectedPresetMeta =
    draft.background.type === 'preset' ? findCatalogBackground(draft.background.id) : null;

  return (
    <SectionScreenShell
      sectionKey="background"
      title="Background"
      infoText="Choose what sits behind your links. Buttons can match it automatically."
      stickySubHeader={stickyControls}
      extraMenuItems={[
        {
          label: 'Auto-match buttons to background',
          active: Boolean(draft.autoMatchButtons),
          onSelect: toggleAutoMatchButtons,
        },
      ]}
      onOpenPreview={onOpenPreview}
    >
      {/* Legacy Banner for Migrated Pages */}
      {draft.background.type === 'legacy' && tab === 'presets' && (
        <div className="rounded-2xl border border-border bg-surface p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">Current background (legacy)</p>
            <p className="text-[12px] text-muted">
              Preserved so your live page stays identical. Pick a new background anytime.
            </p>
          </div>
        </div>
      )}

      {/* PRESETS TAB */}
      {tab === 'presets' && (
        <>
          {/* Collapsed-by-default Adjust Controls when preset selected */}
          {draft.background.type === 'preset' && selectedPresetMeta && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setAdjustOpen((o) => !o)}
                className="w-full px-4 py-3 flex items-center justify-between text-[13px] font-semibold text-ink hover:bg-surface-2/60 cursor-pointer"
              >
                <span>Adjust · {selectedPresetMeta.name}</span>
                {adjustOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {adjustOpen && draft.background.type === 'preset' && (
                <div className="p-4 pt-1 border-t border-divider flex flex-col gap-3.5 text-[13px]">
                  <label className="flex flex-col gap-1">
                    <span className="flex justify-between text-muted">
                      <span>Grain</span>
                      <span className="tabular-nums">{draft.background.grain ?? 0}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={draft.background.grain ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (draft.background.type === 'preset') {
                          setBackground({ ...draft.background, grain: v }, true);
                        }
                      }}
                      className="accent-ink"
                    />
                  </label>

                  {['mesh', 'aurora', 'glass'].includes(selectedPresetMeta.category) && (
                    <label className="flex flex-col gap-1">
                      <span className="flex justify-between text-muted">
                        <span>Soft blur</span>
                        <span className="tabular-nums">{draft.background.blur ?? 0}px</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={draft.background.blur ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (draft.background.type === 'preset') {
                            setBackground({ ...draft.background, blur: v }, true);
                          }
                        }}
                        className="accent-ink"
                      />
                    </label>
                  )}

                  <label className="flex flex-col gap-1">
                    <span className="flex justify-between text-muted">
                      <span>Vignette</span>
                      <span className="tabular-nums">{draft.background.vignette ?? 0}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={draft.background.vignette ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (draft.background.type === 'preset') {
                          setBackground({ ...draft.background, vignette: v }, true);
                        }
                      }}
                      className="accent-ink"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="flex justify-between text-muted">
                      <span>Tone</span>
                      <span className="tabular-nums">{draft.background.tone ?? 0}</span>
                    </span>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      value={draft.background.tone ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (draft.background.type === 'preset') {
                          setBackground({ ...draft.background, tone: v }, true);
                        }
                      }}
                      className="accent-ink"
                    />
                  </label>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted">Pattern overlay</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'dots', 'grid', 'lines', 'contours'] as PatternOverlayType[]).map((pk) => {
                        const curr = draft.background.type === 'preset' ? draft.background.pattern?.kind || 'none' : 'none';
                        return (
                          <button
                            key={pk}
                            type="button"
                            onClick={() => {
                              if (draft.background.type === 'preset') {
                                setBackground({
                                  ...draft.background,
                                  pattern: {
                                    kind: pk,
                                    opacity: draft.background.pattern?.opacity ?? 14,
                                  },
                                });
                              }
                            }}
                            className={`h-8 px-3 rounded-lg border text-[12px] capitalize cursor-pointer ${
                              curr === pk
                                ? 'border-ink bg-ink text-white'
                                : 'border-border text-ink hover:bg-surface-2'
                            }`}
                          >
                            {pk}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {['animated', 'mesh', 'aurora'].includes(selectedPresetMeta.category) && (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">Subtle motion</span>
                        {!isPro && <ProBadge locked />}
                      </div>
                      <Toggle
                        checked={Boolean(draft.background.animate)}
                        locked={!isPro}
                        ariaLabel="Animate background"
                        onChange={() => {
                          if (!isPro) {
                            openUpgrade();
                            return;
                          }
                          if (draft.background.type === 'preset') {
                            setBackground({
                              ...draft.background,
                              animate: !draft.background.animate,
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3-Column Thumbnail Grid */}
          {filteredPresets.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center text-[14px] text-muted">
              Nothing found. Try Mesh or Grain.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {filteredPresets.map((preset) => {
                const isSelected =
                  draft.background.type === 'preset' && draft.background.id === preset.id;
                const isLocked = preset.tier === 'pro' && !isPro;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id, preset.tier)}
                    className="flex flex-col text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-ink rounded-[14px]"
                  >
                    <div
                      className={`relative w-full aspect-[1/1.35] rounded-[14px] overflow-hidden border transition-all ${
                        isSelected
                          ? 'ring-2 ring-ink ring-offset-2 border-ink'
                          : 'border-border group-hover:border-border-strong'
                      }`}
                      style={{
                        background: preset.cssBackground,
                      }}
                    >
                      {isLocked && (
                        <span className="absolute top-1.5 right-1.5">
                          <ProBadge locked />
                        </span>
                      )}
                      {isSelected && (
                        <span
                          aria-label="Selected"
                          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center shadow-xs"
                        >
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                    <span className="mt-1.5 text-[12px] font-medium text-ink leading-snug">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* COLOR TAB */}
      {tab === 'color' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <OklchColorPicker
              value={draft.background.type === 'solid' ? draft.background.color : resolved.bgProfile.meanHex}
              onChange={(hex) => setBackground({ type: 'solid', color: hex }, true)}
              suggestedSwatches={suggestedSolids}
              suggestedLabel="Suggested for your vibe"
            />
          </div>

          {photoSwatches.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                From your photo
              </span>
              <div className="flex items-center flex-wrap gap-2">
                {photoSwatches.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setBackground({ type: 'solid', color: hex })}
                    aria-label={`Apply photo colour ${hex}`}
                    className="w-10 h-10 rounded-full border border-border hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRADIENT TAB */}
      {tab === 'gradient' && (
        <div className="flex flex-col gap-4">
          <div
            className="w-full h-24 rounded-2xl border border-border"
            style={{
              background:
                activeGradient.kind === 'radial'
                  ? `radial-gradient(circle at 50% 45%, ${activeGradient.stops.map((s) => `${s.color} ${s.at}%`).join(', ')})`
                  : activeGradient.kind === 'conic'
                    ? `conic-gradient(from ${activeGradient.angle}deg at 50% 50%, ${activeGradient.stops.map((s) => `${s.color} ${s.at}%`).join(', ')})`
                    : `linear-gradient(${activeGradient.angle}deg, ${activeGradient.stops.map((s) => `${s.color} ${s.at}%`).join(', ')})`,
            }}
          />

          <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-border flex-1">
                {(['linear', 'radial', 'conic'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBackground({ ...activeGradient, kind: k })}
                    className={`h-8 rounded-lg text-[12px] font-medium capitalize cursor-pointer ${
                      activeGradient.kind === k ? 'bg-white text-ink shadow-2xs' : 'text-muted'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={randomizeGradient}
                aria-label="Randomize gradient"
                title="Randomize"
                className="w-10 h-10 rounded-xl border border-border inline-flex items-center justify-center text-ink hover:bg-surface-2 cursor-pointer"
              >
                <Shuffle size={16} />
              </button>
            </div>

            {activeGradient.kind !== 'radial' && (
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="flex justify-between text-muted">
                  <span>Angle</span>
                  <span className="tabular-nums font-mono">{activeGradient.angle}°</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={activeGradient.angle}
                  onChange={(e) =>
                    setBackground({ ...activeGradient, angle: Number(e.target.value) }, true)
                  }
                  className="accent-ink"
                />
              </label>
            )}

            {/* Stops */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Stops ({activeGradient.stops.length}/4)
                </span>
                {activeGradient.stops.length < 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextStops = [
                        ...activeGradient.stops,
                        { color: '#38BDF8' as Hex, at: 50 },
                      ].sort((a, b) => a.at - b.at);
                      setBackground({ ...activeGradient, stops: nextStops });
                    }}
                    className="text-[12px] font-semibold text-ink inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus size={14} /> Add stop
                  </button>
                )}
              </div>

              {activeGradient.stops.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={st.color}
                    aria-label={`Gradient stop ${idx + 1} colour`}
                    onChange={(e) => {
                      const nextStops = activeGradient.stops.map((item, sIdx) =>
                        sIdx === idx ? { ...item, color: e.target.value.toUpperCase() as Hex } : item
                      );
                      setBackground({ ...activeGradient, stops: nextStops }, true);
                    }}
                    className="w-9 h-9 rounded-lg border border-border p-0.5 cursor-pointer"
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={st.at}
                    onChange={(e) => {
                      const nextStops = activeGradient.stops.map((item, sIdx) =>
                        sIdx === idx ? { ...item, at: Number(e.target.value) } : item
                      );
                      setBackground({ ...activeGradient, stops: nextStops }, true);
                    }}
                    className="flex-1 accent-ink"
                  />
                  <span className="w-9 text-right text-[12px] font-mono text-muted tabular-nums">
                    {st.at}%
                  </span>
                  {activeGradient.stops.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextStops = activeGradient.stops.filter((_, sIdx) => sIdx !== idx);
                        setBackground({ ...activeGradient, stops: nextStops });
                      }}
                      aria-label={`Remove stop ${idx + 1}`}
                      className="w-8 h-8 rounded-lg text-muted hover:text-red-600 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-divider flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Harmonize from first colour
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'mono', label: 'Monochrome' },
                  { id: 'analogous', label: 'Analogous' },
                  { id: 'comp', label: 'Complementary' },
                  { id: 'triad', label: 'Triad' },
                ].map((hOpt) => (
                  <button
                    key={hOpt.id}
                    type="button"
                    onClick={() => harmonizeGradient(hOpt.id as 'mono' | 'analogous' | 'comp' | 'triad')}
                    className="h-8 px-3 rounded-lg border border-border text-[12px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
                  >
                    {hOpt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE TAB (PRO) */}
      {tab === 'image' && (
        <div className="flex flex-col gap-4">
          {!isPro ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center flex flex-col items-center gap-3">
              <ProBadge locked />
              <h3 className="text-[16px] font-semibold text-ink">
                Custom photo backgrounds
              </h3>
              <p className="text-[13px] text-muted max-w-sm">
                Upload high-res JPG, PNG or WebP images with focal positioning, blur, and smart contrast scrims.
              </p>
              <button
                type="button"
                onClick={() => openUpgrade()}
                className="h-11 px-5 rounded-xl bg-ink text-white text-[14px] font-semibold cursor-pointer"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-12 px-4 rounded-xl border-2 border-dashed border-border hover:border-ink flex items-center justify-center gap-2 text-[14px] font-medium text-ink cursor-pointer"
              >
                <Upload size={17} />
                <span>{uploading ? 'Processing photo...' : 'Upload photo (JPG/PNG/WebP, >=1080px)'}</span>
              </button>

              {uploadError && (
                <p className="text-[12px] text-red-600 font-medium">{uploadError}</p>
              )}

              {draft.background.type === 'image' && (
                <>
                  {/* Interactive Focal Point */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Focal point (tap image)
                    </span>
                    <div
                      ref={focalBoxRef}
                      onClick={(e) => {
                        const rect = focalBoxRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                        if (draft.background.type === 'image') {
                          setBackground({ ...draft.background, focal: { x, y } });
                        }
                      }}
                      className="relative w-full h-44 rounded-xl overflow-hidden border border-border cursor-crosshair"
                    >
                      <img
                        src={draft.background.assetId}
                        alt="Background focal preview"
                        className="w-full h-full object-cover"
                        style={{
                          objectPosition: `${draft.background.focal.x}% ${draft.background.focal.y}%`,
                        }}
                      />
                      <span
                        className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink/60 shadow pointer-events-none"
                        style={{
                          left: `${draft.background.focal.x}%`,
                          top: `${draft.background.focal.y}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 text-[13px]">
                    <label className="flex flex-col gap-1">
                      <span className="flex justify-between text-muted">
                        <span>Blur</span>
                        <span className="tabular-nums">{draft.background.blur}px</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={draft.background.blur}
                        onChange={(e) => {
                          if (draft.background.type === 'image') {
                            setBackground({ ...draft.background, blur: Number(e.target.value) }, true);
                          }
                        }}
                        className="accent-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="flex justify-between text-muted">
                        <span>Opacity</span>
                        <span className="tabular-nums">{draft.background.opacity}%</span>
                      </span>
                      <input
                        type="range"
                        min={30}
                        max={100}
                        value={draft.background.opacity}
                        onChange={(e) => {
                          if (draft.background.type === 'image') {
                            setBackground({ ...draft.background, opacity: Number(e.target.value) }, true);
                          }
                        }}
                        className="accent-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="flex justify-between text-muted">
                        <span>Brightness</span>
                        <span className="tabular-nums">{draft.background.brightness}%</span>
                      </span>
                      <input
                        type="range"
                        min={60}
                        max={120}
                        value={draft.background.brightness}
                        onChange={(e) => {
                          if (draft.background.type === 'image') {
                            setBackground({ ...draft.background, brightness: Number(e.target.value) }, true);
                          }
                        }}
                        className="accent-ink"
                      />
                    </label>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="font-medium text-ink block">Smart scrim</span>
                        <span className="text-[12px] text-muted">
                          Keeps page text readable over bright or busy spots.
                        </span>
                      </div>
                      <Toggle
                        checked={draft.background.smartScrim !== false}
                        ariaLabel="Smart contrast scrim"
                        onChange={() => {
                          if (draft.background.type === 'image') {
                            setBackground({
                              ...draft.background,
                              smartScrim: draft.background.smartScrim === false,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </SectionScreenShell>
  );
};

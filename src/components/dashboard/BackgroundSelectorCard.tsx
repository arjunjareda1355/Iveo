import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Monitor,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useToast } from '../ui/Toast';
import { BackgroundConfig, BackgroundImageFit, GradientDirection } from '../../data/types';
import { DEFAULT_BACKGROUND_CONFIG } from '../../lib/preferences';
import {
  BACKGROUND_CATEGORIES,
  BACKGROUND_PRESETS,
  BackgroundCategory,
  BackgroundPreset,
  buildGradientCss,
  computeBackgroundLayers,
  resolveBackgroundConfig,
} from '../../lib/backgrounds';
import {
  checkBackgroundContrast,
  COLOR_SWATCHES,
  isLightHexColor,
  normalizeHexColor,
  parseHexRgb,
  resolveEffectiveTokens,
} from '../../lib/colors';
import { VIBES, Vibe } from '../../lib/vibes';
import { BackgroundLayer } from '../page/BackgroundLayer';
import { compressImageFile } from '../../lib/imageCompressor';

interface BackgroundSelectorCardProps {
  currentBackground?: BackgroundConfig | null;
  vibe?: Vibe;
  isPro: boolean;
  username?: string | null;
  userId?: string | null;
  primaryEmail?: string | null;
  onBackgroundChange: (bg: BackgroundConfig | null) => Promise<void> | void;
  onPreviewBackgroundChange?: (bg: BackgroundConfig | null) => void;
  embedded?: boolean;
}

type StudioSection = 'presets' | 'solid' | 'gradient' | 'upload' | 'effects';

const SOLID_PALETTE: readonly string[] = [
  '#FFFFFF',
  '#FAF8F5',
  '#F4F4F5',
  '#F1F5F9',
  '#FFF1F2',
  '#ECFDF5',
  '#EFF6FF',
  '#FEFCE8',
  '#0A0A0A',
  '#111827',
  '#1E1B4B',
  '#04241B',
  '#27150E',
  '#1F2937',
];

const CURATED_GRADIENTS: readonly {
  id: string;
  name: string;
  stops: string[];
  direction: GradientDirection;
  angle: number;
}[] = [
  { id: 'dawn-silk', name: 'Dawn Silk', stops: ['#FFF1F2', '#FFE4E6', '#E0F2FE'], direction: 'to bottom right', angle: 135 },
  { id: 'lavender-cloud', name: 'Lavender Cloud', stops: ['#F5F3FF', '#E0E7FF'], direction: 'to bottom', angle: 180 },
  { id: 'sage-mist', name: 'Sage Mist', stops: ['#ECFDF5', '#D1FAE5', '#F0FDFA'], direction: 'to bottom right', angle: 145 },
  { id: 'midnight-indigo', name: 'Midnight Indigo', stops: ['#0F172A', '#1E1B4B', '#312E81'], direction: 'to bottom right', angle: 150 },
  { id: 'obsidian-ember', name: 'Obsidian Ember', stops: ['#09090B', '#27150E'], direction: 'to bottom', angle: 165 },
  { id: 'ocean-deep', name: 'Ocean Deep', stops: ['#020617', '#0F172A', '#0EA5E9'], direction: 'radial', angle: 180 },
];

const GRADIENT_DIRECTIONS: readonly { value: GradientDirection; label: string }[] = [
  { value: 'to bottom', label: 'Top → Bottom' },
  { value: 'to top', label: 'Bottom → Top' },
  { value: 'to right', label: 'Left → Right' },
  { value: 'to bottom right', label: 'Diagonal ↘' },
  { value: 'to top right', label: 'Diagonal ↗' },
  { value: 'radial', label: 'Radial Glow' },
];

function getInitialSection(bg: BackgroundConfig): StudioSection {
  if (bg.type === 'image') return 'upload';
  if (bg.type === 'solid' && !bg.presetId) return 'solid';
  if (bg.type === 'gradient' && bg.gradientStops && bg.gradientStops.length >= 2) return 'gradient';
  return 'presets';
}

export const BackgroundSelectorCard: React.FC<BackgroundSelectorCardProps> = ({
  currentBackground,
  vibe = VIBES[0],
  isPro,
  username,
  userId,
  primaryEmail,
  onBackgroundChange,
  onPreviewBackgroundChange,
  embedded = false,
}) => {
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialResolved = useMemo(
    () => resolveBackgroundConfig(currentBackground),
    [currentBackground]
  );

  const [draft, setDraft] = useState<BackgroundConfig>(initialResolved);
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<StudioSection>(() =>
    getInitialSection(initialResolved)
  );
  const [categoryFilter, setCategoryFilter] = useState<BackgroundCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hexInput, setHexInput] = useState<string>(
    initialResolved.type === 'solid' && initialResolved.value ? initialResolved.value : '#FFFFFF'
  );
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'desktop'>('mobile');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync draft with incoming saved background when user is not actively editing
  useEffect(() => {
    if (!isDirty) {
      const next = resolveBackgroundConfig(currentBackground);
      setDraft(next);
      if (next.type === 'solid' && next.value) {
        setHexInput(next.value);
      }
    }
  }, [currentBackground, isDirty]);

  const applyDraftUpdate = (next: BackgroundConfig) => {
    setDraft(next);
    setIsDirty(true);
    onPreviewBackgroundChange?.(next);
  };

  const activePresetId =
    draft.presetId ||
    (draft.type === 'image'
      ? 'custom-image'
      : draft.type === 'solid' && draft.value?.toUpperCase() === '#FFFFFF'
        ? 'pure-white'
        : 'custom');

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return BACKGROUND_PRESETS.filter((preset) => {
      if (categoryFilter !== 'all' && preset.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        preset.name.toLowerCase().includes(q) ||
        preset.subtitle.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, searchQuery]);

  // Solid RGB derived from draft hex
  const currentSolidHex =
    draft.type === 'solid' && normalizeHexColor(draft.value)
      ? normalizeHexColor(draft.value)!
      : '#FFFFFF';
  const currentRgb = parseHexRgb(currentSolidHex) || [255, 255, 255];

  // Gradient derived values
  const gradientStops =
    draft.gradientStops && draft.gradientStops.length >= 2
      ? draft.gradientStops
      : ['#FFFFFF', '#E2E8F0'];
  const gradientDirection: GradientDirection = draft.gradientDirection || 'to bottom right';
  const gradientAngle = typeof draft.gradientAngle === 'number' ? draft.gradientAngle : 135;

  // Contrast & legibility live report
  const previewTokens = resolveEffectiveTokens(vibe.tokens, null, draft);
  const contrastReport = checkBackgroundContrast(
    previewTokens.text,
    draft,
    vibe.tokens.bg
  );

  const handleSelectPreset = (preset: BackgroundPreset) => {
    if (preset.isPro && !isPro) {
      openUpgrade('backgrounds');
      return;
    }

    if (preset.type === 'none' || preset.id === 'pure-white') {
      applyDraftUpdate({
        ...DEFAULT_BACKGROUND_CONFIG,
        recentColors: draft.recentColors,
      });
      setHexInput('#FFFFFF');
      return;
    }

    applyDraftUpdate({
      type: preset.type,
      value: preset.value,
      presetId: preset.id,
      recentColors: draft.recentColors,
    });
    if (preset.type === 'solid' && preset.value) {
      setHexInput(preset.value);
    }
  };

  const handleSolidColorPick = (rawColor: string) => {
    const norm = normalizeHexColor(rawColor);
    if (!norm) return;
    setHexInput(norm);
    applyDraftUpdate({
      ...draft,
      type: 'solid',
      value: norm,
      presetId: norm === '#FFFFFF' ? 'pure-white' : undefined,
      gradientStops: undefined,
    });
  };

  const handleRgbChange = (channelIdx: 0 | 1 | 2, rawVal: string) => {
    const num = Math.min(255, Math.max(0, Number.parseInt(rawVal || '0', 10) || 0));
    const nextRgb: [number, number, number] = [...currentRgb] as [number, number, number];
    nextRgb[channelIdx] = num;
    const hex = `#${nextRgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    handleSolidColorPick(hex);
  };

  const updateGradient = (
    nextStops: string[],
    nextDirection: GradientDirection = gradientDirection,
    nextAngle: number = gradientAngle
  ) => {
    const css = buildGradientCss(nextStops, nextDirection, nextAngle);
    applyDraftUpdate({
      ...draft,
      type: 'gradient',
      value: css,
      presetId: undefined,
      gradientStops: nextStops,
      gradientDirection: nextDirection,
      gradientAngle: nextAngle,
    });
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!isPro) {
      openUpgrade('backgrounds');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a PNG, JPG, WebP, or AVIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image exceeds the 5MB upload limit.');
      return;
    }

    setIsUploading(true);
    try {
      const { dataUrl } = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
        cropSquare: false,
      });

      const isDemo =
        typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('demo') === '1' ||
          new URLSearchParams(window.location.search).get('autostart') === '1');

      let finalUrl = dataUrl;
      if (username && !isDemo) {
        const res = await fetch('/api/background/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': userId } : {}),
            ...(primaryEmail ? { 'x-user-email': primaryEmail } : {}),
          },
          body: JSON.stringify({
            username,
            userId,
            primaryEmail,
            dataUrl,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data.url) {
          throw new Error(data?.message || data?.error || 'Upload failed');
        }
        finalUrl = data.url;
      }

      applyDraftUpdate({
        ...draft,
        type: 'image',
        value: finalUrl,
        presetId: 'custom-image',
        imageFit: draft.imageFit || 'cover',
        imagePosition: draft.imagePosition || { x: 50, y: 50 },
        opacity: draft.opacity ?? 1,
        overlayColor: draft.overlayColor || '#000000',
        overlayOpacity: draft.overlayOpacity ?? 0.2,
      });
      showToast('Background image ready — click Save changes to publish');
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload image. Try a smaller file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImproveReadability = () => {
    const scrimColor = isLightHexColor(previewTokens.text) ? '#000000' : '#FFFFFF';
    applyDraftUpdate({
      ...draft,
      overlayColor: scrimColor,
      overlayOpacity: 0.52,
    });
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      let nextRecent = Array.isArray(draft.recentColors) ? [...draft.recentColors] : [];
      if (draft.type === 'solid' && draft.value) {
        const norm = normalizeHexColor(draft.value);
        if (norm) {
          nextRecent = [norm, ...nextRecent.filter((c) => c !== norm)].slice(0, 8);
        }
      }
      const payload: BackgroundConfig = {
        ...draft,
        ...(nextRecent.length > 0 ? { recentColors: nextRecent } : {}),
      };
      await onBackgroundChange(payload);
      setDraft(payload);
      setIsDirty(false);
      onPreviewBackgroundChange?.(null);
      showToast('Page background saved');
    } catch {
      showToast("Couldn't save background. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDraft = () => {
    const reverted = resolveBackgroundConfig(currentBackground);
    setDraft(reverted);
    if (reverted.type === 'solid' && reverted.value) {
      setHexInput(reverted.value);
    }
    setIsDirty(false);
    setShowResetConfirm(false);
    onPreviewBackgroundChange?.(null);
  };

  const handleConfirmResetPureWhite = async () => {
    setIsSaving(true);
    try {
      const resetCfg: BackgroundConfig = {
        ...DEFAULT_BACKGROUND_CONFIG,
        ...(draft.recentColors ? { recentColors: draft.recentColors } : {}),
      };
      await onBackgroundChange(resetCfg);
      setDraft(resetCfg);
      setHexInput('#FFFFFF');
      setIsDirty(false);
      setShowResetConfirm(false);
      onPreviewBackgroundChange?.(null);
      showToast('Background reset to Pure White');
    } catch {
      showToast("Couldn't reset background.");
    } finally {
      setIsSaving(false);
    }
  };

  const isPureWhite =
    draft.type === 'solid' &&
    (draft.value || '#FFFFFF').toUpperCase() === '#FFFFFF' &&
    !draft.overlayOpacity &&
    !draft.blur;

  const layersPreview = computeBackgroundLayers(draft, vibe.tokens.bg);

  const content = (
    <div className="flex flex-col gap-5">
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[20px] font-semibold text-ink leading-tight">
              Page Background Studio
            </h3>
            <p className="mt-1 text-[14px] text-muted">
              Customize colors, gradients, curated presets, textures, or custom photos.
            </p>
          </div>
        </div>
      )}

      {/* Live Mini Studio Preview (Mobile / Desktop Toggle) + Contrast Guard */}
      <div className="p-3.5 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-ink uppercase tracking-wider">
              Studio Preview
            </span>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-800 border border-amber-500/30">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="inline-flex p-0.5 bg-surface border border-border rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewViewport('mobile')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors ${
                previewViewport === 'mobile'
                  ? 'bg-ink text-surface'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Smartphone size={12} />
              <span>Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewport('desktop')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors ${
                previewViewport === 'desktop'
                  ? 'bg-ink text-surface'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Monitor size={12} />
              <span>Desktop</span>
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            className={`relative overflow-hidden rounded-xl border border-border shadow-xs transition-all duration-200 flex flex-col items-center justify-center p-4 ${
              previewViewport === 'mobile' ? 'w-[200px] h-[148px]' : 'w-full h-[148px]'
            }`}
            style={{ backgroundColor: layersPreview.baseColor }}
          >
            <BackgroundLayer
              mode="contained"
              background={draft}
              fallbackBg={vibe.tokens.bg}
            />
            <div className="relative z-10 flex flex-col items-center gap-1.5 w-full max-w-[160px]">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={{
                  backgroundColor: previewTokens.avatarBg,
                  color: previewTokens.avatarText,
                }}
              >
                {(username || 'IV').slice(0, 2).toUpperCase()}
              </div>
              <span
                className="text-[12px] font-semibold truncate max-w-full"
                style={{ color: previewTokens.text }}
              >
                @{username || 'creator'}
              </span>
              <div
                className="w-full h-6 rounded-md flex items-center justify-center text-[10px] font-medium"
                style={{
                  backgroundColor: previewTokens.buttonBg,
                  color: previewTokens.buttonText,
                  border: previewTokens.buttonBorder
                    ? `1px solid ${previewTokens.buttonBorder}`
                    : 'none',
                }}
              >
                Sample link
              </div>
            </div>
          </div>
        </div>

        {/* Contrast / Readability Check */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[12px] ${
            contrastReport.passesAA
              ? 'bg-surface border-border text-muted'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {contrastReport.passesAA ? (
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            )}
            <span>
              Text contrast: <strong className="font-mono">{contrastReport.ratio}:1</strong>{' '}
              {contrastReport.passesAA ? '(Readable)' : '(Low readability)'}
            </span>
          </div>

          {!contrastReport.passesAA && (
            <button
              type="button"
              onClick={handleImproveReadability}
              className="px-2.5 py-1 rounded-md bg-ink text-white text-[11px] font-medium hover:opacity-90 cursor-pointer shrink-0"
            >
              Improve readability
            </button>
          )}
        </div>
      </div>

      {/* Studio Mode Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border no-scrollbar">
        {(
          [
            { id: 'presets', label: 'Presets' },
            { id: 'solid', label: 'Solid Color' },
            { id: 'gradient', label: 'Gradient' },
            { id: 'upload', label: 'Image Upload', pro: !isPro },
            { id: 'effects', label: 'Effects & Tint' },
          ] as { id: StudioSection; label: string; pro?: boolean }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              activeSection === tab.id
                ? 'bg-ink text-surface'
                : 'text-muted hover:text-ink hover:bg-surface-2'
            }`}
          >
            <span>{tab.label}</span>
            {tab.pro && <ProBadge className="scale-75 origin-left" />}
          </button>
        ))}
      </div>

      {/* 1. Presets Section */}
      {activeSection === 'presets' && (
        <div className="flex flex-col gap-3.5">
          {/* Search + Category Pills */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search minimal, pastel, dark, aurora, glass, texture..."
              className="w-full h-9 pl-8 pr-3 bg-surface-2 border border-border rounded-lg text-[13px] text-ink placeholder:text-muted/70 focus-visible:outline-none focus-visible:border-ink"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {BACKGROUND_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer border ${
                  categoryFilter === cat.id
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface-2 text-muted border-border hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredPresets.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-border text-[13px] text-muted">
              No backgrounds match "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-0.5">
              {filteredPresets.map((preset) => {
                const isSelected = activePresetId === preset.id;
                const swatchStyle: React.CSSProperties =
                  preset.type === 'none' || preset.id === 'pure-white'
                    ? { backgroundColor: '#FFFFFF' }
                    : preset.type === 'pattern'
                      ? {
                          backgroundColor: '#F8FAFC',
                          backgroundImage: preset.value,
                          backgroundSize: preset.patternSize || '14px 14px',
                          color: 'rgba(15, 23, 42, 0.25)',
                        }
                      : preset.type === 'solid'
                        ? { backgroundColor: preset.value }
                        : { background: preset.value };

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`group relative p-2.5 rounded-xl border text-left transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-ink bg-surface shadow-xs ring-1 ring-ink'
                        : 'border-border hover:border-ink/35 bg-surface'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded-lg shrink-0 border border-black/15 overflow-hidden flex items-center justify-center relative"
                      style={swatchStyle}
                    >
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-black/65 flex items-center justify-center">
                          <Check size={12} className="text-white" strokeWidth={2.75} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold text-ink truncate">
                          {preset.name}
                        </span>
                        {preset.isPro && !isPro && (
                          <ProBadge className="scale-75 origin-right shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted truncate mt-0.5">
                        {preset.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Solid Color Section */}
      {activeSection === 'solid' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl bg-surface-2 border border-border">
            <label className="flex items-center gap-2.5 cursor-pointer shrink-0">
              <input
                type="color"
                value={currentSolidHex}
                onChange={(e) => handleSolidColorPick(e.target.value)}
                aria-label="Pick solid background color"
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              />
              <span className="text-[13px] font-medium text-ink">Color Picker</span>
            </label>

            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-mono text-muted">HEX</span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setHexInput(val);
                  const norm = normalizeHexColor(val);
                  if (norm) {
                    applyDraftUpdate({
                      ...draft,
                      type: 'solid',
                      value: norm,
                      presetId: norm === '#FFFFFF' ? 'pure-white' : undefined,
                      gradientStops: undefined,
                    });
                  }
                }}
                placeholder="#FFFFFF"
                className="w-full h-9 px-2.5 bg-surface border border-border rounded-lg font-mono text-[13px] text-ink uppercase"
              />
            </div>
          </div>

          {/* RGB Numeric Controls */}
          <div className="grid grid-cols-3 gap-2.5">
            {(['R', 'G', 'B'] as const).map((label, idx) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-muted">{label} (0–255)</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={currentRgb[idx]}
                  onChange={(e) => handleRgbChange(idx as 0 | 1 | 2, e.target.value)}
                  className="h-9 px-2.5 bg-surface border border-border rounded-lg font-mono text-[13px] text-ink"
                />
              </div>
            ))}
          </div>

          {/* Curated Solid Palette */}
          <div>
            <p className="text-[12px] font-medium text-muted mb-2">Studio Swatches</p>
            <div className="flex flex-wrap gap-2">
              {SOLID_PALETTE.map((hex) => {
                const selected = draft.type === 'solid' && currentSolidHex === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handleSolidColorPick(hex)}
                    aria-label={`Select color ${hex}`}
                    title={hex}
                    className={`w-8 h-8 rounded-lg border transition-transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                      selected ? 'ring-2 ring-ink ring-offset-1 border-ink' : 'border-black/15'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {selected && (
                      <Check
                        size={14}
                        className={isLightHexColor(hex) ? 'text-ink' : 'text-white'}
                        strokeWidth={2.75}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Colors */}
          {draft.recentColors && draft.recentColors.length > 0 && (
            <div>
              <p className="text-[12px] font-medium text-muted mb-2">Recent Colors</p>
              <div className="flex flex-wrap gap-2">
                {draft.recentColors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handleSolidColorPick(hex)}
                    aria-label={`Select recent color ${hex}`}
                    title={hex}
                    className="w-7 h-7 rounded-md border border-black/15 cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Custom Gradient Section */}
      {activeSection === 'gradient' && (
        <div className="flex flex-col gap-4">
          {/* Quick Gradient Chips */}
          <div>
            <p className="text-[12px] font-medium text-muted mb-2">Quick Gradients</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CURATED_GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => updateGradient(g.stops, g.direction, g.angle)}
                  className="p-2 rounded-lg border border-border bg-surface hover:border-ink/40 flex items-center gap-2 text-left cursor-pointer"
                >
                  <span
                    className="w-6 h-6 rounded-md border border-black/10 shrink-0"
                    style={{ background: buildGradientCss(g.stops, g.direction, g.angle) }}
                  />
                  <span className="text-[12px] font-medium text-ink truncate">{g.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Stops */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">Color Stops</span>
              {gradientStops.length < 3 ? (
                <button
                  type="button"
                  onClick={() => updateGradient([...gradientStops, COLOR_SWATCHES[4]])}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-ink hover:underline cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add 3rd stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateGradient(gradientStops.slice(0, 2))}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Remove 3rd stop</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {gradientStops.map((stop, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border cursor-pointer"
                >
                  <input
                    type="color"
                    value={normalizeHexColor(stop) || '#FFFFFF'}
                    onChange={(e) => {
                      const next = [...gradientStops];
                      next[idx] = e.target.value.toUpperCase();
                      updateGradient(next);
                    }}
                    className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] text-muted">Stop {idx + 1}</span>
                    <span className="block font-mono text-[12px] text-ink truncate">
                      {stop.toUpperCase()}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {/* Direction & Angle */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <span className="text-[12px] font-medium text-ink">Direction</span>
              <div className="flex flex-wrap gap-1.5">
                {GRADIENT_DIRECTIONS.map((dir) => (
                  <button
                    key={dir.value}
                    type="button"
                    onClick={() => {
                      const angleMap: Partial<Record<GradientDirection, number>> = {
                        'to bottom': 180,
                        'to top': 0,
                        'to right': 90,
                        'to bottom right': 135,
                        'to top right': 45,
                      };
                      updateGradient(
                        gradientStops,
                        dir.value,
                        angleMap[dir.value] ?? gradientAngle
                      );
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                      gradientDirection === dir.value
                        ? 'bg-ink text-surface border-ink'
                        : 'bg-surface text-muted border-border hover:text-ink'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>

              {gradientDirection !== 'radial' && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[12px] text-ink mb-1">
                    <span>Angle</span>
                    <span className="font-mono text-muted">{gradientAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={gradientAngle}
                    onChange={(e) =>
                      updateGradient(
                        gradientStops,
                        gradientDirection,
                        Number.parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full accent-ink cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Image Upload & Focal Point Section */}
      {activeSection === 'upload' && (
        <div className="flex flex-col gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCustomImageUpload}
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
          />

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 font-medium">
              {uploadError}
            </div>
          )}

          {draft.type === 'image' && draft.value ? (
            <div className="p-4 rounded-xl border border-border bg-surface-2 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-black/5 shrink-0">
                  <img
                    src={draft.value}
                    alt="Uploaded background"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink">Custom Background Image</p>
                  <p className="text-[12px] text-muted mt-0.5">
                    PNG, JPEG, WebP, or AVIF up to 5MB.
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[12px] font-medium text-ink underline cursor-pointer"
                    >
                      Replace image
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="text-[12px] font-medium text-red-600 underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {/* Fit Mode & Focal Position */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-ink">Image Fit</span>
                  <div className="inline-flex p-0.5 bg-surface border border-border rounded-lg self-start">
                    {(['cover', 'contain'] as BackgroundImageFit[]).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => applyDraftUpdate({ ...draft, imageFit: fit })}
                        className={`px-3 py-1 text-[12px] font-medium rounded-md capitalize cursor-pointer ${
                          (draft.imageFit || 'cover') === fit
                            ? 'bg-ink text-surface'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                    <span>Focus X</span>
                    <span className="font-mono text-muted">
                      {draft.imagePosition?.x ?? 50}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.imagePosition?.x ?? 50}
                    onChange={(e) =>
                      applyDraftUpdate({
                        ...draft,
                        imagePosition: {
                          x: Number.parseInt(e.target.value, 10),
                          y: draft.imagePosition?.y ?? 50,
                        },
                      })
                    }
                    className="w-full accent-ink cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                    <span>Focus Y</span>
                    <span className="font-mono text-muted">
                      {draft.imagePosition?.y ?? 50}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.imagePosition?.y ?? 50}
                    onChange={(e) =>
                      applyDraftUpdate({
                        ...draft,
                        imagePosition: {
                          x: draft.imagePosition?.x ?? 50,
                          y: Number.parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full accent-ink cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!isPro) {
                  openUpgrade('backgrounds');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-ink/40 bg-surface-2/60 hover:bg-surface-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer group w-full"
            >
              <div className="w-12 h-12 rounded-full bg-ink/5 group-hover:bg-ink/10 flex items-center justify-center text-ink transition-transform group-hover:scale-105 mb-2">
                <Upload size={20} />
              </div>
              <p className="text-[14px] font-semibold text-ink">
                {isUploading ? 'Uploading & optimizing...' : 'Upload background image'}
              </p>
              <p className="text-[12px] text-muted mt-1 max-w-sm">
                PNG, JPG, WebP, or AVIF up to 5MB. Rendered cleanly behind your links.
              </p>
              {!isPro && (
                <div className="mt-3">
                  <ProBadge />
                </div>
              )}
            </button>
          )}
        </div>
      )}

      {/* 5. Effects & Scrim Tint Section */}
      {activeSection === 'effects' && (
        <div className="p-4 rounded-xl bg-surface-2 border border-border flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12px] text-ink font-medium">
              <span>Overlay Scrim Color</span>
              <span className="font-mono text-muted">
                {draft.overlayColor || '#000000'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['#000000', '#FFFFFF', '#0F172A', '#1E1B4B', '#451A03'].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() =>
                    applyDraftUpdate({
                      ...draft,
                      overlayColor: hex,
                      overlayOpacity: draft.overlayOpacity ?? 0.25,
                    })
                  }
                  aria-label={`Select overlay ${hex}`}
                  className={`w-7 h-7 rounded-md border cursor-pointer ${
                    draft.overlayColor === hex ? 'ring-2 ring-ink border-ink' : 'border-black/20'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <input
                type="color"
                value={draft.overlayColor || '#000000'}
                onChange={(e) =>
                  applyDraftUpdate({
                    ...draft,
                    overlayColor: e.target.value.toUpperCase(),
                    overlayOpacity: draft.overlayOpacity ?? 0.25,
                  })
                }
                aria-label="Custom overlay tint color"
                className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                <span>Overlay opacity</span>
                <span className="font-mono text-muted">
                  {Math.round((draft.overlayOpacity ?? 0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={draft.overlayOpacity ?? 0}
                onChange={(e) =>
                  applyDraftUpdate({
                    ...draft,
                    overlayColor: draft.overlayColor || '#000000',
                    overlayOpacity: Number.parseFloat(e.target.value),
                  })
                }
                className="w-full accent-ink cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                <span>Backdrop blur</span>
                <span className="font-mono text-muted">{draft.blur ?? 0}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={draft.blur ?? 0}
                onChange={(e) =>
                  applyDraftUpdate({
                    ...draft,
                    blur: Number.parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-ink cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                <span>Brightness</span>
                <span className="font-mono text-muted">
                  {Math.round((draft.brightness ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={draft.brightness ?? 1}
                onChange={(e) =>
                  applyDraftUpdate({
                    ...draft,
                    brightness: Number.parseFloat(e.target.value),
                  })
                }
                className="w-full accent-ink cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                <span>Saturation</span>
                <span className="font-mono text-muted">
                  {Math.round((draft.saturation ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={draft.saturation ?? 1}
                onChange={(e) =>
                  applyDraftUpdate({
                    ...draft,
                    saturation: Number.parseFloat(e.target.value),
                  })
                }
                className="w-full accent-ink cursor-pointer"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>Blur and tint filters stay isolated to the background layer so links stay razor sharp.</span>
          </p>
        </div>
      )}

      {/* Inline Reset Confirmation */}
      {showResetConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="reset-bg-title"
          className="p-3.5 rounded-xl border border-border bg-surface-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="text-[13px]">
            <p id="reset-bg-title" className="font-semibold text-ink">
              Reset background to Pure White (#FFFFFF)?
            </p>
            <p className="text-[12px] text-muted">
              This removes any active gradient, preset, overlay, or custom image.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
              disabled={isSaving}
            >
              Keep current
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmResetPureWhite}
              disabled={isSaving}
            >
              {isSaving ? 'Resetting...' : 'Confirm reset'}
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Save / Cancel / Reset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSaveChanges}
            disabled={isSaving || isUploading}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleCancelDraft}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
        </div>

        {!isPureWhite && !showResetConfirm && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            disabled={isSaving}
            className="gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Reset to Pure White</span>
          </Button>
        )}
      </div>
    </div>
  );

  return embedded ? content : <Card>{content}</Card>;
};

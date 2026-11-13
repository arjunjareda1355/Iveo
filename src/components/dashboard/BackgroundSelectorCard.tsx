import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Check } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useToast } from '../ui/Toast';
import { compressImageFile } from '../../lib/imageCompressor';
import { BackgroundConfig } from '../../data/types';
import {
  BACKGROUND_PRESETS,
  BackgroundCategory,
  BackgroundPreset,
} from '../../lib/backgrounds';

interface BackgroundSelectorCardProps {
  currentBackground?: BackgroundConfig | null;
  isPro: boolean;
  onBackgroundChange: (bg: BackgroundConfig | null) => Promise<void> | void;
  embedded?: boolean;
}

const CATEGORIES: readonly { id: BackgroundCategory; label: string }[] = [
  { id: 'all', label: 'All Backdrops' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'studio', label: 'Studio' },
  { id: 'texture', label: 'Textures' },
];

export const BackgroundSelectorCard: React.FC<BackgroundSelectorCardProps> = ({
  currentBackground,
  isPro,
  onBackgroundChange,
  embedded = false,
}) => {
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [categoryFilter, setCategoryFilter] = useState<BackgroundCategory>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [blur, setBlur] = useState<number>(currentBackground?.blur ?? 0);
  const [opacity, setOpacity] = useState<number>(currentBackground?.opacity ?? 0.9);

  useEffect(() => {
    setBlur(currentBackground?.blur ?? 0);
    setOpacity(currentBackground?.opacity ?? 0.9);
  }, [currentBackground?.blur, currentBackground?.opacity]);

  const activePresetId =
    currentBackground?.presetId ||
    (currentBackground?.type === 'image'
      ? 'custom'
      : currentBackground?.type === 'none' || !currentBackground
        ? 'none'
        : 'custom');

  const filteredPresets =
    categoryFilter === 'all'
      ? BACKGROUND_PRESETS
      : BACKGROUND_PRESETS.filter((p) => p.category === categoryFilter || p.id === 'none');

  const handleSelectPreset = async (preset: BackgroundPreset) => {
    if (preset.isPro && !isPro) {
      openUpgrade('backgrounds');
      return;
    }

    if (preset.type === 'none') {
      await onBackgroundChange({ type: 'none', presetId: 'none' });
      showToast('Default theme background restored');
      return;
    }

    await onBackgroundChange({
      type: preset.type,
      value: preset.value,
      presetId: preset.id,
    });
    showToast(`${preset.name} applied`);
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro) {
      openUpgrade('backgrounds');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select a PNG, JPG, or WebP image');
      return;
    }

    setIsUploading(true);
    try {
      const { dataUrl } = await compressImageFile(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        cropSquare: false,
      });

      await onBackgroundChange({
        type: 'image',
        value: dataUrl,
        presetId: 'custom-image',
        blur,
        opacity,
      });
      showToast('Custom background image applied');
    } catch {
      showToast('Failed to process image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBlurChange = async (newBlur: number) => {
    setBlur(newBlur);
    if (currentBackground?.type === 'image') {
      await onBackgroundChange({
        ...currentBackground,
        blur: newBlur,
      });
    }
  };

  const handleOpacityChange = async (newOpacity: number) => {
    setOpacity(newOpacity);
    if (currentBackground?.type === 'image') {
      await onBackgroundChange({
        ...currentBackground,
        opacity: newOpacity,
      });
    }
  };

  const handleRemoveBackground = async () => {
    await onBackgroundChange({ type: 'none', presetId: 'none' });
    showToast('Background removed');
  };

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[20px] font-semibold text-ink leading-tight">
              Page Background
            </h3>
            <p className="mt-1 text-[14px] text-muted">
              Curated atmosphere, studio washes, architectural textures, or custom photos.
            </p>
          </div>

          {currentBackground && currentBackground.type !== 'none' && (
            <button
              type="button"
              onClick={handleRemoveBackground}
              className="text-[12px] text-muted hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      )}

      {/* Tabs: Curated Backdrops vs Custom Photo */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[13px]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`pb-1 px-1 font-medium transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'text-ink border-b-2 border-ink -mb-2.5 font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            Curated Studio Backdrops
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-1 px-1 font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'custom'
                ? 'text-ink border-b-2 border-ink -mb-2.5 font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <span>Custom Photo</span>
            {!isPro && <ProBadge className="scale-75 origin-left" />}
          </button>
        </div>

        {embedded && currentBackground && currentBackground.type !== 'none' && (
          <button
            type="button"
            onClick={handleRemoveBackground}
            className="text-[12px] text-muted hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Tab 1: Curated Presets */}
      {activeTab === 'presets' && (
        <div className="flex flex-col gap-3.5">
          {/* Category Filter Bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer border ${
                  categoryFilter === cat.id
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface-2 text-muted border-border hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredPresets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              const swatchStyle: React.CSSProperties =
                preset.type === 'none'
                  ? { backgroundColor: '#F3F4F6' }
                  : preset.type === 'pattern'
                    ? {
                        backgroundColor: '#F8FAFC',
                        backgroundImage: preset.value,
                        backgroundSize: preset.patternSize || '14px 14px',
                        color: 'rgba(15, 23, 42, 0.25)',
                      }
                    : {
                        background: preset.value,
                      };

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
                    className="w-11 h-11 rounded-lg shrink-0 border border-black/10 overflow-hidden flex items-center justify-center relative"
                    style={swatchStyle}
                  >
                    {preset.type === 'none' && (
                      <span className="text-[10px] font-mono text-stone-500 uppercase">Auto</span>
                    )}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-black/55 flex items-center justify-center">
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
                    <p className="text-[11px] text-muted truncate mt-0.5">{preset.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Custom Image Upload & Sliders */}
      {activeTab === 'custom' && (
        <div className="flex flex-col gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCustomImageUpload}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />

          {currentBackground?.type === 'image' && currentBackground.value ? (
            <div className="p-4 rounded-xl border border-border bg-surface-2 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-black/5 shrink-0 relative">
                  <img
                    src={currentBackground.value}
                    alt="Custom backdrop"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink">Custom Image Active</p>
                  <p className="text-[12px] text-muted mt-0.5">
                    Compressed for fast loading across all screens.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[12px] font-medium text-ink underline cursor-pointer"
                    >
                      Change image
                    </button>
                    <span className="text-muted text-[12px]">•</span>
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      className="text-[12px] font-medium text-red-600 underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                    <span>Backdrop Blur</span>
                    <span className="font-mono text-muted">{blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={blur}
                    onChange={(e) => handleBlurChange(parseInt(e.target.value, 10))}
                    className="w-full accent-ink cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1 text-ink font-medium">
                    <span>Backdrop Opacity</span>
                    <span className="font-mono text-muted">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                    className="w-full accent-ink cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                if (!isPro) {
                  openUpgrade('backgrounds');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-ink/40 bg-surface-2/60 hover:bg-surface-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-ink/5 group-hover:bg-ink/10 flex items-center justify-center text-ink transition-transform group-hover:scale-110 mb-2">
                <Upload size={20} />
              </div>
              <p className="text-[14px] font-semibold text-ink">
                {isUploading ? 'Compressing and applying...' : 'Upload custom background image'}
              </p>
              <p className="text-[12px] text-muted mt-1 max-w-sm">
                Supported formats: PNG, JPG, or WebP. Automatically optimized for sub-second loading.
              </p>
              {!isPro && (
                <div className="mt-3">
                  <ProBadge />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  return embedded ? (
    <div className="flex flex-col gap-4">{content}</div>
  ) : (
    <Card className="flex flex-col gap-4">{content}</Card>
  );
};

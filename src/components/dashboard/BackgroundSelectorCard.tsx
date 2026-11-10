import React, { useRef, useState } from 'react';
import {
  Upload,
  Sparkles,
  Sliders,
  Trash2,
  Grid,
  CircleDot,
  Check,
  ImageIcon,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useToast } from '../ui/Toast';
import { compressImageFile } from '../../lib/imageCompressor';
import { BackgroundConfig } from '../../data/types';

interface BackgroundSelectorCardProps {
  currentBackground?: BackgroundConfig | null;
  isPro: boolean;
  onBackgroundChange: (bg: BackgroundConfig | null) => Promise<void> | void;
}

interface PresetOption {
  id: string;
  name: string;
  type: 'none' | 'gradient' | 'mesh' | 'pattern';
  value?: string;
  previewCss: string;
  isPro?: boolean;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'none',
    name: 'Theme Default',
    type: 'none',
    previewCss: 'bg-stone-100 dark:bg-stone-800',
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    type: 'gradient',
    value: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)',
    previewCss: 'bg-gradient-to-br from-[#FF6B6B] via-[#FFE66D] to-[#4ECDC4]',
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    type: 'gradient',
    value: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
    previewCss: 'bg-gradient-to-br from-[#fbc2eb] to-[#a6c1ee]',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    type: 'mesh',
    value: 'radial-gradient(at 0% 0%, #7928CA 0px, transparent 50%), radial-gradient(at 100% 0%, #FF0080 0px, transparent 50%), radial-gradient(at 50% 100%, #00DFD8 0px, transparent 50%), #0A0A0A',
    previewCss: 'bg-gradient-to-tr from-[#7928CA] via-[#FF0080] to-[#00DFD8]',
    isPro: true,
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    type: 'mesh',
    value: 'linear-gradient(135deg, #09090b 0%, #2e0854 50%, #032b43 100%)',
    previewCss: 'bg-gradient-to-br from-[#09090b] via-[#2e0854] to-[#032b43]',
    isPro: true,
  },
  {
    id: 'cosmic',
    name: 'Cosmic Violet',
    type: 'mesh',
    value: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
    previewCss: 'bg-gradient-to-b from-[#1b2735] to-[#090a0f]',
    isPro: true,
  },
  {
    id: 'emerald',
    name: 'Deep Emerald',
    type: 'gradient',
    value: 'linear-gradient(160deg, #062b1a 0%, #0b4528 50%, #021a0e 100%)',
    previewCss: 'bg-gradient-to-br from-[#062b1a] via-[#0b4528] to-[#021a0e]',
    isPro: true,
  },
  {
    id: 'pattern-dots',
    name: 'Subtle Dots',
    type: 'pattern',
    value: 'radial-gradient(currentColor 1.2px, transparent 1.2px)',
    previewCss: 'bg-stone-200 bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:8px_8px]',
  },
  {
    id: 'pattern-grid',
    name: 'Studio Grid',
    type: 'pattern',
    value: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
    previewCss: 'bg-stone-200 bg-[linear-gradient(to_right,#888_1px,transparent_1px),linear-gradient(to_bottom,#888_1px,transparent_1px)] [background-size:12px_12px]',
    isPro: true,
  },
];

export const BackgroundSelectorCard: React.FC<BackgroundSelectorCardProps> = ({
  currentBackground,
  isPro,
  onBackgroundChange,
}) => {
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [isUploading, setIsUploading] = useState(false);
  const [blur, setBlur] = useState<number>(currentBackground?.blur ?? 0);
  const [opacity, setOpacity] = useState<number>(currentBackground?.opacity ?? 0.9);

  const activePresetId =
    currentBackground?.presetId ||
    (currentBackground?.type === 'image' ? 'custom' : currentBackground?.type === 'none' || !currentBackground ? 'none' : 'custom');

  const handleSelectPreset = async (preset: PresetOption) => {
    if (preset.isPro && !isPro) {
      openUpgrade('backgrounds');
      return;
    }

    if (preset.type === 'none') {
      await onBackgroundChange({ type: 'none', presetId: 'none' });
      showToast('Default background applied');
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
      // Compress background image quickly to max 1280x1280 with 80% quality
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

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight flex items-center gap-2">
            <span>Page Background</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-ink/5 text-muted">
              Personalize
            </span>
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            Customize the ambient backdrop for your public link-in-bio page.
          </p>
        </div>

        {currentBackground && currentBackground.type !== 'none' && (
          <button
            type="button"
            onClick={handleRemoveBackground}
            className="text-[12px] text-muted hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Reset to default</span>
          </button>
        )}
      </div>

      {/* Tabs: Presets vs Custom Image */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-[13px]">
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`pb-1 px-1 font-medium transition-colors cursor-pointer ${
            activeTab === 'presets'
              ? 'text-ink border-b-2 border-ink -mb-2.5 font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          Preset Gradients & Patterns
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

      {/* Tab 1: Presets Grid */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESET_OPTIONS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`group relative p-2.5 rounded-xl border text-left transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-ink bg-surface shadow-xs ring-1 ring-ink'
                    : 'border-border hover:border-ink/30 bg-surface'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg shrink-0 border border-black/10 overflow-hidden ${preset.previewCss} flex items-center justify-center`}
                >
                  {isSelected && <Check size={14} className="text-white drop-shadow-sm" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-medium text-ink truncate">
                      {preset.name}
                    </span>
                  </div>
                  {preset.isPro && !isPro && (
                    <div className="mt-0.5">
                      <ProBadge className="scale-75 origin-left" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
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
                    Fast compressed backdrop rendering on all visitor screens.
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

              {/* Sliders: Blur and Opacity */}
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
    </Card>
  );
};

import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  Layers,
  Maximize2,
  RotateCcw,
  Sparkles,
  UserSquare,
} from 'lucide-react';
import {
  AvatarShape,
  ButtonStyleEffect,
  DEFAULT_LAYOUT_SETTINGS,
  HeaderAlign,
  LayoutSettings,
  LinkSpacing,
  PageWidth,
} from '../../lib/preferences';
import { useToast } from '../ui/Toast';
import type { Vibe } from '../../lib/vibes';
import type { ButtonColors } from '../../lib/colors';
import { resolveEffectiveTokens } from '../../lib/colors';
import type { BackgroundConfig } from '../../data/types';

interface LayoutEffectsPanelProps {
  currentLayout?: LayoutSettings | null;
  activeVibe: Vibe;
  buttonColors?: ButtonColors | null;
  background?: BackgroundConfig | null;
  onLayoutChange: (next: LayoutSettings | null) => Promise<void> | void;
  onPreviewLayoutChange?: (next: LayoutSettings | null) => void;
}

const AVATAR_SHAPES: readonly { id: AvatarShape; label: string; desc: string }[] = [
  { id: 'circle', label: 'Circle', desc: 'Classic round' },
  { id: 'squircle', label: 'Squircle', desc: 'iOS curved' },
  { id: 'rounded', label: 'Rounded', desc: 'Soft frame' },
  { id: 'ring', label: 'Halo Ring', desc: 'Accent border' },
];

const HEADER_ALIGNS: readonly { id: HeaderAlign; label: string; desc: string }[] = [
  { id: 'center', label: 'Centered', desc: 'Balanced classic' },
  { id: 'left', label: 'Editorial Left', desc: 'Clean magazine' },
];

const BUTTON_STYLES: readonly {
  id: ButtonStyleEffect;
  label: string;
  desc: string;
}[] = [
  { id: 'solid', label: 'Solid Fill', desc: 'Crisp full color' },
  { id: 'soft', label: 'Soft Tint', desc: 'Subtle translucent tint' },
  { id: 'offset', label: '3D Offset', desc: 'Bold tactile shadow' },
  { id: 'glass', label: 'Frosted Glass', desc: 'Blur glassmorphism' },
  { id: 'gradient', label: 'Gradient Flow', desc: 'Rich dimensional glow' },
  { id: 'outline', label: 'Minimal Outline', desc: 'Hairline framed border' },
];

const LINK_SPACINGS: readonly { id: LinkSpacing; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'normal', label: 'Balanced' },
  { id: 'airy', label: 'Airy' },
];

const PAGE_WIDTHS: readonly { id: PageWidth; label: string }[] = [
  { id: 'compact', label: 'Focused' },
  { id: 'standard', label: 'Standard' },
  { id: 'wide', label: 'Wide' },
];

export const LayoutEffectsPanel: React.FC<LayoutEffectsPanelProps> = ({
  currentLayout,
  activeVibe,
  buttonColors,
  background,
  onLayoutChange,
  onPreviewLayoutChange,
}) => {
  const { showToast } = useToast();

  const resolved: Required<LayoutSettings> = {
    avatarShape: currentLayout?.avatarShape || DEFAULT_LAYOUT_SETTINGS.avatarShape,
    headerAlign: currentLayout?.headerAlign || DEFAULT_LAYOUT_SETTINGS.headerAlign,
    buttonStyle: currentLayout?.buttonStyle || DEFAULT_LAYOUT_SETTINGS.buttonStyle,
    linkSpacing: currentLayout?.linkSpacing || DEFAULT_LAYOUT_SETTINGS.linkSpacing,
    pageWidth: currentLayout?.pageWidth || DEFAULT_LAYOUT_SETTINGS.pageWidth,
    cardLook: currentLayout?.cardLook || DEFAULT_LAYOUT_SETTINGS.cardLook,
  };

  const hasOverrides =
    resolved.avatarShape !== 'circle' ||
    resolved.headerAlign !== 'center' ||
    resolved.buttonStyle !== 'solid' ||
    resolved.linkSpacing !== 'normal' ||
    resolved.pageWidth !== 'standard';

  const commit = async (patch: Partial<LayoutSettings>) => {
    const next: LayoutSettings = { ...resolved, ...patch };
    onPreviewLayoutChange?.(next);
    try {
      await onLayoutChange(next);
      showToast('Layout updated');
    } catch {
      showToast("Couldn't save layout");
    }
  };

  const handleReset = async () => {
    onPreviewLayoutChange?.(null);
    try {
      await onLayoutChange(null);
      showToast('Layout reset to defaults');
    } catch {
      showToast("Couldn't reset layout");
    }
  };

  const effectiveTokens = resolveEffectiveTokens(activeVibe.tokens, buttonColors, background);

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Profile &amp; Card Architecture</span>
        </span>
        {hasOverrides && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[12px] text-muted hover:text-ink flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset defaults</span>
          </button>
        )}
      </div>

      {/* 1. Avatar Frame */}
      <div className="p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UserSquare size={15} className="text-muted shrink-0" />
          <div>
            <h4 className="text-[14px] font-semibold text-ink">Avatar frame</h4>
            <p className="text-[12px] text-muted">Shape and border style for your profile photo</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AVATAR_SHAPES.map((opt) => {
            const active = resolved.avatarShape === opt.id;
            const previewRadius =
              opt.id === 'squircle'
                ? 'rounded-[14px]'
                : opt.id === 'rounded'
                  ? 'rounded-[8px]'
                  : 'rounded-full';
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => commit({ avatarShape: opt.id })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  active
                    ? 'border-ink bg-surface ring-1 ring-ink shadow-2xs'
                    : 'border-border bg-surface hover:border-ink/35'
                }`}
              >
                <div
                  className={`w-7 h-7 shrink-0 ${previewRadius}`}
                  style={{
                    backgroundColor: effectiveTokens.buttonBg,
                    boxShadow:
                      opt.id === 'ring' ? `0 0 0 2px ${effectiveTokens.bg}, 0 0 0 4px ${effectiveTokens.buttonBg}` : undefined,
                  }}
                />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-ink truncate">{opt.label}</div>
                  <div className="text-[10px] text-muted truncate">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Button Style & Surface Depth */}
      <div className="p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-muted shrink-0" />
          <div>
            <h4 className="text-[14px] font-semibold text-ink">Button surface &amp; effects</h4>
            <p className="text-[12px] text-muted">Visual finish applied to every link button on your page</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUTTON_STYLES.map((opt) => {
            const active = resolved.buttonStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => commit({ buttonStyle: opt.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                  active
                    ? 'border-ink bg-surface ring-1 ring-ink shadow-2xs'
                    : 'border-border bg-surface hover:border-ink/35'
                }`}
              >
                <div
                  className="w-full h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold"
                  style={{
                    background:
                      opt.id === 'outline'
                        ? 'transparent'
                        : opt.id === 'soft'
                          ? `${effectiveTokens.buttonBg}26`
                          : opt.id === 'glass'
                            ? 'rgba(255,255,255,0.22)'
                            : opt.id === 'gradient'
                              ? `linear-gradient(135deg, ${effectiveTokens.buttonBg}, #6366F1)`
                              : effectiveTokens.buttonBg,
                    color:
                      opt.id === 'outline' || opt.id === 'soft'
                        ? effectiveTokens.buttonBg === '#FFFFFF'
                          ? '#0A0A0A'
                          : effectiveTokens.buttonBg
                        : opt.id === 'glass'
                          ? '#0A0A0A'
                          : effectiveTokens.buttonText,
                    border:
                      opt.id === 'outline'
                        ? `1.5px solid ${effectiveTokens.buttonBg}`
                        : opt.id === 'glass'
                          ? '1px solid rgba(15,23,42,0.16)'
                          : opt.id === 'offset'
                            ? `1.5px solid #0A0A0A`
                            : 'none',
                    boxShadow:
                      opt.id === 'offset' ? '2px 2px 0px #0A0A0A' : undefined,
                  }}
                >
                  Button
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-ink">{opt.label}</div>
                  <div className="text-[10px] text-muted leading-tight">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Header Alignment + Spacing + Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-ink">Header alignment</span>
          <div className="grid grid-cols-2 gap-2">
            {HEADER_ALIGNS.map((opt) => {
              const active = resolved.headerAlign === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => commit({ headerAlign: opt.id })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    active
                      ? 'border-ink bg-surface ring-1 ring-ink'
                      : 'border-border bg-surface hover:border-ink/35'
                  }`}
                >
                  {opt.id === 'center' ? <AlignCenter size={15} /> : <AlignLeft size={15} />}
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-ink truncate">{opt.label}</div>
                    <div className="text-[10px] text-muted truncate">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-ink">Link spacing</span>
          <div className="grid grid-cols-3 gap-1.5">
            {LINK_SPACINGS.map((opt) => {
              const active = resolved.linkSpacing === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => commit({ linkSpacing: opt.id })}
                  className={`py-2 px-2 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                    active
                      ? 'border-ink bg-ink text-surface'
                      : 'border-border bg-surface text-ink hover:border-ink/35'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Page Content Width */}
      <div className="p-4 rounded-xl border border-border bg-surface-2/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
            <Maximize2 size={14} className="text-muted" />
            <span>Page column width</span>
          </span>
          <span className="text-[11px] font-mono text-muted capitalize">{resolved.pageWidth}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PAGE_WIDTHS.map((opt) => {
            const active = resolved.pageWidth === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => commit({ pageWidth: opt.id })}
                className={`py-2 px-3 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'border-ink bg-ink text-surface'
                    : 'border-border bg-surface text-ink hover:border-ink/35'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

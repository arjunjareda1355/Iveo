import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { BannerLookCard } from '../page/BannerLookCard';
import { computeBannerImagePresentation } from '../../lib/cardBanner';
import type { EmbedMetaData, EmbedProvider } from '../../data/types';

export interface BannerCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  sourceWidth?: number;
  initialFocalX: number;
  initialFocalY: number;
  initialZoom: number;
  dim: number;
  provider: EmbedProvider;
  providerName: string;
  brandColor: string;
  meta: EmbedMetaData;
  title: string;
  subtitle?: string | null;
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
  cardSurfaceHex: string;
  cardTextColor: string;
  cardMutedColor: string;
  cardBorderColor: string;
  platformGlyph: React.ReactNode;
  onCancel: () => void;
  onApply: (result: { focalX: number; focalY: number; zoom: number }) => Promise<void> | void;
}

export const BannerCropModal: React.FC<BannerCropModalProps> = ({
  isOpen,
  imageUrl,
  sourceWidth = 1584,
  initialFocalX,
  initialFocalY,
  initialZoom,
  dim,
  provider,
  providerName,
  brandColor,
  meta,
  title,
  subtitle,
  userAvatarUrl,
  userDisplayName,
  cardSurfaceHex,
  cardTextColor,
  cardMutedColor,
  cardBorderColor,
  platformGlyph,
  onCancel,
  onApply,
}) => {
  const [focalX, setFocalX] = useState(initialFocalX);
  const [focalY, setFocalY] = useState(initialFocalY);
  const [zoom, setZoom] = useState(initialZoom);
  const [isApplying, setIsApplying] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origFocalX: number;
    origFocalY: number;
    boxW: number;
    boxH: number;
  } | null>(null);
  const cropBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFocalX(initialFocalX);
    setFocalY(initialFocalY);
    setZoom(initialZoom);
  }, [isOpen, initialFocalX, initialFocalY, initialZoom]);

  if (!isOpen) return null;

  const isLowResWarning = sourceWidth / zoom < 720 || zoom >= 2.2;
  const presentation = computeBannerImagePresentation({ focalX, focalY, zoom });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = cropBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origFocalX: focalX,
      origFocalY: focalY,
      boxW: Math.max(1, rect.width),
      boxH: Math.max(1, rect.height),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st?.active) return;
    const dxPct = ((e.clientX - st.startX) / st.boxW) * 100;
    const dyPct = ((e.clientY - st.startY) / st.boxH) * 100;
    // Dragging image right moves focal point left
    setFocalX(Math.round(Math.max(0, Math.min(100, st.origFocalX - dxPct))));
    setFocalY(Math.round(Math.max(0, Math.min(100, st.origFocalY - dyPct))));
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleReset = () => {
    setFocalX(50);
    setFocalY(40);
    setZoom(1);
  };

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onApply({ focalX, focalY, zoom });
    } finally {
      setIsApplying(false);
    }
  };

  const previewMeta: EmbedMetaData = {
    ...meta,
    banner: {
      source: 'upload',
      imageUrl,
      focalX,
      focalY,
      zoom,
      dim,
    },
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isApplying) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crop and reposition banner"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-lg)] flex flex-col max-h-[90dvh] overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Crop and reposition</h3>
            <p className="text-[12px] text-muted">Drag the banner or adjust sliders (4:1 frame)</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            aria-label="Close crop dialog"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* 4:1 Crop Window with dimmed outer backdrop */}
          <div className="p-3 rounded-[14px] bg-black/80 flex items-center justify-center">
            <div
              ref={cropBoxRef}
              data-testid="banner-crop-window"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full aspect-[4/1] rounded-[10px] overflow-hidden relative cursor-grab active:cursor-grabbing ring-2 ring-white/85 select-none touch-none"
              style={{
                backgroundColor: '#111111',
                backgroundImage: `url("${imageUrl}")`,
                backgroundPosition: presentation.backgroundPosition,
                backgroundSize: presentation.backgroundSize,
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundColor: `rgba(10, 10, 10, ${dim / 100})` }}
              />
              <div
                className="absolute inset-0 pointer-events-none border border-white/30"
                style={{ borderRadius: '10px' }}
              />
            </div>
          </div>

          {isLowResWarning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-800 dark:text-amber-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Zoomed in closely — the banner may look soft on high-resolution screens.</span>
            </div>
          )}

          {/* Sliders */}
          <div className="flex flex-col gap-2.5">
            <label className="min-h-[44px] flex flex-col justify-center gap-1">
              <span className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Zoom</span>
                <span className="font-mono text-muted tabular-nums">{zoom.toFixed(2)}×</span>
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="w-full accent-ink cursor-pointer"
              />
            </label>

            <label className="min-h-[44px] flex flex-col justify-center gap-1">
              <span className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Horizontal</span>
                <span className="font-mono text-muted tabular-nums">{focalX}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={focalX}
                onChange={(e) => setFocalX(Number(e.target.value))}
                aria-label="Horizontal crop position"
                className="w-full accent-ink cursor-pointer"
              />
            </label>

            <label className="min-h-[44px] flex flex-col justify-center gap-1">
              <span className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Vertical</span>
                <span className="font-mono text-muted tabular-nums">{focalY}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={focalY}
                onChange={(e) => setFocalY(Number(e.target.value))}
                aria-label="Vertical crop position"
                className="w-full accent-ink cursor-pointer"
              />
            </label>
          </div>

          {/* Live mini card preview */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Card preview
            </span>
            <div className="max-w-[300px] w-full mx-auto">
              <BannerLookCard
                provider={provider}
                providerName={providerName}
                brandColor={brandColor}
                meta={previewMeta}
                title={title}
                subtitle={subtitle}
                summary={null}
                statsLabel={null}
                showPicture={meta.showAvatar !== false}
                showPlatformLabel={meta.showPlatformLabel !== false}
                isItemArtwork={false}
                isSpotify={provider === 'spotify'}
                userAvatarUrl={userAvatarUrl}
                userDisplayName={userDisplayName}
                cardContainerStyle={{
                  backgroundColor: cardSurfaceHex,
                  color: cardTextColor,
                  border: `1px solid ${cardBorderColor}`,
                }}
                resolvedSurfaceHex={cardSurfaceHex}
                textPrimary={cardTextColor}
                textMuted={cardMutedColor}
                rawChosenAccent={brandColor}
                scale={0.85}
                platformGlyph={platformGlyph}
                previewBannerImageOverride={imageUrl}
                ctaButton={
                  <span
                    className="inline-flex items-center justify-center px-3 h-7 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: brandColor, color: '#FFFFFF' }}
                  >
                    {meta.ctaLabel?.trim() || 'View profile'}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-divider flex items-center justify-between gap-2 bg-surface">
          <button
            type="button"
            onClick={handleReset}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-[10px] text-[13px] font-medium text-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isApplying}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleConfirm} disabled={isApplying}>
              {isApplying ? 'Applying...' : 'Use banner'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

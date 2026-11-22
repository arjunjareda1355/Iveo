import React, { useEffect, useState } from 'react';
import { BackgroundConfig } from '../../data/types';
import { computeBackgroundLayers } from '../../lib/backgrounds';
import type { Background, PatternOverlayType } from '../../lib/appearance/types';
import {
  buildSvgContourDataUri,
  buildSvgNoiseDataUri,
  findCatalogBackground,
} from '../../lib/appearance/catalog/backgrounds';

interface BackgroundLayerProps {
  background?: BackgroundConfig | null;
  backgroundV2?: Background | null;
  smartScrim?: { color: string; alpha: number } | null;
  fallbackBg?: string;
  mode?: 'fixed' | 'contained';
  className?: string;
}

function getPatternOverlayCss(kind: PatternOverlayType, color: string): {
  backgroundImage: string;
  backgroundSize: string;
} | null {
  switch (kind) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${color} 1.25px, transparent 1.25px)`,
        backgroundSize: '18px 18px',
      };
    case 'grid':
      return {
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        backgroundSize: '26px 26px',
      };
    case 'lines':
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 16px)`,
        backgroundSize: '24px 24px',
      };
    case 'contours':
      return {
        backgroundImage: buildSvgContourDataUri(color),
        backgroundSize: '320px 320px',
      };
    case 'none':
    default:
      return null;
  }
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  background,
  backgroundV2,
  smartScrim,
  fallbackBg = '#FFFFFF',
  mode = 'contained',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const imageUrlV2 = backgroundV2?.type === 'image' ? backgroundV2.assetId : null;
  const legacyLayers = computeBackgroundLayers(background, fallbackBg);

  useEffect(() => {
    setImgFailed(false);
  }, [legacyLayers.imageUrl, imageUrlV2]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setIsHidden(document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const posClass = mode === 'fixed' ? 'fixed' : 'absolute';

  // v2 Background Pipeline
  if (backgroundV2) {
    if (backgroundV2.type === 'solid') {
      return (
        <div
          className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
          style={{ backgroundColor: backgroundV2.color }}
          aria-hidden="true"
        />
      );
    }

    if (backgroundV2.type === 'legacy') {
      const css = backgroundV2.css || fallbackBg;
      const isColorOnly = css.startsWith('#') || css.startsWith('rgb');
      return (
        <div
          className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
          style={{
            backgroundColor: backgroundV2.baseHex || (isColorOnly ? css : fallbackBg),
            ...(!isColorOnly ? { background: css } : {}),
          }}
          aria-hidden="true"
        />
      );
    }

    if (backgroundV2.type === 'gradient') {
      const stops = backgroundV2.stops.map((s) => `${s.color} ${s.at}%`).join(', ');
      const gradCss =
        backgroundV2.kind === 'radial'
          ? `radial-gradient(circle at 50% 45%, ${stops})`
          : backgroundV2.kind === 'conic'
            ? `conic-gradient(from ${backgroundV2.angle}deg at 50% 50%, ${stops})`
            : `linear-gradient(${backgroundV2.angle}deg, ${stops})`;

      return (
        <div
          className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
          style={{
            backgroundColor: backgroundV2.stops[0]?.color || fallbackBg,
            backgroundImage: gradCss,
          }}
          aria-hidden="true"
        />
      );
    }

    if (backgroundV2.type === 'image') {
      const placeholderBg = backgroundV2.dominantColors?.[0] || fallbackBg;
      const filterParts: string[] = [];
      if (backgroundV2.blur > 0) filterParts.push(`blur(${backgroundV2.blur}px)`);
      if (backgroundV2.brightness !== 100) filterParts.push(`brightness(${backgroundV2.brightness}%)`);
      const filterCss = filterParts.length > 0 ? filterParts.join(' ') : undefined;

      return (
        <div
          className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
          style={{ backgroundColor: placeholderBg }}
          aria-hidden="true"
        >
          {!imgFailed && (
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                opacity: Math.max(0.3, Math.min(1, backgroundV2.opacity / 100)),
                filter: filterCss,
                transform: backgroundV2.blur > 0 ? 'scale(1.08)' : undefined,
              }}
            >
              <img
                src={backgroundV2.assetId}
                alt=""
                loading="eager"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover block"
                style={{
                  objectPosition: `${backgroundV2.focal?.x ?? 50}% ${backgroundV2.focal?.y ?? 50}%`,
                }}
              />
            </div>
          )}

          {backgroundV2.overlay && backgroundV2.overlay.alpha > 0 && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: backgroundV2.overlay.color,
                opacity: backgroundV2.overlay.alpha,
              }}
            />
          )}

          {smartScrim && smartScrim.alpha > 0 && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${smartScrim.color}00 0%, ${smartScrim.color} 100%)`,
                opacity: smartScrim.alpha,
              }}
            />
          )}
        </div>
      );
    }

    // type === 'preset'
    const preset = findCatalogBackground(backgroundV2.id);
    const baseHex = preset?.baseHex || fallbackBg;
    const toneDelta = backgroundV2.tone ?? 0;
    const toneFilter = toneDelta !== 0 ? `brightness(${100 + toneDelta}%)` : '';
    const blurTotal = (preset?.blurPx ?? 0) + (backgroundV2.blur ?? 0);
    const filterCss = [blurTotal > 0 ? `blur(${blurTotal}px)` : '', toneFilter]
      .filter(Boolean)
      .join(' ');

    const isAnimated = Boolean(backgroundV2.animate ?? preset?.isAnimated);
    const animKind = preset?.animationKind || 'drift';
    const grainOpacity =
      backgroundV2.grain !== undefined
        ? Math.max(0, Math.min(0.4, backgroundV2.grain / 100))
        : (preset?.grainOpacity ?? 0);
    const vignetteOpacity =
      backgroundV2.vignette !== undefined
        ? Math.max(0, Math.min(0.5, backgroundV2.vignette / 100))
        : (preset?.vignetteOpacity ?? 0);

    const activePatternKind: PatternOverlayType =
      backgroundV2.pattern?.kind && backgroundV2.pattern.kind !== 'none'
        ? backgroundV2.pattern.kind
        : (preset?.patternKind || 'none');

    const isDarkPreset = preset?.tone === 'dark';
    const patternAlpha =
      backgroundV2.pattern?.opacity !== undefined
        ? Math.max(0, Math.min(0.3, backgroundV2.pattern.opacity / 100))
        : 0.14;
    const patternColor =
      preset?.patternColor ||
      (isDarkPreset ? `rgba(255,255,255,${patternAlpha})` : `rgba(15,23,42,${patternAlpha})`);
    const patternCss = activePatternKind !== 'none' ? getPatternOverlayCss(activePatternKind, patternColor) : null;

    return (
      <div
        className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
        style={{ backgroundColor: baseHex }}
        aria-hidden="true"
      >
        {/* Preset Gradient / Mesh / Aurora Surface */}
        <div
          className={`absolute inset-0 ${isAnimated ? `iveo-bg-animated ${isHidden ? 'iveo-bg-paused' : ''}` : ''}`}
          data-anim={isAnimated ? animKind : undefined}
          style={{
            background: preset?.cssBackground || baseHex,
            filter: filterCss || undefined,
            transform: blurTotal > 0 ? 'scale(1.06)' : undefined,
          }}
        />

        {/* Glass / frosted veil */}
        {preset?.veilColor && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: preset.veilColor,
              ...(preset.backdropBlurPx ? { backdropFilter: `blur(${preset.backdropBlurPx}px)`, WebkitBackdropFilter: `blur(${preset.backdropBlurPx}px)` } : {}),
            }}
          />
        )}

        {/* Pattern overlay */}
        {patternCss && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: patternCss.backgroundImage,
              backgroundSize: preset?.patternSizePx
                ? `${preset.patternSizePx}px ${preset.patternSizePx}px`
                : patternCss.backgroundSize,
            }}
          />
        )}

        {/* SVG feTurbulence Grain Overlay */}
        {grainOpacity > 0 && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: buildSvgNoiseDataUri(preset?.grainFreq ?? 0.85, preset?.grainOctaves ?? 2),
              backgroundRepeat: 'repeat',
              backgroundSize: '240px 240px',
              opacity: grainOpacity,
              mixBlendMode: preset?.grainBlend || (isDarkPreset ? 'screen' : 'multiply'),
            }}
          />
        )}

        {/* Vignette Overlay */}
        {vignetteOpacity > 0 && (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
            }}
          />
        )}
      </div>
    );
  }

  // Legacy v1 Fallback Pipeline (used on Marketing / Onboarding / Embeds)
  const hasBlur = Boolean(legacyLayers.config.blur && legacyLayers.config.blur > 0);
  const effectiveBaseColor = imgFailed ? '#FFFFFF' : legacyLayers.baseColor;

  return (
    <div
      className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
      style={{ backgroundColor: effectiveBaseColor }}
      aria-hidden="true"
    >
      {!legacyLayers.imageUrl && legacyLayers.backgroundImage && !legacyLayers.isPattern && (
        <div
          className="absolute inset-0"
          style={{
            background: legacyLayers.backgroundImage,
            backgroundPosition: legacyLayers.backgroundPosition,
            filter: legacyLayers.filterCss,
            transform: hasBlur ? 'scale(1.06)' : undefined,
          }}
        />
      )}

      {legacyLayers.isPattern && legacyLayers.backgroundImage && (
        <div
          className="absolute inset-0"
          style={{
            opacity: legacyLayers.patternOpacity,
            backgroundImage: legacyLayers.backgroundImage,
            backgroundSize: legacyLayers.backgroundSize || '18px 18px',
            filter: legacyLayers.filterCss,
            color: legacyLayers.isDark ? '#FFFFFF' : '#0F172A',
          }}
        />
      )}

      {legacyLayers.imageUrl && !imgFailed && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: legacyLayers.config.opacity ?? 1,
            filter: legacyLayers.filterCss,
            transform: hasBlur ? 'scale(1.08)' : undefined,
          }}
        >
          <img
            src={legacyLayers.imageUrl}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full block"
            style={{
              objectFit: legacyLayers.imageFit,
              objectPosition: legacyLayers.imagePosition,
            }}
          />
        </div>
      )}

      {!imgFailed && legacyLayers.overlayOpacity > 0 && legacyLayers.overlayColor && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: legacyLayers.overlayColor,
            opacity: legacyLayers.overlayOpacity,
          }}
        />
      )}
    </div>
  );
};

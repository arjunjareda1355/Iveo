import React, { useEffect, useState } from 'react';
import { BackgroundConfig } from '../../data/types';
import { computeBackgroundLayers } from '../../lib/backgrounds';

interface BackgroundLayerProps {
  background?: BackgroundConfig | null;
  fallbackBg?: string;
  mode?: 'fixed' | 'contained';
  className?: string;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  background,
  fallbackBg = '#FFFFFF',
  mode = 'contained',
  className = '',
}) => {
  const layers = computeBackgroundLayers(background, fallbackBg);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [layers.imageUrl]);

  const posClass = mode === 'fixed' ? 'fixed' : 'absolute';
  const hasBlur = Boolean(layers.config.blur && layers.config.blur > 0);
  const effectiveBaseColor = imgFailed ? '#FFFFFF' : layers.baseColor;

  return (
    <div
      className={`${posClass} inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
      style={{ backgroundColor: effectiveBaseColor }}
      aria-hidden="true"
    >
      {/* Gradient or Mesh Backdrop */}
      {!layers.imageUrl && layers.backgroundImage && !layers.isPattern && (
        <div
          className="absolute inset-0"
          style={{
            background: layers.backgroundImage,
            backgroundPosition: layers.backgroundPosition,
            filter: layers.filterCss,
            transform: hasBlur ? 'scale(1.06)' : undefined,
          }}
        />
      )}

      {/* Pattern Texture Layer */}
      {layers.isPattern && layers.backgroundImage && (
        <div
          className="absolute inset-0"
          style={{
            opacity: layers.patternOpacity,
            backgroundImage: layers.backgroundImage,
            backgroundSize: layers.backgroundSize || '18px 18px',
            filter: layers.filterCss,
            color: layers.isDark ? '#FFFFFF' : '#0F172A',
          }}
        />
      )}

      {/* Custom Uploaded Image Layer */}
      {layers.imageUrl && !imgFailed && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: layers.config.opacity ?? 1,
            filter: layers.filterCss,
            transform: hasBlur ? 'scale(1.08)' : undefined,
          }}
        >
          <img
            src={layers.imageUrl}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full block"
            style={{
              objectFit: layers.imageFit,
              objectPosition: layers.imagePosition,
            }}
          />
        </div>
      )}

      {/* Dedicated Overlay Tint Scrim */}
      {!imgFailed && layers.overlayOpacity > 0 && layers.overlayColor && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: layers.overlayColor,
            opacity: layers.overlayOpacity,
          }}
        />
      )}
    </div>
  );
};

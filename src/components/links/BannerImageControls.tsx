import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import {
  BANNER_COLOR_SWATCHES,
  DEFAULT_CARD_BANNER_CONFIG,
  normalizeBannerHexColor,
  normalizeCardBannerConfig,
} from '../../lib/cardBanner';
import {
  formatFileSizeLabel,
  renderCroppedBannerWebp,
  uploadBannerToServerWithProgress,
  validateBannerImageFile,
} from '../../lib/bannerClientImage';
import type { BannerSource, CardBannerConfig, EmbedMetaData, EmbedProvider } from '../../data/types';
import { BannerCropModal } from './BannerCropModal';

export interface UploadedBannerMetaInfo {
  fileName: string;
  width: number;
  height: number;
  originalWidth: number;
  sizeBytes: number;
  localSourceUrl?: string | null;
}

export interface BannerImageControlsProps {
  banner: CardBannerConfig | null | undefined;
  onChangeBanner: (next: CardBannerConfig) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onTrackUncommittedUrl?: (url: string, smallUrl?: string | null) => void;
  onDeleteServerUrls?: (urls: string[]) => void;
  username?: string | null;
  userId?: string | null;
  primaryEmail?: string | null;
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
}

export const BannerImageControls: React.FC<BannerImageControlsProps> = ({
  banner,
  onChangeBanner,
  onUploadingChange,
  onTrackUncommittedUrl,
  onDeleteServerUrls,
  username,
  userId,
  primaryEmail,
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
}) => {
  const cfg = normalizeCardBannerConfig(banner);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localSourceUrlRef = useRef<string | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<UploadedBannerMetaInfo | null>(null);
  const [hexDraft, setHexDraft] = useState<string>(cfg.color || BANNER_COLOR_SWATCHES[0]);
  const [isCropOpen, setIsCropOpen] = useState(false);

  useEffect(() => {
    if (cfg.color) {
      setHexDraft(cfg.color);
    }
  }, [cfg.color]);

  useEffect(() => {
    return () => {
      if (localSourceUrlRef.current) {
        URL.revokeObjectURL(localSourceUrlRef.current);
        localSourceUrlRef.current = null;
      }
    };
  }, []);

  const setUploadingState = (val: boolean) => {
    setIsUploading(val);
    onUploadingChange?.(val);
  };

  const commitBannerUpload = async (params: {
    sourceUrl: string;
    fileName: string;
    originalWidth: number;
    focalX: number;
    focalY: number;
    zoom: number;
    nextFocalX: number;
    nextFocalY: number;
    nextZoom: number;
  }) => {
    setUploadingState(true);
    setUploadError(null);
    setUploadProgress(15);

    try {
      const rendered = await renderCroppedBannerWebp({
        sourceUrl: params.sourceUrl,
        focalX: params.focalX,
        focalY: params.focalY,
        zoom: params.zoom,
      });
      setUploadProgress(45);

      const prevUrl = cfg.imageUrl;
      const prevSmall = cfg.smallImageUrl;

      let finalUrl = rendered.dataUrl;
      let finalSmallUrl: string | null = rendered.smallDataUrl;

      if (userId && username) {
        const uploaded = await uploadBannerToServerWithProgress({
          dataUrl: rendered.dataUrl,
          smallDataUrl: rendered.smallDataUrl,
          username,
          userId,
          primaryEmail,
          replaceUrl: prevUrl?.startsWith('/api/cards/banner/') ? prevUrl : null,
          replaceSmallUrl: prevSmall?.startsWith('/api/cards/banner/') ? prevSmall : null,
          onProgress: (pct) => setUploadProgress(Math.max(45, pct)),
        });
        finalUrl = uploaded.url;
        finalSmallUrl = uploaded.smallUrl;
        onTrackUncommittedUrl?.(finalUrl, finalSmallUrl);
      } else {
        setUploadProgress(100);
      }

      setFileInfo({
        fileName: params.fileName,
        width: rendered.width,
        height: rendered.height,
        originalWidth: params.originalWidth,
        sizeBytes: rendered.sizeBytes,
        localSourceUrl: params.sourceUrl,
      });

      onChangeBanner({
        ...cfg,
        source: 'upload',
        imageUrl: finalUrl,
        smallImageUrl: finalSmallUrl,
        focalX: params.nextFocalX,
        focalY: params.nextFocalY,
        zoom: params.nextZoom,
      });
    } catch (err: any) {
      setUploadError(err?.message || "Couldn't upload that image. Try again.");
    } finally {
      setUploadingState(false);
    }
  };

  const handleSelectedFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadError(null);

    const check = await validateBannerImageFile(file);
    if (!check.ok) {
      setUploadError(check.message);
      return;
    }

    if (localSourceUrlRef.current) {
      URL.revokeObjectURL(localSourceUrlRef.current);
    }
    localSourceUrlRef.current = check.decoded.sourceUrl;

    await commitBannerUpload({
      sourceUrl: check.decoded.sourceUrl,
      fileName: check.decoded.fileName,
      originalWidth: check.decoded.width,
      focalX: 50,
      focalY: 40,
      zoom: 1,
      nextFocalX: 50,
      nextFocalY: 40,
      nextZoom: 1,
    });
  };

  const handleRemoveUpload = () => {
    const toDelete = [cfg.imageUrl, cfg.smallImageUrl].filter(
      (u): u is string => Boolean(u && u.startsWith('/api/cards/banner/'))
    );
    if (toDelete.length > 0) {
      onDeleteServerUrls?.(toDelete);
    }
    if (localSourceUrlRef.current) {
      URL.revokeObjectURL(localSourceUrlRef.current);
      localSourceUrlRef.current = null;
    }
    setFileInfo(null);
    setUploadError(null);
    onChangeBanner({
      ...cfg,
      source: 'upload',
      imageUrl: null,
      smallImageUrl: null,
      focalX: DEFAULT_CARD_BANNER_CONFIG.focalX,
      focalY: DEFAULT_CARD_BANNER_CONFIG.focalY,
      zoom: DEFAULT_CARD_BANNER_CONFIG.zoom,
    });
  };

  const handleSourceSwitch = (nextSource: BannerSource) => {
    setUploadError(null);
    onChangeBanner({
      ...cfg,
      source: nextSource,
      ...(nextSource === 'color' && !cfg.color ? { color: BANNER_COLOR_SWATCHES[0] } : {}),
    });
  };

  const handleHexInputChange = (rawVal: string) => {
    setHexDraft(rawVal);
    const cleaned = rawVal.trim().startsWith('#') ? rawVal.trim() : `#${rawVal.trim()}`;
    const valid = normalizeBannerHexColor(cleaned);
    if (valid) {
      onChangeBanner({ ...cfg, source: 'color', color: valid });
    }
  };

  const cropSourceUrl = fileInfo?.localSourceUrl || cfg.imageUrl || '';

  return (
    <section
      data-testid="banner-image-options"
      className="flex flex-col gap-3 pt-4 border-t border-divider"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-ink">Banner image</h3>
      </div>

      {/* 3-way switch: Auto | Upload | Colour (44px tall) */}
      <div
        role="radiogroup"
        aria-label="Banner image source"
        className="grid grid-cols-3 gap-1 p-1 rounded-[12px] bg-surface-2 border border-border min-h-[44px]"
      >
        {(
          [
            { id: 'auto', label: 'Auto' },
            { id: 'upload', label: 'Upload' },
            { id: 'color', label: 'Colour' },
          ] as Array<{ id: BannerSource; label: string }>
        ).map((opt) => {
          const active = cfg.source === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSourceSwitch(opt.id)}
              className={`min-h-[36px] rounded-[9px] text-[13px] font-semibold cursor-pointer transition-colors ${
                active
                  ? 'bg-surface text-ink shadow-2xs border border-border/60'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* AUTO MODE */}
      {cfg.source === 'auto' && (
        <p className="text-[12px] text-muted leading-snug">
          Uses the banner fetched with your profile. A brand colour gradient is shown if none is found.
        </p>
      )}

      {/* UPLOAD MODE */}
      {cfg.source === 'upload' && (
        <div className="flex flex-col gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void handleSelectedFile(f);
            }}
          />

          {isUploading ? (
            <div className="rounded-[12px] border border-border bg-surface-2 p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px] font-medium text-ink">
                <span>Uploading banner image...</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                className="w-full h-2 rounded-full bg-border overflow-hidden"
              >
                <div
                  className="h-full bg-ink transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : cfg.imageUrl ? (
            <div className="rounded-[12px] border border-border bg-surface p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div
                  className="w-24 h-6 rounded-[6px] border border-border shrink-0 overflow-hidden bg-surface-2"
                  style={{
                    backgroundImage: `url("${cfg.smallImageUrl || cfg.imageUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: `${cfg.focalX}% ${cfg.focalY}%`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink truncate">
                    {fileInfo?.fileName || 'Custom banner image'}
                  </div>
                  <div className="text-[11px] text-muted">
                    {fileInfo
                      ? `${fileInfo.width} × ${fileInfo.height} · ${formatFileSizeLabel(fileInfo.sizeBytes)}`
                      : '4:1 WebP banner'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsCropOpen(true)}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-[9px] border border-border text-[12px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
                >
                  <Crop size={13} />
                  <span>Crop and reposition</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-[9px] border border-border text-[12px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveUpload}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-[9px] text-[12px] font-medium text-red-600 hover:bg-red-500/10 cursor-pointer ml-auto"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                void handleSelectedFile(e.dataTransfer.files?.[0]);
              }}
              className={`w-full rounded-[12px] border-2 border-dashed p-4 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-ink bg-surface-2'
                  : 'border-border hover:border-ink/60 bg-surface'
              }`}
            >
              <ImagePlus size={18} className="text-muted" />
              <span className="text-[13px] font-semibold text-ink">Upload banner image</span>
              <span className="text-[11.5px] text-muted">
                JPG, PNG or WebP · Up to 5 MB · Best 1584 × 396 (min 800 × 200)
              </span>
            </button>
          )}

          {uploadError && (
            <p
              role="status"
              aria-live="polite"
              className="text-[12px] text-red-600 font-medium"
            >
              {uploadError}
            </p>
          )}
        </div>
      )}

      {/* COLOUR MODE */}
      {cfg.source === 'color' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center flex-wrap gap-2.5">
            {BANNER_COLOR_SWATCHES.map((hex) => {
              const selected = (cfg.color || BANNER_COLOR_SWATCHES[0]).toUpperCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    setHexDraft(hex);
                    onChangeBanner({ ...cfg, source: 'color', color: hex });
                  }}
                  aria-label={`Select banner colour ${hex}`}
                  aria-pressed={selected}
                  className={`w-11 h-11 rounded-[12px] border flex items-center justify-center cursor-pointer transition-transform ${
                    selected
                      ? 'ring-2 ring-ink ring-offset-2 border-ink scale-105'
                      : 'border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {selected && <Check size={16} className="text-white" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2.5">
            <span className="text-[12px] font-medium text-muted shrink-0">Custom hex</span>
            <div className="relative flex-1 max-w-[160px]">
              <span
                className="w-5 h-5 rounded-[6px] border border-border absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ backgroundColor: cfg.color || BANNER_COLOR_SWATCHES[0] }}
              />
              <input
                type="text"
                value={hexDraft}
                maxLength={7}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#0A66C2"
                aria-label="Custom banner hex colour"
                className="w-full h-10 pl-9 pr-2.5 rounded-[10px] border border-border bg-surface font-mono text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
            </div>
          </label>
        </div>
      )}

      {/* Always-live 44px sliders: Vertical position (0-100) + Darken for readability (0-60) */}
      <div className="flex flex-col gap-1 pt-1">
        <label className="min-h-[44px] flex flex-col justify-center gap-1">
          <span className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink">Vertical position</span>
            <span className="font-mono text-[12px] text-muted tabular-nums">{cfg.focalY}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={cfg.focalY}
            onChange={(e) =>
              onChangeBanner({ ...cfg, focalY: Number(e.target.value) })
            }
            aria-label="Vertical position"
            className="w-full accent-ink cursor-pointer"
          />
        </label>

        <label className="min-h-[44px] flex flex-col justify-center gap-1">
          <span className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink">Darken for readability</span>
            <span className="font-mono text-[12px] text-muted tabular-nums">{cfg.dim}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={cfg.dim}
            onChange={(e) =>
              onChangeBanner({ ...cfg, dim: Number(e.target.value) })
            }
            aria-label="Darken for readability"
            className="w-full accent-ink cursor-pointer"
          />
        </label>
      </div>

      <BannerCropModal
        isOpen={isCropOpen && Boolean(cropSourceUrl)}
        imageUrl={cropSourceUrl}
        sourceWidth={fileInfo?.originalWidth || fileInfo?.width || 1584}
        initialFocalX={cfg.focalX}
        initialFocalY={cfg.focalY}
        initialZoom={cfg.zoom}
        dim={cfg.dim}
        provider={provider}
        providerName={providerName}
        brandColor={brandColor}
        meta={meta}
        title={title}
        subtitle={subtitle}
        userAvatarUrl={userAvatarUrl}
        userDisplayName={userDisplayName}
        cardSurfaceHex={cardSurfaceHex}
        cardTextColor={cardTextColor}
        cardMutedColor={cardMutedColor}
        cardBorderColor={cardBorderColor}
        platformGlyph={platformGlyph}
        onCancel={() => setIsCropOpen(false)}
        onApply={async ({ focalX, focalY, zoom }) => {
          setIsCropOpen(false);
          if (fileInfo?.localSourceUrl) {
            await commitBannerUpload({
              sourceUrl: fileInfo.localSourceUrl,
              fileName: fileInfo.fileName,
              originalWidth: fileInfo.originalWidth || fileInfo.width,
              focalX,
              focalY,
              zoom,
              nextFocalX: 50,
              nextFocalY: 50,
              nextZoom: 1,
            });
          } else {
            onChangeBanner({
              ...cfg,
              source: 'upload',
              focalX,
              focalY,
              zoom,
            });
          }
        }}
      />
    </section>
  );
};

import React, { useState, useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { compressImageFile } from '../../lib/imageCompressor';
import { removeLinkImage } from '../../data/storageApi';

interface ImageSectionProps {
  userId: string;
  blockId?: string;
  token?: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  onImageChanged: (newPath: string | null, newUrl?: string | null) => Promise<void>;
}

export const ImageSection: React.FC<ImageSectionProps> = ({
  userId,
  blockId,
  token,
  thumbnailPath,
  thumbnailUrl,
  onImageChanged,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage('Uploading image');
    setIsUploading(true);

    try {
      // 1. Fast client-side image compression
      const compressed = await compressImageFile(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        format: 'image/jpeg',
        cropSquare: false,
      });

      let finalUrl = compressed.dataUrl;
      const newPath = `${userId}/thumb_${Date.now()}.jpg`;

      // 2. Upload to server for fast cached delivery
      try {
        const res = await fetch('/api/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userId,
            blockId: blockId || `blk_${Date.now()}`,
            dataUrl: compressed.dataUrl,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.avatarUrl) {
            finalUrl = json.avatarUrl;
          }
        }
      } catch {
        // Fallback to compressed data URL directly
      }

      // Save immediately
      const oldPath = thumbnailPath;
      await onImageChanged(newPath, finalUrl);

      // Remove old image object if it existed (best effort)
      if (oldPath) {
        removeLinkImage(token, oldPath);
      }

      setStatusMessage('Image added');
    } catch {
      setErrorMessage("We couldn't upload that. Try another image.");
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    const oldPath = thumbnailPath;
    setErrorMessage(null);
    try {
      await onImageChanged(null, null);
      if (oldPath) {
        removeLinkImage(token, oldPath);
      }
    } catch {
      setErrorMessage("We couldn't remove that. Try again.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-busy={isUploading}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {thumbnailUrl ? (
        // With an image
        <div className="flex items-center gap-4 p-3 bg-surface-2 border border-border rounded-[10px]">
          <img
            src={thumbnailUrl}
            alt=""
            className="w-20 h-20 object-cover rounded-[10px] border border-border shrink-0 bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="md"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                'Replace'
              )}
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={isUploading}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        // Empty state
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`h-24 p-3 bg-surface-2 border rounded-[10px] flex items-center justify-between gap-3 transition-colors duration-120 ${
            isDragging ? 'border-ink bg-surface' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-[8px] bg-surface flex items-center justify-center text-subtle shrink-0 border border-border">
              <ImagePlus size={20} strokeWidth={1.5} />
            </div>
            <div className="overflow-hidden">
              <p className="text-[14px] font-medium text-ink truncate">Add an image</p>
              <p className="text-[13px] text-muted truncate">
                PNG, JPG or WebP. Up to 8 MB.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="md"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              'Choose image'
            )}
          </Button>
        </div>
      )}

      {statusMessage && (
        <span className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </span>
      )}

      {errorMessage && (
        <p className="text-[13px] text-error" role="alert">
          {errorMessage}
        </p>
      )}

      <p className="text-[13px] text-muted">Images save right away.</p>
    </div>
  );
};

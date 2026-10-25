import React, { useRef, useState } from 'react';
import { Camera, Trash2, Upload, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

interface ProfilePhotoUploaderProps {
  currentAvatarUrl?: string | null;
  initials?: string;
  onAvatarChange: (newUrl: string | null) => Promise<void> | void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  currentAvatarUrl,
  initials = 'ME',
  onAvatarChange,
  size = 'md',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  const dimension = size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-24 h-24' : 'w-20 h-20';
  const textDimension = size === 'sm' ? 'text-[18px]' : size === 'lg' ? 'text-[32px]' : 'text-[24px]';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a PNG, JPG or WebP image');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast('Image must be under 8 MB');
      return;
    }

    setIsProcessing(true);

    try {
      // Scale and compress image to 400x400 square for optimal sharpness and performance
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          // Crop to square center
          const minSide = Math.min(width, height);
          const startX = (width - minSide) / 2;
          const startY = (height - minSide) / 2;

          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, maxDim, maxDim);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            await onAvatarChange(dataUrl);
            showToast('Profile photo updated');
          }
          setIsProcessing(false);
        };
        img.onerror = () => {
          showToast('Failed to process image');
          setIsProcessing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch {
      showToast('Failed to upload image');
      setIsProcessing(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setIsProcessing(true);
    try {
      await onAvatarChange(null);
      showToast('Profile photo removed');
    } catch {
      showToast('Failed to remove photo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Curated aesthetic gradients for creators without an avatar
  const presetGradients = [
    'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
    'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #c084fc 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  ];

  const handleSelectGradient = async (gradient: string) => {
    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Render aesthetic SVG or gradient into data URL
        const dataUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231E293B"/><stop offset="100%" stop-color="%230F172A"/></linearGradient></defs><rect width="400" height="400" fill="url(%23g)"/><text x="200" y="240" font-family="sans-serif" font-size="160" font-weight="600" fill="%23FFFFFF" text-anchor="middle">${initials.slice(0, 2).toUpperCase()}</text></svg>`;
        await onAvatarChange(dataUrl);
        showToast('Avatar style applied');
      }
    } catch {
      showToast('Failed to apply style');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Avatar Circle */}
      <div className="relative group shrink-0 self-start sm:self-center">
        <div
          className={`${dimension} rounded-full overflow-hidden bg-surface-2 border border-border shadow-xs flex items-center justify-center font-semibold text-ink select-none relative`}
        >
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`${textDimension} tracking-tight`}>
              {initials.slice(0, 2).toUpperCase()}
            </span>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
        </div>

        {/* Quick change camera badge */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          aria-label="Upload new photo"
          className="absolute bottom-0 right-0 p-1.5 rounded-full bg-ink text-surface shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <Camera size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload size={14} className="mr-1.5" />
            <span>{currentAvatarUrl ? 'Change photo' : 'Upload photo'}</span>
          </Button>

          {currentAvatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isProcessing}
            >
              <Trash2 size={14} className="mr-1.5 text-red-600" />
              <span className="text-red-600">Remove</span>
            </Button>
          )}
        </div>

        <p className="text-[12px] text-muted">
          PNG, JPG or WebP. Cropped to square automatically.
        </p>
      </div>
    </div>
  );
};

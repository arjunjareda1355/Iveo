import React, { useRef, useState } from 'react';
import { Camera, Trash2, Upload, Sparkles, Loader2, Check, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';
import {
  DEFAULT_AVATAR_LIST,
  getDefaultAvatarByUrl,
  DefaultAvatar,
} from '../../lib/defaultAvatars';
import { compressImageFile } from '../../lib/imageCompressor';

interface AvatarSelectorProps {
  currentAvatarUrl?: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  initials?: string;
  username?: string | null;
  userId?: string | null;
  primaryEmail?: string | null;
  onAvatarChange: (payload: {
    avatarUrl: string | null;
    avatarType: 'default' | 'uploaded';
    avatarId: string | null;
  }) => Promise<void> | void;
  className?: string;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  currentAvatarUrl,
  avatarType,
  avatarId,
  initials = 'ME',
  username,
  userId,
  primaryEmail,
  onAvatarChange,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDefaultId, setSelectedDefaultId] = useState<string | null>(() => {
    if (avatarId) return avatarId;
    if (currentAvatarUrl) {
      const match = getDefaultAvatarByUrl(currentAvatarUrl);
      return match ? match.id : null;
    }
    return null;
  });

  const { showToast } = useToast();

  const isCurrentDefault = Boolean(
    avatarType === 'default' ||
    selectedDefaultId ||
    (currentAvatarUrl && getDefaultAvatarByUrl(currentAvatarUrl))
  );

  const handleSelectDefault = async (avatar: DefaultAvatar) => {
    setSelectedDefaultId(avatar.id);
    setIsProcessing(true);
    try {
      await onAvatarChange({
        avatarUrl: avatar.url,
        avatarType: 'default',
        avatarId: avatar.id,
      });
      showToast('Avatar updated');
    } catch {
      showToast('Failed to select avatar');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a PNG, JPG, or WebP image');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast('Image must be under 8 MB');
      return;
    }

    setIsProcessing(true);

    try {
      const { dataUrl } = await compressImageFile(file, {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.78,
        cropSquare: true,
      });

      const u = (username || localStorage.getItem('iveo_current_username') || 'owner')
        .replace(/^@+/, '')
        .toLowerCase()
        .trim();
      let uploadedUrl = dataUrl;

      try {
        const upRes = await fetch('/api/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || '',
            'x-user-email': primaryEmail || '',
          },
          body: JSON.stringify({
            username: u,
            dataUrl,
            userId: userId || undefined,
            primaryEmail: primaryEmail || undefined,
          }),
        });
        if (upRes.ok) {
          const upJson = await upRes.json();
          if (upJson.avatarUrl) {
            uploadedUrl = upJson.avatarUrl;
          }
        } else if (userId) {
          const errJson = await upRes.json().catch(() => ({}));
          throw new Error(errJson?.message || 'Could not upload photo');
        }
      } catch (uploadErr) {
        if (userId) {
          throw uploadErr;
        }
      }

      setSelectedDefaultId(null);
      await onAvatarChange({
        avatarUrl: uploadedUrl,
        avatarType: 'uploaded',
        avatarId: null,
      });
      showToast('Custom photo updated');
    } catch (err: any) {
      showToast(err?.message || 'Could not upload photo');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setIsProcessing(true);
    try {
      setSelectedDefaultId(null);
      await onAvatarChange({
        avatarUrl: null,
        avatarType: 'default',
        avatarId: null,
      });
      showToast('Avatar reset to default');
    } catch {
      showToast('Failed to remove photo');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Hidden File Input for Custom Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Header: Current Avatar Preview + Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-2 border border-border">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              src={currentAvatarUrl}
              alt={username || 'Profile avatar'}
              size="lg"
              fallbackInitials={initials}
              className="ring-2 ring-border shadow-xs"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-semibold text-ink truncate">
              {username ? `@${username}` : 'Profile photo'}
            </span>
          </div>
        </div>

        {/* Action Buttons: Direct Upload & Library Toggle (no duplicate buttons) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 flex-wrap">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload size={14} className="mr-1.5" />
            <span>Upload photo</span>
          </Button>

          <Button
            type="button"
            variant={showLibrary ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowLibrary(!showLibrary)}
            disabled={isProcessing}
          >
            <Sparkles size={14} className="mr-1.5" />
            <span>{showLibrary ? 'Hide styles' : 'Browse styles'}</span>
          </Button>

          {currentAvatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isProcessing}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[12px]"
            >
              <Trash2 size={13} className="mr-1" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Default Avatar Library Grid */}
      {showLibrary && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center justify-between text-[12px] text-muted px-0.5">
            <span className="font-medium text-ink">Avatar library</span>
            <span>{DEFAULT_AVATAR_LIST.length} styles · Tap to apply</span>
          </div>

          <div
            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2.5 max-h-[260px] overflow-y-auto p-1.5 rounded-lg bg-surface-2/60 border border-border/80 custom-scrollbar"
            role="radiogroup"
            aria-label="Default avatar library"
          >
            {DEFAULT_AVATAR_LIST.map((avatar) => {
              const isSelected =
                selectedDefaultId === avatar.id || currentAvatarUrl === avatar.url;

              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => handleSelectDefault(avatar)}
                  disabled={isProcessing}
                  title={avatar.name}
                  aria-checked={isSelected}
                  role="radio"
                  className={`group relative aspect-square rounded-full p-0.5 transition-all duration-150 cursor-pointer focus:outline-hidden ${
                    isSelected
                      ? 'ring-2 ring-ink ring-offset-2 scale-105'
                      : 'hover:scale-105 hover:ring-1 hover:ring-ink/30 active:scale-95'
                  }`}
                >
                  <img
                    src={avatar.url}
                    alt={avatar.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full rounded-full object-cover bg-sand-100"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 rounded-full bg-black/25 flex items-center justify-center text-white">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

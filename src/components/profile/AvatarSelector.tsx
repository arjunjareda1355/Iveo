import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Upload, Sparkles, Loader2, Check, ChevronDown } from 'lucide-react';
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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
      showToast('Photo updated');
      setShowLibrary(false);
    } catch {
      showToast('Failed to select photo');
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
      showToast('Photo updated');
    } catch (err: any) {
      showToast(err?.message || 'Could not upload photo');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setMenuOpen(false);
    setIsProcessing(true);
    try {
      setSelectedDefaultId(null);
      await onAvatarChange({
        avatarUrl: null,
        avatarType: 'default',
        avatarId: null,
      });
      showToast('Photo removed');
    } catch {
      showToast('Failed to remove photo');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              src={currentAvatarUrl}
              alt={username || 'Profile avatar'}
              size="lg"
              fallbackInitials={initials}
              className="border border-border"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-medium text-ink">
              Profile photo
            </span>
            <span className="text-[12px] text-muted mt-0.5">
              PNG, JPG or WebP, optimised automatically.
            </span>
            {currentAvatarUrl && isCurrentDefault && (
              <span className="text-[12px] text-muted mt-0.5">
                Using library avatar
              </span>
            )}
          </div>
        </div>

        {/* Single "Change photo" menu (AR-3 / AU-7) */}
        <div ref={menuRef} className="relative shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={isProcessing}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span>Change photo</span>
            <ChevronDown size={15} className="ml-1.5 text-muted" />
          </Button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Photo actions"
              className="absolute right-0 top-[calc(100%+6px)] w-52 rounded-[12px] bg-surface border border-border shadow-[0_12px_32px_rgba(10,10,10,0.12)] py-1.5 z-40"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full min-h-[44px] px-3.5 flex items-center gap-2.5 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors text-left cursor-pointer"
              >
                <Upload size={16} className="text-muted shrink-0" />
                <span>Upload photo</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowLibrary((prev) => !prev);
                }}
                className="w-full min-h-[44px] px-3.5 flex items-center gap-2.5 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors text-left cursor-pointer"
              >
                <Sparkles size={16} className="text-muted shrink-0" />
                <span>{showLibrary ? 'Hide library' : 'Choose from library'}</span>
              </button>

              {currentAvatarUrl && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleRemove}
                  className="w-full min-h-[44px] px-3.5 flex items-center gap-2.5 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors text-left cursor-pointer border-t border-divider mt-1 pt-1"
                >
                  <Trash2 size={16} className="text-muted shrink-0" />
                  <span>Remove photo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expandable Default Avatar Library Grid */}
      {showLibrary && (
        <div className="flex flex-col gap-2.5 pt-2">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span className="font-medium text-ink">Avatar library</span>
            <button
              type="button"
              onClick={() => setShowLibrary(false)}
              className="text-[12px] text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
            >
              Done
            </button>
          </div>

          <div
            className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-2.5 max-h-[240px] overflow-y-auto p-1 custom-scrollbar"
            role="radiogroup"
            aria-label="Avatar library"
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
                  className={`group relative aspect-square rounded-full p-0.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-ink ${
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
                    className="w-full h-full rounded-full object-cover bg-surface-2"
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

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { VibeTileGroup } from '../onboarding/VibeTileGroup';
import { ProfilePhotoUploader } from '../profile/ProfilePhotoUploader';
import { BackgroundSelectorCard } from './BackgroundSelectorCard';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { VibeId, VIBES } from '../../lib/vibes';
import { ButtonShape } from '../../lib/preferences';
import { BackgroundConfig } from '../../data/types';
import { copy } from '../../content/copy';

interface AppearanceTabProps {
  onPreviewVibeChange?: (vibeId: VibeId) => void;
  onPreviewShapeChange?: (shape: ButtonShape | null) => void;
}

const BUTTON_SHAPE_OPTIONS: readonly { value: ButtonShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
];

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  onPreviewVibeChange,
  onPreviewShapeChange,
}) => {
  const session = useIvioSession();
  const { showToast } = useToast();

  const [currentVibeId, setCurrentVibeId] = useState<VibeId>(session.vibeId);
  const [currentShape, setCurrentShape] = useState<ButtonShape>(() => {
    if (session.buttonShape) return session.buttonShape;
    const v = VIBES.find((item) => item.id === session.vibeId);
    return (v?.nativeShape.toLowerCase() as ButtonShape) || 'rounded';
  });

  // Profile fields state
  const [displayName, setDisplayName] = useState(session.displayName || '');
  const [bio, setBio] = useState(session.bio || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSelectVibe = async (id: VibeId) => {
    const previous = currentVibeId;
    setCurrentVibeId(id);
    onPreviewVibeChange?.(id);

    // Reset button shape to native
    const nextVibe = VIBES.find((v) => v.id === id);
    const native = (nextVibe?.nativeShape.toLowerCase() as ButtonShape) || 'rounded';
    setCurrentShape(native);
    onPreviewShapeChange?.(null);

    try {
      await session.updatePreferences({ vibeId: id, buttonShape: null });
      showToast(copy.toasts.vibeSaved);
    } catch {
      setCurrentVibeId(previous);
      onPreviewVibeChange?.(previous);
      showToast(copy.toasts.saveFailed);
    }
  };

  const handleSelectShape = async (shape: ButtonShape) => {
    const previous = currentShape;
    setCurrentShape(shape);
    onPreviewShapeChange?.(shape);

    try {
      await session.updatePreferences({ buttonShape: shape });
      showToast('Button style updated');
    } catch {
      setCurrentShape(previous);
      onPreviewShapeChange?.(previous);
      showToast(copy.toasts.saveFailed);
    }
  };

  const handleAvatarChange = async (url: string | null) => {
    try {
      await session.updateProfile({ avatarUrl: url });
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const handleAvatarPayloadChange = async (payload: {
    avatarUrl: string | null;
    avatarType: 'default' | 'uploaded';
    avatarId: string | null;
  }) => {
    try {
      await session.updateProfile({
        avatarUrl: payload.avatarUrl,
        avatarType: payload.avatarType,
        avatarId: payload.avatarId,
      });
    } catch {
      showToast("Couldn't update photo");
    }
  };

  const handleSaveProfileInfo = async () => {
    setIsSavingProfile(true);
    try {
      await session.updateProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim(),
      });
      showToast('Profile info updated');
    } catch {
      showToast("Couldn't save profile info");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleBackgroundChange = async (bg: BackgroundConfig | null) => {
    try {
      await session.updateProfile({ background: bg });
    } catch {
      showToast("Couldn't update background");
    }
  };

  const activeVibe = VIBES.find((v) => v.id === currentVibeId) || VIBES[0];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Profile Photo & Info Card */}
      <Card className="flex flex-col gap-5">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            Profile & Photo
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            Customize how your avatar, name, and bio appear to visitors.
          </p>
        </div>

        {/* Photo Uploader */}
        <div>
          <label className="block text-[13px] font-medium text-ink mb-2">
            Profile Picture
          </label>
          <ProfilePhotoUploader
            currentAvatarUrl={session.imageUrl}
            avatarType={session.avatarType}
            avatarId={session.avatarId}
            initials={displayName || session.username || 'ME'}
            username={session.username}
            onAvatarChange={handleAvatarChange}
            onAvatarPayloadChange={handleAvatarPayloadChange}
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Maya Ellis"
            className="w-full h-11 px-3.5 rounded-[10px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors"
          />
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-ink">
              Bio
            </label>
            <span className="text-[11px] text-muted">{bio.length}/160</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            rows={2}
            placeholder="A short sentence about what you make..."
            className="w-full p-3 rounded-[10px] bg-surface-2 border border-border text-[14px] text-ink outline-none focus:border-ink transition-colors resize-none"
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveProfileInfo}
            loading={isSavingProfile}
          >
            Save profile
          </Button>
        </div>
      </Card>

      {/* 2. Vibe Selection Card */}
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.appearanceTab.vibeHeading}
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            {copy.dashboard.appearanceTab.vibeSubheading}
          </p>
        </div>

        <div className="mt-2">
          <VibeTileGroup
            selectedVibeId={currentVibeId}
            onSelect={handleSelectVibe}
          />
        </div>
      </Card>

      {/* 3. Page Background Card */}
      <BackgroundSelectorCard
        currentBackground={session.background}
        isPro={session.isPro}
        onBackgroundChange={handleBackgroundChange}
      />

      {/* 4. Button Shape Card */}
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.appearanceTab.buttonShapeHeading}
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            Select the curvature for your link buttons.
          </p>
        </div>

        <div className="max-w-[320px]">
          <SegmentedControl<ButtonShape>
            options={BUTTON_SHAPE_OPTIONS}
            value={currentShape}
            onChange={handleSelectShape}
            ariaLabel="Button shape"
          />
        </div>
      </Card>

      {/* 4. Active Vibe Palette Details */}
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            Active Palette Details
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            Styling tokens automatically applied to {activeVibe.name}.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
          <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1.5">
            <span className="text-muted text-[11px] uppercase font-mono">Font</span>
            <span className="font-semibold text-ink truncate">{activeVibe.fontFamily.split(',')[0].replace(/['"]/g, '')}</span>
          </div>

          <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1.5">
            <span className="text-muted text-[11px] uppercase font-mono">Background</span>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: activeVibe.tokens.bg }}
              />
              <span className="font-mono text-ink text-[12px]">{activeVibe.tokens.bg}</span>
            </div>
          </div>

          <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1.5">
            <span className="text-muted text-[11px] uppercase font-mono">Button Style</span>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: activeVibe.tokens.buttonBg }}
              />
              <span className="font-mono text-ink text-[12px]">{activeVibe.tokens.buttonBg}</span>
            </div>
          </div>

          <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1.5">
            <span className="text-muted text-[11px] uppercase font-mono">Default Radius</span>
            <span className="font-medium text-ink">{activeVibe.tokens.buttonRadius}px</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

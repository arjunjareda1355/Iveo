import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';
import { VibeTileGroup } from '../onboarding/VibeTileGroup';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { VibeId, VIBES } from '../../lib/vibes';
import { ButtonShape } from '../../lib/preferences';
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
    } catch {
      setCurrentShape(previous);
      onPreviewShapeChange?.(previous);
      showToast(copy.toasts.saveFailed);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Vibe Selection Card */}
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

      {/* Button Shape Card */}
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.appearanceTab.buttonShapeHeading}
          </h3>
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

      {/* Coming Next Card */}
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.appearanceTab.comingNextHeading}
          </h3>
        </div>

        <div className="space-y-3">
          {copy.dashboard.appearanceTab.comingNextItems.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between text-[14px] text-muted py-1"
            >
              <span>{item}</span>
              <Badge variant="default">{copy.dashboard.appearanceTab.soonBadge}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

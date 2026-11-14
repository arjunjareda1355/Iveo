import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Image as ImageIcon,
  Palette,
  RectangleHorizontal,
  Sparkles,
  Type,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { VibeTileGroup } from '../onboarding/VibeTileGroup';
import { ProfilePhotoUploader } from '../profile/ProfilePhotoUploader';
import { BackgroundSelectorCard } from './BackgroundSelectorCard';
import { FontSelectorPanel } from './FontSelectorPanel';
import { ButtonColorsPanel } from './ButtonColorsPanel';
import { LayoutEffectsPanel } from './LayoutEffectsPanel';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { VibeId, VIBES } from '../../lib/vibes';
import { ButtonShape, DEFAULT_LAYOUT_SETTINGS, LayoutSettings } from '../../lib/preferences';
import { FontSettings, getFontOption, loadGoogleFonts } from '../../lib/fonts';
import { ButtonColors, resolveEffectiveTokens } from '../../lib/colors';
import { getBackgroundPreset } from '../../lib/backgrounds';
import { BackgroundConfig } from '../../data/types';
import { copy } from '../../content/copy';
import { Layers } from 'lucide-react';

type AppearancePanel = 'hub' | 'vibe' | 'background' | 'fonts' | 'shape' | 'colors' | 'layout';

interface AppearanceTabProps {
  onPreviewVibeChange?: (vibeId: VibeId) => void;
  onPreviewShapeChange?: (shape: ButtonShape | null) => void;
  onPreviewFontSettingsChange?: (fonts: FontSettings | null) => void;
  onPreviewButtonColorsChange?: (colors: ButtonColors | null) => void;
  onPreviewLayoutChange?: (layout: LayoutSettings | null) => void;
}

const BUTTON_SHAPE_OPTIONS: readonly { value: ButtonShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
];

const PANEL_META: Record<
  Exclude<AppearancePanel, 'hub'>,
  { title: string; subtitle: string }
> = {
  vibe: {
    title: copy.dashboard.appearanceTab.vibeHeading,
    subtitle: copy.dashboard.appearanceTab.vibeSubheading,
  },
  background: {
    title: 'Page Background',
    subtitle: 'Choose a preset gradient, pattern, or upload a custom photo backdrop.',
  },
  fonts: {
    title: 'Typography & Fonts',
    subtitle: 'Customize Name, Bio, and Button text fonts with Free & Pro typefaces.',
  },
  shape: {
    title: copy.dashboard.appearanceTab.buttonShapeHeading,
    subtitle: 'Choose square, rounded, or pill curvature for your link buttons.',
  },
  colors: {
    title: 'Button Colors',
    subtitle: 'Pick colors or enter #RRGGBB hex codes for button fill, text, and border.',
  },
  layout: {
    title: 'Layout & Effects',
    subtitle: 'Customize avatar frame, header alignment, button finish, spacing & width.',
  },
};

const getNativeShape = (vibeId: VibeId): ButtonShape => {
  const v = VIBES.find((item) => item.id === vibeId);
  return (v?.nativeShape.toLowerCase() as ButtonShape) || 'rounded';
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  onPreviewVibeChange,
  onPreviewShapeChange,
  onPreviewFontSettingsChange,
  onPreviewButtonColorsChange,
  onPreviewLayoutChange,
}) => {
  const session = useIvioSession();
  const { showToast } = useToast();
  const { openUpgrade } = useUpgradeDialog();

  const [activePanel, setActivePanel] = useState<AppearancePanel>('hub');
  const [currentVibeId, setCurrentVibeId] = useState<VibeId>(session.vibeId);
  const [currentShape, setCurrentShape] = useState<ButtonShape>(() =>
    session.buttonShape || getNativeShape(session.vibeId)
  );
  const [currentFonts, setCurrentFonts] = useState<FontSettings | null>(
    session.fontSettings || null
  );
  const [currentButtonColors, setCurrentButtonColors] = useState<ButtonColors | null>(
    session.buttonColors || null
  );
  const [currentLayout, setCurrentLayout] = useState<LayoutSettings | null>(
    session.layoutSettings || null
  );

  // Profile fields state
  const [displayName, setDisplayName] = useState(session.displayName || '');
  const [bio, setBio] = useState(session.bio || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync local state when session hydrates asynchronously from /api/me
  useEffect(() => {
    setCurrentVibeId(session.vibeId);
  }, [session.vibeId]);

  useEffect(() => {
    setCurrentShape(session.buttonShape || getNativeShape(session.vibeId));
  }, [session.buttonShape, session.vibeId]);

  useEffect(() => {
    setDisplayName(session.displayName || '');
  }, [session.displayName]);

  useEffect(() => {
    setBio(session.bio || '');
  }, [session.bio]);

  useEffect(() => {
    setCurrentFonts(session.fontSettings || null);
    if (session.fontSettings) {
      loadGoogleFonts([
        session.fontSettings.nameFont,
        session.fontSettings.bioFont,
        session.fontSettings.buttonFont,
      ]);
    }
  }, [session.fontSettings]);

  useEffect(() => {
    setCurrentButtonColors(session.buttonColors || null);
  }, [session.buttonColors]);

  useEffect(() => {
    setCurrentLayout(session.layoutSettings || null);
  }, [session.layoutSettings]);

  const handleSelectVibe = async (id: VibeId) => {
    const previous = currentVibeId;
    setCurrentVibeId(id);
    onPreviewVibeChange?.(id);

    // Reset button shape to native when switching vibe
    const native = getNativeShape(id);
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

  const handleResetShape = async () => {
    const native = getNativeShape(currentVibeId);
    setCurrentShape(native);
    onPreviewShapeChange?.(null);
    try {
      await session.updatePreferences({ buttonShape: null });
      showToast('Button shape reset to Vibe native');
    } catch {
      showToast(copy.toasts.saveFailed);
    }
  };

  const handleSaveFonts = async (nextFonts: FontSettings | null) => {
    const previous = currentFonts;
    setCurrentFonts(nextFonts);
    onPreviewFontSettingsChange?.(nextFonts);
    try {
      await session.updatePreferences({ fontSettings: nextFonts });
    } catch (err) {
      setCurrentFonts(previous);
      onPreviewFontSettingsChange?.(previous);
      throw err;
    }
  };

  const handleSaveButtonColors = async (nextColors: ButtonColors | null) => {
    const previous = currentButtonColors;
    setCurrentButtonColors(nextColors);
    onPreviewButtonColorsChange?.(nextColors);
    try {
      await session.updatePreferences({ buttonColors: nextColors });
    } catch (err) {
      setCurrentButtonColors(previous);
      onPreviewButtonColorsChange?.(previous);
      throw err;
    }
  };

  const handleSaveLayout = async (nextLayout: LayoutSettings | null) => {
    const previous = currentLayout;
    setCurrentLayout(nextLayout);
    onPreviewLayoutChange?.(nextLayout);
    try {
      await session.updatePreferences({ layoutSettings: nextLayout });
    } catch (err) {
      setCurrentLayout(previous);
      onPreviewLayoutChange?.(previous);
      throw err;
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
  const effectiveTokens = resolveEffectiveTokens(
    activeVibe.tokens,
    currentButtonColors,
    session.background
  );

  // Summaries for minimized feature buttons
  const backgroundSummary = (() => {
    const bg = session.background;
    if (!bg || bg.type === 'none') return 'Theme Default';
    if (bg.type === 'image') return 'Custom Photo';
    if (bg.presetId) {
      const preset = getBackgroundPreset(bg.presetId);
      if (preset) return preset.name;
      return bg.presetId
        .replace(/^pattern-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Custom Backdrop';
  })();

  const fontsSummary = (() => {
    const parts = [
      getFontOption(currentFonts?.nameFont)?.name,
      getFontOption(currentFonts?.bioFont)?.name,
      getFontOption(currentFonts?.buttonFont)?.name,
    ].filter(Boolean) as string[];
    if (parts.length === 0) {
      return `${activeVibe.fontFamily.split(',')[0].replace(/['"]/g, '')} (Default)`;
    }
    return Array.from(new Set(parts)).join(' · ');
  })();

  const shapeSummary =
    BUTTON_SHAPE_OPTIONS.find((s) => s.value === currentShape)?.label || 'Rounded';

  const buttonColorsSummary = currentButtonColors?.bg || effectiveTokens.buttonBg;

  const layoutStyle = currentLayout?.buttonStyle || DEFAULT_LAYOUT_SETTINGS.buttonStyle;
  const layoutSummary = `${layoutStyle.charAt(0).toUpperCase()}${layoutStyle.slice(1)}`;

  // ── Dedicated Sub-Screen View ───────────────────────────────────────────────
  if (activePanel !== 'hub') {
    const meta = PANEL_META[activePanel];
    return (
      <div className="flex flex-col gap-5 w-full min-w-0">
        {/* Sub-screen Header with Back button only (no duplicate top Preview) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActivePanel('hub')}
              aria-label="Back to Appearance"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-surface text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-ink leading-tight truncate">
                {meta.title}
              </h2>
              <p className="text-[13px] text-muted truncate">{meta.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Sub-screen Body */}
        {activePanel === 'vibe' && (
          <Card className="flex flex-col gap-5">
            <VibeTileGroup
              selectedVibeId={currentVibeId}
              onSelect={handleSelectVibe}
              isPro={session.isPro}
              onProBlocked={() => openUpgrade('pro_vibes')}
            />

            <div className="pt-4 border-t border-border">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-3">
                Active Palette ({activeVibe.name})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
                <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1">
                  <span className="text-muted text-[11px] uppercase font-mono">Font</span>
                  <span className="font-semibold text-ink truncate">
                    {activeVibe.fontFamily.split(',')[0].replace(/['"]/g, '')}
                  </span>
                </div>
                <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1">
                  <span className="text-muted text-[11px] uppercase font-mono">Background</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: activeVibe.tokens.bg }}
                    />
                    <span className="font-mono text-ink text-[12px]">
                      {activeVibe.tokens.bg}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1">
                  <span className="text-muted text-[11px] uppercase font-mono">Button</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: activeVibe.tokens.buttonBg }}
                    />
                    <span className="font-mono text-ink text-[12px]">
                      {activeVibe.tokens.buttonBg}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-[10px] bg-surface-2 border border-border flex flex-col gap-1">
                  <span className="text-muted text-[11px] uppercase font-mono">Radius</span>
                  <span className="font-medium text-ink">{activeVibe.tokens.buttonRadius}px</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {activePanel === 'background' && (
          <Card>
            <BackgroundSelectorCard
              embedded
              currentBackground={session.background}
              isPro={session.isPro}
              onBackgroundChange={handleBackgroundChange}
            />
          </Card>
        )}

        {activePanel === 'fonts' && (
          <Card>
            <FontSelectorPanel
              currentFonts={currentFonts}
              activeVibe={activeVibe}
              isPro={session.isPro}
              onFontsChange={handleSaveFonts}
              onPreviewFontsChange={(next) => {
                setCurrentFonts(next);
                onPreviewFontSettingsChange?.(next);
              }}
            />
          </Card>
        )}

        {activePanel === 'shape' && (
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="max-w-[340px] w-full">
                <SegmentedControl<ButtonShape>
                  options={BUTTON_SHAPE_OPTIONS}
                  value={currentShape}
                  onChange={handleSelectShape}
                  ariaLabel="Button shape"
                />
              </div>

              {session.buttonShape && (
                <button
                  type="button"
                  onClick={handleResetShape}
                  className="text-[12px] text-muted hover:text-ink underline cursor-pointer"
                >
                  Reset to {activeVibe.name} native ({activeVibe.nativeShape})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { id: 'square', label: 'Square', radius: '0px', desc: 'Crisp architectural edges' },
                  { id: 'rounded', label: 'Rounded', radius: '12px', desc: 'Balanced modern cards' },
                  { id: 'pill', label: 'Pill', radius: '999px', desc: 'Soft capsule buttons' },
                ] as const
              ).map((item) => {
                const selected = currentShape === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectShape(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 ${
                      selected
                        ? 'border-ink bg-surface ring-1 ring-ink shadow-xs'
                        : 'border-border bg-surface-2/50 hover:border-ink/35'
                    }`}
                  >
                    <div
                      className="w-full h-10 flex items-center justify-center text-[13px] font-medium"
                      style={{
                        borderRadius: item.radius,
                        backgroundColor: effectiveTokens.buttonBg,
                        color: effectiveTokens.buttonText,
                        border: effectiveTokens.buttonBorder
                          ? `${effectiveTokens.buttonBorderWidth || '1px'} solid ${effectiveTokens.buttonBorder}`
                          : 'none',
                      }}
                    >
                      {item.label}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">
                        {item.label} <span className="font-mono text-[11px] text-muted">({item.radius})</span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {activePanel === 'colors' && (
          <Card className="w-full min-w-0 overflow-hidden">
            <ButtonColorsPanel
              currentColors={currentButtonColors}
              activeVibe={activeVibe}
              background={session.background}
              onColorsChange={handleSaveButtonColors}
              onPreviewColorsChange={(next) => {
                setCurrentButtonColors(next);
                onPreviewButtonColorsChange?.(next);
              }}
            />
          </Card>
        )}

        {activePanel === 'layout' && (
          <Card className="w-full min-w-0 overflow-hidden">
            <LayoutEffectsPanel
              currentLayout={currentLayout}
              activeVibe={activeVibe}
              buttonColors={currentButtonColors}
              background={session.background}
              onLayoutChange={handleSaveLayout}
              onPreviewLayoutChange={(next) => {
                setCurrentLayout(next);
                onPreviewLayoutChange?.(next);
              }}
            />
          </Card>
        )}
      </div>
    );
  }

  // ── Main Minimized Appearance Hub Screen ────────────────────────────────────
  const featureButtons: {
    id: Exclude<AppearancePanel, 'hub'>;
    label: string;
    tierNote: string;
    description: string;
    summary: string;
    icon: React.ReactNode;
    accessory: React.ReactNode;
  }[] = [
    {
      id: 'vibe',
      label: 'Vibe',
      tierNote: '6 Free · 6 Pro',
      description: 'Theme palette & overall mood',
      summary: activeVibe.name,
      icon: <Sparkles size={18} strokeWidth={1.75} />,
      accessory: (
        <div className="flex items-center -space-x-1 shrink-0">
          <span
            className="w-4 h-4 rounded-full border border-black/15"
            style={{ backgroundColor: activeVibe.tokens.bg }}
          />
          <span
            className="w-4 h-4 rounded-full border border-black/15"
            style={{ backgroundColor: activeVibe.tokens.buttonBg }}
          />
          <span
            className="w-4 h-4 rounded-full border border-black/15"
            style={{ backgroundColor: activeVibe.tokens.text }}
          />
        </div>
      ),
    },
    {
      id: 'background',
      label: 'Page Background',
      tierNote: '5 Free · 10 Pro + Photo',
      description: 'Gradients, patterns or custom photo',
      summary: backgroundSummary,
      icon: <ImageIcon size={18} strokeWidth={1.75} />,
      accessory: (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-border text-ink truncate max-w-[110px]">
          {backgroundSummary}
        </span>
      ),
    },
    {
      id: 'fonts',
      label: 'Fonts',
      tierNote: '8 Free · 11 Pro',
      description: 'Customize Name, Bio & Button typography',
      summary: fontsSummary,
      icon: <Type size={18} strokeWidth={1.75} />,
      accessory: (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-border text-ink truncate max-w-[130px]">
          {fontsSummary}
        </span>
      ),
    },
    {
      id: 'shape',
      label: 'Button Shape',
      tierNote: 'Free',
      description: 'Square, Rounded or Pill link buttons',
      summary: shapeSummary,
      icon: <RectangleHorizontal size={18} strokeWidth={1.75} />,
      accessory: (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-border text-ink">
          {shapeSummary}
        </span>
      ),
    },
    {
      id: 'colors',
      label: 'Button Colors',
      tierNote: 'Free',
      description: 'Custom hex codes, picker & border colors',
      summary: buttonColorsSummary,
      icon: <Palette size={18} strokeWidth={1.75} />,
      accessory: (
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-4 h-4 rounded-full border border-black/15"
            style={{
              backgroundColor:
                effectiveTokens.buttonBg === 'transparent'
                  ? 'transparent'
                  : effectiveTokens.buttonBg,
            }}
          />
          <span className="font-mono text-[11px] text-muted hidden sm:inline">
            {buttonColorsSummary}
          </span>
        </div>
      ),
    },
    {
      id: 'layout',
      label: 'Layout & Effects',
      tierNote: 'Free',
      description: 'Avatar frame, button finish, spacing & width',
      summary: layoutSummary,
      icon: <Layers size={18} strokeWidth={1.75} />,
      accessory: (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-border text-ink">
          {layoutSummary}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Profile Photo & Info Card */}
      <Card className="flex flex-col gap-5">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            Profile &amp; Photo
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

      {/* 2. Minimized Page Design Feature Buttons */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-semibold text-ink leading-tight">
              Customize Page Style
            </h3>
            <p className="mt-1 text-[14px] text-muted">
              Select a feature below to open its full editor.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {featureButtons.map((feat) => (
            <button
              key={feat.id}
              type="button"
              onClick={() => setActivePanel(feat.id)}
              className="group w-full p-3.5 rounded-xl border border-border bg-surface hover:border-ink/40 hover:bg-surface-2/60 transition-all flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0 group-hover:bg-surface transition-colors">
                  {feat.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink leading-snug">
                      {feat.label}
                    </span>
                    <span className="text-[11px] font-medium text-muted">
                      {feat.tierNote}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted truncate">
                    {feat.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {feat.accessory}
                <ChevronRight
                  size={17}
                  className="text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};


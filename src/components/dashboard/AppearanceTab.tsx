import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Image as ImageIcon,
  Info,
  Layers,
  RectangleHorizontal,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ProBadge } from '../plan/ProBadge';
import { VibeTileGroup } from '../onboarding/VibeTileGroup';
import { BackgroundSelectorCard } from './BackgroundSelectorCard';
import { FontSelectorPanel } from './FontSelectorPanel';
import { ButtonColorsPanel } from './ButtonColorsPanel';
import { LayoutEffectsPanel } from './LayoutEffectsPanel';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { VibeId, VIBES } from '../../lib/vibes';
import {
  ButtonShape,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_LAYOUT_SETTINGS,
  LayoutSettings,
} from '../../lib/preferences';
import { FontSettings, getFontCssFamily, getFontOption, loadGoogleFonts } from '../../lib/fonts';
import { ButtonColors, resolveEffectiveTokens } from '../../lib/colors';
import { getBackgroundPreset } from '../../lib/backgrounds';
import { BackgroundConfig } from '../../data/types';

type AppearanceSection = 'vibe' | 'background' | 'fonts' | 'buttons' | 'layout';

interface AppearanceTabProps {
  onPreviewVibeChange?: (vibeId: VibeId) => void;
  onPreviewShapeChange?: (shape: ButtonShape | null) => void;
  onPreviewFontSettingsChange?: (fonts: FontSettings | null) => void;
  onPreviewButtonColorsChange?: (colors: ButtonColors | null) => void;
  onPreviewLayoutChange?: (layout: LayoutSettings | null) => void;
  onPreviewBackgroundChange?: (background: BackgroundConfig | null) => void;
  mobilePhonePreview?: React.ReactNode;
}

const BUTTON_SHAPE_OPTIONS: readonly { value: ButtonShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
];

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
  onPreviewBackgroundChange,
  mobilePhonePreview,
}) => {
  const session = useIvioSession();
  const { showToast } = useToast();
  const { openUpgrade } = useUpgradeDialog();

  const [openSection, setOpenSection] = useState<AppearanceSection | null>('vibe');
  const [openInfoId, setOpenInfoId] = useState<AppearanceSection | null>(null);
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

  useEffect(() => {
    setCurrentVibeId(session.vibeId);
  }, [session.vibeId]);

  useEffect(() => {
    setCurrentShape(session.buttonShape || getNativeShape(session.vibeId));
  }, [session.buttonShape, session.vibeId]);

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

    const native = getNativeShape(id);
    setCurrentShape(native);
    onPreviewShapeChange?.(null);

    try {
      await session.updatePreferences({ vibeId: id, buttonShape: null });
      showToast('Vibe saved');
    } catch {
      setCurrentVibeId(previous);
      onPreviewVibeChange?.(previous);
      showToast("Couldn't save vibe");
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
      showToast("Couldn't save button style");
    }
  };

  const handleResetButtonsToDefault = async () => {
    const native = getNativeShape(currentVibeId);
    setCurrentShape(native);
    setCurrentButtonColors(null);
    onPreviewShapeChange?.(null);
    onPreviewButtonColorsChange?.(null);
    try {
      await session.updatePreferences({ buttonShape: null, buttonColors: null });
      showToast('Buttons reset to vibe default');
    } catch {
      showToast("Couldn't reset buttons");
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

  const handleBackgroundChange = async (bg: BackgroundConfig | null) => {
    try {
      await session.updateProfile({ background: bg });
    } catch {
      showToast("Couldn't update background");
    }
  };

  const handleResetSection = async (section: AppearanceSection) => {
    if (section === 'vibe') {
      await handleSelectVibe('clean');
    } else if (section === 'background') {
      onPreviewBackgroundChange?.(DEFAULT_BACKGROUND_CONFIG);
      await handleBackgroundChange(DEFAULT_BACKGROUND_CONFIG);
      showToast('Background reset to Pure White');
    } else if (section === 'fonts') {
      await handleSaveFonts(null);
      showToast('Typography reset to vibe default');
    } else if (section === 'buttons') {
      await handleResetButtonsToDefault();
    } else if (section === 'layout') {
      await handleSaveLayout(null);
      showToast('Layout reset to default');
    }
  };

  const handleFooterMarkToggle = async () => {
    if (!session.isPro) {
      openUpgrade('hide_footer');
      return;
    }

    const nextVal = !(session.hideIveoFooter || session.hideIvioFooter);
    try {
      await session.updatePreferences({
        hideIveoFooter: nextVal,
        hideIvioFooter: nextVal,
      });
      showToast(nextVal ? 'iveo branding hidden.' : 'iveo branding shown.');
    } catch {
      openUpgrade('hide_footer');
    }
  };

  const activeVibe = VIBES.find((v) => v.id === currentVibeId) || VIBES[0];
  const effectiveTokens = resolveEffectiveTokens(
    activeVibe.tokens,
    currentButtonColors,
    session.background
  );

  const backgroundSummary = (() => {
    const bg = session.background;
    if (!bg || bg.type === 'none') return 'Pure White';
    if (bg.type === 'image') return 'Custom photo';
    if (bg.presetId) {
      const preset = getBackgroundPreset(bg.presetId);
      if (preset) return preset.name;
      return bg.presetId
        .replace(/^pattern-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (bg.type === 'solid') return bg.value || '#FFFFFF';
    if (bg.type === 'gradient' || bg.type === 'mesh') return 'Gradient';
    return 'Custom backdrop';
  })();

  const fontsSummary = (() => {
    const parts = [
      getFontOption(currentFonts?.nameFont)?.name,
      getFontOption(currentFonts?.bioFont)?.name,
      getFontOption(currentFonts?.buttonFont)?.name,
    ].filter(Boolean) as string[];
    if (parts.length === 0) {
      return activeVibe.fontFamily.split(',')[0].replace(/['"]/g, '');
    }
    return Array.from(new Set(parts)).slice(0, 2).join(' / ');
  })();

  const shapeSummary =
    BUTTON_SHAPE_OPTIONS.find((s) => s.value === currentShape)?.label || 'Rounded';

  const buttonColorHex = (currentButtonColors?.bg || effectiveTokens.buttonBg).toUpperCase();

  const layoutBtnStyle = currentLayout?.buttonStyle || DEFAULT_LAYOUT_SETTINGS.buttonStyle;
  const layoutSummary = `${layoutBtnStyle.charAt(0).toUpperCase()}${layoutBtnStyle.slice(1)}, ${
    (currentLayout?.headerAlign || DEFAULT_LAYOUT_SETTINGS.headerAlign) === 'left'
      ? 'Left-aligned'
      : 'Centered'
  }`;

  const backgroundPreviewSwatchStyle: React.CSSProperties = (() => {
    const bg = session.background;
    if (!bg || bg.type === 'none') {
      return { backgroundColor: '#FFFFFF' };
    }
    if (bg.type === 'solid' && bg.value) {
      return { backgroundColor: bg.value };
    }
    if (
      (bg.type === 'gradient' || bg.type === 'mesh') &&
      bg.gradientStops &&
      bg.gradientStops.length >= 2
    ) {
      return {
        backgroundImage: `linear-gradient(135deg, ${bg.gradientStops[0]}, ${bg.gradientStops[1]})`,
      };
    }
    if (bg.type === 'image' && bg.value) {
      return {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return { backgroundColor: bg.value || activeVibe.tokens.bg };
  })();

  const sections: {
    id: AppearanceSection;
    label: string;
    summary: string;
    infoText: string;
    icon: React.ReactNode;
    swatch: React.ReactNode;
  }[] = [
    {
      id: 'vibe',
      label: 'Vibe',
      summary: activeVibe.name,
      infoText: 'Choose a cohesive color palette and personality for your entire profile.',
      icon: <Sparkles size={20} strokeWidth={1.5} />,
      swatch: (
        <div className="flex items-center -space-x-1.5 shrink-0" aria-hidden="true">
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
      label: 'Background',
      summary: backgroundSummary,
      infoText:
        'Personalize your backdrop with Pure White, solid colors, custom gradients, presets, textures, or uploaded photos.',
      icon: <ImageIcon size={20} strokeWidth={1.5} />,
      swatch: (
        <span
          className="w-7 h-7 rounded-[8px] border border-border shrink-0"
          style={backgroundPreviewSwatchStyle}
          aria-hidden="true"
        />
      ),
    },
    {
      id: 'fonts',
      label: 'Typography',
      summary: fontsSummary,
      infoText: 'Customize typefaces for your display name, bio, and link buttons.',
      icon: <Type size={20} strokeWidth={1.5} />,
      swatch: (
        <span
          className="w-7 h-7 rounded-[8px] border border-border bg-surface-2 flex items-center justify-center text-[13px] font-semibold text-ink shrink-0"
          style={{
            fontFamily: getFontCssFamily(currentFonts?.nameFont, activeVibe.fontFamily),
          }}
          aria-hidden="true"
        >
          Aa
        </span>
      ),
    },
    {
      id: 'buttons',
      label: 'Buttons',
      summary: `${shapeSummary}, ${buttonColorHex}`,
      infoText:
        'Set link button curvature (Square, Rounded, Pill) and customize fill, text, and border colors.',
      icon: <RectangleHorizontal size={20} strokeWidth={1.5} />,
      swatch: (
        <span
          className="w-10 h-5 flex items-center justify-center shrink-0"
          style={{
            backgroundColor: effectiveTokens.buttonBg,
            borderRadius:
              currentShape === 'square' ? '2px' : currentShape === 'pill' ? '999px' : '6px',
            border: effectiveTokens.buttonBorder
              ? `1px solid ${effectiveTokens.buttonBorder}`
              : '1px solid rgba(0,0,0,0.1)',
          }}
          aria-hidden="true"
        />
      ),
    },
    {
      id: 'layout',
      label: 'Layout & effects',
      summary: layoutSummary,
      infoText:
        'Adjust avatar frame shape, header alignment, button finish, link spacing, and page width.',
      icon: <Layers size={20} strokeWidth={1.5} />,
      swatch: (
        <div
          className="w-7 h-7 rounded-[8px] border border-border bg-surface-2 flex flex-col items-center justify-center gap-0.5 px-1.5 shrink-0"
          aria-hidden="true"
        >
          <span className="w-3.5 h-0.5 rounded-full bg-ink/70" />
          <span className="w-4 h-0.5 rounded-full bg-ink/40" />
          <span className="w-3 h-0.5 rounded-full bg-ink/40" />
        </div>
      ),
    },
  ];

  const brandingHidden = Boolean(
    session.isPro && (session.hideIveoFooter || session.hideIvioFooter)
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
          Appearance
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          Customize how your iveo page looks to visitors.
        </p>
      </div>

      {/* Mobile/Tablet compact live preview (<lg only) */}
      {mobilePhonePreview && (
        <div className="lg:hidden rounded-[16px] border border-border bg-surface-2/60 py-3 px-4 flex flex-col items-center justify-center">
          {mobilePhonePreview}
        </div>
      )}

      {/* Single-screen 5-section accordion */}
      <Card className="p-0 sm:p-0 overflow-hidden divide-y divide-divider">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          const isInfoOpen = openInfoId === section.id;

          return (
            <div key={section.id} className="flex flex-col">
              <div className="relative min-h-[72px] px-4 py-3 flex items-center justify-between gap-2.5 hover:bg-surface-2/50 transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setOpenInfoId(null);
                    setOpenSection((prev) => {
                      const next = prev === section.id ? null : section.id;
                      if (prev === 'background' && next !== 'background') {
                        onPreviewBackgroundChange?.(null);
                      }
                      return next;
                    });
                  }}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${section.label}`}
                  className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ink"
                />

                <div className="relative z-10 pointer-events-none flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0">
                    {section.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[15px] font-semibold text-ink leading-snug">
                        {section.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenInfoId((prev) => (prev === section.id ? null : section.id))
                        }
                        aria-label={`About ${section.label}`}
                        aria-expanded={isInfoOpen}
                        className="pointer-events-auto w-7 h-7 inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
                      >
                        <Info size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                    <p className="text-[13px] text-muted leading-snug truncate">
                      {section.summary}
                    </p>
                  </div>
                </div>

                <div className="relative z-10 pointer-events-none flex items-center gap-2.5 shrink-0">
                  {section.swatch}
                  <ChevronDown
                    size={18}
                    strokeWidth={1.5}
                    className={`text-muted transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>
              </div>

              {isInfoOpen && (
                <div
                  role="region"
                  aria-label={`${section.label} info`}
                  className="px-4 py-3 bg-surface-2/70 border-t border-divider flex items-start justify-between gap-3 text-[13px] text-muted"
                >
                  <p className="leading-relaxed">{section.infoText}</p>
                  <button
                    type="button"
                    onClick={() => setOpenInfoId(null)}
                    aria-label="Close info"
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {isOpen && (
                <div className="px-4 py-4 sm:px-5 sm:py-5 border-t border-divider bg-surface-2/25 flex flex-col gap-4">
                  {section.id === 'vibe' && (
                    <VibeTileGroup
                      selectedVibeId={currentVibeId}
                      onSelect={handleSelectVibe}
                      isPro={session.isPro}
                      onProBlocked={() => openUpgrade('pro_vibes')}
                    />
                  )}

                  {section.id === 'background' && (
                    <BackgroundSelectorCard
                      embedded
                      currentBackground={session.background}
                      vibe={activeVibe}
                      isPro={session.isPro}
                      username={session.username}
                      userId={session.userId}
                      primaryEmail={session.primaryEmail}
                      onBackgroundChange={handleBackgroundChange}
                      onPreviewBackgroundChange={onPreviewBackgroundChange}
                    />
                  )}

                  {section.id === 'fonts' && (
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
                  )}

                  {section.id === 'buttons' && (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="text-[15px] font-semibold text-ink">Button shape</h3>
                          <p className="text-[13px] text-muted mt-0.5">
                            Choose corner curvature for links and social buttons.
                          </p>
                        </div>

                        <div className="max-w-[360px] w-full">
                          <SegmentedControl<ButtonShape>
                            options={BUTTON_SHAPE_OPTIONS}
                            value={currentShape}
                            onChange={handleSelectShape}
                            ariaLabel="Button shape"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          {(
                            [
                              { id: 'square', label: 'Square', radius: '0px' },
                              { id: 'rounded', label: 'Rounded', radius: '12px' },
                              { id: 'pill', label: 'Pill', radius: '999px' },
                            ] as const
                          ).map((item) => {
                            const selected = currentShape === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectShape(item.id)}
                                className={`p-3 rounded-[12px] border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                                  selected
                                    ? 'border-ink bg-surface ring-1 ring-ink'
                                    : 'border-border bg-surface hover:border-border-strong'
                                }`}
                              >
                                <div
                                  className="w-full h-9 flex items-center justify-center text-[12px] font-medium"
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
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-divider">
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
                      </div>
                    </div>
                  )}

                  {section.id === 'layout' && (
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
                  )}

                  <div className="pt-2 border-t border-divider flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleResetSection(section.id)}
                      className="min-h-[36px] text-[13px] font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                    >
                      Reset to default
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (section.id === 'background') onPreviewBackgroundChange?.(null);
                        setOpenSection(null);
                      }}
                      className="min-h-[36px] px-3 rounded-[10px] text-[13px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
                    >
                      Collapse
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Page Footer Branding Toggle (moved here from Settings) */}
      <Card className="p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium text-ink">
              Remove iveo branding
            </span>
            {!session.isPro && <ProBadge locked />}
          </div>
          <p className="text-[13px] text-muted mt-0.5">
            Hides the iveo mark in your page footer. The report link always stays.
          </p>
        </div>

        <Toggle
          checked={brandingHidden}
          onChange={handleFooterMarkToggle}
          ariaLabel="Remove iveo branding"
          locked={!session.isPro}
        />
      </Card>
    </div>
  );
};

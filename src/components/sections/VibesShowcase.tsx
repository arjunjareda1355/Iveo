import React, { useState, useRef } from 'react';
import { Check } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { VibePhone } from '../phone/VibePhone';
import { VIBES, Vibe } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';
import { cn } from '../../lib/cn';

type ButtonShape = 'Square' | 'Rounded' | 'Pill';

const BUTTON_RADIUS_MAP: Record<ButtonShape, number> = {
  Square: 0,
  Rounded: 12,
  Pill: 999,
};

export const VibesShowcase: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: contentRef, style: contentStyle } = useReveal({ staggerIndex: 1 });

  // Default to Midnight
  const [selectedVibeId, setSelectedVibeId] = useState<string>('midnight');
  const selectedVibe = VIBES.find((v) => v.id === selectedVibeId) || VIBES[1];

  const [buttonShape, setButtonShape] = useState<ButtonShape>(selectedVibe.nativeShape);

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSelectVibe = (vibe: Vibe) => {
    setSelectedVibeId(vibe.id);
    setButtonShape(vibe.nativeShape);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % VIBES.length;
      handleSelectVibe(VIBES[nextIndex]);
      rowRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + VIBES.length) % VIBES.length;
      handleSelectVibe(VIBES[prevIndex]);
      rowRefs.current[prevIndex]?.focus();
    }
  };

  return (
    <section
      id="vibes"
      aria-label="Vibes"
      className="w-full bg-bg py-14 sm:py-20 lg:py-24 border-b border-border"
    >
      <Container>
        {/* Header */}
        <div ref={headerRef} style={headerStyle}>
          <SectionHeader
            eyebrow={copy.vibesShowcase.eyebrow}
            heading={
              <>
                {copy.vibesShowcase.headingPrefix}{' '}
                <em className="accent-phrase">{copy.vibesShowcase.headingAccent}</em>
              </>
            }
            lead={copy.vibesShowcase.lead}
          />
        </div>

        {/* Content Container */}
        <div ref={contentRef} style={contentStyle} className="mt-8 sm:mt-12">
          {/* Mobile phone & controls on top, then scrolling chips below */}
          <div className="flex flex-col lg:hidden items-center">
            {/* Phone (320px) */}
            <VibePhone
              currentVibe={selectedVibe}
              width={320}
              buttonRadiusOverride={BUTTON_RADIUS_MAP[buttonShape]}
            />

            {/* Control Strip */}
            <div className="mt-7 w-full max-w-[320px] flex flex-col items-center">
              <span className="text-[13px] text-muted mb-2 select-none self-start">
                {copy.vibesShowcase.buttonShapeLabel}
              </span>
              <SegmentedControl
                options={copy.vibesShowcase.buttonShapes}
                value={buttonShape}
                onChange={(val) => setButtonShape(val as ButtonShape)}
                ariaLabel="Change button shape"
              />
              <span className="mt-3 text-[13px] text-muted select-none text-center">
                {copy.vibesShowcase.customizationNote}
              </span>
            </div>

            {/* Mobile horizontal scrolling chips */}
            <div
              role="radiogroup"
              aria-label="Select vibe"
              className="w-screen -mx-6 px-6 mt-8 flex items-center gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {VIBES.map((vibe) => {
                const isSelected = vibe.id === selectedVibeId;
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectVibe(vibe)}
                    className={cn(
                      'h-10 px-4 rounded-full text-[14px] font-medium shrink-0 snap-start transition-colors duration-120 border focus-visible:outline-2 focus-visible:outline-ink cursor-pointer',
                      isSelected
                        ? 'bg-ink text-white border-ink'
                        : 'bg-surface text-ink border-border-strong hover:bg-surface-2'
                    )}
                  >
                    {vibe.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop 2-column layout (1024px and up): 5 cols left, 7 cols right */}
          <div className="hidden lg:grid grid-cols-12 gap-8 items-start">
            {/* Left Column (5 of 12): Vibe radiogroup list */}
            <div
              role="radiogroup"
              aria-label="Vibe styles"
              className="col-span-5 flex flex-col gap-2"
            >
              {VIBES.map((vibe, index) => {
                const isSelected = vibe.id === selectedVibeId;
                return (
                  <div
                    key={vibe.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectVibe(vibe)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={cn(
                      'h-[72px] rounded-[14px] px-5 flex items-center justify-between cursor-pointer select-none transition-all duration-120 focus-visible:outline-2 focus-visible:outline-ink',
                      isSelected
                        ? 'bg-surface border border-ink shadow-[0_1px_2px_rgba(10,10,10,0.04)]'
                        : 'bg-transparent border border-transparent hover:bg-surface hover:border-border'
                    )}
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[16px] font-medium text-ink leading-tight">
                        {vibe.name}
                      </span>
                      <span className="text-[14px] text-muted mt-0.5 leading-tight">
                        {vibe.description}
                      </span>
                    </div>

                    {isSelected && (
                      <span className="shrink-0 text-ink ml-3" aria-hidden="true">
                        <Check size={16} strokeWidth={2} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Column (7 of 12): Phone (320px) and control strip */}
            <div className="col-span-7 flex flex-col items-center justify-center">
              <VibePhone
                currentVibe={selectedVibe}
                width={320}
                buttonRadiusOverride={BUTTON_RADIUS_MAP[buttonShape]}
              />

              {/* Control Strip */}
              <div className="mt-7 w-full max-w-[320px] flex flex-col items-center">
                <span className="text-[13px] text-muted mb-2 select-none self-start">
                  {copy.vibesShowcase.buttonShapeLabel}
                </span>
                <SegmentedControl
                  options={copy.vibesShowcase.buttonShapes}
                  value={buttonShape}
                  onChange={(val) => setButtonShape(val as ButtonShape)}
                  ariaLabel="Change button shape"
                />
                <span className="mt-3 text-[13px] text-muted select-none text-center">
                  {copy.vibesShowcase.customizationNote}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

import React, { useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';
import { Container } from '../ui/Container';
import { ClaimForm } from '../ClaimForm';
import { VibePhone } from '../phone/VibePhone';
import { VIBES, Vibe } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { useInterval } from '../../hooks/useInterval';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';

const HERO_VIBES: Vibe[] = [
  VIBES.find((v) => v.id === 'clean')!,
  VIBES.find((v) => v.id === 'midnight')!,
  VIBES.find((v) => v.id === 'paper')!,
  VIBES.find((v) => v.id === 'sage')!,
];

export const Hero: React.FC = () => {
  const [currentVibeIndex, setCurrentVibeIndex] = useState(0);
  const [isHoveredOrFocused, setIsHoveredOrFocused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Auto-cycle through the 4 vibes every 5 seconds, unless paused or reduced motion is active
  useInterval(
    () => {
      if (!userInteracted) {
        setCurrentVibeIndex((prev) => (prev + 1) % HERO_VIBES.length);
      }
    },
    5000,
    isHoveredOrFocused || prefersReducedMotion || userInteracted
  );

  const currentVibe = HERO_VIBES[currentVibeIndex];

  const handleSelectVibe = (idx: number) => {
    setCurrentVibeIndex(idx);
    setUserInteracted(true);
  };

  return (
    <section
      aria-label="Hero"
      className="relative pt-[72px] pb-[96px] overflow-hidden"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column (7 of 12) */}
          <div className="lg:col-span-7 flex flex-col items-start z-10">
            {/* H1 Display: 3 lines on desktop */}
            <h1 className="text-[clamp(2.5rem,1.6rem+4vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-ink max-w-[12ch] sm:max-w-[14ch]">
              {copy.hero.headingPart1}
              <br />
              {copy.hero.headingPart2}
              <br />
              <em className="accent-phrase">{copy.hero.headingAccent}</em>
            </h1>

            {/* Lead paragraph */}
            <p className="mt-5 text-[clamp(1.0625rem,1rem+0.3vw,1.25rem)] font-normal leading-[1.55] tracking-[-0.005em] text-muted max-w-[46ch]">
              {copy.hero.lead}
            </p>

            {/* Claim Form */}
            <div className="mt-8 w-full">
              <ClaimForm tone="light" />
            </div>

            {/* Assurance Row */}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted">
              {copy.hero.assurances.map((assurance, idx) => (
                <div key={idx} className="flex items-center gap-1.5 shrink-0">
                  <Check size={16} strokeWidth={2} className="text-ink shrink-0" />
                  <span>{assurance}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (5 of 12): Phone mockup and surroundings */}
          <div
            className="lg:col-span-5 flex flex-col items-center justify-center relative mt-6 lg:mt-0"
            onMouseEnter={() => setIsHoveredOrFocused(true)}
            onMouseLeave={() => setIsHoveredOrFocused(false)}
            onFocus={() => setIsHoveredOrFocused(true)}
            onBlur={() => setIsHoveredOrFocused(false)}
          >
            {/* Backdrop Grid Field (560px wide, 48px grid, masked radial fade) */}
            <div
              className="hero-grid-pattern absolute -top-10 -bottom-10 -left-16 -right-16 w-[560px] h-[640px] pointer-events-none -z-10"
              aria-hidden="true"
            />

            {/* Phone container with floating chips */}
            <div className="relative">
              {/* Top-Left Floating Chip: hidden below 480px */}
              <div
                className="hidden min-[480px]:flex items-center gap-2 absolute -top-3 -left-6 z-20 bg-surface px-3 py-2 rounded-[10px] border border-border shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] text-[13px] font-mono text-ink select-none"
                aria-hidden="true"
              >
                <LinkIcon size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
                <span>{copy.hero.floatingChipTop}</span>
              </div>

              {/* Vibe Phone at 300px width */}
              <VibePhone
                currentVibe={currentVibe}
                width={300}
                className="z-10"
              />

              {/* Bottom-Right Floating Chip: hidden below 480px */}
              <div
                className="hidden min-[480px]:flex items-center gap-2 absolute -bottom-3 -right-6 z-20 bg-surface px-3 py-2 rounded-[10px] border border-border shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] text-[13px] text-ink select-none"
                aria-hidden="true"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ink shrink-0" />
                <span>{copy.hero.floatingChipBottom}</span>
              </div>
            </div>

            {/* Vibe selection dots and live region */}
            <div className="mt-6 flex items-center gap-4">
              <div
                role="radiogroup"
                aria-label="Vibe preview selection"
                className="flex items-center gap-1.5"
              >
                {HERO_VIBES.map((vibe, idx) => {
                  const isSelected = idx === currentVibeIndex;
                  return (
                    <button
                      key={vibe.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Show ${vibe.name} vibe`}
                      onClick={() => handleSelectVibe(idx)}
                      className="w-6 h-6 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-ink rounded-full cursor-pointer"
                    >
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full transition-colors duration-200',
                          isSelected ? 'bg-ink' : 'bg-border-strong hover:bg-muted'
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div
                role="status"
                aria-live="polite"
                className="font-mono text-[13px] text-muted select-none min-w-[100px]"
              >
                Vibe: <span className="text-ink font-medium">{currentVibe.name}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

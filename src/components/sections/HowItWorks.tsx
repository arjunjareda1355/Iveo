import React from 'react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';
import { ClaimNameAnimation } from '../landing/animations/ClaimNameAnimation';
import { AddLinksAnimation } from '../landing/animations/AddLinksAnimation';
import { ChooseVibeAnimation } from '../landing/animations/ChooseVibeAnimation';

export const HowItWorks: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: c1Ref, style: c1Style } = useReveal({ staggerIndex: 0 });
  const { ref: c2Ref, style: c2Style } = useReveal({ staggerIndex: 1 });
  const { ref: c3Ref, style: c3Style } = useReveal({ staggerIndex: 2 });

  return (
    <section
      id="how"
      aria-label="How it works"
      className="w-full bg-surface py-14 sm:py-20 lg:py-24 border-b border-border"
    >
      <Container>
        {/* Section Header */}
        <div ref={headerRef} style={headerStyle}>
          <SectionHeader
            eyebrow={copy.howItWorks.eyebrow}
            heading={copy.howItWorks.heading}
            lead={copy.howItWorks.lead}
          />
        </div>

        {/* Cards Row */}
        <div className="relative mt-8 sm:mt-12">
          {/* Decorative hairline behind cards at step number level on desktop */}
          <div
            className="hidden md:block absolute top-[216px] left-0 right-0 h-px bg-border -z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {/* Step 1 */}
            <div
              ref={c1Ref}
              style={c1Style}
              className="bg-surface border border-border rounded-[14px] p-6 flex flex-col"
            >
              {/* Visual well */}
              <ClaimNameAnimation />

              {/* Text content */}
              <div className="mt-6 flex flex-col">
                <span className="font-mono text-[12px] font-medium text-muted uppercase">
                  {copy.howItWorks.steps[0].number}
                </span>
                <h3 className="mt-2 text-[20px] font-semibold text-ink leading-tight">
                  {copy.howItWorks.steps[0].title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[36ch]">
                  {copy.howItWorks.steps[0].body}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div
              ref={c2Ref}
              style={c2Style}
              className="bg-surface border border-border rounded-[14px] p-6 flex flex-col"
            >
              {/* Visual well */}
              <AddLinksAnimation />

              {/* Text content */}
              <div className="mt-6 flex flex-col">
                <span className="font-mono text-[12px] font-medium text-muted uppercase">
                  {copy.howItWorks.steps[1].number}
                </span>
                <h3 className="mt-2 text-[20px] font-semibold text-ink leading-tight">
                  {copy.howItWorks.steps[1].title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[36ch]">
                  {copy.howItWorks.steps[1].body}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div
              ref={c3Ref}
              style={c3Style}
              className="bg-surface border border-border rounded-[14px] p-6 flex flex-col"
            >
              {/* Visual well: 4 mini vibe tiles */}
              <ChooseVibeAnimation />

              {/* Text content */}
              <div className="mt-6 flex flex-col">
                <span className="font-mono text-[12px] font-medium text-muted uppercase">
                  {copy.howItWorks.steps[2].number}
                </span>
                <h3 className="mt-2 text-[20px] font-semibold text-ink leading-tight">
                  {copy.howItWorks.steps[2].title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[36ch]">
                  {copy.howItWorks.steps[2].body}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

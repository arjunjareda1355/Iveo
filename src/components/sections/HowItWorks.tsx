import React from 'react';
import { Check, GripVertical } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';

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
              <div className="bg-surface-2 border border-border rounded-[10px] h-[168px] p-4 flex flex-col items-center justify-center overflow-hidden">
                <div className="w-full max-w-[210px] h-10 rounded-[10px] bg-white border border-border-strong px-3 flex items-center justify-between shadow-xs">
                  <span className="font-mono text-[14px] text-ink truncate">
                    iveo.site/maya
                  </span>
                  <Check size={16} strokeWidth={2} className="text-ink shrink-0 ml-1.5" />
                </div>
                <span className="mt-2 text-[12px] text-muted select-none">
                  Available
                </span>
              </div>

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
              <div className="bg-surface-2 border border-border rounded-[10px] h-[168px] p-3 flex flex-col justify-center gap-2 overflow-hidden">
                {/* Row 1 */}
                <div className="h-9 w-full rounded-[8px] bg-white border border-border px-2.5 flex items-center gap-2">
                  <GripVertical size={14} className="text-subtle shrink-0" />
                  <span className="text-[13px] font-medium text-ink truncate">
                    Portfolio
                  </span>
                </div>

                {/* Row 2: Lifted */}
                <div className="h-9 w-full rounded-[8px] bg-white border border-border-strong px-2.5 flex items-center gap-2 shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] translate-x-1.5">
                  <GripVertical size={14} className="text-ink shrink-0" />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    Shop prints
                  </span>
                </div>

                {/* Row 3 */}
                <div className="h-9 w-full rounded-[8px] bg-white border border-border px-2.5 flex items-center gap-2">
                  <GripVertical size={14} className="text-subtle shrink-0" />
                  <span className="text-[13px] font-medium text-ink truncate">
                    Newsletter
                  </span>
                </div>
              </div>

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
              <div className="bg-surface-2 border border-border rounded-[10px] h-[168px] p-3 flex items-center justify-center gap-2 overflow-hidden">
                {/* Tile 1: Clean */}
                <div className="w-14 h-[72px] rounded-[8px] border border-border bg-white flex flex-col items-center justify-center p-1.5 gap-1 shrink-0">
                  <div className="w-4 h-4 rounded-full bg-[#F0F0F0]" />
                  <div className="w-9 h-1.5 bg-[#0A0A0A] rounded-[2px]" />
                  <div className="w-9 h-1.5 bg-[#0A0A0A] rounded-[2px]" />
                </div>

                {/* Tile 2: Midnight (selected with 2px ink outline & 2px offset) */}
                <div className="w-14 h-[72px] rounded-[8px] border border-[#2A2A2D] bg-[#0B0B0C] flex flex-col items-center justify-center p-1.5 gap-1 shrink-0 outline-2 outline-ink outline-offset-2">
                  <div className="w-4 h-4 rounded-full bg-[#1F1F22]" />
                  <div className="w-9 h-1.5 bg-[#1C1C1E] rounded-[2px]" />
                  <div className="w-9 h-1.5 bg-[#1C1C1E] rounded-[2px]" />
                </div>

                {/* Tile 3: Paper */}
                <div className="w-14 h-[72px] rounded-[8px] border border-[#D5C9B3] bg-[#F6F1E7] flex flex-col items-center justify-center p-1.5 gap-1 shrink-0">
                  <div className="w-4 h-4 rounded-full bg-[#E9E1D0]" />
                  <div className="w-9 h-1.5 bg-[#FFFDF8] border border-[#2B2A28] rounded-[1px]" />
                  <div className="w-9 h-1.5 bg-[#FFFDF8] border border-[#2B2A28] rounded-[1px]" />
                </div>

                {/* Tile 4: Sage */}
                <div className="w-14 h-[72px] rounded-[8px] border border-[#CCD8CA] bg-[#E8EDE6] flex flex-col items-center justify-center p-1.5 gap-1 shrink-0">
                  <div className="w-4 h-4 rounded-full bg-[#D3DDD0]" />
                  <div className="w-9 h-1.5 border border-[#1F2A22] rounded-full" />
                  <div className="w-9 h-1.5 border border-[#1F2A22] rounded-full" />
                </div>
              </div>

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

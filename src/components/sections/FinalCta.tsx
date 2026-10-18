import React from 'react';
import { Container } from '../ui/Container';
import { ClaimForm } from '../ClaimForm';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';

export const FinalCta: React.FC = () => {
  const { ref, style } = useReveal();

  return (
    <section
      aria-label="Call to action"
      className="w-full bg-[#0A0A0A] text-[#FAFAFA] py-20 lg:py-28 text-center"
    >
      <Container>
        <div
          ref={ref}
          style={style}
          className="flex flex-col items-center justify-center"
        >
          {/* Centered H2 */}
          <h2 className="text-[clamp(2.25rem,1.5rem+3vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[#FAFAFA] max-w-[14ch]">
            {copy.finalCta.heading}
          </h2>

          {/* Lead */}
          <p className="mt-4 text-[clamp(1.0625rem,1rem+0.3vw,1.25rem)] text-[#A3A3A3] max-w-[44ch] leading-relaxed">
            {copy.finalCta.lead}
          </p>

          {/* Dark ClaimForm */}
          <div className="mt-8 w-full flex justify-center">
            <ClaimForm tone="dark" centerStatus />
          </div>

          {/* Microcopy below status line */}
          <div className="mt-3 text-[14px] text-[#A3A3A3] select-none">
            {copy.finalCta.assurance}
          </div>
        </div>
      </Container>
    </section>
  );
};

import React from 'react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';

// Confirm these claims with the real product before launch.

export const Principles: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: colsRef, style: colsStyle } = useReveal({ staggerIndex: 1 });

  return (
    <section
      aria-label="Principles"
      className="w-full bg-[#0A0A0A] text-[#FAFAFA] py-14 sm:py-20 lg:py-24"
    >
      <Container>
        {/* Left-aligned Header */}
        <div ref={headerRef} style={headerStyle}>
          <SectionHeader
            tone="dark"
            eyebrow={copy.principles.eyebrow}
            heading={copy.principles.heading}
          />
        </div>

        {/* Three Columns separated by 1px #262626 lines */}
        <div
          ref={colsRef}
          style={colsStyle}
          className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#262626]"
        >
          {copy.principles.items.map((item, idx) => (
            <div
              key={idx}
              className={`flex flex-col py-6 md:py-0 ${
                idx === 0
                  ? 'md:pr-10'
                  : idx === 1
                  ? 'md:px-10'
                  : 'md:pl-10'
              }`}
            >
              <span className="font-mono text-[13px] text-[#A3A3A3] uppercase select-none">
                {item.number}
              </span>
              <h3 className="mt-3 text-[20px] font-semibold text-[#FAFAFA] leading-tight">
                {item.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#A3A3A3] max-w-[34ch]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};

import React from 'react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { Accordion, AccordionItem } from '../ui/Accordion';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';

export const Faq: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: accordionRef, style: accordionStyle } = useReveal({ staggerIndex: 1 });

  // Map FAQ items and render mailto links for help@ivio.site
  const faqItems: AccordionItem[] = copy.faq.items.map((item) => {
    if (item.answer.includes('help@ivio.site')) {
      const parts = item.answer.split('help@ivio.site');
      return {
        question: item.question,
        answer: (
          <span>
            {parts[0]}
            <a
              href="mailto:help@ivio.site"
              className="text-ink underline underline-offset-[3px] hover:text-ink-2 font-medium"
            >
              help@ivio.site
            </a>
            {parts[1]}
          </span>
        ),
      };
    }

    return {
      question: item.question,
      answer: item.answer,
    };
  });

  return (
    <section
      id="faq"
      aria-label="FAQ"
      className="w-full bg-surface py-14 sm:py-20 lg:py-24 border-b border-border"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: sticky header on desktop */}
          <div
            ref={headerRef}
            style={headerStyle}
            className="lg:col-span-4 lg:sticky lg:top-24 self-start"
          >
            <SectionHeader
              eyebrow={copy.faq.eyebrow}
              heading={copy.faq.heading}
            />
            <p className="mt-4 text-[15px] leading-relaxed text-muted max-w-[36ch]">
              {copy.faq.leadPrefix}{' '}
              <a
                href="mailto:help@ivio.site"
                className="text-ink underline underline-offset-[3px] hover:text-ink-2 font-medium"
              >
                help@ivio.site
              </a>{' '}
              {copy.faq.leadSuffix}
            </p>
          </div>

          {/* Right Column: Accordion */}
          <div ref={accordionRef} style={accordionStyle} className="lg:col-span-8">
            <Accordion items={faqItems} defaultOpenIndex={0} />
          </div>
        </div>
      </Container>
    </section>
  );
};

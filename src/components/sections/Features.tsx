import React from 'react';
import { Check } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';
import { LinksArrangedAnimation } from '../landing/animations/LinksArrangedAnimation';
import { LivePreviewAnimation } from '../landing/animations/LivePreviewAnimation';
import { ScheduleLinksAnimation } from '../landing/animations/ScheduleLinksAnimation';
import { EmbedAnimation } from '../landing/animations/EmbedAnimation';
import { QrAnimation } from '../landing/animations/QrAnimation';
import { AnalyticsAnimation } from '../landing/animations/AnalyticsAnimation';
import { CollectAnimation } from '../landing/animations/CollectAnimation';

export const Features: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: bentoRef, style: bentoStyle } = useReveal({ staggerIndex: 1 });
  const { ref: andAlsoRef, style: andAlsoStyle } = useReveal({ staggerIndex: 2 });

  return (
    <section
      id="features"
      aria-label="Features"
      className="w-full bg-surface py-14 sm:py-20 lg:py-24 border-b border-border"
    >
      <Container>
        {/* Section Header */}
        <div ref={headerRef} style={headerStyle}>
          <SectionHeader
            eyebrow={copy.features.eyebrow}
            heading={copy.features.heading}
            lead={copy.features.lead}
          />
        </div>

        {/* Bento Grid */}
        <div
          ref={bentoRef}
          style={bentoStyle}
          className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4"
        >
          {/* Row 1, Card 1: Links, arranged by hand (span 4 on desktop, span 2 on tablet) */}
          <Card className="lg:col-span-4 sm:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
            <div className="flex flex-col max-w-[320px]">
              <h3 className="text-[20px] font-semibold text-ink leading-tight">
                {copy.features.cards.links.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.links.body}
              </p>
            </div>

            {/* Visual: stack of 4 mini link rows with on/off toggle */}
            <div className="w-full md:w-[260px] shrink-0">
              <LinksArrangedAnimation />
            </div>
          </Card>

          {/* Row 1, Card 2: See it as you edit (span 2 on desktop, span 1 on tablet) */}
          <Card className="lg:col-span-2 sm:col-span-1 flex flex-col justify-between overflow-hidden relative pb-0">
            <div className="flex flex-col mb-4">
              <h3 className="text-[20px] font-semibold text-ink leading-tight">
                {copy.features.cards.preview.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.preview.body}
              </p>
            </div>

            {/* Visual: animated phone mockup preview */}
            <div className="w-full flex justify-center -mb-1 mt-2">
              <LivePreviewAnimation />
            </div>
          </Card>

          {/* Row 2, Card 1: Schedule links (span 2) */}
          <Card className="lg:col-span-2 sm:col-span-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-ink leading-tight">
                  {copy.features.cards.schedule.title}
                </h3>
                <Badge variant="pro">Pro</Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.schedule.body}
              </p>
            </div>

            {/* Visual: mini month grid */}
            <ScheduleLinksAnimation />
          </Card>

          {/* Row 2, Card 2: Embed what you make (span 2) */}
          <Card className="lg:col-span-2 sm:col-span-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-ink leading-tight">
                  {copy.features.cards.embed.title}
                </h3>
                <Badge variant="pro">Pro</Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.embed.body}
              </p>
            </div>

            {/* Visual: 3 stacked rounded rectangles hinting at media players */}
            <EmbedAnimation />
          </Card>

          {/* Row 2, Card 3: A QR code for every page (span 2) */}
          <Card className="lg:col-span-2 sm:col-span-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col">
              <h3 className="text-[20px] font-semibold text-ink leading-tight">
                {copy.features.cards.qr.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.qr.body}
              </p>
            </div>

            {/* Visual: animated SVG QR code card */}
            <QrAnimation />
          </Card>

          {/* Row 3, Card 1: Analytics that stay readable (span 4 on desktop, span 2 on tablet) */}
          <Card className="lg:col-span-4 sm:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
            <div className="flex flex-col max-w-[320px]">
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-ink leading-tight">
                  {copy.features.cards.analytics.title}
                </h3>
                <Badge variant="pro">Pro</Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.analytics.body}
              </p>
            </div>

            {/* Visual: animated analytics chart */}
            <div className="w-full md:w-[280px] shrink-0">
              <AnalyticsAnimation />
            </div>
          </Card>

          {/* Row 3, Card 2: Collect emails and numbers (span 2) */}
          <Card className="lg:col-span-2 sm:col-span-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-ink leading-tight">
                  {copy.features.cards.contacts.title}
                </h3>
                <Badge variant="pro">Pro</Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {copy.features.cards.contacts.body}
              </p>
            </div>

            {/* Visual: email field and small Subscribe button */}
            <CollectAnimation />
          </Card>
        </div>

        {/* And also list */}
        <div ref={andAlsoRef} style={andAlsoStyle} className="mt-10 pt-8 border-t border-border">
          <span className="font-mono text-[13px] text-muted uppercase tracking-[0.08em] select-none block mb-4">
            {copy.features.andAlso.eyebrow}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-8">
            {copy.features.andAlso.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[15px] text-ink-2">
                <Check size={16} strokeWidth={2} className="text-ink shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
};

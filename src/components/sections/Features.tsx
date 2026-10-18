import React from 'react';
import { Check, GripVertical, Play } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { PhoneFrame } from '../phone/PhoneFrame';
import { PhonePage } from '../phone/PhonePage';
import { VIBES } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';

export const Features: React.FC = () => {
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: bentoRef, style: bentoStyle } = useReveal({ staggerIndex: 1 });
  const { ref: andAlsoRef, style: andAlsoStyle } = useReveal({ staggerIndex: 2 });

  const cleanVibe = VIBES.find((v) => v.id === 'clean')!;

  // 14 sample values for the analytics bar chart
  const barHeights = [28, 36, 32, 45, 52, 40, 60, 55, 68, 72, 64, 80, 75, 96];

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
            <div className="w-full md:w-[260px] flex flex-col gap-2 shrink-0 select-none">
              {[
                { title: 'New zine, out now', on: true },
                { title: 'Shop prints', on: true },
                { title: 'Commission waitlist', on: false },
                { title: 'Portfolio', on: true },
              ].map((link, idx) => (
                <div
                  key={idx}
                  className="h-10 w-full rounded-[8px] bg-surface-2 border border-border px-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <GripVertical size={14} className="text-subtle shrink-0" />
                    <span
                      className={`text-[13px] truncate ${
                        link.on ? 'font-medium text-ink' : 'font-normal text-muted'
                      }`}
                    >
                      {link.title}
                    </span>
                  </div>
                  {/* On/Off Pill (28px by 16px) */}
                  <div
                    className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors duration-120 shrink-0 ${
                      link.on ? 'bg-ink justify-end' : 'bg-border-strong justify-start'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </div>
              ))}
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

            {/* Visual: top 55% of 220px PhoneFrame cropped */}
            <div className="w-full flex justify-center overflow-hidden h-[150px] -mb-1 mt-2">
              <div className="translate-y-1">
                <PhoneFrame width={220} vibe={cleanVibe} ariaLabel="Phone preview demo">
                  <PhonePage vibe={cleanVibe} scale={220 / 300} />
                </PhoneFrame>
              </div>
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
            <div className="bg-surface-2 border border-border rounded-[10px] p-3 flex flex-col items-center justify-center select-none">
              <div className="grid grid-cols-7 gap-1 text-[10px] font-mono text-muted mb-1 text-center w-full max-w-[168px]">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
              <div className="grid grid-cols-7 gap-1 w-full max-w-[168px]">
                {Array.from({ length: 14 }).map((_, i) => {
                  const isScheduled = i >= 3 && i <= 7;
                  return (
                    <div
                      key={i}
                      className={`h-5 rounded-[4px] flex items-center justify-center text-[10px] font-mono ${
                        isScheduled
                          ? 'bg-ink text-white font-medium'
                          : 'bg-white border border-border text-subtle'
                      }`}
                    >
                      {i + 10}
                    </div>
                  );
                })}
              </div>
            </div>
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
            <div className="bg-surface-2 border border-border rounded-[10px] p-3 flex flex-col gap-2 select-none justify-center">
              {/* 16:9 block with Play icon */}
              <div className="h-16 w-full rounded-[8px] bg-white border border-border flex items-center justify-center text-ink shadow-xs">
                <Play size={18} fill="currentColor" strokeWidth={1.5} />
              </div>
              {/* 56px bar with square */}
              <div className="h-10 w-full rounded-[8px] bg-white border border-border px-2 flex items-center gap-2 shadow-xs">
                <div className="w-6 h-6 rounded-[4px] bg-surface-2 border border-border shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <div className="w-16 h-1.5 bg-ink rounded-full" />
                  <div className="w-10 h-1.5 bg-border-strong rounded-full" />
                </div>
              </div>
              {/* Waveform of 24 bars */}
              <div className="h-6 w-full flex items-center justify-between px-1">
                {[12, 18, 8, 22, 16, 24, 10, 14, 20, 18, 6, 16, 22, 14, 18, 24, 12, 8, 16, 20, 10, 14, 18, 8].map(
                  (h, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${h}px` }}
                      className="w-[3px] bg-ink/80 rounded-full"
                    />
                  )
                )}
              </div>
            </div>
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

            {/* Visual: SVG QR pattern 21x21 modules */}
            <div className="bg-surface-2 border border-border rounded-[10px] p-3 flex items-center justify-center select-none">
              <div className="w-28 h-28 bg-white border border-border rounded-[8px] p-2 flex items-center justify-center shadow-xs">
                <svg
                  viewBox="0 0 21 21"
                  className="w-full h-full text-ink"
                  fill="currentColor"
                  shapeRendering="crispEdges"
                >
                  {/* Top-left corner finder */}
                  <rect x="0" y="0" width="7" height="7" />
                  <rect x="1" y="1" width="5" height="5" fill="white" />
                  <rect x="2" y="2" width="3" height="3" />

                  {/* Top-right corner finder */}
                  <rect x="14" y="0" width="7" height="7" />
                  <rect x="15" y="1" width="5" height="5" fill="white" />
                  <rect x="16" y="2" width="3" height="3" />

                  {/* Bottom-left corner finder */}
                  <rect x="0" y="14" width="7" height="7" />
                  <rect x="1" y="15" width="5" height="5" fill="white" />
                  <rect x="2" y="16" width="3" height="3" />

                  {/* Data modules */}
                  <rect x="8" y="2" width="1" height="3" />
                  <rect x="10" y="0" width="2" height="1" />
                  <rect x="12" y="2" width="1" height="2" />
                  <rect x="8" y="8" width="5" height="1" />
                  <rect x="9" y="10" width="3" height="1" />
                  <rect x="13" y="10" width="1" height="3" />
                  <rect x="15" y="8" width="2" height="2" />
                  <rect x="8" y="14" width="2" height="1" />
                  <rect x="11" y="14" width="2" height="2" />
                  <rect x="10" y="17" width="1" height="3" />
                  <rect x="14" y="15" width="3" height="1" />
                  <rect x="18" y="14" width="2" height="3" />
                  <rect x="16" y="18" width="3" height="2" />
                  <rect x="2" y="9" width="3" height="1" />
                  <rect x="0" y="11" width="2" height="1" />
                </svg>
              </div>
            </div>
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

            {/* Visual: inline SVG chart in a white well */}
            <div className="bg-surface-2 border border-border rounded-[10px] p-4 flex flex-col w-full md:w-[280px] shrink-0 select-none">
              {/* Stat labels above chart in tabular-nums */}
              <div className="flex items-center justify-between text-[12px] font-medium font-sans mb-3 tabular-nums">
                <span className="text-ink">
                  Views <strong className="font-semibold">1,284</strong>
                </span>
                <span className="text-ink">
                  Clicks <strong className="font-semibold">392</strong>
                </span>
                <span className="text-ink">
                  CTR <strong className="font-semibold">30.5%</strong>
                </span>
              </div>

              {/* Chart container */}
              <div className="relative h-20 w-full flex items-end justify-between border-b border-border-strong pt-2">
                {/* Gridlines */}
                <div className="absolute inset-x-0 top-0 h-px bg-border/60" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-border/60" />

                {barHeights.map((h, i) => {
                  const isLatest = i === barHeights.length - 1;
                  return (
                    <div
                      key={i}
                      style={{ height: `${(h / 100) * 100}%` }}
                      className={`w-[11px] rounded-t-[2px] transition-all duration-120 ${
                        isLatest ? 'bg-ink' : 'bg-[#D4D4D4]'
                      }`}
                    />
                  );
                })}
              </div>

              <span className="mt-2 text-[11px] text-muted self-end select-none">
                Sample data
              </span>
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
            <div className="bg-surface-2 border border-border rounded-[10px] p-3 flex flex-col gap-2 select-none" aria-hidden="true">
              <div className="h-10 w-full rounded-[8px] bg-white border border-border-strong px-3 flex items-center text-[13px] text-subtle shadow-xs">
                you@example.com
              </div>
              <div className="h-9 w-full rounded-[8px] bg-ink text-white text-[13px] font-medium flex items-center justify-center shadow-xs">
                Subscribe
              </div>
            </div>
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

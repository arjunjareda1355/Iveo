import React from 'react';
import {
  Palette,
  Music,
  PenLine,
  Ruler,
  Store,
  GraduationCap,
} from 'lucide-react';
import { Container } from '../ui/Container';
import { copy } from '../../content/copy';

const ICONS = [Palette, Music, PenLine, Ruler, Store, GraduationCap];

export const MadeFor: React.FC = () => {
  return (
    <section
      aria-label="Made for"
      className="w-full bg-surface border-y border-border py-5 md:py-0 md:h-16 flex items-center"
    >
      <Container>
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          {/* Label */}
          <span className="font-mono text-[13px] text-muted shrink-0 select-none">
            {copy.madeFor.label}
          </span>

          {/* Desktop items with vertical dividers */}
          <div className="hidden md:flex items-center gap-8">
            {copy.madeFor.items.map((item, index) => {
              const Icon = ICONS[index];
              return (
                <React.Fragment key={item}>
                  {index > 0 && (
                    <div
                      className="w-px h-4 bg-border shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center gap-2 text-[15px] font-medium text-ink-2 select-none">
                    <Icon size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
                    <span>{item}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Mobile 2-column grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:hidden">
            {copy.madeFor.items.map((item, index) => {
              const Icon = ICONS[index];
              return (
                <div
                  key={item}
                  className="flex items-center gap-2 text-[15px] font-medium text-ink-2 select-none"
                >
                  <Icon size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
};

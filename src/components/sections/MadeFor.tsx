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
      className="w-full bg-surface border-y border-border py-5 lg:py-0 lg:h-16 flex items-center"
    >
      <Container>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          {/* Label */}
          <span className="font-mono text-[13px] text-muted shrink-0 select-none">
            {copy.madeFor.label}
          </span>

          {/* Desktop items with vertical dividers */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
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
                  <div className="flex items-center gap-2 text-[15px] font-medium text-ink-2 select-none whitespace-nowrap">
                    <Icon size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
                    <span>{item}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Mobile & Tablet grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 lg:hidden">
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

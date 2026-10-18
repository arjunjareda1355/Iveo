import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface AccordionItem {
  id?: string;
  question: string;
  answer: string | React.ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  defaultOpenIndex?: number;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  defaultOpenIndex = 0,
  className,
}) => {
  const [openIndices, setOpenIndices] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (defaultOpenIndex >= 0 && defaultOpenIndex < items.length) {
      initial.add(defaultOpenIndex);
    }
    return initial;
  });

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % items.length;
      buttonRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + items.length) % items.length;
      buttonRefs.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      buttonRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      buttonRefs.current[items.length - 1]?.focus();
    }
  };

  return (
    <div className={cn('divide-y divide-border border-y border-border', className)}>
      {items.map((item, index) => {
        const isOpen = openIndices.has(index);
        const headerId = `faq-header-${index}`;
        const panelId = `faq-panel-${index}`;

        return (
          <div key={index} className="w-full">
            <h3>
              <button
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleIndex(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="group flex min-h-[64px] w-full items-center justify-between py-4 text-left font-medium text-[16px] text-ink focus-visible:outline-2 focus-visible:outline-ink transition-colors duration-120 hover:text-ink-2 cursor-pointer"
              >
                <span className="pr-4 leading-snug">{item.question}</span>
                <span
                  className={cn(
                    'shrink-0 text-subtle transition-transform duration-200 ease-out',
                    isOpen && 'rotate-45 text-ink'
                  )}
                  aria-hidden="true"
                >
                  <Plus size={20} strokeWidth={1.5} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              style={{
                display: 'grid',
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 200ms cubic-bezier(0.2, 0.7, 0.2, 1)',
              }}
              className="overflow-hidden"
            >
              <div className="min-h-0">
                <div className="pb-5 pt-1 text-[15px] leading-relaxed text-muted max-w-[64ch]">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

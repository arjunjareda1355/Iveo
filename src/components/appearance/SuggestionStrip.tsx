import React, { useRef, useState } from 'react';
import { RefreshButton } from './RefreshButton';

interface SuggestionStripProps<T> {
  title: string;
  contextChip?: React.ReactNode;
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T) => string;
  onRefresh: () => void;
  busy?: boolean;
  announceText?: string;
  emptyText?: string;
  skeletonHeightClass?: string;
  skeletonWidthClass?: string;
  onLongPressPrevious?: () => void;
}

export function SuggestionStrip<T>({
  title,
  contextChip,
  items,
  renderItem,
  getKey,
  onRefresh,
  busy = false,
  announceText = '',
  emptyText = 'No safe ideas for this background. Try another background or tap refresh.',
  skeletonHeightClass = 'h-24',
  skeletonWidthClass = 'w-[148px]',
  onLongPressPrevious,
}: SuggestionStripProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [animBatch, setAnimBatch] = useState(0);

  const handleRefreshClick = () => {
    setAnimBatch((b) => b + 1);
    onRefresh();
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const container = scrollerRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-strip-card="1"]'));
    if (buttons.length === 0) return;
    const idx = buttons.indexOf(document.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowRight'
        ? Math.min(buttons.length - 1, idx + 1)
        : Math.max(0, idx - 1);
    buttons[nextIdx]?.focus();
  };

  return (
    <section aria-label={title} className="w-full">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h2 className="text-[14px] font-semibold text-ink tracking-tight">{title}</h2>
          {contextChip}
        </div>
        <RefreshButton
          onClick={handleRefreshClick}
          busy={busy}
          announceText={announceText}
          onLongPressPrevious={onLongPressPrevious}
        />
      </div>

      {busy ? (
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`shrink-0 ${skeletonWidthClass} ${skeletonHeightClass} rounded-[14px] bg-surface-2 animate-pulse border border-border`}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-surface p-4 text-[13px] text-muted">
          {emptyText}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onKeyDown={handleKeyDown}
          className="flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory pb-1.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, idx) => (
            <div
              key={`${animBatch}-${getKey(item)}`}
              className="shrink-0 snap-start transition-opacity duration-200"
              style={{ animationDelay: `${Math.min(idx, 7) * 30}ms` }}
            >
              {renderItem(item, idx)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

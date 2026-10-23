import React, { useState } from 'react';
import { Minus, Play, Music, Headphones, Link2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BarRow } from './BarRow';
import { useBlocks } from '../../data/BlocksContext';
import { formatCount } from '../../lib/analytics/dates';
import { copy } from '../../content/copy';

interface LinkClickItem {
  linkId: string;
  clicks: number;
}

interface TopLinksCardProps {
  links: LinkClickItem[];
  totalClicks: number;
  isLoading?: boolean;
}

export const TopLinksCard: React.FC<TopLinksCardProps> = ({
  links,
  totalClicks,
  isLoading = false,
}) => {
  const { blocks } = useBlocks();
  const [showAll, setShowAll] = useState(false);

  // Map blocks by ID for title/glyph/thumbnail resolution
  const blocksMap = new Map(blocks.map((b) => [b.id, b]));

  const maxClicks = links.length > 0 ? Math.max(...links.map((l) => l.clicks)) : 0;
  const displayLimit = showAll ? 50 : 10;
  const visibleLinks = links.slice(0, displayLimit);
  const hasMore = links.length > 10 && !showAll;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
          {copy.dashboard.analytics.topLinks.title}
        </h3>
      </div>

      {isLoading && links.length === 0 ? (
        <div className="flex flex-col gap-3 py-2">
          {[80, 50, 30].map((w, idx) => (
            <div key={idx} className="h-14 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-surface-2 animate-pulse" />
              <div className="flex-1 flex flex-col gap-2">
                <div
                  className="h-4 bg-surface-2 rounded-[4px] animate-pulse"
                  style={{ width: `${w}%` }}
                />
                <div className="h-1 w-full bg-[#E5E5E5] rounded-[2px]" />
              </div>
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="py-6 flex flex-col items-start gap-1">
          <p className="text-[14px] text-muted">
            {copy.dashboard.analytics.topLinks.empty}
          </p>
          <p className="text-[13px] text-muted">
            {copy.dashboard.analytics.topLinks.emptyHelper}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 -my-1">
          {visibleLinks.map((item) => {
            const block = blocksMap.get(item.linkId);
            const isDeleted = !block;

            // Title & Icon
            const title = isDeleted
              ? copy.dashboard.analytics.topLinks.deletedLink
              : block.title || (block.kind === 'embed' ? 'Embed' : 'Untitled');

            const isEmbed = block?.kind === 'embed';
            const ProviderGlyph =
              block?.embedProvider === 'youtube'
                ? Play
                : block?.embedProvider === 'spotify'
                  ? Music
                  : Headphones;

            // Ratio & Percentage
            const ratio = maxClicks > 0 ? item.clicks / maxClicks : 0;
            const pctVal = totalClicks > 0 ? (item.clicks / totalClicks) * 100 : 0;
            const pctStr =
              pctVal > 0 && pctVal < 1
                ? '<1%'
                : `${Math.round(pctVal)}%`;

            const clickText =
              item.clicks === 1
                ? `1 ${copy.dashboard.analytics.topLinks.clickLabel}`
                : `${formatCount(item.clicks)} ${copy.dashboard.analytics.topLinks.clicksLabel}`;

            return (
              <li
                key={item.linkId}
                className="py-3 flex items-center gap-3 min-h-[56px]"
              >
                {/* 36px Tile */}
                <div className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {isDeleted ? (
                    <Minus size={16} className="text-muted" strokeWidth={1.5} />
                  ) : block.thumbnailUrl ? (
                    <img
                      src={block.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : isEmbed ? (
                    <ProviderGlyph size={18} className="text-ink" strokeWidth={1.5} />
                  ) : (
                    <Link2 size={18} className="text-subtle" strokeWidth={1.5} />
                  )}
                </div>

                {/* Details + 4px Bar */}
                <div className="flex-1 flex flex-col min-w-0 gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-[15px] font-medium truncate ${
                        isDeleted ? 'text-muted italic' : 'text-ink'
                      }`}
                    >
                      {title}
                    </span>
                    <span className="text-[13px] text-muted tabular-nums whitespace-nowrap shrink-0">
                      {clickText} · {pctStr} {copy.dashboard.analytics.topLinks.ofClicks}
                    </span>
                  </div>

                  <BarRow ratio={ratio} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-ink"
          >
            {copy.dashboard.analytics.topLinks.showAllPrefix} ({links.length})
          </Button>
        </div>
      )}
    </Card>
  );
};

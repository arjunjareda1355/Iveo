import React from 'react';
import { Card } from '../ui/Card';
import { formatCount } from '../../lib/analytics/dates';
import { formatCtr } from '../../lib/analytics/chart';
import { copy } from '../../content/copy';

interface StatCardsProps {
  views: number;
  clicks: number;
  isLoading?: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({
  views,
  clicks,
  isLoading = false,
}) => {
  const cards = [
    {
      label: copy.dashboard.analytics.stats.views,
      value: formatCount(views),
      helper: copy.dashboard.analytics.stats.viewsHelper,
    },
    {
      label: copy.dashboard.analytics.stats.clicks,
      value: formatCount(clicks),
      helper: copy.dashboard.analytics.stats.clicksHelper,
    },
    {
      label: copy.dashboard.analytics.stats.ctr,
      value: formatCtr(clicks, views),
      helper: copy.dashboard.analytics.stats.ctrHelper,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 p-4 sm:p-5"
        >
          <div className="flex flex-col">
            <span className="text-[13px] text-muted font-normal select-none">
              {card.label}
            </span>
            <span className="hidden sm:block text-[13px] text-muted mt-0.5 select-none">
              {card.helper}
            </span>
          </div>

          <div className="flex flex-col items-end sm:items-start sm:mt-2">
            {isLoading ? (
              <div
                className="w-[80px] h-[28px] rounded-[6px] bg-[#EDEDED]"
                aria-hidden="true"
              />
            ) : (
              <span className="text-[28px] sm:text-[32px] font-medium tabular-nums text-ink leading-tight">
                {card.value}
              </span>
            )}
            <span className="sm:hidden text-[12px] text-muted select-none mt-0.5">
              {card.helper}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
};

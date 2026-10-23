import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from '../plan/ProBadge';
import { ProLockNotice } from '../plan/ProLockNotice';
import { BarRow } from './BarRow';
import { formatCount } from '../../lib/analytics/dates';
import { copy } from '../../content/copy';

export interface BreakdownItem {
  key: string;
  label: string;
  views: number;
  clicks: number;
}

interface BreakdownCardProps {
  title: string;
  items: BreakdownItem[] | null;
  totalViews: number;
  isPro: boolean;
}

export const BreakdownCard: React.FC<BreakdownCardProps> = ({
  title,
  items,
  totalViews,
  isPro,
}) => {
  const [showAll, setShowAll] = useState(false);

  // If not pro or items null, render locked skeleton state
  if (!isPro || items === null) {
    return (
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
            {title}
          </h3>
          <ProBadge />
        </div>

        {/* 3 Static skeleton rows (aria-hidden) */}
        <div aria-hidden="true" className="flex flex-col gap-4 py-2">
          {[
            { labelWidth: '80%', barWidth: 0.8 },
            { labelWidth: '55%', barWidth: 0.55 },
            { labelWidth: '30%', barWidth: 0.3 },
          ].map((row, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              <div
                className="h-4 bg-[#EDEDED] rounded-[4px]"
                style={{ width: row.labelWidth }}
              />
              <BarRow ratio={row.barWidth} />
            </div>
          ))}
        </div>

        <ProLockNotice feature="analytics_detail" className="mt-2" />
      </Card>
    );
  }

  const maxViews = items.length > 0 ? Math.max(...items.map((i) => i.views)) : 0;
  const visibleItems = showAll ? items : items.slice(0, 8);
  const hasMore = items.length > 8 && !showAll;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
          {title}
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="py-6">
          <p className="text-[14px] text-muted">
            {copy.dashboard.analytics.breakdowns.empty}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 -my-1">
          {visibleItems.map((item) => {
            const ratio = maxViews > 0 ? item.views / maxViews : 0;
            const pctVal = totalViews > 0 ? (item.views / totalViews) * 100 : 0;
            const pctStr =
              pctVal > 0 && pctVal < 1
                ? '<1%'
                : `${Math.round(pctVal)}%`;

            return (
              <li
                key={item.key}
                className="py-2.5 flex flex-col justify-center gap-1.5 min-h-[48px]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-[13px] text-muted">
                      {formatCount(item.views)} views · {formatCount(item.clicks)} clicks
                    </span>
                    <span className="text-[14px] text-ink font-medium min-w-[36px] text-right">
                      {pctStr}
                    </span>
                  </div>
                </div>

                <BarRow ratio={ratio} />
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
            {copy.dashboard.analytics.breakdowns.showAllPrefix} ({items.length})
          </Button>
        </div>
      )}
    </Card>
  );
};

import React from 'react';
import { Bucket } from '../../lib/analytics/buckets';
import { formatCount } from '../../lib/analytics/dates';
import { copy } from '../../content/copy';

interface ChartTableProps {
  buckets: Bucket[];
}

export const ChartTable: React.FC<ChartTableProps> = ({ buckets }) => {
  return (
    <details className="group mt-2">
      <summary className="inline-flex items-center text-[13px] font-medium text-muted hover:text-ink cursor-pointer select-none py-1 px-2 -ml-2 rounded-[6px] hover:bg-surface-2 transition-colors duration-120 list-none">
        <span className="underline decoration-border hover:decoration-ink">
          {copy.dashboard.analytics.chart.viewAsTable}
        </span>
      </summary>

      <div className="mt-3 border border-border rounded-[10px] overflow-hidden">
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[13px] text-left border-collapse">
            <caption className="sr-only">
              {copy.dashboard.analytics.chart.tableCaption}
            </caption>
            <thead className="sticky top-0 bg-surface-2 border-b border-border z-10 text-muted font-normal select-none">
              <tr>
                <th scope="col" className="py-2.5 px-4 font-medium text-ink">
                  {copy.dashboard.analytics.chart.tableDate}
                </th>
                <th scope="col" className="py-2.5 px-4 font-medium text-ink text-right">
                  {copy.dashboard.analytics.chart.tableViews}
                </th>
                <th scope="col" className="py-2.5 px-4 font-medium text-ink text-right">
                  {copy.dashboard.analytics.chart.tableClicks}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface text-ink">
              {buckets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted">
                    {copy.dashboard.analytics.chart.empty}
                  </td>
                </tr>
              ) : (
                buckets.map((b) => (
                  <tr key={b.key} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-2.5 px-4 text-ink font-medium">{b.label}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted">
                      {formatCount(b.views)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted">
                      {formatCount(b.clicks)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
};

import React, { useState, useId, useRef } from 'react';
import { Card } from '../ui/Card';
import { AnalyticsDay, RangeKey } from '../../lib/analytics/types';
import { RANGES } from '../../lib/analytics/ranges';
import { buildBuckets, Bucket } from '../../lib/analytics/buckets';
import { niceMax, yTicks } from '../../lib/analytics/chart';
import { formatCount } from '../../lib/analytics/dates';
import { useElementWidth } from '../../hooks/useElementWidth';
import { copy } from '../../content/copy';

interface ViewsClicksChartProps {
  daily: AnalyticsDay[];
  rangeKey: RangeKey;
  isLoading?: boolean;
}

export const ViewsClicksChart: React.FC<ViewsClicksChartProps> = ({
  daily,
  rangeKey,
  isLoading = false,
}) => {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const liveRegionId = useId();
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const rangeConfig = RANGES[rangeKey] || RANGES['30d'];
  const buckets: Bucket[] = buildBuckets(daily, rangeConfig.bucket);

  const totalViews = buckets.reduce((acc, b) => acc + b.views, 0);
  const totalClicks = buckets.reduce((acc, b) => acc + b.clicks, 0);
  const isEmpty = totalViews === 0 && totalClicks === 0;

  // Chart layout dimensions
  const height = typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 240;
  const margins = { top: 16, right: 8, bottom: 28, left: 44 };

  const plotWidth = Math.max(0, containerWidth - margins.left - margins.right);
  const plotHeight = Math.max(0, height - margins.top - margins.bottom);

  // Y Scale
  const maxDataVal = isEmpty
    ? 0
    : Math.max(...buckets.map((b) => Math.max(b.views, b.clicks)), 0);
  const yMax = niceMax(maxDataVal);
  const ticks = yTicks(yMax);

  const getY = (val: number) => {
    if (yMax <= 0) return margins.top + plotHeight;
    const clamped = Math.max(0, Math.min(yMax, val));
    return margins.top + plotHeight - (clamped / yMax) * plotHeight;
  };

  const bucketCount = buckets.length;
  const bandWidth = bucketCount > 0 ? plotWidth / bucketCount : 0;
  const barWidth = Math.min(bandWidth * 0.64, 28);

  // X ticks: about 6 evenly spaced labels, always including the first
  const xStep = Math.max(1, Math.ceil(bucketCount / 6));

  // Build points for clicks polyline
  const clickPoints = buckets.map((b, i) => {
    const x = margins.left + i * bandWidth + bandWidth / 2;
    const y = getY(b.clicks);
    return { x, y, clicks: b.clicks };
  });

  const polylinePoints = clickPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Pointer interactions
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isEmpty || bucketCount === 0 || plotWidth <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left - margins.left;
    if (clientX < 0 || clientX > plotWidth) {
      setActiveIndex(null);
      return;
    }
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(clientX / bandWidth)));
    setActiveIndex(idx);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEmpty || bucketCount === 0) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null ? bucketCount - 1 : (prev + 1) % bucketCount));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex((prev) => (prev === null ? bucketCount - 1 : (prev - 1 + bucketCount) % bucketCount));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(bucketCount - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveIndex(null);
    }
  };

  const activeBucket = activeIndex !== null && activeIndex >= 0 && activeIndex < bucketCount ? buckets[activeIndex] : null;

  // Active tooltip position clamped inside container
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (activeBucket && activeIndex !== null) {
    const x = margins.left + activeIndex * bandWidth + bandWidth / 2;
    const yViews = getY(activeBucket.views);
    const yClicks = getY(activeBucket.clicks);
    const topY = Math.min(yViews, yClicks);

    tooltipLeft = Math.max(12, Math.min(containerWidth - 140, x - 60));
    tooltipTop = Math.max(8, topY - 72);
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6 relative">
      {/* Top Header: Title + Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
          {copy.dashboard.analytics.chart.title}
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[13px] text-muted select-none">
          {/* Views swatch */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-[3px] bg-[#EDEDED] border border-[#8F8F8F]"
              aria-hidden="true"
            />
            <span>{copy.dashboard.analytics.chart.legendViews}</span>
          </div>

          {/* Clicks swatch */}
          <div className="flex items-center gap-1.5">
            <div className="w-4 flex items-center justify-center relative" aria-hidden="true">
              <div className="w-4 h-[1.5px] bg-[#0A0A0A]" />
              <div className="absolute w-[6px] h-[6px] rounded-full bg-[#0A0A0A]" />
            </div>
            <span>{copy.dashboard.analytics.chart.legendClicks}</span>
          </div>
        </div>
      </div>

      {/* Live Region for Screen Readers */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {activeBucket
          ? `${activeBucket.label}: ${activeBucket.views} views, ${activeBucket.clicks} clicks`
          : ''}
      </div>

      {/* Chart Plot Area */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="group"
        aria-label={copy.dashboard.analytics.chart.groupAriaLabel}
        onKeyDown={handleKeyDown}
        className="relative w-full outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[10px]"
      >
        {isLoading && buckets.length === 0 ? (
          <div
            className="w-full rounded-[10px] bg-[#F5F5F5]"
            style={{ height }}
            aria-hidden="true"
          />
        ) : (
          <div ref={chartWrapperRef} className="relative w-full overflow-hidden select-none">
            <svg
              width={containerWidth || 300}
              height={height}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              className="w-full block overflow-visible"
              aria-hidden="true"
            >
              {/* Y Gridlines and Labels */}
              {ticks.map((t) => {
                const y = getY(t);
                return (
                  <g key={`tick-${t}`}>
                    <line
                      x1={margins.left}
                      y1={y}
                      x2={margins.left + plotWidth}
                      y2={y}
                      stroke={t === 0 ? '#D4D4D4' : '#E5E5E5'}
                      strokeWidth={1}
                    />
                    <text
                      x={margins.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#666666"
                      fontSize={12}
                      className="tabular-nums"
                    >
                      {formatCount(t)}
                    </text>
                  </g>
                );
              })}

              {/* Views Bars */}
              {!isEmpty &&
                buckets.map((b, i) => {
                  const x = margins.left + i * bandWidth + (bandWidth - barWidth) / 2;
                  const y = getY(b.views);
                  const barH = margins.top + plotHeight - y;
                  const isActive = activeIndex === i;

                  return (
                    <rect
                      key={`bar-${b.key}`}
                      x={x}
                      y={y}
                      width={Math.max(1, barWidth)}
                      height={Math.max(0, barH)}
                      rx={3}
                      ry={3}
                      fill={isActive ? '#D4D4D4' : '#EDEDED'}
                      stroke={isActive ? '#0A0A0A' : '#8F8F8F'}
                      strokeWidth={1}
                    />
                  );
                })}

              {/* Clicks Line and Dots */}
              {!isEmpty && polylinePoints && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {!isEmpty &&
                clickPoints.map((p, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="#0A0A0A"
                  />
                ))}

              {/* X Axis Labels */}
              {!isEmpty &&
                buckets.map((b, i) => {
                  if (i % xStep !== 0 && i !== 0) return null;
                  const x = margins.left + i * bandWidth + bandWidth / 2;
                  const y = height - 8;

                  return (
                    <text
                      key={`x-label-${b.key}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fill="#666666"
                      fontSize={12}
                      className="tabular-nums"
                    >
                      {b.label}
                    </text>
                  );
                })}
            </svg>

            {/* Empty State Overlay */}
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[13px] text-muted">
                  {copy.dashboard.analytics.chart.empty}
                </span>
              </div>
            )}

            {/* Floating Tooltip */}
            {activeBucket && (
              <div
                className="absolute pointer-events-none z-10 bg-white border border-border rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] px-3 py-2 text-[13px] flex flex-col gap-0.5 transition-all duration-75"
                style={{
                  left: tooltipLeft,
                  top: tooltipTop,
                }}
              >
                <span className="font-medium text-ink">{activeBucket.label}</span>
                <span className="text-muted tabular-nums">
                  {copy.dashboard.analytics.chart.tooltipViews} {formatCount(activeBucket.views)}
                </span>
                <span className="text-muted tabular-nums">
                  {copy.dashboard.analytics.chart.tooltipClicks} {formatCount(activeBucket.clicks)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <p className="text-[13px] text-muted select-none mt-1">
        {copy.dashboard.analytics.chart.utcNotice}
      </p>
    </Card>
  );
};

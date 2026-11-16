import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalyticsHeader } from '../components/analytics/AnalyticsHeader';
import { RangeSelector } from '../components/analytics/RangeSelector';
import { StatCards } from '../components/analytics/StatCards';
import { ViewsClicksChart } from '../components/analytics/ViewsClicksChart';
import { ChartTable } from '../components/analytics/ChartTable';
import { TopLinksCard } from '../components/analytics/TopLinksCard';
import { BreakdownCard, BreakdownItem } from '../components/analytics/BreakdownCard';
import { FirstRunNotice } from '../components/analytics/FirstRunNotice';
import { ShareDialog } from '../components/share/ShareDialog';
import { Button } from '../components/ui/Button';
import { useAnalytics } from '../data/hooks/useAnalytics';
import { useIveoSession } from '../auth/useIvioSession';
import { RangeKey } from '../lib/analytics/types';
import { isValidRangeKey, RANGES } from '../lib/analytics/ranges';
import { SOURCE_LABELS, TrackSource } from '../lib/analytics/sources';
import { buildBuckets } from '../lib/analytics/buckets';
import { copy } from '../content/copy';

export const AnalyticsTab: React.FC = () => {
  const session = useIveoSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Validate range param from URL; default to '30d'
  const rawRange = searchParams.get('range');
  const activeRange: RangeKey = isValidRangeKey(rawRange) ? rawRange : '30d';

  const {
    data,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useAnalytics(activeRange);

  // Downgrade guard: If response says not pro but URL asks for a Pro range, reset URL to 30d
  useEffect(() => {
    if (data?.range && !data.range.isPro && (activeRange === '90d' || activeRange === '12m')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('range', '30d');
      setSearchParams(nextParams, { replace: true });
    }
  }, [data?.range, activeRange, searchParams, setSearchParams]);

  const handleRangeChange = (key: RangeKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('range', key);
    setSearchParams(nextParams);
  };

  const requestedDays = RANGES[activeRange].days;
  const isClamped = Boolean(data?.range && data.range.maxDays < requestedDays);

  const views = data?.totals.views ?? 0;
  const clicks = data?.totals.clicks ?? 0;
  const isBrandNewAccount = !isLoading && !isError && views === 0 && clicks === 0;

  // Buckets for table
  const buckets = useMemo(() => {
    if (!data?.daily) return [];
    return buildBuckets(data.daily, RANGES[activeRange].bucket);
  }, [data?.daily, activeRange]);

  // Sources breakdown items
  const sourceItems: BreakdownItem[] | null = useMemo(() => {
    if (!data || data.sources === null) return null;
    return data.sources.map((s) => ({
      key: s.source || 'direct',
      label: SOURCE_LABELS[s.source as TrackSource] || 'Other',
      views: s.views,
      clicks: s.clicks,
    }));
  }, [data]);

  // Devices breakdown items
  const deviceItems: BreakdownItem[] | null = useMemo(() => {
    if (!data || data.devices === null) return null;
    const items: BreakdownItem[] = [];
    const labelsMap: Record<string, string> = {
      mobile: copy.dashboard.analytics.breakdowns.devices.mobile,
      tablet: copy.dashboard.analytics.breakdowns.devices.tablet,
      desktop: copy.dashboard.analytics.breakdowns.devices.desktop,
      other: copy.dashboard.analytics.breakdowns.devices.other,
    };

    for (const d of data.devices) {
      // Hide 'other' when it has no views or clicks
      if (d.device === 'other' && d.views === 0 && d.clicks === 0) {
        continue;
      }
      items.push({
        key: d.device,
        label: labelsMap[d.device] || d.device,
        views: d.views,
        clicks: d.clicks,
      });
    }

    return items;
  }, [data]);

  return (
    <div className="w-full max-w-[880px] mx-auto flex flex-col gap-6">
      {/* 1. Header Row */}
      <AnalyticsHeader
        dataUpdatedAt={dataUpdatedAt}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* 2. Range Selector */}
      <RangeSelector
        value={activeRange}
        onChange={handleRangeChange}
        isPro={session.isPro}
        clamped={isClamped}
      />

      {/* Error State */}
      {isError && (
        <div className="bg-surface border border-border rounded-[14px] p-6 flex flex-col items-start gap-3">
          <h3 className="text-[17px] font-semibold text-ink">
            {copy.loadError.title}
          </h3>
          <p className="text-[14px] text-muted leading-relaxed">
            {copy.loadError.body}
          </p>
          <Button variant="secondary" size="md" onClick={() => refetch()}>
            {copy.loadError.tryAgain}
          </Button>
        </div>
      )}

      {/* First Run Notice (Brand-new account) */}
      {isBrandNewAccount && (
        <FirstRunNotice onShare={() => setIsShareOpen(true)} />
      )}

      {/* 3. Stats Row */}
      <StatCards
        views={views}
        clicks={clicks}
        isLoading={isLoading}
      />

      {/* 4. Chart Card with Table Alternative */}
      <div>
        <ViewsClicksChart
          daily={data?.daily ?? []}
          rangeKey={activeRange}
          isLoading={isLoading}
        />
        <ChartTable buckets={buckets} />
      </div>

      {/* 5. Top Links Card */}
      <TopLinksCard
        links={data?.links ?? []}
        totalClicks={clicks}
        isLoading={isLoading}
      />

      {/* 6. Sources and Devices Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownCard
          title={copy.dashboard.analytics.breakdowns.sourcesTitle}
          items={sourceItems}
          totalViews={views}
          isPro={session.isPro}
        />
        <BreakdownCard
          title={copy.dashboard.analytics.breakdowns.devicesTitle}
          items={deviceItems}
          totalViews={views}
          isPro={session.isPro}
        />
      </div>

      {/* 7. Privacy Footnote */}
      <p className="text-[13px] text-muted leading-relaxed max-w-[64ch] mt-2 mb-8 select-none">
        {copy.dashboard.analytics.footnote}
      </p>

      {/* Share Dialog for first-run notice */}
      {session.username && (
        <ShareDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          username={session.username}
          displayName={session.displayName}
          bio={session.bio}
          avatarUrl={session.imageUrl}
          vibeId={session.vibeId}
          fontSettings={session.fontSettings ?? null}
          buttonColors={session.buttonColors ?? null}
          businessCard={session.businessCard}
          socials={session.socials}
          onSaveCardConfig={async (cfg) => {
            await session.updatePreferences({ businessCard: cfg });
          }}
          isPro={session.isPro}
          isPublished={true}
        />
      )}
    </div>
  );
};

export default AnalyticsTab;

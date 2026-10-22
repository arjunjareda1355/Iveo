import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { copy } from '../../content/copy';

interface AnalyticsHeaderProps {
  dataUpdatedAt?: number;
  onRefresh: () => Promise<unknown>;
  isFetching?: boolean;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  dataUpdatedAt,
  onRefresh,
  isFetching = false,
}) => {
  const { showToast } = useToast();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    try {
      await onRefresh();
    } catch {
      showToast(copy.dashboard.analytics.refreshFailedToast);
    } finally {
      // Keep spinning for at least 700ms per specification
      setTimeout(() => {
        setIsSpinning(false);
      }, 700);
    }
  };

  const formattedTime = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: 'numeric',
      }).format(new Date(dataUpdatedAt))
    : null;

  const spinning = isSpinning || isFetching;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 className="text-[24px] font-medium tracking-[-0.02em] text-ink leading-tight">
        {copy.dashboard.analytics.title}
      </h2>

      <div className="flex items-center gap-3">
        {formattedTime && (
          <span
            role="status"
            aria-live="polite"
            className="text-[13px] text-muted select-none"
          >
            {copy.dashboard.analytics.updatedPrefix} {formattedTime}
          </span>
        )}

        <Button
          variant="ghost"
          size="md"
          onClick={handleRefresh}
          aria-label={copy.dashboard.analytics.refreshAriaLabel}
          className="flex items-center gap-2 text-ink hover:text-ink cursor-pointer"
        >
          <RefreshCw
            size={16}
            strokeWidth={1.5}
            className={`transition-transform duration-700 ${
              spinning ? 'animate-spin motion-reduce:animate-none' : ''
            }`}
          />
          <span>{copy.dashboard.analytics.refresh}</span>
        </Button>
      </div>
    </div>
  );
};

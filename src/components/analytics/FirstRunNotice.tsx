import React from 'react';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';

interface FirstRunNoticeProps {
  onShare: () => void;
}

export const FirstRunNotice: React.FC<FirstRunNoticeProps> = ({ onShare }) => {
  return (
    <div className="bg-surface-2 border border-border rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <p className="text-[14px] text-ink leading-normal">
        {copy.dashboard.analytics.firstRun.notice}
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={onShare}
        className="shrink-0"
      >
        {copy.dashboard.analytics.firstRun.button}
      </Button>
    </div>
  );
};

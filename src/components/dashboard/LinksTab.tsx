import React from 'react';
import { Link2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';

export const LinksTab: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <div className="w-10 h-10 rounded-[10px] bg-surface-2 flex items-center justify-center text-subtle">
          <Link2 size={20} strokeWidth={1.5} />
        </div>

        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.linksTab.emptyTitle}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[48ch]">
            {copy.dashboard.linksTab.emptyBody}
          </p>
        </div>

        <div className="mt-2">
          <Button
            variant="secondary"
            size="md"
            disabled
            title={copy.dashboard.linksTab.addLinkTooltip}
          >
            {copy.dashboard.linksTab.addLinkButton}
          </Button>
        </div>
      </Card>

      <p className="text-[13px] text-muted px-1">
        {copy.dashboard.linksTab.supportNote}{' '}
        <a
          href="mailto:help@ivio.site"
          className="text-ink underline underline-offset-[3px] font-medium hover:text-ink-2"
        >
          help@ivio.site
        </a>
        .
      </p>
    </div>
  );
};

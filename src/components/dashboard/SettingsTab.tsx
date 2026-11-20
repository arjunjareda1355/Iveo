import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { IntegrationsCard } from './IntegrationsCard';
import { SearchSeoCard } from './SearchSeoCard';

export const SettingsTab: React.FC = () => {
  const location = useLocation();
  const demoSearch = (() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      const kept = new URLSearchParams();
      if (params.get('demo') === '1') kept.set('demo', '1');
      if (params.get('autostart') === '1') kept.set('autostart', '1');
      return `?${kept.toString()}`;
    }
    return '';
  })();

  return (
    <div className="flex flex-col gap-6 max-w-[720px]">
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          Manage analytics integrations and search indexing for your public page.
        </p>
      </div>

      {/* CH-1 / AR-13: Single link row pointing to /account */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-ink leading-tight">
            Account, plan and security
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Manage your profile, sign-in, connected platforms, billing, and data.
          </p>
        </div>

        <Button
          as={Link}
          to={`/account${demoSearch}`}
          variant="secondary"
          size="md"
          className="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5"
        >
          <span>Open account</span>
          <ChevronRight size={15} className="text-muted" />
        </Button>
      </Card>

      <div id="integrations" className="scroll-mt-32">
        <IntegrationsCard />
      </div>

      <div id="seo" className="scroll-mt-32">
        <SearchSeoCard />
      </div>
    </div>
  );
};

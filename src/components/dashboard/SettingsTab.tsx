import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { copy } from '../../content/copy';

export const SettingsTab: React.FC = () => {
  const session = useIvioSession();
  const { showToast } = useToast();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://ivio.site/${session.username}`);
      showToast(copy.toasts.linkCopied);
    } catch {
      // fallback
    }
  };

  const handleSignOut = async () => {
    await session.signOut();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Account Card */}
      <Card className="flex flex-col gap-4">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          {copy.dashboard.settingsTab.accountHeading}
        </h3>

        <div className="divide-y divide-border">
          <div className="h-14 flex items-center justify-between text-[14px]">
            <span className="text-muted">{copy.dashboard.settingsTab.emailLabel}</span>
            <span className="text-[15px] font-medium text-ink">
              {session.primaryEmail || 'Not set'}
            </span>
          </div>

          <div className="h-14 flex items-center justify-between text-[14px]">
            <span className="text-muted">{copy.dashboard.settingsTab.usernameLabel}</span>
            <span className="text-[15px] font-mono font-medium text-ink">
              @{session.username}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <Button as={Link} to="/account" variant="secondary" size="md">
            {copy.dashboard.settingsTab.manageAccountButton}
          </Button>
        </div>
      </Card>

      {/* 2. Your Page Card */}
      <Card className="flex flex-col gap-4">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          {copy.dashboard.settingsTab.yourPageHeading}
        </h3>

        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-surface-2 border border-border">
          <span className="font-mono text-[14px] text-ink select-all truncate flex-1">
            https://ivio.site/{session.username}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-1">
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            iconRight={<Copy size={14} />}
          >
            {copy.dashboard.settingsTab.copyLinkButton}
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled
            title={copy.dashboard.settingsTab.viewPageTooltip}
            iconRight={<ExternalLink size={14} />}
          >
            {copy.dashboard.settingsTab.viewPageButton}
          </Button>
        </div>
      </Card>

      {/* 3. Session Card */}
      <Card className="flex flex-col items-start gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            {copy.dashboard.settingsTab.sessionHeading}
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            {copy.dashboard.settingsTab.sessionLine}
          </p>
        </div>

        <Button variant="secondary" size="md" onClick={handleSignOut}>
          {copy.dashboard.settingsTab.signOutButton}
        </Button>
      </Card>
    </div>
  );
};

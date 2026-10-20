import React from 'react';
import { Button } from '../ui/Button';
import { ProFeature, getProFeatureName } from '../../lib/plan';
import { useUpgradeDialog } from './UpgradeDialogProvider';

interface ProLockNoticeProps {
  feature: ProFeature;
  className?: string;
}

export const ProLockNotice: React.FC<ProLockNoticeProps> = ({ feature, className }) => {
  const { openUpgrade } = useUpgradeDialog();

  return (
    <div
      className={`flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-[10px] p-3 text-[14px] text-muted ${
        className || ''
      }`}
    >
      <span>{getProFeatureName(feature)} is a Pro feature.</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openUpgrade(feature)}
        className="shrink-0"
      >
        Learn more
      </Button>
    </div>
  );
};

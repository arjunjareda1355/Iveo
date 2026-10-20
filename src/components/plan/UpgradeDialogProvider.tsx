import React, { createContext, useContext, useState, useCallback } from 'react';
import { UpgradeDialog } from './UpgradeDialog';
import { ProFeature } from '../../lib/plan';

interface UpgradeDialogContextValue {
  openUpgrade: (feature?: ProFeature) => void;
  closeUpgrade: () => void;
}

const UpgradeDialogContext = createContext<UpgradeDialogContextValue | null>(null);

export const UpgradeDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<ProFeature | null>(null);

  const openUpgrade = useCallback((feat?: ProFeature) => {
    setFeature(feat || null);
    setIsOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setIsOpen(false);
    setFeature(null);
  }, []);

  return (
    <UpgradeDialogContext.Provider value={{ openUpgrade, closeUpgrade }}>
      {children}
      <UpgradeDialog isOpen={isOpen} onClose={closeUpgrade} feature={feature} />
    </UpgradeDialogContext.Provider>
  );
};

export function useUpgradeDialog(): UpgradeDialogContextValue {
  const ctx = useContext(UpgradeDialogContext);
  if (!ctx) {
    throw new Error('useUpgradeDialog must be used within an UpgradeDialogProvider');
  }
  return ctx;
}

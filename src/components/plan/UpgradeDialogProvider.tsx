import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { UpgradeDialog } from './UpgradeDialog';
import { PaymentSuccessDialog } from './PaymentSuccessDialog';
import { ProFeature } from '../../lib/plan';
import { SubscriptionVerificationResult } from '../../lib/razorpay';
import { useToast } from '../ui/Toast';

interface UpgradeDialogContextValue {
  openUpgrade: (feature?: ProFeature) => void;
  closeUpgrade: () => void;
  showPaymentSuccess: (data: SubscriptionVerificationResult) => void;
}

const UpgradeDialogContext = createContext<UpgradeDialogContextValue | null>(null);

export const UpgradeDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<ProFeature | null>(null);

  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successData, setSuccessData] = useState<SubscriptionVerificationResult | null>(null);

  const openUpgrade = useCallback((feat?: ProFeature) => {
    setFeature(feat || null);
    setIsOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setIsOpen(false);
    setFeature(null);
  }, []);

  const showPaymentSuccess = useCallback(
    async (data: SubscriptionVerificationResult) => {
      setSuccessData(data);
      setIsOpen(false);
      setIsSuccessOpen(true);
      showToast('Welcome to iveo Pro!');

      // Update Clerk user metadata
      if (user) {
        try {
          const currentMeta = (user.unsafeMetadata || {}) as Record<string, unknown>;
          await user.update({
            unsafeMetadata: {
              ...currentMeta,
              plan: 'pro',
              subscriptionId: data.paymentId,
              orderId: data.orderId,
              billingPeriod: data.period,
              subscribedAt: data.subscribedAt,
              expiresAt: data.expiresAt,
            },
          });
          await user.reload();
        } catch (err) {
          console.error('Failed to update user metadata with pro status:', err);
        }

        // Local storage backup
        const uname = user.username?.toLowerCase() || '';
        if (uname) {
          try {
            const raw = localStorage.getItem(`iveo_profile_${uname}`) || '{}';
            const parsed = JSON.parse(raw);
            parsed.plan = 'pro';
            localStorage.setItem(`iveo_profile_${uname}`, JSON.stringify(parsed));
            localStorage.setItem(`iveo_subscription_${uname}`, JSON.stringify(data));
          } catch {}
        }
      }
    },
    [user, showToast]
  );

  useEffect(() => {
    (window as any).__openUpgrade = openUpgrade;
    (window as any).__showPaymentSuccess = showPaymentSuccess;
    return () => {
      delete (window as any).__openUpgrade;
      delete (window as any).__showPaymentSuccess;
    };
  }, [openUpgrade, showPaymentSuccess]);

  return (
    <UpgradeDialogContext.Provider
      value={{ openUpgrade, closeUpgrade, showPaymentSuccess }}
    >
      {children}
      <UpgradeDialog
        isOpen={isOpen}
        onClose={closeUpgrade}
        feature={feature}
        onSuccess={showPaymentSuccess}
      />
      <PaymentSuccessDialog
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        data={successData}
      />
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

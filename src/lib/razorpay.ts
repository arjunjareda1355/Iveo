export type { PlanPeriod, PaymentCurrency } from '../../api/_lib/razorpay.ts';
import type { PlanPeriod, PaymentCurrency } from '../../api/_lib/razorpay.ts';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads the Razorpay checkout script with caching
 */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout script');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export interface CheckoutUser {
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
}

export interface SubscriptionVerificationResult {
  ok: boolean;
  verified: boolean;
  plan: 'pro';
  period: PlanPeriod;
  subscribedAt: string;
  expiresAt: string;
  paymentId: string;
  orderId: string;
}

export interface StartCheckoutOptions {
  period: PlanPeriod;
  currency?: PaymentCurrency;
  user: CheckoutUser;
  onSuccess: (result: SubscriptionVerificationResult) => void;
  onError: (error: string) => void;
  onDismiss?: () => void;
}

/**
 * Initiates Razorpay checkout flow: creates order, opens checkout modal, verifies signature
 */
export async function startProSubscriptionCheckout(
  options: StartCheckoutOptions
): Promise<void> {
  const { period, currency = 'INR', user, onSuccess, onError, onDismiss } = options;

  // 1. Ensure Razorpay script is loaded
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    onError('Could not load payment checkout. Please check your connection and try again.');
    return;
  }

  // 2. Create order on backend
  let orderData: any;
  try {
    const orderRes = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        period,
        currency,
        userId: user.userId || undefined,
        username: user.username || undefined,
        email: user.email || undefined,
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}));
      throw new Error(err.message || 'Unable to initiate order');
    }

    orderData = await orderRes.json();
  } catch (err: any) {
    onError(err?.message || 'Failed to create payment order. Please try again.');
    return;
  }

  const { orderId, amount, keyId } = orderData;

  // 3. Open Razorpay Checkout modal
  const rzpOptions = {
    key: keyId,
    amount,
    currency,
    name: 'iveo',
    description:
      period === 'yearly'
        ? 'iveo Pro Annual Subscription'
        : 'iveo Pro Monthly Subscription',
    image:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="7" fill="%230A0A0A"/><circle cx="12" cy="7.25" r="1.75" fill="%23FFFFFF"/><rect x="10.5" y="10.5" width="3" height="8" rx="1.5" fill="%23FFFFFF"/></svg>',
    order_id: orderId,
    prefill: {
      name: user.displayName || user.username || '',
      email: user.email || '',
    },
    notes: {
      plan: 'pro',
      period,
    },
    theme: {
      color: '#0A0A0A',
      backdrop_color: 'rgba(0,0,0,0.4)',
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) onDismiss();
      },
    },
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      // 4. Verify payment on server
      try {
        const verifyRes = await fetch('/api/razorpay/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            period,
            currency,
            userId: user.userId || undefined,
            username: user.username || undefined,
            email: user.email || undefined,
          }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json().catch(() => ({}));
          throw new Error(err.message || 'Signature verification failed');
        }

        const verifyData: SubscriptionVerificationResult = await verifyRes.json();
        onSuccess(verifyData);
      } catch (err: any) {
        onError(err?.message || 'Payment verification failed. Please contact support.');
      }
    },
  };

  try {
    const razorpayInstance = new window.Razorpay(rzpOptions);
    razorpayInstance.on('payment.failed', (response: any) => {
      const desc = response?.error?.description || 'Payment was declined or cancelled.';
      onError(desc);
    });
    razorpayInstance.open();
  } catch (err: any) {
    onError(err?.message || 'Failed to open Razorpay payment window.');
  }
}

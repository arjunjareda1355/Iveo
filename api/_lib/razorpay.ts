import crypto from 'node:crypto';
import { getRazorpayKeyId, getRazorpayKeySecret, getRazorpayWebhookSecret } from './env.ts';

export type PlanPeriod = 'monthly' | 'yearly';
export type PaymentCurrency = 'INR' | 'USD';

export interface PlanPricing {
  amount: number; // in smallest unit: paise or cents
  currency: PaymentCurrency;
  displayAmount: string;
}

export const PRICING_CONFIG: Record<
  PaymentCurrency,
  Record<PlanPeriod, PlanPricing>
> = {
  INR: {
    monthly: {
      amount: 49900, // ₹499
      currency: 'INR',
      displayAmount: '₹499',
    },
    yearly: {
      amount: 499900, // ₹4,999 (~₹416/mo, save 17%)
      currency: 'INR',
      displayAmount: '₹4,999',
    },
  },
  USD: {
    monthly: {
      amount: 600, // $6.00
      currency: 'USD',
      displayAmount: '$6',
    },
    yearly: {
      amount: 6000, // $60.00 ($5/mo, save 17%)
      currency: 'USD',
      displayAmount: '$60',
    },
  },
};

export interface CreateOrderParams {
  period: PlanPeriod;
  currency?: PaymentCurrency;
  userId?: string;
  username?: string;
  email?: string;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * Creates an order via Razorpay REST API
 */
export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<RazorpayOrderResult> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  const currency: PaymentCurrency = params.currency === 'USD' ? 'USD' : 'INR';
  const pricing = PRICING_CONFIG[currency][params.period];

  const receipt = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const payload = {
    amount: pricing.amount,
    currency: pricing.currency,
    receipt,
    notes: {
      plan: 'pro',
      period: params.period,
      userId: params.userId || '',
      username: params.username || '',
      email: params.email || '',
    },
  };

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Razorpay create order failed:', res.status, errorBody);
    throw new Error(`Failed to create Razorpay order: ${res.statusText}`);
  }

  const data = (await res.json()) as RazorpayOrderResult;
  return data;
}

/**
 * Validates Razorpay Payment Signature using timing-safe comparison
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const keySecret = getRazorpayKeySecret();
  const body = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Fetches verified payment details from Razorpay API
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<any> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    return null;
  }

  return await res.json();
}

/**
 * Verifies Razorpay Webhook Signature
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!rawBody || !signature) return false;

  const secret = getRazorpayWebhookSecret();
  if (!secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

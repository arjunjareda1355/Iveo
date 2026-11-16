import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchRazorpayPayment,
  verifyWebhookSignature,
  type PlanPeriod,
  type PaymentCurrency,
} from './_lib/razorpay.ts';
import { getRazorpayKeyId } from './_lib/env.ts';
import { adminClient } from './_lib/supabase.ts';
import { dbGetProfile, dbGetProfileByUserId, dbSaveProfile } from './_lib/azureSql.ts';
import { firebaseSaveProfile } from './_lib/firebaseServer.ts';
import { invalidatePublicPageCache } from './_lib/db-handlers.ts';
import type { SubscriptionRecord } from '../src/lib/plan.ts';

export const dynamic = 'force-dynamic';

export async function handleCreateOrder(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'invalid_json', message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const period: PlanPeriod = body.period === 'yearly' ? 'yearly' : 'monthly';
    const currency: PaymentCurrency = body.currency === 'USD' ? 'USD' : 'INR';

    const order = await createRazorpayOrder({
      period,
      currency,
      userId: typeof body.userId === 'string' ? body.userId : undefined,
      username: typeof body.username === 'string' ? body.username : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
    });

    return Response.json(
      {
        ok: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: getRazorpayKeyId(),
        plan: 'pro',
        period,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Razorpay create-order error:', error);
    return Response.json(
      {
        error: 'order_creation_failed',
        message: error?.message || 'Failed to create payment order',
      },
      { status: 500 }
    );
  }
}

export async function handleVerifyPayment(request: Request): Promise<Response> {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'invalid_json', message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      period: rawPeriod,
      userId,
      username,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json(
        {
          error: 'missing_params',
          message: 'Missing required Razorpay payment verification parameters',
        },
        { status: 400 }
      );
    }

    // 1. Verify cryptographic HMAC-SHA256 signature
    const isValidSignature = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      console.warn('Tampered payment signature detected for order:', razorpay_order_id);
      return Response.json(
        {
          error: 'invalid_signature',
          message: 'Payment verification failed: invalid signature',
        },
        { status: 400 }
      );
    }

    // 2. Fetch payment details from Razorpay to confirm capture & order association
    const payment = await fetchRazorpayPayment(razorpay_payment_id);
    if (payment) {
      if (payment.order_id && payment.order_id !== razorpay_order_id) {
        return Response.json(
          {
            error: 'order_mismatch',
            message: 'Payment does not belong to the given order',
          },
          { status: 400 }
        );
      }

      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return Response.json(
          {
            error: 'payment_not_successful',
            message: `Payment status is ${payment.status}, expected captured`,
          },
          { status: 400 }
        );
      }
    }

    const period: PlanPeriod = rawPeriod === 'yearly' ? 'yearly' : 'monthly';
    const durationDays = period === 'yearly' ? 365 : 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const amountInr =
      typeof payment?.amount === 'number'
        ? Math.round(payment.amount / 100)
        : (period === 'yearly' ? 1990 : 199);

    const subscriptionRecord: SubscriptionRecord = {
      status: 'active',
      cycle: period,
      startedAt: now.toISOString(),
      currentPeriodEnd: expiresAt,
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amountInr,
    };

    // 3. Persist Pro plan & subscription details to server store / Azure SQL / Firebase
    try {
      const cleanUname = typeof username === 'string' ? username.replace(/^@+/, '').toLowerCase().trim() : '';
      const existing = cleanUname
        ? await dbGetProfile(cleanUname).catch(() => null)
        : userId
          ? await dbGetProfileByUserId(String(userId)).catch(() => null)
          : null;

      if (existing) {
        await dbSaveProfile({
          userId: existing.userId || String(userId || 'owner'),
          username: existing.username,
          primaryEmail: existing.primaryEmail || null,
          plan: 'pro',
          subscription: subscriptionRecord,
        });
        await Promise.race([
          firebaseSaveProfile(
            existing.username,
            { ...existing, plan: 'pro', subscription: subscriptionRecord },
            existing.userId
          ).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        invalidatePublicPageCache(existing.username);
      }
    } catch (err) {
      console.error('Error persisting subscription to dbSaveProfile:', err);
    }

    // 4. Update database profile if Supabase is connected
    const supabase = adminClient();
    if (supabase && (userId || username)) {
      try {
        let query = supabase.from('profiles').update({
          plan: 'pro',
        });

        if (userId) {
          query = query.eq('user_id', userId);
        } else if (username) {
          query = query.eq('username', String(username).replace(/^@+/, '').toLowerCase());
        }

        const { error: dbError } = await query;
        if (dbError) {
          console.error('Failed to update profile to pro in db:', dbError);
        }
      } catch (err) {
        console.error('Error updating db profile:', err);
      }
    }

    return Response.json(
      {
        ok: true,
        verified: true,
        plan: 'pro',
        planSource: 'paid',
        period,
        subscribedAt: now.toISOString(),
        expiresAt,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        subscription: subscriptionRecord,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Razorpay verify-payment error:', error);
    return Response.json(
      {
        error: 'verification_failed',
        message: error?.message || 'Verification failed due to an internal error',
      },
      { status: 500 }
    );
  }
}

export async function handleWebhook(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // If signature header is provided, verify it
    if (signature) {
      const isValid = verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.warn('Invalid Razorpay webhook signature');
        return Response.json(
          { error: 'invalid_signature' },
          { status: 400 }
        );
      }
    }

    let event: any = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    const eventType = event?.event;
    console.log('Received Razorpay webhook event:', eventType);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event?.payload?.payment?.entity;
      const notes = paymentEntity?.notes || event?.payload?.order?.entity?.notes || {};
      const userId = notes?.userId;
      const username = notes?.username;
      const period: PlanPeriod = notes?.period === 'yearly' ? 'yearly' : 'monthly';
      const now = new Date();
      const durationDays = period === 'yearly' ? 365 : 30;
      const subscriptionRecord: SubscriptionRecord = {
        status: 'active',
        cycle: period,
        startedAt: now.toISOString(),
        currentPeriodEnd: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentId: paymentEntity?.id || null,
        orderId: paymentEntity?.order_id || null,
        amountInr: typeof paymentEntity?.amount === 'number' ? Math.round(paymentEntity.amount / 100) : null,
      };

      const cleanUname = username ? String(username).replace(/^@+/, '').toLowerCase().trim() : '';
      const existing = cleanUname
        ? await dbGetProfile(cleanUname).catch(() => null)
        : userId
          ? await dbGetProfileByUserId(String(userId)).catch(() => null)
          : null;
      if (existing) {
        await dbSaveProfile({
          userId: existing.userId || String(userId || 'owner'),
          username: existing.username,
          primaryEmail: existing.primaryEmail || null,
          plan: 'pro',
          subscription: subscriptionRecord,
        }).catch(() => {});
        invalidatePublicPageCache(existing.username);
      }

      const supabase = adminClient();
      if (supabase && (userId || username)) {
        let query = supabase.from('profiles').update({ plan: 'pro' });
        if (userId) query = query.eq('user_id', userId);
        else if (username) query = query.eq('username', cleanUname);
        await query;
      }
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay webhook error:', err);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = (
    url.searchParams.get('action') ||
    url.pathname.split('/').pop() ||
    ''
  ).toLowerCase();

  if (action === 'create-order') {
    return handleCreateOrder(request);
  }
  if (action === 'verify-payment') {
    return handleVerifyPayment(request);
  }
  if (action === 'webhook') {
    return handleWebhook(request);
  }

  return Response.json(
    { error: 'unknown_action', message: `Unknown Razorpay action: ${action}` },
    { status: 404 }
  );
}

export default async function handler(req: any, res?: any): Promise<Response | void> {
  if (req instanceof Request || (req && typeof req.text === 'function' && !res)) {
    return POST(req);
  }

  try {
    const protocol = (req.headers && req.headers['x-forwarded-proto']) || 'https';
    const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'iveo.site';
    const url = `${protocol}://${host}${req.url || '/'}`;

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const headers = new Headers();
    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, String(value));
          }
        }
      }
    }

    const webRequest = new Request(url, {
      method: req.method || 'POST',
      headers,
      body,
    });

    const webResponse = await POST(webRequest);

    if (res && typeof res.status === 'function') {
      res.status(webResponse.status);
      webResponse.headers.forEach((val: string, key: string) => {
        res.setHeader(key, val);
      });
      const text = await webResponse.text();
      return res.send(text);
    }

    return webResponse;
  } catch (err: any) {
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: 'internal_error', message: err?.message });
    }
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

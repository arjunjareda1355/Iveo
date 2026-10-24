import {
  verifyPaymentSignature,
  fetchRazorpayPayment,
  PlanPeriod,
} from '../_lib/razorpay.js';
import { adminClient } from '../_lib/supabase.js';

export async function POST(request: Request): Promise<Response> {
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

    // 3. Update database profile if Supabase is connected
    const supabase = adminClient();
    if (supabase && (userId || username)) {
      try {
        let query = supabase.from('profiles').update({
          plan: 'pro',
        });

        if (userId) {
          query = query.eq('user_id', userId);
        } else if (username) {
          query = query.eq('username', String(username).toLowerCase());
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
        period,
        subscribedAt: now.toISOString(),
        expiresAt,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
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

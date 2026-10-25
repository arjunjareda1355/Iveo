import {
  createRazorpayOrder,
  type PlanPeriod,
  type PaymentCurrency,
} from '../_lib/razorpay.ts';
import { getRazorpayKeyId } from '../_lib/env.ts';

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

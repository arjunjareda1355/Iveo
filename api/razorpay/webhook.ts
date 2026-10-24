import { verifyWebhookSignature } from '../_lib/razorpay.js';
import { adminClient } from '../_lib/supabase.js';

export async function POST(request: Request): Promise<Response> {
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

      const supabase = adminClient();
      if (supabase && (userId || username)) {
        let query = supabase.from('profiles').update({ plan: 'pro' });
        if (userId) query = query.eq('user_id', userId);
        else if (username) query = query.eq('username', String(username).toLowerCase());
        await query;
      }
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay webhook error:', err);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

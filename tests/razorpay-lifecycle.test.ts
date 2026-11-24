import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { terminate } from 'firebase/firestore';
import { serverDb } from '../api/_lib/firebaseServer';
import { dbClaimUsername, dbGetBlocks, dbGetProfile, dbSaveBlocks } from '../api/_lib/azureSql';
import {
  activateOrRenewSubscription,
  adminInspectBilling,
  adminReconcileBilling,
  cancelBillingSubscription,
  getBillingSnapshot,
  getVerifiedInvoice,
  processWebhookEvent,
  reactivateBillingSubscription,
  recordCheckoutPending,
  switchBillingCycle,
} from '../api/_lib/billingService';
import { handleWebhook } from '../api/razorpay';
import { generateInvoicePdf } from '../src/lib/invoicePdf';
import { resolveEffectivePlan } from '../src/lib/plan';

const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-billing-test-'));
const prevDataDir = process.env.IVEO_DATA_DIR;
const prevWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
process.env.IVEO_DATA_DIR = tmpDataDir;
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_123';

function signWebhook(rawBody: string, secret: string = process.env.RAZORPAY_WEBHOOK_SECRET!) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

test('Billing lifecycle covers all 8 states, 3-day grace, cycle switch, data preservation, and zero fake invoices', async () => {
  const userId = 'user_lifecycle_1';
  const username = 'billcreator';
  const email = 'creator@example.com';

  // Use a future signup date (post 2027) so early-bird promo doesn't mask paid lifecycle states
  const futureCreatedAt = '2027-06-01T00:00:00.000Z';
  const claimRes = await dbClaimUsername(
    userId,
    username,
    {
      displayName: 'Billing Creator',
      bio: 'Creator bio',
      createdAt: futureCreatedAt,
      plan: 'free',
    },
    email
  );
  assert.equal(claimRes.ok, true);

  // Save a custom link block to verify downgrade/immediate-cancellation preserves user data
  await dbSaveBlocks(
    username,
    [
      {
        id: 'blk_keep_1',
        kind: 'link',
        title: 'My Portfolio',
        url: 'https://portfolio.example.com',
        isActive: true,
        isArchived: false,
        position: 0,
      },
    ],
    userId,
    email
  );

  const t0 = Date.parse('2027-06-02T10:00:00.000Z');

  // 1. Free state — zero fake invoices or history
  const freeSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 });
  assert.equal(freeSnap.plan, 'free');
  assert.equal(freeSnap.lifecycleState, 'free');
  assert.equal(freeSnap.billingHistory.length, 0);
  assert.equal(freeSnap.invoices.length, 0);

  // Unpaid invoice lookup strictly rejected
  const missingInv = await getVerifiedInvoice({ username, userId, email, invoiceId: 'INV-FAKE-1' });
  assert.equal(missingInv.ok, false);
  assert.throws(() => generateInvoicePdf({ customerName: 'X', username, status: 'failed' }));

  // 2. Checkout pending
  await recordCheckoutPending({
    username,
    userId,
    email,
    period: 'monthly',
    currency: 'INR',
    orderId: 'order_init_1',
    amountMinor: 49900,
    nowMs: t0 + 1000,
  });
  const pendingSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 + 1000 });
  assert.equal(pendingSnap.lifecycleState, 'checkout_pending');
  assert.equal(pendingSnap.billingHistory[0]?.status, 'pending');
  assert.equal(pendingSnap.invoices.length, 0);

  // 3. Payment authentication (webhook payment.authorized)
  await processWebhookEvent({
    eventIdHeader: 'evt_auth_1',
    nowMs: t0 + 2000,
    event: {
      event: 'payment.authorized',
      created_at: 1811930402,
      payload: {
        payment: {
          entity: {
            id: 'pay_first_1',
            order_id: 'order_init_1',
            method: 'upi',
            vpa: 'creator@okaxis',
            notes: { username, userId, email, period: 'monthly' },
          },
        },
      },
    },
  });
  const authSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 + 2000 });
  assert.equal(authSnap.lifecycleState, 'payment_authentication');

  // 4. Active (payment captured)
  await processWebhookEvent({
    eventIdHeader: 'evt_cap_1',
    nowMs: t0 + 3000,
    event: {
      event: 'payment.captured',
      created_at: 1811930403,
      payload: {
        payment: {
          entity: {
            id: 'pay_first_1',
            order_id: 'order_init_1',
            amount: 49900,
            currency: 'INR',
            method: 'upi',
            vpa: 'creator@okaxis',
            notes: { username, userId, email, period: 'monthly' },
          },
        },
      },
    },
  });

  // Duplicate webhook with same eventIdHeader must be safely deduplicated
  const dupRes = await processWebhookEvent({
    eventIdHeader: 'evt_cap_1',
    nowMs: t0 + 4000,
    event: { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_first_1' } } } },
  });
  assert.equal(dupRes.deduplicated, true);

  const activeSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 + 5000 });
  assert.equal(activeSnap.plan, 'pro');
  assert.equal(activeSnap.lifecycleState, 'active');
  assert.equal(activeSnap.billingHistory.length, 1);
  assert.equal(activeSnap.billingHistory[0]?.status, 'paid');
  assert.equal(activeSnap.invoices.length, 1);
  assert.match(activeSnap.subscription?.paymentMethodSummary || '', /UPI/);

  // Verified invoice downloadable for paid transaction
  const invRes = await getVerifiedInvoice({
    username,
    userId,
    email,
    invoiceId: activeSnap.invoices[0]!.id,
  });
  assert.equal(invRes.ok, true);

  // Switch cycle monthly -> yearly
  const switched = await switchBillingCycle({
    username,
    userId,
    email,
    targetCycle: 'yearly',
    nowMs: t0 + 6000,
  });
  assert.equal(switched.ok, true);
  if (switched.ok) {
    assert.equal(switched.subscription?.cycle, 'yearly');
    assert.equal(switched.subscription?.amountMinor, 499900);
  }

  // 5. Renewal (second successful charge)
  await activateOrRenewSubscription({
    username,
    userId,
    email,
    period: 'yearly',
    currency: 'INR',
    orderId: 'order_renew_2',
    paymentId: 'pay_renew_2',
    paymentEntity: { method: 'card', card: { network: 'Visa', last4: '4242' }, amount: 499900, currency: 'INR' },
    nowMs: t0 + 7000,
  });
  const renewalSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 + 7000 });
  assert.equal(renewalSnap.lifecycleState, 'renewal');
  assert.equal(renewalSnap.invoices.length, 2);

  // 6. Payment failed triggers 3-day grace period preserving Pro
  await processWebhookEvent({
    eventIdHeader: 'evt_fail_1',
    nowMs: t0 + 8000,
    event: {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_1',
            order_id: 'order_fail_1',
            amount: 499900,
            currency: 'INR',
            error_description: 'Insufficient funds',
            notes: { username, userId, email, period: 'yearly' },
          },
        },
      },
    },
  });
  const graceSnap = await getBillingSnapshot({ username, userId, email, nowMs: t0 + 8000 });
  assert.equal(graceSnap.gracePeriod.inGracePeriod, true);
  assert.equal(graceSnap.gracePeriod.daysRemaining, 3);
  assert.equal(graceSnap.plan, 'pro');

  // 7. Scheduled cancellation keeps Pro until currentPeriodEnd, then reactivates
  const schedRes = await cancelBillingSubscription({
    username,
    userId,
    email,
    mode: 'end_of_period',
    reason: 'Seasonal break',
    nowMs: t0 + 9000,
  });
  assert.equal(schedRes.ok, true);
  if (schedRes.ok) {
    assert.equal(schedRes.lifecycleState, 'scheduled_cancellation');
    assert.equal(schedRes.plan, 'pro');
  }

  const reactRes = await reactivateBillingSubscription({
    username,
    userId,
    email,
    nowMs: t0 + 10_000,
  });
  assert.equal(reactRes.ok, true);
  if (reactRes.ok) {
    assert.equal(reactRes.lifecycleState, 'active');
  }

  // 8. Immediate cancellation drops Pro immediately with no refund, while preserving blocks
  const immRes = await cancelBillingSubscription({
    username,
    userId,
    email,
    mode: 'immediate',
    reason: 'Switching accounts',
    nowMs: t0 + 11_000,
  });
  assert.equal(immRes.ok, true);
  if (immRes.ok) {
    assert.equal(immRes.lifecycleState, 'immediate_cancellation');
    assert.equal(immRes.plan, 'free');
  }

  const preservedBlocks = await dbGetBlocks(username);
  assert.equal(preservedBlocks.length, 1);
  assert.equal(preservedBlocks[0]?.id, 'blk_keep_1');

  const storedProfile = await dbGetProfile(username);
  assert.equal(storedProfile?.displayName, 'Billing Creator');

  // Admin inspect + reconcile to expired state
  const inspected = await adminInspectBilling(username, t0 + 12_000);
  assert.equal(inspected.ok, true);
  if (inspected.ok) {
    assert.ok(inspected.auditLogs.length >= 6);
  }
  const expiredAdmin = await adminReconcileBilling({
    adminEmail: 'admin@iveo.site',
    username,
    action: 'expire_now',
    nowMs: t0 + 13_000,
  });
  assert.equal(expiredAdmin.ok, true);
  if (expiredAdmin.ok) {
    assert.equal(expiredAdmin.lifecycleState, 'expired');
    assert.equal(expiredAdmin.plan, 'free');
  }

  // Verify resolveEffectivePlan expires active paid period after currentPeriodEnd when grace ended
  const elapsedCheck = resolveEffectivePlan({
    email,
    storedPlan: 'pro',
    createdAt: futureCreatedAt,
    subscription: {
      status: 'active',
      currentPeriodEnd: '2027-07-01T00:00:00.000Z',
      gracePeriodEndsAt: '2027-07-04T00:00:00.000Z',
      paymentId: 'pay_x',
    },
    nowMs: Date.parse('2027-07-05T00:00:00.000Z'),
  });
  assert.equal(elapsedCheck.plan, 'free');
});

test('Webhook endpoint enforces strict raw-body HMAC signature verification', async () => {
  const payload = JSON.stringify({ event: 'payment.authorized', payload: {} });

  // Missing signature -> 400
  const missingSigRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      body: payload,
    })
  );
  assert.equal(missingSigRes.status, 400);

  // Tampered signature -> 400
  const badSigRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': '00000000000000000000000000000000' },
      body: payload,
    })
  );
  assert.equal(badSigRes.status, 400);

  // Valid signature -> 200
  const validSig = signWebhook(payload);
  const okRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'evt_raw_hmac_ok_1',
      },
      body: payload,
    })
  );
  assert.equal(okRes.status, 200);
});

after(async () => {
  if (serverDb) {
    await terminate(serverDb).catch(() => {});
  }
  if (prevDataDir === undefined) delete process.env.IVEO_DATA_DIR;
  else process.env.IVEO_DATA_DIR = prevDataDir;
  if (prevWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = prevWebhookSecret;
  fs.rmSync(tmpDataDir, { recursive: true, force: true });
});

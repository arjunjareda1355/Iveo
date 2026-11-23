import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iveo-billing-lifecycle-'));
process.env.IVEO_DATA_DIR = tempDir;
process.env.IVEO_DISABLE_REMOTE_DB = '1';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_iveo_123';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_iveo_123';

import {
  dbClaimUsername,
  dbGetBlocks,
  dbGetProfile,
  dbSaveBlocks,
} from '../api/_lib/azureSql.ts';
import {
  activateOrRenewSubscription,
  adminInspectBilling,
  adminReconcileBilling,
  cancelBillingSubscription,
  getBillingSnapshot,
  getVerifiedInvoice,
  markPaymentAuthentication,
  processWebhookEvent,
  reactivateBillingSubscription,
  recordCheckoutPending,
  switchBillingCycle,
} from '../api/_lib/billingService.ts';
import { handleWebhook } from '../api/razorpay.ts';
import {
  GRACE_PERIOD_DAYS,
  normalizeSubscriptionLifecycleState,
  resolveEffectivePlan,
} from '../src/lib/plan.ts';
import { generateInvoicePdf } from '../src/lib/invoicePdf.ts';

function signWebhookPayload(rawBody: string): string {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
}

after(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
});

test('Full 8-state Razorpay lifecycle: free -> checkout_pending -> payment_authentication -> active -> renewal -> scheduled_cancellation -> expired -> immediate_cancellation', async () => {
  const nowMs = Date.UTC(2027, 2, 1, 12, 0, 0); // After early-bird cutoff (2027)
  const uname = 'billingcreator';
  const uid = 'user_billing_1';
  const email = 'creator@example.com';

  await dbClaimUsername(
    uid,
    uname,
    {
      displayName: 'Billing Creator',
      bio: 'Testing billing states',
      createdAt: new Date(nowMs).toISOString(),
    },
    email
  );
  await dbSaveBlocks(
    uname,
    [{ id: 'blk-1', kind: 'link', title: 'Portfolio', url: 'https://example.com', isActive: true }],
    uid,
    email
  );

  // 1. Free state + zero fake invoices
  const snapFree = await getBillingSnapshot({ username: uname, userId: uid, email, nowMs });
  assert.equal(snapFree.plan, 'free');
  assert.equal(snapFree.lifecycleState, 'free');
  assert.equal(snapFree.billingHistory.length, 0);
  assert.equal(snapFree.invoices.length, 0);

  // 2. Checkout pending
  await recordCheckoutPending({
    username: uname,
    userId: uid,
    email,
    period: 'monthly',
    currency: 'INR',
    orderId: 'order_init_1',
    amountMinor: 49900,
    nowMs: nowMs + 1000,
  });
  const snapCheckout = await getBillingSnapshot({ username: uname, userId: uid, email, nowMs: nowMs + 2000 });
  assert.equal(snapCheckout.lifecycleState, 'checkout_pending');
  assert.equal(snapCheckout.plan, 'free'); // checkout_pending must NOT grant Pro yet
  assert.equal(snapCheckout.invoices.length, 0);

  // 3. Payment authentication (payment.authorized)
  await markPaymentAuthentication({
    username: uname,
    userId: uid,
    email,
    orderId: 'order_init_1',
    paymentId: 'pay_init_1',
    paymentEntity: { method: 'upi', vpa: 'creator@upi' },
    nowMs: nowMs + 3000,
  });
  const snapAuth = await getBillingSnapshot({ username: uname, userId: uid, email, nowMs: nowMs + 4000 });
  assert.equal(snapAuth.lifecycleState, 'payment_authentication');
  assert.equal(snapAuth.plan, 'free');
  assert.equal(snapAuth.invoices.length, 0);

  // 4. Active paid Pro (payment captured)
  const activated = await activateOrRenewSubscription({
    username: uname,
    userId: uid,
    email,
    period: 'monthly',
    currency: 'INR',
    orderId: 'order_init_1',
    paymentId: 'pay_init_1',
    paymentEntity: { method: 'upi', vpa: 'creator@upi', amount: 49900, currency: 'INR' },
    nowMs: nowMs + 5000,
  });
  assert.equal(activated.plan, 'pro');
  assert.equal(activated.lifecycleState, 'active');

  const snapActive = await getBillingSnapshot({ username: uname, userId: uid, email, nowMs: nowMs + 6000 });
  assert.equal(snapActive.lifecycleState, 'active');
  assert.equal(snapActive.invoices.length, 1);
  assert.equal(snapActive.billingHistory.filter((h) => h.status === 'paid').length, 1);
  assert.match(snapActive.subscription?.paymentMethodSummary || '', /^UPI/);

  // 5. Renewal on second verified payment
  const renewed = await activateOrRenewSubscription({
    username: uname,
    userId: uid,
    email,
    period: 'monthly',
    currency: 'INR',
    orderId: 'order_ren_2',
    paymentId: 'pay_ren_2',
    paymentEntity: { method: 'card', card: { network: 'Visa', last4: '4242' }, amount: 49900, currency: 'INR' },
    nowMs: nowMs + 20 * 86400_000,
  });
  assert.equal(renewed.lifecycleState, 'renewal');
  assert.equal(renewed.plan, 'pro');

  // Switch billing cycle monthly -> yearly
  const switched = await switchBillingCycle({
    username: uname,
    userId: uid,
    email,
    targetCycle: 'yearly',
    nowMs: nowMs + 21 * 86400_000,
  });
  assert.equal(switched.ok, true);
  if (switched.ok) {
    assert.equal(switched.subscription?.cycle, 'yearly');
    assert.equal(switched.subscription?.amountMinor, 499900);
  }

  // 6. Scheduled cancellation retains Pro until currentPeriodEnd
  const schedCancel = await cancelBillingSubscription({
    username: uname,
    userId: uid,
    email,
    mode: 'end_of_period',
    reason: 'Taking a short break',
    nowMs: nowMs + 22 * 86400_000,
  });
  assert.equal(schedCancel.ok, true);
  if (schedCancel.ok) {
    assert.equal(schedCancel.lifecycleState, 'scheduled_cancellation');
    assert.equal(schedCancel.plan, 'pro');
    assert.equal(schedCancel.subscription?.cancelReason, 'Taking a short break');
  }

  // Reactivate before period end succeeds
  const reactivated = await reactivateBillingSubscription({
    username: uname,
    userId: uid,
    email,
    nowMs: nowMs + 23 * 86400_000,
  });
  assert.equal(reactivated.ok, true);
  if (reactivated.ok) {
    assert.equal(reactivated.lifecycleState, 'active');
    assert.equal(reactivated.subscription?.cancelAtPeriodEnd, false);
  }

  // 7. Expired state after currentPeriodEnd elapses
  const pastEndMs = Date.parse(reactivated.ok ? reactivated.subscription!.currentPeriodEnd! : '') + 60_000;
  const snapExpired = await getBillingSnapshot({
    username: uname,
    userId: uid,
    email,
    nowMs: pastEndMs,
  });
  assert.equal(snapExpired.lifecycleState, 'expired');
  assert.equal(snapExpired.plan, 'free');

  // Reactivate rejects expired subscription
  const reactivateExpired = await reactivateBillingSubscription({
    username: uname,
    userId: uid,
    email,
    nowMs: pastEndMs,
  });
  assert.equal(reactivateExpired.ok, false);

  // 8. Immediate cancellation drops Pro immediately while preserving blocks & profile data
  await activateOrRenewSubscription({
    username: uname,
    userId: uid,
    email,
    period: 'monthly',
    currency: 'INR',
    orderId: 'order_3',
    paymentId: 'pay_3',
    nowMs: pastEndMs + 1000,
  });
  const immCancel = await cancelBillingSubscription({
    username: uname,
    userId: uid,
    email,
    mode: 'immediate',
    reason: 'No longer needed',
    nowMs: pastEndMs + 2000,
  });
  assert.equal(immCancel.ok, true);
  if (immCancel.ok) {
    assert.equal(immCancel.lifecycleState, 'immediate_cancellation');
    assert.equal(immCancel.plan, 'free');
  }

  // Data preservation verified
  const preservedProfile = await dbGetProfile(uname);
  const preservedBlocks = await dbGetBlocks(uname);
  assert.equal(preservedProfile?.displayName, 'Billing Creator');
  assert.equal(preservedBlocks.length, 1);
  assert.equal(preservedBlocks[0].title, 'Portfolio');
});

test('Raw-body webhook signature validation, duplicate event idempotency, 3-day grace period, and refund downgrade', async () => {
  const baseMs = Date.UTC(2027, 4, 1, 10, 0, 0);
  const uname = 'webhookuser';
  const uid = 'user_wh_1';
  const email = 'wh@example.com';

  await dbClaimUsername(uid, uname, { createdAt: new Date(baseMs).toISOString() }, email);

  const capturePayload = JSON.stringify({
    event: 'payment.captured',
    created_at: Math.floor(baseMs / 1000),
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_100',
          order_id: 'ord_wh_100',
          amount: 49900,
          currency: 'INR',
          method: 'netbanking',
          bank: 'HDFC',
          notes: { username: uname, userId: uid, email, period: 'monthly' },
        },
      },
    },
  });

  // Missing signature rejected with 400
  const missingSigRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: capturePayload,
    })
  );
  assert.equal(missingSigRes.status, 400);

  // Tampered signature rejected with 400
  const badSigRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'deadbeef',
      },
      body: capturePayload,
    })
  );
  assert.equal(badSigRes.status, 400);

  // Valid signature succeeds
  const validSig = signWebhookPayload(capturePayload);
  const okRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'evt_unique_100',
      },
      body: capturePayload,
    })
  );
  assert.equal(okRes.status, 200);
  const okJson = await okRes.json();
  assert.equal(okJson.deduplicated, false);

  // Duplicate delivery deduplicated cleanly
  const dupRes = await handleWebhook(
    new Request('https://iveo.site/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'evt_unique_100',
      },
      body: capturePayload,
    })
  );
  assert.equal(dupRes.status, 200);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.deduplicated, true);

  // Verify 3-day grace period on payment.failed webhook even after nominal period expires
  const failNowMs = baseMs + 31 * 86400_000;
  await processWebhookEvent({
    eventIdHeader: 'evt_fail_101',
    nowMs: failNowMs,
    event: {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_fail_101',
            order_id: 'ord_wh_fail_101',
            amount: 49900,
            currency: 'INR',
            error_description: 'Insufficient funds',
            notes: { username: uname, userId: uid, email, period: 'monthly' },
          },
        },
      },
    },
  });

  // Inside 3-day grace window -> remains Pro
  const insideGrace = await getBillingSnapshot({
    username: uname,
    userId: uid,
    email,
    nowMs: failNowMs + (GRACE_PERIOD_DAYS - 1) * 86400_000,
  });
  assert.equal(insideGrace.plan, 'pro');
  assert.equal(insideGrace.gracePeriod.inGracePeriod, true);

  // Past 3-day grace window -> downgraded to free/expired
  const afterGrace = await getBillingSnapshot({
    username: uname,
    userId: uid,
    email,
    nowMs: failNowMs + GRACE_PERIOD_DAYS * 86400_000 + 60_000,
  });
  assert.equal(afterGrace.plan, 'free');
  assert.equal(afterGrace.lifecycleState, 'expired');
  assert.equal(afterGrace.gracePeriod.inGracePeriod, false);

  // Verify refund webhook marks transaction refunded and denies invoice access afterward
  await processWebhookEvent({
    eventIdHeader: 'evt_refund_100',
    nowMs: failNowMs + 1000,
    event: {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_100',
            payment_id: 'pay_wh_100',
            amount: 49900,
            notes: { username: uname, userId: uid, email },
          },
        },
      },
    },
  });

  const postRefund = await getBillingSnapshot({
    username: uname,
    userId: uid,
    email,
    nowMs: failNowMs + 2000,
  });
  assert.equal(postRefund.invoices.length, 0);
  const refundedTx = postRefund.billingHistory.find((h) => h.paymentId === 'pay_wh_100');
  assert.equal(refundedTx?.status, 'refunded');

  const invoiceGate = await getVerifiedInvoice({
    username: uname,
    userId: uid,
    email,
    invoiceId: 'pay_wh_100',
  });
  assert.equal(invoiceGate.ok, false);
});

test('Invoice PDF generation strictly rejects non-paid statuses and admin reconciliation creates audit logs', async () => {
  assert.throws(
    () =>
      generateInvoicePdf({
        customerName: 'Unpaid User',
        username: 'unpaid',
        status: 'pending',
      }),
    /verified paid transactions/i
  );

  const doc = generateInvoicePdf({
    customerName: 'Paid Creator',
    username: 'paidcreator',
    status: 'paid',
    amount: 499,
    currency: 'INR',
    paymentId: 'pay_ok_1',
    orderId: 'ord_ok_1',
    paymentMethodSummary: 'UPI (cr•••@upi)',
  });
  assert.ok(doc);

  // Admin inspect & reconcile
  const targetUser = 'admintest';
  await dbClaimUsername('uid_adm_1', targetUser, { createdAt: '2027-06-01T00:00:00.000Z' }, 'u@example.com');
  const reconciled = await adminReconcileBilling({
    adminEmail: 'admin@iveo.site',
    username: targetUser,
    action: 'activate_paid',
    period: 'yearly',
    note: 'Manual reconciliation',
  });
  assert.equal(reconciled.ok, true);
  if (reconciled.ok) {
    assert.equal(reconciled.plan, 'pro');
    assert.equal(reconciled.lifecycleState, 'active');
    assert.ok(reconciled.auditLogs.some((l) => l.actor === 'admin'));
  }

  const inspected = await adminInspectBilling(targetUser);
  assert.equal(inspected.ok, true);
});

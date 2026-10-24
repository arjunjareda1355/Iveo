import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyPaymentSignature,
  PRICING_CONFIG,
} from '../../api/_lib/razorpay.js';

test('razorpay: PRICING_CONFIG defines valid pricing structures', () => {
  assert.equal(PRICING_CONFIG.INR.monthly.amount, 49900);
  assert.equal(PRICING_CONFIG.INR.yearly.amount, 499900);
  assert.equal(PRICING_CONFIG.USD.monthly.amount, 600);
  assert.equal(PRICING_CONFIG.USD.yearly.amount, 6000);
});

test('razorpay: verifyPaymentSignature correctly validates authentic HMAC signatures', () => {
  const orderId = 'order_test123';
  const paymentId = 'pay_test456';
  const secret = 'Veqs5nBUkzIGLOOdFGQW0908';

  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const isValid = verifyPaymentSignature(orderId, paymentId, validSignature);
  assert.equal(isValid, true, 'Valid signature must return true');
});

test('razorpay: verifyPaymentSignature rejects forged or tampered signatures', () => {
  const orderId = 'order_test123';
  const paymentId = 'pay_test456';

  const forgedSignature = 'bad0000000000000000000000000000000000000000000000000000000000000';
  assert.equal(
    verifyPaymentSignature(orderId, paymentId, forgedSignature),
    false,
    'Forged signature must be rejected'
  );

  assert.equal(
    verifyPaymentSignature(orderId, 'tampered_payment_id', 'valid_sig'),
    false,
    'Tampered payment id must be rejected'
  );

  assert.equal(
    verifyPaymentSignature('', '', ''),
    false,
    'Empty params must be rejected'
  );
});

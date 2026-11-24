import crypto from 'node:crypto';
import {
  dbGetProfile,
  dbGetProfileByUserId,
  dbReadUserBilling,
  dbSaveProfile,
  dbUpdateUserBilling,
  dbVerifyOwnership,
} from './azureSql.ts';
import {
  firebaseGetProfile,
  firebaseGetProfileByUserId,
  firebaseSaveProfile,
} from './firebaseServer.ts';
import { PRICING_CONFIG, type PaymentCurrency, type PlanPeriod } from './razorpay.ts';
import { isPrivilegedEmailServer } from './usernames.ts';
import {
  EARLY_BIRD_PRO_DEADLINE_ISO,
  GRACE_PERIOD_DAYS,
  formatMinorCurrency,
  getGracePeriodInfo,
  normalizeSubscriptionLifecycleState,
  resolveEffectivePlan,
  type BillingCurrency,
  type BillingHistoryRecord,
  type BillingNotification,
  type GracePeriodInfo,
  type InvoiceRecord,
  type PlanSource,
  type SubscriptionAuditLog,
  type SubscriptionCycle,
  type SubscriptionLifecycleState,
  type SubscriptionRecord,
  type UserBillingStore,
} from '../../src/lib/plan.ts';

const processedWebhookIdsMemory = new Set<string>();

export function createDefaultBillingStore(): UserBillingStore {
  return {
    billingHistory: [],
    invoices: [],
    notifications: [],
    auditLogs: [],
    processedWebhookEvents: [],
  };
}

export function formatPaymentMethodSummary(paymentEntity: any): string | null {
  if (!paymentEntity || typeof paymentEntity !== 'object') return null;
  const method = String(paymentEntity.method || '').toLowerCase().trim();
  if (!method) return null;

  if (method === 'upi') {
    const vpa = typeof paymentEntity.vpa === 'string' ? paymentEntity.vpa.trim() : '';
    if (vpa && vpa.includes('@')) {
      const [local, domain] = vpa.split('@');
      const maskedLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}•••`;
      return `UPI (${maskedLocal}@${domain})`;
    }
    return 'UPI';
  }

  if (method === 'card') {
    const network = String(paymentEntity.card?.network || paymentEntity.card_network || '').trim();
    const last4 = String(paymentEntity.card?.last4 || paymentEntity.card_last4 || '').trim();
    const parts = ['Card', network, last4 ? `····${last4}` : ''].filter(Boolean);
    return parts.join(' · ');
  }

  if (method === 'netbanking') {
    const bank = String(paymentEntity.bank || '').trim();
    return bank ? `Netbanking · ${bank}` : 'Netbanking';
  }

  if (method === 'wallet') {
    const wallet = String(paymentEntity.wallet || '').trim();
    return wallet ? `Wallet · ${wallet}` : 'Wallet';
  }

  if (method === 'emi') {
    return 'EMI';
  }

  if (method === 'paylater') {
    return 'Pay Later';
  }

  return method.charAt(0).toUpperCase() + method.slice(1);
}

function appendUniqueNotification(
  store: UserBillingStore,
  notif: Omit<BillingNotification, 'id' | 'createdAt'> & { createdAt?: string }
): UserBillingStore {
  if (notif.eventKey && store.notifications.some((n) => n.eventKey === notif.eventKey)) {
    return store;
  }
  const entry: BillingNotification = {
    id: `notif_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    kind: notif.kind,
    title: notif.title,
    message: notif.message,
    createdAt: notif.createdAt || new Date().toISOString(),
    eventKey: notif.eventKey ?? null,
    read: notif.read ?? false,
  };
  return {
    ...store,
    notifications: [entry, ...store.notifications].slice(0, 50),
  };
}

function appendAuditLog(
  store: UserBillingStore,
  entry: Omit<SubscriptionAuditLog, 'id' | 'createdAt'> & { createdAt?: string }
): UserBillingStore {
  const log: SubscriptionAuditLog = {
    id: `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    action: entry.action,
    actor: entry.actor,
    actorEmail: entry.actorEmail ?? null,
    fromState: entry.fromState,
    toState: entry.toState,
    reason: entry.reason ?? null,
    orderId: entry.orderId ?? null,
    paymentId: entry.paymentId ?? null,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  return {
    ...store,
    auditLogs: [log, ...store.auditLogs].slice(0, 200),
  };
}

function resolveCurrency(raw?: string | null): BillingCurrency {
  return String(raw || '').toUpperCase() === 'USD' ? 'USD' : 'INR';
}

function resolvePeriod(raw?: string | null): PlanPeriod {
  return String(raw || '').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
}

function resolveAmountMinor(period: PlanPeriod, currency: BillingCurrency, rawAmount?: number | null): number {
  if (typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount > 0) {
    return Math.round(rawAmount);
  }
  return PRICING_CONFIG[currency][period].amount;
}

async function resolveProfileByIdentifiers(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
}) {
  const cleanUname = (params.username || '').replace(/^@+/, '').toLowerCase().trim();
  if (cleanUname) {
    const byName = await dbGetProfile(cleanUname).catch(() => null);
    if (byName) return byName;
    const fbByName = await Promise.race([
      firebaseGetProfile(cleanUname).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (fbByName) return fbByName;
  }
  const cleanUid = (params.userId || '').trim();
  const cleanEmail = (params.email || '').toLowerCase().trim() || null;
  if (cleanUid || cleanEmail) {
    const byUid = await dbGetProfileByUserId(cleanUid, cleanEmail).catch(() => null);
    if (byUid) return byUid;
    return await Promise.race([
      firebaseGetProfileByUserId(cleanUid, cleanEmail).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
  }
  return null;
}

async function syncProfileRecord(existing: any, nextPlan: 'free' | 'pro', subscription: SubscriptionRecord | null) {
  const saveRes = await dbSaveProfile({
    ...existing,
    userId: existing.userId || 'owner',
    username: existing.username,
    primaryEmail: existing.primaryEmail || null,
    plan: nextPlan,
    subscription,
  });
  await Promise.race([
    firebaseSaveProfile(
      existing.username,
      saveRes?.profile || { ...existing, plan: nextPlan, subscription },
      existing.userId
    ).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

export async function recordCheckoutPending(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  period: PlanPeriod;
  currency: PaymentCurrency;
  orderId: string;
  amountMinor?: number | null;
  nowMs?: number;
}): Promise<{ username: string | null }> {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return { username: null };
  }

  const period = resolvePeriod(params.period);
  const currency = resolveCurrency(params.currency);
  const amountMinor = resolveAmountMinor(period, currency, params.amountMinor);
  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const resolvedCurrent = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, resolvedCurrent.isPro, nowMs);

  // Only transition subscription status to checkout_pending if not already an active/grace paid subscription
  const keepExistingActivePaid =
    resolvedCurrent.isPro &&
    resolvedCurrent.planSource === 'paid' &&
    (fromState === 'active' || fromState === 'renewal' || fromState === 'scheduled_cancellation');

  const nextSub: SubscriptionRecord = keepExistingActivePaid
    ? {
        ...(prevSub as SubscriptionRecord),
        updatedAt: nowIso,
      }
    : {
        status: 'checkout_pending',
        cycle: period,
        startedAt: prevSub.startedAt ?? null,
        currentPeriodStart: prevSub.currentPeriodStart ?? null,
        currentPeriodEnd: prevSub.currentPeriodEnd ?? null,
        nextBillingAt: prevSub.nextBillingAt ?? null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        cancelReason: null,
        gracePeriodEndsAt: null,
        lastPaymentFailedAt: prevSub.lastPaymentFailedAt ?? null,
        paymentId: prevSub.paymentId ?? null,
        orderId: params.orderId,
        subscriptionId: prevSub.subscriptionId ?? params.orderId,
        customerId: prevSub.customerId ?? null,
        currency,
        amountMinor,
        amountInr: currency === 'INR' ? Math.round(amountMinor / 100) : prevSub.amountInr ?? null,
        paymentMethodSummary: prevSub.paymentMethodSummary ?? null,
        lastEventId: prevSub.lastEventId ?? null,
        updatedAt: nowIso,
      };

  await syncProfileRecord(existing, resolvedCurrent.plan, nextSub);

  await dbUpdateUserBilling(existing.username, (prevStore) => {
    let store = { ...prevStore };
    const alreadyHasOrder = store.billingHistory.some((h) => h.orderId === params.orderId);
    if (!alreadyHasOrder) {
      const pendingEntry: BillingHistoryRecord = {
        id: `tx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        date: nowIso,
        amountMinor,
        amountDisplay: formatMinorCurrency(amountMinor, currency),
        currency,
        status: 'pending',
        cycle: period,
        orderId: params.orderId,
        paymentId: null,
        subscriptionId: nextSub.subscriptionId ?? params.orderId,
        invoiceNumber: null,
        invoiceAvailable: false,
        paymentMethodSummary: null,
        description: `iveo Pro (${period}) checkout initiated`,
      };
      store.billingHistory = [pendingEntry, ...store.billingHistory].slice(0, 100);
    }

    store = appendUniqueNotification(store, {
      kind: 'info',
      title: 'Checkout initiated',
      message: `Awaiting Razorpay confirmation for ${formatMinorCurrency(amountMinor, currency)} (${period}).`,
      eventKey: `checkout:${params.orderId}`,
      createdAt: nowIso,
    });

    store = appendAuditLog(store, {
      action: 'checkout_initiated',
      actor: 'user',
      actorEmail: params.email || existing.primaryEmail || null,
      fromState,
      toState: keepExistingActivePaid ? fromState : 'checkout_pending',
      orderId: params.orderId,
      createdAt: nowIso,
    });
    return store;
  });

  return { username: existing.username };
}

export async function markPaymentAuthentication(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  paymentEntity?: any;
  eventId?: string | null;
  nowMs?: number;
}): Promise<{ username: string | null }> {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) return { username: null };

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const resolvedCurrent = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, resolvedCurrent.isPro, nowMs);

  if (fromState === 'free' || fromState === 'checkout_pending' || fromState === 'expired') {
    const nextSub: SubscriptionRecord = {
      status: 'payment_authentication',
      cycle: prevSub.cycle ?? null,
      startedAt: prevSub.startedAt ?? null,
      currentPeriodStart: prevSub.currentPeriodStart ?? null,
      currentPeriodEnd: prevSub.currentPeriodEnd ?? null,
      nextBillingAt: prevSub.nextBillingAt ?? null,
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      paymentId: params.paymentId ?? prevSub.paymentId ?? null,
      orderId: params.orderId ?? prevSub.orderId ?? null,
      subscriptionId: prevSub.subscriptionId ?? params.orderId ?? null,
      amountInr: prevSub.amountInr ?? null,
      amountMinor: prevSub.amountMinor ?? null,
      currency: prevSub.currency ?? null,
      paymentMethodSummary:
        formatPaymentMethodSummary(params.paymentEntity) || prevSub.paymentMethodSummary || null,
      lastEventId: params.eventId ?? prevSub.lastEventId ?? null,
      updatedAt: nowIso,
    };
    await syncProfileRecord(existing, resolvedCurrent.plan, nextSub);
  }

  await dbUpdateUserBilling(existing.username, (prevStore) => {
    let store = appendUniqueNotification(prevStore, {
      kind: 'info',
      title: 'Payment awaiting capture',
      message: 'Razorpay authorized your payment and is finalizing settlement.',
      eventKey: `auth:${params.paymentId || params.orderId || nowIso}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: 'payment_authorized',
      actor: 'webhook',
      fromState,
      toState: fromState === 'free' || fromState === 'checkout_pending' || fromState === 'expired'
        ? 'payment_authentication'
        : fromState,
      orderId: params.orderId ?? null,
      paymentId: params.paymentId ?? null,
      createdAt: nowIso,
    });
    return store;
  });

  return { username: existing.username };
}

export async function activateOrRenewSubscription(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  period: PlanPeriod;
  currency?: PaymentCurrency | null;
  orderId: string;
  paymentId: string;
  subscriptionId?: string | null;
  customerId?: string | null;
  paymentEntity?: any;
  eventId?: string | null;
  actor?: 'user' | 'webhook' | 'admin' | 'system';
  actorEmail?: string | null;
  note?: string | null;
  nowMs?: number;
}): Promise<{
  username: string | null;
  plan: 'free' | 'pro';
  planSource: PlanSource;
  lifecycleState: SubscriptionLifecycleState;
  subscription: SubscriptionRecord;
  alreadyProcessed: boolean;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const period = resolvePeriod(params.period);
  const currency = resolveCurrency(params.currency || params.paymentEntity?.currency);
  const amountMinor = resolveAmountMinor(period, currency, params.paymentEntity?.amount);
  const durationDays = period === 'yearly' ? 365 : 30;
  const expiresAtIso = new Date(nowMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const methodSummary =
    formatPaymentMethodSummary(params.paymentEntity) || 'Razorpay Checkout';

  const existing = await resolveProfileByIdentifiers(params);

  const buildFallbackSubscription = (): SubscriptionRecord => ({
    status: 'active',
    cycle: period,
    startedAt: nowIso,
    currentPeriodStart: nowIso,
    currentPeriodEnd: expiresAtIso,
    nextBillingAt: expiresAtIso,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    gracePeriodEndsAt: null,
    lastPaymentFailedAt: null,
    paymentId: params.paymentId,
    orderId: params.orderId,
    subscriptionId: params.subscriptionId || params.orderId || `sub_${params.paymentId}`,
    customerId: params.customerId || null,
    currency,
    amountMinor,
    amountInr: currency === 'INR' ? Math.round(amountMinor / 100) : null,
    paymentMethodSummary: methodSummary,
    lastEventId: params.eventId || null,
    updatedAt: nowIso,
  });

  if (!existing) {
    const sub = buildFallbackSubscription();
    return {
      username: null,
      plan: 'pro',
      planSource: 'paid',
      lifecycleState: 'active',
      subscription: sub,
      alreadyProcessed: false,
    };
  }

  const prevBilling = await dbReadUserBilling(existing.username);
  const alreadyPaidTx = prevBilling.billingHistory.find(
    (h) => h.paymentId && h.paymentId === params.paymentId && h.status === 'paid'
  );
  if (alreadyPaidTx && existing.subscription) {
    const resolved = resolveEffectivePlan({
      email: existing.primaryEmail || params.email,
      storedPlan: existing.plan,
      isProFlag: existing.isPro,
      createdAt: existing.createdAt || existing.claimedAt || null,
      subscription: existing.subscription,
      nowMs,
    });
    return {
      username: existing.username,
      plan: resolved.plan,
      planSource: resolved.planSource,
      lifecycleState: normalizeSubscriptionLifecycleState(existing.subscription, resolved.isPro, nowMs),
      subscription: existing.subscription,
      alreadyProcessed: true,
    };
  }

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const prevResolved = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, prevResolved.isPro, nowMs);

  const hadPreviousPaid =
    prevBilling.billingHistory.some((h) => h.status === 'paid' && h.paymentId !== params.paymentId) ||
    Boolean(prevSub.paymentId && prevSub.paymentId !== params.paymentId);
  const nextStatus: SubscriptionLifecycleState = hadPreviousPaid ? 'renewal' : 'active';

  const subscriptionRecord: SubscriptionRecord = {
    status: nextStatus,
    cycle: period,
    startedAt: prevSub.startedAt || nowIso,
    currentPeriodStart: nowIso,
    currentPeriodEnd: expiresAtIso,
    nextBillingAt: expiresAtIso,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    gracePeriodEndsAt: null,
    lastPaymentFailedAt: null,
    paymentId: params.paymentId,
    orderId: params.orderId,
    subscriptionId:
      params.subscriptionId || prevSub.subscriptionId || params.orderId || `sub_${params.paymentId}`,
    customerId: params.customerId || prevSub.customerId || null,
    currency,
    amountMinor,
    amountInr: currency === 'INR' ? Math.round(amountMinor / 100) : Math.round((amountMinor / 100) * 84),
    paymentMethodSummary: methodSummary,
    lastEventId: params.eventId || prevSub.lastEventId || null,
    updatedAt: nowIso,
  };

  await syncProfileRecord(existing, 'pro', subscriptionRecord);

  const invoiceNumber = `INV-IVEO-${nowIso.slice(0, 10).replace(/-/g, '')}-${String(
    params.paymentId || params.orderId || nowMs
  )
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase()}`;

  await dbUpdateUserBilling(existing.username, (store0) => {
    const txId = `tx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const filteredHistory = store0.billingHistory.filter(
      (h) => !(h.status === 'pending' && params.orderId && h.orderId === params.orderId)
    );
    const paidEntry: BillingHistoryRecord = {
      id: txId,
      date: nowIso,
      amountMinor,
      amountDisplay: formatMinorCurrency(amountMinor, currency),
      currency,
      status: 'paid',
      cycle: period,
      orderId: params.orderId,
      paymentId: params.paymentId,
      subscriptionId: subscriptionRecord.subscriptionId ?? null,
      invoiceNumber,
      invoiceAvailable: true,
      paymentMethodSummary: methodSummary,
      description:
        nextStatus === 'renewal'
          ? `iveo Pro (${period}) renewal`
          : `iveo Pro (${period}) membership`,
    };

    const invoiceEntry: InvoiceRecord = {
      id: `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      invoiceNumber,
      transactionId: txId,
      issuedAt: nowIso,
      periodStart: nowIso,
      periodEnd: expiresAtIso,
      cycle: period,
      amountMinor,
      currency,
      paymentId: params.paymentId,
      orderId: params.orderId,
      status: 'paid',
      paymentMethodSummary: methodSummary,
      customerName: existing.displayName || existing.username,
      customerEmail: existing.primaryEmail || params.email || null,
      username: existing.username,
    };

    let store: UserBillingStore = {
      ...store0,
      billingHistory: [paidEntry, ...filteredHistory].slice(0, 100),
      invoices: [invoiceEntry, ...store0.invoices].slice(0, 100),
    };

    store = appendUniqueNotification(store, {
      kind: 'success',
      title: nextStatus === 'renewal' ? 'Subscription renewed' : 'iveo Pro activated',
      message: `${formatMinorCurrency(amountMinor, currency)} payment verified (${period}). Invoice ${invoiceNumber} is ready.`,
      eventKey: `paid:${params.paymentId || params.orderId}`,
      createdAt: nowIso,
    });

    store = appendAuditLog(store, {
      action: nextStatus === 'renewal' ? 'subscription_renewed' : 'subscription_activated',
      actor: params.actor || 'user',
      actorEmail: params.actorEmail || params.email || existing.primaryEmail || null,
      fromState,
      toState: nextStatus,
      reason: params.note ?? null,
      orderId: params.orderId,
      paymentId: params.paymentId,
      createdAt: nowIso,
    });

    return store;
  });

  const nextResolved = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: 'pro',
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: subscriptionRecord,
    nowMs,
  });

  return {
    username: existing.username,
    plan: nextResolved.plan,
    planSource: nextResolved.planSource,
    lifecycleState: nextStatus,
    subscription: subscriptionRecord,
    alreadyProcessed: false,
  };
}

export async function handlePaymentFailure(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  period?: PlanPeriod | null;
  failureReason?: string | null;
  paymentEntity?: any;
  eventId?: string | null;
  nowMs?: number;
}): Promise<{ username: string | null; gracePeriod: GracePeriodInfo }> {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return {
      username: null,
      gracePeriod: { inGracePeriod: false, gracePeriodEndsAt: null, daysRemaining: 0 },
    };
  }

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const prevResolved = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, prevResolved.isPro, nowMs);
  const currency = resolveCurrency(params.currency || prevSub.currency);
  const period = resolvePeriod(params.period || prevSub.cycle);
  const amountMinor = resolveAmountMinor(period, currency, params.amountMinor || params.paymentEntity?.amount || prevSub.amountMinor);

  const hasExistingPaidContext =
    prevResolved.planSource === 'paid' &&
    fromState !== 'immediate_cancellation' &&
    fromState !== 'free';

  const existingGraceMs = prevSub.gracePeriodEndsAt ? Date.parse(prevSub.gracePeriodEndsAt) : NaN;
  const graceEndsAtIso = hasExistingPaidContext
    ? Number.isFinite(existingGraceMs) && existingGraceMs > nowMs
      ? prevSub.gracePeriodEndsAt!
      : new Date(nowMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const nextStatus: SubscriptionRecord['status'] = hasExistingPaidContext
    ? prevSub.status === 'renewal' || prevSub.status === 'scheduled_cancellation'
      ? prevSub.status
      : 'active'
    : 'free';

  const nextSub: SubscriptionRecord = {
    ...(prevSub as SubscriptionRecord),
    status: nextStatus,
    cycle: prevSub.cycle ?? period,
    startedAt: prevSub.startedAt ?? null,
    currentPeriodEnd: prevSub.currentPeriodEnd ?? null,
    cancelledAt: prevSub.cancelledAt ?? null,
    cancelAtPeriodEnd: Boolean(prevSub.cancelAtPeriodEnd),
    paymentId: prevSub.paymentId ?? null,
    orderId: prevSub.orderId ?? params.orderId ?? null,
    amountInr: prevSub.amountInr ?? null,
    gracePeriodEndsAt: graceEndsAtIso,
    lastPaymentFailedAt: nowIso,
    lastEventId: params.eventId ?? prevSub.lastEventId ?? null,
    updatedAt: nowIso,
  };

  const nextPlan = resolveEffectivePlan({
    email: existing.primaryEmail || params.email,
    storedPlan: hasExistingPaidContext ? 'pro' : existing.plan,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: nextSub,
    nowMs,
  }).plan;

  await syncProfileRecord(existing, nextPlan, nextSub);

  const reason = params.failureReason || 'Payment declined or authentication failed.';
  await dbUpdateUserBilling(existing.username, (store0) => {
    const filtered = store0.billingHistory.filter(
      (h) => !(h.status === 'pending' && params.orderId && h.orderId === params.orderId)
    );
    const alreadyLoggedFailure =
      params.paymentId && filtered.some((h) => h.paymentId === params.paymentId && h.status === 'failed');

    const nextHistory = alreadyLoggedFailure
      ? filtered
      : [
          {
            id: `tx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
            date: nowIso,
            amountMinor,
            amountDisplay: formatMinorCurrency(amountMinor, currency),
            currency,
            status: 'failed' as const,
            cycle: period,
            orderId: params.orderId ?? null,
            paymentId: params.paymentId ?? null,
            subscriptionId: prevSub.subscriptionId ?? null,
            invoiceNumber: null,
            invoiceAvailable: false,
            paymentMethodSummary: formatPaymentMethodSummary(params.paymentEntity) || null,
            description: `iveo Pro (${period}) payment failed`,
            failureReason: reason,
          },
          ...filtered,
        ].slice(0, 100);

    let store: UserBillingStore = { ...store0, billingHistory: nextHistory };
    store = appendUniqueNotification(store, {
      kind: 'error',
      title: hasExistingPaidContext
        ? `Payment failed · ${GRACE_PERIOD_DAYS}-day grace period active`
        : 'Payment failed',
      message: hasExistingPaidContext
        ? `${reason} Your Pro access remains active for ${GRACE_PERIOD_DAYS} days while you retry payment.`
        : `${reason} No charge was completed.`,
      eventKey: `failed:${params.paymentId || params.orderId || nowIso}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: hasExistingPaidContext ? 'payment_failed_grace_started' : 'payment_failed',
      actor: 'webhook',
      fromState,
      toState: normalizeSubscriptionLifecycleState(nextSub, nextPlan === 'pro', nowMs),
      reason,
      orderId: params.orderId ?? null,
      paymentId: params.paymentId ?? null,
      createdAt: nowIso,
    });
    return store;
  });

  return {
    username: existing.username,
    gracePeriod: getGracePeriodInfo(nextSub, nowMs),
  };
}

export async function handleRefundEvent(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  paymentId: string;
  refundAmountMinor?: number | null;
  eventId?: string | null;
  nowMs?: number;
}): Promise<{ username: string | null }> {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) return { username: null };

  const prevBilling = await dbReadUserBilling(existing.username);
  const targetTx = prevBilling.billingHistory.find((h) => h.paymentId === params.paymentId);
  const originalMinor = targetTx?.amountMinor ?? existing.subscription?.amountMinor ?? 0;
  const refundedMinor =
    typeof params.refundAmountMinor === 'number' && params.refundAmountMinor > 0
      ? params.refundAmountMinor
      : originalMinor;
  const isFullRefund = originalMinor > 0 ? refundedMinor >= originalMinor : true;

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const fromState = normalizeSubscriptionLifecycleState(prevSub, existing.plan === 'pro', nowMs);

  let nextSub: SubscriptionRecord | null = existing.subscription || null;
  let nextPlan: 'free' | 'pro' = existing.plan === 'pro' ? 'pro' : 'free';

  if (isFullRefund && prevSub.paymentId === params.paymentId) {
    nextSub = {
      ...(prevSub as SubscriptionRecord),
      status: 'immediate_cancellation',
      currentPeriodEnd: nowIso,
      nextBillingAt: null,
      cancelledAt: nowIso,
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      cancelReason: 'Full refund processed via Razorpay',
      lastEventId: params.eventId ?? prevSub.lastEventId ?? null,
      updatedAt: nowIso,
    };
    nextPlan = resolveEffectivePlan({
      email: existing.primaryEmail,
      storedPlan: 'free',
      createdAt: existing.createdAt || null,
      subscription: nextSub,
      nowMs,
    }).plan;
    await syncProfileRecord(existing, nextPlan, nextSub);
  }

  await dbUpdateUserBilling(existing.username, (store0) => {
    const nextHistory = store0.billingHistory.map((h) =>
      h.paymentId === params.paymentId
        ? {
            ...h,
            status: isFullRefund ? ('refunded' as const) : ('partially_refunded' as const),
            refundedAmountMinor: refundedMinor,
            invoiceAvailable: isFullRefund ? false : h.invoiceAvailable,
          }
        : h
    );
    let store: UserBillingStore = { ...store0, billingHistory: nextHistory };
    store = appendUniqueNotification(store, {
      kind: 'warning',
      title: isFullRefund ? 'Payment refunded' : 'Partial refund processed',
      message: `Refund of ${formatMinorCurrency(
        refundedMinor,
        resolveCurrency(targetTx?.currency || prevSub.currency)
      )} recorded for payment ${params.paymentId}.`,
      eventKey: `refund:${params.paymentId}:${refundedMinor}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: isFullRefund ? 'payment_refunded_full' : 'payment_refunded_partial',
      actor: 'webhook',
      fromState,
      toState: nextSub ? normalizeSubscriptionLifecycleState(nextSub, nextPlan === 'pro', nowMs) : fromState,
      paymentId: params.paymentId,
      createdAt: nowIso,
    });
    return store;
  });

  return { username: existing.username };
}

export async function switchBillingCycle(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  targetCycle: PlanPeriod;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return { ok: false as const, status: 404, error: 'profile_not_found' };
  }

  const authorized = await dbVerifyOwnership(
    existing.username,
    params.userId || existing.userId,
    params.email || existing.primaryEmail
  );
  if (!authorized) {
    return { ok: false as const, status: 403, error: 'unauthorized' };
  }

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const resolved = resolveEffectivePlan({
    email: params.email || existing.primaryEmail,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });

  const hasPaidRecord = Boolean(prevSub.paymentId || prevSub.orderId || prevSub.subscriptionId);
  if (!resolved.isPro || !hasPaidRecord) {
    return {
      ok: false as const,
      status: 400,
      error: 'no_active_paid_subscription',
      message: 'An active paid Pro subscription is required to switch billing cycles.',
    };
  }

  const targetCycle = resolvePeriod(params.targetCycle);
  const currency = resolveCurrency(prevSub.currency);
  const nextAmountMinor = PRICING_CONFIG[currency][targetCycle].amount;
  const fromState = normalizeSubscriptionLifecycleState(prevSub, resolved.isPro, nowMs);

  const nextBillingBaseMs =
    prevSub.currentPeriodEnd && Date.parse(prevSub.currentPeriodEnd) > nowMs
      ? Date.parse(prevSub.currentPeriodEnd)
      : nowMs;
  const nextBillingAtIso = new Date(nextBillingBaseMs).toISOString();

  const updatedSub: SubscriptionRecord = {
    ...(prevSub as SubscriptionRecord),
    status: prevSub.status || 'active',
    cycle: targetCycle,
    currency,
    amountMinor: nextAmountMinor,
    amountInr: currency === 'INR' ? Math.round(nextAmountMinor / 100) : prevSub.amountInr ?? null,
    nextBillingAt: nextBillingAtIso,
    updatedAt: nowIso,
  };

  await syncProfileRecord(existing, resolved.plan, updatedSub);

  await dbUpdateUserBilling(existing.username, (store0) => {
    let store = appendUniqueNotification(store0, {
      kind: 'info',
      title: 'Billing cycle updated',
      message: `Future renewals will bill ${targetCycle} (${formatMinorCurrency(nextAmountMinor, currency)}).`,
      eventKey: `cycle:${targetCycle}:${prevSub.currentPeriodEnd || nowIso.slice(0, 13)}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: 'billing_cycle_switched',
      actor: 'user',
      actorEmail: params.email || existing.primaryEmail || null,
      fromState,
      toState: normalizeSubscriptionLifecycleState(updatedSub, resolved.isPro, nowMs),
      reason: `Switched cycle to ${targetCycle}`,
      createdAt: nowIso,
    });
    return store;
  });

  const snapshot = await getBillingSnapshot({
    username: existing.username,
    userId: params.userId || existing.userId,
    email: params.email || existing.primaryEmail,
    nowMs,
  });
  return {
    ...snapshot,
    status: 200 as const,
  };
}

export async function cancelBillingSubscription(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  mode?: 'end_of_period' | 'immediate';
  reason?: string | null;
  actor?: 'user' | 'webhook' | 'admin' | 'system';
  actorEmail?: string | null;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return { ok: false as const, status: 404, error: 'profile_not_found' };
  }

  const actor = params.actor || 'user';
  if (actor === 'user') {
    const authorized = await dbVerifyOwnership(
      existing.username,
      params.userId || existing.userId,
      params.email || existing.primaryEmail
    );
    if (!authorized) {
      return { ok: false as const, status: 403, error: 'unauthorized' };
    }
  }

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const prevResolved = resolveEffectivePlan({
    email: params.email || existing.primaryEmail,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, prevResolved.isPro, nowMs);
  const mode = params.mode === 'immediate' ? 'immediate' : 'end_of_period';
  const cleanReason = typeof params.reason === 'string' && params.reason.trim() ? params.reason.trim().slice(0, 400) : null;

  let updatedSubscription: SubscriptionRecord;
  let storedPlanHint: 'free' | 'pro';

  if (mode === 'immediate') {
    updatedSubscription = {
      ...(prevSub as SubscriptionRecord),
      status: 'immediate_cancellation',
      cycle: prevSub.cycle || null,
      startedAt: prevSub.startedAt || existing.createdAt || nowIso,
      currentPeriodEnd: nowIso,
      nextBillingAt: null,
      cancelledAt: nowIso,
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      cancelReason: cleanReason,
      paymentId: prevSub.paymentId || null,
      orderId: prevSub.orderId || null,
      amountInr: prevSub.amountInr ?? null,
      updatedAt: nowIso,
    };
    storedPlanHint = 'free';
  } else {
    const hasPaidPeriod = Boolean(prevSub.paymentId || prevSub.orderId || prevSub.subscriptionId);
    updatedSubscription = {
      ...(prevSub as SubscriptionRecord),
      status: 'scheduled_cancellation',
      cycle: prevSub.cycle || null,
      startedAt: prevSub.startedAt || existing.createdAt || nowIso,
      currentPeriodEnd: prevSub.currentPeriodEnd || null,
      nextBillingAt: null,
      cancelledAt: nowIso,
      cancelAtPeriodEnd: true,
      cancelReason: cleanReason,
      paymentId: prevSub.paymentId || null,
      orderId: prevSub.orderId || null,
      amountInr: prevSub.amountInr ?? null,
      updatedAt: nowIso,
    };
    storedPlanHint = hasPaidPeriod ? 'pro' : 'free';
  }

  const nextPlanInfo = resolveEffectivePlan({
    email: params.email || existing.primaryEmail,
    storedPlan: storedPlanHint,
    createdAt: existing.createdAt || null,
    subscription: updatedSubscription,
    nowMs,
  });

  await syncProfileRecord(existing, nextPlanInfo.plan, updatedSubscription);

  await dbUpdateUserBilling(existing.username, (store0) => {
    let store = appendUniqueNotification(store0, {
      kind: 'warning',
      title: mode === 'immediate' ? 'Subscription cancelled immediately' : 'Auto-renewal cancelled',
      message:
        mode === 'immediate'
          ? 'Your Pro subscription ended immediately with no refund issued. All your links, themes, and profile data remain saved.'
          : updatedSubscription.currentPeriodEnd
            ? `Your Pro access stays active until ${new Date(updatedSubscription.currentPeriodEnd).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}.`
            : 'Auto-renewal cancelled.',
      eventKey: `cancel:${mode}:${nowIso.slice(0, 16)}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: mode === 'immediate' ? 'subscription_cancelled_immediate' : 'subscription_cancelled_scheduled',
      actor,
      actorEmail: params.actorEmail || params.email || existing.primaryEmail || null,
      fromState,
      toState: mode === 'immediate' ? 'immediate_cancellation' : 'scheduled_cancellation',
      reason: cleanReason,
      orderId: updatedSubscription.orderId ?? null,
      paymentId: updatedSubscription.paymentId ?? null,
      createdAt: nowIso,
    });
    return store;
  });

  const snapshot = await getBillingSnapshot({
    username: existing.username,
    userId: params.userId || existing.userId,
    email: params.email || existing.primaryEmail,
    nowMs,
  });
  return {
    ...snapshot,
    status: 200 as const,
  };
}

export async function reactivateBillingSubscription(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return { ok: false as const, status: 404, error: 'profile_not_found' };
  }

  const authorized = await dbVerifyOwnership(
    existing.username,
    params.userId || existing.userId,
    params.email || existing.primaryEmail
  );
  if (!authorized) {
    return { ok: false as const, status: 403, error: 'unauthorized' };
  }

  const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
  const currentResolved = resolveEffectivePlan({
    email: params.email || existing.primaryEmail,
    storedPlan: existing.plan,
    isProFlag: existing.isPro,
    createdAt: existing.createdAt || existing.claimedAt || null,
    subscription: prevSub,
    nowMs,
  });
  const fromState = normalizeSubscriptionLifecycleState(prevSub, currentResolved.isPro, nowMs);

  const endMs = prevSub.currentPeriodEnd ? Date.parse(prevSub.currentPeriodEnd) : NaN;
  const hasPaidPeriod = Boolean(prevSub.paymentId || prevSub.orderId || prevSub.subscriptionId);
  if (
    fromState === 'immediate_cancellation' ||
    fromState === 'expired' ||
    (Number.isFinite(endMs) && endMs <= nowMs && !getGracePeriodInfo(prevSub, nowMs).inGracePeriod)
  ) {
    return {
      ok: false as const,
      status: 400,
      error: 'cannot_reactivate_expired',
      message: 'This billing period has ended. Start a new Pro checkout to reactivate.',
    };
  }

  const updatedSubscription: SubscriptionRecord = {
    ...(prevSub as SubscriptionRecord),
    status: 'active',
    cycle: prevSub.cycle || null,
    startedAt: prevSub.startedAt || existing.createdAt || nowIso,
    currentPeriodEnd: prevSub.currentPeriodEnd || null,
    nextBillingAt: prevSub.currentPeriodEnd || null,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    paymentId: prevSub.paymentId || null,
    orderId: prevSub.orderId || null,
    amountInr: prevSub.amountInr ?? null,
    updatedAt: nowIso,
  };

  const nextPlanInfo = resolveEffectivePlan({
    email: params.email || existing.primaryEmail,
    storedPlan: hasPaidPeriod ? 'pro' : existing.plan,
    createdAt: existing.createdAt || null,
    subscription: updatedSubscription,
    nowMs,
  });

  await syncProfileRecord(existing, nextPlanInfo.plan, updatedSubscription);

  await dbUpdateUserBilling(existing.username, (store0) => {
    let store = appendUniqueNotification(store0, {
      kind: 'success',
      title: 'Auto-renewal resumed',
      message: 'Your subscription will renew normally at the end of the current billing period.',
      eventKey: `reactivate:${nowIso.slice(0, 16)}`,
      createdAt: nowIso,
    });
    store = appendAuditLog(store, {
      action: 'subscription_reactivated',
      actor: 'user',
      actorEmail: params.email || existing.primaryEmail || null,
      fromState,
      toState: 'active',
      createdAt: nowIso,
    });
    return store;
  });

  const snapshot = await getBillingSnapshot({
    username: existing.username,
    userId: params.userId || existing.userId,
    email: params.email || existing.primaryEmail,
    nowMs,
  });
  return {
    ...snapshot,
    status: 200 as const,
  };
}

export async function processWebhookEvent(params: {
  event: any;
  eventIdHeader?: string | null;
  nowMs?: number;
}): Promise<{
  ok: true;
  eventType: string;
  eventId: string;
  deduplicated: boolean;
  username: string | null;
}> {
  const nowMs = params.nowMs ?? Date.now();
  const event = params.event || {};
  const eventType = String(event.event || 'unknown');
  const paymentEntity = event?.payload?.payment?.entity || null;
  const orderEntity = event?.payload?.order?.entity || null;
  const subEntity = event?.payload?.subscription?.entity || null;
  const refundEntity = event?.payload?.refund?.entity || null;

  const entityId =
    refundEntity?.id ||
    paymentEntity?.id ||
    orderEntity?.id ||
    subEntity?.id ||
    String(event.created_at || nowMs);

  const eventId =
    (params.eventIdHeader && params.eventIdHeader.trim()) ||
    `${eventType}:${entityId}:${event.created_at || ''}`;

  if (processedWebhookIdsMemory.has(eventId)) {
    return { ok: true, eventType, eventId, deduplicated: true, username: null };
  }

  const notes =
    paymentEntity?.notes ||
    orderEntity?.notes ||
    subEntity?.notes ||
    refundEntity?.notes ||
    {};

  const username = notes?.username ? String(notes.username).replace(/^@+/, '').toLowerCase().trim() : null;
  const userId = notes?.userId ? String(notes.userId).trim() : null;
  const email = notes?.email ? String(notes.email).toLowerCase().trim() : null;
  const existing = await resolveProfileByIdentifiers({ username, userId, email });

  if (existing) {
    const store = await dbReadUserBilling(existing.username);
    if (store.processedWebhookEvents.includes(eventId)) {
      processedWebhookIdsMemory.add(eventId);
      return { ok: true, eventType, eventId, deduplicated: true, username: existing.username };
    }
  }

  processedWebhookIdsMemory.add(eventId);
  let targetUsername: string | null = existing?.username || username || null;

  if (eventType === 'payment.authorized') {
    const res = await markPaymentAuthentication({
      username: targetUsername,
      userId,
      email,
      orderId: paymentEntity?.order_id || orderEntity?.id || null,
      paymentId: paymentEntity?.id || null,
      paymentEntity,
      eventId,
      nowMs,
    });
    targetUsername = res.username || targetUsername;
  } else if (
    eventType === 'payment.captured' ||
    eventType === 'order.paid' ||
    eventType === 'subscription.charged'
  ) {
    const period = resolvePeriod(notes?.period || (subEntity?.plan_id?.includes('year') ? 'yearly' : 'monthly'));
    const currency = resolveCurrency(paymentEntity?.currency || orderEntity?.currency);
    const res = await activateOrRenewSubscription({
      username: targetUsername,
      userId,
      email,
      period,
      currency,
      orderId: paymentEntity?.order_id || orderEntity?.id || subEntity?.id || `ord_${entityId}`,
      paymentId: paymentEntity?.id || `pay_${entityId}`,
      subscriptionId: subEntity?.id || paymentEntity?.subscription_id || null,
      customerId: subEntity?.customer_id || paymentEntity?.customer_id || null,
      paymentEntity,
      eventId,
      actor: 'webhook',
      nowMs,
    });
    targetUsername = res.username || targetUsername;
  } else if (eventType === 'payment.failed') {
    const period = resolvePeriod(notes?.period);
    const currency = resolveCurrency(paymentEntity?.currency);
    const res = await handlePaymentFailure({
      username: targetUsername,
      userId,
      email,
      orderId: paymentEntity?.order_id || null,
      paymentId: paymentEntity?.id || null,
      amountMinor: paymentEntity?.amount ?? null,
      currency,
      period,
      failureReason: paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed',
      paymentEntity,
      eventId,
      nowMs,
    });
    targetUsername = res.username || targetUsername;
  } else if (eventType === 'refund.created' || eventType === 'refund.processed') {
    const payId = String(refundEntity?.payment_id || paymentEntity?.id || '');
    if (payId) {
      const res = await handleRefundEvent({
        username: targetUsername,
        userId,
        email,
        paymentId: payId,
        refundAmountMinor: refundEntity?.amount ?? null,
        eventId,
        nowMs,
      });
      targetUsername = res.username || targetUsername;
    }
  } else if (eventType === 'subscription.cancelled') {
    const res = await cancelBillingSubscription({
      username: targetUsername,
      userId,
      email,
      mode: 'end_of_period',
      reason: 'Cancelled via Razorpay subscription webhook',
      actor: 'webhook',
      nowMs,
    });
    if (res.ok && res.username) {
      targetUsername = res.username;
    }
  }

  if (targetUsername) {
    await dbUpdateUserBilling(targetUsername, (store0) => ({
      ...store0,
      processedWebhookEvents: [eventId, ...store0.processedWebhookEvents.filter((id) => id !== eventId)].slice(
        0,
        200
      ),
    }));
  }

  return { ok: true, eventType, eventId, deduplicated: false, username: targetUsername };
}

export async function getBillingSnapshot(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  limit?: number;
  offset?: number;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const limit = Math.max(1, Math.min(50, params.limit ?? 10));
  const offset = Math.max(0, params.offset ?? 0);

  const profile = await resolveProfileByIdentifiers(params);
  if (!profile) {
    const fallback = resolveEffectivePlan({ email: params.email, nowMs });
    return {
      ok: true as const,
      username: null,
      plan: fallback.plan,
      isPro: fallback.isPro,
      planSource: fallback.planSource,
      lifecycleState: normalizeSubscriptionLifecycleState(null, fallback.isPro, nowMs),
      gracePeriod: { inGracePeriod: false, gracePeriodEndsAt: null, daysRemaining: 0 },
      createdAt: null,
      earlyBirdDeadline: EARLY_BIRD_PRO_DEADLINE_ISO,
      subscription: null,
      billingHistory: [] as BillingHistoryRecord[],
      historyTotal: 0,
      hasMoreHistory: false,
      invoices: [] as InvoiceRecord[],
      notifications: [] as BillingNotification[],
      auditLogs: [] as SubscriptionAuditLog[],
    };
  }

  const resolved = resolveEffectivePlan({
    email: params.email || profile.primaryEmail,
    storedPlan: profile.plan,
    isProFlag: profile.isPro,
    createdAt: profile.createdAt || profile.claimedAt || null,
    subscription: profile.subscription || null,
    nowMs,
  });

  const sub: SubscriptionRecord | null = profile.subscription || null;
  const lifecycleState = normalizeSubscriptionLifecycleState(sub, resolved.isPro, nowMs);
  const gracePeriod = getGracePeriodInfo(sub, nowMs);

  // Determine whether caller is authorized to see detailed billing history, invoices, notifications & audit logs
  const hasCallerCreds = Boolean(params.userId || params.email);
  const callerAuthorized = hasCallerCreds
    ? await dbVerifyOwnership(profile.username, params.userId || profile.userId, params.email || profile.primaryEmail)
    : false;

  const billingStore = callerAuthorized
    ? await dbReadUserBilling(profile.username)
    : createDefaultBillingStore();

  const sortedHistory = [...billingStore.billingHistory].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date)
  );
  const slicedHistory = sortedHistory.slice(offset, offset + limit);

  const paidPaymentIds = new Set(
    sortedHistory.filter((h) => h.status === 'paid' && h.paymentId).map((h) => h.paymentId as string)
  );
  const verifiedInvoices = billingStore.invoices.filter(
    (inv) => inv.status === 'paid' && (!inv.paymentId || paidPaymentIds.has(inv.paymentId))
  );

  return {
    ok: true as const,
    username: profile.username,
    plan: resolved.plan,
    isPro: resolved.isPro,
    planSource: resolved.planSource,
    lifecycleState,
    gracePeriod,
    createdAt: profile.createdAt || profile.claimedAt || null,
    earlyBirdDeadline: EARLY_BIRD_PRO_DEADLINE_ISO,
    subscription: sub,
    billingHistory: slicedHistory,
    historyTotal: sortedHistory.length,
    hasMoreHistory: offset + limit < sortedHistory.length,
    invoices: verifiedInvoices,
    notifications: billingStore.notifications,
    auditLogs: billingStore.auditLogs,
  };
}

export async function getVerifiedInvoice(params: {
  username?: string | null;
  userId?: string | null;
  email?: string | null;
  invoiceId: string;
}): Promise<{ ok: true; invoice: InvoiceRecord } | { ok: false; status: number; error: string; message: string }> {
  const existing = await resolveProfileByIdentifiers(params);
  if (!existing) {
    return { ok: false, status: 404, error: 'profile_not_found', message: 'Profile not found.' };
  }

  const callerIsAdmin = isPrivilegedEmailServer(params.email);
  const authorized =
    callerIsAdmin ||
    (await dbVerifyOwnership(
      existing.username,
      params.userId || existing.userId,
      params.email || existing.primaryEmail
    ));
  if (!authorized || (!params.userId && !params.email)) {
    return { ok: false, status: 403, error: 'unauthorized', message: 'Not authorized to access this invoice.' };
  }

  const store = await dbReadUserBilling(existing.username);
  const invoice = store.invoices.find(
    (inv) =>
      inv.id === params.invoiceId ||
      inv.invoiceNumber === params.invoiceId ||
      inv.paymentId === params.invoiceId ||
      inv.transactionId === params.invoiceId
  );

  if (!invoice || invoice.status !== 'paid') {
    return {
      ok: false,
      status: 404,
      error: 'invoice_not_available',
      message: 'Invoice is only available for verified paid transactions.',
    };
  }

  const matchingTx = store.billingHistory.find(
    (h) => h.id === invoice.transactionId || (invoice.paymentId && h.paymentId === invoice.paymentId)
  );
  if (matchingTx && matchingTx.status !== 'paid') {
    return {
      ok: false,
      status: 403,
      error: 'invoice_unavailable_unpaid',
      message: `Invoice cannot be issued because transaction status is ${matchingTx.status}.`,
    };
  }

  return { ok: true, invoice };
}

export async function adminInspectBilling(username: string, nowMs: number = Date.now()) {
  const clean = (username || '').replace(/^@+/, '').toLowerCase().trim();
  const profile = await resolveProfileByIdentifiers({ username: clean });
  if (!profile) {
    return { ok: false as const, status: 404, error: 'profile_not_found' };
  }
  const snapshot = await getBillingSnapshot({
    username: profile.username,
    userId: profile.userId,
    email: profile.primaryEmail,
    limit: 50,
    offset: 0,
    nowMs,
  });
  return {
    ...snapshot,
    status: 200 as const,
    primaryEmail: profile.primaryEmail || null,
    displayName: profile.displayName || profile.username,
  };
}

export async function adminReconcileBilling(params: {
  adminEmail: string;
  username: string;
  action: 'activate_paid' | 'grant_grace_period' | 'expire_now' | 'cancel_immediate';
  period?: PlanPeriod;
  paymentId?: string | null;
  orderId?: string | null;
  note?: string | null;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const clean = (params.username || '').replace(/^@+/, '').toLowerCase().trim();
  const existing = await resolveProfileByIdentifiers({ username: clean });
  if (!existing) {
    return { ok: false as const, status: 404, error: 'profile_not_found' };
  }

  if (params.action === 'activate_paid') {
    await activateOrRenewSubscription({
      username: existing.username,
      userId: existing.userId,
      email: existing.primaryEmail,
      period: resolvePeriod(params.period || existing.subscription?.cycle),
      currency: resolveCurrency(existing.subscription?.currency),
      orderId: params.orderId || existing.subscription?.orderId || `ord_admin_${Date.now().toString(36)}`,
      paymentId: params.paymentId || existing.subscription?.paymentId || `pay_admin_${Date.now().toString(36)}`,
      actor: 'admin',
      actorEmail: params.adminEmail,
      note: params.note || 'Admin payment reconciliation',
      nowMs,
    });
  } else if (params.action === 'grant_grace_period') {
    const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
    const fromState = normalizeSubscriptionLifecycleState(prevSub, existing.plan === 'pro', nowMs);
    const graceEnds = new Date(nowMs + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const nextSub: SubscriptionRecord = {
      ...(prevSub as SubscriptionRecord),
      status: prevSub.status === 'renewal' ? 'renewal' : 'active',
      cycle: prevSub.cycle || 'monthly',
      startedAt: prevSub.startedAt || nowIso,
      currentPeriodEnd: prevSub.currentPeriodEnd || nowIso,
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      paymentId: prevSub.paymentId || null,
      orderId: prevSub.orderId || null,
      amountInr: prevSub.amountInr ?? null,
      gracePeriodEndsAt: graceEnds,
      lastPaymentFailedAt: nowIso,
      updatedAt: nowIso,
    };
    await syncProfileRecord(existing, 'pro', nextSub);
    await dbUpdateUserBilling(existing.username, (store0) => {
      let store = appendUniqueNotification(store0, {
        kind: 'warning',
        title: `${GRACE_PERIOD_DAYS}-day grace period granted`,
        message: params.note || 'Administrator enabled a 3-day payment grace period.',
        eventKey: `admin-grace:${nowIso.slice(0, 16)}`,
        createdAt: nowIso,
      });
      store = appendAuditLog(store, {
        action: 'admin_grant_grace_period',
        actor: 'admin',
        actorEmail: params.adminEmail,
        fromState,
        toState: normalizeSubscriptionLifecycleState(nextSub, true, nowMs),
        reason: params.note || null,
        createdAt: nowIso,
      });
      return store;
    });
  } else if (params.action === 'expire_now') {
    const prevSub: Partial<SubscriptionRecord> = existing.subscription || {};
    const fromState = normalizeSubscriptionLifecycleState(prevSub, existing.plan === 'pro', nowMs);
    const nextSub: SubscriptionRecord = {
      ...(prevSub as SubscriptionRecord),
      status: 'expired',
      cycle: prevSub.cycle || null,
      startedAt: prevSub.startedAt || null,
      currentPeriodEnd: nowIso,
      nextBillingAt: null,
      cancelledAt: prevSub.cancelledAt || null,
      cancelAtPeriodEnd: Boolean(prevSub.cancelAtPeriodEnd),
      gracePeriodEndsAt: null,
      paymentId: prevSub.paymentId || null,
      orderId: prevSub.orderId || null,
      amountInr: prevSub.amountInr ?? null,
      updatedAt: nowIso,
    };
    const resolved = resolveEffectivePlan({
      email: existing.primaryEmail,
      storedPlan: 'free',
      createdAt: existing.createdAt || null,
      subscription: nextSub,
      nowMs,
    });
    await syncProfileRecord(existing, resolved.plan, nextSub);
    await dbUpdateUserBilling(existing.username, (store0) =>
      appendAuditLog(store0, {
        action: 'admin_expire_subscription',
        actor: 'admin',
        actorEmail: params.adminEmail,
        fromState,
        toState: 'expired',
        reason: params.note || 'Expired by administrator',
        createdAt: nowIso,
      })
    );
  } else if (params.action === 'cancel_immediate') {
    await cancelBillingSubscription({
      username: existing.username,
      userId: existing.userId,
      email: existing.primaryEmail,
      mode: 'immediate',
      reason: params.note || 'Cancelled immediately by administrator',
      actor: 'admin',
      actorEmail: params.adminEmail,
      nowMs,
    });
  }

  return await adminInspectBilling(existing.username, nowMs);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseReservedUsername,
  EARLY_BIRD_PRO_DEADLINE_MS,
  FREE_PLAN_HIGHLIGHTS,
  isEarlyBirdEligible,
  isOwnerEmail,
  PLAN_COMPARISON_SECTIONS,
  PRO_FEATURE_NAMES,
  PRO_FEATURES,
  PRO_PLAN_HIGHLIGHTS,
  resolveEffectivePlan,
} from './plan';
import { VIBES } from './vibes';
import { FONT_OPTIONS } from './fonts';
import { BACKGROUND_CATEGORIES, BACKGROUND_PRESETS } from './backgrounds';
import { normalizeUsername, validateUsername } from './username-rules';
import { validateUsernameSync } from './username';
import { isUserPageLocation } from './intro';
import {
  classifySegment,
  isPrivilegedEmailServer,
  validateUsernameServer,
} from '../../api/_lib/usernames';

test('isOwnerEmail & canUseReservedUsername recognize @iveo.site and designated emails', () => {
  assert.equal(isOwnerEmail('example@iveo.site'), true);
  assert.equal(isOwnerEmail('  Team.Lead@IVEO.SITE  '), true);
  assert.equal(isOwnerEmail('arjunjareda2007@gmail.com'), true);
  assert.equal(isOwnerEmail('ARJUNJAREDA1355@gmail.com'), true);
  assert.equal(isOwnerEmail('help@iveo.site'), true);

  assert.equal(canUseReservedUsername('example@iveo.site'), true);
  assert.equal(canUseReservedUsername('arjunjareda2007@gmail.com'), true);
  assert.equal(canUseReservedUsername('arjunjareda1355@gmail.com'), true);

  assert.equal(isOwnerEmail('regular.user@gmail.com'), false);
  assert.equal(isOwnerEmail('user@iveo.site.evil.com'), false);
  assert.equal(isOwnerEmail('not-an-email@iveo.site.org'), false);
  assert.equal(isOwnerEmail(''), false);
  assert.equal(isOwnerEmail(null), false);
});

test('isPrivilegedEmailServer matches client privilege rules', () => {
  assert.equal(isPrivilegedEmailServer('founder@iveo.site'), true);
  assert.equal(isPrivilegedEmailServer('arjunjareda2007@gmail.com'), true);
  assert.equal(isPrivilegedEmailServer('arjunjareda1355@gmail.com'), true);
  assert.equal(isPrivilegedEmailServer('normal@example.com'), false);
  assert.equal(isPrivilegedEmailServer('user@iveo.site.attacker.com'), false);
});

test('validateUsername allows reserved handles only when allowReserved is true and always blocks private routes', () => {
  assert.equal(validateUsername('support', { allowReserved: false }).ok, false);
  assert.equal(validateUsername('iveo', { allowReserved: false }).ok, false);
  assert.equal(validateUsername('help', { allowReserved: false }).ok, false);

  assert.equal(validateUsername('support', { allowReserved: true }).ok, true);
  assert.equal(validateUsername('iveo', { allowReserved: true }).ok, true);
  assert.equal(validateUsername('help', { allowReserved: true }).ok, true);

  for (const sysRoute of ['login', 'signup', 'dashboard', 'onboarding', 'account', 'admin']) {
    const res = validateUsername(sysRoute, { allowReserved: true });
    assert.equal(res.ok, false, `Expected ${sysRoute} to remain blocked`);
  }
});

test('validateUsernameServer allows reserved handles for privileged callers and blocks private routes', () => {
  assert.equal(validateUsernameServer('support', { allowReserved: false }).ok, false);
  assert.equal(validateUsernameServer('support', { allowReserved: true }).ok, true);
  assert.equal(validateUsernameServer('iveo', { allowReserved: true }).ok, true);
  assert.equal(validateUsernameServer('admin', { allowReserved: true }).ok, false);
  assert.equal(validateUsernameServer('dashboard', { allowReserved: true }).ok, false);
  assert.equal(validateUsernameServer('login', { allowReserved: true }).ok, false);
});

test('validateUsernameSync forwards email for reserved handles', () => {
  assert.equal(validateUsernameSync('support', { email: 'regular@gmail.com' }).status, 'unavailable');
  assert.equal(validateUsernameSync('support', { email: 'example@iveo.site' }).status, 'available');
  assert.equal(validateUsernameSync('iveo', { email: 'arjunjareda2007@gmail.com' }).status, 'available');
  assert.equal(validateUsernameSync('login', { email: 'example@iveo.site' }).status, 'unavailable');
});

test('Free vs Pro features, Vibes, Fonts, and Backgrounds maintain exact clean separation', () => {
  const freeVibes = VIBES.filter((v) => !v.isPro);
  const proVibes = VIBES.filter((v) => v.isPro);
  assert.equal(freeVibes.length, 6);
  assert.equal(proVibes.length, 6);

  const freeFonts = FONT_OPTIONS.filter((f) => !f.isPro);
  const proFonts = FONT_OPTIONS.filter((f) => f.isPro);
  assert.ok(freeFonts.length >= 8);
  assert.ok(proFonts.length >= 11);
  assert.equal(FONT_OPTIONS.length, 56);

  const freeBgPresets = BACKGROUND_PRESETS.filter((b) => !b.isPro && b.id !== 'none');
  const proBgPresets = BACKGROUND_PRESETS.filter((b) => b.isPro);
  assert.ok(freeBgPresets.length >= 5);
  assert.ok(proBgPresets.length >= 10);
  assert.ok(BACKGROUND_CATEGORIES.filter((c) => c.id !== 'all').length >= 7);

  for (const feat of PRO_FEATURES) {
    assert.ok(PRO_FEATURE_NAMES[feat], `Missing label for ${feat}`);
  }
  assert.ok(PRO_FEATURES.includes('pro_vibes'));
  assert.ok(PRO_FEATURES.includes('verified_badge'));
  assert.ok(FREE_PLAN_HIGHLIGHTS.some((line) => line.includes('6 Free Vibes')));
  assert.ok(PRO_PLAN_HIGHLIGHTS.some((line) => line.includes('Verified Pro tick')));
  assert.ok(PLAN_COMPARISON_SECTIONS.length >= 4);
  assert.ok(
    PLAN_COMPARISON_SECTIONS.some((s) =>
      s.rows.some((r) => r.feature.toLowerCase().includes('verified pro tick') && r.free === false && r.pro === 'Included')
    )
  );
});

test('Early-Bird Pro grants Pro automatically before 01/01/2027 and disables after deadline', () => {
  const beforeCutoff = '2026-11-16T12:00:00.000Z';
  const atCutoff = '2027-01-01T00:00:00.000Z';
  const afterCutoff = '2027-02-01T00:00:00.000Z';

  assert.equal(isEarlyBirdEligible(beforeCutoff), true);
  assert.equal(isEarlyBirdEligible(atCutoff), false);
  assert.equal(isEarlyBirdEligible(afterCutoff), false);
  assert.equal(isEarlyBirdEligible(null, EARLY_BIRD_PRO_DEADLINE_MS - 1000), true);
  assert.equal(isEarlyBirdEligible(null, EARLY_BIRD_PRO_DEADLINE_MS), false);

  const pre2027 = resolveEffectivePlan({
    email: 'creator@gmail.com',
    storedPlan: 'free',
    createdAt: beforeCutoff,
    nowMs: Date.parse(afterCutoff),
  });
  assert.equal(pre2027.plan, 'pro');
  assert.equal(pre2027.isPro, true);
  assert.equal(pre2027.planSource, 'early_bird');

  const post2027 = resolveEffectivePlan({
    email: 'creator@gmail.com',
    storedPlan: 'free',
    createdAt: afterCutoff,
    nowMs: Date.parse(afterCutoff),
  });
  assert.equal(post2027.plan, 'free');
  assert.equal(post2027.isPro, false);
  assert.equal(post2027.planSource, 'free');

  const cancelledEarlyBird = resolveEffectivePlan({
    email: 'creator@gmail.com',
    storedPlan: 'free',
    createdAt: beforeCutoff,
    subscription: { status: 'cancelled' },
  });
  assert.equal(cancelledEarlyBird.plan, 'free');
  assert.equal(cancelledEarlyBird.planSource, 'free');

  const ownerAfterCutoff = resolveEffectivePlan({
    email: 'founder@iveo.site',
    createdAt: afterCutoff,
    nowMs: Date.parse(afterCutoff),
  });
  assert.equal(ownerAfterCutoff.planSource, 'owner');
  assert.equal(ownerAfterCutoff.isPro, true);
});

test('Routing & @username normalization ignores Vite dev internals and handles @prefix', () => {
  assert.equal(normalizeUsername('@MayaStudio'), 'mayastudio');
  assert.equal(classifySegment('@maya'), 'username');
  assert.equal(classifySegment('@vite'), 'invalid');
  assert.equal(classifySegment('@react-refresh'), 'invalid');
  assert.equal(isUserPageLocation({ pathname: '/@maya', hostname: 'iveo.site', search: '' }), true);
  assert.equal(isUserPageLocation({ pathname: '/@vite/client', hostname: 'localhost', search: '' }), false);
  assert.equal(isUserPageLocation({ pathname: '/@react-refresh', hostname: 'localhost', search: '' }), false);
  assert.equal(isUserPageLocation({ pathname: '/dashboard', hostname: 'iveo.site', search: '' }), false);
});


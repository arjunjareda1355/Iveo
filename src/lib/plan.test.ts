import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseReservedUsername, isOwnerEmail } from './plan';
import { validateUsername } from './username-rules';
import { validateUsernameSync } from './username';
import {
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
  assert.equal(validateUsername('admin', { allowReserved: false }).ok, false);
  assert.equal(validateUsername('iveo', { allowReserved: false }).ok, false);
  assert.equal(validateUsername('help', { allowReserved: false }).ok, false);

  assert.equal(validateUsername('admin', { allowReserved: true }).ok, true);
  assert.equal(validateUsername('iveo', { allowReserved: true }).ok, true);
  assert.equal(validateUsername('help', { allowReserved: true }).ok, true);

  for (const sysRoute of ['login', 'signup', 'dashboard', 'onboarding', 'account']) {
    const res = validateUsername(sysRoute, { allowReserved: true });
    assert.equal(res.ok, false, `Expected ${sysRoute} to remain blocked`);
  }
});

test('validateUsernameServer allows reserved handles for privileged callers and blocks private routes', () => {
  assert.equal(validateUsernameServer('admin', { allowReserved: false }).ok, false);
  assert.equal(validateUsernameServer('admin', { allowReserved: true }).ok, true);
  assert.equal(validateUsernameServer('iveo', { allowReserved: true }).ok, true);
  assert.equal(validateUsernameServer('dashboard', { allowReserved: true }).ok, false);
  assert.equal(validateUsernameServer('login', { allowReserved: true }).ok, false);
});

test('validateUsernameSync forwards email for reserved handles', () => {
  assert.equal(validateUsernameSync('admin', { email: 'regular@gmail.com' }).status, 'unavailable');
  assert.equal(validateUsernameSync('admin', { email: 'example@iveo.site' }).status, 'available');
  assert.equal(validateUsernameSync('iveo', { email: 'arjunjareda2007@gmail.com' }).status, 'available');
  assert.equal(validateUsernameSync('login', { email: 'example@iveo.site' }).status, 'unavailable');
});

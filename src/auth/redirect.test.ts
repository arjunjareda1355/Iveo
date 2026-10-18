import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from './redirect.ts';
import {
  normalizeUsername,
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../lib/username-rules.ts';

test('safeRedirectPath: accepts valid internal paths', () => {
  assert.equal(safeRedirectPath('/dashboard'), '/dashboard');
  assert.equal(safeRedirectPath('/dashboard?tab=appearance'), '/dashboard?tab=appearance');
  assert.equal(safeRedirectPath('/onboarding'), '/onboarding');
});

test('safeRedirectPath: rejects external URLs, schemes, backslashes and auth routes', () => {
  assert.equal(safeRedirectPath('//evil.com'), null);
  assert.equal(safeRedirectPath('https://evil.com'), null);
  assert.equal(safeRedirectPath('/\\evil.com'), null);
  assert.equal(safeRedirectPath('/login'), null);
  assert.equal(safeRedirectPath('/signup'), null);
  assert.equal(safeRedirectPath('/login/step'), null);
  assert.equal(safeRedirectPath('javascript:alert(1)'), null);
});

test('username-rules: validates min, max, patterns, and reserved names', () => {
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('valid_123').ok, true);
  assert.equal(validateUsername('dashboard').ok, false);
  assert.equal(validateUsername('login').ok, false);
  assert.equal(validateUsername('account').ok, false);
  assert.equal(normalizeUsername('Cool_User!123'), 'cool_user123');
  assert.equal(normalizeUsername('a'.repeat(30)).length, USERNAME_MAX);
});

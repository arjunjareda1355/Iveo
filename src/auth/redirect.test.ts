import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from './redirect.ts';
import {
  normalizeUsername,
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
  RESERVED_USERNAMES_SET,
} from '../lib/username-rules.ts';
import {
  parsePreferences,
  DEFAULT_PREFERENCES,
} from '../lib/preferences.ts';

test('safeRedirectPath: accepts valid internal paths', () => {
  assert.equal(safeRedirectPath('/dashboard'), '/dashboard');
  assert.equal(safeRedirectPath('/dashboard?tab=appearance'), '/dashboard?tab=appearance');
  assert.equal(safeRedirectPath('/dashboard/settings'), '/dashboard/settings');
  assert.equal(safeRedirectPath('/onboarding'), '/onboarding');
  assert.equal(safeRedirectPath('/account'), '/account');
});

test('safeRedirectPath: rejects external URLs, schemes, backslashes and auth routes', () => {
  assert.equal(safeRedirectPath('//evil.com'), null);
  assert.equal(safeRedirectPath('https://evil.com'), null);
  assert.equal(safeRedirectPath('http://evil.com/dashboard'), null);
  assert.equal(safeRedirectPath('/\\evil.com'), null);
  assert.equal(safeRedirectPath('/login'), null);
  assert.equal(safeRedirectPath('/signup'), null);
  assert.equal(safeRedirectPath('/login/step'), null);
  assert.equal(safeRedirectPath('/signup/continue'), null);
  assert.equal(safeRedirectPath('javascript:alert(1)'), null);
  assert.equal(safeRedirectPath(''), null);
  assert.equal(safeRedirectPath('   '), null);
  assert.equal(safeRedirectPath(null), null);
  assert.equal(safeRedirectPath(undefined), null);
  assert.equal(safeRedirectPath('/with\\backslash'), null);
  assert.equal(safeRedirectPath('/' + 'a'.repeat(600)), null);
});

test('username-rules: enforces bounds and patterns', () => {
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('a'.repeat(25)).ok, false);
  assert.equal(validateUsername('valid_123').ok, true);
  assert.equal(validateUsername('with-hyphen').ok, false);
  assert.equal(validateUsername('with.dot').ok, false);
  assert.equal(validateUsername('with space').ok, false);
});

test('username-rules: rejects every reserved route name', () => {
  const reservedSample = [
    'admin',
    'api',
    'app',
    'about',
    'account',
    'accounts',
    'auth',
    'billing',
    'blog',
    'contact',
    'dashboard',
    'help',
    'home',
    'ivio',
    'login',
    'logout',
    'mail',
    'onboarding',
    'pricing',
    'privacy',
    'root',
    'settings',
    'signin',
    'signout',
    'signup',
    'sso-callback',
    'ssocallback',
    'status',
    'support',
    'terms',
    'user',
    'users',
    'verify',
    'www',
    'null',
    'undefined',
  ];

  for (const name of reservedSample) {
    assert.equal(
      RESERVED_USERNAMES_SET.has(name.toLowerCase()),
      true,
      `Expected ${name} to be in RESERVED_USERNAMES_SET`
    );
    const result = validateUsername(name);
    assert.equal(
      result.ok,
      false,
      `Expected validateUsername("${name}") to fail validation`
    );
  }
});

test('username-rules: normalizes properly', () => {
  assert.equal(normalizeUsername('Cool_User!123'), 'cool_user123');
  assert.equal(normalizeUsername(''), '');
  assert.equal(normalizeUsername('A'.repeat(30)).length, USERNAME_MAX);
});

test('preferences: parses defensively with defaults on unknown data', () => {
  const fallback = parsePreferences(null);
  assert.deepEqual(fallback, DEFAULT_PREFERENCES);

  const fallbackFromEmpty = parsePreferences({});
  assert.equal(fallbackFromEmpty.vibeId, 'clean');
  assert.equal(fallbackFromEmpty.buttonShape, null);
  assert.equal(fallbackFromEmpty.onboardingComplete, false);

  const valid = parsePreferences({
    vibeId: 'midnight',
    buttonShape: 'pill',
    onboardingComplete: true,
    onboardedAt: '2026-10-18T10:00:00.000Z',
  });
  assert.equal(valid.vibeId, 'midnight');
  assert.equal(valid.buttonShape, 'pill');
  assert.equal(valid.onboardingComplete, true);
  assert.equal(valid.onboardedAt, '2026-10-18T10:00:00.000Z');

  // Rejects invalid vibes and shapes
  const invalidVibe = parsePreferences({ vibeId: 'neon-glow', buttonShape: 'hexagon' });
  assert.equal(invalidVibe.vibeId, 'clean');
  assert.equal(invalidVibe.buttonShape, null);
});

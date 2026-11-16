import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUsername,
  validateUsernameSync,
  RESERVED_USERNAMES,
  SIMULATED_TAKEN_USERNAMES,
} from './username.ts';

test('sanitizeUsername: lowercases, strips disallowed characters, enforces max length 30', () => {
  assert.equal(sanitizeUsername('Hello_World!@#$123'), 'helloworld123');
  assert.equal(sanitizeUsername('USER-NAME.TEST'), 'user-nametest');
  assert.equal(sanitizeUsername('a'.repeat(35)), 'a'.repeat(30));
  assert.equal(sanitizeUsername('valid-name-1'), 'valid-name-1');
});

test('validateUsernameSync: handles empty and short inputs', () => {
  assert.equal(validateUsernameSync('').status, 'empty');
  assert.equal(validateUsernameSync('ab').status, 'too_short');
  assert.equal(validateUsernameSync('ab').message, 'Use 3 to 30 letters, numbers or hyphens.');
});

test('validateUsernameSync: rejects reserved usernames and contains zero fake demo taken usernames', () => {
  assert.equal(SIMULATED_TAKEN_USERNAMES.size, 0);

  for (const name of RESERVED_USERNAMES) {
    const res = validateUsernameSync(name);
    assert.equal(res.status, 'unavailable', `Expected ${name} to be unavailable`);
  }
});

test('validateUsernameSync: accepts valid available usernames and strips leading @', () => {
  const res = validateUsernameSync('new-creator-99');
  assert.equal(res.status, 'available');
  if (res.status === 'available') {
    assert.equal(res.username, 'new-creator-99');
    assert.equal(res.message, 'iveo.site/@new-creator-99 is available');
  }

  const resAt = validateUsernameSync('@maya-studio');
  assert.equal(resAt.status, 'available');
  if (resAt.status === 'available') {
    assert.equal(resAt.username, 'maya-studio');
    assert.equal(resAt.message, 'iveo.site/@maya-studio is available');
  }
});

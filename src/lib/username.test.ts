import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUsername,
  validateUsernameSync,
  RESERVED_USERNAMES,
  SIMULATED_TAKEN_USERNAMES,
} from './username.ts';

test('sanitizeUsername: lowercases, strips disallowed characters, enforces max length 24', () => {
  assert.equal(sanitizeUsername('Hello_World!@#$123'), 'hello_world123');
  assert.equal(sanitizeUsername('USER-NAME.TEST'), 'usernametest');
  assert.equal(sanitizeUsername('a'.repeat(30)), 'a'.repeat(24));
  assert.equal(sanitizeUsername('valid_name_1'), 'valid_name_1');
});

test('validateUsernameSync: handles empty and short inputs', () => {
  assert.equal(validateUsernameSync('').status, 'empty');
  assert.equal(validateUsernameSync('ab').status, 'too_short');
  assert.equal(validateUsernameSync('ab').message, 'Use 3 to 24 letters, numbers or underscores.');
});

test('validateUsernameSync: rejects reserved and taken usernames', () => {
  for (const name of RESERVED_USERNAMES) {
    const res = validateUsernameSync(name);
    assert.equal(res.status, 'unavailable', `Expected ${name} to be unavailable`);
    assert.equal(res.message, "That name isn't available. Try another.");
  }

  for (const name of SIMULATED_TAKEN_USERNAMES) {
    const res = validateUsernameSync(name);
    assert.equal(res.status, 'unavailable', `Expected ${name} to be unavailable`);
  }
});

test('validateUsernameSync: accepts valid available usernames', () => {
  const res = validateUsernameSync('new_creator_99');
  assert.equal(res.status, 'available');
  if (res.status === 'available') {
    assert.equal(res.username, 'new_creator_99');
    assert.equal(res.message, 'ivio.site/new_creator_99 is available');
  }
});

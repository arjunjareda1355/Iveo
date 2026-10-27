import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isSafeHref } from './urls';
import { sanitizeSearchTerm } from '../data/contactsApi';
import { PRO_FEATURES, PRO_FEATURE_NAMES, getProFeatureName } from './plan';

describe('step4e: password-protected links and contact collection', () => {
  it('isSafeHref: validates safe URLs and blocks dangerous protocols', () => {
    assert.strictEqual(isSafeHref('https://example.com'), true);
    assert.strictEqual(isSafeHref('http://example.com/page?ref=iveo'), true);
    assert.strictEqual(isSafeHref('javascript:alert(1)'), false);
    assert.strictEqual(isSafeHref('data:text/html,<script>alert(1)</script>'), false);
    assert.strictEqual(isSafeHref('vbscript:msgbox(1)'), false);
    assert.strictEqual(isSafeHref(''), false);
  });

  it('sanitizeSearchTerm: sanitizes user inputs for ILIKE queries', () => {
    assert.strictEqual(sanitizeSearchTerm('  alice  '), 'alice');
    assert.strictEqual(sanitizeSearchTerm('a'.repeat(150)).length, 64);
    assert.strictEqual(sanitizeSearchTerm('test\x00\x08name'), 'testname');
    assert.strictEqual(sanitizeSearchTerm(''), '');
  });

  it('plan: defines password_links and contact_forms as Pro features', () => {
    assert.strictEqual(getProFeatureName('password_links'), 'Password-protected links');
    assert.strictEqual(getProFeatureName('contact_forms'), 'Email and phone collection');
    assert.strictEqual(PRO_FEATURES.includes('password_links'), true);
    assert.strictEqual(PRO_FEATURES.includes('contact_forms'), true);
    assert.strictEqual(PRO_FEATURE_NAMES.password_links, 'Password-protected links');
    assert.strictEqual(PRO_FEATURE_NAMES.contact_forms, 'Email and phone collection');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVCardString, sanitizeVCardFilename } from './vcard';

test('buildVCardString generates standard RFC 6350 vCard with CRLF', () => {
  const vcard = buildVCardString({
    fullName: 'Alex Morgan',
    title: 'Lead Designer',
    organization: 'Studio Creative',
    phone: '+1 555 123 4567',
    email: 'alex@example.com',
    note: 'Let us connect on design systems',
    url: 'https://iveo.site/alex',
  });

  assert.match(vcard, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(vcard, /\r\nFN:Alex Morgan\r\n/);
  assert.match(vcard, /\r\nTITLE:Lead Designer\r\n/);
  assert.match(vcard, /\r\nORG:Studio Creative\r\n/);
  assert.match(vcard, /\r\nTEL;TYPE=CELL,VOICE:\+1 555 123 4567\r\n/);
  assert.match(vcard, /\r\nEMAIL;TYPE=INTERNET,PREF:alex@example\.com\r\n/);
  assert.match(vcard, /\r\nNOTE:Let us connect on design systems\r\n/);
  assert.match(vcard, /\r\nURL:https:\/\/iveo\.site\/alex\r\n/);
  assert.match(vcard, /\r\nEND:VCARD$/);
});

test('buildVCardString omits optional fields when empty', () => {
  const vcard = buildVCardString({
    fullName: 'Jane Doe',
  });

  assert.ok(vcard.includes('FN:Jane Doe'));
  assert.ok(!vcard.includes('TITLE:'));
  assert.ok(!vcard.includes('ORG:'));
  assert.ok(!vcard.includes('TEL:'));
});

test('sanitizeVCardFilename creates safe filenames with .vcf extension', () => {
  assert.equal(sanitizeVCardFilename('Sarah Jenkins'), 'sarah_jenkins.vcf');
  assert.equal(sanitizeVCardFilename('Alex M. O\'Connor!'), 'alex_m_o_connor.vcf');
  assert.equal(sanitizeVCardFilename(''), 'contact.vcf');
});

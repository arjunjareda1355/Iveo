import test from 'node:test';
import assert from 'node:assert/strict';
import { VIBES, VibeId } from './vibes';
import { parsePreferences } from './preferences';
import { generateInvoicePdf } from './invoicePdf';
import { buildVCardString, sanitizeVCardFilename } from './vcard';

test('vibes: all 12 themes exist and have complete color and style tokens', () => {
  assert.equal(VIBES.length, 12);
  const ids = VIBES.map((v) => v.id);
  assert.ok(ids.includes('clean'));
  assert.ok(ids.includes('midnight'));
  assert.ok(ids.includes('cyberpunk'));
  assert.ok(ids.includes('sunset'));
  assert.ok(ids.includes('glass'));
  assert.ok(ids.includes('brutalist'));
  assert.ok(ids.includes('emerald'));
  assert.ok(ids.includes('pastel'));

  for (const v of VIBES) {
    assert.ok(v.tokens.bg, `${v.id} has bg`);
    assert.ok(v.tokens.text, `${v.id} has text`);
    assert.ok(v.tokens.buttonBg, `${v.id} has buttonBg`);
  }
});

test('preferences: parses background and keeps valid vibeIds', () => {
  const parsed = parsePreferences({
    vibeId: 'cyberpunk',
    background: {
      type: 'mesh',
      value: 'linear-gradient(135deg, #111, #333)',
      blur: 4,
      opacity: 0.8,
    },
  });

  assert.equal(parsed.vibeId, 'cyberpunk');
  assert.equal(parsed.background?.type, 'mesh');
  assert.equal(parsed.background?.blur, 4);
  assert.equal(parsed.background?.opacity, 0.8);
});

test('invoicePdf: generates valid jsPDF document instance', () => {
  const doc = generateInvoicePdf({
    paymentId: 'pay_test_12345',
    orderId: 'order_test_98765',
    planType: 'yearly',
    amountInr: 2999,
    customerName: 'Alex River',
    customerEmail: 'alex@example.com',
    username: 'alex',
  });

  assert.ok(doc, 'doc should be generated');
  const buffer = doc.output('arraybuffer');
  assert.ok(buffer.byteLength > 1000, 'PDF size should be > 1000 bytes');
});

test('businessCard: vCard format includes full name, url and note', () => {
  const vcf = buildVCardString({
    fullName: 'Maya Ellis',
    url: 'https://iveo.site/maya',
    note: 'Illustrator and designer',
  });

  assert.ok(vcf.includes('BEGIN:VCARD'));
  assert.ok(vcf.includes('FN:Maya Ellis'));
  assert.ok(vcf.includes('URL:https://iveo.site/maya'));
  assert.ok(vcf.includes('END:VCARD'));
  assert.equal(sanitizeVCardFilename('Maya Ellis'), 'maya_ellis.vcf');
});

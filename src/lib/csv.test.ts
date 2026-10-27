import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCsvCell, buildContactsCsv } from './csv.ts';
import { Contact } from '../data/types.ts';

test('csv: formatCsvCell properly escapes commas, quotes, and line breaks', () => {
  assert.equal(formatCsvCell('Normal text'), 'Normal text');
  assert.equal(formatCsvCell('Hello, world'), '"Hello, world"');
  assert.equal(formatCsvCell('Hello "VIP" world'), '"Hello ""VIP"" world"');
  assert.equal(formatCsvCell('Line1\nLine2'), '"Line1\nLine2"');
  assert.equal(formatCsvCell(null), '');
});

test('csv: formatCsvCell protects against spreadsheet formula injection', () => {
  assert.equal(formatCsvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(formatCsvCell('-100'), "'-100");
  assert.equal(formatCsvCell('+123foo'), "'+123foo");
  assert.equal(formatCsvCell('@handle'), "'@handle");
  assert.equal(formatCsvCell('\tsecret'), "'\tsecret");
});

test('csv: formatCsvCell preserves valid phone numbers starting with +', () => {
  assert.equal(formatCsvCell('+15551234567', true), '+15551234567');
  assert.equal(formatCsvCell('+447911123456', true), '+447911123456');
  assert.equal(formatCsvCell('+1(555)123-4567', true), "'+1(555)123-4567");
});

test('csv: buildContactsCsv prepends UTF-8 BOM, adds header and formats rows with CRLF', () => {
  const contacts: Contact[] = [
    {
      id: 'c1',
      linkId: 'l1',
      formTitle: 'Join my list, VIP',
      email: 'user@example.com',
      phone: '+15551234567',
      consentText: 'I agree to "marketing" updates.',
      source: 'instagram',
      createdAt: '2026-10-26T12:00:00.000Z',
    },
    {
      id: 'c2',
      linkId: null,
      formTitle: '=FormulaAttack',
      email: null,
      phone: null,
      consentText: 'Consent line',
      source: '',
      createdAt: '2026-10-25T12:00:00.000Z',
    },
  ];

  const csv = buildContactsCsv(contacts);
  assert.ok(csv.startsWith('\uFEFFDate,Email,Phone,Form,Source,Consent\r\n'));
  assert.ok(csv.includes('2026-10-26T12:00:00.000Z,user@example.com,+15551234567,"Join my list, VIP",Instagram,"I agree to ""marketing"" updates."\r\n'));
  assert.ok(csv.includes("2026-10-25T12:00:00.000Z,,,'=FormulaAttack,Direct,Consent line\r\n"));
});

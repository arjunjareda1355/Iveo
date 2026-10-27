import { Contact } from '../data/types';
import { SOURCE_LABELS, TrackSource } from './analytics/sources';

/**
 * CSV Formatting Examples:
 *
 * Example 1 (normal row):
 * 2026-10-26T12:00:00.000Z,alex@example.com,+15551234567,Join my list,Instagram,I agree to receive messages from Alex.
 *
 * Example 2 (contains a comma):
 * 2026-10-26T12:00:00.000Z,sam@example.com,,Newsletter,Direct,"I agree to news, updates and notes from Sam."
 *
 * Example 3 (contains double quotes):
 * 2026-10-26T12:00:00.000Z,lee@example.com,,,Direct,"I agree to ""VIP"" updates from Lee."
 *
 * Example 4 (contains a line break):
 * 2026-10-26T12:00:00.000Z,pat@example.com,,Special List,Twitter,"Line one
 * Line two"
 *
 * Example 5 (formula protection leading with '='):
 * 2026-10-26T12:00:00.000Z,user@example.com,,'=SUM(1,2),Direct,I agree to receive messages.
 *
 * Example 6 (phone starting with '+' is preserved as valid phone without prepending quote):
 * 2026-10-26T12:00:00.000Z,,+447911123456,Phone List,Direct,I agree to receive text messages.
 */

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function formatCsvCell(value: string | null | undefined, isPhone = false): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text = String(value);
  const trimmed = text.trim();

  // Formula protection: if a cell (after trimming) starts with =, +, -, @, a tab or a carriage return, prefix it with '
  // EXCEPTION: Phone matching /^\+?[0-9]+$/ is kept as-is!
  const spaceTrimmed = text.replace(/^[ ]+/, '');
  const rawFirstChar = text[0] || '';
  const trimmedFirstChar = spaceTrimmed[0] || '';

  const isTrigger =
    FORMULA_TRIGGERS.has(rawFirstChar) ||
    (spaceTrimmed.length > 0 && FORMULA_TRIGGERS.has(trimmedFirstChar));

  if (isTrigger) {
    if (isPhone && /^\+?[0-9]+$/.test(text.trim())) {
      // Valid phone starting with + is written as is
    } else {
      text = `'${text}`;
    }
  }

  // Quoting: wrap in double quotes if it contains comma, quote, \r, or \n
  if (text.includes(',') || text.includes('"') || text.includes('\r') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildContactsCsv(rows: Contact[]): string {
  const BOM = '\uFEFF';
  const header = 'Date,Email,Phone,Form,Source,Consent';

  const lines = rows.map((contact) => {
    let dateStr = '';
    try {
      dateStr = new Date(contact.createdAt).toISOString();
    } catch {
      dateStr = contact.createdAt || '';
    }

    const dateCell = formatCsvCell(dateStr);
    const emailCell = formatCsvCell(contact.email || '');
    const phoneCell = formatCsvCell(contact.phone || '', true);
    const formCell = formatCsvCell(contact.formTitle || '');

    // Source display label ("Direct" for "")
    const sourceKey = (contact.source || '') as TrackSource;
    const sourceLabel = sourceKey ? (SOURCE_LABELS[sourceKey] || sourceKey) : 'Direct';
    const sourceCell = formatCsvCell(sourceLabel);

    const consentCell = formatCsvCell(contact.consentText || '');

    return `${dateCell},${emailCell},${phoneCell},${formCell},${sourceCell},${consentCell}`;
  });

  return `${BOM}${header}\r\n${lines.join('\r\n')}${lines.length > 0 ? '\r\n' : ''}`;
}

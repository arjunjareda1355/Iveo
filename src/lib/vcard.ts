export interface VCardPayload {
  fullName: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  note?: string;
  url?: string;
}

/**
 * Builds a standard RFC 6350 vCard (Version 3.0) string.
 */
export function buildVCardString(payload: VCardPayload): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${payload.fullName}`,
    payload.title ? `TITLE:${payload.title}` : '',
    payload.organization ? `ORG:${payload.organization}` : '',
    payload.phone ? `TEL;TYPE=CELL,VOICE:${payload.phone}` : '',
    payload.email ? `EMAIL;TYPE=INTERNET,PREF:${payload.email}` : '',
    payload.note ? `NOTE:${payload.note}` : '',
    payload.url ? `URL:${payload.url}` : '',
    'END:VCARD',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function sanitizeVCardFilename(fullName: string): string {
  const clean = (fullName || 'contact').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${clean.replace(/_+/g, '_').replace(/^_|_$/g, '') || 'contact'}.vcf`;
}

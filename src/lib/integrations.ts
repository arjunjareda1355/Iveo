export interface IntegrationSettings {
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
  whatsappNumber?: string | null;
  customSeoTitle?: string | null;
  customSeoDescription?: string | null;
}

const GA4_REGEX = /^G-[A-Z0-9]{6,16}$/;
const META_PIXEL_REGEX = /^\d{10,20}$/;

/**
 * Validates and normalizes a Google Analytics 4 Measurement ID (e.g. G-XXXXXXXXXX).
 * Returns uppercase trimmed ID or null if blank; throws descriptive error if invalid.
 */
export function normalizeGoogleAnalyticsId(raw: string): { valid: boolean; value: string | null; error?: string } {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return { valid: true, value: null };
  if (!GA4_REGEX.test(cleaned)) {
    return {
      valid: false,
      value: null,
      error: 'Enter a valid GA4 Measurement ID (e.g. G-XXXXXXXXXX).',
    };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validates and normalizes a Meta / Facebook Pixel numeric ID (10-20 digits).
 */
export function normalizeMetaPixelId(raw: string): { valid: boolean; value: string | null; error?: string } {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return { valid: true, value: null };
  if (!META_PIXEL_REGEX.test(cleaned)) {
    return {
      valid: false,
      value: null,
      error: 'Meta Pixel ID must be 10 to 20 digits.',
    };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validates and normalizes a WhatsApp phone number (country code + digits, 7-15 digits).
 */
export function normalizeWhatsAppNumber(raw: string): { valid: boolean; value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      value: null,
      error: 'Include your country code and phone number (7 to 15 digits, e.g. +14155550199).',
    };
  }
  return { valid: true, value: `+${digits}` };
}

/**
 * Returns a clean https://wa.me/<digits> URL for a stored WhatsApp number, or null if invalid.
 */
export function buildWhatsAppUrl(number?: string | null): string | null {
  if (!number) return null;
  const digits = number.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

export function sanitizeSeoField(raw: string, maxLen: number): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

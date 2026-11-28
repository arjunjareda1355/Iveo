export interface GscClientValidationResult {
  valid: boolean;
  error: string | null;
  parsedSummary?: {
    clientEmail: string;
    projectId: string;
  };
}

export function validateGscPropertyUrlInput(rawUrl: string): { valid: boolean; error: string | null } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: true, error: null };
  if (/^sc-domain:/i.test(trimmed)) {
    const domain = trimmed
      .slice('sc-domain:'.length)
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim();
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      return { valid: false, error: 'Domain property must look like sc-domain:iveo.site.' };
    }
    return { valid: true, error: null };
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return { valid: false, error: 'Property URL must start with https:// or sc-domain:.' };
    }
    return { valid: true, error: null };
  } catch {
    return {
      valid: false,
      error: 'Enter a valid Property URL (https://iveo.site/ or sc-domain:iveo.site).',
    };
  }
}

export function validateGscServiceAccountJsonInput(rawJson: string): GscClientValidationResult {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return { valid: false, error: 'Upload or paste a Google Cloud Service Account JSON key.' };
  }
  if (new TextEncoder().encode(trimmed).byteLength > 20 * 1024) {
    return { valid: false, error: 'Service Account JSON file must be 20 KB or smaller.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
  } catch {
    return { valid: false, error: 'Invalid JSON syntax. Paste the complete downloaded .json key file.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'JSON root must be a service account object.' };
  }
  if (parsed.type !== 'service_account') {
    return { valid: false, error: 'JSON must include "type": "service_account".' };
  }
  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  if (!clientEmail || !clientEmail.includes('@')) {
    return { valid: false, error: 'Missing valid "client_email" field.' };
  }
  const projectId = typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
  if (!projectId) {
    return { valid: false, error: 'Missing "project_id" field.' };
  }
  const privateKey = typeof parsed.private_key === 'string' ? parsed.private_key.trim() : '';
  if (!privateKey || !privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    return { valid: false, error: 'Missing valid PEM "private_key" field.' };
  }
  const tokenUri = typeof parsed.token_uri === 'string' ? parsed.token_uri.trim() : '';
  if (!tokenUri.startsWith('https://')) {
    return { valid: false, error: 'Missing valid https:// "token_uri" field.' };
  }

  return {
    valid: true,
    error: null,
    parsedSummary: {
      clientEmail,
      projectId,
    },
  };
}

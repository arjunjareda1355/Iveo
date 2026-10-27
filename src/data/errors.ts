export type DataErrorCode =
  | 'pro_required'
  | 'not_authenticated'
  | 'invalid_password'
  | 'not_found'
  | 'contact_limit'
  | 'rate_limited'
  | 'unknown';

export function parseErrorCode(err: unknown): DataErrorCode {
  if (!err) return 'unknown';
  const message = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message)
    : String(err);

  if (message.includes('pro_required')) return 'pro_required';
  if (message.includes('not_authenticated')) return 'not_authenticated';
  if (message.includes('invalid_password')) return 'invalid_password';
  if (message.includes('not_found')) return 'not_found';
  if (message.includes('contact_limit')) return 'contact_limit';
  if (message.includes('rate_limited') || message.includes('locked')) return 'rate_limited';

  return 'unknown';
}

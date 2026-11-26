/**
 * Client-side bridge holding the active Clerk `getToken` getter.
 * Allows data-sync utilities (`useIvioSession`, `linksApi`, `AppearanceContext`, etc.)
 * to attach Clerk Bearer JWTs on authenticated mutations without altering Clerk flows.
 */

type TokenGetter = () => Promise<string | null>;

let activeTokenGetter: TokenGetter | null = null;

export function registerClerkTokenGetter(getter: TokenGetter | null): void {
  activeTokenGetter = getter;
}

export async function getClerkBearerToken(): Promise<string | null> {
  if (!activeTokenGetter) return null;
  try {
    const token = await activeTokenGetter();
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export async function buildAuthHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...base };
  const token = await getClerkBearerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function pageAddress(origin: string, username: string): string {
  const cleanUser = encodeURIComponent(username.replace(/^@+/, '').toLowerCase().trim());
  return `https://iveo.site/@${cleanUser}`;
}

export function ogImageAddress(
  origin: string,
  username?: string,
  v?: string
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  if (!username) {
    return `${cleanOrigin}/api/og`;
  }

  const params = new URLSearchParams({ u: username.toLowerCase() });
  if (v) {
    params.set('v', v);
  }

  return `${cleanOrigin}/api/og?${params.toString()}`;
}

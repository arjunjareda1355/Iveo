import { showGlobalLoader, type ShowLoaderOptions } from '../components/ui/LoaderProvider';

export interface ApiFetchOptions extends RequestInit {
  silent?: boolean;
  loaderOptions?: ShowLoaderOptions;
}

/**
 * Central fetch wrapper wired to the single root LoaderProvider.
 * Operations finishing in < 300ms never flash the overlay.
 */
export async function apiFetch(input: RequestInfo | URL, init?: ApiFetchOptions): Promise<Response> {
  const { silent, loaderOptions, ...fetchInit } = init || {};
  const release = silent ? null : showGlobalLoader(loaderOptions);
  try {
    return await fetch(input, fetchInit);
  } finally {
    release?.();
  }
}

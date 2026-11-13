import { useEffect } from 'react';

interface PageMetaOptions {
  title?: string;
  description?: string;
  robots?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
}

function setOrCreateMeta(attr: 'name' | 'property', key: string, content: string): {
  el: HTMLMetaElement;
  prev: string | null;
} {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  let prev: string | null = null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  } else {
    prev = el.getAttribute('content');
  }
  el.setAttribute('content', content);
  return { el, prev };
}

export function usePageMeta(options: PageMetaOptions | string) {
  const title = typeof options === 'string' ? options : options.title;
  const description = typeof options === 'object' ? options.description : undefined;
  const robots = typeof options === 'object' ? options.robots : undefined;
  const canonical = typeof options === 'object' ? options.canonical : undefined;
  const ogTitle = typeof options === 'object' ? options.ogTitle : undefined;
  const ogDescription = typeof options === 'object' ? options.ogDescription : undefined;

  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }

    let descState: { el: HTMLMetaElement; prev: string | null } | null = null;
    if (description) {
      descState = setOrCreateMeta('name', 'description', description);
    }

    let robotsState: { el: HTMLMetaElement; prev: string | null } | null = null;
    if (robots) {
      robotsState = setOrCreateMeta('name', 'robots', robots);
    }

    let ogTitleState: { el: HTMLMetaElement; prev: string | null } | null = null;
    if (ogTitle || title) {
      ogTitleState = setOrCreateMeta('property', 'og:title', ogTitle || title || '');
    }

    let ogDescState: { el: HTMLMetaElement; prev: string | null } | null = null;
    if (ogDescription || description) {
      ogDescState = setOrCreateMeta(
        'property',
        'og:description',
        ogDescription || description || ''
      );
    }

    let canonicalEl: HTMLLinkElement | null = null;
    let prevCanonical: string | null = null;
    if (canonical) {
      canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        document.head.appendChild(canonicalEl);
      } else {
        prevCanonical = canonicalEl.getAttribute('href');
      }
      canonicalEl.href = canonical;
    }

    return () => {
      if (title) {
        document.title = prevTitle;
      }
      if (descState && descState.prev !== null) {
        descState.el.setAttribute('content', descState.prev);
      }
      if (robotsState) {
        robotsState.el.setAttribute('content', robotsState.prev ?? 'index, follow');
      }
      if (ogTitleState && ogTitleState.prev !== null) {
        ogTitleState.el.setAttribute('content', ogTitleState.prev);
      }
      if (ogDescState && ogDescState.prev !== null) {
        ogDescState.el.setAttribute('content', ogDescState.prev);
      }
      if (canonicalEl && prevCanonical !== null) {
        canonicalEl.href = prevCanonical;
      }
    };
  }, [title, description, robots, canonical, ogTitle, ogDescription]);
}

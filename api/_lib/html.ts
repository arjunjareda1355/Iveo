/**
 * HTML Escaping, Tag Injection and JSON-LD serialization helpers.
 *
 * Examples:
 * 1. escapeHtml('<script>alert("hello")</script>')
 *    => '&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;'
 * 2. escapeHtml("Line 1\nLine 2\r\n\tTab")
 *    => 'Line 1 Line 2  Tab'
 * 3. truncate("Hello world from iveo", 11)
 *    => 'Hello world...'
 * 4. safeJsonLd({ bio: "</script><script>alert(1)</script>" })
 *    => '{"bio":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}'
 * 5. injectHead("<html><head><title>Old</title></head><body></body></html>", "<title>New</title>")
 *    => '<html><head><title>New</title></head><body></body></html>'
 * 6. injectHead("<html><body>No head tag</body></html>", "<title>New</title>")
 *    => '<html><body>No head tag</body></html>'
 */

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    // Replace control characters and newlines with spaces
    .replace(/[\x00-\x1F\x7F\r\n]/g, ' ')
    // Collapse multiple consecutive spaces
    .replace(/\s+/g, ' ')
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + '...';
}

export function safeJsonLd(object: unknown): string {
  const json = JSON.stringify(object);
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function injectHead(template: string, tags: string): string {
  const headClosingIndex = template.search(/<\/head>/i);
  if (headClosingIndex === -1) {
    return template;
  }

  // Extract head content
  const headOpeningIndex = template.search(/<head[^>]*>/i);
  if (headOpeningIndex === -1) {
    return template;
  }

  let headContent = template.slice(headOpeningIndex, headClosingIndex);

  // Remove existing metadata elements case-insensitively
  headContent = headContent
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]*\bname=["']description["'][^>]*>/gi, '')
    .replace(/<meta[^>]*\bname=["']robots["'][^>]*>/gi, '')
    .replace(/<meta[^>]*\bproperty=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta[^>]*\bname=["']twitter:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta[^>]*\bproperty=["']profile:[^"']*["'][^>]*>/gi, '')
    .replace(/<link[^>]*\brel=["']canonical["'][^>]*>/gi, '')
    .replace(/<link[^>]*\bid=["']iveo-ssr-fonts["'][^>]*>/gi, '')
    .replace(/<style[^>]*\bid=["']iveo-ssr-theme["'][^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*\bid=["']iveo-ssr-bootstrap["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const newHead = `${headContent.trimEnd()}\n    ${tags}\n  `;
  return `${template.slice(0, headOpeningIndex)}${newHead}${template.slice(headClosingIndex)}`;
}

/**
 * Injects crawlable semantic HTML inside <div id="root">...</div> so Googlebot / curl
 * receive full headings, bio, social links, and outbound block links before JS hydration.
 */
export function injectRootSsr(template: string, innerHtml: string): string {
  if (!innerHtml) return template;
  const emptyRootRegex = /<div\b([^>]*\bid=["']root["'][^>]*)><\/div>/i;
  if (emptyRootRegex.test(template)) {
    return template.replace(emptyRootRegex, `<div$1>${innerHtml}</div>`);
  }
  const openRootRegex = /<div\b([^>]*\bid=["']root["'][^>]*)>/i;
  if (openRootRegex.test(template)) {
    return template.replace(openRootRegex, `<div$1>${innerHtml}`);
  }
  return template;
}


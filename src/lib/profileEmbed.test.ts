import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfileEmbedIframeCode,
  buildProfileEmbedUrl,
  getEmbedStyleMeta,
  normalizeEmbedStyle,
  normalizeEmbedTheme,
} from './profileEmbed.ts';

test('profileEmbed: normalizes styles and themes with safe defaults', () => {
  assert.equal(normalizeEmbedStyle('minimal'), 'minimal');
  assert.equal(normalizeEmbedStyle('BADGE'), 'badge');
  assert.equal(normalizeEmbedStyle('unknown'), 'card');
  assert.equal(normalizeEmbedTheme('glass'), 'glass');
  assert.equal(normalizeEmbedTheme('unknown'), 'auto');
});

test('profileEmbed: builds canonical embed URL with @handle and query params', () => {
  const url = buildProfileEmbedUrl('@Maya', {
    style: 'minimal',
    theme: 'dark',
    origin: 'https://iveo.site',
  });
  assert.equal(url, 'https://iveo.site/embed/@maya?style=minimal&theme=dark');
});

test('profileEmbed: builds iframe snippet matching style dimensions', () => {
  const meta = getEmbedStyleMeta('badge');
  const html = buildProfileEmbedIframeCode('arjun', {
    style: 'badge',
    theme: 'light',
    origin: 'https://iveo.site',
    displayName: 'Arjun',
  });
  assert.ok(html.includes('src="https://iveo.site/embed/@arjun?style=badge&theme=light"'));
  assert.ok(html.includes(`height="${meta.defaultHeight}"`));
  assert.ok(html.includes(`max-width:${meta.maxWidth}`));
  assert.ok(html.includes('title="Arjun — Iveo Profile"'));
});

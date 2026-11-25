import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatformFromUrl,
  extractDomainForFavicon,
  getFaviconUrl,
  inferLinkIconKind,
} from './favicons';

test('extractDomainForFavicon parses valid http/https and schemeless URLs', () => {
  assert.equal(extractDomainForFavicon('https://github.com/iveo'), 'github.com');
  assert.equal(extractDomainForFavicon('https://www.notion.so/my-page'), 'notion.so');
  assert.equal(extractDomainForFavicon('open.spotify.com/artist/123'), 'open.spotify.com');
  assert.equal(extractDomainForFavicon('http://example.org:8080/path'), 'example.org');
});

test('extractDomainForFavicon rejects non-web schemes, localhost, and invalid hosts', () => {
  assert.equal(extractDomainForFavicon('mailto:hello@iveo.site'), null);
  assert.equal(extractDomainForFavicon('tel:+15550001234'), null);
  assert.equal(extractDomainForFavicon('javascript:alert(1)'), null);
  assert.equal(extractDomainForFavicon('http://localhost:3000'), null);
  assert.equal(extractDomainForFavicon('http://127.0.0.1/test'), null);
  assert.equal(extractDomainForFavicon('not a url'), null);
  assert.equal(extractDomainForFavicon(''), null);
});

test('getFaviconUrl produces clean Google favicon endpoint URLs', () => {
  assert.equal(
    getFaviconUrl('https://www.youtube.com/@iveo'),
    'https://www.google.com/s2/favicons?domain=youtube.com&sz=64'
  );
  assert.equal(getFaviconUrl('mailto:team@iveo.site'), null);
});

test('inferLinkIconKind maps URLs to appropriate fallback icon kinds', () => {
  assert.equal(inferLinkIconKind('mailto:hi@iveo.site'), 'mail');
  assert.equal(inferLinkIconKind('tel:+123456789'), 'phone');
  assert.equal(inferLinkIconKind('https://github.com/vercel'), 'code');
  assert.equal(inferLinkIconKind('https://open.spotify.com/track/1'), 'music');
  assert.equal(inferLinkIconKind('https://youtu.be/abc'), 'video');
  assert.equal(inferLinkIconKind('https://clips.twitch.tv/ClipSlug'), 'video');
  assert.equal(inferLinkIconKind('https://creator.gumroad.com/l/kit'), 'shop');
  assert.equal(inferLinkIconKind('https://example.com'), 'globe');
  assert.equal(inferLinkIconKind(''), 'link');
});

test('detectPlatformFromUrl identifies Twitch and Snapchat handles cleanly', () => {
  assert.deepEqual(detectPlatformFromUrl('https://twitch.tv/shroud'), {
    id: 'twitch',
    name: 'Twitch',
    handle: 'shroud',
  });
  assert.deepEqual(detectPlatformFromUrl('https://www.snapchat.com/add/arjun.creator'), {
    id: 'snapchat',
    name: 'Snapchat',
    handle: '@arjun.creator',
  });
  assert.deepEqual(detectPlatformFromUrl('https://t.snapchat.com/abc123'), {
    id: 'snapchat',
    name: 'Snapchat',
    handle: '@abc123',
  });
});

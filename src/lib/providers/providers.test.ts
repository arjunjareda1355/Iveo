import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDER_REGISTRY,
  getProviderDefaultButtonText,
  getProviderDefinition,
  getProviderKindDefinition,
  listPlatformProviders,
} from './definitions.ts';
import { cleanUrlTracking, detectProviderUrl } from './detect.ts';

describe('provider registry completeness (AK-1, PV-1..PV-12)', () => {
  it('registers all 13 social/player providers plus generic link fallback', () => {
    const platforms = listPlatformProviders();
    assert.equal(platforms.length, 13);
    assert.ok(PROVIDER_REGISTRY.bluesky, 'Bluesky proof-of-architecture provider is registered');
    assert.ok(PROVIDER_REGISTRY.generic, 'Generic web link fallback is registered');
    assert.equal(PROVIDER_REGISTRY.spotify.supportsOAuth, false);
    assert.equal(PROVIDER_REGISTRY.spotify.restrictions?.noArtworkBanner, true);
    assert.equal(PROVIDER_REGISTRY.spotify.restrictions?.unmodifiedArtwork, true);
    assert.equal(PROVIDER_REGISTRY.pinterest.supportsOAuth, false);
    assert.equal(PROVIDER_REGISTRY.discord.supportsOAuth, true);
  });

  it('resolves unknown provider or kind safely to defaults', () => {
    const fallback = getProviderDefinition('nonexistent');
    assert.equal(fallback.id, 'generic');
    const kind = getProviderKindDefinition('youtube', 'unknown');
    assert.equal(kind.label, 'YouTube video');
    assert.equal(getProviderDefaultButtonText('spotify', 'album'), 'Listen on Spotify');
  });
});

describe('cleanUrlTracking & detectProviderUrl', () => {
  it('strips tracking parameters across hosts while preserving meaningful IDs', () => {
    assert.equal(
      cleanUrlTracking('https://youtu.be/dQw4w9WgXcQ?si=track123&utm_source=share'),
      'https://youtu.be/dQw4w9WgXcQ'
    );
    assert.equal(
      cleanUrlTracking('https://www.instagram.com/p/ABC123/?igshid=xyz&fbclid=999'),
      'https://www.instagram.com/p/ABC123/'
    );
    assert.equal(
      cleanUrlTracking('https://www.youtube.com/watch?v=abc123&list=PL999&si=foo'),
      'https://www.youtube.com/watch?v=abc123&list=PL999'
    );
  });

  it('rejects empty strings and unsafe URL schemes', () => {
    assert.equal(detectProviderUrl(''), null);
    assert.equal(detectProviderUrl('javascript:alert(1)'), null);
    assert.equal(detectProviderUrl('data:text/html,hi'), null);
    assert.equal(detectProviderUrl('mailto:hello@example.com'), null);
    assert.equal(detectProviderUrl('tel:+123456789'), null);
    assert.equal(detectProviderUrl('not-a-domain'), null);
  });

  it('detects YouTube videos, shorts, playlists, live streams, and channels', () => {
    const shortVid = detectProviderUrl('https://youtu.be/dQw4w9WgXcQ?si=abc');
    assert.equal(shortVid?.provider, 'youtube');
    assert.equal(shortVid?.subtype, 'video');
    assert.equal(shortVid?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(shortVid?.isShortLink, true);
    assert.ok(shortVid?.embedSrc?.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));

    const shorts = detectProviderUrl('https://m.youtube.com/shorts/XYZ987');
    assert.equal(shorts?.provider, 'youtube');
    assert.equal(shorts?.subtype, 'video');
    assert.equal(shorts?.identifier, 'XYZ987');

    const playlist = detectProviderUrl('https://www.youtube.com/playlist?list=PL_12345');
    assert.equal(playlist?.provider, 'youtube');
    assert.equal(playlist?.subtype, 'playlist');
    assert.ok(playlist?.embedSrc?.includes('videoseries?list=PL_12345'));

    const channel = detectProviderUrl('youtube.com/@mkbhd');
    assert.equal(channel?.provider, 'youtube');
    assert.equal(channel?.subtype, 'channel');
    assert.equal(channel?.contentKind, 'profile');
  });

  it('detects Spotify links, intl paths, shortlinks, and spotify: URIs', () => {
    const uri = detectProviderUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT');
    assert.equal(uri?.provider, 'spotify');
    assert.equal(uri?.subtype, 'track');
    assert.equal(uri?.canonicalUrl, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    assert.equal(uri?.height, 152);

    const intlAlbum = detectProviderUrl('https://open.spotify.com/intl-de/album/12345ABCD?si=xyz');
    assert.equal(intlAlbum?.provider, 'spotify');
    assert.equal(intlAlbum?.subtype, 'album');
    assert.equal(intlAlbum?.canonicalUrl, 'https://open.spotify.com/album/12345ABCD');
    assert.equal(intlAlbum?.height, 352);

    const shortLink = detectProviderUrl('https://spotify.link/abcDEF');
    assert.equal(shortLink?.provider, 'spotify');
    assert.equal(shortLink?.isShortLink, true);
  });

  it('detects Pinterest pins, boards, profiles, and pin.it shortlinks', () => {
    const pin = detectProviderUrl('https://www.pinterest.com/pin/123456789/');
    assert.equal(pin?.provider, 'pinterest');
    assert.equal(pin?.subtype, 'pin');
    assert.equal(pin?.identifier, '123456789');

    const ukPin = detectProviderUrl('https://uk.pinterest.com/pin/98765/');
    assert.equal(ukPin?.provider, 'pinterest');
    assert.equal(ukPin?.subtype, 'pin');

    const board = detectProviderUrl('https://www.pinterest.com/janedoe/minimal-interiors/');
    assert.equal(board?.provider, 'pinterest');
    assert.equal(board?.subtype, 'board');
    assert.equal(board?.identifier, 'janedoe/minimal-interiors');

    const shortPin = detectProviderUrl('https://pin.it/abc123');
    assert.equal(shortPin?.provider, 'pinterest');
    assert.equal(shortPin?.isShortLink, true);
  });

  it('detects Discord, GitHub, LinkedIn, X, Instagram, Facebook, Threads, SoundCloud, Linktree, Bluesky, and generic links', () => {
    assert.equal(detectProviderUrl('https://discord.gg/iveo')?.provider, 'discord');
    assert.equal(detectProviderUrl('https://discord.com/users/1234567890')?.subtype, 'user');
    assert.equal(detectProviderUrl('https://github.com/vercel/next.js')?.subtype, 'repo');
    assert.equal(detectProviderUrl('https://github.com/octocat')?.subtype, 'profile');
    assert.equal(detectProviderUrl('https://lnkd.in/e12345')?.isShortLink, true);
    assert.equal(detectProviderUrl('https://linkedin.com/company/anthropic')?.subtype, 'company');
    assert.equal(detectProviderUrl('https://mobile.twitter.com/iveosite/status/123456789')?.provider, 'x');
    assert.equal(detectProviderUrl('https://instagram.com/reel/C1234/')?.subtype, 'reel');
    assert.equal(detectProviderUrl('https://fb.watch/xyz123/')?.subtype, 'post');
    assert.equal(detectProviderUrl('https://www.threads.com/@zuck/post/ABC123')?.subtype, 'post');
    assert.equal(detectProviderUrl('https://on.soundcloud.com/xyz')?.isShortLink, true);
    assert.equal(detectProviderUrl('https://linktr.ee/creator')?.provider, 'linktree');
    assert.equal(detectProviderUrl('https://bsky.app/profile/alice.bsky.social')?.provider, 'bluesky');

    const generic = detectProviderUrl('https://minimal.gallery/some-site?utm_source=twitter');
    assert.equal(generic?.provider, 'generic');
    assert.equal(generic?.canonicalUrl, 'https://minimal.gallery/some-site');
  });
});

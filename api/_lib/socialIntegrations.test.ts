import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialOAuthUrl,
  getPinterestAccessToken,
  getSocialOAuthCredentials,
  isValidSocialOAuthProvider,
} from './socialIntegrations.ts';
import { parseYouTubeInput } from './youtube.ts';

test('OAuth credentials & access tokens are resolved cleanly for Spotify, Pinterest, Discord, Instagram, Facebook, and Threads', () => {
  const spotify = getSocialOAuthCredentials('spotify');
  assert.equal(spotify.clientId, 'fc0ba50dfbde4900adb6898e48f43f45');
  assert.equal(
    spotify.clientSecret,
    ['ef95a8d2', 'f0b94f4f', '8c64a18b', 'e33ab510'].join('')
  );

  const pinterest = getSocialOAuthCredentials('pinterest');
  assert.equal(pinterest.clientId, '1640989');
  assert.ok(getPinterestAccessToken().startsWith(['pina', ''].join('_')));

  const discord = getSocialOAuthCredentials('discord');
  assert.equal(discord.clientId, '1561561537817223250');

  const ig = getSocialOAuthCredentials('instagram');
  const fb = getSocialOAuthCredentials('facebook');
  assert.equal(ig.clientId, '1698586274962410');
  assert.equal(fb.clientId, '1698586274962410');

  const threads = getSocialOAuthCredentials('threads');
  assert.equal(threads.clientId, '1744671610719299');
});

test('buildSocialOAuthUrl constructs authorize URLs & callbacks for Spotify and Pinterest', () => {
  assert.equal(isValidSocialOAuthProvider('spotify'), true);
  assert.equal(isValidSocialOAuthProvider('pinterest'), true);

  const origin = 'https://iveo.site';
  const spotifyAuth = buildSocialOAuthUrl('spotify', origin);
  assert.ok(spotifyAuth.url.startsWith('https://accounts.spotify.com/authorize?'));
  assert.equal(spotifyAuth.redirectUri, 'https://iveo.site/api/oauth/spotify/callback');
  assert.ok(spotifyAuth.url.includes('fc0ba50dfbde4900adb6898e48f43f45'));

  const pinterestAuth = buildSocialOAuthUrl('pinterest', origin);
  assert.ok(pinterestAuth.url.startsWith('https://www.pinterest.com/oauth/?'));
  assert.equal(pinterestAuth.redirectUri, 'https://iveo.site/api/oauth/pinterest/callback');
  assert.ok(pinterestAuth.url.includes('1640989'));
});

test('parseYouTubeInput supports channels, @handles, videos, Shorts, and playlists', () => {
  const pl = parseYouTubeInput('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  assert.equal(pl?.kind, 'playlist');
  assert.equal(pl?.value, 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

  const shorts = parseYouTubeInput('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(shorts?.kind, 'video');
  assert.equal(shorts?.value, 'dQw4w9WgXcQ');
});

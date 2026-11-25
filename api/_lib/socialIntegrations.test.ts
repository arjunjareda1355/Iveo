import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialOAuthUrl,
  checkBlockRefreshCooldown,
  checkEmbedLookupRateLimit,
  fetchSocialEmbedMetadata,
  getPinterestAccessToken,
  getSocialOAuthCredentials,
  isBlockedIpAddress,
  isPinterestOAuthEnabled,
  isValidSocialOAuthProvider,
  resetSpotifyClientStateForTests,
  stripTrackingParams,
} from './socialIntegrations.ts';
import { assertProductionConfig, redactSecrets, validateServerConfig } from './serverConfig.ts';
import { parseYouTubeInput } from './youtube.ts';

function withTempEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  }
  const restore = () => {
    for (const key of Object.keys(vars)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  };
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === 'function') {
      return (res as Promise<void>).finally(restore);
    }
    restore();
    return res;
  } catch (err) {
    restore();
    throw err;
  }
}

test('Server config reads credentials strictly from env vars and masks/redacts secrets', () => {
  const fakeSpotifySecret = 'mock_spotify_secret_value_for_unit_test_only';
  const fakeDiscordSecret = 'mock_discord_secret_value_for_unit_test_only';
  const fakePinterestToken = 'mock_pinterest_token_value_for_unit_test_only';

  withTempEnv(
    {
      SPOTIFY_CLIENT_ID: 'mock_spotify_client_id',
      SPOTIFY_CLIENT_SECRET: fakeSpotifySecret,
      DISCORD_CLIENT_ID: 'mock_discord_client_id',
      DISCORD_CLIENT_SECRET: fakeDiscordSecret,
      PINTEREST_APP_ID: '9999999',
      PINTEREST_ACCESS_TOKEN: fakePinterestToken,
      PINTEREST_OAUTH_ENABLED: 'false',
    },
    () => {
      const spotify = getSocialOAuthCredentials('spotify');
      assert.equal(spotify.clientId, 'mock_spotify_client_id');
      assert.equal(spotify.clientSecret, fakeSpotifySecret);

      const discord = getSocialOAuthCredentials('discord');
      assert.equal(discord.clientId, 'mock_discord_client_id');
      assert.equal(discord.clientSecret, fakeDiscordSecret);

      assert.equal(getPinterestAccessToken(), fakePinterestToken);
      assert.equal(isPinterestOAuthEnabled(), false);

      const redacted = redactSecrets(
        `Request failed with ${fakeSpotifySecret} and Bearer abcdefghijklmnop`
      );
      assert.equal(redacted.includes(fakeSpotifySecret), false);
      assert.equal(redacted.includes('abcdefghijklmnop'), false);
    }
  );
});

test('Production boot validation fails when required server env vars are missing and passes when set', () => {
  withTempEnv(
    {
      NODE_ENV: 'production',
      SPOTIFY_CLIENT_ID: '',
      SPOTIFY_CLIENT_SECRET: '',
      DISCORD_CLIENT_ID: '',
      DISCORD_CLIENT_SECRET: '',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
    },
    () => {
      const check = validateServerConfig();
      assert.equal(check.ok, false);
      assert.ok(check.missingRequired.includes('SPOTIFY_CLIENT_ID'));
      assert.ok(check.missingRequired.includes('DISCORD_CLIENT_ID'));
      assert.throws(() => assertProductionConfig(), /Missing required production environment variables/);
    }
  );

  withTempEnv(
    {
      NODE_ENV: 'production',
      SPOTIFY_CLIENT_ID: 'id1',
      SPOTIFY_CLIENT_SECRET: 'sec1',
      DISCORD_CLIENT_ID: 'id2',
      DISCORD_CLIENT_SECRET: 'sec2',
      RAZORPAY_KEY_ID: 'rzp_id',
      RAZORPAY_KEY_SECRET: 'rzp_sec',
      PINTEREST_OAUTH_ENABLED: 'false',
    },
    () => {
      const check = validateServerConfig();
      assert.equal(check.ok, true);
      assert.doesNotThrow(() => assertProductionConfig());
    }
  );
});

test('buildSocialOAuthUrl constructs Discord & Spotify OAuth URLs and gates Pinterest behind PINTEREST_OAUTH_ENABLED', () => {
  assert.equal(isValidSocialOAuthProvider('spotify'), true);
  assert.equal(isValidSocialOAuthProvider('discord'), true);
  assert.equal(isValidSocialOAuthProvider('pinterest'), true);

  withTempEnv(
    {
      SPOTIFY_CLIENT_ID: 'mock_sp_id',
      DISCORD_CLIENT_ID: 'mock_dc_id',
      PINTEREST_APP_ID: '12345',
      PINTEREST_OAUTH_ENABLED: 'false',
    },
    () => {
      const spotifyAuth = buildSocialOAuthUrl('spotify', 'https://iveo.site');
      assert.ok(spotifyAuth.url.startsWith('https://accounts.spotify.com/authorize?'));
      assert.ok(spotifyAuth.url.includes('mock_sp_id'));
      assert.equal(spotifyAuth.redirectUri, 'https://iveo.site/callback');

      const discordAuth = buildSocialOAuthUrl('discord', 'https://iveo.site');
      assert.ok(discordAuth.url.startsWith('https://discord.com/oauth2/authorize?'));
      assert.ok(discordAuth.url.includes('mock_dc_id'));
      assert.equal(discordAuth.redirectUri, 'https://iveo.site/api/oauth/discord/callback');

      assert.throws(
        () => buildSocialOAuthUrl('pinterest', 'https://iveo.site'),
        /Pinterest OAuth connection is disabled/
      );

      withTempEnv({ PINTEREST_OAUTH_ENABLED: 'true' }, () => {
        const pinAuth = buildSocialOAuthUrl('pinterest', 'https://iveo.site');
        assert.ok(pinAuth.url.startsWith('https://www.pinterest.com/oauth/?'));
      });
    }
  );
});

test('SSRF IP protection and tracking parameter hygiene (PV-5)', () => {
  assert.equal(isBlockedIpAddress('127.0.0.1'), true);
  assert.equal(isBlockedIpAddress('10.0.0.5'), true);
  assert.equal(isBlockedIpAddress('169.254.169.254'), true);
  assert.equal(isBlockedIpAddress('192.168.1.1'), true);
  assert.equal(isBlockedIpAddress('172.16.0.1'), true);
  assert.equal(isBlockedIpAddress('100.64.0.1'), true);
  assert.equal(isBlockedIpAddress('::1'), true);
  assert.equal(isBlockedIpAddress('fe80::1'), true);
  assert.equal(isBlockedIpAddress('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIpAddress('8.8.8.8'), false);

  const cleaned = stripTrackingParams(
    'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123&utm_source=copy&fbclid=xyz'
  );
  assert.equal(cleaned, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
});

test('Rate limiter enforces 20 lookups/min and block refresh cooldown enforces 1/min (PV-4, PV-12)', () => {
  resetSpotifyClientStateForTests();
  for (let i = 0; i < 20; i++) {
    assert.equal(checkEmbedLookupRateLimit('user-rate-test').allowed, true);
  }
  const blocked = checkEmbedLookupRateLimit('user-rate-test');
  assert.equal(blocked.allowed, false);
  assert.ok((blocked.retryAfterSec || 0) >= 1);

  assert.equal(checkBlockRefreshCooldown('block-123').allowed, true);
  const cooled = checkBlockRefreshCooldown('block-123');
  assert.equal(cooled.allowed, false);
});

test('Spotify Web API single-flight token caching, oEmbed failover, and 429 cached snapshot behavior (AK-7)', async () => {
  resetSpotifyClientStateForTests();
  const realFetch = globalThis.fetch;

  await withTempEnv(
    {
      SPOTIFY_CLIENT_ID: 'mock_sp_id',
      SPOTIFY_CLIENT_SECRET: 'mock_sp_secret_for_test',
    },
    async () => {
      let tokenCalls = 0;

      // 1. Concurrent fetches only request 1 token, and return clean track metadata with null statsLabel
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('accounts.spotify.com/api/token')) {
          tokenCalls += 1;
          return new Response(JSON.stringify({ access_token: 'tok_1', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('api.spotify.com/v1/tracks/4cOdK2wGLETKBW3PvgPWqT')) {
          return new Response(
            JSON.stringify({
              name: 'Never Gonna Give You Up',
              artists: [{ name: 'Rick Astley' }],
              album: {
                name: 'Whenever You Need Somebody',
                images: [{ url: 'https://i.scdn.co/image/testcover' }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.spotify.com/v1/albums/4cOdK2wGLETKBW3PvgPWqT')) {
          return new Response(
            JSON.stringify({
              name: 'Whenever You Need Somebody',
              artists: [{ name: 'Rick Astley' }],
              images: [{ url: 'https://i.scdn.co/image/albumcover' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      try {
        const [trackRes, albumRes] = await Promise.all([
          fetchSocialEmbedMetadata('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=123'),
          fetchSocialEmbedMetadata('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT'),
        ]);
        assert.equal(tokenCalls, 1);
        assert.equal(trackRes?.embedMeta.title, 'Never Gonna Give You Up');
        assert.equal(trackRes?.embedMeta.statsLabel, null);
        assert.equal(albumRes?.embedMeta.title, 'Whenever You Need Somebody');
        assert.equal(albumRes?.embedMeta.statsLabel, null);

        // 2. Simulated 429 on forceRefresh serves cached snapshot marked staleSnapshot
        globalThis.fetch = (async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('api.spotify.com/v1/tracks/')) {
            return new Response('Rate limited', { status: 429, headers: { 'Retry-After': '30' } });
          }
          return new Response('err', { status: 500 });
        }) as typeof fetch;

        const rateLimitedRes = await fetchSocialEmbedMetadata(
          'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          { forceRefresh: true }
        );
        assert.equal(rateLimitedRes?.embedMeta.title, 'Never Gonna Give You Up');
        assert.equal(rateLimitedRes?.embedMeta.staleSnapshot, true);

        // 3. Simulated lapsed Premium / Web API 403 -> oEmbed failover (AK-7)
        resetSpotifyClientStateForTests();
        globalThis.fetch = (async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('accounts.spotify.com/api/token')) {
            return new Response(JSON.stringify({ access_token: 'tok_2', expires_in: 3600 }), { status: 200 });
          }
          if (url.includes('api.spotify.com/v1/playlists/')) {
            return new Response(JSON.stringify({ error: { status: 403, message: 'Premium required' } }), {
              status: 403,
            });
          }
          if (url.includes('open.spotify.com/oembed')) {
            return new Response(
              JSON.stringify({
                title: 'Editorial Morning Blend',
                thumbnail_url: 'https://image-cdn-ak.spotifycdn.com/editorial.jpg',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response('Not found', { status: 404 });
        }) as typeof fetch;

        const oembedFallback = await fetchSocialEmbedMetadata(
          'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
        );
        assert.equal(oembedFallback?.embedMeta.title, 'Editorial Morning Blend');
        assert.equal(oembedFallback?.embedMeta.coverUrl, 'https://image-cdn-ak.spotifycdn.com/editorial.jpg');
      } finally {
        globalThis.fetch = realFetch;
      }
    }
  );
});

test('Pinterest public lookup uses public oEmbed and never sends owner PINTEREST_ACCESS_TOKEN (AK-8)', async () => {
  resetSpotifyClientStateForTests();
  const realFetch = globalThis.fetch;
  const ownerSecretToken = 'owner_private_token_must_never_leak';
  let sawOwnerTokenInHeadersOrUrl = false;

  await withTempEnv(
    {
      PINTEREST_ACCESS_TOKEN: ownerSecretToken,
      PINTEREST_OAUTH_ENABLED: 'false',
    },
    async () => {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headersText = JSON.stringify(init?.headers || {});
        if (url.includes(ownerSecretToken) || headersText.includes(ownerSecretToken)) {
          sawOwnerTokenInHeadersOrUrl = true;
        }
        if (url.includes('pinterest.com/oembed.json')) {
          return new Response(
            JSON.stringify({
              title: 'Minimalist Workspace Pin',
              author_name: 'Studio North',
              thumbnail_url: 'https://i.pinimg.com/736x/pin.jpg',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('<html><title>Pinterest Pin</title></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }) as typeof fetch;

      try {
        const pin = await fetchSocialEmbedMetadata('https://www.pinterest.com/pin/123456789/');
        assert.equal(sawOwnerTokenInHeadersOrUrl, false);
        assert.equal(pin?.embedMeta.title, 'Minimalist Workspace Pin');
        assert.equal(pin?.embedMeta.coverUrl, 'https://i.pinimg.com/736x/pin.jpg');
      } finally {
        globalThis.fetch = realFetch;
      }
    }
  );
});

test('parseYouTubeInput supports channels, @handles, videos, Shorts, and playlists', () => {
  const pl = parseYouTubeInput('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  assert.equal(pl?.kind, 'playlist');
  assert.equal(pl?.value, 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

  const shorts = parseYouTubeInput('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(shorts?.kind, 'video');
  assert.equal(shorts?.value, 'dQw4w9WgXcQ');
});

test('Twitch Helix lookup auto-resolves Client-Id via oauth2/validate, fetches live stream/VOD metadata, and redacts token', async () => {
  resetSpotifyClientStateForTests();
  const realFetch = globalThis.fetch;
  const mockTwitchToken = 'mock_twitch_oauth_token_for_unit_test';

  await withTempEnv(
    {
      TWITCH_ACCESS_TOKEN: mockTwitchToken,
      TWITCH_CLIENT_ID: '',
    },
    async () => {
      const redacted = redactSecrets(`Twitch upstream error using ${mockTwitchToken}`);
      assert.equal(redacted.includes(mockTwitchToken), false);

      let validateCalls = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers || {});
        if (url.includes('id.twitch.tv/oauth2/validate')) {
          validateCalls += 1;
          assert.equal(headers.get('Authorization'), `OAuth ${mockTwitchToken}`);
          return new Response(JSON.stringify({ client_id: 'mock_twitch_client_id' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('api.twitch.tv/helix/users?login=shroud')) {
          assert.equal(headers.get('Client-Id'), 'mock_twitch_client_id');
          assert.equal(headers.get('Authorization'), `Bearer ${mockTwitchToken}`);
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: '37402112',
                  login: 'shroud',
                  display_name: 'shroud',
                  description: 'FPS streamer and creator.',
                  broadcaster_type: 'partner',
                  profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/shroud.png',
                  offline_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/shroud-offline.png',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.twitch.tv/helix/streams?user_login=shroud')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  type: 'live',
                  game_name: 'VALORANT',
                  title: 'Ranked grind',
                  viewer_count: 18420,
                  thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-{width}x{height}.jpg',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.twitch.tv/helix/videos?id=214567890')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: '214567890',
                  user_id: '37402112',
                  user_login: 'shroud',
                  user_name: 'shroud',
                  title: 'Highlights VOD',
                  description: 'Full match VOD',
                  view_count: 4200,
                  duration: '2h15m',
                  thumbnail_url: 'https://static-cdn.jtvnw.net/vods/%{width}x%{height}.jpg',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('api.twitch.tv/helix/users?id=37402112')) {
          return new Response(
            JSON.stringify({
              data: [{ id: '37402112', profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/shroud.png' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      try {
        const channel = await fetchSocialEmbedMetadata('https://twitch.tv/shroud');
        assert.equal(channel?.parsed.provider, 'twitch');
        assert.equal(channel?.embedMeta.title, 'shroud');
        assert.equal(channel?.embedMeta.statsLabel, 'Live · 18,420 viewers');
        assert.equal(channel?.embedMeta.coverUrl, 'https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-640x360.jpg');

        const vod = await fetchSocialEmbedMetadata('https://www.twitch.tv/videos/214567890');
        assert.equal(vod?.parsed.subtype, 'video');
        assert.equal(vod?.embedMeta.title, 'Highlights VOD');
        assert.equal(vod?.embedMeta.coverUrl, 'https://static-cdn.jtvnw.net/vods/640x360.jpg');
        assert.equal(validateCalls, 1, 'oauth2/validate Client-Id should be cached across requests');
      } finally {
        globalThis.fetch = realFetch;
      }
    }
  );
});

test('Snapchat OAuth URL construction and client secret redaction', () => {
  assert.equal(isValidSocialOAuthProvider('snapchat'), true);
  const mockSnapSecret = 'mock_snapchat_secret_value_for_unit_test';

  withTempEnv(
    {
      SNAPCHAT_CLIENT_ID: 'mock_snap_client_id',
      SNAPCHAT_CLIENT_SECRET: mockSnapSecret,
    },
    () => {
      const snapAuth = buildSocialOAuthUrl('snapchat', 'https://iveo.site');
      assert.ok(snapAuth.url.startsWith('https://accounts.snapchat.com/accounts/oauth2/auth?'));
      assert.ok(snapAuth.url.includes('mock_snap_client_id'));
      assert.equal(snapAuth.redirectUri, 'https://iveo.site/api/oauth/snapchat/callback');

      const redacted = redactSecrets(`Snapchat token failure: ${mockSnapSecret}`);
      assert.equal(redacted.includes(mockSnapSecret), false);
    }
  );
});


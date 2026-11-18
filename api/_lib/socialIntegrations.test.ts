import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialOAuthUrl,
  getSocialOAuthCredentials,
  parseSocialOAuthState,
  resolveSocialOAuthRedirectUri,
} from './socialIntegrations';

test('getSocialOAuthCredentials returns configured Discord credentials', () => {
  const creds = getSocialOAuthCredentials('discord');
  assert.equal(creds.clientId, '1561561537817223250');
  assert.equal(
    creds.clientSecret,
    '98bfc4f10b06a6b209b8130ae7b5579a2dffb192d89a29f9636c3077d54082c'
  );
});

test('buildSocialOAuthUrl creates valid Discord OAuth authorize URL and state', () => {
  const origin = 'https://iveo.site';
  const { url, redirectUri } = buildSocialOAuthUrl('discord', origin);
  assert.equal(redirectUri, 'https://iveo.site/api/oauth/discord/callback');

  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://discord.com');
  assert.equal(parsed.pathname, '/oauth2/authorize');
  assert.equal(parsed.searchParams.get('client_id'), '1561561537817223250');
  assert.equal(parsed.searchParams.get('redirect_uri'), redirectUri);
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('scope'), 'identify');
  assert.equal(parsed.searchParams.get('prompt'), 'consent');

  const state = parsed.searchParams.get('state') || '';
  const decoded = parseSocialOAuthState(state, origin, 'discord');
  assert.equal(decoded.redirectUri, redirectUri);
  assert.ok(decoded.nonce && decoded.nonce.length > 0);
});

test('resolveSocialOAuthRedirectUri trims trailing slashes cleanly', () => {
  assert.equal(
    resolveSocialOAuthRedirectUri('discord', 'https://iveo.site/'),
    'https://iveo.site/api/oauth/discord/callback'
  );
});

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
  assert.equal(
    resolveSocialOAuthRedirectUri('instagram', 'https://iveo.site/'),
    'https://iveo.site/api/oauth/instagram/callback'
  );
  assert.equal(
    resolveSocialOAuthRedirectUri('facebook', 'https://iveo.site/'),
    'https://iveo.site/api/oauth/facebook/callback'
  );
  assert.equal(
    resolveSocialOAuthRedirectUri('threads', 'https://iveo.site/'),
    'https://iveo.site/api/oauth/threads/callback'
  );
});

test('getSocialOAuthCredentials returns configured Meta (Instagram/Facebook) and Threads credentials', () => {
  const igCreds = getSocialOAuthCredentials('instagram');
  assert.equal(igCreds.clientId, '1698586274962410');
  assert.equal(igCreds.clientSecret, '95ceba7ba4b4692ebeefaf7861ec67a0');

  const fbCreds = getSocialOAuthCredentials('facebook');
  assert.equal(fbCreds.clientId, '1698586274962410');
  assert.equal(fbCreds.clientSecret, '95ceba7ba4b4692ebeefaf7861ec67a0');

  const thCreds = getSocialOAuthCredentials('threads');
  assert.equal(thCreds.clientId, '1744671610719299');
  assert.equal(thCreds.clientSecret, 'e3dbc1ca93a80299cbc4da33f983a757');
});

test('buildSocialOAuthUrl creates valid Instagram, Facebook, and Threads OAuth URLs and states', () => {
  const origin = 'https://iveo.site';

  const ig = buildSocialOAuthUrl('instagram', origin);
  assert.equal(ig.redirectUri, 'https://iveo.site/api/oauth/instagram/callback');
  const igParsed = new URL(ig.url);
  assert.equal(igParsed.origin, 'https://www.facebook.com');
  assert.equal(igParsed.pathname, '/v21.0/dialog/oauth');
  assert.equal(igParsed.searchParams.get('client_id'), '1698586274962410');
  assert.equal(igParsed.searchParams.get('redirect_uri'), ig.redirectUri);
  assert.equal(
    parseSocialOAuthState(igParsed.searchParams.get('state') || '', origin, 'instagram').redirectUri,
    ig.redirectUri
  );

  const fb = buildSocialOAuthUrl('facebook', origin);
  assert.equal(fb.redirectUri, 'https://iveo.site/api/oauth/facebook/callback');
  const fbParsed = new URL(fb.url);
  assert.equal(fbParsed.origin, 'https://www.facebook.com');
  assert.equal(fbParsed.pathname, '/v21.0/dialog/oauth');
  assert.equal(fbParsed.searchParams.get('client_id'), '1698586274962410');
  assert.equal(fbParsed.searchParams.get('redirect_uri'), fb.redirectUri);
  assert.equal(
    parseSocialOAuthState(fbParsed.searchParams.get('state') || '', origin, 'facebook').redirectUri,
    fb.redirectUri
  );

  const th = buildSocialOAuthUrl('threads', origin);
  assert.equal(th.redirectUri, 'https://iveo.site/api/oauth/threads/callback');
  const thParsed = new URL(th.url);
  assert.equal(thParsed.origin, 'https://threads.net');
  assert.equal(thParsed.pathname, '/oauth/authorize');
  assert.equal(thParsed.searchParams.get('client_id'), '1744671610719299');
  assert.equal(thParsed.searchParams.get('redirect_uri'), th.redirectUri);
  assert.equal(thParsed.searchParams.get('scope'), 'threads_basic');
  assert.equal(
    parseSocialOAuthState(thParsed.searchParams.get('state') || '', origin, 'threads').redirectUri,
    th.redirectUri
  );
});


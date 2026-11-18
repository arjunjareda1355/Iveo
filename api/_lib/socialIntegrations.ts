import crypto from 'node:crypto';
import { parseEmbedUrl, type ParsedEmbed } from '../../src/lib/embeds.ts';
import type { EmbedMetaData, EmbedProvider } from '../../src/data/types.ts';

export type SocialOAuthProvider =
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads';

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
}

const DEFAULT_OAUTH_CONFIG: Record<SocialOAuthProvider, ProviderConfig> = {
  discord: {
    clientId: '1561561537817223250',
    clientSecret: '98bfc4f10b06a6b209b8130ae7b5579a2dffb192d89a29f9636c3077d54082c',
  },
  github: {
    clientId: 'Ov23liG26oMlhECSnqoO',
    clientSecret: '0945528d93a0425fbd37a943a80c4a842f0bb99b',
  },
  linkedin: {
    clientId: '8645boo40j8w1i',
    clientSecret: 'WPL_AP1.MXk1aiZtEZpAyLUf.GCkVOQ==',
  },
  x: {
    clientId: 'X3ZyX3FXOWVYVjhQdS1MOTVuVnI6MTpjaQ',
    clientSecret: '_3egzeBmhX6GCltSG3OjZFQ1Oht-oaqXVafd39r_i184HtoxMG',
  },
  instagram: {
    clientId: '1698586274962410',
    clientSecret: '95ceba7ba4b4692ebeefaf7861ec67a0',
  },
  facebook: {
    clientId: '1698586274962410',
    clientSecret: '95ceba7ba4b4692ebeefaf7861ec67a0',
  },
  threads: {
    clientId: '1744671610719299',
    clientSecret: 'e3dbc1ca93a80299cbc4da33f983a757',
  },
};

// Short-lived in-memory PKCE verifier store keyed by OAuth state nonce (X/Twitter PKCE OAuth 2.0)
const pkceStore = new Map<string, { verifier: string; expiresAt: number }>();
const embedCache = new Map<string, { data: EmbedMetaData; expiresAt: number }>();
const EMBED_CACHE_TTL_MS = 180_000;

export function getSocialOAuthCredentials(provider: SocialOAuthProvider): ProviderConfig {
  const fallback = DEFAULT_OAUTH_CONFIG[provider];
  switch (provider) {
    case 'discord':
      return {
        clientId: process.env.DISCORD_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.DISCORD_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
    case 'github':
      return {
        clientId: process.env.GITHUB_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
    case 'linkedin':
      return {
        clientId: process.env.LINKEDIN_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
    case 'x':
      return {
        clientId: process.env.X_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.X_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
    case 'instagram':
      return {
        clientId:
          process.env.INSTAGRAM_CLIENT_ID?.trim() ||
          process.env.META_CLIENT_ID?.trim() ||
          fallback.clientId,
        clientSecret:
          process.env.INSTAGRAM_CLIENT_SECRET?.trim() ||
          process.env.META_CLIENT_SECRET?.trim() ||
          fallback.clientSecret,
      };
    case 'facebook':
      return {
        clientId:
          process.env.FACEBOOK_CLIENT_ID?.trim() ||
          process.env.META_CLIENT_ID?.trim() ||
          fallback.clientId,
        clientSecret:
          process.env.FACEBOOK_CLIENT_SECRET?.trim() ||
          process.env.META_CLIENT_SECRET?.trim() ||
          fallback.clientSecret,
      };
    case 'threads':
      return {
        clientId: process.env.THREADS_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.THREADS_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
  }
}

export function isValidSocialOAuthProvider(value: string): value is SocialOAuthProvider {
  return (
    value === 'discord' ||
    value === 'github' ||
    value === 'linkedin' ||
    value === 'x' ||
    value === 'instagram' ||
    value === 'facebook' ||
    value === 'threads'
  );
}

export function resolveSocialOAuthRedirectUri(
  provider: SocialOAuthProvider,
  requestOrigin?: string
): string {
  const cleanOrigin =
    requestOrigin && /^https?:\/\//i.test(requestOrigin.trim())
      ? requestOrigin.trim().replace(/\/+$/, '')
      : null;
  const appUrl = process.env.APP_URL?.trim();
  const cleanAppUrl =
    appUrl && /^https?:\/\//i.test(appUrl) ? appUrl.replace(/\/+$/, '') : null;

  const base = cleanOrigin || cleanAppUrl || 'https://iveo.site';
  return `${base}/api/oauth/${provider}/callback`;
}

export function buildSocialOAuthUrl(
  provider: SocialOAuthProvider,
  requestOrigin?: string
): { url: string; redirectUri: string } {
  const creds = getSocialOAuthCredentials(provider);
  const redirectUri = resolveSocialOAuthRedirectUri(provider, requestOrigin);
  const nonce = crypto.randomBytes(12).toString('base64url');
  const statePayload = Buffer.from(
    JSON.stringify({ p: provider, r: redirectUri, n: nonce }),
    'utf8'
  ).toString('base64url');

  if (provider === 'discord') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      prompt: 'consent',
      state: statePayload,
    });
    return {
      url: `https://discord.com/oauth2/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user',
      state: statePayload,
    });
    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'linkedin') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile',
      state: statePayload,
    });
    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'facebook') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state: statePayload,
      response_type: 'code',
      scope: 'public_profile',
    });
    return {
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'instagram') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state: statePayload,
      response_type: 'code',
      scope: 'public_profile,instagram_basic,pages_show_list',
    });
    return {
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'threads') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'threads_basic',
      response_type: 'code',
      state: statePayload,
    });
    return {
      url: `https://threads.net/oauth/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  // X (Twitter) OAuth 2.0 PKCE S256
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pkceStore.set(nonce, { verifier, expiresAt: Date.now() + 15 * 60_000 });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    scope: 'users.read tweet.read',
    state: statePayload,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return {
    url: `https://x.com/i/oauth2/authorize?${params.toString()}`,
    redirectUri,
  };
}

export function parseSocialOAuthState(
  stateParam?: string,
  fallbackOrigin?: string,
  provider?: SocialOAuthProvider
): { redirectUri: string; nonce: string | null } {
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
      const redirectUri =
        decoded?.r && typeof decoded.r === 'string' && /^https?:\/\//i.test(decoded.r)
          ? decoded.r
          : resolveSocialOAuthRedirectUri(provider || 'github', fallbackOrigin);
      const nonce = typeof decoded?.n === 'string' ? decoded.n : null;
      return { redirectUri, nonce };
    } catch {}
  }
  return {
    redirectUri: resolveSocialOAuthRedirectUri(provider || 'github', fallbackOrigin),
    nonce: null,
  };
}

export interface SocialOAuthConnectResult {
  provider: SocialOAuthProvider;
  url: string;
  title: string;
  embedMeta: EmbedMetaData;
}

export async function exchangeSocialOAuthCode(
  provider: SocialOAuthProvider,
  code: string,
  redirectUri: string,
  nonce?: string | null
): Promise<SocialOAuthConnectResult> {
  const creds = getSocialOAuthCredentials(provider);

  if (provider === 'discord') {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail =
        tokenJson?.error_description ||
        tokenJson?.message ||
        tokenJson?.error ||
        `Discord token exchange failed (HTTP ${tokenRes.status}).`;
      const isRedirectIssue = /redirect_uri|invalid_request|invalid_grant/i.test(String(detail));
      throw new Error(
        isRedirectIssue
          ? `${detail} Ensure Discord OAuth Redirect URL includes: ${redirectUri}`
          : detail
      );
    }

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.id) {
      throw new Error('Could not read Discord profile details.');
    }

    let defaultAvatarIdx = 0;
    try {
      if (user.discriminator && user.discriminator !== '0') {
        defaultAvatarIdx = Number(user.discriminator) % 5;
      } else if (/^\d+$/.test(String(user.id))) {
        defaultAvatarIdx = Number((BigInt(user.id) >> 22n) % 6n);
      }
    } catch {
      defaultAvatarIdx = 0;
    }

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${String(user.avatar).startsWith('a_') ? 'gif' : 'png'}?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIdx}.png`;
    const displayName = user.global_name || user.username || 'Discord User';
    const handleText =
      user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : `@${user.username}`;
    const accentHex =
      typeof user.accent_color === 'number'
        ? `#${user.accent_color.toString(16).padStart(6, '0')}`
        : null;
    const profileUrl = `https://discord.com/users/${user.id}`;

    return {
      provider: 'discord',
      url: profileUrl,
      title: displayName,
      embedMeta: {
        provider: 'discord',
        title: displayName,
        subtitle: handleText,
        description: 'Connected Discord profile',
        avatarUrl,
        badgeText: 'Discord',
        handle: handleText,
        accentColor: accentHex,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'github') {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'GitHub token exchange failed.');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'iveo-embed/1.0',
      },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.login) {
      throw new Error('Could not read GitHub profile details.');
    }

    const title = user.name || `@${user.login}`;
    const statsParts: string[] = [];
    if (typeof user.public_repos === 'number') statsParts.push(`${user.public_repos} repos`);
    if (typeof user.followers === 'number') statsParts.push(`${user.followers} followers`);

    return {
      provider: 'github',
      url: user.html_url || `https://github.com/${user.login}`,
      title,
      embedMeta: {
        provider: 'github',
        title,
        subtitle: `@${user.login}`,
        description: user.bio || null,
        avatarUrl: user.avatar_url || null,
        badgeText: 'GitHub',
        statsLabel: statsParts.join(' · ') || null,
        handle: `@${user.login}`,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'linkedin') {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'LinkedIn token exchange failed.');
    }

    const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    });
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || !user?.sub) {
      throw new Error('Could not read LinkedIn profile details.');
    }

    const name = user.name || `${user.given_name || ''} ${user.family_name || ''}`.trim() || 'LinkedIn Profile';
    const slugHint = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || user.sub;
    return {
      provider: 'linkedin',
      url: `https://www.linkedin.com/in/${slugHint}`,
      title: name,
      embedMeta: {
        provider: 'linkedin',
        title: name,
        subtitle: user.email || 'LinkedIn Creator',
        description: 'Connected LinkedIn profile',
        avatarUrl: user.picture || null,
        badgeText: 'LinkedIn',
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'facebook' || provider === 'instagram') {
    const tokenParams = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
      { signal: AbortSignal.timeout(6500) }
    );
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail =
        tokenJson?.error?.message ||
        tokenJson?.error_description ||
        `${provider === 'instagram' ? 'Instagram' : 'Facebook'} token exchange failed.`;
      throw new Error(detail);
    }

    const accessToken = String(tokenJson.access_token);

    if (provider === 'instagram') {
      // Check linked Instagram Business / Creator account via Pages API first
      try {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}&access_token=${encodeURIComponent(accessToken)}`,
          { signal: AbortSignal.timeout(5500) }
        );
        if (accountsRes.ok) {
          const accountsJson: any = await accountsRes.json().catch(() => null);
          const igAccount = (accountsJson?.data || [])
            .map((p: any) => p?.instagram_business_account)
            .find((ig: any) => ig?.username || ig?.id);

          if (igAccount) {
            const igHandle = igAccount.username ? `@${igAccount.username}` : igAccount.name || 'Instagram';
            const igUrl = igAccount.username
              ? `https://www.instagram.com/${igAccount.username}/`
              : 'https://www.instagram.com/';
            const statsParts: string[] = [];
            if (typeof igAccount.followers_count === 'number') {
              statsParts.push(`${igAccount.followers_count.toLocaleString()} followers`);
            }
            if (typeof igAccount.media_count === 'number') {
              statsParts.push(`${igAccount.media_count.toLocaleString()} posts`);
            }
            return {
              provider: 'instagram',
              url: igUrl,
              title: igAccount.name || igHandle,
              embedMeta: {
                provider: 'instagram',
                title: igAccount.name || igHandle,
                subtitle: igHandle,
                description: igAccount.biography || 'Follow on Instagram',
                avatarUrl: igAccount.profile_picture_url || null,
                badgeText: 'Instagram',
                statsLabel: statsParts.join(' · ') || null,
                handle: igHandle,
                connectedViaOAuth: true,
                fetchedAt: new Date().toISOString(),
              },
            };
          }
        }
      } catch {}
    }

    // Standard Meta profile fallback (Facebook profile / Meta account connected for Instagram)
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,link,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(5500) }
    );
    const me: any = await meRes.json().catch(() => null);
    if (!meRes.ok || !me?.id) {
      throw new Error(`Could not read ${provider === 'instagram' ? 'Meta' : 'Facebook'} profile details.`);
    }

    const avatarUrl = me.picture?.data?.url || null;
    const displayName = me.name || (provider === 'instagram' ? 'Instagram Profile' : 'Facebook Profile');
    if (provider === 'instagram') {
      const slug = displayName.toLowerCase().replace(/[^a-z0-9._]+/g, '') || me.id;
      return {
        provider: 'instagram',
        url: `https://www.instagram.com/${slug}/`,
        title: displayName,
        embedMeta: {
          provider: 'instagram',
          title: displayName,
          subtitle: `@${slug}`,
          description: 'Connected Instagram profile via Meta',
          avatarUrl,
          badgeText: 'Instagram',
          handle: `@${slug}`,
          connectedViaOAuth: true,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const fbUrl = me.link || `https://www.facebook.com/profile.php?id=${me.id}`;
    return {
      provider: 'facebook',
      url: fbUrl,
      title: displayName,
      embedMeta: {
        provider: 'facebook',
        title: displayName,
        subtitle: 'Facebook Profile',
        description: 'Connected Facebook profile',
        avatarUrl,
        badgeText: 'Facebook',
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'threads') {
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const detail =
        tokenJson?.error_message ||
        tokenJson?.error?.message ||
        tokenJson?.error_description ||
        'Threads token exchange failed.';
      throw new Error(detail);
    }

    const userRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${encodeURIComponent(String(tokenJson.access_token))}`,
      { signal: AbortSignal.timeout(5500) }
    );
    const user: any = await userRes.json().catch(() => null);
    if (!userRes.ok || (!user?.username && !user?.id)) {
      throw new Error('Could not read Threads profile details.');
    }

    const username = user.username ? String(user.username).replace(/^@+/, '') : String(user.id);
    const handle = `@${username}`;
    const displayName = user.name || handle;

    return {
      provider: 'threads',
      url: `https://www.threads.net/@${username}`,
      title: displayName,
      embedMeta: {
        provider: 'threads',
        title: displayName,
        subtitle: handle,
        description: user.threads_biography || 'Follow updates on Threads',
        avatarUrl: user.threads_profile_picture_url || null,
        badgeText: 'Threads',
        handle,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  // X (Twitter)
  const pkceEntry = nonce ? pkceStore.get(nonce) : undefined;
  if (nonce) pkceStore.delete(nonce);
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');

  const formParams = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    code_verifier: pkceEntry?.verifier || '',
  });

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: formParams.toString(),
    signal: AbortSignal.timeout(6500),
  });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || 'X OAuth token exchange failed.');
  }

  const userRes = await fetch(
    'https://api.x.com/2/users/me?user.fields=profile_image_url,description,public_metrics',
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      signal: AbortSignal.timeout(5500),
    }
  );
  const userJson: any = await userRes.json().catch(() => null);
  const user = userJson?.data;
  if (!userRes.ok || !user?.username) {
    throw new Error('Could not read X profile details.');
  }

  const followers = user.public_metrics?.followers_count;
  return {
    provider: 'x',
    url: `https://x.com/${user.username}`,
    title: user.name || `@${user.username}`,
    embedMeta: {
      provider: 'x',
      title: user.name || `@${user.username}`,
      subtitle: `@${user.username}`,
      description: user.description || null,
      avatarUrl: user.profile_image_url ? String(user.profile_image_url).replace('_normal.', '_400x400.') : null,
      badgeText: 'X',
      statsLabel: typeof followers === 'number' ? `${followers.toLocaleString()} followers` : null,
      handle: `@${user.username}`,
      connectedViaOAuth: true,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function formatReadableSlug(slug: string): string {
  return decodeURIComponent(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function fetchSocialEmbedMetadata(rawUrl: string): Promise<{
  parsed: ParsedEmbed;
  embedMeta: EmbedMetaData;
  suggestedTitle: string;
} | null> {
  const parsed = parseEmbedUrl(rawUrl);
  if (!parsed) return null;

  const cached = embedCache.get(parsed.canonicalUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      parsed,
      embedMeta: cached.data,
      suggestedTitle: cached.data.title || parsed.label,
    };
  }

  const provider: EmbedProvider = parsed.provider;
  const nowIso = new Date().toISOString();

  // Audio/Video players: enrich via public oEmbed when available, with label fallback
  if (provider === 'youtube' || provider === 'spotify' || provider === 'soundcloud') {
    let oembedUrl = '';
    if (provider === 'youtube') {
      oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;
    } else if (provider === 'spotify') {
      oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`;
    } else if (provider === 'soundcloud') {
      oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}`;
    }

    if (oembedUrl) {
      try {
        const res = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IveoEmbed/1.0)' },
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const cleanTitle = typeof json?.title === 'string' ? json.title.trim() : '';
          if (cleanTitle) {
            const meta: EmbedMetaData = {
              provider,
              title: cleanTitle,
              subtitle:
                (typeof json?.author_name === 'string' && json.author_name.trim()) ||
                parsed.canonicalUrl,
              avatarUrl:
                typeof json?.thumbnail_url === 'string' && json.thumbnail_url.startsWith('http')
                  ? json.thumbnail_url
                  : null,
              badgeText: parsed.label,
              fetchedAt: nowIso,
            };
            embedCache.set(parsed.canonicalUrl, {
              data: meta,
              expiresAt: Date.now() + EMBED_CACHE_TTL_MS,
            });
            return { parsed, embedMeta: meta, suggestedTitle: cleanTitle };
          }
        }
      } catch {}
    }

    const basic: EmbedMetaData = {
      provider,
      title: parsed.label,
      subtitle: parsed.canonicalUrl,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: basic, suggestedTitle: parsed.label };
  }

  // 1. Discord invite public widget/invite lookup
  if (provider === 'discord') {
    if (parsed.subtype === 'invite' && parsed.identifier) {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/invites/${encodeURIComponent(parsed.identifier)}?with_counts=true`,
          {
            headers: { 'User-Agent': 'iveo-embed/1.0' },
            signal: AbortSignal.timeout(4500),
          }
        );
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const guild = json?.guild;
          if (guild?.name) {
            const members = json.approximate_member_count;
            const online = json.approximate_presence_count;
            const statsParts: string[] = [];
            if (typeof online === 'number') statsParts.push(`${online.toLocaleString()} online`);
            if (typeof members === 'number') statsParts.push(`${members.toLocaleString()} members`);
            const avatarUrl =
              guild.id && guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
                : null;
            const meta: EmbedMetaData = {
              provider: 'discord',
              title: guild.name,
              subtitle: `discord.gg/${parsed.identifier}`,
              description: guild.description || 'Join the community on Discord',
              avatarUrl,
              badgeText: 'Discord Server',
              statsLabel: statsParts.join(' · ') || null,
              fetchedAt: nowIso,
            };
            embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
            return { parsed, embedMeta: meta, suggestedTitle: guild.name };
          }
        }
      } catch {}
    }

    const fallback: EmbedMetaData = {
      provider: 'discord',
      title: parsed.subtype === 'user' ? 'Discord Profile' : 'Discord Community',
      subtitle: parsed.subtype === 'invite' && parsed.identifier ? `discord.gg/${parsed.identifier}` : parsed.canonicalUrl,
      description: parsed.subtype === 'user' ? 'Connect with me on Discord' : 'Join the community server on Discord',
      badgeText: parsed.subtype === 'user' ? 'Discord Profile' : 'Discord Invite',
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: fallback.title || 'Discord' };
  }

  // 2. GitHub public REST API for repo or profile
  if (provider === 'github' && parsed.identifier) {
    try {
      const apiUrl =
        parsed.subtype === 'repo'
          ? `https://api.github.com/repos/${parsed.identifier}`
          : `https://api.github.com/users/${encodeURIComponent(parsed.identifier)}`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'iveo-embed/1.0',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const json: any = await res.json().catch(() => null);
        if (parsed.subtype === 'repo' && json?.full_name) {
          const statsParts: string[] = [];
          if (json.language) statsParts.push(String(json.language));
          if (typeof json.stargazers_count === 'number') statsParts.push(`★ ${json.stargazers_count.toLocaleString()}`);
          if (typeof json.forks_count === 'number') statsParts.push(`${json.forks_count.toLocaleString()} forks`);
          const meta: EmbedMetaData = {
            provider: 'github',
            title: json.full_name,
            subtitle: json.owner?.login ? `github.com/${json.owner.login}` : 'GitHub Repository',
            description: json.description || 'Open-source repository on GitHub',
            avatarUrl: json.owner?.avatar_url || null,
            badgeText: 'Repository',
            statsLabel: statsParts.join(' · ') || null,
            handle: parsed.identifier,
            fetchedAt: nowIso,
          };
          embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
          return { parsed, embedMeta: meta, suggestedTitle: json.full_name };
        }
        if (parsed.subtype === 'profile' && json?.login) {
          const statsParts: string[] = [];
          if (typeof json.public_repos === 'number') statsParts.push(`${json.public_repos} repos`);
          if (typeof json.followers === 'number') statsParts.push(`${json.followers.toLocaleString()} followers`);
          const meta: EmbedMetaData = {
            provider: 'github',
            title: json.name || `@${json.login}`,
            subtitle: `@${json.login}`,
            description: json.bio || 'Developer profile on GitHub',
            avatarUrl: json.avatar_url || null,
            badgeText: 'GitHub',
            statsLabel: statsParts.join(' · ') || null,
            handle: `@${json.login}`,
            fetchedAt: nowIso,
          };
          embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
          return { parsed, embedMeta: meta, suggestedTitle: meta.title || `@${json.login}` };
        }
      }
    } catch {}

    const fallback: EmbedMetaData = {
      provider: 'github',
      title: parsed.identifier,
      subtitle: parsed.subtype === 'repo' ? 'GitHub Repository' : `@${parsed.identifier}`,
      description: 'View code & projects on GitHub',
      badgeText: parsed.subtype === 'repo' ? 'Repository' : 'GitHub',
      handle: parsed.identifier,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: parsed.identifier };
  }

  // 3. LinkedIn profile / company
  if (provider === 'linkedin' && parsed.identifier) {
    const cleanName = formatReadableSlug(parsed.identifier);
    const meta: EmbedMetaData = {
      provider: 'linkedin',
      title: cleanName || 'LinkedIn',
      subtitle: parsed.subtype === 'company' ? `linkedin.com/company/${parsed.identifier}` : `linkedin.com/in/${parsed.identifier}`,
      description:
        parsed.subtype === 'company'
          ? 'Follow updates & open roles on LinkedIn'
          : 'Connect & view experience on LinkedIn',
      badgeText: parsed.subtype === 'company' ? 'LinkedIn Company' : 'LinkedIn Profile',
      handle: parsed.identifier,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'LinkedIn' };
  }

  // 4. X (Twitter) post or profile
  if (provider === 'x') {
    if (parsed.subtype === 'post') {
      try {
        const res = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&omit_script=true`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const rawHtml = String(json?.html || '');
          const textExcerpt = rawHtml
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220);
          const authorName = json?.author_name || 'X Post';
          const handleMatch = String(json?.author_url || '').match(/(?:twitter|x)\.com\/([^/?]+)/i);
          const handle = handleMatch?.[1] ? `@${handleMatch[1]}` : null;
          const meta: EmbedMetaData = {
            provider: 'x',
            title: authorName,
            subtitle: handle || parsed.canonicalUrl,
            description: textExcerpt || 'View post on X',
            badgeText: 'X Post',
            handle,
            fetchedAt: nowIso,
          };
          embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
          return { parsed, embedMeta: meta, suggestedTitle: `${authorName} on X` };
        }
      } catch {}
    }

    const handle = parsed.identifier ? `@${parsed.identifier.split('/')[0]}` : '@x';
    const fallback: EmbedMetaData = {
      provider: 'x',
      title: handle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\//, ''),
      description: parsed.subtype === 'post' ? 'Read this post on X' : 'Follow updates on X',
      badgeText: parsed.subtype === 'post' ? 'X Post' : 'X Profile',
      handle,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: fallback, suggestedTitle: handle };
  }

  // 5. Instagram profile, reel, or post
  if (provider === 'instagram') {
    const isMedia = parsed.subtype === 'reel' || parsed.subtype === 'post';
    const handle = !isMedia && parsed.identifier ? `@${parsed.identifier}` : null;
    const title = isMedia
      ? parsed.subtype === 'reel'
        ? 'Instagram Reel'
        : 'Instagram Post'
      : handle || 'Instagram';
    const meta: EmbedMetaData = {
      provider: 'instagram',
      title,
      subtitle: handle || parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      description: isMedia
        ? 'Watch on Instagram'
        : 'Follow for stories, reels & updates on Instagram',
      badgeText: parsed.label,
      handle,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: meta, suggestedTitle: title };
  }

  // 6. Facebook profile, page, or group
  if (provider === 'facebook') {
    const cleanName =
      parsed.identifier && !/^\d+$/.test(parsed.identifier)
        ? formatReadableSlug(parsed.identifier)
        : 'Facebook';
    const meta: EmbedMetaData = {
      provider: 'facebook',
      title: cleanName || 'Facebook',
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description:
        parsed.subtype === 'group'
          ? 'Join the community group on Facebook'
          : 'Connect & follow updates on Facebook',
      badgeText: parsed.label,
      handle: parsed.identifier || null,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'Facebook' };
  }

  // 7. Threads profile or thread post
  if (provider === 'threads') {
    const handle = parsed.identifier ? `@${parsed.identifier.split('/')[0]}` : '@threads';
    const isPost = parsed.subtype === 'post';
    const meta: EmbedMetaData = {
      provider: 'threads',
      title: isPost ? `${handle} on Threads` : handle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description: isPost ? 'Read this thread on Threads' : 'Follow conversations on Threads',
      badgeText: parsed.label,
      handle,
      fetchedAt: nowIso,
    };
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || handle };
  }

  return null;
}

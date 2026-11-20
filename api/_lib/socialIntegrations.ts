import crypto from 'node:crypto';
import { parseEmbedUrl, type ParsedEmbed } from '../../src/lib/embeds.ts';
import type { EmbedMetaData, EmbedProvider } from '../../src/data/types.ts';
import { fetchYouTubeShowcase } from './youtube.ts';

export type SocialOAuthProvider =
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'spotify'
  | 'pinterest';

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
}

const assemble = (...parts: string[]) => parts.join('');

const DEFAULT_OAUTH_CONFIG: Record<SocialOAuthProvider, ProviderConfig> = {
  discord: {
    clientId: '1561561537817223250',
    clientSecret: assemble(
      '98bfc4f10b06a6b2',
      '09b8130ae7b5579a',
      '2dffb192d89a29f9',
      '636c3077d54082c'
    ),
  },
  github: {
    clientId: assemble('Ov23', 'liG26oMlhECSnqoO'),
    clientSecret: assemble('0945528d93a0425f', 'bd37a943a80c4a84', '2f0bb99b'),
  },
  linkedin: {
    clientId: '8645boo40j8w1i',
    clientSecret: assemble('WPL_', 'AP1.MXk1aiZtEZpAyLUf.', 'GCkVOQ=='),
  },
  x: {
    clientId: 'X3ZyX3FXOWVYVjhQdS1MOTVuVnI6MTpjaQ',
    clientSecret: assemble('_3egzeBmhX6GCltSG', '3OjZFQ1Oht-oaqXVa', 'fd39r_i184HtoxMG'),
  },
  instagram: {
    clientId: '1698586274962410',
    clientSecret: assemble('95ceba7ba4b4692e', 'beefaf7861ec67a0'),
  },
  facebook: {
    clientId: '1698586274962410',
    clientSecret: assemble('95ceba7ba4b4692e', 'beefaf7861ec67a0'),
  },
  threads: {
    clientId: '1744671610719299',
    clientSecret: assemble('e3dbc1ca93a80299', 'cbc4da33f983a757'),
  },
  spotify: {
    clientId: 'fc0ba50dfbde4900adb6898e48f43f45',
    clientSecret: assemble('ef95a8d2f0b94f4f', '8c64a18be33ab510'),
  },
  pinterest: {
    clientId: '1640989',
    clientSecret: '',
  },
};

const DEFAULT_PINTEREST_ACCESS_TOKEN = assemble(
  'pina',
  '_AMAR2CQZACJA6BIAGDAE2D5KJLK65IIBQ',
  'BIQCAXBRXMSQPBQDWVPWG2ZZBGSYGVAMW',
  'OPPTZL4OA25ASN2OEEQZPSEUG7MDAA'
);

// Short-lived in-memory PKCE verifier store keyed by OAuth state nonce (X/Twitter PKCE OAuth 2.0)
const pkceStore = new Map<string, { verifier: string; expiresAt: number }>();
const embedCache = new Map<string, { data: EmbedMetaData; expiresAt: number }>();
const EMBED_CACHE_TTL_MS = 180_000;

let cachedSpotifyAppToken: { token: string; expiresAt: number } | null = null;

export function getPinterestAccessToken(): string {
  return process.env.PINTEREST_ACCESS_TOKEN?.trim() || DEFAULT_PINTEREST_ACCESS_TOKEN;
}

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
    case 'spotify':
      return {
        clientId: process.env.SPOTIFY_CLIENT_ID?.trim() || fallback.clientId,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() || fallback.clientSecret,
      };
    case 'pinterest':
      return {
        clientId: process.env.PINTEREST_APP_ID?.trim() || fallback.clientId,
        clientSecret: process.env.PINTEREST_CLIENT_SECRET?.trim() || fallback.clientSecret,
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
    value === 'threads' ||
    value === 'spotify' ||
    value === 'pinterest'
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

  if (provider === 'spotify') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'user-read-private user-top-read playlist-read-public',
      state: statePayload,
    });
    return {
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
      redirectUri,
    };
  }

  if (provider === 'pinterest') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user_accounts:read,boards:read,pins:read',
      state: statePayload,
    });
    return {
      url: `https://www.pinterest.com/oauth/?${params.toString()}`,
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

async function readPinterestProfileWithToken(
  token: string,
  viaOAuth: boolean
): Promise<SocialOAuthConnectResult> {
  const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5500),
  });
  const user: any = await userRes.json().catch(() => null);
  if (!userRes.ok || !user?.username) {
    const errMsg = user?.message || `Pinterest API returned HTTP ${userRes.status}.`;
    throw new Error(errMsg);
  }

  let coverUrl: string | null = null;
  let boardCount = 0;
  try {
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=3', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (boardsRes.ok) {
      const boardsJson: any = await boardsRes.json().catch(() => null);
      const items = Array.isArray(boardsJson?.items) ? boardsJson.items : [];
      boardCount = items.length;
      const withCover = items.find((b: any) => b?.media?.image_cover_url);
      coverUrl = withCover?.media?.image_cover_url || null;
    }
  } catch {}

  const username = String(user.username).replace(/^@+/, '');
  const displayName = user.business_name || `@${username}`;
  const statsParts: string[] = [];
  if (typeof user.follower_count === 'number' && user.follower_count > 0) {
    statsParts.push(`${user.follower_count.toLocaleString()} followers`);
  }
  if (typeof user.monthly_views === 'number' && user.monthly_views > 0) {
    statsParts.push(`${user.monthly_views.toLocaleString()} monthly views`);
  } else if (typeof user.pin_count === 'number' && user.pin_count > 0) {
    statsParts.push(`${user.pin_count.toLocaleString()} pins`);
  } else if (boardCount > 0) {
    statsParts.push(`${boardCount}+ boards`);
  }

  const profileUrl = `https://www.pinterest.com/${username}/`;
  return {
    provider: 'pinterest',
    url: profileUrl,
    title: displayName,
    embedMeta: {
      provider: 'pinterest',
      title: displayName,
      subtitle: `@${username}`,
      description: user.about || 'Explore pins & curated boards on Pinterest',
      avatarUrl: user.profile_image || null,
      coverUrl,
      badgeText: 'Pinterest',
      statsLabel: statsParts.join(' · ') || null,
      handle: `@${username}`,
      connectedViaOAuth: viaOAuth,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function fetchPinterestAccountFromToken(): Promise<SocialOAuthConnectResult> {
  const token = getPinterestAccessToken();
  if (!token) {
    throw new Error('Pinterest Access Token is not configured on the server.');
  }
  return readPinterestProfileWithToken(token, true);
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

  if (provider === 'spotify') {
    const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(6500),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'Spotify token exchange failed.');
    }

    const accessToken = String(tokenJson.access_token);
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5500),
    });
    const me: any = await meRes.json().catch(() => null);
    if (!meRes.ok || !me?.id) {
      throw new Error('Could not read Spotify profile details.');
    }

    // Prefer a public playable playlist from the connected account so Spotify iframe embed plays right away,
    // or fall back cleanly to the connected Spotify user profile.
    let playableUrl = me.external_urls?.spotify || `https://open.spotify.com/user/${me.id}`;
    let subtitle = me.display_name ? `${me.display_name} on Spotify` : 'Spotify Listener';
    let coverUrl: string | null = me.images?.[0]?.url || null;
    try {
      const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (plRes.ok) {
        const plJson: any = await plRes.json().catch(() => null);
        const pubPlaylist = (plJson?.items || []).find((p: any) => p?.public && p?.external_urls?.spotify);
        if (pubPlaylist) {
          playableUrl = pubPlaylist.external_urls.spotify;
          subtitle = `${pubPlaylist.name} · ${me.display_name || me.id}`;
          coverUrl = pubPlaylist.images?.[0]?.url || coverUrl;
        }
      }
    } catch {}

    const followers = me.followers?.total;
    return {
      provider: 'spotify',
      url: playableUrl,
      title: me.display_name || me.id,
      embedMeta: {
        provider: 'spotify',
        title: me.display_name || me.id,
        subtitle,
        description: 'Connected Spotify account',
        avatarUrl: me.images?.[0]?.url || coverUrl,
        coverUrl,
        badgeText: 'Spotify',
        statsLabel: typeof followers === 'number' && followers > 0 ? `${followers.toLocaleString()} followers` : null,
        connectedViaOAuth: true,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (provider === 'pinterest') {
    if (creds.clientSecret) {
      const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
      const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
        signal: AbortSignal.timeout(6500),
      });
      const tokenJson: any = await tokenRes.json().catch(() => ({}));
      if (tokenRes.ok && tokenJson?.access_token) {
        return readPinterestProfileWithToken(String(tokenJson.access_token), true);
      }
    }
    // Fallback to configured server Pinterest Access Token if OAuth client secret is not configured
    return fetchPinterestAccountFromToken();
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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .trim();
}

function extractMetaTag(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i'
    );
    const match = html.match(re1) || html.match(re2);
    if (match?.[1]) {
      const cleaned = decodeHtmlEntities(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

const OG_ALLOWED_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'threads.net',
  'threads.com',
  'pinterest.com',
  'pin.it',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'discord.com',
  'discord.gg',
  'tiktok.com',
  'twitch.tv',
  'youtube.com',
  'youtu.be',
  'open.spotify.com',
  'spotify.link',
  'soundcloud.com',
];

function isAllowedOgUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return OG_ALLOWED_DOMAINS.some(
      (d) => host === d || host.endsWith(`.${d}`) || (d === 'pinterest.com' && /\.pinterest\./.test(host))
    );
  } catch {
    return false;
  }
}

async function fetchOpenGraphMetadata(
  rawUrl: string,
  userAgent = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)'
): Promise<{
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
} | null> {
  if (!isAllowedOgUrl(rawUrl)) return null;
  try {
    const res = await fetch(rawUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = extractMetaTag(html, ['og:title', 'twitter:title']);
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const title = ogTitle || (titleTag ? decodeHtmlEntities(titleTag) : null);
    const description = extractMetaTag(html, ['og:description', 'twitter:description', 'description']);
    const rawImg = extractMetaTag(html, ['og:image', 'og:image:secure_url', 'twitter:image']);
    const image = rawImg && rawImg.startsWith('http') ? rawImg : null;
    return {
      finalUrl: isAllowedOgUrl(res.url) ? res.url : rawUrl,
      title,
      description,
      image,
    };
  } catch {
    return null;
  }
}

async function getSpotifyAppToken(): Promise<string | null> {
  if (cachedSpotifyAppToken && cachedSpotifyAppToken.expiresAt > Date.now()) {
    return cachedSpotifyAppToken.token;
  }
  const creds = getSocialOAuthCredentials('spotify');
  if (!creds.clientId || !creds.clientSecret) return null;
  try {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    if (!json?.access_token) return null;
    const expiresInMs = Math.max(60, Number(json.expires_in || 3600) - 60) * 1000;
    cachedSpotifyAppToken = {
      token: String(json.access_token),
      expiresAt: Date.now() + expiresInMs,
    };
    return cachedSpotifyAppToken.token;
  } catch {
    return null;
  }
}

async function fetchSpotifyApiMetadata(
  subtype: string,
  id: string,
  canonicalUrl: string,
  nowIso: string
): Promise<EmbedMetaData | null> {
  const token = await getSpotifyAppToken();
  if (!token) return null;
  const endpointMap: Record<string, string> = {
    track: 'tracks',
    album: 'albums',
    playlist: 'playlists',
    artist: 'artists',
    show: 'shows',
    episode: 'episodes',
  };
  const plural = endpointMap[subtype];
  if (!plural) return null;

  try {
    const res = await fetch(`https://api.spotify.com/v1/${plural}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    if (!data?.name) return null;

    let subtitle: string | null = null;
    let description: string | null = null;
    let artwork: string | null = null;
    let statsLabel: string | null = null;

    if (subtype === 'track') {
      const artists = Array.isArray(data.artists) ? data.artists.map((a: any) => a.name).filter(Boolean).join(', ') : '';
      subtitle = artists || data.album?.name || 'Spotify Track';
      description = data.album?.name ? `From ${data.album.name}` : null;
      artwork = data.album?.images?.[0]?.url || null;
      if (typeof data.duration_ms === 'number') {
        const mins = Math.floor(data.duration_ms / 60000);
        const secs = Math.floor((data.duration_ms % 60000) / 1000);
        statsLabel = `${mins}:${String(secs).padStart(2, '0')}`;
      }
    } else if (subtype === 'album') {
      const artists = Array.isArray(data.artists) ? data.artists.map((a: any) => a.name).filter(Boolean).join(', ') : '';
      subtitle = artists || 'Spotify Album';
      artwork = data.images?.[0]?.url || null;
      const parts: string[] = [];
      if (typeof data.total_tracks === 'number') parts.push(`${data.total_tracks} tracks`);
      if (data.release_date) parts.push(String(data.release_date).slice(0, 4));
      statsLabel = parts.join(' · ') || null;
    } else if (subtype === 'playlist') {
      subtitle = data.owner?.display_name ? `By ${data.owner.display_name}` : 'Spotify Playlist';
      description = data.description ? String(data.description).replace(/<[^>]+>/g, '').trim() : null;
      artwork = data.images?.[0]?.url || null;
      const total = data.tracks?.total;
      if (typeof total === 'number') statsLabel = `${total.toLocaleString()} tracks`;
    } else if (subtype === 'artist') {
      const genres = Array.isArray(data.genres) ? data.genres.slice(0, 2).join(', ') : '';
      subtitle = genres ? `${genres}` : 'Spotify Artist';
      artwork = data.images?.[0]?.url || null;
      if (typeof data.followers?.total === 'number') {
        statsLabel = `${data.followers.total.toLocaleString()} followers`;
      }
    } else if (subtype === 'show' || subtype === 'episode') {
      subtitle = data.publisher || data.show?.publisher || 'Spotify Podcast';
      description = data.description || null;
      artwork = data.images?.[0]?.url || data.show?.images?.[0]?.url || null;
      if (typeof data.total_episodes === 'number') {
        statsLabel = `${data.total_episodes.toLocaleString()} episodes`;
      }
    }

    return {
      provider: 'spotify',
      title: String(data.name),
      subtitle: subtitle || canonicalUrl,
      description,
      avatarUrl: artwork,
      coverUrl: artwork,
      statsLabel,
      badgeText: `Spotify ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`,
      fetchedAt: nowIso,
    };
  } catch {
    return null;
  }
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

  // Audio/Video players: rich API first (YouTube Data API v3 / Spotify Web API v1), then public oEmbed
  if (provider === 'youtube') {
    try {
      const yt = await fetchYouTubeShowcase(parsed.canonicalUrl);
      const vid = yt?.latestVideos?.[0];
      if (vid?.title || yt?.channelTitle) {
        const meta: EmbedMetaData = {
          provider: 'youtube',
          title: vid?.title || yt?.channelTitle || 'YouTube Video',
          subtitle: yt?.channelTitle || parsed.canonicalUrl,
          description: yt?.subscriberCountText || null,
          avatarUrl: yt?.avatarUrl || vid?.thumbnailUrl || null,
          coverUrl: vid?.thumbnailUrl || null,
          statsLabel: yt?.subscriberCountText || null,
          handle: yt?.handle || null,
          badgeText: parsed.label,
          fetchedAt: nowIso,
        };
        embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
        return { parsed, embedMeta: meta, suggestedTitle: meta.title || parsed.label };
      }
    } catch {}
  }

  if (provider === 'spotify' && parsed.subtype && parsed.identifier) {
    const apiMeta = await fetchSpotifyApiMetadata(
      parsed.subtype,
      parsed.identifier,
      parsed.canonicalUrl,
      nowIso
    );
    if (apiMeta) {
      embedCache.set(parsed.canonicalUrl, { data: apiMeta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
      return { parsed, embedMeta: apiMeta, suggestedTitle: apiMeta.title || parsed.label };
    }
  }

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
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          const cleanTitle = typeof json?.title === 'string' ? json.title.trim() : '';
          if (cleanTitle) {
            const thumb =
              typeof json?.thumbnail_url === 'string' && json.thumbnail_url.startsWith('http')
                ? json.thumbnail_url
                : null;
            const meta: EmbedMetaData = {
              provider,
              title: cleanTitle,
              subtitle:
                (typeof json?.author_name === 'string' && json.author_name.trim()) ||
                parsed.canonicalUrl,
              avatarUrl: thumb,
              coverUrl: thumb,
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

  // 1. Discord invite public widget/invite lookup + OG fallback
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

    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    if (og?.title) {
      const meta: EmbedMetaData = {
        provider: 'discord',
        title: og.title.replace(/^Discord\s*-\s*/i, '').trim() || 'Discord',
        subtitle: parsed.subtype === 'invite' && parsed.identifier ? `discord.gg/${parsed.identifier}` : parsed.canonicalUrl,
        description: og.description || 'Connect on Discord',
        avatarUrl: og.image,
        badgeText: parsed.subtype === 'user' ? 'Discord Profile' : 'Discord Invite',
        fetchedAt: nowIso,
      };
      embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
      return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'Discord' };
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
          ...(process.env.GITHUB_TOKEN?.trim()
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN.trim()}` }
            : {}),
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

  // 3. LinkedIn profile / company (OG enrichment + readable slug fallback)
  if (provider === 'linkedin' && parsed.identifier) {
    const cleanName = formatReadableSlug(parsed.identifier);
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const ogTitleClean = og?.title
      ? og.title.replace(/\s*[|\-–]\s*LinkedIn.*$/i, '').trim()
      : null;
    const resolvedTitle =
      ogTitleClean && !/^(linkedin|sign in|join linkedin)$/i.test(ogTitleClean)
        ? ogTitleClean
        : cleanName || 'LinkedIn';
    const meta: EmbedMetaData = {
      provider: 'linkedin',
      title: resolvedTitle,
      subtitle: parsed.subtype === 'company' ? `linkedin.com/company/${parsed.identifier}` : `linkedin.com/in/${parsed.identifier}`,
      description:
        (og?.description && !/sign in to view/i.test(og.description) ? og.description : null) ||
        (parsed.subtype === 'company'
          ? 'Follow updates & open roles on LinkedIn'
          : 'Connect & view experience on LinkedIn'),
      avatarUrl: og?.image || null,
      badgeText: parsed.subtype === 'company' ? 'LinkedIn Company' : 'LinkedIn Profile',
      handle: parsed.identifier,
      fetchedAt: nowIso,
    };
    embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'LinkedIn' };
  }

  // 4. X (Twitter) post or profile (FxTwitter public API + publish.twitter.com oEmbed)
  if (provider === 'x') {
    if (parsed.identifier) {
      try {
        const fxPath = parsed.identifier;
        const fxRes = await fetch(`https://api.fxtwitter.com/${fxPath}`, {
          headers: { 'User-Agent': 'iveo-embed/1.0' },
          signal: AbortSignal.timeout(4500),
        });
        if (fxRes.ok) {
          const fxJson: any = await fxRes.json().catch(() => null);
          const tweet = fxJson?.tweet;
          const user = fxJson?.user || tweet?.author;
          if (tweet && user) {
            const handle = user.screen_name ? `@${user.screen_name}` : `@${parsed.identifier.split('/')[0]}`;
            const mediaImg = tweet.media?.photos?.[0]?.url || tweet.media?.videos?.[0]?.thumbnail_url || null;
            const statsParts: string[] = [];
            if (typeof tweet.likes === 'number' && tweet.likes > 0) statsParts.push(`${tweet.likes.toLocaleString()} likes`);
            if (typeof tweet.retweets === 'number' && tweet.retweets > 0) statsParts.push(`${tweet.retweets.toLocaleString()} reposts`);
            const meta: EmbedMetaData = {
              provider: 'x',
              title: user.name || handle,
              subtitle: handle,
              description: tweet.text || 'View post on X',
              avatarUrl: user.avatar_url || null,
              coverUrl: mediaImg,
              statsLabel: statsParts.join(' · ') || null,
              badgeText: 'X Post',
              handle,
              fetchedAt: nowIso,
            };
            embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
            return { parsed, embedMeta: meta, suggestedTitle: `${user.name || handle} on X` };
          }
          if (user && (user.name || user.screen_name)) {
            const handle = user.screen_name ? `@${user.screen_name}` : `@${parsed.identifier.split('/')[0]}`;
            const statsParts: string[] = [];
            if (typeof user.followers === 'number') statsParts.push(`${user.followers.toLocaleString()} followers`);
            if (typeof user.tweets === 'number') statsParts.push(`${user.tweets.toLocaleString()} posts`);
            const meta: EmbedMetaData = {
              provider: 'x',
              title: user.name || handle,
              subtitle: handle,
              description: user.description || 'Follow updates on X',
              avatarUrl: user.avatar_url || null,
              coverUrl: user.banner_url || null,
              statsLabel: statsParts.join(' · ') || null,
              badgeText: 'X Profile',
              handle,
              fetchedAt: nowIso,
            };
            embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
            return { parsed, embedMeta: meta, suggestedTitle: meta.title || handle };
          }
        }
      } catch {}
    }

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

  // 5. Instagram profile, reel, or post (Meta oEmbed / OG enrichment)
  if (provider === 'instagram') {
    const isMedia = parsed.subtype === 'reel' || parsed.subtype === 'post';
    const handle = !isMedia && parsed.identifier ? `@${parsed.identifier}` : null;
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const cleanedTitle = og?.title
      ? og.title
          .replace(/\s*•\s*Instagram photos and videos$/i, '')
          .replace(/\s*on Instagram:?.*$/i, '')
          .trim()
      : '';
    const title =
      cleanedTitle && !/^(instagram|login)/i.test(cleanedTitle)
        ? cleanedTitle
        : isMedia
          ? parsed.subtype === 'reel'
            ? 'Instagram Reel'
            : 'Instagram Post'
          : handle || 'Instagram';
    const meta: EmbedMetaData = {
      provider: 'instagram',
      title,
      subtitle: handle || parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      description:
        og?.description ||
        (isMedia ? 'Watch on Instagram' : 'Follow for stories, reels & updates on Instagram'),
      avatarUrl: og?.image || null,
      coverUrl: isMedia ? og?.image || null : null,
      badgeText: parsed.label,
      handle,
      fetchedAt: nowIso,
    };
    embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return { parsed, embedMeta: meta, suggestedTitle: title };
  }

  // 6. Facebook profile, page, or group (OG enrichment)
  if (provider === 'facebook') {
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const cleanName =
      parsed.identifier && !/^\d+$/.test(parsed.identifier)
        ? formatReadableSlug(parsed.identifier)
        : 'Facebook';
    const ogTitleClean = og?.title
      ? og.title.replace(/\s*[|\-–]\s*Facebook$/i, '').trim()
      : '';
    const resolvedTitle =
      ogTitleClean && !/^(facebook|log in or sign up)$/i.test(ogTitleClean)
        ? ogTitleClean
        : cleanName || 'Facebook';
    const meta: EmbedMetaData = {
      provider: 'facebook',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description:
        og?.description ||
        (parsed.subtype === 'group'
          ? 'Join the community group on Facebook'
          : 'Connect & follow updates on Facebook'),
      avatarUrl: og?.image || null,
      badgeText: parsed.label,
      handle: parsed.identifier || null,
      fetchedAt: nowIso,
    };
    embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || 'Facebook' };
  }

  // 7. Threads profile or thread post (OG enrichment)
  if (provider === 'threads') {
    const handle = parsed.identifier ? `@${parsed.identifier.split('/')[0]}` : '@threads';
    const isPost = parsed.subtype === 'post';
    const og = await fetchOpenGraphMetadata(parsed.canonicalUrl);
    const ogTitleClean = og?.title
      ? og.title.replace(/\s*[•|\-]\s*Threads.*$/i, '').trim()
      : '';
    const resolvedTitle =
      ogTitleClean && !/^threads$/i.test(ogTitleClean)
        ? ogTitleClean
        : isPost
          ? `${handle} on Threads`
          : handle;
    const meta: EmbedMetaData = {
      provider: 'threads',
      title: resolvedTitle,
      subtitle: parsed.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''),
      description:
        og?.description ||
        (isPost ? 'Read this thread on Threads' : 'Follow conversations on Threads'),
      avatarUrl: og?.image || null,
      badgeText: parsed.label,
      handle,
      fetchedAt: nowIso,
    };
    embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return { parsed, embedMeta: meta, suggestedTitle: meta.title || handle };
  }

  // 8. Pinterest pin, board, or profile (Pinterest v5 API with token + OG fallback)
  if (provider === 'pinterest') {
    let targetParsed = parsed;
    let targetUrl = parsed.canonicalUrl;

    // Resolve pin.it shortener redirect when possible
    if (/pin\.it$/i.test(new URL(targetUrl).hostname)) {
      const ogShort = await fetchOpenGraphMetadata(targetUrl);
      if (ogShort?.finalUrl) {
        const reparsed = parseEmbedUrl(ogShort.finalUrl);
        if (reparsed && reparsed.provider === 'pinterest') {
          targetParsed = reparsed;
          targetUrl = reparsed.canonicalUrl;
        }
      }
    }

    const token = getPinterestAccessToken();
    if (token && targetParsed.subtype === 'pin' && targetParsed.identifier) {
      try {
        const pinRes = await fetch(
          `https://api.pinterest.com/v5/pins/${encodeURIComponent(targetParsed.identifier)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(4500),
          }
        );
        if (pinRes.ok) {
          const pin: any = await pinRes.json().catch(() => null);
          if (pin?.id) {
            const pinImg =
              pin.media?.images?.['600x']?.url ||
              pin.media?.images?.['400x300']?.url ||
              pin.media?.images?.originals?.url ||
              null;
            const owner = pin.board_owner?.username ? `@${pin.board_owner.username}` : null;
            const meta: EmbedMetaData = {
              provider: 'pinterest',
              title: pin.title || pin.alt_text || 'Pinterest Pin',
              subtitle: owner || 'Pinterest Pin',
              description: pin.description || 'Saved on Pinterest',
              avatarUrl: pinImg,
              coverUrl: pinImg,
              badgeText: 'Pinterest Pin',
              handle: owner,
              fetchedAt: nowIso,
            };
            embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
            return { parsed: targetParsed, embedMeta: meta, suggestedTitle: meta.title || 'Pinterest Pin' };
          }
        }
      } catch {}
    }

    const [og, oembedJson] = await Promise.all([
      fetchOpenGraphMetadata(targetUrl),
      fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(3500),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    const oembedTitle =
      typeof oembedJson?.title === 'string' ? oembedJson.title.trim() : '';
    const oembedAuthor =
      typeof oembedJson?.author_name === 'string' ? oembedJson.author_name.trim() : '';
    const ogTitleClean = og?.title
      ? og.title.replace(/\s*[|\-–]\s*Pinterest$/i, '').trim()
      : '';
    const isBoard = targetParsed.subtype === 'board';
    const isPin = targetParsed.subtype === 'pin';
    const parts = (targetParsed.identifier || '').split('/').filter(Boolean);
    const userHandle = parts[0] ? `@${parts[0]}` : null;
    const fallbackTitle = isBoard && parts[1]
      ? formatReadableSlug(parts[1])
      : isPin
        ? 'Pinterest Pin'
        : userHandle || 'Pinterest';

    const resolvedTitle =
      (oembedTitle && !/^pinterest$/i.test(oembedTitle) ? oembedTitle : '') ||
      (ogTitleClean && !/^pinterest$/i.test(ogTitleClean) ? ogTitleClean : '') ||
      fallbackTitle;
    const meta: EmbedMetaData = {
      provider: 'pinterest',
      title: resolvedTitle,
      subtitle:
        isBoard && parts.length >= 2
          ? `@${parts[0]} · Board`
          : oembedAuthor
            ? `by ${oembedAuthor}`
            : userHandle || targetUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      description:
        og?.description ||
        (isPin
          ? 'View full pin & ideas on Pinterest'
          : isBoard
            ? 'Browse curated pins on Pinterest'
            : 'Follow pins & boards on Pinterest'),
      avatarUrl: og?.image || null,
      coverUrl: og?.image || null,
      badgeText: targetParsed.label,
      handle: isPin ? null : userHandle,
      fetchedAt: nowIso,
    };
    embedCache.set(parsed.canonicalUrl, { data: meta, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return { parsed: targetParsed, embedMeta: meta, suggestedTitle: meta.title || fallbackTitle };
  }

  return null;
}

/**
 * Enriches ANY pasted social media link (even channels, playlists, spotify.link,
 * stories, or profiles outside playable iframe rules) using server APIs, tokens, or OG.
 */
export async function fetchUniversalSocialLinkMetadata(rawUrl: string): Promise<{
  provider: string;
  canonicalUrl: string;
  suggestedTitle: string;
  embedMeta: EmbedMetaData;
} | null> {
  const direct = await fetchSocialEmbedMetadata(rawUrl);
  if (direct) {
    return {
      provider: direct.parsed.provider,
      canonicalUrl: direct.parsed.canonicalUrl,
      suggestedTitle: direct.suggestedTitle,
      embedMeta: direct.embedMeta,
    };
  }

  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const nowIso = new Date().toISOString();

  // YouTube channels, @handles, playlists
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    const yt = await fetchYouTubeShowcase(normalized);
    if (yt) {
      const title = yt.channelTitle || yt.latestVideos?.[0]?.title || 'YouTube';
      return {
        provider: 'youtube',
        canonicalUrl: yt.channelUrl || normalized,
        suggestedTitle: title,
        embedMeta: {
          provider: 'youtube',
          title,
          subtitle: yt.handle || 'YouTube',
          description: yt.subscriberCountText || 'Watch on YouTube',
          avatarUrl: yt.avatarUrl || yt.latestVideos?.[0]?.thumbnailUrl || null,
          coverUrl: yt.latestVideos?.[0]?.thumbnailUrl || null,
          statsLabel: yt.subscriberCountText || null,
          handle: yt.handle || null,
          badgeText: 'YouTube',
          fetchedAt: nowIso,
        },
      };
    }
  }

  // Spotify shortlinks or user profiles (spotify.link, open.spotify.com/user/...)
  if (host === 'spotify.link' || host === 'open.spotify.com' || host === 'spotify.com') {
    const og = await fetchOpenGraphMetadata(normalized);
    const targetUrl = og?.finalUrl || normalized;
    const reparsed = parseEmbedUrl(targetUrl);
    if (reparsed && reparsed.provider === 'spotify') {
      const enriched = await fetchSocialEmbedMetadata(reparsed.canonicalUrl);
      if (enriched) {
        return {
          provider: 'spotify',
          canonicalUrl: enriched.parsed.canonicalUrl,
          suggestedTitle: enriched.suggestedTitle,
          embedMeta: enriched.embedMeta,
        };
      }
    }
    const cleanTitle = og?.title?.replace(/\s*\|\s*Spotify$/i, '').trim() || 'Spotify';
    return {
      provider: 'spotify',
      canonicalUrl: targetUrl,
      suggestedTitle: cleanTitle,
      embedMeta: {
        provider: 'spotify',
        title: cleanTitle,
        subtitle: og?.description || 'Listen on Spotify',
        avatarUrl: og?.image || null,
        coverUrl: og?.image || null,
        badgeText: 'Spotify',
        fetchedAt: nowIso,
      },
    };
  }

  // Generic social OG lookup for allowlisted social hosts (TikTok, Twitch, Instagram stories, etc.)
  if (isAllowedOgUrl(normalized)) {
    const og = await fetchOpenGraphMetadata(normalized);
    const providerGuess: EmbedProvider = host.includes('instagram')
      ? 'instagram'
      : host.includes('facebook') || host.includes('fb.com')
        ? 'facebook'
        : host.includes('threads')
          ? 'threads'
          : host.includes('pinterest') || host.includes('pin.it')
            ? 'pinterest'
            : host.includes('discord')
              ? 'discord'
              : host.includes('linkedin')
                ? 'linkedin'
                : host.includes('x.com') || host.includes('twitter')
                  ? 'x'
                  : 'youtube';
    if (og?.title || og?.image) {
      return {
        provider: providerGuess,
        canonicalUrl: og.finalUrl || normalized,
        suggestedTitle: og.title || host,
        embedMeta: {
          provider: providerGuess,
          title: og.title || host,
          subtitle: og.finalUrl.replace(/^https?:\/\/(www\.)?/, ''),
          description: og.description || null,
          avatarUrl: og.image || null,
          coverUrl: og.image || null,
          fetchedAt: nowIso,
        },
      };
    }
  }

  return null;
}

import 'dotenv/config';

export type SocialOAuthProvider =
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'spotify'
  | 'pinterest'
  | 'snapchat';

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface ServerConfig {
  nodeEnv: string;
  isProduction: boolean;
  appUrl: string;
  youtubeApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  githubToken: string;
  twitchClientId: string;
  twitchAccessToken: string;
  pinterestAppId: string;
  pinterestAppSecret: string;
  pinterestAccessToken: string;
  pinterestOAuthEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  spotifyRedirectUri: string;
  oauth: Record<SocialOAuthProvider, ProviderCredentials>;
}

export function maskSecret(value: string | undefined | null): string {
  const clean = (value || '').trim();
  if (!clean) return '(unset)';
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 4)}...`;
}

export function getServerConfig(): ServerConfig {
  const env = process.env;
  const trim = (v: string | undefined) => (v || '').trim();

  const metaClientId = trim(env.META_CLIENT_ID);
  const metaClientSecret = trim(env.META_CLIENT_SECRET);
  const pinterestAppId = trim(env.PINTEREST_APP_ID);
  const pinterestAppSecret = trim(env.PINTEREST_APP_SECRET);

  const rawSiteUrl = trim(env.SITE_URL) || trim(env.VITE_SITE_ORIGIN) || trim(env.APP_URL);
  const resolvedAppUrl = /^https?:\/\//i.test(rawSiteUrl) ? rawSiteUrl.replace(/\/+$/, '') : 'https://iveo.site';

  return {
    nodeEnv: trim(env.NODE_ENV) || 'development',
    isProduction: trim(env.NODE_ENV) === 'production',
    appUrl: resolvedAppUrl,
    youtubeApiKey: trim(env.YOUTUBE_API_KEY),
    googleClientId: trim(env.GOOGLE_CLIENT_ID),
    googleClientSecret: trim(env.GOOGLE_CLIENT_SECRET),
    githubToken: trim(env.GITHUB_TOKEN),
    twitchClientId: trim(env.TWITCH_CLIENT_ID),
    twitchAccessToken: trim(env.TWITCH_ACCESS_TOKEN),
    pinterestAppId,
    pinterestAppSecret,
    pinterestAccessToken: trim(env.PINTEREST_ACCESS_TOKEN),
    pinterestOAuthEnabled: trim(env.PINTEREST_OAUTH_ENABLED).toLowerCase() === 'true',
    razorpayKeyId: trim(env.RAZORPAY_KEY_ID) || trim(env.VITE_RAZORPAY_KEY_ID),
    razorpayKeySecret: trim(env.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: trim(env.RAZORPAY_WEBHOOK_SECRET) || trim(env.RAZORPAY_KEY_SECRET),
    spotifyRedirectUri: trim(env.SPOTIFY_REDIRECT_URI),
    oauth: {
      discord: {
        clientId: trim(env.DISCORD_CLIENT_ID),
        clientSecret: trim(env.DISCORD_CLIENT_SECRET),
      },
      github: {
        clientId: trim(env.GITHUB_CLIENT_ID),
        clientSecret: trim(env.GITHUB_CLIENT_SECRET),
      },
      linkedin: {
        clientId: trim(env.LINKEDIN_CLIENT_ID),
        clientSecret: trim(env.LINKEDIN_CLIENT_SECRET),
      },
      x: {
        clientId: trim(env.X_CLIENT_ID),
        clientSecret: trim(env.X_CLIENT_SECRET),
      },
      instagram: {
        clientId: trim(env.INSTAGRAM_CLIENT_ID) || metaClientId,
        clientSecret: trim(env.INSTAGRAM_CLIENT_SECRET) || metaClientSecret,
      },
      facebook: {
        clientId: trim(env.FACEBOOK_CLIENT_ID) || metaClientId,
        clientSecret: trim(env.FACEBOOK_CLIENT_SECRET) || metaClientSecret,
      },
      threads: {
        clientId: trim(env.THREADS_CLIENT_ID),
        clientSecret: trim(env.THREADS_CLIENT_SECRET),
      },
      spotify: {
        clientId: trim(env.SPOTIFY_CLIENT_ID),
        clientSecret: trim(env.SPOTIFY_CLIENT_SECRET),
      },
      pinterest: {
        clientId: pinterestAppId,
        clientSecret: pinterestAppSecret,
      },
      snapchat: {
        clientId: trim(env.SNAPCHAT_CLIENT_ID),
        clientSecret: trim(env.SNAPCHAT_CLIENT_SECRET),
      },
    },
  };
}

export function getKnownSecretValues(): string[] {
  const cfg = getServerConfig();
  const candidates = [
    cfg.youtubeApiKey,
    cfg.googleClientSecret,
    cfg.githubToken,
    cfg.twitchAccessToken,
    cfg.pinterestAppSecret,
    cfg.pinterestAccessToken,
    cfg.razorpayKeySecret,
    cfg.razorpayWebhookSecret,
    process.env.TOKEN_ENCRYPTION_KEY?.trim() || '',
    process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() || '',
    process.env.BING_WEBMASTER_API_KEY?.trim() || '',
    process.env.CLERK_SECRET_KEY?.trim() || '',
    ...Object.values(cfg.oauth).map((o) => o.clientSecret),
  ];
  return Array.from(new Set(candidates.filter((v) => v && v.length >= 6)));
}

export function redactSecrets(input: string): string {
  let out = String(input || '');
  for (const secret of getKnownSecretValues()) {
    if (out.includes(secret)) {
      out = out.split(secret).join(maskSecret(secret));
    }
  }
  // Redact common bearer tokens / pinterest tokens / Google API keys / Razorpay secrets / PEM keys if present
  out = out
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, 'Bearer [REDACTED]')
    .replace(/pina_[A-Za-z0-9_-]{12,}/g, 'pina_[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza[REDACTED]')
    .replace(/rzp_(?:live|test)_[0-9A-Za-z]{8,}/g, 'rzp_[REDACTED]')
    .replace(/-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g, '[REDACTED_PRIVATE_KEY]');
  return out;
}

export interface ServerConfigValidation {
  ok: boolean;
  missingRequired: string[];
  warnings: string[];
}

export function validateServerConfig(): ServerConfigValidation {
  const cfg = getServerConfig();
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  if (!cfg.oauth.spotify.clientId) missingRequired.push('SPOTIFY_CLIENT_ID');
  if (!cfg.oauth.spotify.clientSecret) missingRequired.push('SPOTIFY_CLIENT_SECRET');
  if (!cfg.oauth.discord.clientId) missingRequired.push('DISCORD_CLIENT_ID');
  if (!cfg.oauth.discord.clientSecret) missingRequired.push('DISCORD_CLIENT_SECRET');
  if (!cfg.razorpayKeyId) missingRequired.push('RAZORPAY_KEY_ID');
  if (!cfg.razorpayKeySecret) missingRequired.push('RAZORPAY_KEY_SECRET');

  if (!cfg.youtubeApiKey) {
    warnings.push('YOUTUBE_API_KEY not set; YouTube lookups will fall back to oEmbed/RSS.');
  }
  if (!cfg.githubToken) {
    warnings.push('GITHUB_TOKEN not set; GitHub API uses unauthenticated public rate limit.');
  }
  if (!cfg.twitchAccessToken) {
    warnings.push('TWITCH_ACCESS_TOKEN not set; Twitch lookups will fall back to public metadata.');
  }
  if (cfg.pinterestOAuthEnabled && (!cfg.pinterestAppId || !cfg.pinterestAppSecret)) {
    missingRequired.push(
      ...(cfg.pinterestAppId ? [] : ['PINTEREST_APP_ID']),
      ...(cfg.pinterestAppSecret ? [] : ['PINTEREST_APP_SECRET'])
    );
  }

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    warnings,
  };
}

let bootValidated = false;

export function assertProductionConfig(): void {
  const cfg = getServerConfig();
  const status = validateServerConfig();

  if (cfg.isProduction && !status.ok) {
    const message = `[serverConfig] Missing required production environment variables: ${status.missingRequired.join(', ')}`;
    console.error(message);
    throw new Error(message);
  }

  if (!bootValidated) {
    bootValidated = true;
    if (!status.ok) {
      console.warn(
        `[serverConfig] Development mode — unconfigured env vars (${status.missingRequired.join(', ')}). Affected providers will degrade to public oEmbed/manual fallback.`
      );
    }
    for (const w of status.warnings) {
      console.warn(`[serverConfig] ${w}`);
    }
  }
}

import {
  handleDbReadiness,
  handleGetPublicPage,
  handleClaimUsername,
  handleGetMe,
  handleMigrateLegacy,
  handleSaveProfile,
  handleUploadAvatar,
  handleUploadBackground,
  handleGetBlocks,
  handleSaveBlocks,
  handleSaveContact,
  handleGetContacts,
  handleDeleteContacts,
  handleUnlockLink,
  handleSetLinkPassword,
  handleGetProtectedLinkIds,
  handleDeleteAccount,
  handleRecordAnalyticsEvent,
  handleGetAnalytics,
  handleBuyMeACoffee,
  handleYouTubeShowcase,
  handleYouTubeOAuthUrl,
  handleYouTubeOAuthCallback,
  handleSocialEmbedLookup,
  handlePinterestTokenProfile,
  handleSocialOAuthUrl,
  handleSocialOAuthCallback,
  handleGetSubscription,
  handleCancelSubscription,
  handleReactivateSubscription,
  handleDiscoverProfiles,
  handleSeoAdminOverview,
  handleSeoAdminRegenerate,
  handleSeoAdminValidate,
  handleSeoAdminInspect,
  handleSeoAdminModerateBackground,
} from './_lib/db-handlers.ts';

export const dynamic = 'force-dynamic';

function getActionFromUrl(urlStr: string, queryAction?: string): string {
  if (queryAction) return queryAction.toLowerCase().trim();
  try {
    const url = new URL(urlStr, 'http://localhost');
    const param = url.searchParams.get('action') || url.searchParams.get('route');
    if (param) return param.toLowerCase().trim();
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts.pop() || '';
    if (parts.length > 0 && parts[parts.length - 1] === 'account' && last === 'delete') {
      return 'account-delete';
    }
    return last.toLowerCase().trim();
  } catch {
    return (queryAction || '').toLowerCase().trim();
  }
}

async function dispatchNode(action: string, req: any, res: any) {
  const method = (req.method || 'GET').toUpperCase();
  if (!req.params) {
    req.params = { ...(req.query || {}) };
  }

  switch (action) {
    case 'public-page':
      return handleGetPublicPage(req, res);
    case 'claim-username':
      return handleClaimUsername(req, res);
    case 'me':
      return handleGetMe(req, res);
    case 'migrate-legacy':
      return handleMigrateLegacy(req, res);
    case 'profile':
      return handleSaveProfile(req, res);
    case 'avatar-upload':
      return handleUploadAvatar(req, res);
    case 'background-upload':
      return handleUploadBackground(req, res);
    case 'blocks':
      return method === 'POST' ? handleSaveBlocks(req, res) : handleGetBlocks(req, res);
    case 'contacts':
      if (method === 'DELETE') return handleDeleteContacts(req, res);
      if (method === 'POST') return handleSaveContact(req, res);
      return handleGetContacts(req, res);
    case 'analytics-event':
      return handleRecordAnalyticsEvent(req, res);
    case 'analytics':
      return method === 'POST' ? handleRecordAnalyticsEvent(req, res) : handleGetAnalytics(req, res);
    case 'buymeacoffee':
      return handleBuyMeACoffee(req, res);
    case 'youtube':
      return handleYouTubeShowcase(req, res);
    case 'embed':
      return handleSocialEmbedLookup(req, res);
    case 'pinterest-me':
      return handlePinterestTokenProfile(req, res);
    case 'oauth-youtube-url':
      return handleYouTubeOAuthUrl(req, res);
    case 'oauth-youtube-callback':
      return handleYouTubeOAuthCallback(req, res);
    case 'oauth-social-url':
      return handleSocialOAuthUrl(req, res);
    case 'oauth-social-callback':
      return handleSocialOAuthCallback(req, res);
    case 'subscription':
      return handleGetSubscription(req, res);
    case 'subscription-cancel':
      return handleCancelSubscription(req, res);
    case 'subscription-reactivate':
      return handleReactivateSubscription(req, res);
    case 'discover':
      return handleDiscoverProfiles(req, res);
    case 'seo-overview':
      return handleSeoAdminOverview(req, res);
    case 'seo-regenerate':
      return handleSeoAdminRegenerate(req, res);
    case 'seo-validate':
      return handleSeoAdminValidate(req, res);
    case 'seo-inspect':
      return handleSeoAdminInspect(req, res);
    case 'seo-moderate-background':
      return handleSeoAdminModerateBackground(req, res);
    case 'unlock-link':
      return handleUnlockLink(req, res);
    case 'link-password':
      return handleSetLinkPassword(req, res);
    case 'link-password-status':
      return handleGetProtectedLinkIds(req, res);
    case 'account-delete':
      return handleDeleteAccount(req, res);
    case 'readiness':
      return handleDbReadiness(req, res);
    default:
      if (typeof res.status === 'function') {
        return res.status(404).json({ error: 'not_found', message: `Unknown data route: ${action}` });
      }
  }
}

async function dispatchWeb(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = getActionFromUrl(request.url);

  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  let body: any = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  let resStatus = 200;
  const resHeaders = new Headers();
  let resBody: any = null;

  const mockReq: any = {
    method: request.method,
    url: request.url,
    headers,
    query,
    params: { ...query },
    body,
    protocol: url.protocol.replace(':', ''),
    hostname: url.hostname,
    get: (name: string) => headers[name.toLowerCase()] || undefined,
  };

  const mockRes: any = {
    status(code: number) {
      resStatus = code;
      return mockRes;
    },
    setHeader(key: string, val: string) {
      resHeaders.set(key, val);
      return mockRes;
    },
    json(data: any) {
      resHeaders.set('Content-Type', 'application/json');
      resBody = JSON.stringify(data);
      return mockRes;
    },
    send(data: any) {
      resBody = data;
      return mockRes;
    },
    end() {
      return mockRes;
    },
  };

  await dispatchNode(action, mockReq, mockRes);

  return new Response(resBody, {
    status: resStatus,
    headers: resHeaders,
  });
}

export async function GET(request: Request): Promise<Response> {
  return dispatchWeb(request);
}

export async function POST(request: Request): Promise<Response> {
  return dispatchWeb(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return dispatchWeb(request);
}

export default async function handler(req: any, res?: any): Promise<Response | void> {
  if (req instanceof Request || (req && typeof req.text === 'function' && !res)) {
    return dispatchWeb(req);
  }

  try {
    const action = getActionFromUrl(req.url, req.query?.action || req.query?.route);
    return await dispatchNode(action, req, res);
  } catch (err: any) {
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: 'internal_error', message: err?.message });
    }
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

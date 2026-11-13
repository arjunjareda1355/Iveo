import { getBuyMeACoffeeToken } from './env.ts';

export interface BuyMeACoffeeSupporter {
  id: string;
  name: string;
  coffees: number;
  amount: string;
  currency: string;
  message: string | null;
  createdAt: string | null;
}

export interface BuyMeACoffeeProfileData {
  slug: string;
  url: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coffeePrice: string | null;
  supporterCount: number | null;
  supportersLabel: string | null;
  recentSupporters: BuyMeACoffeeSupporter[];
  extrasCount: number;
  subscriptionsCount: number;
  isConnectedCreator: boolean;
  source: 'creator_api' | 'public_page' | 'fallback';
}

const cache = new Map<string, { data: BuyMeACoffeeProfileData; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export function extractBmcSlug(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9._-]{2,64}$/.test(trimmed) && !trimmed.includes('://')) {
    return trimmed.toLowerCase();
  }

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'buymeacoffee.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    const slug = parts[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return slug.length >= 2 ? slug : null;
  } catch {
    return null;
  }
}

function getTokenSub(): string | null {
  const token = getBuyMeACoffeeToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

async function fetchBmcCreatorApiEndpoints(token: string): Promise<{
  supporters: BuyMeACoffeeSupporter[];
  totalSupporters: number | null;
  extrasCount: number;
  subscriptionsCount: number;
  creatorSlugHint: string | null;
} | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'iveo-server/1.0',
  };

  try {
    const [suppRes, extrasRes, subsRes] = await Promise.allSettled([
      fetch('https://developers.buymeacoffee.com/api/v1/supporters', {
        headers,
        signal: AbortSignal.timeout(4500),
      }),
      fetch('https://developers.buymeacoffee.com/api/v1/extras', {
        headers,
        signal: AbortSignal.timeout(4500),
      }),
      fetch('https://developers.buymeacoffee.com/api/v1/subscriptions', {
        headers,
        signal: AbortSignal.timeout(4500),
      }),
    ]);

    let supporters: BuyMeACoffeeSupporter[] = [];
    let totalSupporters: number | null = null;
    let creatorSlugHint: string | null = null;

    if (suppRes.status === 'fulfilled' && suppRes.value.ok) {
      const json: any = await suppRes.value.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];
      totalSupporters = typeof json?.total === 'number' ? json.total : list.length;
      supporters = list.slice(0, 6).map((item: any, idx: number) => ({
        id: String(item.support_id || item.id || idx),
        name: String(item.supporter_name || item.payer_name || 'Supporter').slice(0, 48),
        coffees: Number(item.support_coffees || 1),
        amount: String(item.support_coffee_price || '5'),
        currency: String(item.support_currency || 'USD'),
        message: item.support_note ? String(item.support_note).slice(0, 140) : null,
        createdAt: item.support_created_on || null,
      }));
      if (list[0]?.referer && typeof list[0].referer === 'string') {
        const s = extractBmcSlug(list[0].referer);
        if (s) creatorSlugHint = s;
      }
    }

    let extrasCount = 0;
    if (extrasRes.status === 'fulfilled' && extrasRes.value.ok) {
      const json: any = await extrasRes.value.json().catch(() => null);
      extrasCount = typeof json?.total === 'number'
        ? json.total
        : Array.isArray(json?.data)
        ? json.data.length
        : 0;
    }

    let subscriptionsCount = 0;
    if (subsRes.status === 'fulfilled' && subsRes.value.ok) {
      const json: any = await subsRes.value.json().catch(() => null);
      subscriptionsCount = typeof json?.total === 'number'
        ? json.total
        : Array.isArray(json?.data)
        ? json.data.length
        : 0;
    }

    return {
      supporters,
      totalSupporters,
      extrasCount,
      subscriptionsCount,
      creatorSlugHint,
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m?.[1] ? decodeHtmlEntities(m[1]) : null;
}

async function fetchPublicBmcPageMeta(slug: string): Promise<{
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coffeePrice: string | null;
  supportersLabel: string | null;
  pageOwnerId: string | null;
}> {
  try {
    const res = await fetch(`https://buymeacoffee.com/${encodeURIComponent(slug)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; iveo-preview/1.0; +https://iveo.site)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return {
        displayName: null,
        bio: null,
        avatarUrl: null,
        coffeePrice: null,
        supportersLabel: null,
        pageOwnerId: null,
      };
    }

    const html = await res.text();
    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDesc = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description');
    const ogImage = extractMetaContent(html, 'og:image');

    let displayName: string | null = ogTitle
      ? ogTitle.replace(/\s*(?:is|on)?\s*Buy Me a Coffee.*$/i, '').replace(/^[☕\s]+/, '').trim()
      : null;
    if (!displayName) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match?.[1]) {
        displayName = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, '')).trim();
      }
    }

    const idMatch =
      html.match(/"user_id"\s*:\s*"?(\d+)"?/i) ||
      html.match(/"creator_id"\s*:\s*"?(\d+)"?/i);
    const pageOwnerId = idMatch?.[1] || null;

    const suppCountMatch = html.match(/(\d[\d,]*)\s+supporters?/i);
    const supportersLabel = suppCountMatch ? `${suppCountMatch[1]} supporters` : null;

    const priceMatch = html.match(/([$€£₹]\s?\d+(?:\.\d{1,2})?)\s*(?:\/\s*coffee|per\s*coffee|each)?/i);
    const coffeePrice = priceMatch?.[1] || '$5';

    return {
      displayName: displayName || slug,
      bio: ogDesc ? ogDesc.slice(0, 180) : null,
      avatarUrl: ogImage && /^https?:\/\//i.test(ogImage) ? ogImage : null,
      coffeePrice,
      supportersLabel,
      pageOwnerId,
    };
  } catch {
    return {
      displayName: null,
      bio: null,
      avatarUrl: null,
      coffeePrice: null,
      supportersLabel: null,
      pageOwnerId: null,
    };
  }
}

export async function fetchBuyMeACoffeeProfile(rawInput: string): Promise<BuyMeACoffeeProfileData | null> {
  const slug = extractBmcSlug(rawInput);
  if (!slug) return null;

  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const token = getBuyMeACoffeeToken();
  const tokenSub = getTokenSub();

  const [publicMeta, creatorApiData] = await Promise.all([
    fetchPublicBmcPageMeta(slug),
    token ? fetchBmcCreatorApiEndpoints(token) : Promise.resolve(null),
  ]);

  const ownerMatched =
    Boolean(creatorApiData) &&
    Boolean(tokenSub) &&
    (!publicMeta.pageOwnerId || publicMeta.pageOwnerId === tokenSub || creatorApiData?.creatorSlugHint === slug);

  const profileData: BuyMeACoffeeProfileData = {
    slug,
    url: `https://buymeacoffee.com/${slug}`,
    displayName: publicMeta.displayName || slug,
    bio: publicMeta.bio || 'Support my creative work with a coffee.',
    avatarUrl: publicMeta.avatarUrl,
    coffeePrice: publicMeta.coffeePrice || '$5',
    supporterCount: ownerMatched ? (creatorApiData?.totalSupporters ?? null) : null,
    supportersLabel:
      ownerMatched && creatorApiData?.totalSupporters !== null && creatorApiData?.totalSupporters !== undefined
        ? `${creatorApiData.totalSupporters} supporter${creatorApiData.totalSupporters === 1 ? '' : 's'}`
        : publicMeta.supportersLabel,
    recentSupporters: ownerMatched ? (creatorApiData?.supporters || []) : [],
    extrasCount: ownerMatched ? (creatorApiData?.extrasCount || 0) : 0,
    subscriptionsCount: ownerMatched ? (creatorApiData?.subscriptionsCount || 0) : 0,
    isConnectedCreator: ownerMatched,
    source: ownerMatched ? 'creator_api' : publicMeta.displayName ? 'public_page' : 'fallback',
  };

  cache.set(slug, { data: profileData, expiresAt: Date.now() + CACHE_TTL_MS });
  return profileData;
}

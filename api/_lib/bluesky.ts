import {
  type BlueskyFacet,
  buildBlueskyPostWebUrl,
  isSafeHttpUrl,
  parseBlueskyPostInput,
  validateBlueskyActor,
} from '../../src/lib/blueskyFacets.ts';

// Strictly pinned upstream AppView host — prevents SSRF via user-supplied hostnames
const BSKY_APPVIEW_BASE = 'https://public.api.bsky.app/xrpc';

const PROFILE_TTL_MS = 15 * 60_000;
const FEED_TTL_MS = 5 * 60_000;
const POST_TTL_MS = 10 * 60_000;
const STALE_MAX_AGE_MS = 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const RATE_LIMIT_MAX_PER_MIN = 60;

export const ALLOWED_FEED_FILTERS = new Set([
  'posts_no_replies',
  'posts_with_replies',
  'posts_with_media',
  'posts_and_author_threads',
]);

export type BlueskyContentWarningLabel = 'porn' | 'sexual' | 'nudity' | 'graphic-media' | 'cw';

export interface NormalizedBlueskyProfile {
  handle: string;
  did: string;
  displayName: string;
  avatar: string | null;
  banner: string | null;
  description: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  labels: string[];
  stale?: boolean;
}

export interface NormalizedBlueskyImage {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number } | null;
}

export interface NormalizedBlueskyExternalEmbed {
  uri: string;
  title: string;
  description: string;
  thumb: string | null;
}

export interface NormalizedBlueskyQuotePost {
  uri: string;
  webUrl: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  text: string;
  createdAt: string;
}

export interface NormalizedBlueskyPost {
  uri: string;
  webUrl: string;
  text: string;
  facets: BlueskyFacet[];
  createdAt: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  isRepost?: boolean;
  repostedBy?: string | null;
  isReply?: boolean;
  author: {
    handle: string;
    did: string;
    displayName: string;
    avatar: string | null;
  };
  embed?: {
    images?: NormalizedBlueskyImage[];
    external?: NormalizedBlueskyExternalEmbed | null;
    quote?: NormalizedBlueskyQuotePost | null;
  } | null;
  labels: string[];
  hasMediaWarning: boolean;
}

export interface NormalizedBlueskyFeedResult {
  actor: string;
  posts: NormalizedBlueskyPost[];
  stale?: boolean;
}

export interface NormalizedBlueskySinglePostResult {
  post: NormalizedBlueskyPost;
  stale?: boolean;
}

export class BlueskyProxyError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface CacheEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const ipRateWindows = new Map<string, { windowStart: number; count: number }>();

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
let customFetch: FetchLike | null = null;

export function __setBlueskyFetchForTest(fn: FetchLike | null): void {
  customFetch = fn;
}

export function __clearBlueskyStateForTest(): void {
  cache.clear();
  inFlight.clear();
  ipRateWindows.clear();
}

export function checkBlueskyRateLimit(
  ipKey: string,
  nowMs = Date.now(),
  maxPerMin = RATE_LIMIT_MAX_PER_MIN
): { allowed: boolean; retryAfterSec?: number } {
  const key = (ipKey || 'anon').trim();
  const prev = ipRateWindows.get(key);
  if (!prev || nowMs - prev.windowStart >= 60_000) {
    ipRateWindows.set(key, { windowStart: nowMs, count: 1 });
    // Prune stale buckets if map grows large
    if (ipRateWindows.size > 2000) {
      for (const [k, v] of ipRateWindows.entries()) {
        if (nowMs - v.windowStart >= 60_000) ipRateWindows.delete(k);
      }
    }
    return { allowed: true };
  }
  if (prev.count >= maxPerMin) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((prev.windowStart + 60_000 - nowMs) / 1000)),
    };
  }
  prev.count += 1;
  return { allowed: true };
}

function logUpstreamError(endpoint: string, status: number): void {
  // Structured error logging with NO PII or query tokens
  console.warn(`[bluesky] upstream error status=${status} endpoint=${endpoint}`);
}

async function fetchBskyJson(endpoint: string, params: URLSearchParams): Promise<any> {
  const url = `${BSKY_APPVIEW_BASE}/${endpoint}?${params.toString()}`;
  const doFetch = customFetch || fetch;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'iveo-bluesky-proxy/1.0',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.status === 404 || res.status === 400) {
        const body = await res.json().catch(() => ({}));
        const msg = String(body?.message || '');
        if (/suspended|taken down|deactivated/i.test(msg)) {
          throw new BlueskyProxyError(403, 'profile_private', "This profile isn't public");
        }
        throw new BlueskyProxyError(404, 'not_found', "We couldn't find that Bluesky account");
      }

      if (res.status === 429 || res.status >= 500) {
        logUpstreamError(endpoint, res.status);
        lastErr = new BlueskyProxyError(
          res.status === 429 ? 429 : 502,
          'upstream_unavailable',
          'Bluesky is slow right now, try again'
        );
        if (attempt === 0 && res.status >= 500) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        logUpstreamError(endpoint, res.status);
        throw new BlueskyProxyError(502, 'upstream_error', 'Bluesky is slow right now, try again');
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof BlueskyProxyError) {
        if (err.status < 500 || attempt === 1) throw err;
        lastErr = err;
      } else {
        logUpstreamError(endpoint, 0);
        lastErr = new BlueskyProxyError(
          504,
          'upstream_timeout',
          'Bluesky is slow right now, try again'
        );
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
      }
    }
  }

  throw lastErr || new BlueskyProxyError(502, 'upstream_error', 'Bluesky is slow right now, try again');
}

function extractLabels(rawLabels: unknown): string[] {
  if (!Array.isArray(rawLabels)) return [];
  return rawLabels
    .map((l: any) => (typeof l?.val === 'string' ? l.val.toLowerCase().trim() : ''))
    .filter(Boolean);
}

function hasNoUnauthenticatedLabel(labels: string[]): boolean {
  return labels.includes('!no-unauthenticated');
}

function hasAdultOrWarningLabel(labels: string[]): boolean {
  return labels.some((l) =>
    ['porn', 'sexual', 'nudity', 'graphic-media', 'nsfw'].includes(l)
  );
}

function safeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !isSafeHttpUrl(raw)) return null;
  return raw.trim();
}

function normalizeEmbed(rawEmbed: any): NormalizedBlueskyPost['embed'] {
  if (!rawEmbed || typeof rawEmbed !== 'object') return null;

  let imagesSource = rawEmbed?.images;
  let externalSource = rawEmbed?.external;
  let recordSource = rawEmbed?.record;

  // Handle recordWithMedia (quote + images or link card)
  if (rawEmbed?.$type === 'app.bsky.embed.recordWithMedia#view' && rawEmbed?.media) {
    imagesSource = rawEmbed.media.images || imagesSource;
    externalSource = rawEmbed.media.external || externalSource;
  }

  const images: NormalizedBlueskyImage[] = Array.isArray(imagesSource)
    ? imagesSource
        .map((img: any): NormalizedBlueskyImage | null => {
          const thumb = safeImageUrl(img?.thumb);
          const fullsize = safeImageUrl(img?.fullsize) || thumb;
          if (!thumb || !fullsize) return null;
          const ar =
            img?.aspectRatio &&
            typeof img.aspectRatio.width === 'number' &&
            typeof img.aspectRatio.height === 'number' &&
            img.aspectRatio.width > 0 &&
            img.aspectRatio.height > 0
              ? { width: img.aspectRatio.width, height: img.aspectRatio.height }
              : null;
          return {
            thumb,
            fullsize,
            alt: typeof img?.alt === 'string' ? img.alt.slice(0, 500) : '',
            aspectRatio: ar,
          };
        })
        .filter((x: NormalizedBlueskyImage | null): x is NormalizedBlueskyImage => x !== null)
    : [];

  let external: NormalizedBlueskyExternalEmbed | null = null;
  if (externalSource && typeof externalSource.uri === 'string' && isSafeHttpUrl(externalSource.uri)) {
    external = {
      uri: externalSource.uri.trim(),
      title: typeof externalSource.title === 'string' ? externalSource.title.slice(0, 240) : '',
      description:
        typeof externalSource.description === 'string'
          ? externalSource.description.slice(0, 320)
          : '',
      thumb: safeImageUrl(externalSource.thumb),
    };
  }

  let quote: NormalizedBlueskyQuotePost | null = null;
  const quotedRecord = recordSource?.$type === 'app.bsky.embed.record#viewRecord'
    ? recordSource
    : recordSource?.record?.$type === 'app.bsky.embed.record#viewRecord'
      ? recordSource.record
      : null;

  if (quotedRecord && typeof quotedRecord.uri === 'string') {
    const qLabels = [
      ...extractLabels(quotedRecord.labels),
      ...extractLabels(quotedRecord.author?.labels),
    ];
    if (!hasNoUnauthenticatedLabel(qLabels)) {
      const qAuthorHandle = String(quotedRecord.author?.handle || quotedRecord.author?.did || '').trim();
      quote = {
        uri: quotedRecord.uri,
        webUrl: buildBlueskyPostWebUrl(qAuthorHandle, quotedRecord.uri),
        authorHandle: qAuthorHandle,
        authorDisplayName: String(quotedRecord.author?.displayName || qAuthorHandle).slice(0, 120),
        authorAvatar: safeImageUrl(quotedRecord.author?.avatar),
        text: String(quotedRecord.value?.text || '').slice(0, 600),
        createdAt: String(quotedRecord.value?.createdAt || quotedRecord.indexedAt || ''),
      };
    }
  }

  if (images.length === 0 && !external && !quote) return null;
  return {
    ...(images.length > 0 ? { images } : {}),
    ...(external ? { external } : {}),
    ...(quote ? { quote } : {}),
  };
}

function normalizePostView(
  post: any,
  opts?: { isRepost?: boolean; repostedBy?: string | null; isReply?: boolean }
): NormalizedBlueskyPost | null {
  if (!post || typeof post.uri !== 'string' || !post.author) return null;
  const labels = Array.from(
    new Set([...extractLabels(post.labels), ...extractLabels(post.author?.labels)])
  );
  if (hasNoUnauthenticatedLabel(labels)) {
    return null;
  }

  const authorHandle = String(post.author.handle || post.author.did || '').trim();
  const authorDid = String(post.author.did || '').trim();
  const record = post.record || {};
  const facets: BlueskyFacet[] = Array.isArray(record.facets) ? record.facets : [];

  return {
    uri: post.uri,
    webUrl: buildBlueskyPostWebUrl(authorHandle || authorDid, post.uri),
    text: String(record.text || ''),
    facets,
    createdAt: String(record.createdAt || post.indexedAt || ''),
    likeCount: Number(post.likeCount || 0),
    replyCount: Number(post.replyCount || 0),
    repostCount: Number(post.repostCount || 0),
    isRepost: Boolean(opts?.isRepost),
    repostedBy: opts?.repostedBy || null,
    isReply: Boolean(opts?.isReply || record.reply),
    author: {
      handle: authorHandle,
      did: authorDid,
      displayName: String(post.author.displayName || authorHandle || 'Bluesky user'),
      avatar: safeImageUrl(post.author.avatar),
    },
    embed: normalizeEmbed(post.embed),
    labels,
    hasMediaWarning: hasAdultOrWarningLabel(labels),
  };
}

async function withCoalescedCache<T extends Record<string, any>>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(cacheKey) as CacheEntry<T> | undefined;
  if (existing && now < existing.freshUntil) {
    return existing.value;
  }

  const pending = inFlight.get(cacheKey) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const value = await loader();
      cache.set(cacheKey, {
        value,
        freshUntil: Date.now() + ttlMs,
        staleUntil: Date.now() + STALE_MAX_AGE_MS,
      });
      return value;
    } catch (err) {
      if (
        existing &&
        Date.now() < existing.staleUntil &&
        err instanceof BlueskyProxyError &&
        (err.status === 429 || err.status >= 500)
      ) {
        return { ...existing.value, stale: true };
      }
      throw err;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

export async function getBlueskyProfile(actorInput: string): Promise<NormalizedBlueskyProfile> {
  const check = validateBlueskyActor(actorInput);
  if (!check.valid) {
    throw new BlueskyProxyError(400, 'invalid_actor', 'Enter a valid Bluesky handle or DID.');
  }

  const actor = check.normalized;
  return withCoalescedCache<NormalizedBlueskyProfile>(`profile:${actor}`, PROFILE_TTL_MS, async () => {
    const raw = await fetchBskyJson(
      'app.bsky.actor.getProfile',
      new URLSearchParams({ actor })
    );
    const labels = extractLabels(raw?.labels);
    if (hasNoUnauthenticatedLabel(labels)) {
      throw new BlueskyProxyError(403, 'profile_private', "This profile isn't public");
    }
    return {
      handle: String(raw.handle || actor),
      did: String(raw.did || ''),
      displayName: String(raw.displayName || raw.handle || actor),
      avatar: safeImageUrl(raw.avatar),
      banner: safeImageUrl(raw.banner),
      description: typeof raw.description === 'string' ? raw.description : null,
      followersCount: Number(raw.followersCount || 0),
      followsCount: Number(raw.followsCount || 0),
      postsCount: Number(raw.postsCount || 0),
      labels,
    };
  });
}

export async function getBlueskyFeed(options: {
  actor: string;
  limit?: number;
  filter?: string;
  includeReposts?: boolean;
}): Promise<NormalizedBlueskyFeedResult> {
  const check = validateBlueskyActor(options.actor);
  if (!check.valid) {
    throw new BlueskyProxyError(400, 'invalid_actor', 'Enter a valid Bluesky handle or DID.');
  }
  const actor = check.normalized;
  const rawLimit = Number.isFinite(options.limit) ? Number(options.limit) : 3;
  const clampedLimit = Math.max(1, Math.min(10, Math.round(rawLimit)));
  const filter =
    options.filter && ALLOWED_FEED_FILTERS.has(options.filter)
      ? options.filter
      : 'posts_no_replies';
  const includeReposts = Boolean(options.includeReposts);

  const cacheKey = `feed:${actor}:${clampedLimit}:${filter}:${includeReposts ? '1' : '0'}`;
  return withCoalescedCache<NormalizedBlueskyFeedResult>(cacheKey, FEED_TTL_MS, async () => {
    // Request slightly extra items if reposts are excluded so we can still fill clampedLimit cleanly
    const fetchLimit = includeReposts ? clampedLimit : Math.min(20, clampedLimit * 2);
    const raw = await fetchBskyJson(
      'app.bsky.feed.getAuthorFeed',
      new URLSearchParams({
        actor,
        limit: String(fetchLimit),
        filter,
      })
    );

    const feedItems: any[] = Array.isArray(raw?.feed) ? raw.feed : [];
    const posts: NormalizedBlueskyPost[] = [];

    for (const item of feedItems) {
      const isRepost = item?.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
      if (isRepost && !includeReposts) continue;

      const repostedBy = isRepost
        ? String(item?.reason?.by?.displayName || item?.reason?.by?.handle || '')
        : null;
      const isReply = Boolean(item?.reply || item?.post?.record?.reply);
      const normalized = normalizePostView(item?.post, { isRepost, repostedBy, isReply });
      if (normalized) {
        posts.push(normalized);
        if (posts.length >= clampedLimit) break;
      }
    }

    return { actor, posts };
  });
}

export async function getBlueskySinglePost(rawPostInput: string): Promise<NormalizedBlueskySinglePostResult> {
  const parsed = parseBlueskyPostInput(rawPostInput);
  if (!parsed.valid) {
    throw new BlueskyProxyError(400, 'invalid_post_uri', parsed.reason);
  }

  let canonicalUri = 'uri' in parsed ? parsed.uri : '';
  if (!canonicalUri && 'actor' in parsed) {
    let did = parsed.actor.startsWith('did:') ? parsed.actor : '';
    if (!did) {
      const resolved = await fetchBskyJson(
        'com.atproto.identity.resolveHandle',
        new URLSearchParams({ handle: parsed.actor })
      );
      did = String(resolved?.did || '');
    }
    if (!did) {
      throw new BlueskyProxyError(404, 'not_found', "We couldn't find that Bluesky post");
    }
    canonicalUri = `at://${did}/app.bsky.feed.post/${parsed.rkey}`;
  }

  return withCoalescedCache<NormalizedBlueskySinglePostResult>(
    `post:${canonicalUri}`,
    POST_TTL_MS,
    async () => {
      const raw = await fetchBskyJson(
        'app.bsky.feed.getPosts',
        new URLSearchParams({ uris: canonicalUri })
      );
      const first = Array.isArray(raw?.posts) ? raw.posts[0] : null;
      if (!first) {
        throw new BlueskyProxyError(404, 'not_found', "We couldn't find that Bluesky post");
      }
      const normalized = normalizePostView(first);
      if (!normalized) {
        throw new BlueskyProxyError(403, 'post_private', "This post isn't public");
      }
      return { post: normalized };
    }
  );
}

export interface BlueskyFacetByteSlice {
  byteStart: number;
  byteEnd: number;
}

export type BlueskyFacetFeature =
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
  | { $type: string; [key: string]: unknown };

export interface BlueskyFacet {
  index: BlueskyFacetByteSlice;
  features: BlueskyFacetFeature[];
}

export type BlueskyRichTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'mention'; text: string; did: string; href: string }
  | { kind: 'tag'; text: string; tag: string; href: string };

const DID_RE = /^did:(plc:[a-z2-7]{24}|web:[a-z0-9.-]+)$/;
const HANDLE_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const AT_POST_URI_RE =
  /^at:\/\/(did:(?:plc:[a-z2-7]{24}|web:[a-z0-9.-]+)|(?:[a-z0-9-]+\.)+[a-z]{2,63})\/app\.bsky\.feed\.post\/([a-z0-9]{4,64})$/i;

export function normalizeBlueskyActorInput(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // Handle https://bsky.app/profile/{actor}[/...]
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (host === 'bsky.app' || host === 'www.bsky.app' || host === 'main.bsky.dev') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'profile' && parts[1]) {
          const candidate = decodeURIComponent(parts[1]).replace(/^@+/, '').trim();
          return candidate.startsWith('did:') ? candidate : candidate.toLowerCase();
        }
      }
    } catch {
      return '';
    }
  }

  // Handle bsky.app/profile/... without scheme
  if (/^(?:www\.)?bsky\.app\/profile\//i.test(trimmed)) {
    return normalizeBlueskyActorInput(`https://${trimmed}`);
  }

  const noAt = trimmed.replace(/^@+/, '').trim();
  if (!noAt) return '';
  if (noAt.startsWith('did:')) {
    return noAt;
  }
  return noAt.toLowerCase();
}

export function validateBlueskyActor(actor: string): {
  valid: boolean;
  kind: 'did' | 'handle' | null;
  normalized: string;
} {
  const normalized = normalizeBlueskyActorInput(actor);
  if (!normalized || /\s/.test(normalized) || normalized.length > 253) {
    return { valid: false, kind: null, normalized };
  }
  if (DID_RE.test(normalized)) {
    return { valid: true, kind: 'did', normalized };
  }
  if (HANDLE_RE.test(normalized)) {
    return { valid: true, kind: 'handle', normalized };
  }
  return { valid: false, kind: null, normalized };
}

export type ParsedBlueskyPostRef =
  | { valid: true; uri: string }
  | { valid: true; actor: string; rkey: string }
  | { valid: false; reason: string };

export function parseBlueskyPostInput(raw: string): ParsedBlueskyPostRef {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'Empty post reference' };
  }

  const atMatch = trimmed.match(AT_POST_URI_RE);
  if (atMatch) {
    const actor = atMatch[1].startsWith('did:') ? atMatch[1] : atMatch[1].toLowerCase();
    const rkey = atMatch[2];
    return { valid: true, uri: `at://${actor}/app.bsky.feed.post/${rkey}` };
  }

  let maybeUrl = trimmed;
  if (/^(?:www\.)?bsky\.app\/profile\//i.test(maybeUrl)) {
    maybeUrl = `https://${maybeUrl}`;
  }

  if (/^https?:\/\//i.test(maybeUrl)) {
    try {
      const parsed = new URL(maybeUrl);
      const host = parsed.hostname.toLowerCase();
      if (host === 'bsky.app' || host === 'www.bsky.app' || host === 'main.bsky.dev') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'profile' && parts[1] && parts[2] === 'post' && parts[3]) {
          const actorRaw = decodeURIComponent(parts[1]).replace(/^@+/, '').trim();
          const actorCheck = validateBlueskyActor(actorRaw);
          const rkey = parts[3].replace(/[^a-zA-Z0-9._-]/g, '');
          if (actorCheck.valid && rkey.length >= 4 && rkey.length <= 64) {
            return { valid: true, actor: actorCheck.normalized, rkey };
          }
        }
      }
    } catch {
      return { valid: false, reason: 'Invalid Bluesky post URL' };
    }
  }

  return { valid: false, reason: 'Paste a bsky.app post link or at:// URI' };
}

export function buildBlueskyPostWebUrl(handleOrDid: string, atUri: string): string {
  const cleanActor = (handleOrDid || '').replace(/^@+/, '').trim();
  const rkey = (atUri || '').split('/').filter(Boolean).pop() || '';
  if (!cleanActor || !rkey) {
    return cleanActor ? `https://bsky.app/profile/${encodeURIComponent(cleanActor)}` : 'https://bsky.app';
  }
  return `https://bsky.app/profile/${encodeURIComponent(cleanActor)}/post/${encodeURIComponent(rkey)}`;
}

export function isSafeHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

/**
 * Slices Bluesky post text using UTF-8 byte offsets (facet.index.byteStart / byteEnd),
 * preserving multi-byte characters/emojis, safely escaping plain text on render,
 * and ignoring overlapping or invalid byte slices without throwing.
 */
export function sliceBlueskyTextByFacets(
  text: string,
  facets?: BlueskyFacet[] | null
): BlueskyRichTextSegment[] {
  if (!text) return [];
  if (!Array.isArray(facets) || facets.length === 0) {
    return [{ kind: 'text', text }];
  }

  const bytes = utf8Encoder.encode(text);
  const totalBytes = bytes.byteLength;

  const sorted = [...facets]
    .filter(
      (f) =>
        f &&
        f.index &&
        typeof f.index.byteStart === 'number' &&
        typeof f.index.byteEnd === 'number' &&
        Number.isFinite(f.index.byteStart) &&
        Number.isFinite(f.index.byteEnd) &&
        Array.isArray(f.features) &&
        f.features.length > 0
    )
    .sort((a, b) => a.index.byteStart - b.index.byteStart);

  const segments: BlueskyRichTextSegment[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    const start = Math.max(0, Math.min(totalBytes, Math.floor(facet.index.byteStart)));
    const end = Math.max(start, Math.min(totalBytes, Math.floor(facet.index.byteEnd)));

    // Skip invalid, empty, or overlapping facets
    if (start < cursor || end <= start) continue;

    if (start > cursor) {
      const plain = utf8Decoder.decode(bytes.subarray(cursor, start));
      if (plain) segments.push({ kind: 'text', text: plain });
    }

    const sliceText = utf8Decoder.decode(bytes.subarray(start, end));
    const linkFeat = facet.features.find((f) => f?.$type === 'app.bsky.richtext.facet#link') as
      | { uri?: unknown }
      | undefined;
    const mentionFeat = facet.features.find((f) => f?.$type === 'app.bsky.richtext.facet#mention') as
      | { did?: unknown }
      | undefined;
    const tagFeat = facet.features.find((f) => f?.$type === 'app.bsky.richtext.facet#tag') as
      | { tag?: unknown }
      | undefined;

    if (linkFeat && typeof linkFeat.uri === 'string' && isSafeHttpUrl(linkFeat.uri)) {
      segments.push({ kind: 'link', text: sliceText, href: linkFeat.uri });
    } else if (mentionFeat && typeof mentionFeat.did === 'string' && DID_RE.test(mentionFeat.did)) {
      segments.push({
        kind: 'mention',
        text: sliceText,
        did: mentionFeat.did,
        href: `https://bsky.app/profile/${encodeURIComponent(mentionFeat.did)}`,
      });
    } else if (tagFeat && typeof tagFeat.tag === 'string' && tagFeat.tag.trim().length > 0) {
      const cleanTag = tagFeat.tag.trim().replace(/^#+/, '');
      segments.push({
        kind: 'tag',
        text: sliceText,
        tag: cleanTag,
        href: `https://bsky.app/hashtag/${encodeURIComponent(cleanTag)}`,
      });
    } else if (sliceText) {
      segments.push({ kind: 'text', text: sliceText });
    }

    cursor = end;
  }

  if (cursor < totalBytes) {
    const tail = utf8Decoder.decode(bytes.subarray(cursor));
    if (tail) segments.push({ kind: 'text', text: tail });
  }

  return segments;
}

export function formatBlueskyRelativeTime(isoDate: string | null | undefined, nowMs = Date.now()): string {
  if (!isoDate) return '';
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(ts));
  } catch {
    return `${diffDay}d`;
  }
}

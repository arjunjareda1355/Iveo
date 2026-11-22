/**
 * Section 8.7 Deterministic Seeded PRNG & Seen-Ring History Helpers.
 * mulberry32(seed); seed = hash32(pageId + bgSignature + vibeId + refreshCount).
 */

export function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(rng: () => number, list: readonly T[]): T {
  const idx = Math.min(list.length - 1, Math.floor(rng() * list.length));
  return list[idx];
}

export function buildSuggestionSeed(params: {
  pageId?: string | null;
  bgSignature: string;
  vibeId: string;
  refreshCount: number;
}): number {
  const key = `${params.pageId || 'anon'}|${params.bgSignature}|${params.vibeId}|${params.refreshCount}`;
  return hash32(key);
}

const SEEN_STORAGE_PREFIX = 'iveo_seen_ideas_';
const MAX_SEEN_RING = 40;

export function readSeenRing(engineKey: 'buttons' | 'fonts' | 'layout'): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(`${SEEN_STORAGE_PREFIX}${engineKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(-MAX_SEEN_RING)
      : [];
  } catch {
    return [];
  }
}

export function appendSeenRing(
  engineKey: 'buttons' | 'fonts' | 'layout',
  signatures: readonly string[]
): string[] {
  const existing = readSeenRing(engineKey);
  const next = [...existing];
  for (const sig of signatures) {
    if (!next.includes(sig)) {
      next.push(sig);
    }
  }
  const trimmed = next.slice(-MAX_SEEN_RING);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(`${SEEN_STORAGE_PREFIX}${engineKey}`, JSON.stringify(trimmed));
    } catch {}
  }
  return trimmed;
}

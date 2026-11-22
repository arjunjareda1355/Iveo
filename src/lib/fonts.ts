import {
  CATALOG_FONTS,
  findCatalogFont,
  type CatalogFont,
  type FontCategoryV2,
} from './appearance/catalog/fonts.ts';

export type FontCategory = 'sans' | 'serif' | 'display' | 'mono' | 'script' | 'rounded';
export type FontTarget = 'name' | 'bio' | 'button';
export type FontId = string;

export interface FontOption {
  id: string;
  name: string;
  category: FontCategory;
  subCategory: string;
  cssFamily: string;
  googleSpec: string | null;
  sampleText: string;
  isPro: boolean;
  moods: readonly string[];
  roles: readonly ('N' | 'B' | 'T')[];
  weights: readonly number[];
  xHeight: number;
  width: 'condensed' | 'normal' | 'wide';
  legibility: number;
  excludeFromBio?: boolean;
}

export interface FontSettings {
  nameFont?: string | null;
  bioFont?: string | null;
  buttonFont?: string | null;
}

function toFontOption(f: CatalogFont): FontOption {
  return {
    id: f.id,
    name: f.family,
    category: f.category as FontCategoryV2,
    subCategory: f.subCategory,
    cssFamily: f.cssFamily,
    googleSpec: f.googleSpec,
    sampleText: f.moods.slice(0, 2).join(' · '),
    isPro: f.tier === 'pro',
    moods: f.moods,
    roles: f.roles,
    weights: f.weights,
    xHeight: f.xHeight,
    width: f.width,
    legibility: f.legibility,
    excludeFromBio: f.excludeFromBio,
  };
}

export const FONT_OPTIONS: readonly FontOption[] = CATALOG_FONTS.map(toFontOption);

const FONT_MAP = new Map<string, FontOption>();
for (const opt of FONT_OPTIONS) {
  FONT_MAP.set(opt.id.toLowerCase(), opt);
  FONT_MAP.set(opt.name.toLowerCase(), opt);
}

export function getFontOption(fontId?: string | null): FontOption | null {
  if (!fontId || typeof fontId !== 'string') return null;
  const clean = fontId.trim().toLowerCase();
  if (!clean) return null;
  const hit = FONT_MAP.get(clean);
  if (hit) return hit;
  const cat = findCatalogFont(clean);
  return cat ? toFontOption(cat) : null;
}

export function canUseFont(fontId: string | null | undefined, isPro: boolean): boolean {
  if (!fontId) return true;
  const opt = getFontOption(fontId);
  if (!opt) return true;
  return !opt.isPro || isPro;
}

export function getFontCssFamily(
  fontId: string | null | undefined,
  fallbackCssFamily: string = "'Inter', ui-sans-serif, system-ui, sans-serif"
): string {
  const opt = getFontOption(fontId);
  return opt ? opt.cssFamily : fallbackCssFamily;
}

/**
 * Resolves a literal font-family stack safe for Canvas 2D ctx.font (never CSS var(...)).
 */
export function getCanvasFontName(
  fontId: string | null | undefined,
  fallbackCssFamily: string = 'Inter, system-ui, sans-serif'
): string {
  const opt = getFontOption(fontId);
  const raw = opt ? opt.cssFamily : fallbackCssFamily;
  const cleaned = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('var('))
    .join(', ');
  return cleaned || 'Inter, system-ui, sans-serif';
}

export async function ensureCanvasFontLoaded(
  fontId: string | null | undefined,
  fallbackCssFamily: string = 'Inter, system-ui, sans-serif'
): Promise<string> {
  if (fontId) {
    loadGoogleFonts([fontId]);
  }
  const familyStack = getCanvasFontName(fontId, fallbackCssFamily);
  if (typeof document === 'undefined' || !document.fonts) {
    return familyStack;
  }

  try {
    const primaryFace = familyStack.split(',')[0]?.trim() || 'Inter';
    await Promise.race([
      Promise.allSettled([
        document.fonts.load(`400 16px ${primaryFace}`),
        document.fonts.load(`500 16px ${primaryFace}`),
        document.fonts.load(`600 16px ${primaryFace}`),
        document.fonts.load(`700 16px ${primaryFace}`),
        document.fonts.ready,
      ]),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {}

  return familyStack;
}

export function parseFontSettings(raw: unknown): FontSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const nameFont =
    typeof r.nameFont === 'string' && getFontOption(r.nameFont)
      ? getFontOption(r.nameFont)!.id
      : null;
  const bioFont =
    typeof r.bioFont === 'string' && getFontOption(r.bioFont)
      ? getFontOption(r.bioFont)!.id
      : null;
  const buttonFont =
    typeof r.buttonFont === 'string' && getFontOption(r.buttonFont)
      ? getFontOption(r.buttonFont)!.id
      : null;

  if (!nameFont && !bioFont && !buttonFont) return null;
  return { nameFont, bioFont, buttonFont };
}

export function buildGoogleFontsStylesheetUrl(fontIds: (string | null | undefined)[]): string | null {
  const specs = new Set<string>();
  for (const id of fontIds) {
    const opt = getFontOption(id);
    if (opt?.googleSpec) {
      specs.add(`family=${opt.googleSpec}`);
    }
  }
  if (specs.size === 0) return null;
  return `https://fonts.googleapis.com/css2?${Array.from(specs).join('&')}&subset=latin,latin-ext&display=swap`;
}

const loadedFontIds = new Set<string>();
const pendingQueue: string[] = [];
const inFlightUrls = new Set<string>();
const MAX_CONCURRENT_FONT_LINKS = 12;

/**
 * Injects/updates <link id="iveo-dynamic-fonts"> for active fonts in use (<=3 per page).
 */
export function loadGoogleFonts(fontIds: (string | null | undefined)[]): void {
  if (typeof document === 'undefined') return;

  let changed = false;
  for (const id of fontIds) {
    const opt = getFontOption(id);
    if (opt && !loadedFontIds.has(opt.id)) {
      loadedFontIds.add(opt.id);
      changed = true;
    }
  }
  if (!changed) return;

  const href = buildGoogleFontsStylesheetUrl(Array.from(loadedFontIds));
  if (!href) return;

  let link = document.getElementById('iveo-dynamic-fonts') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'iveo-dynamic-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }
}

/**
 * Throttled lazy loader for visible catalogue rows (Section 9.4: max 12 in flight).
 */
export function requestLazyCatalogFont(fontId: string): void {
  if (typeof document === 'undefined') return;
  const opt = getFontOption(fontId);
  if (!opt || !opt.googleSpec || loadedFontIds.has(opt.id) || pendingQueue.includes(opt.id)) {
    return;
  }

  pendingQueue.push(opt.id);
  flushLazyFontQueue();
}

function flushLazyFontQueue(): void {
  if (typeof document === 'undefined') return;
  while (inFlightUrls.size < MAX_CONCURRENT_FONT_LINKS && pendingQueue.length > 0) {
    const batch = pendingQueue.splice(0, 6);
    const idsToLoad: string[] = [];
    for (const id of batch) {
      if (!loadedFontIds.has(id)) {
        loadedFontIds.add(id);
        idsToLoad.push(id);
      }
    }
    if (idsToLoad.length === 0) continue;
    const href = buildGoogleFontsStylesheetUrl(idsToLoad);
    if (!href) continue;

    inFlightUrls.add(href);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => {
      inFlightUrls.delete(href);
      flushLazyFontQueue();
    };
    link.onerror = () => {
      inFlightUrls.delete(href);
      flushLazyFontQueue();
    };
    document.head.appendChild(link);
  }
}

export function loadAllCatalogFonts(): void {
  loadGoogleFonts(FONT_OPTIONS.slice(0, 12).map((f) => f.id));
}

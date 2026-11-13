export type FontCategory = 'sans' | 'serif' | 'display' | 'mono' | 'script';
export type FontTarget = 'name' | 'bio' | 'button';
export type FontId = string;

export interface FontOption {
  id: string;
  name: string;
  category: FontCategory;
  cssFamily: string;
  googleSpec: string | null; // Google Fonts family parameter, null if built-in/Vibe default
  sampleText: string;
  isPro: boolean;
}

export interface FontSettings {
  nameFont?: string | null;
  bioFont?: string | null;
  buttonFont?: string | null;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  // ── Free Curated Fonts ──────────────────────────────────────────────────────
  {
    id: 'inter',
    name: 'Inter',
    category: 'sans',
    cssFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Inter:wght@400;500;600;700',
    sampleText: 'Clean & sharp',
    isPro: false,
  },
  {
    id: 'geist',
    name: 'Geist',
    category: 'sans',
    cssFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Geist:wght@400;500;600;700',
    sampleText: 'Modern product sans',
    isPro: false,
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    category: 'sans',
    cssFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'DM+Sans:wght@400;500;600;700',
    sampleText: 'Warm & approachable',
    isPro: false,
  },
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'sans',
    cssFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Plus+Jakarta+Sans:wght@400;500;600;700',
    sampleText: 'Studio geometric',
    isPro: false,
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    category: 'display',
    cssFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Space+Grotesk:wght@400;500;600;700',
    sampleText: 'Distinctive tech',
    isPro: false,
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    category: 'serif',
    cssFamily: "'Merriweather', Georgia, serif",
    googleSpec: 'Merriweather:wght@400;700',
    sampleText: 'Classic editorial',
    isPro: false,
  },
  {
    id: 'geist-mono',
    name: 'Geist Mono',
    category: 'mono',
    cssFamily: "'Geist Mono', ui-monospace, monospace",
    googleSpec: 'Geist+Mono:wght@400;500;600;700',
    sampleText: 'Minimal monospace',
    isPro: false,
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'mono',
    cssFamily: "'JetBrains Mono', ui-monospace, monospace",
    googleSpec: 'JetBrains+Mono:wght@400;500;600;700',
    sampleText: 'Developer crisp',
    isPro: false,
  },

  // ── Pro Designer Fonts ──────────────────────────────────────────────────────
  {
    id: 'fraunces',
    name: 'Fraunces',
    category: 'serif',
    cssFamily: "'Fraunces', Georgia, serif",
    googleSpec: 'Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700',
    sampleText: 'Soft ink serif',
    isPro: true,
  },
  {
    id: 'instrument-serif',
    name: 'Instrument Serif',
    category: 'serif',
    cssFamily: "'Instrument Serif', Georgia, serif",
    googleSpec: 'Instrument+Serif:ital@0;1',
    sampleText: 'Fashion editorial',
    isPro: true,
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    category: 'serif',
    cssFamily: "'Playfair Display', Georgia, serif",
    googleSpec: 'Playfair+Display:wght@400;600;700',
    sampleText: 'Luxury magazine',
    isPro: true,
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    category: 'serif',
    cssFamily: "'Cormorant Garamond', Georgia, serif",
    googleSpec: 'Cormorant+Garamond:wght@500;600;700',
    sampleText: 'Gallery refined',
    isPro: true,
  },
  {
    id: 'bricolage',
    name: 'Bricolage Grotesque',
    category: 'display',
    cssFamily: "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Bricolage+Grotesque:wght@400;500;600;700',
    sampleText: 'Expressive character',
    isPro: true,
  },
  {
    id: 'outfit',
    name: 'Outfit',
    category: 'sans',
    cssFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Outfit:wght@400;500;600;700',
    sampleText: 'Bold minimalist',
    isPro: true,
  },
  {
    id: 'syne',
    name: 'Syne',
    category: 'display',
    cssFamily: "'Syne', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Syne:wght@500;600;700;800',
    sampleText: 'Art-house wide',
    isPro: true,
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'serif',
    cssFamily: "'Lora', Georgia, serif",
    googleSpec: 'Lora:wght@400;500;600;700',
    sampleText: 'Storyteller serif',
    isPro: true,
  },
  {
    id: 'oswald',
    name: 'Oswald',
    category: 'display',
    cssFamily: "'Oswald', ui-sans-serif, system-ui, sans-serif",
    googleSpec: 'Oswald:wght@400;500;600;700',
    sampleText: 'Condensed impact',
    isPro: true,
  },
  {
    id: 'caveat',
    name: 'Caveat',
    category: 'script',
    cssFamily: "'Caveat', cursive",
    googleSpec: 'Caveat:wght@500;600;700',
    sampleText: 'Handwritten note',
    isPro: true,
  },
  {
    id: 'ibm-plex-mono',
    name: 'IBM Plex Mono',
    category: 'mono',
    cssFamily: "'IBM Plex Mono', ui-monospace, monospace",
    googleSpec: 'IBM+Plex+Mono:wght@400;500;600',
    sampleText: 'Swiss engineering',
    isPro: true,
  },
] as const;

const FONT_MAP = new Map<string, FontOption>(FONT_OPTIONS.map((f) => [f.id, f]));

export function getFontOption(fontId?: string | null): FontOption | null {
  if (!fontId || typeof fontId !== 'string') return null;
  return FONT_MAP.get(fontId.trim().toLowerCase()) || null;
}

export function canUseFont(fontId: string | null | undefined, isPro: boolean): boolean {
  if (!fontId) return true;
  const opt = getFontOption(fontId);
  if (!opt) return true;
  return !opt.isPro || isPro;
}

export function getFontCssFamily(
  fontId: string | null | undefined,
  fallbackCssFamily: string
): string {
  const opt = getFontOption(fontId);
  return opt ? opt.cssFamily : fallbackCssFamily;
}

/**
 * Extracts the primary font name (without quotes or fallback list) for Canvas 2D ctx.font.
 */
export function getCanvasFontName(
  fontId: string | null | undefined,
  fallbackCssFamily: string
): string {
  const css = getFontCssFamily(fontId, fallbackCssFamily);
  return css;
}

export function parseFontSettings(raw: unknown): FontSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const nameFont =
    typeof r.nameFont === 'string' && getFontOption(r.nameFont)
      ? r.nameFont.trim().toLowerCase()
      : null;
  const bioFont =
    typeof r.bioFont === 'string' && getFontOption(r.bioFont)
      ? r.bioFont.trim().toLowerCase()
      : null;
  const buttonFont =
    typeof r.buttonFont === 'string' && getFontOption(r.buttonFont)
      ? r.buttonFont.trim().toLowerCase()
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
  return `https://fonts.googleapis.com/css2?${Array.from(specs).join('&')}&display=swap`;
}

const loadedFontIds = new Set<string>();

/**
 * Dynamically injects/updates a single <link id="iveo-dynamic-fonts"> in document.head
 * for any font IDs passed so visitors and the Dashboard preview render the exact typeface.
 */
export function loadGoogleFonts(fontIds: (string | null | undefined)[]): void {
  if (typeof document === 'undefined') return;

  let changed = false;
  for (const id of fontIds) {
    if (id && getFontOption(id) && !loadedFontIds.has(id)) {
      loadedFontIds.add(id);
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

export function loadAllCatalogFonts(): void {
  loadGoogleFonts(FONT_OPTIONS.map((f) => f.id));
}

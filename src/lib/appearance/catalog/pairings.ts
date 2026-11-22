/**
 * Section 10.4 Curated Font Pairings (18 combinations).
 */

export interface CuratedFontPairing {
  id: string;
  name: string;
  moods: readonly string[];
  nameFont: { family: string; weight: number };
  bioFont: { family: string; weight: number };
  buttonFont: { family: string; weight: number };
}

export const CURATED_FONT_PAIRINGS: readonly CuratedFontPairing[] = [
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    moods: ['calm', 'modern'],
    nameFont: { family: 'Plus Jakarta Sans', weight: 700 },
    bioFont: { family: 'Inter', weight: 400 },
    buttonFont: { family: 'Inter', weight: 500 },
  },
  {
    id: 'tech-grotesk',
    name: 'Tech Grotesk',
    moods: ['techy', 'bold'],
    nameFont: { family: 'Space Grotesk', weight: 700 },
    bioFont: { family: 'DM Sans', weight: 400 },
    buttonFont: { family: 'Space Grotesk', weight: 500 },
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    moods: ['editorial'],
    nameFont: { family: 'Playfair Display', weight: 700 },
    bioFont: { family: 'Lora', weight: 400 },
    buttonFont: { family: 'DM Sans', weight: 500 },
  },
  {
    id: 'bold-display',
    name: 'Bold Display',
    moods: ['bold', 'artsy'],
    nameFont: { family: 'Syne', weight: 800 },
    bioFont: { family: 'Outfit', weight: 400 },
    buttonFont: { family: 'Bricolage Grotesque', weight: 600 },
  },
  {
    id: 'quiet-luxury',
    name: 'Quiet Luxury',
    moods: ['luxury', 'calm'],
    nameFont: { family: 'Cormorant Garamond', weight: 600 },
    bioFont: { family: 'EB Garamond', weight: 400 },
    buttonFont: { family: 'Tenor Sans', weight: 400 },
  },
  {
    id: 'fashion-print',
    name: 'Fashion Print',
    moods: ['luxury', 'editorial'],
    nameFont: { family: 'Bodoni Moda', weight: 700 },
    bioFont: { family: 'Newsreader', weight: 400 },
    buttonFont: { family: 'Inter', weight: 500 },
  },
  {
    id: 'soft-studio',
    name: 'Soft Studio',
    moods: ['warm', 'friendly'],
    nameFont: { family: 'Fraunces', weight: 600 },
    bioFont: { family: 'DM Sans', weight: 400 },
    buttonFont: { family: 'DM Sans', weight: 600 },
  },
  {
    id: 'mono-dev',
    name: 'Mono Dev',
    moods: ['techy'],
    nameFont: { family: 'JetBrains Mono', weight: 700 },
    bioFont: { family: 'Inter', weight: 400 },
    buttonFont: { family: 'JetBrains Mono', weight: 500 },
  },
  {
    id: 'future-wide',
    name: 'Future Wide',
    moods: ['futuristic'],
    nameFont: { family: 'Unbounded', weight: 600 },
    bioFont: { family: 'Inter', weight: 400 },
    buttonFont: { family: 'Sora', weight: 500 },
  },
  {
    id: 'warm-human',
    name: 'Warm Human',
    moods: ['warm', 'friendly'],
    nameFont: { family: 'Young Serif', weight: 400 },
    bioFont: { family: 'Figtree', weight: 400 },
    buttonFont: { family: 'Figtree', weight: 600 },
  },
  {
    id: 'poster-heavy',
    name: 'Poster Heavy',
    moods: ['bold', 'loud'],
    nameFont: { family: 'Anton', weight: 400 },
    bioFont: { family: 'Archivo', weight: 400 },
    buttonFont: { family: 'Archivo', weight: 700 },
  },
  {
    id: 'friendly-round',
    name: 'Friendly Round',
    moods: ['playful'],
    nameFont: { family: 'Fredoka', weight: 600 },
    bioFont: { family: 'Nunito', weight: 400 },
    buttonFont: { family: 'Nunito', weight: 700 },
  },
  {
    id: 'handmade',
    name: 'Handmade',
    moods: ['personal', 'playful'],
    nameFont: { family: 'Caveat', weight: 700 },
    bioFont: { family: 'Lora', weight: 400 },
    buttonFont: { family: 'Quicksand', weight: 600 },
  },
  {
    id: 'classic-press',
    name: 'Classic Press',
    moods: ['editorial', 'classic'],
    nameFont: { family: 'DM Serif Display', weight: 400 },
    bioFont: { family: 'Source Serif 4', weight: 400 },
    buttonFont: { family: 'Inter', weight: 500 },
  },
  {
    id: 'roman-caps',
    name: 'Roman Caps',
    moods: ['luxury', 'ceremonial'],
    nameFont: { family: 'Cinzel', weight: 600 },
    bioFont: { family: 'Libre Caslon Text', weight: 400 },
    buttonFont: { family: 'Tenor Sans', weight: 400 },
  },
  {
    id: 'clean-geometric',
    name: 'Clean Geometric',
    moods: ['modern', 'friendly'],
    nameFont: { family: 'Outfit', weight: 700 },
    bioFont: { family: 'Urbanist', weight: 400 },
    buttonFont: { family: 'Outfit', weight: 600 },
  },
  {
    id: 'retro-arcade',
    name: 'Retro Arcade',
    moods: ['retro', 'playful'],
    nameFont: { family: 'Press Start 2P', weight: 400 },
    bioFont: { family: 'Space Mono', weight: 400 },
    buttonFont: { family: 'Space Mono', weight: 700 },
  },
  {
    id: 'art-gallery',
    name: 'Art Gallery',
    moods: ['editorial', 'calm'],
    nameFont: { family: 'Instrument Serif', weight: 400 },
    bioFont: { family: 'Instrument Sans', weight: 400 },
    buttonFont: { family: 'Instrument Sans', weight: 500 },
  },
] as const;

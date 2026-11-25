// data-fonts.ts: fonts available in the picker + proven trios (name / bio / buttons)
import type { Mood } from './data-palettes.ts';

export type FontCat = 'sans' | 'serif' | 'display' | 'mono' | 'script' | 'rounded';
export interface Font {
  name: string;
  cat: FontCat;
  moods: Mood[];
  displayOnly?: boolean;
}

export const FONTS: Font[] = [
  { name: 'Inter', cat: 'sans', moods: ['minimal', 'business', 'calm'] },
  { name: 'Geist', cat: 'sans', moods: ['minimal', 'futuristic', 'business'] },
  { name: 'DM Sans', cat: 'sans', moods: ['minimal', 'calm', 'creator'] },
  { name: 'Plus Jakarta Sans', cat: 'sans', moods: ['creator', 'business', 'playful'] },
  { name: 'Space Grotesk', cat: 'sans', moods: ['futuristic', 'bold', 'creator'] },
  { name: 'Merriweather', cat: 'serif', moods: ['editorial', 'warm', 'business'] },
  { name: 'Geist Mono', cat: 'mono', moods: ['futuristic', 'minimal'] },
  { name: 'JetBrains Mono', cat: 'mono', moods: ['futuristic', 'bold'] },
  { name: 'Fraunces', cat: 'serif', moods: ['warm', 'editorial', 'playful', 'retro'], displayOnly: true },
  { name: 'Instrument Serif', cat: 'serif', moods: ['editorial', 'luxe', 'minimal'], displayOnly: true },
  { name: 'Playfair Display', cat: 'serif', moods: ['luxe', 'editorial'], displayOnly: true },
  { name: 'Cormorant Garamond', cat: 'serif', moods: ['luxe', 'editorial', 'calm'], displayOnly: true },
  { name: 'Bricolage Grotesque', cat: 'display', moods: ['playful', 'bold', 'creator'], displayOnly: true },
  { name: 'Outfit', cat: 'sans', moods: ['playful', 'minimal', 'creator'] },
  { name: 'Syne', cat: 'display', moods: ['bold', 'futuristic', 'playful'], displayOnly: true },
  { name: 'Lora', cat: 'serif', moods: ['editorial', 'warm', 'calm'] },
  { name: 'Oswald', cat: 'display', moods: ['bold', 'retro'], displayOnly: true },
  { name: 'EB Garamond', cat: 'serif', moods: ['luxe', 'editorial', 'calm'] },
  { name: 'Tenor Sans', cat: 'sans', moods: ['luxe', 'editorial', 'minimal'] },
];

export interface FontTrio {
  name: string;
  bio: string;
  buttons: string;
  moods: Mood[];
  score: number;
}

// Proven pairings. Name font may be display; bio + buttons must be non-display, non-script.
export const TRIOS: FontTrio[] = [
  { name: 'Cormorant Garamond', bio: 'EB Garamond', buttons: 'Tenor Sans', moods: ['luxe', 'editorial', 'calm'], score: 96 },
  { name: 'Playfair Display', bio: 'Inter', buttons: 'Inter', moods: ['luxe', 'editorial', 'business'], score: 94 },
  { name: 'Instrument Serif', bio: 'Geist', buttons: 'Geist', moods: ['editorial', 'minimal', 'luxe'], score: 95 },
  { name: 'Fraunces', bio: 'DM Sans', buttons: 'DM Sans', moods: ['warm', 'editorial', 'playful'], score: 92 },
  { name: 'Fraunces', bio: 'Lora', buttons: 'Plus Jakarta Sans', moods: ['warm', 'retro', 'editorial'], score: 88 },
  { name: 'Bricolage Grotesque', bio: 'Inter', buttons: 'Outfit', moods: ['playful', 'creator', 'bold'], score: 91 },
  { name: 'Syne', bio: 'DM Sans', buttons: 'Space Grotesk', moods: ['bold', 'futuristic', 'playful'], score: 89 },
  { name: 'Space Grotesk', bio: 'Inter', buttons: 'Space Grotesk', moods: ['futuristic', 'creator', 'bold'], score: 90 },
  { name: 'JetBrains Mono', bio: 'Geist', buttons: 'Geist Mono', moods: ['futuristic', 'minimal'], score: 87 },
  { name: 'Geist', bio: 'Geist', buttons: 'Geist', moods: ['minimal', 'business', 'calm'], score: 93 },
  { name: 'Inter', bio: 'Inter', buttons: 'Inter', moods: ['minimal', 'business', 'calm'], score: 90 },
  { name: 'Plus Jakarta Sans', bio: 'DM Sans', buttons: 'Plus Jakarta Sans', moods: ['creator', 'business', 'playful'], score: 90 },
  { name: 'Oswald', bio: 'Merriweather', buttons: 'Inter', moods: ['bold', 'retro'], score: 86 },
  { name: 'Lora', bio: 'Lora', buttons: 'DM Sans', moods: ['editorial', 'warm', 'calm'], score: 88 },
  { name: 'Merriweather', bio: 'Inter', buttons: 'Inter', moods: ['editorial', 'business', 'warm'], score: 85 },
  { name: 'Outfit', bio: 'DM Sans', buttons: 'Outfit', moods: ['playful', 'minimal', 'creator'], score: 89 },
  { name: 'Playfair Display', bio: 'EB Garamond', buttons: 'Tenor Sans', moods: ['luxe', 'editorial'], score: 93 },
  { name: 'Cormorant Garamond', bio: 'Inter', buttons: 'DM Sans', moods: ['luxe', 'calm', 'minimal'], score: 91 },
];

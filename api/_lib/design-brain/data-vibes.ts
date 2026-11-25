// data-vibes.ts: named vibes. Each links to palettes that suit it (affinities).
import type { Mood, UseCase } from './data-palettes.ts';

export interface Vibe {
  id: string;
  name: string;
  tagline: string;
  moods: Mood[];
  palettes: string[];
  useCases: UseCase[];
  pro?: boolean;
}

export const VIBES: Vibe[] = [
  { id: 'burgundy-library', name: 'Burgundy Library', tagline: 'Editorial & Luxe', moods: ['editorial', 'luxe', 'warm'], palettes: ['burgundy-velvet'], useCases: ['artist', 'creator', 'musician'] },
  { id: 'porcelain', name: 'Porcelain', tagline: 'Quiet, bright and sharp', moods: ['minimal', 'calm', 'business'], palettes: ['porcelain', 'monochrome-light', 'sky-linen'], useCases: ['business', 'developer', 'student'] },
  { id: 'oat-milk', name: 'Oat Milk', tagline: 'Warm paper, soft serif voice', moods: ['calm', 'warm', 'editorial'], palettes: ['oat-milk', 'sand-dune'], useCases: ['creator', 'artist', 'student'] },
  { id: 'dawn-mist', name: 'Dawn Mist', tagline: 'Fresh morning air', moods: ['calm', 'cool', 'minimal'], palettes: ['sky-linen', 'porcelain', 'mint-tint'], useCases: ['student', 'business', 'creator'] },
  { id: 'celadon', name: 'Celadon', tagline: 'Soft green calm', moods: ['calm', 'nature', 'minimal'], palettes: ['celadon', 'mint-tint'], useCases: ['creator', 'influencer', 'student'] },
  { id: 'rose-quartz', name: 'Rose Quartz', tagline: 'Blush tones, editorial warmth', moods: ['warm', 'editorial', 'playful'], palettes: ['rose-quartz', 'peach-fizz'], useCases: ['influencer', 'creator', 'artist'] },
  { id: 'obsidian', name: 'Obsidian', tagline: 'Pure black, pure focus', moods: ['bold', 'minimal', 'business'], palettes: ['obsidian', 'graphite'], useCases: ['developer', 'business', 'creator', 'musician'] },
  { id: 'eclipse', name: 'Eclipse', tagline: 'Deep night, cool light', moods: ['cool', 'futuristic', 'business'], palettes: ['midnight-blue', 'graphite'], useCases: ['developer', 'business'] },
  { id: 'onyx-gold', name: 'Onyx Gold', tagline: 'Black tie, gold thread', moods: ['luxe', 'bold', 'editorial'], palettes: ['onyx-gold'], useCases: ['business', 'artist', 'musician', 'influencer'] },
  { id: 'terracotta-sun', name: 'Terracotta Sun', tagline: 'Baked clay, golden hour', moods: ['warm', 'retro', 'bold'], palettes: ['terracotta', 'sand-dune', 'sunset'], useCases: ['artist', 'musician', 'creator'] },
  { id: 'deep-forest', name: 'Deep Forest', tagline: 'Moss, shade and stillness', moods: ['nature', 'calm', 'cool'], palettes: ['forest', 'celadon'], useCases: ['creator', 'student'] },
  { id: 'lavender-haze', name: 'Lavender Haze', tagline: 'Dreamy and soft', moods: ['playful', 'calm', 'creator'], palettes: ['lavender-haze', 'plum-night'], useCases: ['influencer', 'artist', 'creator'] },
  { id: 'peach-fizz', name: 'Peach Fizz', tagline: 'Sweet, bright, social', moods: ['playful', 'warm', 'creator'], palettes: ['peach-fizz', 'rose-quartz', 'citrus-pop'], useCases: ['influencer', 'creator', 'student'] },
  { id: 'ocean-deep', name: 'Ocean Deep', tagline: 'Teal tides after dark', moods: ['cool', 'futuristic', 'calm'], palettes: ['ocean-teal', 'midnight-blue'], useCases: ['developer', 'creator', 'business'] },
  { id: 'neon-nights', name: 'Neon Nights', tagline: 'City lights, loud and live', moods: ['futuristic', 'bold', 'playful'], palettes: ['neon-cyber', 'plum-night'], useCases: ['musician', 'developer', 'creator'], pro: false },
  { id: 'golden-hour', name: 'Golden Hour', tagline: 'Warm glow, soft landing', moods: ['warm', 'bold', 'playful'], palettes: ['sunset', 'terracotta'], useCases: ['musician', 'influencer', 'artist'] },
  { id: 'paper-press', name: 'Paper Press', tagline: 'Ink on cream, editorial hairlines', moods: ['editorial', 'minimal', 'warm'], palettes: ['oat-milk', 'monochrome-light', 'sand-dune'], useCases: ['artist', 'creator', 'business'] },
  { id: 'midnight-plum', name: 'Midnight Plum', tagline: 'Velvet violet, late-night luxe', moods: ['luxe', 'playful', 'futuristic'], palettes: ['plum-night'], useCases: ['musician', 'influencer', 'artist'] },
  { id: 'citrus-pop', name: 'Citrus Pop', tagline: 'Zesty, loud, friendly', moods: ['playful', 'bold', 'retro'], palettes: ['citrus-pop', 'peach-fizz'], useCases: ['influencer', 'student', 'creator'] },
  { id: 'studio-mono', name: 'Studio Mono', tagline: 'Black, white, nothing extra', moods: ['minimal', 'business', 'editorial'], palettes: ['monochrome-light', 'graphite', 'obsidian'], useCases: ['business', 'developer', 'artist'] },
];

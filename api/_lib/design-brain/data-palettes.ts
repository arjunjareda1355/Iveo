// data-palettes.ts: curated palettes. Edit freely; the self-test re-checks contrast.
import type { Hex } from './util.ts';

export const MOODS = [
  'calm',
  'bold',
  'luxe',
  'playful',
  'futuristic',
  'editorial',
  'minimal',
  'warm',
  'cool',
  'nature',
  'retro',
  'creator',
  'business',
] as const;

export type Mood = (typeof MOODS)[number];

export const USE_CASES = [
  'creator',
  'musician',
  'business',
  'student',
  'developer',
  'artist',
  'influencer',
] as const;

export type UseCase = (typeof USE_CASES)[number];

export interface Palette {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  bg: Hex;
  bg2: Hex; // page background + a companion tone for gradients
  surface: Hex;
  text: Hex;
  muted: Hex;
  accent: Hex;
  accent2: Hex;
  moods: Mood[];
  useCases: UseCase[];
  pro?: boolean;
}

export const PALETTES: Palette[] = [
  { id: 'burgundy-velvet', name: 'Burgundy Velvet', mode: 'dark', bg: '#2A0C14', bg2: '#4A1624', surface: '#3A121D', text: '#FAECEE', muted: '#C9A3AB', accent: '#D4AF37', accent2: '#F5D98B', moods: ['luxe', 'editorial', 'warm'], useCases: ['artist', 'creator', 'musician'] },
  { id: 'oat-milk', name: 'Oat Milk', mode: 'light', bg: '#F3EEE3', bg2: '#E8DFCF', surface: '#FBF8F1', text: '#2A2118', muted: '#6E6253', accent: '#8A6A4A', accent2: '#C9A98A', moods: ['calm', 'warm', 'editorial', 'minimal'], useCases: ['creator', 'student', 'artist'] },
  { id: 'porcelain', name: 'Porcelain', mode: 'light', bg: '#FAFAF8', bg2: '#EEF1F6', surface: '#FFFFFF', text: '#111111', muted: '#5A5F6B', accent: '#2F5BD8', accent2: '#8FA9F0', moods: ['minimal', 'calm', 'business', 'cool'], useCases: ['business', 'student', 'developer'] },
  { id: 'celadon', name: 'Celadon', mode: 'light', bg: '#E6F0E9', bg2: '#CFE3D6', surface: '#F4FAF6', text: '#16301F', muted: '#4F6B58', accent: '#2E6B4A', accent2: '#7FB89A', moods: ['calm', 'nature', 'minimal'], useCases: ['creator', 'student', 'influencer'] },
  { id: 'rose-quartz', name: 'Rose Quartz', mode: 'light', bg: '#FFD9CC', bg2: '#FFB8C6', surface: '#FFF1EC', text: '#3A1620', muted: '#7D4A57', accent: '#B83A5E', accent2: '#F08BA3', moods: ['warm', 'playful', 'editorial'], useCases: ['influencer', 'creator', 'artist'] },
  { id: 'obsidian', name: 'Obsidian', mode: 'dark', bg: '#0A0A0A', bg2: '#1A1A1A', surface: '#161616', text: '#F5F5F5', muted: '#A3A3A3', accent: '#FFFFFF', accent2: '#8B8B8B', moods: ['bold', 'minimal', 'futuristic', 'business'], useCases: ['developer', 'business', 'musician', 'creator'] },
  { id: 'midnight-blue', name: 'Midnight Blue', mode: 'dark', bg: '#0A1128', bg2: '#16224A', surface: '#111B3A', text: '#EAF0FF', muted: '#9FB0D8', accent: '#5B8CFF', accent2: '#9CC0FF', moods: ['cool', 'futuristic', 'business', 'calm'], useCases: ['developer', 'business', 'student'] },
  { id: 'onyx-gold', name: 'Onyx Gold', mode: 'dark', bg: '#0F0D08', bg2: '#2A2210', surface: '#1B1710', text: '#F7F0DC', muted: '#BDB08A', accent: '#D4AF37', accent2: '#F2D675', moods: ['luxe', 'bold', 'editorial'], useCases: ['business', 'artist', 'musician', 'influencer'] },
  { id: 'terracotta', name: 'Terracotta', mode: 'dark', bg: '#3B1A10', bg2: '#6A2E1B', surface: '#4A2216', text: '#FFF1E8', muted: '#E0B9A5', accent: '#F2A365', accent2: '#FFD2A8', moods: ['warm', 'retro', 'bold'], useCases: ['artist', 'creator', 'musician'] },
  { id: 'forest', name: 'Forest', mode: 'dark', bg: '#0E2018', bg2: '#1C3B2C', surface: '#142C21', text: '#E8F5EC', muted: '#9CC1A9', accent: '#6FCF97', accent2: '#B6EBC9', moods: ['nature', 'calm', 'cool'], useCases: ['creator', 'student', 'influencer'] },
  { id: 'lavender-haze', name: 'Lavender Haze', mode: 'light', bg: '#EFE8FB', bg2: '#DCCFF5', surface: '#F9F5FF', text: '#2A1A4A', muted: '#66568A', accent: '#6B42D8', accent2: '#B49AF0', moods: ['playful', 'calm', 'creator'], useCases: ['influencer', 'creator', 'artist'] },
  { id: 'peach-fizz', name: 'Peach Fizz', mode: 'light', bg: '#FFE2D1', bg2: '#FFC4D0', surface: '#FFF4EC', text: '#3B1E14', muted: '#80523F', accent: '#E8553A', accent2: '#FF9E80', moods: ['playful', 'warm', 'creator'], useCases: ['influencer', 'creator', 'student'] },
  { id: 'mint-tint', name: 'Mint Tint', mode: 'light', bg: '#E7F5EE', bg2: '#C8EEDB', surface: '#F6FCF9', text: '#0F2B21', muted: '#436556', accent: '#0F9D6E', accent2: '#6FD6B0', moods: ['calm', 'minimal', 'nature', 'playful'], useCases: ['student', 'creator', 'business'] },
  { id: 'ocean-teal', name: 'Ocean Teal', mode: 'dark', bg: '#06232B', bg2: '#0B4651', surface: '#0A323B', text: '#E6FBFF', muted: '#97C5CE', accent: '#1FD1C2', accent2: '#8CF0E6', moods: ['cool', 'futuristic', 'calm'], useCases: ['developer', 'creator', 'business'] },
  { id: 'neon-cyber', name: 'Neon Cyber', mode: 'dark', bg: '#0B0620', bg2: '#2A0E55', surface: '#150B33', text: '#F4ECFF', muted: '#B3A1DB', accent: '#00F0FF', accent2: '#FF2E97', moods: ['futuristic', 'bold', 'playful'], useCases: ['developer', 'musician', 'creator'] },
  { id: 'sunset', name: 'Sunset', mode: 'dark', bg: '#2B0F2E', bg2: '#7A2A3E', surface: '#3A1640', text: '#FFF0E6', muted: '#E6B8B0', accent: '#FF9A5A', accent2: '#FFD27A', moods: ['warm', 'bold', 'playful', 'retro'], useCases: ['musician', 'influencer', 'artist'] },
  { id: 'monochrome-light', name: 'Monochrome Light', mode: 'light', bg: '#F5F5F5', bg2: '#E4E4E4', surface: '#FFFFFF', text: '#141414', muted: '#5C5C5C', accent: '#141414', accent2: '#7A7A7A', moods: ['minimal', 'business', 'editorial'], useCases: ['business', 'developer', 'artist', 'student'] },
  { id: 'graphite', name: 'Graphite', mode: 'dark', bg: '#161616', bg2: '#262626', surface: '#202020', text: '#F0F0F0', muted: '#A0A0A0', accent: '#E5E5E5', accent2: '#9A9A9A', moods: ['minimal', 'business', 'bold'], useCases: ['developer', 'business', 'creator'] },
  { id: 'sand-dune', name: 'Sand Dune', mode: 'light', bg: '#F1E3C8', bg2: '#E2C99A', surface: '#FAF1DE', text: '#33260F', muted: '#756143', accent: '#B5651D', accent2: '#E0A860', moods: ['warm', 'retro', 'editorial'], useCases: ['artist', 'creator', 'musician'] },
  { id: 'plum-night', name: 'Plum Night', mode: 'dark', bg: '#1D0A2B', bg2: '#3F1559', surface: '#2A1040', text: '#F6EAFF', muted: '#BFA3D9', accent: '#E08BFF', accent2: '#F6C6FF', moods: ['luxe', 'playful', 'futuristic'], useCases: ['musician', 'influencer', 'artist'] },
  { id: 'sky-linen', name: 'Sky Linen', mode: 'light', bg: '#EAF3FF', bg2: '#D5E6FA', surface: '#F7FAFF', text: '#0E1B33', muted: '#4D607F', accent: '#1F6FEB', accent2: '#7FB0F7', moods: ['cool', 'calm', 'business', 'minimal'], useCases: ['business', 'student', 'developer'] },
  { id: 'citrus-pop', name: 'Citrus Pop', mode: 'light', bg: '#FFF3B0', bg2: '#FFD97A', surface: '#FFFBE0', text: '#2B2200', muted: '#6E5E1B', accent: '#E85D04', accent2: '#FFB703', moods: ['playful', 'bold', 'retro'], useCases: ['influencer', 'creator', 'student'] },
];

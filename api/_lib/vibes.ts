// Keep in sync with src/lib/vibes.ts

export interface ServerVibeTokens {
  bg: string;
  text: string;
  muted: string;
  avatarBg: string;
}

export const SERVER_VIBES: Record<string, ServerVibeTokens> = {
  clean: {
    bg: '#FFFFFF',
    text: '#0A0A0A',
    muted: '#6B6B6B',
    avatarBg: '#F0F0F0',
  },
  midnight: {
    bg: '#0B0B0C',
    text: '#F5F5F5',
    muted: '#9A9A9A',
    avatarBg: '#1F1F22',
  },
  paper: {
    bg: '#F6F1E7',
    text: '#2B2A28',
    muted: '#7A756B',
    avatarBg: '#E9E1D0',
  },
  sage: {
    bg: '#E8EDE6',
    text: '#1F2A22',
    muted: '#5E6B61',
    avatarBg: '#D3DDD0',
  },
  clay: {
    bg: '#EADCCF',
    text: '#3A2A22',
    muted: '#7B6355',
    avatarBg: '#D9C5B3',
  },
  mono: {
    bg: '#F2F2F2',
    text: '#111111',
    muted: '#666666',
    avatarBg: '#E0E0E0',
  },
  cyberpunk: {
    bg: '#0F051D',
    text: '#F4EEFF',
    muted: '#A28BC4',
    avatarBg: '#2A1647',
  },
  sunset: {
    bg: '#FFF5F0',
    text: '#2E1205',
    muted: '#9C6246',
    avatarBg: '#FFDEC9',
  },
  glass: {
    bg: '#0A1118',
    text: '#F0F6FC',
    muted: '#7D8B99',
    avatarBg: '#16222F',
  },
  brutalist: {
    bg: '#FFF952',
    text: '#000000',
    muted: '#333333',
    avatarBg: '#000000',
  },
  emerald: {
    bg: '#0A1F18',
    text: '#E6F5EE',
    muted: '#739F8C',
    avatarBg: '#13382D',
  },
  pastel: {
    bg: '#F5EEFA',
    text: '#2A1D36',
    muted: '#867399',
    avatarBg: '#E4D5EC',
  },
};

export function getServerVibe(vibeId: string | null | undefined): ServerVibeTokens {
  if (vibeId && SERVER_VIBES[vibeId]) {
    return SERVER_VIBES[vibeId];
  }
  return SERVER_VIBES.clean;
}

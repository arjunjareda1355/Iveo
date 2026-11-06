export interface VibeTokens {
  bg: string;
  text: string;
  muted: string;
  avatarBg: string;
  avatarText: string;
  buttonBg: string;
  buttonText: string;
  buttonBorder?: string;
  buttonRadius: number; // in pixels (e.g. 12, 14, 6, 999, 10, 0)
  buttonShadow?: string;
  buttonBorderWidth?: string;
}

export interface Persona {
  name: string;
  handle: string;
  bio: string;
  initials: string;
  links: readonly string[];
}

export type VibeId = 'clean' | 'midnight' | 'paper' | 'sage' | 'clay' | 'mono';

export interface Vibe {
  id: VibeId;
  name: string;
  description: string;
  fontFamily: string;
  nativeShape: 'Square' | 'Rounded' | 'Pill';
  tokens: VibeTokens;
  persona: Persona;
}

export const VIBES: readonly Vibe[] = [
  {
    id: 'clean',
    name: 'Clean',
    description: 'White space and a sharp black button.',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    nativeShape: 'Rounded',
    tokens: {
      bg: '#FFFFFF',
      text: '#0A0A0A',
      muted: '#6B6B6B',
      avatarBg: '#F0F0F0',
      avatarText: '#0A0A0A',
      buttonBg: '#0A0A0A',
      buttonText: '#FFFFFF',
      buttonRadius: 12,
    },
    persona: {
      name: 'Maya Ellis',
      handle: 'maya',
      bio: 'Illustrator and writer. Zines, prints and the occasional essay.',
      initials: 'ME',
      links: [
        'New zine, out now',
        'Shop prints',
        'Portfolio',
        'Newsletter',
        'Book a commission',
      ],
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Near-black, quiet and easy on the eyes.',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    nativeShape: 'Rounded',
    tokens: {
      bg: '#0B0B0C',
      text: '#F5F5F5',
      muted: '#9A9A9A',
      avatarBg: '#1F1F22',
      avatarText: '#F5F5F5',
      buttonBg: '#1C1C1E',
      buttonText: '#F5F5F5',
      buttonBorder: '#2A2A2D',
      buttonBorderWidth: '1px',
      buttonRadius: 14,
    },
    persona: {
      name: 'Dev Sharma',
      handle: 'devsharma',
      bio: 'Producer and DJ. Debut EP out now, new mix every month.',
      initials: 'DS',
      links: [
        'Listen to the EP',
        'Latest mix',
        'Tour dates',
        'Merch',
        'Booking enquiries',
      ],
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Warm paper tones with a serif voice.',
    fontFamily: "'Fraunces', serif",
    nativeShape: 'Square',
    tokens: {
      bg: '#F6F1E7',
      text: '#2B2A28',
      muted: '#7A756B',
      avatarBg: '#E9E1D0',
      avatarText: '#2B2A28',
      buttonBg: '#FFFDF8',
      buttonText: '#2B2A28',
      buttonBorder: '#2B2A28',
      buttonBorderWidth: '1.5px',
      buttonRadius: 6,
      buttonShadow: '3px 3px 0 #2B2A28',
    },
    persona: {
      name: 'Lena Hoffmann',
      handle: 'lenahoffmann',
      bio: 'Writer. Essays on cities, walking and slow reading.',
      initials: 'LH',
      links: [
        'Read the latest essay',
        'Subscribe to the newsletter',
        'Books',
        'Upcoming talks',
        'Contact',
      ],
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Soft green-gray with outlined pills.',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    nativeShape: 'Pill',
    tokens: {
      bg: '#E8EDE6',
      text: '#1F2A22',
      muted: '#5E6B61',
      avatarBg: '#D3DDD0',
      avatarText: '#1F2A22',
      buttonBg: 'transparent',
      buttonText: '#1F2A22',
      buttonBorder: '#1F2A22',
      buttonBorderWidth: '1.5px',
      buttonRadius: 999,
    },
    persona: {
      name: 'Tomas Reyes',
      handle: 'tomasreyes',
      bio: 'Ceramicist working in small batches in Lisbon.',
      initials: 'TR',
      links: [
        'Shop the new collection',
        'Studio visits',
        'Workshops',
        'Wholesale',
        'Follow along',
      ],
    },
  },
  {
    id: 'clay',
    name: 'Clay',
    description: 'Earthy tones and solid, rounded buttons.',
    fontFamily: "'Fraunces', serif",
    nativeShape: 'Rounded',
    tokens: {
      bg: '#EADCCF',
      text: '#3A2A22',
      muted: '#7B6355',
      avatarBg: '#D9C5B3',
      avatarText: '#3A2A22',
      buttonBg: '#3A2A22',
      buttonText: '#F3E8DD',
      buttonRadius: 10,
    },
    persona: {
      name: 'Studio Ode',
      handle: 'studioode',
      bio: 'A two-person design studio for brands that last.',
      initials: 'SO',
      links: [
        'Selected work',
        'Services',
        'Journal',
        'Careers',
        'Start a project',
      ],
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Monospaced, square-edged, no decoration.',
    fontFamily: "'Geist Mono', ui-monospace, monospace",
    nativeShape: 'Square',
    tokens: {
      bg: '#F2F2F2',
      text: '#111111',
      muted: '#666666',
      avatarBg: '#E0E0E0',
      avatarText: '#111111',
      buttonBg: 'transparent',
      buttonText: '#111111',
      buttonBorder: '#111111',
      buttonBorderWidth: '1px',
      buttonRadius: 0,
    },
    persona: {
      name: 'Iris Park',
      handle: 'irispark',
      bio: 'Developer. Open source, notes and small tools.',
      initials: 'IP',
      links: [
        'GitHub',
        'Writing',
        'Uses',
        'Talks',
        'Email me',
      ],
    },
  },
] as const;

export const HERO_VIBE_IDS = ['clean', 'midnight', 'paper', 'sage'] as const;

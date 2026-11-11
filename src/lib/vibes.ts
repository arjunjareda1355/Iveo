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
  avatarUrl?: string;
  links: readonly string[];
}

export type VibeId =
  | 'clean'
  | 'midnight'
  | 'paper'
  | 'sage'
  | 'clay'
  | 'mono'
  | 'cyberpunk'
  | 'sunset'
  | 'glass'
  | 'brutalist'
  | 'emerald'
  | 'pastel';

export interface Vibe {
  id: VibeId;
  name: string;
  description: string;
  fontFamily: string;
  nativeShape: 'Square' | 'Rounded' | 'Pill';
  tokens: VibeTokens;
  persona: Persona;
  isPro?: boolean;
}

export type VibeTheme = Vibe;

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
      avatarUrl: 'https://i.postimg.cc/Rh5vdyVb/file-0000000002448211a254292ad6932ab5.png',
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
      avatarUrl: 'https://i.postimg.cc/3J9H0dm8/file-0000000006c48211af7b9f917a04f2aa.png',
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
      avatarUrl: 'https://i.postimg.cc/pVwmcc6W/file-000000000d048211bd8a5e2b54943ddb.png',
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
      avatarUrl: 'https://i.postimg.cc/rF2pN0DV/file-0000000019908211bdd98e4830c323de.png',
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
      avatarUrl: 'https://i.postimg.cc/5N86h5hC/file-000000001e848211bfcbd8cc993040e3.png',
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
      avatarUrl: 'https://i.postimg.cc/SK1s6gMV/file-0000000022e48211869c7fae07926fea.png',
      links: [
        'GitHub',
        'Writing',
        'Uses',
        'Talks',
        'Email me',
      ],
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Electric neon purple and synthwave glow for modern creators.',
    fontFamily: "'Geist Mono', monospace",
    nativeShape: 'Rounded',
    isPro: true,
    tokens: {
      bg: '#0F051D',
      text: '#F4EEFF',
      muted: '#A28BC4',
      avatarBg: '#2A1647',
      avatarText: '#F4EEFF',
      buttonBg: '#1E0C38',
      buttonText: '#00FFE0',
      buttonBorder: '#B94BFF',
      buttonBorderWidth: '1.5px',
      buttonRadius: 10,
      buttonShadow: '0 0 12px rgba(185, 75, 255, 0.35)',
    },
    persona: {
      name: 'Kai Vance',
      handle: 'kaivance',
      bio: 'Cybersecurity engineer, synthwave composer & pixel artist.',
      initials: 'KV',
      links: ['Listen on Spotify', 'Twitch Stream', 'Discord Community', 'Patreon'],
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Warm',
    description: 'Golden hour peach and terracotta warmth.',
    fontFamily: "'Inter', sans-serif",
    nativeShape: 'Pill',
    isPro: true,
    tokens: {
      bg: '#FFF5F0',
      text: '#2E1205',
      muted: '#9C6246',
      avatarBg: '#FFDEC9',
      avatarText: '#2E1205',
      buttonBg: '#FF5E3A',
      buttonText: '#FFFFFF',
      buttonRadius: 999,
      buttonShadow: '0 4px 14px rgba(255, 94, 58, 0.25)',
    },
    persona: {
      name: 'Aria Sol',
      handle: 'ariasol',
      bio: 'Travel photographer & slow-travel documentarian.',
      initials: 'AS',
      links: ['Photo Gallery', 'Print Store', 'YouTube Vlogs', 'Substack'],
    },
  },
  {
    id: 'glass',
    name: 'Glassmorphism',
    description: 'Frosted translucency with deep ambient obsidian backdrop.',
    fontFamily: "'Inter', sans-serif",
    nativeShape: 'Rounded',
    isPro: true,
    tokens: {
      bg: '#0A1118',
      text: '#F0F6FC',
      muted: '#7D8B99',
      avatarBg: '#16222F',
      avatarText: '#F0F6FC',
      buttonBg: 'rgba(255, 255, 255, 0.08)',
      buttonText: '#FFFFFF',
      buttonBorder: 'rgba(255, 255, 255, 0.16)',
      buttonBorderWidth: '1px',
      buttonRadius: 14,
      buttonShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    },
    persona: {
      name: 'Nova Labs',
      handle: 'novalabs',
      bio: 'Building calm spatial software and ambient UI design.',
      initials: 'NL',
      links: ['Explore Showcase', 'Documentation', 'Join Beta', 'Twitter / X'],
    },
  },
  {
    id: 'brutalist',
    name: 'Brutalist Pop',
    description: 'High voltage yellow, thick solid borders & hard offset drop shadows.',
    fontFamily: "'Geist Mono', monospace",
    nativeShape: 'Square',
    isPro: true,
    tokens: {
      bg: '#FFF952',
      text: '#000000',
      muted: '#2B2B2B',
      avatarBg: '#000000',
      avatarText: '#FFF952',
      buttonBg: '#FFFFFF',
      buttonText: '#000000',
      buttonBorder: '#000000',
      buttonBorderWidth: '2.5px',
      buttonRadius: 0,
      buttonShadow: '4px 4px 0 #000000',
    },
    persona: {
      name: 'Zane V',
      handle: 'zanev',
      bio: 'Zine publisher, risograph printmaker and poster collector.',
      initials: 'ZV',
      links: ['Shop Zines', 'Risograph Prints', 'Workshops', 'Instagram'],
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Luxe deep pine velvet with radiant champagne gold typography.',
    fontFamily: "'Fraunces', serif",
    nativeShape: 'Rounded',
    isPro: true,
    tokens: {
      bg: '#0A1F18',
      text: '#E6F5EE',
      muted: '#739F8C',
      avatarBg: '#13382D',
      avatarText: '#F4D06F',
      buttonBg: '#13382D',
      buttonText: '#F4D06F',
      buttonBorder: '#235948',
      buttonBorderWidth: '1px',
      buttonRadius: 12,
      buttonShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    },
    persona: {
      name: 'Rowan Vale',
      handle: 'rowanvale',
      bio: 'Botanist, wild forager and author of The Secret Forest.',
      initials: 'RV',
      links: ['Order the Book', 'Wild Teas & Blends', 'Field Journal', 'Workshops'],
    },
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    description: 'Dreamy lilac and lavender with ultra-soft pill touchpoints.',
    fontFamily: "'Inter', sans-serif",
    nativeShape: 'Pill',
    isPro: true,
    tokens: {
      bg: '#F5EEFA',
      text: '#2A1D36',
      muted: '#867399',
      avatarBg: '#E4D5EC',
      avatarText: '#2A1D36',
      buttonBg: '#FFFFFF',
      buttonText: '#6A3C94',
      buttonBorder: '#D8BFEC',
      buttonBorderWidth: '1px',
      buttonRadius: 999,
      buttonShadow: '0 4px 12px rgba(106, 60, 148, 0.08)',
    },
    persona: {
      name: 'Mochi Studio',
      handle: 'mochistudio',
      bio: 'Cute 3D illustrations, cozy game dev and sticker club.',
      initials: 'MS',
      links: ['Sticker Club', 'Shop Pins', 'Play Cozy Quest', 'TikTok'],
    },
  },
] as const;

export const HERO_VIBE_IDS = ['clean', 'midnight', 'paper', 'sage'] as const;

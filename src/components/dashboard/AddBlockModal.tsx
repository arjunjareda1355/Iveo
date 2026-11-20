import React, { useState } from 'react';
import {
  Search,
  Link2,
  Play,
  Music,
  Headphones,
  UserCheck,
  Mail,
  Heart,
  HelpCircle,
  Heading,
  Minus,
  ChevronRight,
  Coffee,
  Instagram,
  Youtube,
  ShoppingBag,
  CalendarClock,
  Timer,
  Ticket,
  MapPin,
  FileDown,
  Share2,
  Github,
  Linkedin,
  ArrowRight,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ProBadge } from '../plan/ProBadge';
import { Button } from '../ui/Button';
import {
  DiscordGlyph,
  XMarkGlyph,
  FacebookGlyph,
  ThreadsGlyph,
  PinterestGlyph,
} from '../page/EmbedBlock';
import { BlueskySocialIcon, LinktreeSocialIcon } from '../phone/SocialIcons';
import { detectProviderUrl } from '../../lib/providers';
import type { DetectedProviderUrl } from '../../lib/providers/types';

export type FeatureType =
  | 'link'
  | 'social'
  | 'embed'
  | 'embed_youtube'
  | 'embed_spotify'
  | 'embed_soundcloud'
  | 'embed_discord'
  | 'embed_github'
  | 'embed_linkedin'
  | 'embed_x'
  | 'embed_instagram'
  | 'embed_facebook'
  | 'embed_threads'
  | 'embed_pinterest'
  | 'embed_bluesky'
  | 'embed_linktree'
  | 'vcard'
  | 'signup'
  | 'tip_jar'
  | 'coffee'
  | 'instagram'
  | 'youtube'
  | 'product'
  | 'booking'
  | 'countdown'
  | 'promo'
  | 'location'
  | 'download'
  | 'faq'
  | 'header'
  | 'divider';

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFeature: (type: FeatureType) => void;
  onSmartAddProvider?: (detected: DetectedProviderUrl) => void;
  onSmartAddGenericLink?: (url: string) => void;
  isPro: boolean;
}

interface FeatureOption {
  id: FeatureType;
  title: string;
  description: string;
  category: 'social' | 'players' | 'links' | 'commerce' | 'audience' | 'layout';
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  iconBg: string;
  iconColor: string;
  proRequired?: boolean;
}

const FEATURES: FeatureOption[] = [
  {
    id: 'link',
    title: 'Standard link',
    description: 'Button linking to any website, store, or portfolio',
    category: 'links',
    icon: Link2,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'social',
    title: 'Social icon',
    description: 'Add a profile icon to your header or footer social bar',
    category: 'social',
    icon: Share2,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'embed_discord',
    title: 'Discord card',
    description: 'Showcase your Discord server invite or profile card',
    category: 'social',
    icon: DiscordGlyph,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-[#5865F2]',
  },
  {
    id: 'embed_github',
    title: 'GitHub card',
    description: 'Connect your GitHub profile or showcase a repository card',
    category: 'social',
    icon: Github,
    iconBg: 'bg-stone-100',
    iconColor: 'text-[#24292F]',
  },
  {
    id: 'embed_linkedin',
    title: 'LinkedIn card',
    description: 'Showcase your LinkedIn profile or company card',
    category: 'social',
    icon: Linkedin,
    iconBg: 'bg-sky-50',
    iconColor: 'text-[#0A66C2]',
  },
  {
    id: 'embed_x',
    title: 'X card',
    description: 'Showcase your X profile or feature a post card',
    category: 'social',
    icon: XMarkGlyph,
    iconBg: 'bg-stone-100',
    iconColor: 'text-black',
  },
  {
    id: 'embed_instagram',
    title: 'Instagram card',
    description: 'Highlight an Instagram profile, reel, or post card',
    category: 'social',
    icon: Instagram,
    iconBg: 'bg-pink-50',
    iconColor: 'text-[#E1306C]',
  },
  {
    id: 'embed_facebook',
    title: 'Facebook card',
    description: 'Showcase a Facebook profile, page, or group card',
    category: 'social',
    icon: FacebookGlyph,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#1877F2]',
  },
  {
    id: 'embed_threads',
    title: 'Threads card',
    description: 'Feature your Threads profile or a post card',
    category: 'social',
    icon: ThreadsGlyph,
    iconBg: 'bg-stone-100',
    iconColor: 'text-[#101010]',
  },
  {
    id: 'embed_bluesky',
    title: 'Bluesky card',
    description: 'Showcase your Bluesky handle and profile card',
    category: 'social',
    icon: BlueskySocialIcon,
    iconBg: 'bg-sky-50',
    iconColor: 'text-[#0085FF]',
  },
  {
    id: 'embed_linktree',
    title: 'Linktree card',
    description: 'Link to your Linktree page with a rich preview card',
    category: 'social',
    icon: LinktreeSocialIcon,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
  },
  {
    id: 'embed_pinterest',
    title: 'Pinterest pin or board',
    description: 'Feature a Pinterest pin, board, or profile',
    category: 'players',
    icon: PinterestGlyph,
    iconBg: 'bg-rose-50',
    iconColor: 'text-[#E60023]',
  },
  {
    id: 'youtube',
    title: 'YouTube channel card',
    description: 'Show your YouTube channel subscribers and latest videos',
    category: 'social',
    icon: Youtube,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    id: 'embed_youtube',
    title: 'YouTube player',
    description: 'Play a YouTube video, Short, or playlist on your page',
    category: 'players',
    icon: Play,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    proRequired: true,
  },
  {
    id: 'embed_spotify',
    title: 'Spotify player',
    description: 'Share a Spotify track, album, playlist, or podcast player',
    category: 'players',
    icon: Music,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    proRequired: true,
  },
  {
    id: 'embed_soundcloud',
    title: 'SoundCloud player',
    description: 'Share a playable SoundCloud track or set waveform',
    category: 'players',
    icon: Headphones,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    proRequired: true,
  },
  {
    id: 'download',
    title: 'Download / media kit',
    description: 'Share downloadable PDFs, rate cards, presets, or resumes',
    category: 'links',
    icon: FileDown,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    id: 'tip_jar',
    title: 'Support / tip jar',
    description: 'Accept creator support with preset amounts via UPI, PayPal, or Stripe',
    category: 'commerce',
    icon: Heart,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    id: 'coffee',
    title: 'Buy Me a Coffee',
    description: 'Connect your Buy Me a Coffee profile and extras',
    category: 'commerce',
    icon: Coffee,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
  },
  {
    id: 'product',
    title: 'Product / merch card',
    description: 'Highlight a digital product, course, or merch item with price',
    category: 'commerce',
    icon: ShoppingBag,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'booking',
    title: '1:1 booking card',
    description: 'Let clients book coaching or discovery calls with duration & rate',
    category: 'commerce',
    icon: CalendarClock,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    id: 'promo',
    title: 'Promo / coupon code',
    description: 'Display affiliate or store discount codes with one-tap copy',
    category: 'commerce',
    icon: Ticket,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },
  {
    id: 'signup',
    title: 'Audience signup form',
    description: 'Capture visitor email addresses or phone numbers directly',
    category: 'audience',
    icon: Mail,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    proRequired: true,
  },
  {
    id: 'vcard',
    title: 'Digital contact card',
    description: 'Let visitors save your email, phone, and company as a .vcf contact',
    category: 'audience',
    icon: UserCheck,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'countdown',
    title: 'Event / drop countdown',
    description: 'Live countdown clock for launches, streams, or releases',
    category: 'audience',
    icon: Timer,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    id: 'location',
    title: 'Location & hours',
    description: 'Share your studio, café, or venue address with a Maps link',
    category: 'audience',
    icon: MapPin,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'faq',
    title: 'FAQ accordion',
    description: 'Collapsible Q&A section for common questions and policies',
    category: 'audience',
    icon: HelpCircle,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'header',
    title: 'Section header',
    description: 'Organize your page into clean titled sections',
    category: 'layout',
    icon: Heading,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-700',
  },
  {
    id: 'divider',
    title: 'Divider line',
    description: 'Subtle horizontal separator between link groups',
    category: 'layout',
    icon: Minus,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-700',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Social' },
  { id: 'players', label: 'Players' },
  { id: 'links', label: 'Links' },
  { id: 'commerce', label: 'Support & shop' },
  { id: 'audience', label: 'Forms & utilities' },
  { id: 'layout', label: 'Layout' },
] as const;

export const AddBlockModal: React.FC<AddBlockModalProps> = ({
  isOpen,
  onClose,
  onSelectFeature,
  onSmartAddProvider,
  onSmartAddGenericLink,
  isPro,
}) => {
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const handleSmartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = pasteUrl.trim();
    if (!raw) {
      setPasteError('Paste any link first.');
      return;
    }
    const detected = detectProviderUrl(raw);
    if (!detected) {
      setPasteError('Enter a valid web link (for example https://example.com).');
      return;
    }
    setPasteError(null);
    setPasteUrl('');

    if (detected.provider !== 'generic' && onSmartAddProvider) {
      onClose();
      onSmartAddProvider(detected);
      return;
    }

    if (onSmartAddGenericLink) {
      onClose();
      onSmartAddGenericLink(detected.canonicalUrl);
      return;
    }

    onClose();
    onSelectFeature('link');
  };

  const filteredFeatures = FEATURES.filter((feat) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      feat.title.toLowerCase().includes(q) ||
      feat.description.toLowerCase().includes(q);
    const matchesCategory =
      activeCategory === 'all' || feat.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add to your page"
      subtitle="Paste any link or pick a card, player, form, or section."
      maxWidthClass="sm:max-w-2xl"
    >
      <div className="flex flex-col">
        {/* Smart Add: Paste a link (ED-1) */}
        <form
          onSubmit={handleSmartSubmit}
          className="px-4 sm:px-5 pt-3 pb-3 border-b border-divider bg-surface-2/40 flex flex-col gap-1.5"
        >
          <label htmlFor="smart-paste-link" className="text-[13px] font-semibold text-ink">
            Paste a link
          </label>
          <div className="flex items-center gap-2">
            <input
              id="smart-paste-link"
              type="text"
              value={pasteUrl}
              onChange={(e) => {
                setPasteUrl(e.target.value);
                if (pasteError) setPasteError(null);
              }}
              placeholder="Paste any YouTube, Spotify, X, Instagram, Pinterest, or web link..."
              className="flex-1 min-w-0 h-11 px-3.5 bg-surface border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
            />
            <Button type="submit" variant="primary" size="md" className="shrink-0 gap-1">
              <span>Add</span>
              <ArrowRight size={15} />
            </Button>
          </div>
          {pasteError && (
            <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium">
              {pasteError}
            </p>
          )}
        </form>

        {/* Search & Category Filter Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-divider bg-surface flex flex-col gap-2.5 sticky top-0 z-10">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search blocks (spotify, pinterest, bluesky, discord, youtube)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-3 bg-surface-2 border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pb-0.5 text-[12px]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`min-h-[34px] px-3 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-ink text-surface'
                    : 'bg-surface-2 text-muted hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredFeatures.map((feat) => {
            const Icon = feat.icon;
            const isLocked = Boolean(feat.proRequired && !isPro);

            return (
              <button
                key={feat.id}
                type="button"
                onClick={() => {
                  onClose();
                  onSelectFeature(feat.id);
                }}
                className="group p-3.5 rounded-[14px] border border-border hover:border-border-strong bg-surface hover:bg-surface-2/60 text-left transition-all flex items-center gap-3 cursor-pointer relative min-h-[72px]"
              >
                <div
                  className={`w-10 h-10 rounded-[12px] ${feat.iconBg} ${feat.iconColor} flex items-center justify-center shrink-0`}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink">
                      {feat.title}
                    </span>
                    {isLocked && <ProBadge locked />}
                  </div>
                  <p className="text-[12px] text-muted leading-snug mt-0.5 line-clamp-2">
                    {feat.description}
                  </p>
                </div>

                <ChevronRight
                  size={16}
                  className="text-muted/50 group-hover:text-ink transition-colors shrink-0"
                />
              </button>
            );
          })}

          {filteredFeatures.length === 0 && (
            <div className="sm:col-span-2 py-10 text-center text-muted text-[14px]">
              No blocks match &ldquo;{searchQuery}&rdquo;. Try another term.
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

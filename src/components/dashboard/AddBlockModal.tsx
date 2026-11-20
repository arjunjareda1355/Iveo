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
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ProBadge } from '../plan/ProBadge';
import { DiscordGlyph, XMarkGlyph, FacebookGlyph, ThreadsGlyph, PinterestGlyph } from '../page/EmbedBlock';

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
  isPro: boolean;
}

interface FeatureOption {
  id: FeatureType;
  title: string;
  description: string;
  category: 'links' | 'social_embeds' | 'commerce' | 'audience' | 'layout';
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
    category: 'links',
    icon: Share2,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'embed_discord',
    title: 'Discord embed',
    description: 'Connect your Discord account or server invite card with custom looks',
    category: 'social_embeds',
    icon: DiscordGlyph,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-[#5865F2]',
  },
  {
    id: 'embed_github',
    title: 'GitHub embed',
    description: 'Connect your GitHub profile or showcase a repository card',
    category: 'social_embeds',
    icon: Github,
    iconBg: 'bg-stone-100',
    iconColor: 'text-[#24292F]',
  },
  {
    id: 'embed_linkedin',
    title: 'LinkedIn embed',
    description: 'Connect your LinkedIn profile or company card with custom looks',
    category: 'social_embeds',
    icon: Linkedin,
    iconBg: 'bg-sky-50',
    iconColor: 'text-[#0A66C2]',
  },
  {
    id: 'embed_x',
    title: 'X (Twitter) embed',
    description: 'Connect your X account or feature a post card with custom looks',
    category: 'social_embeds',
    icon: XMarkGlyph,
    iconBg: 'bg-stone-100',
    iconColor: 'text-black',
  },
  {
    id: 'embed_instagram',
    title: 'Instagram embed',
    description: 'Connect Instagram via Meta OAuth or paste a profile, reel, or post',
    category: 'social_embeds',
    icon: Instagram,
    iconBg: 'bg-pink-50',
    iconColor: 'text-[#E1306C]',
  },
  {
    id: 'embed_facebook',
    title: 'Facebook embed',
    description: 'Connect Facebook via Meta OAuth or showcase a page or group card',
    category: 'social_embeds',
    icon: FacebookGlyph,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#1877F2]',
  },
  {
    id: 'embed_threads',
    title: 'Threads embed',
    description: 'Connect your Threads profile or feature a post with custom looks',
    category: 'social_embeds',
    icon: ThreadsGlyph,
    iconBg: 'bg-stone-100',
    iconColor: 'text-[#101010]',
  },
  {
    id: 'embed_pinterest',
    title: 'Pinterest embed',
    description: 'Connect Pinterest or feature a pin, board, or profile with custom looks',
    category: 'social_embeds',
    icon: PinterestGlyph,
    iconBg: 'bg-rose-50',
    iconColor: 'text-[#E60023]',
  },
  {
    id: 'youtube',
    title: 'YouTube showcase',
    description: 'Show your YouTube channel subscribers & latest videos',
    category: 'links',
    icon: Youtube,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    id: 'instagram',
    title: 'Instagram card',
    description: 'Highlight your Instagram profile or latest reel',
    category: 'links',
    icon: Instagram,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    id: 'embed_youtube',
    title: 'YouTube embed',
    description: 'Embed a playable YouTube video or Shorts player on your page',
    category: 'links',
    icon: Play,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    proRequired: true,
  },
  {
    id: 'embed_spotify',
    title: 'Spotify embed',
    description: 'Embed a Spotify track, album, or playlist player',
    category: 'links',
    icon: Music,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    proRequired: true,
  },
  {
    id: 'embed_soundcloud',
    title: 'SoundCloud embed',
    description: 'Embed a SoundCloud track or set waveform player',
    category: 'links',
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
  { id: 'social_embeds', label: 'Connected accounts' },
  { id: 'links', label: 'Links & media' },
  { id: 'commerce', label: 'Support & shop' },
  { id: 'audience', label: 'Forms & utilities' },
  { id: 'layout', label: 'Layout' },
] as const;

export const AddBlockModal: React.FC<AddBlockModalProps> = ({
  isOpen,
  onClose,
  onSelectFeature,
  isPro,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

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
      subtitle="Choose a link, connected account embed, media player, support block, or form."
      maxWidthClass="sm:max-w-2xl"
    >
      <div className="flex flex-col">
        {/* Search & Category Filter Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-divider bg-surface flex flex-col gap-2.5 sticky top-0 z-10">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search blocks (spotify, pinterest, instagram, discord, youtube)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-3 bg-surface-2 border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-[12px]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`min-h-[36px] px-3 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
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

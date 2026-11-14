import React, { useState } from 'react';
import {
  X,
  Search,
  Link2,
  Play,
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
} from 'lucide-react';
import { ProBadge } from '../plan/ProBadge';

export type FeatureType =
  | 'link'
  | 'embed'
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
  category: 'links' | 'commerce' | 'audience' | 'layout';
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  iconBg: string;
  iconColor: string;
  badge?: string;
  proRequired?: boolean;
}

const FEATURES: FeatureOption[] = [
  // Core Links & Media
  {
    id: 'link',
    title: 'Standard Link',
    description: 'Direct button to your website, store, portfolio, or socials with click tracking',
    category: 'links',
    icon: Link2,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'youtube',
    title: 'YouTube Showcase',
    description: 'Connect via Google or paste a channel URL to show subscribers & latest videos',
    category: 'links',
    icon: Youtube,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    badge: 'Enhanced',
  },
  {
    id: 'instagram',
    title: 'Instagram Card',
    description: 'Showcase your Instagram profile or latest reel with a branded highlight card',
    category: 'links',
    icon: Instagram,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    badge: 'Popular',
  },
  {
    id: 'embed',
    title: 'Media Player Embed',
    description: 'Embed playable YouTube videos, Spotify tracks, or SoundCloud audio right on your page',
    category: 'links',
    icon: Play,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    proRequired: true,
  },
  {
    id: 'download',
    title: 'Download / Media Kit',
    description: 'Share downloadable PDFs, rate cards, presets, or resumes with format & size tags',
    category: 'links',
    icon: FileDown,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    badge: 'New',
  },

  // Commerce & Monetization
  {
    id: 'product',
    title: 'Product / Merch Card',
    description: 'Highlight a digital product, course, print, or merch item with price & Buy CTA',
    category: 'commerce',
    icon: ShoppingBag,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    badge: 'New',
  },
  {
    id: 'booking',
    title: '1:1 Booking Card',
    description: 'Let clients book coaching, consulting, or discovery calls with duration & rate details',
    category: 'commerce',
    icon: CalendarClock,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    badge: 'New',
  },
  {
    id: 'coffee',
    title: 'Buy Me a Coffee',
    description: 'Connect your Buy Me a Coffee profile to show supporters, extras & tipping tiers',
    category: 'commerce',
    icon: Coffee,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    badge: 'Popular',
  },
  {
    id: 'tip_jar',
    title: 'Tip Jar & Support',
    description: 'Accept tips and creator support with custom preset amounts via PayPal, UPI, or Stripe',
    category: 'commerce',
    icon: Heart,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    id: 'promo',
    title: 'Promo / Coupon Code',
    description: 'Display affiliate or store discount codes with one-tap copy functionality',
    category: 'commerce',
    icon: Ticket,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    badge: 'New',
  },

  // Audience & Utilities
  {
    id: 'vcard',
    title: 'Digital Contact Card (.vcf)',
    description: 'Allow visitors to save your name, email, phone & company straight to contacts',
    category: 'audience',
    icon: UserCheck,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'countdown',
    title: 'Event / Drop Countdown',
    description: 'Real-time ticking countdown clock for album drops, webinars, or product launches',
    category: 'audience',
    icon: Timer,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    badge: 'New',
  },
  {
    id: 'location',
    title: 'Location & Hours',
    description: 'Share your studio, café, pop-up shop, or venue address with a 1-tap Maps link',
    category: 'audience',
    icon: MapPin,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    badge: 'New',
  },
  {
    id: 'signup',
    title: 'Audience Signup Form',
    description: 'Capture email addresses or phone numbers to grow your direct subscriber list',
    category: 'audience',
    icon: Mail,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    proRequired: true,
  },
  {
    id: 'faq',
    title: 'FAQ Accordion',
    description: 'Collapsible Q&A section to answer common questions, rates, and policies',
    category: 'audience',
    icon: HelpCircle,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },

  // Layout & Structure
  {
    id: 'header',
    title: 'Section Header',
    description: 'Organize your page into clean sections like "Music", "Merch", or "Portfolio"',
    category: 'layout',
    icon: Heading,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-700',
  },
  {
    id: 'divider',
    title: 'Divider Line',
    description: 'A subtle horizontal separation line to group content naturally',
    category: 'layout',
    icon: Minus,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-700',
  },
];

const CATEGORIES = [
  { id: 'all', label: `All (${FEATURES.length})` },
  { id: 'links', label: 'Links & Media' },
  { id: 'commerce', label: 'Commerce & Support' },
  { id: 'audience', label: 'Audience & Utilities' },
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
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro'>('all');

  if (!isOpen) return null;

  const freeCount = FEATURES.filter((f) => !f.proRequired).length;
  const proCount = FEATURES.filter((f) => f.proRequired).length;

  const filteredFeatures = FEATURES.filter((feat) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      feat.title.toLowerCase().includes(q) ||
      feat.description.toLowerCase().includes(q);
    const matchesCategory =
      activeCategory === 'all' || feat.category === activeCategory;
    const matchesTier =
      tierFilter === 'all' ||
      (tierFilter === 'free' && !feat.proRequired) ||
      (tierFilter === 'pro' && Boolean(feat.proRequired));
    return matchesSearch && matchesCategory && matchesTier;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div>
            <h2 className="text-[18px] font-semibold text-ink flex items-center gap-2">
              <span>Add to your page</span>
              <span className="text-[12px] font-normal px-2 py-0.5 rounded-full bg-ink/5 text-muted">
                {FEATURES.length} block types
              </span>
            </h2>
            <p className="text-[13px] text-muted mt-0.5">
              Select a feature block to showcase links, products, bookings, or media
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-ink/5 text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="p-4 border-b border-border/60 bg-surface/50 flex flex-col gap-3 shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              autoFocus
              placeholder="Search blocks (youtube, product, booking, countdown, coupon, maps)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-xl text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[12px]">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-ink text-surface'
                      : 'bg-ink/5 text-muted hover:text-ink hover:bg-ink/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div
              className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-border text-[11px] shrink-0"
              role="group"
              aria-label="Filter by plan tier"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'free', label: `Free (${freeCount})` },
                  { id: 'pro', label: `Pro (${proCount})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTierFilter(t.id)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    tierFilter === t.id
                      ? 'bg-ink text-surface'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredFeatures.map((feat) => {
            const Icon = feat.icon;
            const requiresUpgrade = feat.proRequired && !isPro;

            return (
              <button
                key={feat.id}
                onClick={() => {
                  onClose();
                  onSelectFeature(feat.id);
                }}
                className="group p-3.5 rounded-xl border border-border hover:border-ink/30 bg-surface hover:bg-ink/[0.02] text-left transition-all duration-150 flex items-start gap-3.5 cursor-pointer relative"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${feat.iconBg} ${feat.iconColor} flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105`}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink group-hover:text-ink">
                      {feat.title}
                    </span>
                    {feat.proRequired ? (
                      <>
                        <ProBadge className="scale-90 origin-left" />
                        {requiresUpgrade && (
                          <span className="text-[10px] font-medium text-muted">
                            (Upgrade)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
                        Free
                      </span>
                    )}
                    {feat.badge && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {feat.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed mt-1 line-clamp-2">
                    {feat.description}
                  </p>
                </div>

                <ChevronRight
                  size={16}
                  className="text-muted/40 group-hover:text-ink transition-colors absolute right-3 top-1/2 -translate-y-1/2"
                />
              </button>
            );
          })}

          {filteredFeatures.length === 0 && (
            <div className="col-span-2 py-10 text-center text-muted text-[14px]">
              No features match your search &ldquo;{searchQuery}&rdquo;. Try another term.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

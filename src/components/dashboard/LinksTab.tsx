import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Play,
  Music,
  Headphones,
  Link2,
  Heading,
  Minus,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Archive,
  RotateCcw,
  Pencil,
  Copy,
  Mail,
  Lock,
  Heart,
  HelpCircle,
  UserCheck,
  Search,
  Instagram,
  Youtube,
  Coffee,
  ShoppingBag,
  CalendarClock,
  Timer,
  Ticket,
  MapPin,
  FileDown,
  Globe,
  GripVertical,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import { useBlocks } from '../../data/BlocksContext';
import { useIvioSession } from '../../auth/useIvioSession';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { ProBadge } from '../plan/ProBadge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { EmptyState } from '../ui/EmptyState';
import { PageUrlStrip } from './PageUrlStrip';
import { ImageSection } from '../links/ImageSection';
import { LayoutControl } from '../links/LayoutControl';
import { ScheduleSection } from '../links/ScheduleSection';
import { ScheduleChip } from '../links/ScheduleChip';
import { PasswordSection } from '../links/PasswordSection';
import { EmbedComposer } from '../links/EmbedComposer';
import { SignupComposer } from '../links/SignupComposer';
import { TipJarComposer } from '../links/TipJarComposer';
import { FaqComposer } from '../links/FaqComposer';
import { VCardComposer } from '../links/VCardComposer';
import { InstagramComposer } from '../links/InstagramComposer';
import { CoffeeComposer } from '../links/CoffeeComposer';
import { YouTubeCardComposer } from '../links/YouTubeCardComposer';
import { ProductCardComposer } from '../links/ProductCardComposer';
import { BookingCardComposer } from '../links/BookingCardComposer';
import { CountdownComposer } from '../links/CountdownComposer';
import { PromoCodeComposer } from '../links/PromoCodeComposer';
import { LocationCardComposer } from '../links/LocationCardComposer';
import { DownloadCardComposer } from '../links/DownloadCardComposer';
import { AddBlockModal, FeatureType } from './AddBlockModal';
import { AnimationControl } from '../links/AnimationControl';
import { Block, BlockKind, BlockLayout, LinkAnimation } from '../../data/types';
import { parseEmbedUrl } from '../../lib/embeds';
import { useClickCounts } from '../../data/hooks/useClickCounts';
import { useProtectedLinkIds } from '../../data/hooks/useProtectedLinkIds';
import { copy } from '../../content/copy';
import { SocialLinksCard } from './SocialLinksCard';
import { LinkFaviconOrFallback } from '../ui/LinkFaviconOrFallback';
import {
  detectPlatformFromUrl,
  normalizeComparableDestination,
} from '../../lib/favicons';
import { useToast } from '../ui/Toast';

type FilterCategory = 'all' | 'links' | 'support' | 'media' | 'forms' | 'headers';

const SUPPORT_KINDS: BlockKind[] = ['tip_jar', 'coffee', 'product', 'promo'];
const MEDIA_KINDS: BlockKind[] = ['embed', 'youtube', 'instagram', 'download'];
const FORM_KINDS: BlockKind[] = ['signup', 'faq', 'booking', 'vcard', 'countdown', 'location'];
const HEADER_KINDS: BlockKind[] = ['header', 'divider'];

function getFilterGroup(kind: BlockKind): Exclude<FilterCategory, 'all'> {
  if (kind === 'link') return 'links';
  if (SUPPORT_KINDS.includes(kind)) return 'support';
  if (MEDIA_KINDS.includes(kind)) return 'media';
  if (FORM_KINDS.includes(kind)) return 'forms';
  if (HEADER_KINDS.includes(kind)) return 'headers';
  return 'links';
}

function getBlockTypeChip(block: Block, hasBothSupportTypes: boolean): string | null {
  switch (block.kind) {
    case 'link':
      return null;
    case 'tip_jar':
      return hasBothSupportTypes ? 'Support · Tips' : 'Support';
    case 'coffee':
      return hasBothSupportTypes ? 'Support · Coffee' : 'Support';
    case 'product':
      return 'Product';
    case 'promo':
      return 'Promo';
    case 'embed':
      return 'Embed';
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'download':
      return 'Download';
    case 'signup':
      return 'Form';
    case 'faq':
      return 'FAQ';
    case 'booking':
      return 'Booking';
    case 'vcard':
      return 'Contact';
    case 'countdown':
      return 'Countdown';
    case 'location':
      return 'Location';
    case 'header':
      return 'Header';
    case 'divider':
      return 'Divider';
    default:
      return null;
  }
}

function cleanDisplayDestination(rawUrl: string | null | undefined): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    return trimmed.slice(7);
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/^https?:\/\/(www\.)?/i, '');
  }
}

function getBlockSubtitle(block: Block): string {
  switch (block.kind) {
    case 'tip_jar': {
      const amounts = block.tipJar?.amounts?.filter((n) => Number.isFinite(n)) || [];
      const cur = block.tipJar?.currency || 'USD';
      if (amounts.length > 0) {
        return `${cur} ${amounts.join(' / ')}`;
      }
      return block.tipJar?.paymentUrl
        ? cleanDisplayDestination(block.tipJar.paymentUrl)
        : 'Tip jar';
    }
    case 'coffee':
      return block.url ? cleanDisplayDestination(block.url) : 'buymeacoffee.com';
    case 'faq':
      return `${block.faq?.items?.length || 0} questions & answers`;
    case 'vcard': {
      const contactLine = [block.vcard?.email, block.vcard?.phone, block.vcard?.organization]
        .filter(Boolean)
        .join(' · ');
      return contactLine || 'Digital contact card (.vcf)';
    }
    case 'signup':
      return copy.signup.dashboard.subtitles[block.signup?.collect || 'email'];
    case 'product':
      return [block.product?.price, block.url ? cleanDisplayDestination(block.url) : '']
        .filter(Boolean)
        .join(' · ');
    case 'booking':
      return [block.booking?.duration, block.booking?.priceLabel, block.booking?.platform]
        .filter(Boolean)
        .join(' · ');
    case 'countdown':
      return block.countdown?.targetAt
        ? new Date(block.countdown.targetAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Countdown timer';
    case 'promo':
      return [block.promo?.code, block.promo?.discountLabel].filter(Boolean).join(' · ');
    case 'location':
      return block.location?.address || cleanDisplayDestination(block.url);
    case 'download':
      return [block.download?.fileFormat, block.download?.fileSize].filter(Boolean).join(' · ');
    case 'header':
      return 'Section heading';
    case 'divider':
      return 'Separator line';
    default:
      return cleanDisplayDestination(block.url);
  }
}

export const LinksTab: React.FC = () => {
  const clickCounts = useClickCounts();
  const { showToast } = useToast();
  const {
    blocks,
    isLoading,
    addLink,
    addEmbed,
    addSignupForm,
    addTipJar,
    addCoffee,
    addInstagram,
    addYouTube,
    addProduct,
    addBooking,
    addCountdown,
    addPromo,
    addLocation,
    addDownload,
    addFaq,
    addVCard,
    addHeader,
    addDivider,
    updateBlock,
    setBlockImage,
    deleteBlock,
    toggleArchive,
    toggleActive,
    reorderBlocks,
    clearSchedule,
    duplicateBlock,
  } = useBlocks();

  const { isPro, username, displayName, primaryEmail, socials } = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { protectedIds } = useProtectedLinkIds();

  // Add block modal + Social Card jump trigger
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [socialAddTrigger, setSocialAddTrigger] = useState(0);

  // Search & accurate category filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  // Drag & drop state
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  // Active composer
  type ComposerType =
    | 'link'
    | 'embed'
    | 'signup'
    | 'header'
    | 'tip_jar'
    | 'faq'
    | 'vcard'
    | 'instagram'
    | 'coffee'
    | 'youtube'
    | 'product'
    | 'booking'
    | 'countdown'
    | 'promo'
    | 'location'
    | 'download';
  const [activeComposer, setActiveComposer] = useState<ComposerType | null>(null);

  // Quick inputs for link/header composers
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkTitleManuallyEdited, setNewLinkTitleManuallyEdited] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newHeaderTitle, setNewHeaderTitle] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);

  // Editing block id
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editLayout, setEditLayout] = useState<BlockLayout>('classic');
  const [editAnimation, setEditAnimation] = useState<LinkAnimation>('none');
  const [editBadge, setEditBadge] = useState<string>('');
  const [editStartAt, setEditStartAt] = useState<string | null>(null);
  const [editEndAt, setEditEndAt] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm modal
  const [deletingBlock, setDeletingBlock] = useState<Block | null>(null);

  // Active overflow menu dropdown id
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Show archived items
  const [showArchived, setShowArchived] = useState(false);

  // Close overflow menu on outside click or Esc
  useEffect(() => {
    if (!activeMenuId) return;
    const onPointerDown = (e: MouseEvent) => {
      if (listContainerRef.current && !listContainerRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeMenuId]);

  const activeBlocks = blocks.filter((b) => !b.isArchived);
  const archivedBlocks = blocks.filter((b) => b.isArchived);

  // Normalized social destinations set for duplicate detection
  const socialDestinationsSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(socials || {}).forEach((url) => {
      const norm = normalizeComparableDestination(url);
      if (norm) set.add(norm);
    });
    return set;
  }, [socials]);

  // Check if user has both Coffee and Tip Jar blocks so we can disambiguate or merge
  const coffeeBlocks = activeBlocks.filter((b) => b.kind === 'coffee');
  const tipJarBlocks = activeBlocks.filter((b) => b.kind === 'tip_jar');
  const hasBothSupportTypes = coffeeBlocks.length > 0 && tipJarBlocks.length > 0;

  // Accurate filter chip counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: activeBlocks.length,
      links: 0,
      support: 0,
      media: 0,
      forms: 0,
      headers: 0,
    };
    for (const b of activeBlocks) {
      counts[getFilterGroup(b.kind)] += 1;
    }
    return counts;
  }, [activeBlocks]);

  // Reset filter to 'all' if selected category becomes empty
  useEffect(() => {
    if (filterCategory !== 'all' && categoryCounts[filterCategory] === 0) {
      setFilterCategory('all');
    }
  }, [filterCategory, categoryCounts]);

  const filteredActiveBlocks = activeBlocks.filter((b) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = b.title ? b.title.toLowerCase().includes(q) : false;
      const urlMatch = b.url ? b.url.toLowerCase().includes(q) : false;
      const vcardMatch = b.vcard
        ? (b.vcard.fullName && b.vcard.fullName.toLowerCase().includes(q)) ||
          (b.vcard.organization && b.vcard.organization.toLowerCase().includes(q)) ||
          (b.vcard.title && b.vcard.title.toLowerCase().includes(q))
        : false;
      if (!titleMatch && !urlMatch && !vcardMatch) return false;
    }

    if (filterCategory === 'all') return true;
    return getFilterGroup(b.kind) === filterCategory;
  });

  // Auto-suggest platform name in Quick Link composer when URL changes
  const handleNewLinkUrlChange = (val: string) => {
    setNewLinkUrl(val);
    if (!newLinkTitleManuallyEdited) {
      const detected = detectPlatformFromUrl(val);
      if (detected) {
        setNewLinkTitle(detected.name);
      }
    }
  };

  // Composer opening handlers
  const handleOpenComposer = (type: ComposerType) => {
    setEditingBlockId(null);
    setActiveMenuId(null);
    if (type === 'embed' && !isPro) {
      openUpgrade('embeds');
      return;
    }
    if (type === 'signup' && !isPro) {
      openUpgrade('contact_forms');
      return;
    }
    setActiveComposer(type);
    setComposerError(null);
  };

  const handleCloseComposer = () => {
    setActiveComposer(null);
    setNewLinkTitle('');
    setNewLinkTitleManuallyEdited(false);
    setNewLinkUrl('');
    setNewHeaderTitle('');
    setComposerError(null);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim()) {
      setComposerError('URL is required.');
      return;
    }
    const detected = detectPlatformFromUrl(newLinkUrl.trim());
    const finalTitle = newLinkTitle.trim() || detected?.name || '';
    if (!finalTitle) {
      setComposerError('Title is required.');
      return;
    }

    try {
      await addLink(finalTitle, newLinkUrl.trim());
      handleCloseComposer();
    } catch {
      setComposerError("Couldn't add link. Try again.");
    }
  };

  const handleCreateHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeaderTitle.trim()) {
      setComposerError('Heading text is required.');
      return;
    }

    try {
      await addHeader(newHeaderTitle.trim());
      handleCloseComposer();
    } catch {
      setComposerError("Couldn't add header. Try again.");
    }
  };

  const handleStartEdit = (block: Block) => {
    setActiveComposer(null);
    setActiveMenuId(null);
    setEditingBlockId(block.id);
    setEditTitle(block.title);
    setEditUrl(block.url || '');
    setEditLayout(block.layout || 'classic');
    setEditAnimation(block.animation || 'none');
    setEditBadge(block.badge || '');
    setEditStartAt(block.startAt);
    setEditEndAt(block.endAt);
    setEditError(null);
  };

  const handleSaveEdit = async (block: Block) => {
    setEditError(null);

    if (editStartAt && editEndAt) {
      if (new Date(editEndAt) <= new Date(editStartAt)) {
        setEditError('Hide time must be after the show time.');
        return;
      }
    }
    if (
      editEndAt &&
      editEndAt !== (block.endAt || null) &&
      new Date(editEndAt) <= new Date()
    ) {
      setEditError('Choose a time in the future.');
      return;
    }

    if (block.kind === 'link') {
      if (!editTitle.trim()) {
        setEditError('Title is required.');
        return;
      }
      if (!editUrl.trim()) {
        setEditError('URL is required.');
        return;
      }

      try {
        await updateBlock(block.id, {
          title: editTitle.trim(),
          url: editUrl.trim(),
          layout: block.thumbnailPath ? editLayout : 'classic',
          animation: editAnimation,
          badge: editBadge.trim() || null,
          startAt: editStartAt,
          endAt: editEndAt,
        });
        setEditingBlockId(null);
        showToast('Saved');
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('scheduling');
        } else {
          setEditError("Couldn't save changes.");
        }
      }
    } else if (block.kind === 'embed') {
      const parsed = parseEmbedUrl(editUrl.trim());
      if (!parsed) {
        setEditError('Use a YouTube, Spotify, SoundCloud, Discord, GitHub, LinkedIn, or X link.');
        return;
      }

      const urlChanged = parsed.canonicalUrl !== (block.url || '');
      let nextEmbedMeta = block.embedMeta ?? null;
      if (urlChanged) {
        nextEmbedMeta = null;
        try {
          const res = await fetch(
            `/api/integrations/embed?url=${encodeURIComponent(parsed.canonicalUrl)}`
          );
          const data = await res.json().catch(() => null);
          const resolvedMeta = data?.embed || data?.embedMeta;
          if (res.ok && data?.ok && resolvedMeta) {
            nextEmbedMeta = resolvedMeta;
          }
        } catch {
          nextEmbedMeta = null;
        }
      }

      try {
        await updateBlock(block.id, {
          title: editTitle.trim(),
          url: parsed.canonicalUrl,
          embedProvider: parsed.provider,
          embedMeta: nextEmbedMeta,
          startAt: editStartAt,
          endAt: editEndAt,
        });
        setEditingBlockId(null);
        showToast('Saved');
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('embeds');
        } else {
          setEditError("Couldn't save changes.");
        }
      }
    } else if (block.kind === 'header') {
      if (!editTitle.trim()) {
        setEditError('Heading text is required.');
        return;
      }
      try {
        await updateBlock(block.id, { title: editTitle.trim() });
        setEditingBlockId(null);
        showToast('Saved');
      } catch {
        setEditError("Couldn't save changes.");
      }
    }
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = activeBlocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeBlocks.length) return;

    const reordered = [...activeBlocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    reorderBlocks(reordered.map((b) => b.id));
  };

  const handleDropOnBlock = (targetBlockId: string) => {
    if (!draggedBlockId || draggedBlockId === targetBlockId) {
      setDraggedBlockId(null);
      setDragOverBlockId(null);
      return;
    }
    const ids = activeBlocks.map((b) => b.id);
    const fromIdx = ids.indexOf(draggedBlockId);
    const toIdx = ids.indexOf(targetBlockId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, moved);
      reorderBlocks(ids);
    }
    setDraggedBlockId(null);
    setDragOverBlockId(null);
  };

  const handleMergeSupportBlocks = async () => {
    if (tipJarBlocks.length === 0 || coffeeBlocks.length === 0) return;
    // Keep the Tip Jar block as the unified support block and archive Coffee blocks
    for (const c of coffeeBlocks) {
      await toggleArchive(c.id);
    }
    showToast('Support blocks merged');
  };

  const allFilterChips: { id: FilterCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: categoryCounts.all },
    { id: 'links', label: 'Links', count: categoryCounts.links },
    { id: 'support', label: 'Support', count: categoryCounts.support },
    { id: 'media', label: 'Media', count: categoryCounts.media },
    { id: 'forms', label: 'Forms', count: categoryCounts.forms },
    { id: 'headers', label: 'Headers', count: categoryCounts.headers },
  ];
  const filterChips = allFilterChips.filter((c) => c.id === 'all' || c.count > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Your page URL strip */}
      <PageUrlStrip username={username} />

      {/* 2. Single Toolbar: "+ Add" + Search */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 shrink-0"
          >
            <Plus size={18} strokeWidth={2} />
            <span>Add</span>
          </Button>

          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              strokeWidth={1.5}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search blocks..."
              aria-label="Search blocks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 min-h-[44px] pl-10 pr-8 text-[14px] bg-surface border border-border rounded-[12px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-ink text-[13px] rounded-full cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Accurate Filter Chips */}
        {activeBlocks.length > 1 && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 text-[12px]">
            <div className="flex items-center gap-1.5 shrink-0">
              {filterChips.map((chip) => {
                const selected = filterCategory === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilterCategory(chip.id)}
                    aria-pressed={selected}
                    className={`min-h-[34px] px-3 py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-ink text-surface'
                        : 'bg-surface border border-border text-muted hover:text-ink hover:border-border-strong'
                    }`}
                  >
                    {chip.label} ({chip.count})
                  </button>
                );
              })}
            </div>

            {archivedBlocks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="ml-auto min-h-[34px] text-[12px] text-muted hover:text-ink font-medium px-3 py-1 rounded-full bg-surface border border-border hover:border-border-strong shrink-0 transition-colors cursor-pointer"
              >
                {showArchived ? 'Hide archived' : `Archived (${archivedBlocks.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Support Blocks De-duplication Helper */}
      {hasBothSupportTypes && !activeComposer && (
        <div className="p-3 rounded-[14px] bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5 text-[13px] text-ink">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              You have both a Coffee block and a Tip Jar block. Keep one support block for a cleaner page.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMergeSupportBlocks}
            className="shrink-0 self-start sm:self-center"
          >
            Merge support blocks
          </Button>
        </div>
      )}

      {/* 3. Active Composer */}
      {activeComposer === 'link' && (
        <Card className="border-ink/30">
          <form onSubmit={handleCreateLink} className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Add link</h3>
                <p className="text-[12px] text-muted">
                  Add a destination URL — known platforms auto-fill their name and icon.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseComposer}
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-link-url" className="text-[13px] font-medium text-ink">
                  URL
                </label>
                <input
                  id="new-link-url"
                  type="url"
                  autoFocus
                  value={newLinkUrl}
                  onChange={(e) => handleNewLinkUrlChange(e.target.value)}
                  placeholder="https://github.com/username"
                  className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-link-title" className="text-[13px] font-medium text-ink">
                  Title
                </label>
                <input
                  id="new-link-title"
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => {
                    setNewLinkTitle(e.target.value);
                    setNewLinkTitleManuallyEdited(e.target.value.trim().length > 0);
                  }}
                  placeholder="e.g. GitHub, Portfolio, Store"
                  className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
                />
              </div>
            </div>

            {composerError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                {composerError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="md">
                Add to page
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={handleCloseComposer}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeComposer === 'embed' && (
        <EmbedComposer
          onAdd={async ({ url, caption, provider, embedMeta }) => {
            await addEmbed(url, caption, provider, embedMeta);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'signup' && (
        <SignupComposer
          ownerName={username || undefined}
          onSave={async (cfg) => {
            await addSignupForm(cfg);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'header' && (
        <Card className="border-ink/30">
          <form onSubmit={handleCreateHeader} className="flex flex-col gap-3.5">
            <h3 className="text-[16px] font-semibold text-ink">New section header</h3>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-header-title" className="text-[14px] font-medium text-ink">
                Heading
              </label>
              <input
                id="new-header-title"
                type="text"
                autoFocus
                maxLength={40}
                value={newHeaderTitle}
                onChange={(e) => setNewHeaderTitle(e.target.value)}
                placeholder="e.g. Featured work"
                className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
            </div>

            {composerError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                {composerError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="primary" size="md">
                Add header
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={handleCloseComposer}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeComposer === 'tip_jar' && (
        <TipJarComposer
          onAdd={async (cfg, title) => {
            await addTipJar(cfg, title);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'faq' && (
        <FaqComposer
          onAdd={async (items, title) => {
            await addFaq(items, title);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'vcard' && (
        <VCardComposer
          onSave={async (cfg, title) => {
            await addVCard(cfg, title);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
          defaultFullName={displayName || username || ''}
          defaultEmail={primaryEmail || ''}
        />
      )}

      {activeComposer === 'instagram' && (
        <InstagramComposer
          onAdd={async ({ title, url, badge }) => {
            await addInstagram(title, url, badge);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'coffee' && (
        <CoffeeComposer
          onAdd={async ({ title, url, badge, coffee }) => {
            await addCoffee(title, url, badge, coffee || null);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'youtube' && (
        <YouTubeCardComposer
          onAdd={async ({ title, url, badge, youtube }) => {
            await addYouTube(title, url, badge, youtube || null);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'product' && (
        <ProductCardComposer
          onAdd={async ({ title, url, product }) => {
            await addProduct(title, url, product);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'booking' && (
        <BookingCardComposer
          onAdd={async ({ title, url, booking }) => {
            await addBooking(title, url, booking);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'countdown' && (
        <CountdownComposer
          onAdd={async ({ title, url, countdown }) => {
            await addCountdown(title, url, countdown);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'promo' && (
        <PromoCodeComposer
          onAdd={async ({ title, url, promo }) => {
            await addPromo(title, url, promo);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'location' && (
        <LocationCardComposer
          onAdd={async ({ title, url, location }) => {
            await addLocation(title, url, location);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {activeComposer === 'download' && (
        <DownloadCardComposer
          onAdd={async ({ title, url, download }) => {
            await addDownload(title, url, download);
            handleCloseComposer();
          }}
          onCancel={handleCloseComposer}
        />
      )}

      {/* 4. Block List */}
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-label="Loading blocks">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-[72px] rounded-[16px] bg-surface border border-border animate-pulse"
            />
          ))}
        </div>
      ) : activeBlocks.length === 0 ? (
        !activeComposer ? (
          <EmptyState
            icon={<Link2 size={22} strokeWidth={1.5} />}
            title="No links yet"
            description="Add your first link, social icon, embed, or support block to get started."
            actionLabel="Add your first link"
            onAction={() => handleOpenComposer('link')}
          />
        ) : null
      ) : filteredActiveBlocks.length === 0 ? (
        <EmptyState
          icon={<Search size={20} strokeWidth={1.5} />}
          title={`No items match ${searchQuery ? `"${searchQuery}"` : 'this filter'}`}
          description="Try clearing your search or switching back to All."
          actionLabel="Clear filters"
          onAction={() => {
            setSearchQuery('');
            setFilterCategory('all');
          }}
        />
      ) : (
        <div ref={listContainerRef} className="flex flex-col gap-3">
          {filteredActiveBlocks.map((block) => {
            const actualIndex = activeBlocks.findIndex((b) => b.id === block.id);
            const isEditing = editingBlockId === block.id;
            const isEmbed = block.kind === 'embed';
            const isHeader = block.kind === 'header';
            const isDivider = block.kind === 'divider';
            const isSignup = block.kind === 'signup';
            const isTipJar = block.kind === 'tip_jar';
            const isFaq = block.kind === 'faq';
            const isVCard = block.kind === 'vcard';
            const isInstagram = block.kind === 'instagram';
            const isCoffee = block.kind === 'coffee';
            const isYouTube = block.kind === 'youtube';
            const isProduct = block.kind === 'product';
            const isBooking = block.kind === 'booking';
            const isCountdown = block.kind === 'countdown';
            const isPromo = block.kind === 'promo';
            const isLocation = block.kind === 'location';
            const isDownload = block.kind === 'download';
            const isLink = block.kind === 'link';
            const isProtected =
              isLink && (protectedIds.has(block.id) || block.isProtected === true);
            const isProLocked =
              !isPro && (isEmbed || isSignup || Boolean(block.startAt || block.endAt) || isProtected);

            const clicks = clickCounts.get(block.id) || 0;
            const clickText = clicks === 1 ? '1 click' : `${clicks} clicks`;
            const typeChip = getBlockTypeChip(block, hasBothSupportTypes);
            const subtitle = getBlockSubtitle(block);

            // Detect platform for Link blocks so ambiguous/identical titles get clear identity
            const detectedPlatform =
              isLink && block.url ? detectPlatformFromUrl(block.url) : null;
            const displayTitle = (() => {
              if (isDivider) return 'Divider';
              if (isSignup) return block.signup?.heading || block.title || copy.signup.dashboard.defaultHeading;
              if (isTipJar) return block.tipJar?.buttonText || block.title || 'Tip Jar';
              if (isFaq) return block.title || 'FAQ';
              if (isVCard) return block.vcard?.fullName || block.title || 'Contact Card';
              const raw = block.title || (isEmbed ? 'Embed' : 'Untitled');
              if (
                isLink &&
                detectedPlatform &&
                !raw.toLowerCase().includes(detectedPlatform.name.toLowerCase())
              ) {
                return `${detectedPlatform.name} · ${raw}`;
              }
              return raw;
            })();

            const blockNormalizedDest = block.url
              ? normalizeComparableDestination(block.url)
              : '';
            const isDuplicateSocial =
              Boolean(blockNormalizedDest) &&
              socialDestinationsSet.has(blockNormalizedDest) &&
              (isLink || isInstagram || isYouTube);

            const ProviderGlyph =
              block.embedProvider === 'youtube'
                ? Play
                : block.embedProvider === 'spotify'
                  ? Music
                  : block.embedProvider === 'soundcloud'
                    ? Headphones
                    : Globe;

            return (
              <Card
                key={block.id}
                draggable={!isEditing}
                onDragStart={() => setDraggedBlockId(block.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedBlockId && draggedBlockId !== block.id) {
                    setDragOverBlockId(block.id);
                  }
                }}
                onDrop={() => handleDropOnBlock(block.id)}
                onDragEnd={() => {
                  setDraggedBlockId(null);
                  setDragOverBlockId(null);
                }}
                className={`transition-all duration-120 ${
                  isEditing
                    ? 'ring-2 ring-ink p-4 sm:p-5'
                    : dragOverBlockId === block.id
                      ? 'border-ink bg-surface-2/40 p-3 sm:px-4 sm:py-3'
                      : draggedBlockId === block.id
                        ? 'opacity-50 p-3 sm:px-4 sm:py-3'
                        : 'p-3 sm:px-4 sm:py-3'
                }`}
              >
                {!isEditing ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2.5 min-h-[48px]">
                      {/* Left: Drag Handle + Icon + Title/Subtitle (whole main area tappable to edit) */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className="w-6 h-10 flex items-center justify-center text-muted/60 hover:text-ink cursor-grab active:cursor-grabbing shrink-0 touch-none"
                          title="Drag to reorder"
                          aria-hidden="true"
                        >
                          <GripVertical size={18} strokeWidth={1.5} />
                        </span>

                        <div
                          role={isDivider ? undefined : 'button'}
                          tabIndex={isDivider ? undefined : 0}
                          onClick={() => {
                            if (!isDivider) handleStartEdit(block);
                          }}
                          onKeyDown={(e) => {
                            if (!isDivider && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleStartEdit(block);
                            }
                          }}
                          className={`flex items-center gap-3 min-w-0 flex-1 ${
                            isDivider ? '' : 'cursor-pointer'
                          }`}
                        >
                          {/* 40px icon tile */}
                          <div className="w-10 h-10 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden text-ink">
                            {isLink && block.thumbnailUrl ? (
                              <img
                                src={block.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : isEmbed ? (
                              <ProviderGlyph size={20} strokeWidth={1.5} />
                            ) : isSignup ? (
                              <Mail size={20} className="text-muted" strokeWidth={1.5} />
                            ) : isTipJar ? (
                              <Heart size={20} className="text-rose-500" strokeWidth={1.5} />
                            ) : isFaq ? (
                              <HelpCircle size={20} className="text-sky-600" strokeWidth={1.5} />
                            ) : isVCard ? (
                              <UserCheck size={20} className="text-emerald-600" strokeWidth={1.5} />
                            ) : isInstagram ? (
                              <Instagram size={20} className="text-rose-500" strokeWidth={1.5} />
                            ) : isYouTube ? (
                              <Youtube size={20} className="text-red-600" strokeWidth={1.5} />
                            ) : isCoffee ? (
                              <Coffee size={20} className="text-amber-700" strokeWidth={1.5} />
                            ) : isProduct ? (
                              <ShoppingBag size={20} className="text-emerald-600" strokeWidth={1.5} />
                            ) : isBooking ? (
                              <CalendarClock size={20} className="text-indigo-600" strokeWidth={1.5} />
                            ) : isCountdown ? (
                              <Timer size={20} className="text-orange-600" strokeWidth={1.5} />
                            ) : isPromo ? (
                              <Ticket size={20} className="text-pink-600" strokeWidth={1.5} />
                            ) : isLocation ? (
                              <MapPin size={20} className="text-sky-600" strokeWidth={1.5} />
                            ) : isDownload ? (
                              <FileDown size={20} className="text-violet-600" strokeWidth={1.5} />
                            ) : isHeader ? (
                              <Heading size={20} className="text-muted" strokeWidth={1.5} />
                            ) : isDivider ? (
                              <Minus size={20} className="text-muted" strokeWidth={1.5} />
                            ) : isLink ? (
                              <LinkFaviconOrFallback url={block.url} size={20} strokeWidth={1.5} />
                            ) : (
                              <Link2 size={20} className="text-muted" strokeWidth={1.5} />
                            )}
                          </div>

                          {/* Text Block */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span
                                className={`text-[14px] font-semibold truncate max-w-full ${
                                  !block.isActive ? 'text-muted' : 'text-ink'
                                }`}
                              >
                                {displayTitle}
                              </span>

                              {typeChip && (
                                <span className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium bg-surface-2 text-muted border border-border shrink-0">
                                  {typeChip}
                                </span>
                              )}

                              <ScheduleChip block={block} isActive={block.isActive} />

                              {isProtected && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium bg-surface-2 text-muted border border-border shrink-0">
                                  <Lock size={10} className="shrink-0" />
                                  <span>Locked</span>
                                </span>
                              )}

                              {isProLocked && <ProBadge locked />}
                            </div>

                            {/* Single-line clean destination/amounts subtitle + click count */}
                            <div className="flex items-center text-[12px] text-muted leading-snug mt-0.5 overflow-hidden">
                              <span className="truncate min-w-0">
                                {subtitle || 'No destination set'}
                              </span>
                              {clicks > 0 && (
                                <span
                                  title={copy.dashboard.analytics.linksTab.titleTooltip}
                                  className="shrink-0 whitespace-nowrap ml-1.5 tabular-nums"
                                >
                                  · {clickText}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Controls: Visible Toggle + Overflow "..." Menu */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {!isDivider && (
                          <Toggle
                            checked={block.isActive}
                            onChange={() => toggleActive(block.id)}
                            ariaLabel={`Toggle visibility for ${displayTitle}`}
                          />
                        )}

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === block.id ? null : block.id)
                            }
                            aria-label={`More options for ${displayTitle}`}
                            aria-expanded={activeMenuId === block.id}
                            aria-haspopup="menu"
                            className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                          >
                            <MoreHorizontal size={20} strokeWidth={1.5} />
                          </button>

                          {activeMenuId === block.id && (
                            <div
                              role="menu"
                              className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-[12px] shadow-[0_12px_32px_rgba(10,10,10,0.12)] py-1.5 z-30"
                            >
                              {!isDivider && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleStartEdit(block)}
                                  className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer"
                                >
                                  <Pencil size={15} strokeWidth={1.5} className="text-muted" />
                                  <span>Edit</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={async () => {
                                  setActiveMenuId(null);
                                  await duplicateBlock(block);
                                }}
                                className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer"
                              >
                                <Copy size={15} strokeWidth={1.5} className="text-muted" />
                                <span>Duplicate</span>
                              </button>

                              {actualIndex > 0 && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    moveBlock(block.id, 'up');
                                  }}
                                  className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer"
                                >
                                  <ArrowUp size={15} strokeWidth={1.5} className="text-muted" />
                                  <span>Move up</span>
                                </button>
                              )}

                              {actualIndex !== -1 && actualIndex < activeBlocks.length - 1 && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    moveBlock(block.id, 'down');
                                  }}
                                  className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer"
                                >
                                  <ArrowDown size={15} strokeWidth={1.5} className="text-muted" />
                                  <span>Move down</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  toggleArchive(block.id);
                                }}
                                className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer"
                              >
                                <Archive size={15} strokeWidth={1.5} className="text-muted" />
                                <span>Archive</span>
                              </button>

                              <div className="my-1 border-t border-divider" />

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setDeletingBlock(block);
                                }}
                                className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-[color:var(--error,#B3261E)] hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                              >
                                <Trash2 size={15} strokeWidth={1.5} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Duplicate warning banner when matching a Social icon */}
                    {isDuplicateSocial && (
                      <div className="pt-2 border-t border-divider flex items-center justify-between gap-2 text-[12px]">
                        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>Also in Social icons</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteBlock(block.id)}
                          className="text-[12px] font-semibold text-ink hover:underline cursor-pointer shrink-0"
                        >
                          Remove duplicate
                        </button>
                      </div>
                    )}
                  </div>
                ) : isSignup ? (
                  <SignupComposer
                    initialValues={block.signup || undefined}
                    ownerName={username || undefined}
                    isEditing
                    onSave={async (config) => {
                      await updateBlock(block.id, {
                        title: config.heading || block.title,
                        signup: config,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isTipJar ? (
                  <TipJarComposer
                    initialValues={block.tipJar || undefined}
                    initialTitle={block.title || undefined}
                    isEditing
                    onAdd={async (config, title) => {
                      await updateBlock(block.id, {
                        title,
                        tipJar: config,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isFaq ? (
                  <FaqComposer
                    initialItems={block.faq?.items || undefined}
                    initialTitle={block.title || undefined}
                    isEditing
                    onAdd={async (items, title) => {
                      await updateBlock(block.id, {
                        title,
                        faq: { items },
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isVCard ? (
                  <VCardComposer
                    initialConfig={block.vcard || undefined}
                    onSave={async (cfg, title) => {
                      await updateBlock(block.id, {
                        title: title || cfg.fullName,
                        vcard: cfg,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                    defaultFullName={displayName || username || ''}
                    defaultEmail={primaryEmail || ''}
                  />
                ) : isInstagram ? (
                  <InstagramComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      badge: block.badge || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, badge }) => {
                      await updateBlock(block.id, {
                        title,
                        url,
                        badge: badge || null,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isCoffee ? (
                  <CoffeeComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      badge: block.badge || undefined,
                      coffee: block.coffee || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, badge, coffee }) => {
                      await updateBlock(block.id, {
                        title,
                        url,
                        badge: badge || null,
                        coffee: coffee || null,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isYouTube ? (
                  <YouTubeCardComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      badge: block.badge || undefined,
                      youtube: block.youtube || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, badge, youtube }) => {
                      await updateBlock(block.id, {
                        title,
                        url,
                        badge: badge || null,
                        youtube: youtube || null,
                      });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isProduct ? (
                  <ProductCardComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      product: block.product || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, product }) => {
                      await updateBlock(block.id, { title, url, product });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isBooking ? (
                  <BookingCardComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      booking: block.booking || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, booking }) => {
                      await updateBlock(block.id, { title, url, booking });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isCountdown ? (
                  <CountdownComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      countdown: block.countdown || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, countdown }) => {
                      await updateBlock(block.id, { title, url, countdown });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isPromo ? (
                  <PromoCodeComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      promo: block.promo || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, promo }) => {
                      await updateBlock(block.id, { title, url, promo });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isLocation ? (
                  <LocationCardComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      location: block.location || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, location }) => {
                      await updateBlock(block.id, { title, url, location });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : isDownload ? (
                  <DownloadCardComposer
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      download: block.download || undefined,
                    }}
                    isEditing
                    onAdd={async ({ title, url, download }) => {
                      await updateBlock(block.id, { title, url, download });
                      setEditingBlockId(null);
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[16px] font-semibold text-ink">
                        Edit {isEmbed ? 'embed' : isHeader ? 'header' : 'link'}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingBlockId(null)}
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[14px] font-medium text-ink">
                        {isHeader ? 'Heading' : isEmbed ? 'Caption' : 'Title'}
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={isEmbed ? 'Optional' : ''}
                        className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>

                    {(isLink || isEmbed) && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-ink">
                          {isEmbed ? 'Embed link' : 'URL'}
                        </label>
                        <input
                          type={isEmbed ? 'text' : 'url'}
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        />
                      </div>
                    )}

                    {isLink && (
                      <ImageSection
                        userId={username || 'owner'}
                        blockId={block.id}
                        thumbnailPath={block.thumbnailPath}
                        thumbnailUrl={block.thumbnailUrl}
                        onImageChanged={async (newPath, newUrl) => {
                          const layout = newPath ? editLayout : 'classic';
                          setEditLayout(layout);
                          await setBlockImage(block.id, newPath, layout, newUrl);
                        }}
                      />
                    )}

                    {isLink && (
                      <LayoutControl
                        hasImage={!!block.thumbnailPath}
                        layout={editLayout}
                        onChange={(l) => setEditLayout(l)}
                      />
                    )}

                    {isLink && (
                      <AnimationControl
                        animation={editAnimation}
                        badge={editBadge}
                        onAnimationChange={(anim) => setEditAnimation(anim)}
                        onBadgeChange={(badgeText) => setEditBadge(badgeText)}
                      />
                    )}

                    {isLink && (
                      <PasswordSection
                        isPro={isPro}
                        linkId={block.id}
                        isProtected={protectedIds.has(block.id) || block.isProtected === true}
                        onPasswordSet={() => updateBlock(block.id, { isProtected: true })}
                        onPasswordRemoved={() => updateBlock(block.id, { isProtected: false })}
                      />
                    )}

                    {(isLink || isEmbed) && (
                      <ScheduleSection
                        isPro={isPro}
                        startAt={editStartAt}
                        endAt={editEndAt}
                        onChange={(s, e) => {
                          setEditStartAt(s);
                          setEditEndAt(e);
                        }}
                        onClearScheduleImmediate={async () => {
                          setEditStartAt(null);
                          setEditEndAt(null);
                          setEditError(null);
                          await clearSchedule(block.id);
                        }}
                        errorMessage={editError}
                      />
                    )}

                    {editError && (
                      <p className="text-[13px] text-[color:var(--error,#B3261E)]" role="alert">
                        {editError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setEditingBlockId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleSaveEdit(block)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. Archived Section */}
      {archivedBlocks.length > 0 && (
        <div className="pt-2 border-t border-divider">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink py-2 cursor-pointer"
          >
            <span>Archived ({archivedBlocks.length})</span>
            {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showArchived && (
            <div className="mt-2 flex flex-col gap-2">
              {archivedBlocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 bg-surface border border-border rounded-[12px] text-muted text-[14px]"
                >
                  <span className="truncate pr-2">{b.title || 'Untitled'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleArchive(b.id)}
                      className="text-ink"
                    >
                      <RotateCcw size={14} />
                      <span>Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingBlock(b)}
                      className="text-[color:var(--error,#B3261E)]"
                      aria-label={`Delete ${b.title || 'archived item'}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Social Icons Card (collapsible) */}
      <SocialLinksCard externalAddTrigger={socialAddTrigger} />

      {/* 7. Delete Confirm Dialog */}
      {deletingBlock && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] sm:p-4"
          onClick={() => setDeletingBlock(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-surface border border-border rounded-t-[20px] sm:rounded-[16px] p-6 shadow-xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          >
            <h3 className="text-[18px] font-semibold text-ink">
              {deletingBlock.kind === 'signup'
                ? copy.signup.dashboard.deleteDialogTitle
                : `Delete ${deletingBlock.title ? `"${deletingBlock.title}"` : 'this item'}?`}
            </h3>
            <p className="mt-2 text-[14px] text-muted leading-relaxed">
              {deletingBlock.kind === 'signup'
                ? copy.signup.dashboard.deleteDialogBody
                : 'This cannot be undone. You can also archive it if you might need it later.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setDeletingBlock(null)}
                className="order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="order-1 sm:order-2 bg-[color:var(--error,#B3261E)] hover:bg-red-700 text-white"
                onClick={async () => {
                  const id = deletingBlock.id;
                  setDeletingBlock(null);
                  await deleteBlock(id);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Unified "+ Add" Picker BottomSheet */}
      <AddBlockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectFeature={async (type: FeatureType) => {
          if (type === 'social') {
            setSocialAddTrigger((n) => n + 1);
            setTimeout(() => {
              document
                .getElementById('social-icons-card')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
          } else if (type === 'divider') {
            await addDivider();
          } else {
            handleOpenComposer(type as ComposerType);
          }
        }}
        isPro={isPro}
      />
    </div>
  );
};

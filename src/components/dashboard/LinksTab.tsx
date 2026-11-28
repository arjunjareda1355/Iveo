import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
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
  Coffee,
  ShoppingBag,
  CalendarClock,
  Timer,
  Ticket,
  MapPin,
  FileDown,
  GripVertical,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  RefreshCw,
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
import type { PlatformEditorSavePayload } from '../links/PlatformBlockEditor';
import { ProviderGlyph } from '../page/EmbedBlock';
import { getProviderDefinition } from '../../lib/providers';
import type { FeatureType } from './AddBlockModal';
import { BlueskySocialIcon } from '../phone/SocialIcons';
import { Loader } from '../ui/Loader';

const PlatformBlockEditor = lazy(() =>
  import('../links/PlatformBlockEditor').then((m) => ({ default: m.PlatformBlockEditor }))
);
const AddBlockModal = lazy(() =>
  import('./AddBlockModal').then((m) => ({ default: m.AddBlockModal }))
);
const SignupComposer = lazy(() =>
  import('../links/SignupComposer').then((m) => ({ default: m.SignupComposer }))
);
const TipJarComposer = lazy(() =>
  import('../links/TipJarComposer').then((m) => ({ default: m.TipJarComposer }))
);
const FaqComposer = lazy(() =>
  import('../links/FaqComposer').then((m) => ({ default: m.FaqComposer }))
);
const VCardComposer = lazy(() =>
  import('../links/VCardComposer').then((m) => ({ default: m.VCardComposer }))
);
const CoffeeComposer = lazy(() =>
  import('../links/CoffeeComposer').then((m) => ({ default: m.CoffeeComposer }))
);
const ProductCardComposer = lazy(() =>
  import('../links/ProductCardComposer').then((m) => ({ default: m.ProductCardComposer }))
);
const BookingCardComposer = lazy(() =>
  import('../links/BookingCardComposer').then((m) => ({ default: m.BookingCardComposer }))
);
const CountdownComposer = lazy(() =>
  import('../links/CountdownComposer').then((m) => ({ default: m.CountdownComposer }))
);
const PromoCodeComposer = lazy(() =>
  import('../links/PromoCodeComposer').then((m) => ({ default: m.PromoCodeComposer }))
);
const LocationCardComposer = lazy(() =>
  import('../links/LocationCardComposer').then((m) => ({ default: m.LocationCardComposer }))
);
const DownloadCardComposer = lazy(() =>
  import('../links/DownloadCardComposer').then((m) => ({ default: m.DownloadCardComposer }))
);
const BlueskyComposer = lazy(() =>
  import('../links/BlueskyComposer').then((m) => ({ default: m.BlueskyComposer }))
);
import { AnimationControl } from '../links/AnimationControl';
import {
  Block,
  BlockKind,
  BlockLayout,
  EmbedProvider,
  LinkAnimation,
} from '../../data/types';
import { parseEmbedUrl } from '../../lib/embeds';
import { isSocialEmbedProvider } from '../../lib/embedLooks';
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

type FilterCategory = 'all' | 'links' | 'social' | 'players' | 'support' | 'forms' | 'headers';

const SUPPORT_KINDS: BlockKind[] = ['tip_jar', 'coffee', 'product', 'promo'];
const FORM_KINDS: BlockKind[] = ['signup', 'faq', 'booking', 'vcard', 'countdown', 'location'];
const HEADER_KINDS: BlockKind[] = ['header', 'divider'];

function isPlatformBlockKind(kind: BlockKind): boolean {
  return kind === 'embed' || kind === 'youtube' || kind === 'instagram' || kind === 'coffee';
}

function getPlatformProviderForBlock(block: Block): EmbedProvider {
  if (block.kind === 'youtube') return 'youtube';
  if (block.kind === 'instagram') return 'instagram';
  if (block.kind === 'coffee') return 'coffee';
  return (block.embedMeta?.provider || block.embedProvider || 'generic') as EmbedProvider;
}

function getFilterGroup(block: Block): Exclude<FilterCategory, 'all'> {
  if (block.kind === 'link' || block.kind === 'download') return 'links';
  if (block.kind === 'bluesky') return 'social';
  if (SUPPORT_KINDS.includes(block.kind)) return 'support';
  if (FORM_KINDS.includes(block.kind)) return 'forms';
  if (HEADER_KINDS.includes(block.kind)) return 'headers';
  if (isPlatformBlockKind(block.kind)) {
    const provider = getPlatformProviderForBlock(block);
    const def = getProviderDefinition(provider);
    const displayAs =
      block.embedMeta?.displayAs ||
      (block.kind === 'embed' && (provider === 'youtube' || provider === 'spotify' || provider === 'soundcloud')
        ? def.defaultDisplayMode
        : 'card');
    return displayAs === 'player' ? 'players' : 'social';
  }
  return 'links';
}

function getBlockTypeChip(block: Block, hasBothSupportTypes: boolean): string | null {
  switch (block.kind) {
    case 'link':
      return null;
    case 'bluesky': {
      const variant = block.bluesky?.variant || 'profile';
      if (variant === 'posts') return 'Bluesky · Posts';
      if (variant === 'post') return 'Bluesky · Post';
      if (variant === 'button') return 'Bluesky · Link';
      return 'Bluesky';
    }
    case 'tip_jar':
      return hasBothSupportTypes ? 'Support · Tips' : 'Support';
    case 'coffee':
      return hasBothSupportTypes ? 'Support · Coffee' : 'Support';
    case 'product':
      return 'Product';
    case 'promo':
      return 'Promo';
    case 'embed': {
      const provider = getPlatformProviderForBlock(block);
      return getProviderDefinition(provider).name;
    }
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
    case 'bluesky':
      return block.bluesky?.handle ? `@${block.bluesky.handle}` : cleanDisplayDestination(block.url);
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
  const navigate = useNavigate();
  const location = useLocation();
  const {
    blocks,
    isLoading,
    addLink,
    addEmbed,
    addSignupForm,
    addTipJar,
    addCoffee,
    addProduct,
    addBooking,
    addCountdown,
    addPromo,
    addLocation,
    addDownload,
    addBluesky,
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

  const { isPro, username, displayName, imageUrl, primaryEmail, socials } = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { protectedIds } = useProtectedLinkIds();

  // Add block modal + Social Card jump trigger + Unified PlatformBlockEditor
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [socialAddTrigger, setSocialAddTrigger] = useState(0);
  const [platformEditorState, setPlatformEditorState] = useState<{
    isOpen: boolean;
    provider?: EmbedProvider;
    initialUrl?: string;
    block?: Block | null;
  }>({ isOpen: false });

  // Search & accurate category filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  // Drag & drop state
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  // Active composer (non-platform blocks)
  type ComposerType =
    | 'link'
    | 'signup'
    | 'header'
    | 'tip_jar'
    | 'faq'
    | 'vcard'
    | 'coffee'
    | 'product'
    | 'booking'
    | 'countdown'
    | 'promo'
    | 'location'
    | 'download'
    | 'bluesky';
  const [activeComposer, setActiveComposer] = useState<ComposerType | null>(null);
  const [blueskyPrefillUrl, setBlueskyPrefillUrl] = useState<string | null>(null);

  // Quick inputs for link/header composers
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkTitleManuallyEdited, setNewLinkTitleManuallyEdited] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkEnrichMeta, setNewLinkEnrichMeta] = useState<{
    title?: string | null;
    subtitle?: string | null;
    thumbnailUrl?: string | null;
  } | null>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newHeaderTitle, setNewHeaderTitle] = useState('');
  const [isAddingHeader, setIsAddingHeader] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Editing block id (non-platform blocks)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editLayout, setEditLayout] = useState<BlockLayout>('classic');
  const [editAnimation, setEditAnimation] = useState<LinkAnimation>('none');
  const [editBadge, setEditBadge] = useState<string>('');
  const [editStartAt, setEditStartAt] = useState<string | null>(null);
  const [editEndAt, setEditEndAt] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirm modal
  const [deletingBlock, setDeletingBlock] = useState<Block | null>(null);

  // Active overflow menu dropdown id
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [refreshingBlockId, setRefreshingBlockId] = useState<string | null>(null);
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
    const counts: Record<FilterCategory, number> = {
      all: activeBlocks.length,
      links: 0,
      social: 0,
      players: 0,
      support: 0,
      forms: 0,
      headers: 0,
    };
    for (const b of activeBlocks) {
      counts[getFilterGroup(b)] += 1;
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
    return getFilterGroup(b) === filterCategory;
  });

  // Auto-suggest platform name & enrich social links via API/tokens when URL changes
  const handleNewLinkUrlChange = (val: string) => {
    setNewLinkUrl(val);
    setNewLinkEnrichMeta(null);
    if (!newLinkTitleManuallyEdited) {
      const detected = detectPlatformFromUrl(val);
      if (detected) {
        setNewLinkTitle(detected.name);
      }
    }
  };

  useEffect(() => {
    if (activeComposer !== 'link') return;
    const raw = newLinkUrl.trim();
    if (!raw) {
      setNewLinkEnrichMeta(null);
      return;
    }
    const detected = detectPlatformFromUrl(raw);
    const parsedEmbed = parseEmbedUrl(raw);
    if (!detected && !parsedEmbed) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/integrations/embed?url=${encodeURIComponent(parsedEmbed?.canonicalUrl || raw)}`,
          { signal: AbortSignal.timeout(3000) }
        );
        const data = await res.json().catch(() => null);
        const resolved = data?.embed || data?.embedMeta;
        if (!cancelled && res.ok && data?.ok && resolved) {
          const artwork = resolved.avatarUrl || resolved.coverUrl || null;
          setNewLinkEnrichMeta({
            title: resolved.title || null,
            subtitle: resolved.subtitle || null,
            thumbnailUrl: artwork,
          });
          if (!newLinkTitleManuallyEdited && resolved.title) {
            setNewLinkTitle(String(resolved.title).slice(0, 80));
          }
        }
      } catch {
        // Non-blocking fallback
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeComposer, newLinkUrl, newLinkTitleManuallyEdited]);

  // Composer opening handlers
  const handleOpenComposer = (type: ComposerType) => {
    setEditingBlockId(null);
    setActiveMenuId(null);
    if (type === 'signup' && !isPro) {
      openUpgrade('contact_forms');
      return;
    }
    setActiveComposer(type);
    setComposerError(null);
  };

  const handleCloseComposer = () => {
    setActiveComposer(null);
    setBlueskyPrefillUrl(null);
    setNewLinkTitle('');
    setNewLinkTitleManuallyEdited(false);
    setNewLinkUrl('');
    setNewLinkEnrichMeta(null);
    setNewHeaderTitle('');
    setComposerError(null);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = newLinkUrl.trim();
    if (!rawUrl) {
      setComposerError('URL is required.');
      return;
    }
    const detected = detectPlatformFromUrl(rawUrl);
    const parsedSocial = parseEmbedUrl(rawUrl);
    let resolvedTitle = newLinkTitle.trim() || newLinkEnrichMeta?.title || detected?.name || '';
    let resolvedThumb: string | null = newLinkEnrichMeta?.thumbnailUrl || null;

    setIsAddingLink(true);
    try {
      if ((detected || parsedSocial) && (!resolvedThumb || !newLinkEnrichMeta)) {
        try {
          const res = await fetch(
            `/api/integrations/embed?url=${encodeURIComponent(parsedSocial?.canonicalUrl || rawUrl)}`,
            { signal: AbortSignal.timeout(2500) }
          );
          const data = await res.json().catch(() => null);
          const meta = data?.embed || data?.embedMeta;
          if (res.ok && data?.ok && meta) {
            if (!resolvedThumb) {
              resolvedThumb = meta.avatarUrl || meta.coverUrl || null;
            }
            if (!newLinkTitleManuallyEdited && meta.title) {
              resolvedTitle = String(meta.title).slice(0, 80);
            }
          }
        } catch {
          // Non-blocking fallback
        }
      }

      if (!resolvedTitle) {
        setComposerError('Title is required.');
        setIsAddingLink(false);
        return;
      }

      await addLink(resolvedTitle, rawUrl, {
        thumbnailUrl: resolvedThumb,
      });
      handleCloseComposer();
    } catch {
      setComposerError("Couldn't add link. Try again.");
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleCreateHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHeaderTitle.trim();
    if (!trimmed) {
      setComposerError('Heading text is required.');
      return;
    }

    setComposerError(null);
    setIsAddingHeader(true);
    try {
      await addHeader(trimmed.slice(0, 40));
      handleCloseComposer();
    } catch {
      setComposerError("Couldn't add header. Try again.");
    } finally {
      setIsAddingHeader(false);
    }
  };

  const handleStartEdit = (block: Block) => {
    setActiveComposer(null);
    setActiveMenuId(null);

    if (isPlatformBlockKind(block.kind)) {
      setEditingBlockId(null);
      setPlatformEditorState({
        isOpen: true,
        provider: getPlatformProviderForBlock(block),
        block,
      });
      return;
    }

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

  const handleRefreshPlatformBlock = async (block: Block) => {
    setActiveMenuId(null);
    if (!block.url) return;
    setRefreshingBlockId(block.id);
    try {
      if (block.kind === 'coffee') {
        const res = await fetch(
          `/api/integrations/buymeacoffee?url=${encodeURIComponent(block.url)}`
        );
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.profile) {
          const p = data.profile;
          const creatorTitle = p.displayName || p.creatorName || p.slug || block.title;
          const countNum =
            typeof p.supporterCount === 'number'
              ? p.supporterCount
              : typeof p.supportersCount === 'number'
                ? p.supportersCount
                : block.coffee?.supportersCount;
          await updateBlock(block.id, {
            coffee: {
              ...(block.coffee || {}),
              slug: p.slug || block.coffee?.slug,
              creatorName: creatorTitle,
              bio: p.bio || block.coffee?.bio,
              avatarUrl: p.avatarUrl || block.coffee?.avatarUrl,
              coverUrl: p.coverUrl || block.coffee?.coverUrl,
              supportersCount: countNum,
              supportersLabel: p.supportersLabel || block.coffee?.supportersLabel,
              fetchedAt: p.fetchedAt || new Date().toISOString(),
            },
            embedMeta: {
              ...(block.embedMeta || { provider: 'coffee' }),
              provider: 'coffee',
              title: creatorTitle,
              handle: p.slug ? `@${String(p.slug).replace(/^@/, '')}` : block.embedMeta?.handle ?? null,
              subtitle: p.slug ? `buymeacoffee.com/${p.slug}` : block.embedMeta?.subtitle ?? null,
              description: p.bio ?? block.embedMeta?.description ?? null,
              avatarUrl: p.avatarUrl ?? block.embedMeta?.avatarUrl ?? null,
              coverUrl: p.coverUrl ?? block.embedMeta?.coverUrl ?? null,
              statsLabel:
                p.supportersLabel ||
                (typeof countNum === 'number' && countNum > 0
                  ? `${countNum} supporters`
                  : block.embedMeta?.statsLabel ?? null),
              needsAttention: false,
              failureCount: 0,
              fetchedAt: p.fetchedAt || new Date().toISOString(),
            },
          });
          showToast('Card refreshed');
        } else {
          showToast("Couldn't refresh details right now.");
        }
        return;
      }

      const qs = new URLSearchParams({
        url: block.url,
        forceRefresh: '1',
        blockId: block.id,
      });
      const res = await fetch(`/api/integrations/embed?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        showToast(data?.message || 'Wait a moment before refreshing this card again.');
        return;
      }
      const resolved = data?.embed || data?.embedMeta;
      if (res.ok && data?.ok && resolved) {
        await updateBlock(block.id, {
          embedMeta: {
            ...(block.embedMeta || { provider: getPlatformProviderForBlock(block) }),
            ...resolved,
            lookStyle: block.embedMeta?.lookStyle,
            displayAs: block.embedMeta?.displayAs,
            playerSize: block.embedMeta?.playerSize,
            ctaLabel: block.embedMeta?.ctaLabel,
            override: block.embedMeta?.override,
            needsAttention: false,
            failureCount: 0,
            fetchedAt: resolved.fetchedAt || new Date().toISOString(),
          },
        });
        showToast('Card refreshed');
      } else {
        const nextCount = (block.embedMeta?.failureCount || 0) + 1;
        await updateBlock(block.id, {
          embedMeta: {
            ...(block.embedMeta || { provider: getPlatformProviderForBlock(block) }),
            failureCount: nextCount,
            needsAttention: nextCount >= 3,
          },
        });
        showToast("Couldn't refresh details right now.");
      }
    } catch {
      const nextCount = (block.embedMeta?.failureCount || 0) + 1;
      await updateBlock(block.id, {
        embedMeta: {
          ...(block.embedMeta || { provider: getPlatformProviderForBlock(block) }),
          failureCount: nextCount,
          needsAttention: nextCount >= 3,
        },
      }).catch(() => {});
      showToast("Couldn't refresh details right now.");
    } finally {
      setRefreshingBlockId(null);
    }
  };

  const handleSavePlatformEditor = async (payload: PlatformEditorSavePayload) => {
    const editingTarget = platformEditorState.block;
    if (editingTarget) {
      await updateBlock(editingTarget.id, {
        title: payload.title,
        url: payload.url,
        embedProvider: payload.provider,
        embedMeta: payload.embedMeta,
        ...(payload.youtubeData !== undefined ? { youtube: payload.youtubeData } : {}),
        ...(payload.coffeeData !== undefined ? { coffee: payload.coffeeData } : {}),
        ...(payload.schedule
          ? { startAt: payload.schedule.startAt, endAt: payload.schedule.endAt }
          : {}),
      });
      setPlatformEditorState({ isOpen: false });
      showToast('Saved');
      return;
    }

    if (payload.provider === 'coffee') {
      await addCoffee(
        payload.title,
        payload.url,
        payload.embedMeta?.subtitle || undefined,
        payload.coffeeData || null,
        payload.embedMeta
      );
      setPlatformEditorState({ isOpen: false });
      showToast('Added');
      return;
    }

    await addEmbed(payload.url, payload.title, payload.provider, payload.embedMeta);
    setPlatformEditorState({ isOpen: false });
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

      setIsSavingEdit(true);
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
      } finally {
        setIsSavingEdit(false);
      }
    } else if (block.kind === 'header') {
      const trimmed = editTitle.trim();
      if (!trimmed) {
        setEditError('Heading text is required.');
        return;
      }
      setIsSavingEdit(true);
      try {
        await updateBlock(block.id, { title: trimmed.slice(0, 40), url: null });
        setEditingBlockId(null);
        showToast('Saved');
      } catch {
        setEditError("Couldn't save changes.");
      } finally {
        setIsSavingEdit(false);
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
    { id: 'social', label: 'Social', count: categoryCounts.social },
    { id: 'players', label: 'Players', count: categoryCounts.players },
    { id: 'support', label: 'Support', count: categoryCounts.support },
    { id: 'forms', label: 'Forms', count: categoryCounts.forms },
    { id: 'headers', label: 'Headers', count: categoryCounts.headers },
  ];
  const filterChips = allFilterChips.filter((c) => c.id === 'all' || c.count > 0);
  const shownName = displayName || username || 'Your page';
  const nameInitial = shownName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Compact Profile Summary Row (CH-2: read-only identity + Edit profile link to /account#profile) */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[14px] bg-surface border border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={shownName}
              className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-ink text-surface flex items-center justify-center text-[13px] font-semibold shrink-0">
              {nameInitial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink truncate leading-tight">
              {shownName}
            </p>
            {username && (
              <p className="text-[12px] font-mono text-muted truncate leading-tight mt-0.5">
                @{username}
              </p>
            )}
          </div>
        </div>
        <Link
          to="/account#profile"
          className="text-[13px] font-medium text-ink hover:underline underline-offset-2 shrink-0 px-2 py-1"
        >
          Edit profile
        </Link>
      </div>

      {/* 2. Your page URL strip */}
      <PageUrlStrip username={username} />

      {/* 3. Social Icons Card (collapsible, positioned above link blocks) */}
      <SocialLinksCard externalAddTrigger={socialAddTrigger} />

      {/* 4. Single Toolbar: "+ Add" + Search */}
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

        {/* Compact Wrapping Filter Chips & Archived Toggle */}
        {(activeBlocks.length > 1 || archivedBlocks.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 py-0.5 text-[12px]">
            {activeBlocks.length > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                {filterChips.map((chip) => {
                  const selected = filterCategory === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilterCategory(chip.id)}
                      aria-pressed={selected}
                      className={`h-8 min-h-[32px] px-2.5 py-0.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
            )}

            {archivedBlocks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="ml-auto h-8 min-h-[32px] text-[12px] text-muted hover:text-ink font-medium px-2.5 py-0.5 rounded-full bg-surface border border-border hover:border-border-strong shrink-0 transition-colors cursor-pointer"
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

            {newLinkEnrichMeta?.thumbnailUrl && (
              <div className="flex items-center gap-2.5 p-2 rounded-[10px] bg-surface-2/70 border border-border text-[12px]">
                <img
                  src={newLinkEnrichMeta.thumbnailUrl}
                  alt={newLinkEnrichMeta.title || 'Preview'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">
                    {newLinkEnrichMeta.title || 'Social link detected'}
                  </div>
                  {newLinkEnrichMeta.subtitle && (
                    <div className="text-[11px] text-muted truncate">
                      {newLinkEnrichMeta.subtitle}
                    </div>
                  )}
                </div>
              </div>
            )}

            {composerError && (
              <p className="text-[13px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                {composerError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="md" loading={isAddingLink}>
                Add to page
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={handleCloseComposer}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Suspense fallback={null}>
        {(activeComposer === 'signup') && (
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
                <div className="flex items-center justify-between">
                  <label htmlFor="new-header-title" className="text-[14px] font-medium text-ink">
                    Heading
                  </label>
                  <span className="text-[11px] text-muted tabular-nums">
                    {newHeaderTitle.length}/40
                  </span>
                </div>
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
                <Button type="submit" variant="primary" size="md" loading={isAddingHeader}>
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

        {activeComposer === 'coffee' && (
          <CoffeeComposer
            onAdd={async ({ title, url, badge, coffee }) => {
              await addCoffee(title, url, badge, coffee || null);
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

        {activeComposer === 'bluesky' && (
          <BlueskyComposer
            initialUrl={blueskyPrefillUrl}
            onSave={async ({ title, url, bluesky }) => {
              await addBluesky(title, url, bluesky);
              handleCloseComposer();
            }}
            onCancel={handleCloseComposer}
          />
        )}
      </Suspense>

      {/* 4. Block List */}
      {isLoading ? (
        <div
          className="min-h-[240px] flex items-center justify-center text-ink/70"
          aria-busy="true"
          aria-label="Loading blocks"
        >
          <Loader size="md" />
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
            const isBluesky = block.kind === 'bluesky';
            const isLink = block.kind === 'link';
            const isProtected =
              isLink && (protectedIds.has(block.id) || block.isProtected === true);
            const isMediaEmbed = isEmbed && !isSocialEmbedProvider(block.embedProvider);
            const isProLocked =
              !isPro && (isMediaEmbed || isSignup || Boolean(block.startAt || block.endAt) || isProtected);

            const clicks = clickCounts.get(block.id) || 0;
            const clickText = clicks === 1 ? '1 click' : `${clicks} clicks`;
            const typeChip = getBlockTypeChip(block, hasBothSupportTypes);
            const subtitle = getBlockSubtitle(block);
            const isPlatformBlock = isPlatformBlockKind(block.kind);
            const platformProvider = isPlatformBlock ? getPlatformProviderForBlock(block) : null;
            const platformDef = platformProvider ? getProviderDefinition(platformProvider) : null;
            const needsAttention = Boolean(
              isPlatformBlock &&
                (block.embedMeta?.needsAttention || (block.embedMeta?.failureCount ?? 0) >= 3)
            );

            // Detect platform for Link blocks so ambiguous/identical titles get clear identity
            const detectedPlatform =
              isLink && block.url ? detectPlatformFromUrl(block.url) : null;
            const displayTitle = (() => {
              if (isDivider) return 'Divider';
              if (isSignup) return block.signup?.heading || block.title || copy.signup.dashboard.defaultHeading;
              if (isTipJar) return block.tipJar?.buttonText || block.title || 'Tip Jar';
              if (isFaq) return block.title || 'FAQ';
              if (isVCard) return block.vcard?.fullName || block.title || 'Contact Card';
              const raw = block.title || (isEmbed ? platformDef?.name || 'Card' : 'Untitled');
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

            const platformIconColor =
              platformDef?.brandColor === '#000000' ||
              platformDef?.brandColor === '#FFFC00' ||
              platformDef?.brandColor === '#FFDD00'
                ? '#0A0A0A'
                : platformDef?.brandColor || '#0A0A0A';
            const platformTileBg =
              platformDef?.brandColor === '#FFFC00'
                ? 'rgba(255, 252, 0, 0.35)'
                : platformDef?.brandColor === '#FFDD00'
                  ? 'rgba(255, 221, 0, 0.35)'
                  : `${platformIconColor}14`;

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
                          {/* 40px brand/icon tile */}
                          <div
                            className="w-10 h-10 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden text-ink"
                            style={
                              platformProvider
                                ? {
                                    backgroundColor: platformTileBg,
                                    color: platformIconColor,
                                    borderColor: `${platformIconColor}2E`,
                                  }
                                : undefined
                            }
                          >
                            {isLink && block.thumbnailUrl ? (
                              <img
                                src={block.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : platformProvider ? (
                              <ProviderGlyph provider={platformProvider} size={19} />
                            ) : isSignup ? (
                              <Mail size={20} className="text-muted" strokeWidth={1.5} />
                            ) : isTipJar ? (
                              <Heart size={20} className="text-rose-500" strokeWidth={1.5} />
                            ) : isFaq ? (
                              <HelpCircle size={20} className="text-sky-600" strokeWidth={1.5} />
                            ) : isVCard ? (
                              <UserCheck size={20} className="text-emerald-600" strokeWidth={1.5} />
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
                            ) : isBluesky ? (
                              <BlueskySocialIcon size={20} className="text-[#0085FF]" />
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

                              {needsAttention && (
                                <span
                                  title="Details failed to refresh. Open editor to update or override."
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0"
                                >
                                  <AlertTriangle size={10} className="shrink-0" />
                                  <span>Needs attention</span>
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

                              {isPlatformBlock && block.url && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={refreshingBlockId === block.id}
                                  onClick={() => void handleRefreshPlatformBlock(block)}
                                  className="w-full min-h-[40px] px-3.5 text-left text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                                >
                                  <RefreshCw
                                    size={15}
                                    strokeWidth={1.5}
                                    className={`text-muted ${refreshingBlockId === block.id ? 'animate-spin' : ''}`}
                                  />
                                  <span>Refresh</span>
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
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isTipJar ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isFaq ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isVCard ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isCoffee ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isProduct ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isBooking ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isCountdown ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isPromo ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isLocation ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isDownload ? (
                  <Suspense fallback={null}>
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
                  </Suspense>
                ) : isBluesky ? (
                  <Suspense fallback={null}>
                    <BlueskyComposer
                      initialValues={block.bluesky || undefined}
                      initialTitle={block.title || undefined}
                      initialUrl={block.url}
                      isEditing
                      onSave={async ({ title, url, bluesky }) => {
                        await updateBlock(block.id, { title, url, bluesky });
                        setEditingBlockId(null);
                      }}
                      onCancel={() => setEditingBlockId(null)}
                    />
                  </Suspense>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[16px] font-semibold text-ink">
                        Edit {isHeader ? 'header' : 'link'}
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
                      <div className="flex items-center justify-between">
                        <label className="text-[14px] font-medium text-ink">
                          {isHeader ? 'Heading' : 'Title'}
                        </label>
                        {isHeader && (
                          <span className="text-[11px] text-muted tabular-nums">
                            {editTitle.length}/40
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={isHeader ? 40 : 120}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>

                    {isLink && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-ink">
                          URL
                        </label>
                        <input
                          type="url"
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

                    {isLink && (
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
                        loading={isSavingEdit}
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
                      className="text-[color:var(--error,#B3261E)] min-w-[44px] min-h-[44px] px-2.5"
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

      {/* 6. Delete Confirm Dialog */}
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
      {isAddModalOpen && (
        <Suspense fallback={null}>
          <AddBlockModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSmartAddProvider={(detected) => {
              if (detected.provider === 'bluesky') {
                setBlueskyPrefillUrl(detected.canonicalUrl);
                handleOpenComposer('bluesky');
                return;
              }
              const isProPlayer =
                detected.defaultDisplayAs === 'player' &&
                (detected.provider === 'youtube' ||
                  detected.provider === 'spotify' ||
                  detected.provider === 'soundcloud');
              if (isProPlayer && !isPro) {
                openUpgrade('embeds');
                return;
              }
              setEditingBlockId(null);
              setActiveComposer(null);
              setPlatformEditorState({
                isOpen: true,
                provider: detected.provider as EmbedProvider,
                initialUrl: detected.canonicalUrl,
                block: null,
              });
            }}
            onSmartAddGenericLink={(canonicalUrl) => {
              handleOpenComposer('link');
              handleNewLinkUrlChange(canonicalUrl);
            }}
            onSelectFeature={async (type: FeatureType) => {
              if (type === 'coffee') {
                const nextParams = new URLSearchParams(location.search);
                nextParams.set('platform', 'coffee');
                navigate(`/dashboard/profiles?${nextParams.toString()}`);
              } else if (type === 'social') {
                setSocialAddTrigger((n) => n + 1);
                setTimeout(() => {
                  document
                    .getElementById('social-icons-card')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 60);
              } else if (type === 'divider') {
                await addDivider();
              } else if (type === 'bluesky' || type === 'embed_bluesky') {
                setBlueskyPrefillUrl(null);
                handleOpenComposer('bluesky');
              } else if (
                type === 'embed' ||
                type.startsWith('embed_') ||
                type === 'youtube' ||
                type === 'instagram'
              ) {
                const mappedProvider: EmbedProvider =
                  type === 'youtube'
                    ? 'youtube'
                    : type === 'instagram'
                      ? 'instagram'
                      : type === 'embed'
                        ? 'generic'
                        : (type.replace('embed_', '') as EmbedProvider);
                const isProPlayer =
                  (type === 'embed_youtube' ||
                    type === 'embed_spotify' ||
                    type === 'embed_soundcloud') &&
                  !isPro;
                if (isProPlayer) {
                  openUpgrade('embeds');
                  return;
                }
                setEditingBlockId(null);
                setActiveComposer(null);
                setPlatformEditorState({
                  isOpen: true,
                  provider: mappedProvider,
                  block: null,
                });
              } else {
                handleOpenComposer(type as ComposerType);
              }
            }}
            isPro={isPro}
          />
        </Suspense>
      )}

      {/* 9. Unified Platform Card & Player Editor */}
      {platformEditorState.isOpen && (
        <Suspense fallback={null}>
          <PlatformBlockEditor
            isOpen={platformEditorState.isOpen}
            onClose={() => setPlatformEditorState({ isOpen: false })}
            initialProvider={platformEditorState.provider}
            initialUrl={platformEditorState.initialUrl}
            block={platformEditorState.block}
            isPro={isPro}
            onSave={handleSavePlatformEditor}
            onClearScheduleImmediate={
              platformEditorState.block
                ? async () => {
                    if (platformEditorState.block) {
                      await clearSchedule(platformEditorState.block.id);
                    }
                  }
                : undefined
            }
          />
        </Suspense>
      )}
    </div>
  );
};

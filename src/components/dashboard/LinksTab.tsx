import React, { useState } from 'react';
import {
  Plus,
  Play,
  Music,
  Headphones,
  Link2,
  Heading,
  Minus,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Archive,
  RotateCcw,
  Pencil,
  AlertTriangle,
  Mail,
  Lock,
  Heart,
  HelpCircle,
  Sparkles,
  UserCheck,
  Search,
} from 'lucide-react';
import { useBlocks } from '../../data/BlocksContext';
import { useIvioSession } from '../../auth/useIvioSession';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { ProBadge } from '../plan/ProBadge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
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
import { AddBlockModal, FeatureType } from './AddBlockModal';
import { AnimationControl } from '../links/AnimationControl';
import { Block, BlockLayout, LinkAnimation } from '../../data/types';
import { parseEmbedUrl } from '../../lib/embeds';
import { useClickCounts } from '../../data/hooks/useClickCounts';
import { useProtectedLinkIds } from '../../data/hooks/useProtectedLinkIds';
import { copy } from '../../content/copy';
import { SocialLinksCard } from './SocialLinksCard';

export const LinksTab: React.FC = () => {
  const clickCounts = useClickCounts();
  const {
    blocks,
    isLoading,
    addLink,
    addEmbed,
    addSignupForm,
    addTipJar,
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
  } = useBlocks();

  const { isPro, username, displayName, primaryEmail } = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const { protectedIds } = useProtectedLinkIds();

  // Add block modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Search & category filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'links' | 'media_forms' | 'headers'>('all');

  // Active composer: null | 'link' | 'embed' | 'signup' | 'header' | 'tip_jar' | 'faq' | 'vcard'
  const [activeComposer, setActiveComposer] = useState<
    'link' | 'embed' | 'signup' | 'header' | 'tip_jar' | 'faq' | 'vcard' | null
  >(null);

  // Quick inputs for link/header composers
  const [newLinkTitle, setNewLinkTitle] = useState('');
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

  // Delete confirm modal/dialog
  const [deletingBlock, setDeletingBlock] = useState<Block | null>(null);

  // Active menu dropdown id
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Show archived items
  const [showArchived, setShowArchived] = useState(false);

  const activeBlocks = blocks.filter((b) => !b.isArchived);
  const archivedBlocks = blocks.filter((b) => b.isArchived);

  // Filtered active blocks based on search and category
  const filteredActiveBlocks = activeBlocks.filter((b) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = b.title ? b.title.toLowerCase().includes(q) : false;
      const urlMatch = b.url ? b.url.toLowerCase().includes(q) : false;
      const vcardMatch = b.vcard ? (
        (b.vcard.fullName && b.vcard.fullName.toLowerCase().includes(q)) ||
        (b.vcard.organization && b.vcard.organization.toLowerCase().includes(q)) ||
        (b.vcard.title && b.vcard.title.toLowerCase().includes(q))
      ) : false;
      if (!titleMatch && !urlMatch && !vcardMatch) return false;
    }

    if (filterCategory === 'links') {
      return b.kind === 'link';
    }
    if (filterCategory === 'media_forms') {
      return b.kind === 'embed' || b.kind === 'signup' || b.kind === 'tip_jar' || b.kind === 'faq' || b.kind === 'vcard';
    }
    if (filterCategory === 'headers') {
      return b.kind === 'header' || b.kind === 'divider';
    }

    return true;
  });

  // Composer opening handlers
  const handleOpenComposer = (type: 'link' | 'embed' | 'signup' | 'header' | 'tip_jar' | 'faq' | 'vcard') => {
    setEditingBlockId(null);
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
    setNewLinkUrl('');
    setNewHeaderTitle('');
    setComposerError(null);
  };

  // Submit link composer
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim()) {
      setComposerError('Title is required.');
      return;
    }
    if (!newLinkUrl.trim()) {
      setComposerError('URL is required.');
      return;
    }

    try {
      await addLink(newLinkTitle.trim(), newLinkUrl.trim());
      handleCloseComposer();
    } catch {
      setComposerError("Couldn't add link. Try again.");
    }
  };

  // Submit header composer
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

  // Start editing a block
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

    // Validate schedule
    if (editStartAt && editEndAt) {
      if (new Date(editEndAt) <= new Date(editStartAt)) {
        setEditError('Hide time must be after the show time.');
        return;
      }
    }
    if (editEndAt && new Date(editEndAt) <= new Date()) {
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
        setEditError('Use a YouTube, Spotify or SoundCloud link.');
        return;
      }

      try {
        await updateBlock(block.id, {
          title: editTitle.trim(),
          url: parsed.canonicalUrl,
          embedProvider: parsed.provider,
          startAt: editStartAt,
          endAt: editEndAt,
        });
        setEditingBlockId(null);
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
      } catch {
        setEditError("Couldn't save changes.");
      }
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeBlocks.length) return;

    const reordered = [...activeBlocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    reorderBlocks(reordered.map((b) => b.id));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Organized Control Bar & Quick Actions */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-xl border border-border">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenComposer('link')}
              className="shadow-sm"
            >
              <Plus size={16} strokeWidth={2} />
              <span>Add link</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 border-ink/20"
            >
              <Sparkles size={15} strokeWidth={2} className="text-amber-500" />
              <span>Explore All Features</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink/5 text-ink">
                8 types
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenComposer('tip_jar')}
              className="hidden lg:flex items-center gap-1.5 text-muted hover:text-ink text-[13px]"
            >
              <Heart size={14} className="text-rose-500" />
              <span>Tip Jar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenComposer('vcard')}
              className="hidden lg:flex items-center gap-1.5 text-muted hover:text-ink text-[13px]"
            >
              <UserCheck size={14} className="text-emerald-600" />
              <span>Contact Card</span>
            </Button>
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2 w-full sm:w-64">
            <div className="relative w-full">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search links..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-7 text-[13px] bg-surface-2 border border-border rounded-lg text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-[11px] px-1 py-0.5"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills & View Toggles */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-[13px] no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-ink text-white'
                  : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              All ({activeBlocks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('links')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterCategory === 'links'
                  ? 'bg-ink text-white'
                  : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              Links ({activeBlocks.filter((b) => b.kind === 'link').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('media_forms')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterCategory === 'media_forms'
                  ? 'bg-ink text-white'
                  : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              Media & Interactive ({
                activeBlocks.filter((b) =>
                  ['embed', 'signup', 'tip_jar', 'faq', 'vcard'].includes(b.kind)
                ).length
              })
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('headers')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterCategory === 'headers'
                  ? 'bg-ink text-white'
                  : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              Headers ({
                activeBlocks.filter((b) => ['header', 'divider'].includes(b.kind)).length
              })
            </button>
          </div>

          {archivedBlocks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="ml-auto text-[12px] text-muted hover:text-ink font-medium px-2 py-1 shrink-0"
            >
              {showArchived ? 'Hide Archived' : `Archived (${archivedBlocks.length})`}
            </button>
          )}
        </div>
      </div>

      {/* 2. Composers */}
      {activeComposer === 'link' && (
        <Card className="p-4 sm:p-5 border-ink/20 shadow-[0_2px_8px_rgba(10,10,10,0.06)]">
          <form onSubmit={handleCreateLink} className="flex flex-col gap-3.5">
            <h3 className="text-[16px] font-semibold text-ink">New link</h3>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-link-title" className="text-[14px] font-medium text-ink">
                Title
              </label>
              <input
                id="new-link-title"
                type="text"
                autoFocus
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                placeholder="e.g. My Portfolio"
                className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-link-url" className="text-[14px] font-medium text-ink">
                URL
              </label>
              <input
                id="new-link-url"
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
            </div>

            {composerError && (
              <p className="text-[13px] text-error" role="alert">
                {composerError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="primary" size="md">
                Add link
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
          onAdd={async ({ url, caption, provider }) => {
            await addEmbed(url, caption, provider);
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
        <Card className="p-4 sm:p-5 border-ink/20 shadow-[0_2px_8px_rgba(10,10,10,0.06)]">
          <form onSubmit={handleCreateHeader} className="flex flex-col gap-3.5">
            <h3 className="text-[16px] font-semibold text-ink">New header</h3>
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
                placeholder="e.g. Social Links"
                className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              />
            </div>

            {composerError && (
              <p className="text-[13px] text-error" role="alert">
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

      {/* 3. Items List */}
      {activeBlocks.length === 0 && !activeComposer ? (
        <Card className="flex flex-col items-start gap-4 p-6 sm:p-8">
          <div className="w-10 h-10 rounded-[10px] bg-surface-2 flex items-center justify-center text-subtle">
            <Link2 size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-semibold text-ink leading-tight">
              Your page is ready for links
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-[48ch]">
              Add your first link, embed, contact card, or tip jar above to build your page.
            </p>
          </div>
        </Card>
      ) : filteredActiveBlocks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-[15px] font-medium text-ink">
            No items match your filter {searchQuery ? `"${searchQuery}"` : ''}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFilterCategory('all');
            }}
          >
            Clear filters
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredActiveBlocks.map((block, idx) => {
            const isEditing = editingBlockId === block.id;
            const isEmbed = block.kind === 'embed';
            const isHeader = block.kind === 'header';
            const isDivider = block.kind === 'divider';
            const isSignup = block.kind === 'signup';
            const isTipJar = block.kind === 'tip_jar';
            const isFaq = block.kind === 'faq';
            const isVCard = block.kind === 'vcard';
            const isLink = block.kind === 'link';
            const isProtected = isLink && (protectedIds.has(block.id) || block.isProtected === true);

            // Provider glyph for embed
            const ProviderGlyph =
              block.embedProvider === 'youtube'
                ? Play
                : block.embedProvider === 'spotify'
                  ? Music
                  : Headphones;

            return (
              <Card
                key={block.id}
                className={`transition-all duration-120 ${
                  isEditing ? 'ring-2 ring-ink p-4 sm:p-5' : 'p-3.5 sm:p-4'
                }`}
              >
                {!isEditing ? (
                  // Compact Row (72px height style)
                  <div className="flex items-center justify-between gap-3 min-h-[48px]">
                    {/* Left Tile + Title */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* 36px icon tile */}
                      <div className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {isLink && block.thumbnailUrl ? (
                          <img
                            src={block.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : isEmbed ? (
                          <ProviderGlyph size={18} className="text-ink" strokeWidth={1.5} />
                        ) : isSignup ? (
                          <Mail size={18} className="text-subtle" strokeWidth={1.5} />
                        ) : isTipJar ? (
                          <Heart size={18} className="text-red-500 fill-red-500" strokeWidth={1.5} />
                        ) : isFaq ? (
                          <HelpCircle size={18} className="text-blue-500" strokeWidth={1.5} />
                        ) : isVCard ? (
                          <UserCheck size={18} className="text-emerald-600" strokeWidth={1.5} />
                        ) : isHeader ? (
                          <Heading size={18} className="text-subtle" strokeWidth={1.5} />
                        ) : isDivider ? (
                          <Minus size={18} className="text-subtle" strokeWidth={1.5} />
                        ) : (
                          <Link2 size={18} className="text-subtle" strokeWidth={1.5} />
                        )}
                      </div>

                      {/* Text info */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`text-[15px] font-medium truncate ${
                              !block.isActive ? 'text-muted' : 'text-ink'
                            }`}
                          >
                            {isDivider
                              ? 'Divider'
                              : isSignup
                              ? block.signup?.heading || block.title || copy.signup.dashboard.defaultHeading
                              : isTipJar
                              ? `Support: ${block.tipJar?.buttonText || block.title || 'Tip Jar'}`
                              : isFaq
                              ? `FAQ: ${block.title || 'Questions'}`
                              : isVCard
                              ? (block.vcard?.fullName ? `Contact: ${block.vcard.fullName}` : block.title || 'Contact Card')
                              : block.title || (isEmbed ? 'Embed' : 'Untitled')}
                          </span>
                          {block.badge && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-ink uppercase">
                              {block.badge}
                            </span>
                          )}
                          <ScheduleChip block={block} isActive={block.isActive} />
                          {isProtected && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-muted border border-border">
                              <Lock size={11} className="shrink-0" />
                              <span>{copy.password.dashboard.chip}</span>
                            </span>
                          )}
                          {!isPro && (isEmbed || isSignup || block.startAt || block.endAt || isProtected) && (
                            <ProBadge />
                          )}
                        </div>

                        {/* Subtitle / Host line with click counts */}
                        {isTipJar && block.tipJar && (
                          <div className="flex items-center text-[12px] text-muted leading-tight">
                            <span>
                              {block.tipJar.currency} amounts: {block.tipJar.amounts?.join(', ')}
                            </span>
                          </div>
                        )}
                        {isFaq && block.faq && (
                          <div className="flex items-center text-[12px] text-muted leading-tight">
                            <span>
                              {block.faq.items?.length || 0} questions & answers
                            </span>
                          </div>
                        )}
                        {isVCard && block.vcard && (
                          <div className="flex items-center text-[12px] text-muted leading-tight">
                            <span className="truncate">
                              {[block.vcard.title, block.vcard.organization, block.vcard.phone, block.vcard.email].filter(Boolean).join(' • ') || 'Digital vCard'}
                            </span>
                          </div>
                        )}
                        {isSignup && (
                          <div className="flex items-center text-[12px] text-muted leading-tight">
                            <span>
                              {copy.signup.dashboard.subtitles[block.signup?.collect || 'email']}
                            </span>
                          </div>
                        )}
                        {isEmbed && block.url && (() => {
                          const clicks = clickCounts.get(block.id) || 0;
                          const clickText = clicks === 1 ? '1 click' : `${clicks} clicks`;
                          return (
                            <div className="flex items-center text-[12px] text-muted leading-tight overflow-hidden">
                              <span className="truncate shrink min-w-0">
                                {new URL(block.url).hostname}
                              </span>
                              {clicks > 0 && (
                                <span
                                  title={copy.dashboard.analytics.linksTab.titleTooltip}
                                  className="shrink-0 whitespace-nowrap ml-1"
                                >
                                  · {clickText}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {isLink && block.url && (() => {
                          const clicks = clickCounts.get(block.id) || 0;
                          const clickText = clicks === 1 ? '1 click' : `${clicks} clicks`;
                          return (
                            <div className="flex items-center text-[12px] text-muted leading-tight overflow-hidden">
                              <span className="truncate shrink min-w-0">
                                {block.url}
                              </span>
                              {clicks > 0 && (
                                <span
                                  title={copy.dashboard.analytics.linksTab.titleTooltip}
                                  className="shrink-0 whitespace-nowrap ml-1"
                                >
                                  · {clickText}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {!isPro && (isEmbed || block.startAt || block.endAt) && (
                          <span className="text-[12px] text-muted">
                            Not shown on your page
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Active toggle */}
                      {!isDivider && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={block.isActive}
                          onClick={() => toggleActive(block.id)}
                          className={`w-9 h-5 rounded-full flex items-center p-0.5 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink ${
                            block.isActive ? 'bg-ink' : 'bg-border'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-120 ${
                              block.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      )}

                      {/* Edit Button */}
                      {!isDivider && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(block)}
                          className="h-8 w-8 p-0"
                          aria-label="Edit item"
                        >
                          <Pencil size={15} strokeWidth={1.5} />
                        </Button>
                      )}

                      {/* Move up / down */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveBlock(idx, 'up')}
                          aria-label="Move up"
                          className="text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted p-0.5"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === activeBlocks.length - 1}
                          onClick={() => moveBlock(idx, 'down')}
                          aria-label="Move down"
                          className="text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted p-0.5"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* More Menu */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === block.id ? null : block.id)
                          }
                          className="h-8 w-8 p-0"
                          aria-label="Item options"
                        >
                          <MoreVertical size={16} strokeWidth={1.5} />
                        </Button>

                        {activeMenuId === block.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-[10px] shadow-lg py-1 z-30"
                            onClick={() => setActiveMenuId(null)}
                          >
                            <button
                              type="button"
                              onClick={() => toggleArchive(block.id)}
                              className="w-full px-3 py-1.5 text-left text-[14px] text-ink hover:bg-surface-2 flex items-center gap-2"
                            >
                              <Archive size={14} />
                              <span>Archive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingBlock(block)}
                              className="w-full px-3 py-1.5 text-left text-[14px] text-error hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
                ) : (
                  // Full Edit Panel (Section 12.3)
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

                    {/* Title / Heading */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[14px] font-medium text-ink">
                        {isHeader ? 'Heading' : isEmbed ? 'Caption' : 'Title'}
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={isEmbed ? 'Optional' : ''}
                        className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>

                    {/* URL */}
                    {(isLink || isEmbed) && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[14px] font-medium text-ink">
                          {isEmbed ? 'Embed link' : 'URL'}
                        </label>
                        <input
                          type={isEmbed ? 'text' : 'url'}
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        />
                      </div>
                    )}

                    {/* Image Section (Links only) */}
                    {isLink && (
                      <ImageSection
                        userId={username || 'owner'}
                        thumbnailPath={block.thumbnailPath}
                        thumbnailUrl={block.thumbnailUrl}
                        onImageChanged={async (newPath) => {
                          const layout = newPath ? editLayout : 'classic';
                          setEditLayout(layout);
                          await setBlockImage(block.id, newPath, layout);
                        }}
                      />
                    )}

                    {/* Layout Control (Links only) */}
                    {isLink && (
                      <LayoutControl
                        hasImage={!!block.thumbnailPath}
                        layout={editLayout}
                        onChange={(l) => setEditLayout(l)}
                      />
                    )}

                    {/* Animation & Badge Control (Links only) */}
                    {isLink && (
                      <AnimationControl
                        animation={editAnimation}
                        badge={editBadge}
                        onAnimationChange={(anim) => setEditAnimation(anim)}
                        onBadgeChange={(badgeText) => setEditBadge(badgeText)}
                      />
                    )}

                    {/* Password Section (Links only) */}
                    {isLink && (
                      <PasswordSection
                        isPro={isPro}
                        linkId={block.id}
                        isProtected={protectedIds.has(block.id) || block.isProtected === true}
                      />
                    )}

                    {/* Schedule Section (Links & Embeds) */}
                    {(isLink || isEmbed) && (
                      <ScheduleSection
                        isPro={isPro}
                        startAt={editStartAt}
                        endAt={editEndAt}
                        onChange={(s, e) => {
                          setEditStartAt(s);
                          setEditEndAt(e);
                        }}
                        onClearScheduleImmediate={() => clearSchedule(block.id)}
                        errorMessage={editError}
                      />
                    )}

                    {editError && (
                      <p className="text-[13px] text-error" role="alert">
                        {editError}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleSaveEdit(block)}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setEditingBlockId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. Archived Section */}
      {archivedBlocks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink py-1"
          >
            <span>Archived ({archivedBlocks.length})</span>
            {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showArchived && (
            <div className="mt-3 flex flex-col gap-2">
              {archivedBlocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-[10px] text-muted text-[14px]"
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
                      className="text-error"
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

      {/* 5. Social Media Accounts */}
      <SocialLinksCard />

      {/* 6. Delete Confirm Dialog */}
      {deletingBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          onClick={() => setDeletingBlock(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface border border-border rounded-[16px] p-6 shadow-xl"
          >
            <h3 className="text-[18px] font-semibold text-ink">
              {deletingBlock.kind === 'signup'
                ? copy.signup.dashboard.deleteDialogTitle
                : deletingBlock.kind === 'embed'
                ? 'Delete this embed?'
                : deletingBlock.kind === 'header'
                ? 'Delete this header?'
                : 'Delete this link?'}
            </h3>
            <p className="mt-2 text-[14px] text-muted leading-relaxed">
              {deletingBlock.kind === 'signup'
                ? copy.signup.dashboard.deleteDialogBody
                : 'This cannot be undone. You can also archive it if you might need it later.'}
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setDeletingBlock(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="bg-error hover:bg-error/90 text-white"
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

      {/* 7. Categorized Add Feature Modal */}
      <AddBlockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectFeature={async (type: FeatureType) => {
          if (type === 'divider') {
            await addDivider();
          } else {
            handleOpenComposer(type);
          }
        }}
        isPro={isPro}
      />
    </div>
  );
};

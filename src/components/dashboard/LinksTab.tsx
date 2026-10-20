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
import { EmbedComposer } from '../links/EmbedComposer';
import { Block, BlockLayout } from '../../data/types';
import { parseEmbedUrl } from '../../lib/embeds';
import { copy } from '../../content/copy';

export const LinksTab: React.FC = () => {
  const {
    blocks,
    isLoading,
    addLink,
    addEmbed,
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

  const { isPro, username } = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();

  // Active composer: null | 'link' | 'embed' | 'header'
  const [activeComposer, setActiveComposer] = useState<
    'link' | 'embed' | 'header' | null
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

  // Composer opening handlers
  const handleOpenComposer = (type: 'link' | 'embed' | 'header') => {
    setEditingBlockId(null);
    if (type === 'embed' && !isPro) {
      openUpgrade('embeds');
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
      {/* 1. Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={() => handleOpenComposer('link')}
        >
          <Plus size={16} strokeWidth={2} />
          <span>Add link</span>
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={() => handleOpenComposer('embed')}
        >
          <Plus size={16} strokeWidth={2} />
          <span>Add embed</span>
          <ProBadge className="ml-1" />
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={() => handleOpenComposer('header')}
        >
          <Plus size={16} strokeWidth={2} />
          <span>Add header</span>
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={async () => {
            setEditingBlockId(null);
            setActiveComposer(null);
            await addDivider();
          }}
        >
          <Plus size={16} strokeWidth={2} />
          <span>Add divider</span>
        </Button>
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
              Add your first link, embed, or header above to build your page.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {activeBlocks.map((block, idx) => {
            const isEditing = editingBlockId === block.id;
            const isEmbed = block.kind === 'embed';
            const isHeader = block.kind === 'header';
            const isDivider = block.kind === 'divider';
            const isLink = block.kind === 'link';

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
                              : block.title || (isEmbed ? 'Embed' : 'Untitled')}
                          </span>
                          <ScheduleChip block={block} isActive={block.isActive} />
                          {!isPro && (isEmbed || block.startAt || block.endAt) && (
                            <ProBadge />
                          )}
                        </div>

                        {/* Subtitle / Host line */}
                        {isEmbed && block.url && (
                          <span className="text-[12px] text-muted truncate">
                            {new URL(block.url).hostname}
                          </span>
                        )}
                        {isLink && block.url && (
                          <span className="text-[12px] text-muted truncate">
                            {block.url}
                          </span>
                        )}
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

      {/* 5. Delete Confirm Dialog */}
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
              {deletingBlock.kind === 'embed'
                ? 'Delete this embed?'
                : 'Delete this link?'}
            </h3>
            <p className="mt-2 text-[14px] text-muted leading-relaxed">
              This cannot be undone. You can also archive it if you might need it later.
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
    </div>
  );
};

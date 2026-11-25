import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowRight, Check } from 'lucide-react';
import { useBlocks } from '../../data/BlocksContext';
import { useIvioSession } from '../../auth/useIvioSession';
import { Block, EmbedProvider } from '../../data/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import { ProviderGlyph } from '../page/EmbedBlock';
import {
  PlatformBlockEditor,
  PlatformEditorSavePayload,
} from '../links/PlatformBlockEditor';
import {
  getLookLabelForProvider,
  isSocialEmbedProvider,
  normalizeEmbedLookStyle,
} from '../../lib/embedLooks';
import { getProviderDefinition, listPlatformProviders } from '../../lib/providers';
import { DEFAULT_LAYOUT_SETTINGS, normalizeCardLookKey } from '../../lib/preferences';

export const ProfilesTab: React.FC = () => {
  const { blocks, addEmbed, addCoffee, updateBlock, deleteBlock, toggleActive, clearSchedule } =
    useBlocks();
  const session = useIvioSession();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    provider?: EmbedProvider;
    block?: Block | null;
  }>({ isOpen: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const requestedPlatform = searchParams.get('platform')?.trim().toLowerCase();
    if (!requestedPlatform) return;
    const validProviders = listPlatformProviders().map((p) => p.id as string);
    if (validProviders.includes(requestedPlatform)) {
      setEditorState({
        isOpen: true,
        provider: requestedPlatform as EmbedProvider,
        block: null,
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete('platform');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const pageCardLook = normalizeCardLookKey(
    session.layoutSettings?.cardLook || DEFAULT_LAYOUT_SETTINGS.cardLook,
    'match_page'
  );

  const catalogProviders = useMemo(() => listPlatformProviders(), []);

  const connectedBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (b.isArchived) return false;
      if (
        b.kind === 'embed' &&
        (isSocialEmbedProvider(b.embedProvider) ||
          b.embedProvider === 'spotify' ||
          b.embedProvider === 'soundcloud' ||
          b.embedProvider === 'youtube')
      ) {
        return true;
      }
      if (b.kind === 'youtube' || b.kind === 'instagram' || b.kind === 'coffee') return true;
      return false;
    });
  }, [blocks]);

  const countByPlatform = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const block of connectedBlocks) {
      const key =
        block.kind === 'embed' && (block.embedMeta?.provider || block.embedProvider)
          ? block.embedMeta?.provider || block.embedProvider!
          : block.kind;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [connectedBlocks]);

  const socialIconCount = Object.values(session.socials || {}).filter(
    (v) => typeof v === 'string' && v.trim().length > 0
  ).length;

  const getBlockProvider = (block: Block): EmbedProvider => {
    if (block.kind === 'youtube') return 'youtube';
    if (block.kind === 'instagram') return 'instagram';
    if (block.kind === 'coffee') return 'coffee';
    return (block.embedMeta?.provider || block.embedProvider || 'generic') as EmbedProvider;
  };

  const handleSaveEditor = async (payload: PlatformEditorSavePayload) => {
    if (editorState.block) {
      await updateBlock(editorState.block.id, {
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
      setEditorState({ isOpen: false });
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
      setEditorState({ isOpen: false });
      showToast('Added');
      return;
    }
    await addEmbed(payload.url, payload.title, payload.provider, payload.embedMeta);
    setEditorState({ isOpen: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] sm:text-[26px] font-semibold text-ink tracking-tight leading-tight">
          Connected platforms
        </h1>
        <p className="text-[14px] text-muted leading-relaxed">
          Add social cards and media players from any supported platform and pick a card look.
        </p>
      </div>

      {/* Existing Platform Cards on Page */}
      {connectedBlocks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-ink">
              On your page ({connectedBlocks.length})
            </h2>
            <Link
              to="/dashboard"
              className="text-[13px] font-medium text-muted hover:text-ink inline-flex items-center gap-1"
            >
              <span>Manage order in Links</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {connectedBlocks.map((block) => {
              const pKey = getBlockProvider(block);
              const def = getProviderDefinition(pKey);
              const iconColor =
                def.brandColor === '#000000' ||
                def.brandColor === '#FFFC00' ||
                def.brandColor === '#FFDD00'
                  ? '#0A0A0A'
                  : def.brandColor;
              const tileBg =
                def.brandColor === '#FFFC00'
                  ? 'rgba(255, 252, 0, 0.35)'
                  : def.brandColor === '#FFDD00'
                    ? 'rgba(255, 221, 0, 0.35)'
                    : `${iconColor}14`;
              const isConfirmDelete = confirmDeleteId === block.id;
              const effectiveLook = normalizeEmbedLookStyle(
                block.embedMeta?.lookStyle || pageCardLook,
                'match_page'
              );
              const lookLabel = getLookLabelForProvider(pKey, effectiveLook);

              return (
                <Card key={block.id} className="p-3.5 sm:p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: tileBg,
                          color: iconColor,
                        }}
                      >
                        <ProviderGlyph provider={pKey} size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-semibold text-ink truncate">
                            {block.title || def.name}
                          </span>
                          {block.embedMeta?.connectedViaOAuth && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <Check size={11} strokeWidth={2.5} />
                              <span>Connected</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted truncate mt-0.5">
                          {[def.name, lookLabel, block.url?.replace(/^https?:\/\/(www\.)?/i, '')]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Toggle
                        checked={block.isActive}
                        onChange={() => toggleActive(block.id)}
                        ariaLabel={`Toggle visibility for ${block.title || def.name}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditorState({ isOpen: true, provider: pKey, block })
                        }
                        aria-label={`Edit ${block.title || def.name}`}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-[10px] text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <Pencil size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(block.id)}
                        aria-label={`Remove ${block.title || def.name}`}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-[10px] text-muted hover:text-[color:var(--error,#B3261E)] hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {isConfirmDelete && (
                    <div className="pt-2.5 border-t border-divider flex items-center justify-between gap-2">
                      <span className="text-[12px] text-muted">
                        Remove this card from your page?
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            await deleteBlock(block.id);
                            setConfirmDeleteId(null);
                            showToast('Removed from page');
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Platform Catalog Grid */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold text-ink">Add a platform</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {catalogProviders.map((def) => {
            const existingCount = countByPlatform[def.id] || 0;
            const iconColor =
              def.brandColor === '#000000' ||
              def.brandColor === '#FFFC00' ||
              def.brandColor === '#FFDD00'
                ? '#0A0A0A'
                : def.brandColor;
            const tileBg =
              def.brandColor === '#FFFC00'
                ? 'rgba(255, 252, 0, 0.35)'
                : def.brandColor === '#FFDD00'
                  ? 'rgba(255, 221, 0, 0.35)'
                  : `${iconColor}14`;
            const defaultKind = def.kinds[def.defaultKind];

            return (
              <Card key={def.id} className="p-4 flex flex-col justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: tileBg,
                      color: iconColor,
                    }}
                  >
                    <ProviderGlyph provider={def.id} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[15px] font-semibold text-ink leading-tight">
                        {def.name}
                      </h3>
                      {existingCount > 0 && (
                        <span className="text-[12px] font-medium text-emerald-700 whitespace-nowrap">
                          Added ({existingCount})
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted leading-snug mt-1">
                      {defaultKind?.label || def.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-divider">
                  <span className="text-[12px] text-muted">
                    {def.supportsOAuth ? 'Link or connect account' : 'Paste link'}
                  </span>
                  <Button
                    type="button"
                    variant={existingCount > 0 ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() =>
                      setEditorState({
                        isOpen: true,
                        provider: def.id as EmbedProvider,
                        block: null,
                      })
                    }
                    className="shrink-0"
                  >
                    <Plus size={14} className="mr-1" />
                    <span>{existingCount > 0 ? 'Add another' : 'Add'}</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Shortcut to Header/Footer Social Bar */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">
            Header &amp; footer social icons
          </p>
          <p className="text-[13px] text-muted mt-0.5">
            {socialIconCount > 0
              ? `${socialIconCount} compact icon${socialIconCount === 1 ? '' : 's'} shown in your profile bar.`
              : 'Prefer compact icon links instead of full cards? Manage them at the top of Links.'}
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[12px] border border-border text-[13px] font-medium text-ink hover:bg-surface-2 transition-colors shrink-0"
        >
          <span>Manage icons</span>
          <ArrowRight size={14} />
        </Link>
      </Card>

      <PlatformBlockEditor
        isOpen={editorState.isOpen}
        onClose={() => setEditorState({ isOpen: false })}
        initialProvider={editorState.provider}
        block={editorState.block}
        isPro={session.isPro}
        onSave={handleSaveEditor}
        onClearScheduleImmediate={
          editorState.block
            ? async () => {
                if (editorState.block) await clearSchedule(editorState.block.id);
              }
            : undefined
        }
      />
    </div>
  );
};

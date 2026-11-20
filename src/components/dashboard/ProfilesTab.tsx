import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Github,
  Linkedin,
  Instagram,
  Youtube,
  Music,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useBlocks } from '../../data/BlocksContext';
import { useIvioSession } from '../../auth/useIvioSession';
import { Block } from '../../data/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import {
  DiscordGlyph,
  XMarkGlyph,
  FacebookGlyph,
  ThreadsGlyph,
  PinterestGlyph,
} from '../page/EmbedBlock';
import {
  SocialEmbedComposer,
  SocialEmbedProvider,
} from '../links/SocialEmbedComposer';
import { EmbedComposer } from '../links/EmbedComposer';
import { YouTubeCardComposer } from '../links/YouTubeCardComposer';
import {
  getLookLabelForProvider,
  isSocialEmbedProvider,
  normalizeEmbedLookStyle,
} from '../../lib/embedLooks';

type PlatformKey = SocialEmbedProvider | 'youtube' | 'spotify';

interface PlatformCatalogItem {
  id: PlatformKey;
  name: string;
  description: string;
  authNote: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

const PLATFORM_CATALOG: PlatformCatalogItem[] = [
  {
    id: 'discord',
    name: 'Discord',
    description: 'Connect your Discord account or server invite card with custom looks.',
    authNote: 'OAuth or invite link',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-[#5865F2]',
    icon: DiscordGlyph,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Showcase your GitHub profile or pinned repository card.',
    authNote: 'OAuth or profile URL',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-[#24292F]',
    icon: Github,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Connect your LinkedIn profile or company page card.',
    authNote: 'OAuth or profile URL',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-[#0A66C2]',
    icon: Linkedin,
  },
  {
    id: 'x',
    name: 'X',
    description: 'Connect your X account or feature a post with custom card looks.',
    authNote: 'OAuth or post link',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-black',
    icon: XMarkGlyph,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Connect Instagram via Meta OAuth or paste a profile or reel URL.',
    authNote: 'Meta OAuth or link',
    badgeBg: 'bg-pink-50',
    badgeText: 'text-[#E1306C]',
    icon: Instagram,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Connect Facebook via Meta OAuth or showcase a page or group card.',
    authNote: 'Meta OAuth or link',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-[#1877F2]',
    icon: FacebookGlyph,
  },
  {
    id: 'threads',
    name: 'Threads',
    description: 'Connect your Threads profile or feature a thread post card.',
    authNote: 'Threads OAuth or link',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-[#101010]',
    icon: ThreadsGlyph,
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Connect Pinterest or feature a pin, board, or profile card.',
    authNote: 'OAuth, token, or link',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-[#E60023]',
    icon: PinterestGlyph,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Connect Spotify via OAuth or embed a track, album, or playlist.',
    authNote: 'Spotify OAuth or link',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-[#1DB954]',
    icon: Music,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Highlight your YouTube channel, subscriber count, and latest video.',
    authNote: 'Channel link or Google',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-600',
    icon: Youtube,
  },
];

function renderPlatformIcon(platform: PlatformKey, size = 18) {
  switch (platform) {
    case 'discord':
      return <DiscordGlyph size={size} />;
    case 'github':
      return <Github size={size} />;
    case 'linkedin':
      return <Linkedin size={size} />;
    case 'x':
      return <XMarkGlyph size={size - 1} />;
    case 'instagram':
      return <Instagram size={size} />;
    case 'facebook':
      return <FacebookGlyph size={size - 1} />;
    case 'threads':
      return <ThreadsGlyph size={size - 1} />;
    case 'pinterest':
      return <PinterestGlyph size={size - 1} />;
    case 'spotify':
      return <Music size={size} />;
    case 'youtube':
      return <Youtube size={size} />;
  }
}

export const ProfilesTab: React.FC = () => {
  const {
    blocks,
    addEmbed,
    addYouTube,
    updateBlock,
    deleteBlock,
    toggleActive,
  } = useBlocks();
  const session = useIvioSession();
  const { showToast } = useToast();

  const [composingPlatform, setComposingPlatform] = useState<PlatformKey | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const connectedBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (b.isArchived) return false;
      if (
        b.kind === 'embed' &&
        (isSocialEmbedProvider(b.embedProvider) || b.embedProvider === 'spotify')
      ) {
        return true;
      }
      if (b.kind === 'youtube' || b.kind === 'instagram') return true;
      return false;
    });
  }, [blocks]);

  const countByPlatform = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const block of connectedBlocks) {
      const key =
        block.kind === 'embed' && block.embedProvider
          ? block.embedProvider
          : block.kind;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [connectedBlocks]);

  const socialIconCount = Object.values(session.socials || {}).filter(
    (v) => typeof v === 'string' && v.trim().length > 0
  ).length;

  const getBlockPlatformKey = (block: Block): PlatformKey => {
    if (
      block.kind === 'embed' &&
      (isSocialEmbedProvider(block.embedProvider) || block.embedProvider === 'spotify')
    ) {
      return block.embedProvider;
    }
    if (block.kind === 'youtube') return 'youtube';
    return 'instagram';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] sm:text-[26px] font-semibold text-ink tracking-tight leading-tight">
          Connected accounts
        </h1>
        <p className="text-[14px] text-muted leading-relaxed">
          Connect Discord, GitHub, LinkedIn, X, Instagram, Facebook, Threads, Pinterest, Spotify, or YouTube and pick a custom look for each card.
        </p>
      </div>

      {/* Active Composer */}
      {composingPlatform && composingPlatform !== 'youtube' && composingPlatform !== 'spotify' && (
        <SocialEmbedComposer
          initialProvider={composingPlatform}
          onAdd={async ({ url, caption, provider, embedMeta }) => {
            await addEmbed(url, caption, provider, embedMeta);
            setComposingPlatform(null);
            showToast('Connected account added to your page');
          }}
          onCancel={() => setComposingPlatform(null)}
        />
      )}

      {composingPlatform === 'spotify' && (
        <EmbedComposer
          initialProvider="spotify"
          onAdd={async ({ url, caption, provider, embedMeta }) => {
            await addEmbed(url, caption, provider, embedMeta);
            setComposingPlatform(null);
            showToast('Spotify card added to your page');
          }}
          onCancel={() => setComposingPlatform(null)}
        />
      )}

      {composingPlatform === 'youtube' && (
        <YouTubeCardComposer
          onAdd={async ({ title, url, badge, youtube }) => {
            await addYouTube(title, url, badge, youtube || null);
            setComposingPlatform(null);
            showToast('YouTube showcase added to your page');
          }}
          onCancel={() => setComposingPlatform(null)}
        />
      )}

      {/* Existing Connected Account Cards on Page */}
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
              const pKey = getBlockPlatformKey(block);
              const catalog = PLATFORM_CATALOG.find((p) => p.id === pKey);
              const isEditing = editingBlockId === block.id;
              const isConfirmDelete = confirmDeleteId === block.id;
              const lookStyle =
                block.kind === 'embed'
                  ? normalizeEmbedLookStyle(block.embedMeta?.lookStyle, 'signature')
                  : null;
              const lookLabel = lookStyle
                ? getLookLabelForProvider(pKey, lookStyle)
                : null;

              if (isEditing && block.kind === 'embed' && isSocialEmbedProvider(block.embedProvider)) {
                return (
                  <SocialEmbedComposer
                    key={block.id}
                    initialProvider={block.embedProvider}
                    isEditing
                    initialValues={{
                      url: block.url || '',
                      caption: block.title || '',
                      embedMeta: block.embedMeta || null,
                    }}
                    onAdd={async ({ url, caption, provider, embedMeta }) => {
                      await updateBlock(block.id, {
                        title: caption,
                        url,
                        embedProvider: provider,
                        embedMeta: embedMeta || null,
                      });
                      setEditingBlockId(null);
                      showToast('Saved');
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                );
              }

              if (isEditing && block.kind === 'embed' && block.embedProvider === 'spotify') {
                return (
                  <EmbedComposer
                    key={block.id}
                    initialProvider="spotify"
                    isEditing
                    initialValues={{
                      url: block.url || '',
                      caption: block.title || '',
                      embedMeta: block.embedMeta || null,
                    }}
                    onAdd={async ({ url, caption, provider, embedMeta }) => {
                      await updateBlock(block.id, {
                        title: caption,
                        url,
                        embedProvider: provider,
                        embedMeta: embedMeta || null,
                      });
                      setEditingBlockId(null);
                      showToast('Saved');
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                );
              }

              if (isEditing && block.kind === 'youtube') {
                return (
                  <YouTubeCardComposer
                    key={block.id}
                    isEditing
                    initialValues={{
                      title: block.title,
                      url: block.url || '',
                      badge: block.badge || undefined,
                      youtube: block.youtube || undefined,
                    }}
                    onAdd={async ({ title, url, badge, youtube }) => {
                      await updateBlock(block.id, {
                        title,
                        url,
                        badge: badge || null,
                        youtube: youtube || null,
                      });
                      setEditingBlockId(null);
                      showToast('Saved');
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                );
              }

              return (
                <Card
                  key={block.id}
                  className="p-3.5 sm:p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-[12px] ${
                          catalog?.badgeBg || 'bg-surface-2'
                        } ${
                          catalog?.badgeText || 'text-ink'
                        } flex items-center justify-center shrink-0`}
                      >
                        {renderPlatformIcon(pKey, 18)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-semibold text-ink truncate">
                            {block.title || catalog?.name || 'Connected account'}
                          </span>
                          {block.embedMeta?.connectedViaOAuth && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <Check size={11} strokeWidth={2.5} />
                              <span>Verified</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted truncate mt-0.5">
                          {[catalog?.name, lookLabel, block.url?.replace(/^https?:\/\/(www\.)?/i, '')]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Toggle
                        checked={block.isActive}
                        onChange={() => toggleActive(block.id)}
                        ariaLabel={`Toggle visibility for ${block.title || catalog?.name || 'card'}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setComposingPlatform(null);
                          setEditingBlockId(block.id);
                        }}
                        aria-label={`Customize ${block.title || catalog?.name || 'card'}`}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-[10px] text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <Pencil size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(block.id)}
                        aria-label={`Remove ${block.title || catalog?.name || 'card'}`}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-[10px] text-muted hover:text-[color:var(--error,#B3261E)] hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {isConfirmDelete && (
                    <div className="pt-2.5 border-t border-divider flex items-center justify-between gap-2">
                      <span className="text-[12px] text-muted">
                        Remove this connected card from your page?
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

      {/* Connect New Account Grid */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold text-ink">
          Connect an account
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLATFORM_CATALOG.map((item) => {
            const Icon = item.icon;
            const existingCount = countByPlatform[item.id] || 0;
            const isSelected = composingPlatform === item.id;

            return (
              <Card
                key={item.id}
                className={`p-4 flex flex-col justify-between gap-4 transition-colors ${
                  isSelected ? 'border-ink bg-surface-2/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-[12px] ${item.badgeBg} ${item.badgeText} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[15px] font-semibold text-ink leading-tight">
                        {item.name}
                      </h3>
                      {existingCount > 0 && (
                        <span className="text-[12px] font-medium text-emerald-700 whitespace-nowrap">
                          Connected ({existingCount})
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted leading-snug mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-divider">
                  <span className="text-[12px] text-muted">{item.authNote}</span>
                  <Button
                    type="button"
                    variant={existingCount > 0 ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => {
                      setEditingBlockId(null);
                      setComposingPlatform(item.id);
                    }}
                    className="shrink-0"
                  >
                    <Plus size={14} className="mr-1" />
                    <span>{existingCount > 0 ? 'Add another' : 'Connect'}</span>
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
    </div>
  );
};

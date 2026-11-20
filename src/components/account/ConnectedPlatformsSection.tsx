import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { Block, EmbedProvider } from '../../data/types';
import { useBlocks } from '../../data/BlocksContext';
import { getProviderDefinition } from '../../lib/providers';
import { ProviderGlyph } from '../page/EmbedBlock';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { useToast } from '../ui/Toast';

export interface ConnectedPlatformGroup {
  provider: EmbedProvider;
  providerName: string;
  brandColor: string;
  accountName: string;
  needsAttention: boolean;
  blocks: Block[];
}

export function groupConnectedPlatforms(blocks: Block[]): ConnectedPlatformGroup[] {
  const map = new Map<EmbedProvider, ConnectedPlatformGroup>();
  for (const block of blocks) {
    if (!block.embedMeta?.connectedViaOAuth) continue;
    const provider = (block.embedMeta.provider || block.embedProvider || 'generic') as EmbedProvider;
    const def = getProviderDefinition(provider);
    const existing = map.get(provider);
    const candidateName =
      block.embedMeta.title ||
      block.embedMeta.handle ||
      block.title ||
      def.name;
    const needsAttention = Boolean(block.embedMeta.needsAttention);

    if (existing) {
      existing.blocks.push(block);
      if (needsAttention) existing.needsAttention = true;
    } else {
      map.set(provider, {
        provider,
        providerName: def.name,
        brandColor: def.brandColor,
        accountName: candidateName,
        needsAttention,
        blocks: [block],
      });
    }
  }
  return Array.from(map.values());
}

interface PlatformMenuProps {
  providerName: string;
  disabled?: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
}

const PlatformRowMenu: React.FC<PlatformMenuProps> = ({
  providerName,
  disabled,
  onReconnect,
  onDisconnect,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        aria-label={`Actions for ${providerName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[12px] text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] w-44 rounded-[12px] bg-surface border border-border shadow-[0_12px_32px_rgba(10,10,10,0.12)] py-1.5 z-40"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReconnect();
            }}
            className="w-full min-h-[44px] px-3.5 flex items-center text-[14px] font-medium text-ink hover:bg-surface-2 text-left cursor-pointer"
          >
            Reconnect
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
            className="w-full min-h-[44px] px-3.5 flex items-center text-[14px] font-medium text-[color:var(--error,#B3261E)] hover:bg-red-50 text-left cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export const ConnectedPlatformsSection: React.FC<{
  offline?: boolean;
  onProvidersDetected?: (providers: Set<string>) => void;
}> = ({ offline = false, onProvidersDetected }) => {
  const { blocks, isLoading, updateBlock } = useBlocks();
  const { showToast } = useToast();

  const [reconnectingProvider, setReconnectingProvider] = useState<EmbedProvider | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<ConnectedPlatformGroup | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const groups = useMemo(() => groupConnectedPlatforms(blocks), [blocks]);
  const providersKey = useMemo(
    () => groups.map((g) => g.provider).sort().join(','),
    [groups]
  );
  const lastReportedKeyRef = useRef<string | null>(null);
  const onProvidersDetectedRef = useRef(onProvidersDetected);
  onProvidersDetectedRef.current = onProvidersDetected;

  useEffect(() => {
    if (lastReportedKeyRef.current === providersKey) return;
    lastReportedKeyRef.current = providersKey;
    onProvidersDetectedRef.current?.(new Set(groups.map((g) => g.provider)));
  }, [providersKey, groups]);

  // Listen for OAuth popup completion when reconnecting from /account#connections
  useEffect(() => {
    if (!reconnectingProvider) return;

    const handlePayload = async (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'IVEO_SOCIAL_OAUTH_SUCCESS' && payload.profile) {
        const p = payload.profile;
        const targetGroup = groups.find((g) => g.provider === reconnectingProvider);
        if (targetGroup) {
          for (const b of targetGroup.blocks) {
            await updateBlock(b.id, {
              embedMeta: {
                provider: targetGroup.provider,
                ...(b.embedMeta || {}),
                title: p.displayName || b.embedMeta?.title,
                handle: p.handle || b.embedMeta?.handle,
                avatarUrl: p.avatarUrl || b.embedMeta?.avatarUrl,
                description: p.bio || b.embedMeta?.description,
                statsLabel: p.statsLabel || b.embedMeta?.statsLabel,
                connectedViaOAuth: true,
                needsAttention: false,
                failureCount: 0,
                fetchedAt: new Date().toISOString(),
              },
            }).catch(() => {});
          }
        }
        setReconnectingProvider(null);
        showToast('Platform reconnected');
      } else if (payload.type === 'IVEO_YOUTUBE_OAUTH_SUCCESS' && payload.channel) {
        const ch = payload.channel;
        const targetGroup = groups.find((g) => g.provider === 'youtube');
        if (targetGroup) {
          for (const b of targetGroup.blocks) {
            await updateBlock(b.id, {
              embedMeta: {
                provider: 'youtube',
                ...(b.embedMeta || {}),
                title: ch.channelTitle || b.embedMeta?.title,
                handle: ch.handle || b.embedMeta?.handle,
                avatarUrl: ch.avatarUrl || b.embedMeta?.avatarUrl,
                statsLabel: ch.subscriberCountText || b.embedMeta?.statsLabel,
                connectedViaOAuth: true,
                needsAttention: false,
                failureCount: 0,
                fetchedAt: new Date().toISOString(),
              },
            }).catch(() => {});
          }
        }
        setReconnectingProvider(null);
        showToast('YouTube reconnected');
      } else if (
        payload.type === 'IVEO_SOCIAL_OAUTH_ERROR' ||
        payload.type === 'IVEO_YOUTUBE_OAUTH_ERROR'
      ) {
        setReconnectingProvider(null);
        showToast(payload.error || "Couldn't reconnect platform.");
      }
    };

    const onMessage = (e: MessageEvent) => handlePayload(e.data);
    let bcSocial: BroadcastChannel | null = null;
    let bcYt: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcSocial = new BroadcastChannel('iveo_social_oauth');
        bcSocial.onmessage = (e) => handlePayload(e.data);
        bcYt = new BroadcastChannel('iveo_yt_oauth');
        bcYt.onmessage = (e) => handlePayload(e.data);
      }
    } catch {
      // ignore
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      bcSocial?.close();
      bcYt?.close();
    };
  }, [reconnectingProvider, groups, updateBlock, showToast]);

  const handleReconnect = async (provider: EmbedProvider) => {
    if (offline) return;
    setReconnectingProvider(provider);
    try {
      const endpoint =
        provider === 'youtube'
          ? `/api/oauth/youtube/url?origin=${encodeURIComponent(window.location.origin)}`
          : `/api/oauth/${provider}/url?origin=${encodeURIComponent(window.location.origin)}`;
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        showToast(data?.message || 'Connection is unavailable right now.');
        setReconnectingProvider(null);
        return;
      }
      const w = 520;
      const h = 660;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
      const popup = window.open(
        data.url,
        `iveo_reconnect_${provider}`,
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
      if (!popup) {
        showToast('Allow popups to reconnect this platform.');
        setReconnectingProvider(null);
      }
    } catch {
      showToast("Couldn't start reconnection.");
      setReconnectingProvider(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnect || isDisconnecting || offline) return;
    setIsDisconnecting(true);
    try {
      for (const b of confirmDisconnect.blocks) {
        await updateBlock(b.id, {
          embedMeta: {
            provider: confirmDisconnect.provider,
            ...(b.embedMeta || {}),
            connectedViaOAuth: false,
            needsAttention: true,
          },
        });
      }
      showToast(`${confirmDisconnect.providerName} disconnected`);
      setConfirmDisconnect(null);
    } catch {
      showToast("Couldn't disconnect platform. Try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return <div className="p-5 h-20 bg-surface-2/60 animate-pulse" aria-busy="true" />;
  }

  if (groups.length === 0) {
    return (
      <div className="p-5 text-[13px] text-muted">
        No connected platforms. Connect one from a card editor.
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-divider">
        {groups.map((group) => {
          const blockCountLabel =
            group.blocks.length === 1 ? 'Used by 1 block' : `Used by ${group.blocks.length} blocks`;
          const busy = reconnectingProvider === group.provider;

          return (
            <li key={group.provider} className="p-4 sm:px-5 flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-[10px] border border-border bg-surface-2 flex items-center justify-center shrink-0"
                  style={{ color: group.brandColor }}
                >
                  <ProviderGlyph provider={group.provider} size={18} />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-ink truncate">
                      {group.providerName} · {group.accountName}
                    </span>
                    {group.needsAttention ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-[#92400E] border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#92400E]" />
                        Needs reconnecting
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-[#166534] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted mt-0.5">{blockCountLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {busy && <Loader2 size={15} className="animate-spin text-muted" />}
                {group.needsAttention && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={offline || busy}
                    onClick={() => handleReconnect(group.provider)}
                    className="hidden sm:inline-flex"
                  >
                    Reconnect
                  </Button>
                )}
                <PlatformRowMenu
                  providerName={group.providerName}
                  disabled={offline || busy}
                  onReconnect={() => handleReconnect(group.provider)}
                  onDisconnect={() => setConfirmDisconnect(group)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <BottomSheet
        isOpen={Boolean(confirmDisconnect)}
        onClose={() => {
          if (!isDisconnecting) setConfirmDisconnect(null);
        }}
        title={confirmDisconnect ? `Disconnect ${confirmDisconnect.providerName}?` : ''}
        subtitle={
          confirmDisconnect
            ? `Your ${confirmDisconnect.blocks.length} saved card${confirmDisconnect.blocks.length === 1 ? '' : 's'} will stay on your page with their last saved details, but automatic updates will stop until you reconnect.`
            : undefined
        }
        maxWidthClass="sm:max-w-md"
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={isDisconnecting}
            onClick={() => setConfirmDisconnect(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="md"
            loading={isDisconnecting}
            onClick={handleConfirmDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </BottomSheet>
    </>
  );
};

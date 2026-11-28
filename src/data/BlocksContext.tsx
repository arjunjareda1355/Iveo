import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Block,
  BlockLayout,
  EmbedMetaData,
  EmbedProvider,
  SignupConfig,
  TipJarConfig,
  FaqItem,
  VCardConfig,
  CoffeeData,
  YouTubeData,
  ProductConfig,
  BookingConfig,
  CountdownConfig,
  PromoConfig,
  LocationConfig,
  DownloadConfig,
  BlueskyConfig,
} from './types';
import {
  listMyBlocks,
  createBlockWithSync,
  updateBlock,
  deleteBlock as apiDeleteBlock,
  setBlockImage as apiSetBlockImage,
  saveOrderedBlocks,
  flushPendingBlockSync,
} from './linksApi';
import { storagePublicUrl } from './storageApi';
import { useToast } from '../components/ui/Toast';
import { useUpgradeDialog } from '../components/plan/UpgradeDialogProvider';

interface BlocksContextValue {
  blocks: Block[];
  isLoading: boolean;
  addLink: (title: string, url: string, options?: { thumbnailUrl?: string | null }) => Promise<void>;
  addEmbed: (url: string, caption: string, provider: EmbedProvider, embedMeta?: EmbedMetaData | null) => Promise<void>;
  addSignupForm: (config: SignupConfig) => Promise<void>;
  addTipJar: (config: TipJarConfig, title?: string) => Promise<void>;
  addCoffee: (
    title?: string,
    url?: string,
    badge?: string,
    coffee?: CoffeeData | null,
    embedMeta?: EmbedMetaData | null
  ) => Promise<void>;
  addInstagram: (title?: string, url?: string, badge?: string) => Promise<void>;
  addYouTube: (title?: string, url?: string, badge?: string, youtube?: YouTubeData | null) => Promise<void>;
  addProduct: (title: string, url: string, product: ProductConfig) => Promise<void>;
  addBooking: (title: string, url: string, booking: BookingConfig) => Promise<void>;
  addCountdown: (title: string, url: string | null, countdown: CountdownConfig) => Promise<void>;
  addPromo: (title: string, url: string | null, promo: PromoConfig) => Promise<void>;
  addLocation: (title: string, url: string, location: LocationConfig) => Promise<void>;
  addDownload: (title: string, url: string, download: DownloadConfig) => Promise<void>;
  addBluesky: (title: string, url: string, bluesky: BlueskyConfig) => Promise<void>;
  addFaq: (items: FaqItem[], title?: string) => Promise<void>;
  addVCard: (config: VCardConfig, title?: string) => Promise<void>;
  addHeader: (title: string) => Promise<void>;
  addDivider: () => Promise<void>;
  updateBlock: (id: string, patch: Partial<Block>) => Promise<void>;
  setBlockImage: (id: string, thumbnailPath: string | null, layout: BlockLayout, thumbnailUrl?: string | null) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  reorderBlocks: (orderedIds: string[]) => Promise<void>;
  clearSchedule: (id: string) => Promise<void>;
  duplicateBlock: (block: Block) => Promise<void>;
}

const BlocksContext = createContext<BlocksContextValue | null>(null);

export const BlocksProvider: React.FC<{
  userId: string;
  ownerUserId?: string | null;
  primaryEmail?: string | null;
  token?: string | null;
  children: React.ReactNode;
}> = ({ userId, ownerUserId = null, primaryEmail = null, token = null, children }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blocksRef = useRef<Block[]>([]);
  blocksRef.current = blocks;
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();
  const { openUpgrade } = useUpgradeDialog();
  const isDemoMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('demo') === '1' ||
      new URLSearchParams(window.location.search).get('autostart') === '1');

  const authCtx = React.useMemo(
    () => ({ ownerUserId, primaryEmail, isDemo: isDemoMode }),
    [ownerUserId, primaryEmail, isDemoMode]
  );

  const enqueueMutation = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = mutationQueueRef.current.catch(() => {}).then(task);
    mutationQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, []);

  const persistPublicBlocksCache = useCallback(
    (nextBlocks: Block[]) => {
      if (typeof window === 'undefined' || !userId) return;
      const clean = userId.replace(/^@+/, '').toLowerCase().trim();
      if (!clean) return;
      const nowIso = new Date().toISOString();
      try {
        const publicBlocks = [...nextBlocks]
          .filter((b) => b.isActive !== false && !b.isArchived)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((b) => ({
            ...b,
            url: b.isProtected ? null : b.url ?? null,
          }));
        localStorage.setItem(`iveo_public_blocks_${clean}`, JSON.stringify(publicBlocks));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('iveo_profile_sync', { detail: { username: clean, type: 'blocks', updatedAt: nowIso } }));
      } catch {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('iveo_profile_sync');
          ch.postMessage({ username: clean, type: 'blocks', updatedAt: nowIso });
          ch.close();
        }
      } catch {}
    },
    [userId]
  );

  const prependNormalizedBlock = useCallback((prev: Block[], newBlock: Block): Block[] => {
    return [{ ...newBlock, position: 0 }, ...prev.filter((b) => b.id !== newBlock.id)].map(
      (item, idx) => ({ ...item, position: idx })
    );
  }, []);

  const applySyncedBlocks = useCallback(
    (fallbackBlocks: Block[], serverBlocks?: Block[] | null) => {
      const finalBlocks = Array.isArray(serverBlocks) ? serverBlocks : fallbackBlocks;
      blocksRef.current = finalBlocks;
      setBlocks(finalBlocks);
      persistPublicBlocksCache(finalBlocks);
    },
    [persistPublicBlocksCache]
  );

  const fetchBlocks = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await listMyBlocks(token, userId, authCtx);
      blocksRef.current = data;
      setBlocks(data);
      persistPublicBlocksCache(data);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [userId, token, authCtx, persistPublicBlocksCache]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  useEffect(() => {
    const flushNow = () => {
      void flushPendingBlockSync(userId, authCtx).catch(() => {});
    };
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      flushNow();
    };
  }, [userId, authCtx]);

  const addLink = (title: string, url: string, options?: { thumbnailUrl?: string | null }) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'link',
            title,
            url,
            thumbnailUrl: options?.thumbnailUrl ?? null,
            layout: 'classic',
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Link added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('scheduling');
        } else {
          showToast("Couldn't add link. Try again.");
        }
        throw err;
      }
    });

  const addEmbed = (url: string, caption: string, provider: EmbedProvider, embedMeta?: EmbedMetaData | null) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'embed',
            title: caption,
            url,
            embedProvider: provider,
            embedMeta: embedMeta || null,
            layout: 'classic',
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Embed added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('embeds');
        } else {
          showToast("Couldn't add embed. Try again.");
        }
        throw err;
      }
    });

  const addSignupForm = (config: SignupConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'signup',
            title: config.heading || 'Join my list',
            position: 0,
            signup: config,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Signup form added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('contact_forms');
        } else {
          showToast("Couldn't add signup form. Try again.");
        }
        throw err;
      }
    });

  const addTipJar = (config: TipJarConfig, title: string = 'Support My Work') =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'tip_jar',
            title,
            position: 0,
            tipJar: config,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Tip Jar added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add tip jar. Try again.");
        throw err;
      }
    });

  const addFaq = (items: FaqItem[], title: string = 'Frequently Asked Questions') =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'faq',
            title,
            position: 0,
            faq: { items },
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('FAQ section added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add FAQ. Try again.");
        throw err;
      }
    });

  const addVCard = (config: VCardConfig, title?: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'vcard',
            title: title || config.fullName || 'Save Contact',
            position: 0,
            vcard: config,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Contact card added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add contact card. Try again.");
        throw err;
      }
    });

  const addHeader = (title: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'header',
            title,
            url: null,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Header added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add header. Try again.");
        throw err;
      }
    });

  const addDivider = () =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'divider',
            title: '',
            url: null,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Divider added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add divider. Try again.");
        throw err;
      }
    });

  const addCoffee = (
    title: string = 'Buy Me a Coffee',
    url: string = 'https://buymeacoffee.com',
    badge?: string,
    coffee?: CoffeeData | null,
    embedMeta?: EmbedMetaData | null
  ) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'coffee',
            title,
            url,
            badge,
            coffee: coffee || null,
            embedProvider: embedMeta ? 'coffee' : null,
            embedMeta: embedMeta || null,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Buy Me a Coffee block added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add coffee block. Try again.");
        throw err;
      }
    });

  const addInstagram = (title: string = 'Instagram', url: string = 'https://instagram.com', badge?: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'instagram',
            title,
            url,
            badge,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Instagram showcase added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add Instagram block. Try again.");
        throw err;
      }
    });

  const addYouTube = (
    title: string = 'YouTube Channel',
    url: string = 'https://youtube.com',
    badge?: string,
    youtube?: YouTubeData | null
  ) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'youtube',
            title,
            url,
            badge,
            youtube: youtube || null,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('YouTube showcase added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add YouTube block. Try again.");
        throw err;
      }
    });

  const addProduct = (title: string, url: string, product: ProductConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'product',
            title,
            url,
            product,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Product card added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add product card. Try again.");
        throw err;
      }
    });

  const addBooking = (title: string, url: string, booking: BookingConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'booking',
            title,
            url,
            booking,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Booking card added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add booking card. Try again.");
        throw err;
      }
    });

  const addCountdown = (title: string, url: string | null, countdown: CountdownConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'countdown',
            title,
            url,
            countdown,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Countdown added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add countdown. Try again.");
        throw err;
      }
    });

  const addPromo = (title: string, url: string | null, promo: PromoConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'promo',
            title,
            url,
            promo,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Promo code added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add promo code. Try again.");
        throw err;
      }
    });

  const addLocation = (title: string, url: string, location: LocationConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'location',
            title,
            url,
            location,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Location card added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add location card. Try again.");
        throw err;
      }
    });

  const addDownload = (title: string, url: string, download: DownloadConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'download',
            title,
            url,
            download,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Download card added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add download card. Try again.");
        throw err;
      }
    });

  const addBluesky = (title: string, url: string, bluesky: BlueskyConfig) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: 'bluesky',
            title,
            url,
            bluesky,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Bluesky block added');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't add Bluesky block. Try again.");
        throw err;
      }
    });

  const updateBlockFields = (id: string, patch: Partial<Block>) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      applySyncedBlocks(next);

      try {
        const serverBlocks = await updateBlock(token, userId, id, patch, authCtx, prev);
        if (serverBlocks) {
          applySyncedBlocks(next, serverBlocks);
        }
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        if (err instanceof Error && err.message === 'pro_required') {
          if (patch.startAt || patch.endAt) openUpgrade('scheduling');
          else if (patch.embedProvider) openUpgrade('embeds');
        } else {
          showToast("Couldn't save changes. Try again.");
        }
        throw err;
      }
    });

  const setBlockImage = (
    id: string,
    thumbnailPath: string | null,
    layout: BlockLayout,
    thumbnailUrl?: string | null
  ) =>
    enqueueMutation(async () => {
      const finalThumbUrl =
        thumbnailUrl !== undefined
          ? thumbnailUrl
          : thumbnailPath
            ? storagePublicUrl(thumbnailPath)
            : null;
      const prev = [...blocksRef.current];
      const next = prev.map((item) =>
        item.id === id ? { ...item, thumbnailPath, thumbnailUrl: finalThumbUrl, layout } : item
      );
      applySyncedBlocks(next);

      try {
        const serverBlocks = await apiSetBlockImage(
          token,
          userId,
          id,
          {
            thumbnailPath,
            layout,
            thumbnailUrl: finalThumbUrl,
          },
          authCtx,
          prev
        );
        if (serverBlocks) {
          applySyncedBlocks(next, serverBlocks);
        }
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        showToast("Couldn't save image. Try again.");
        throw err;
      }
    });

  const deleteBlockById = (id: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      const target = prev.find((b) => b.id === id);
      const next = prev.filter((item) => item.id !== id).map((item, idx) => ({ ...item, position: idx }));
      applySyncedBlocks(next);

      try {
        const serverBlocks = await apiDeleteBlock(token, userId, id, authCtx, prev);
        if (serverBlocks) {
          applySyncedBlocks(next, serverBlocks);
        }
        const deletedMsg =
          target?.kind === 'header'
            ? 'Header deleted'
            : target?.kind === 'divider'
              ? 'Divider deleted'
              : target?.kind === 'embed'
                ? 'Embed deleted'
                : 'Link deleted';
        showToast(deletedMsg);
      } catch {
        applySyncedBlocks(prev);
        showToast("Couldn't delete item. Try again.");
      }
    });

  const toggleArchive = (id: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      const target = prev.find((b) => b.id === id);
      if (!target) return;
      const nextArchived = !target.isArchived;
      const next = prev.map((item) => (item.id === id ? { ...item, isArchived: nextArchived } : item));
      applySyncedBlocks(next);

      try {
        const serverBlocks = await updateBlock(token, userId, id, { isArchived: nextArchived }, authCtx, prev);
        if (serverBlocks) {
          applySyncedBlocks(next, serverBlocks);
        }
        const isEmbed = target.kind === 'embed';
        if (nextArchived) {
          showToast(isEmbed ? 'Embed archived' : 'Link archived');
        } else {
          showToast(isEmbed ? 'Embed restored' : 'Link restored');
        }
      } catch {
        applySyncedBlocks(prev);
        showToast("Couldn't update item. Try again.");
      }
    });

  const toggleActive = (id: string) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      const target = prev.find((b) => b.id === id);
      if (!target) return;
      const nextActive = !target.isActive;
      const next = prev.map((item) => (item.id === id ? { ...item, isActive: nextActive } : item));
      applySyncedBlocks(next);

      try {
        const serverBlocks = await updateBlock(token, userId, id, { isActive: nextActive }, authCtx, prev);
        if (serverBlocks) {
          applySyncedBlocks(next, serverBlocks);
        }
      } catch {
        applySyncedBlocks(prev);
        showToast("Couldn't update item. Try again.");
      }
    });

  const reorderBlocks = (orderedIds: string[]) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      const idMap = new Map(prev.map((b) => [b.id, b]));
      const reordered: Block[] = [];

      orderedIds.forEach((id, idx) => {
        const b = idMap.get(id);
        if (b) reordered.push({ ...b, position: idx });
      });

      // Append unmentioned (e.g. archived) blocks preserving order indices
      prev.forEach((b) => {
        if (!orderedIds.includes(b.id)) {
          reordered.push({ ...b, position: reordered.length });
        }
      });

      applySyncedBlocks(reordered);

      try {
        const serverBlocks = await saveOrderedBlocks(token, userId, reordered, authCtx);
        if (serverBlocks) {
          applySyncedBlocks(reordered, serverBlocks);
        }
      } catch {
        applySyncedBlocks(prev);
        showToast("Couldn't save order. Try again.");
      }
    });

  const clearSchedule = async (id: string) => {
    await updateBlockFields(id, { startAt: null, endAt: null });
    showToast('Schedule cleared');
  };

  const duplicateBlock = (block: Block) =>
    enqueueMutation(async () => {
      const prev = [...blocksRef.current];
      try {
        const nextTitle = block.title ? `Copy of ${block.title}` : block.kind === 'divider' ? '' : 'Copy';
        const { block: newBlock, blocks: serverBlocks } = await createBlockWithSync(
          token,
          userId,
          {
            kind: block.kind,
            title: nextTitle,
            url: block.url ?? undefined,
            icon: block.icon ?? undefined,
            layout: block.layout,
            embedProvider: block.embedProvider ?? undefined,
            embedMeta: block.embedMeta ?? undefined,
            signup: block.signup ?? undefined,
            tipJar: block.tipJar ?? undefined,
            faq: block.faq ?? undefined,
            vcard: block.vcard ?? undefined,
            coffee: block.coffee ?? undefined,
            youtube: block.youtube ?? undefined,
            product: block.product ?? undefined,
            booking: block.booking ?? undefined,
            countdown: block.countdown ?? undefined,
            promo: block.promo ?? undefined,
            location: block.location ?? undefined,
            download: block.download ?? undefined,
            bluesky: block.bluesky ?? undefined,
            animation: block.animation ?? undefined,
            badge: block.badge ?? undefined,
            position: 0,
          },
          authCtx,
          prev
        );
        applySyncedBlocks(prependNormalizedBlock(prev, newBlock), serverBlocks);
        showToast('Item duplicated');
      } catch (err: unknown) {
        applySyncedBlocks(prev);
        if (err instanceof Error && err.message === 'pro_required') {
          openUpgrade('embeds');
        } else {
          showToast("Couldn't duplicate item. Try again.");
        }
      }
    });

  return (
    <BlocksContext.Provider
      value={{
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
        addBluesky,
        addFaq,
        addVCard,
        addHeader,
        addDivider,
        updateBlock: updateBlockFields,
        setBlockImage,
        deleteBlock: deleteBlockById,
        toggleArchive,
        toggleActive,
        reorderBlocks,
        clearSchedule,
        duplicateBlock,
      }}
    >
      {children}
    </BlocksContext.Provider>
  );
};

export function useBlocks(): BlocksContextValue {
  const ctx = useContext(BlocksContext);
  if (!ctx) {
    throw new Error('useBlocks must be used within a BlocksProvider');
  }
  return ctx;
}

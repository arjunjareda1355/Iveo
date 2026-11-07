import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Block, BlockLayout, EmbedProvider, SignupConfig, TipJarConfig, FaqItem, VCardConfig } from './types';
import {
  listMyBlocks,
  createBlock,
  updateBlock,
  deleteBlock as apiDeleteBlock,
  setBlockImage as apiSetBlockImage,
} from './linksApi';
import { useToast } from '../components/ui/Toast';
import { useUpgradeDialog } from '../components/plan/UpgradeDialogProvider';
import {
  syncBlockToFirebase,
  syncAllBlocksToFirebase,
  deleteBlockFromFirebase,
} from '../lib/firebaseSync';

interface BlocksContextValue {
  blocks: Block[];
  isLoading: boolean;
  addLink: (title: string, url: string) => Promise<void>;
  addEmbed: (url: string, caption: string, provider: EmbedProvider) => Promise<void>;
  addSignupForm: (config: SignupConfig) => Promise<void>;
  addTipJar: (config: TipJarConfig, title?: string) => Promise<void>;
  addFaq: (items: FaqItem[], title?: string) => Promise<void>;
  addVCard: (config: VCardConfig, title?: string) => Promise<void>;
  addHeader: (title: string) => Promise<void>;
  addDivider: () => Promise<void>;
  updateBlock: (id: string, patch: Partial<Block>) => Promise<void>;
  setBlockImage: (id: string, thumbnailPath: string | null, layout: BlockLayout) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  reorderBlocks: (orderedIds: string[]) => Promise<void>;
  clearSchedule: (id: string) => Promise<void>;
}

const BlocksContext = createContext<BlocksContextValue | null>(null);

export const BlocksProvider: React.FC<{
  userId: string;
  token?: string | null;
  children: React.ReactNode;
}> = ({ userId, token = null, children }) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();
  const { openUpgrade } = useUpgradeDialog();

  const fetchBlocks = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listMyBlocks(token, userId);
      setBlocks(data);
      syncAllBlocksToFirebase(userId, data).catch(() => {});
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const addLink = async (title: string, url: string) => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'link',
        title,
        url,
        layout: 'classic',
        position: blocks.length,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Link added');
    } catch (err: unknown) {
      setBlocks(prev);
      if (err instanceof Error && err.message === 'pro_required') {
        openUpgrade('scheduling');
      } else {
        showToast("Couldn't add link. Try again.");
      }
      throw err;
    }
  };

  const addEmbed = async (url: string, caption: string, provider: EmbedProvider) => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'embed',
        title: caption,
        url,
        embedProvider: provider,
        layout: 'classic',
        position: blocks.length,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Embed added');
    } catch (err: unknown) {
      setBlocks(prev);
      if (err instanceof Error && err.message === 'pro_required') {
        openUpgrade('embeds');
      } else {
        showToast("Couldn't add embed. Try again.");
      }
      throw err;
    }
  };

  const addSignupForm = async (config: SignupConfig) => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'signup',
        title: config.heading || 'Join my list',
        position: blocks.length,
        signup: config,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Signup form added');
    } catch (err: unknown) {
      setBlocks(prev);
      if (err instanceof Error && err.message === 'pro_required') {
        openUpgrade('contact_forms');
      } else {
        showToast("Couldn't add signup form. Try again.");
      }
      throw err;
    }
  };

  const addTipJar = async (config: TipJarConfig, title: string = 'Support My Work') => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'tip_jar',
        title,
        position: blocks.length,
        tipJar: config,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Tip Jar added');
    } catch (err: unknown) {
      setBlocks(prev);
      showToast("Couldn't add tip jar. Try again.");
      throw err;
    }
  };

  const addFaq = async (items: FaqItem[], title: string = 'Frequently Asked Questions') => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'faq',
        title,
        position: blocks.length,
        faq: { items },
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('FAQ section added');
    } catch (err: unknown) {
      setBlocks(prev);
      showToast("Couldn't add FAQ. Try again.");
      throw err;
    }
  };

  const addVCard = async (config: VCardConfig, title?: string) => {
    const prev = [...blocks];
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'vcard',
        title: title || config.fullName || 'Save Contact',
        position: blocks.length,
        vcard: config,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Contact card added');
    } catch (err: unknown) {
      setBlocks(prev);
      showToast("Couldn't add contact card. Try again.");
      throw err;
    }
  };

  const addHeader = async (title: string) => {
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'header',
        title,
        position: blocks.length,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Header added');
    } catch {
      showToast("Couldn't add header. Try again.");
    }
  };

  const addDivider = async () => {
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'divider',
        title: '',
        position: blocks.length,
      });
      setBlocks((b) => [newBlock, ...b]);
      syncBlockToFirebase(userId, newBlock).catch(() => {});
      showToast('Divider added');
    } catch {
      showToast("Couldn't add divider. Try again.");
    }
  };

  const updateBlockFields = async (id: string, patch: Partial<Block>) => {
    const prev = [...blocks];
    setBlocks((b) => b.map((item) => (item.id === id ? { ...item, ...patch } : item)));

    try {
      await updateBlock(token, userId, id, patch);
      const updated = { ...(blocks.find((b) => b.id === id) || {}), ...patch };
      syncBlockToFirebase(userId, updated as Block).catch(() => {});
    } catch (err: unknown) {
      setBlocks(prev);
      if (err instanceof Error && err.message === 'pro_required') {
        if (patch.startAt || patch.endAt) openUpgrade('scheduling');
        else if (patch.embedProvider) openUpgrade('embeds');
      } else {
        showToast("Couldn't save changes. Try again.");
      }
      throw err;
    }
  };

  const setBlockImage = async (
    id: string,
    thumbnailPath: string | null,
    layout: BlockLayout
  ) => {
    const prev = [...blocks];
    setBlocks((b) =>
      b.map((item) => (item.id === id ? { ...item, thumbnailPath, layout } : item))
    );

    try {
      await apiSetBlockImage(token, userId, id, { thumbnailPath, layout });
      const updated = { ...(blocks.find((b) => b.id === id) || {}), thumbnailPath, layout };
      syncBlockToFirebase(userId, updated as Block).catch(() => {});
    } catch (err: unknown) {
      setBlocks(prev);
      showToast("Couldn't save image. Try again.");
      throw err;
    }
  };

  const deleteBlockById = async (id: string) => {
    const target = blocks.find((b) => b.id === id);
    const prev = [...blocks];
    setBlocks((b) => b.filter((item) => item.id !== id));

    try {
      await apiDeleteBlock(token, userId, id);
      deleteBlockFromFirebase(userId, id).catch(() => {});
      showToast(target?.kind === 'embed' ? 'Embed deleted' : 'Link deleted');
    } catch {
      setBlocks(prev);
      showToast("Couldn't delete item. Try again.");
    }
  };

  const toggleArchive = async (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    const nextArchived = !target.isArchived;

    const prev = [...blocks];
    setBlocks((b) =>
      b.map((item) => (item.id === id ? { ...item, isArchived: nextArchived } : item))
    );

    try {
      await updateBlock(token, userId, id, { isArchived: nextArchived });
      const isEmbed = target.kind === 'embed';
      if (nextArchived) {
        showToast(isEmbed ? 'Embed archived' : 'Link archived');
      } else {
        showToast(isEmbed ? 'Embed restored' : 'Link restored');
      }
    } catch {
      setBlocks(prev);
      showToast("Couldn't update item. Try again.");
    }
  };

  const toggleActive = async (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    const nextActive = !target.isActive;

    const prev = [...blocks];
    setBlocks((b) =>
      b.map((item) => (item.id === id ? { ...item, isActive: nextActive } : item))
    );

    try {
      await updateBlock(token, userId, id, { isActive: nextActive });
    } catch {
      setBlocks(prev);
      showToast("Couldn't update item. Try again.");
    }
  };

  const reorderBlocks = async (orderedIds: string[]) => {
    const idMap = new Map(blocks.map((b) => [b.id, b]));
    const reordered: Block[] = [];

    orderedIds.forEach((id, idx) => {
      const b = idMap.get(id);
      if (b) reordered.push({ ...b, position: idx });
    });

    // Append unmentioned (e.g. archived) blocks
    blocks.forEach((b) => {
      if (!orderedIds.includes(b.id)) reordered.push(b);
    });

    setBlocks(reordered);
    syncAllBlocksToFirebase(userId, reordered).catch(() => {});

    // Save positions
    for (let i = 0; i < orderedIds.length; i++) {
      updateBlock(token, userId, orderedIds[i], { position: i }).catch(() => {});
    }
  };

  const clearSchedule = async (id: string) => {
    await updateBlockFields(id, { startAt: null, endAt: null });
    showToast('Schedule cleared');
  };

  return (
    <BlocksContext.Provider
      value={{
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
        updateBlock: updateBlockFields,
        setBlockImage,
        deleteBlock: deleteBlockById,
        toggleArchive,
        toggleActive,
        reorderBlocks,
        clearSchedule,
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

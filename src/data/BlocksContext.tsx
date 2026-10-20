import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Block, BlockLayout, EmbedProvider } from './types';
import {
  listMyBlocks,
  createBlock,
  updateBlock,
  deleteBlock as apiDeleteBlock,
  setBlockImage as apiSetBlockImage,
} from './linksApi';
import { useToast } from '../components/ui/Toast';
import { useUpgradeDialog } from '../components/plan/UpgradeDialogProvider';

interface BlocksContextValue {
  blocks: Block[];
  isLoading: boolean;
  addLink: (title: string, url: string) => Promise<void>;
  addEmbed: (url: string, caption: string, provider: EmbedProvider) => Promise<void>;
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

  const addHeader = async (title: string) => {
    try {
      const newBlock = await createBlock(token, userId, {
        kind: 'header',
        title,
        position: blocks.length,
      });
      setBlocks((b) => [newBlock, ...b]);
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

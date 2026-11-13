import { doc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Block } from '../data/types';

/**
 * Background data synchronization helpers for Firebase Firestore.
 * Ensures data is persisted in the background without affecting UI or blocking the user.
 */

export async function syncProfileToFirebase(userId: string, profileData: Record<string, any>): Promise<void> {
  if (!userId) return;
  try {
    const cleanData = {
      userId,
      ...profileData,
      updatedAt: new Date().toISOString(),
    };
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanData, { merge: true });
    if (profileData.socials !== undefined) {
      await updateDoc(userRef, { socials: profileData.socials || {} }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking background log
    console.warn('Firebase background profile sync notice:', err);
  }
}

export async function syncBlockToFirebase(userId: string, block: Block): Promise<void> {
  if (!userId || !block?.id) return;
  try {
    const cleanBlock: Record<string, any> = {
      id: block.id,
      userId,
      kind: block.kind,
      title: block.title || '',
      url: block.url || null,
      isActive: block.isActive ?? true,
      isArchived: block.isArchived ?? false,
      order: block.position ?? 0,
      position: block.position ?? 0,
      layout: block.layout || 'classic',
      thumbnailUrl: block.thumbnailUrl || null,
      animation: block.animation || 'none',
      badge: block.badge || null,
      isProtected: block.isProtected || false,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
      updatedAt: new Date().toISOString(),
    };
    if (block.embedProvider) cleanBlock.embedProvider = block.embedProvider;
    if (block.signup) cleanBlock.signup = block.signup;
    if (block.tipJar) cleanBlock.tipJar = block.tipJar;
    if (block.faq) cleanBlock.faq = block.faq;
    if (block.vcard) cleanBlock.vcard = block.vcard;

    await setDoc(doc(db, 'users', userId, 'blocks', block.id), cleanBlock, { merge: true });
  } catch (err) {
    console.warn('Firebase background block sync notice:', err);
  }
}

export async function syncAllBlocksToFirebase(userId: string, blocks: Block[]): Promise<void> {
  if (!userId || !Array.isArray(blocks)) return;
  try {
    const batch = writeBatch(db);
    const keepIds = new Set<string>();
    blocks.forEach((block) => {
      keepIds.add(block.id);
      const docRef = doc(db, 'users', userId, 'blocks', block.id);
      batch.set(docRef, {
        ...block,
        userId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    const existingSnap = await getDocs(collection(db, 'users', userId, 'blocks'));
    existingSnap.docs.forEach((docSnap) => {
      if (!keepIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    await batch.commit();
  } catch (err) {
    console.warn('Firebase background batch sync notice:', err);
  }
}

export async function deleteBlockFromFirebase(userId: string, blockId: string): Promise<void> {
  if (!userId || !blockId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'blocks', blockId));
  } catch (err) {
    console.warn('Firebase background delete block notice:', err);
  }
}

export async function syncContactToFirebase(userId: string, contact: { id: string; email?: string; phone?: string; createdAt?: string }): Promise<void> {
  if (!userId || !contact?.id) return;
  try {
    await setDoc(doc(db, 'users', userId, 'contacts', contact.id), {
      ...contact,
      userId,
      createdAt: contact.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firebase background contact sync notice:', err);
  }
}

export async function syncClickToFirebase(userId: string, blockId: string, count: number): Promise<void> {
  if (!userId || !blockId) return;
  try {
    await setDoc(doc(db, 'users', userId, 'clicks', blockId), {
      blockId,
      userId,
      count,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firebase background click sync notice:', err);
  }
}

import { doc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Block } from '../data/types';

function cleanFirestoreValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') return (Number.isFinite(value) ? value : null) as T;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cleanFirestoreValue(item)).filter((item) => item !== undefined) as unknown as T;
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (v === undefined) continue;
    const cleaned = cleanFirestoreValue(v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out as T;
}

export async function syncProfileToFirebase(userId: string, profileData: Record<string, any>): Promise<void> {
  if (!userId) return;
  try {
    const updatedAt = String(profileData.updatedAt || new Date().toISOString()).slice(0, 64);
    const cleanData = cleanFirestoreValue({
      userId: String(userId).slice(0, 128),
      ...profileData,
      ...(profileData.bio !== undefined ? { bio: String(profileData.bio || '').slice(0, 500) } : {}),
      ...(profileData.displayName !== undefined ? { displayName: String(profileData.displayName || '').slice(0, 128) } : {}),
      updatedAt,
    });
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanData, { merge: true });

    const explicitMaps: Record<string, any> = { updatedAt };
    if (profileData.socials !== undefined) explicitMaps.socials = cleanFirestoreValue(profileData.socials || {});
    if (profileData.background !== undefined) explicitMaps.background = cleanFirestoreValue(profileData.background ?? null);
    if (profileData.fontSettings !== undefined) explicitMaps.fontSettings = cleanFirestoreValue(profileData.fontSettings ?? null);
    if (profileData.buttonColors !== undefined) explicitMaps.buttonColors = cleanFirestoreValue(profileData.buttonColors ?? null);
    if (profileData.businessCard !== undefined) explicitMaps.businessCard = cleanFirestoreValue(profileData.businessCard ?? null);
    if (profileData.layoutSettings !== undefined) explicitMaps.layoutSettings = cleanFirestoreValue(profileData.layoutSettings ?? null);
    if (profileData.appearance !== undefined) explicitMaps.appearance = cleanFirestoreValue(profileData.appearance ?? null);

    if (Object.keys(explicitMaps).length > 1) {
      await updateDoc(userRef, explicitMaps).catch(() => {});
    }

    const mirrorId = typeof profileData.userId === 'string' ? profileData.userId.trim().slice(0, 128) : '';
    if (mirrorId && mirrorId !== userId && mirrorId !== 'owner') {
      const mirrorRef = doc(db, 'users', mirrorId);
      await setDoc(mirrorRef, cleanData, { merge: true });
      if (Object.keys(explicitMaps).length > 1) {
        await updateDoc(mirrorRef, explicitMaps).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Firebase background profile sync notice:', err);
  }
}

export async function syncBlockToFirebase(userId: string, block: Block): Promise<void> {
  if (!userId || !block?.id) return;
  try {
    const cleanBlock = cleanFirestoreValue<Record<string, any>>({
      id: String(block.id).slice(0, 128),
      userId: String(userId).slice(0, 128),
      kind: String(block.kind || 'link').slice(0, 32),
      title: String(block.title || '').slice(0, 256),
      url: block.url ? String(block.url).slice(0, 2048) : null,
      isActive: block.isActive ?? true,
      isArchived: block.isArchived ?? false,
      order: block.position ?? 0,
      position: block.position ?? 0,
      layout: block.layout || 'classic',
      thumbnailUrl: block.thumbnailUrl ? String(block.thumbnailUrl).slice(0, 2048) : null,
      animation: block.animation || 'none',
      badge: block.badge || null,
      isProtected: block.isProtected || false,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
      updatedAt: new Date().toISOString().slice(0, 64),
      ...(block.embedProvider ? { embedProvider: block.embedProvider } : {}),
      ...(block.embedMeta ? { embedMeta: block.embedMeta } : {}),
      ...(block.signup ? { signup: block.signup } : {}),
      ...(block.tipJar ? { tipJar: block.tipJar } : {}),
      ...(block.faq ? { faq: block.faq } : {}),
      ...(block.vcard ? { vcard: block.vcard } : {}),
      ...(block.coffee ? { coffee: block.coffee } : {}),
      ...(block.youtube ? { youtube: block.youtube } : {}),
      ...(block.product ? { product: block.product } : {}),
      ...(block.booking ? { booking: block.booking } : {}),
      ...(block.countdown ? { countdown: block.countdown } : {}),
      ...(block.promo ? { promo: block.promo } : {}),
      ...(block.location ? { location: block.location } : {}),
      ...(block.download ? { download: block.download } : {}),
      ...(block.bluesky ? { bluesky: block.bluesky } : {}),
    });

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
    const nowIso = new Date().toISOString().slice(0, 64);
    blocks.forEach((block) => {
      keepIds.add(block.id);
      const docRef = doc(db, 'users', userId, 'blocks', block.id);
      batch.set(
        docRef,
        cleanFirestoreValue({
          ...block,
          id: String(block.id).slice(0, 128),
          kind: String(block.kind || 'link').slice(0, 32),
          title: String(block.title || '').slice(0, 256),
          url: block.url ? String(block.url).slice(0, 2048) : null,
          thumbnailUrl: block.thumbnailUrl ? String(block.thumbnailUrl).slice(0, 2048) : null,
          userId: String(userId).slice(0, 128),
          updatedAt: nowIso,
        }),
        { merge: true }
      );
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
    await setDoc(
      doc(db, 'users', userId, 'contacts', contact.id),
      cleanFirestoreValue({
        ...contact,
        id: String(contact.id).slice(0, 128),
        userId: String(userId).slice(0, 128),
        createdAt: String(contact.createdAt || new Date().toISOString()).slice(0, 64),
      })
    );
  } catch (err) {
    console.warn('Firebase background contact sync notice:', err);
  }
}

export async function syncClickToFirebase(userId: string, blockId: string, count: number): Promise<void> {
  if (!userId || !blockId) return;
  try {
    await setDoc(
      doc(db, 'users', userId, 'clicks', blockId),
      cleanFirestoreValue({
        blockId: String(blockId).slice(0, 128),
        userId: String(userId).slice(0, 128),
        count: Math.max(0, Number.isFinite(count) ? count : 0),
        updatedAt: new Date().toISOString().slice(0, 64),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firebase background click sync notice:', err);
  }
}

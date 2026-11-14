import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

// Read firebase configuration
let firebaseConfig: any = null;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[FirebaseServer] Failed to read firebase-applet-config.json:', e);
}

const app = firebaseConfig
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : null;

export const serverDb = app && firebaseConfig?.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : null;

/**
 * Checks whether a username is claimed in Firebase
 */
export async function firebaseIsUsernameClaimed(
  username: string,
  requestingUserId?: string | null
): Promise<{ claimed: boolean; isOwn?: boolean; userId?: string }> {
  if (!serverDb || !username) return { claimed: false };
  const clean = username.toLowerCase().trim();

  // 1. Check atomic claims collection
  const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
  if (claimSnap.exists()) {
    const data = claimSnap.data() || {};
    if (data.status !== 'deleted') {
      const ownerId = data.userId || null;
      if (requestingUserId && ownerId && ownerId === requestingUserId) {
        return { claimed: true, isOwn: true, userId: ownerId };
      }
      return { claimed: true, isOwn: false, userId: ownerId };
    }
  }

  // 2. Check users collection doc keyed by username
  const userSnap = await getDoc(doc(serverDb, 'users', clean));
  if (userSnap.exists()) {
    const data = userSnap.data() || {};
    if (data.status !== 'deleted') {
      const ownerId = data.userId || null;
      if (requestingUserId && ownerId && ownerId === requestingUserId) {
        return { claimed: true, isOwn: true, userId: ownerId };
      }
      return { claimed: true, isOwn: false, userId: ownerId };
    }
  }

  // 3. Check users collection query where username matches
  const q = query(collection(serverDb, 'users'), where('username', '==', clean));
  const querySnap = await getDocs(q);
  for (const docItem of querySnap.docs) {
    const data = docItem.data() || {};
    if (data.status === 'deleted') continue;
    const ownerId = data.userId || docItem.id || null;
    if (requestingUserId && ownerId && ownerId === requestingUserId) {
      return { claimed: true, isOwn: true, userId: ownerId };
    }
    return { claimed: true, isOwn: false, userId: ownerId };
  }

  return { claimed: false };
}

/**
 * Retrieves a user profile from Firebase
 */
export async function firebaseGetProfile(username: string): Promise<any | null> {
  if (!serverDb || !username) return null;
  const clean = username.toLowerCase().trim();

  try {
    // 1. Direct doc lookup by username
    const userSnap = await getDoc(doc(serverDb, 'users', clean));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data?.status !== 'deleted') {
        return {
          ...data,
          username: data.username || clean,
        };
      }
    }

    // 2. Check claim to find userId
    const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData?.status !== 'deleted' && claimData.userId && claimData.userId !== clean) {
        const userIdSnap = await getDoc(doc(serverDb, 'users', claimData.userId));
        if (userIdSnap.exists()) {
          const udata = userIdSnap.data();
          const uUsername = typeof udata?.username === 'string' ? udata.username.toLowerCase().trim() : clean;
          if (udata?.status !== 'deleted' && uUsername === clean) {
            return {
              ...udata,
              username: udata.username || clean,
            };
          }
        }
      }
    }

    // 3. Query by username attribute
    const q = query(collection(serverDb, 'users'), where('username', '==', clean));
    const querySnap = await getDocs(q);
    for (const d of querySnap.docs) {
      const data = d.data();
      if (data?.status === 'deleted') continue;
      return {
        ...data,
        username: data.username || clean,
      };
    }
  } catch (err) {
    console.warn('[FirebaseServer] getProfile notice:', err);
  }

  return null;
}

/**
 * Retrieves a user profile by authenticated user ID or email from Firebase
 */
export async function firebaseGetProfileByUserId(
  userId: string,
  email?: string | null
): Promise<any | null> {
  if (!serverDb || (!userId && !email)) return null;

  try {
    // 1. Direct doc lookup by userId
    if (userId) {
      const userSnap = await getDoc(doc(serverDb, 'users', userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.username && data.status !== 'deleted') {
          return {
            ...data,
            username: data.username,
          };
        }
      }

      // 2. Query users collection where userId == userId
      const qUser = query(collection(serverDb, 'users'), where('userId', '==', userId));
      const qSnap = await getDocs(qUser);
      for (const d of qSnap.docs) {
        const data = d.data();
        if (data.username && data.status !== 'deleted') {
          return {
            ...data,
            username: data.username,
          };
        }
      }

      // 3. Query claims collection where userId == userId
      const qClaims = query(collection(serverDb, 'claims'), where('userId', '==', userId));
      const claimsSnap = await getDocs(qClaims);
      if (!claimsSnap.empty) {
        const claimData = claimsSnap.docs[0].data();
        const username = claimData.username || claimsSnap.docs[0].id;
        if (username && claimData.status !== 'deleted') {
          const profile = await firebaseGetProfile(username);
          if (profile) return profile;
          return {
            username,
            userId,
            displayName: username,
          };
        }
      }
    }

    // 4. Query by primaryEmail if provided
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const qEmail = query(collection(serverDb, 'users'), where('primaryEmail', '==', cleanEmail));
      const emailSnap = await getDocs(qEmail);
      for (const d of emailSnap.docs) {
        const data = d.data();
        if (data.username && data.status !== 'deleted') {
          return {
            ...data,
            username: data.username,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[FirebaseServer] getProfileByUserId notice:', err);
  }

  return null;
}

/**
 * Retrieves user blocks from Firebase
 */
export async function firebaseGetBlocks(username: string): Promise<any[]> {
  if (!serverDb || !username) return [];
  const clean = username.toLowerCase().trim();

  try {
    // 1. Try blocks subcollection under username
    let blocksSnap = await getDocs(collection(serverDb, 'users', clean, 'blocks'));
    if (!blocksSnap.empty) {
      return blocksSnap.docs
        .map((d) => d.data())
        .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
    }

    // 2. Try under claim userId
    const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData.userId && claimData.userId !== clean) {
        blocksSnap = await getDocs(collection(serverDb, 'users', claimData.userId, 'blocks'));
        if (!blocksSnap.empty) {
          return blocksSnap.docs
            .map((d) => d.data())
            .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
        }
      }
    }
  } catch (err) {
    console.warn('[FirebaseServer] getBlocks notice:', err);
  }

  return [];
}

/**
 * Background async save of profile to Firebase
 */
export async function firebaseSaveProfile(
  username: string,
  profileData: Record<string, any>,
  userId?: string
): Promise<void> {
  if (!serverDb || !username) return;
  const clean = username.toLowerCase().trim();
  const effectiveUserId = userId || profileData.userId || 'owner';

  const cleanProfile = {
    userId: effectiveUserId,
    username: clean,
    displayName: profileData.displayName || clean,
    bio: profileData.bio || '',
    avatarUrl: profileData.avatarUrl || null,
    avatarType: profileData.avatarType || (profileData.avatarId ? 'default' : (profileData.avatarUrl ? 'uploaded' : 'default')),
    avatarId: profileData.avatarId || null,
    vibeId: profileData.vibeId || 'clean',
    buttonShape: profileData.buttonShape !== undefined ? profileData.buttonShape : null,
    socials: profileData.socials || {},
    socialsPosition: profileData.socialsPosition || 'top',
    primaryEmail: profileData.primaryEmail || null,
    plan: profileData.plan || 'free',
    status: profileData.status || (profileData.isPublished === false ? 'unpublished' : 'active'),
    isPublished: profileData.isPublished !== false,
    hideFooter: Boolean(profileData.hideFooter),
    hideFromSearch: Boolean(profileData.hideFromSearch),
    background: profileData.background ?? null,
    googleAnalyticsId: profileData.googleAnalyticsId ?? null,
    metaPixelId: profileData.metaPixelId ?? null,
    whatsappNumber: profileData.whatsappNumber ?? null,
    customSeoTitle: profileData.customSeoTitle ?? null,
    customSeoDescription: profileData.customSeoDescription ?? null,
    fontSettings: profileData.fontSettings ?? null,
    buttonColors: profileData.buttonColors ?? null,
    businessCard: profileData.businessCard ?? null,
    layoutSettings: profileData.layoutSettings ?? null,
    updatedAt: new Date().toISOString(),
  };

  try {
    // Save to users collection and overwrite nested socials map so deleted icons stay deleted
    const userRef = doc(serverDb, 'users', clean);
    await setDoc(userRef, cleanProfile, { merge: true });
    await updateDoc(userRef, { socials: cleanProfile.socials }).catch(() => {});

    // Also save claim registry record
    await setDoc(doc(serverDb, 'claims', clean), {
      username: clean,
      userId: effectiveUserId,
      claimedAt: cleanProfile.updatedAt,
    }, { merge: true });

    // If userId differs from username, mirror to users/{userId}
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      const mirrorRef = doc(serverDb, 'users', effectiveUserId);
      await setDoc(mirrorRef, cleanProfile, { merge: true });
      await updateDoc(mirrorRef, { socials: cleanProfile.socials }).catch(() => {});
    }
  } catch (err) {
    console.warn('[FirebaseServer] Background saveProfile notice:', err);
  }
}

/**
 * Background async save of blocks to Firebase (removes deleted block docs)
 */
export async function firebaseSaveBlocks(
  username: string,
  blocks: any[],
  userId?: string
): Promise<void> {
  if (!serverDb || !username || !Array.isArray(blocks)) return;
  const clean = username.toLowerCase().trim();
  const effectiveUserId = userId || 'owner';

  try {
    const batch = writeBatch(serverDb);
    const keepIds = new Set<string>();

    blocks.forEach((b, index) => {
      const blockId = b.id || `b_${Date.now()}_${index}`;
      keepIds.add(blockId);
      const cleanBlock = {
        id: blockId,
        userId: effectiveUserId,
        username: clean,
        kind: b.kind || 'link',
        title: b.title || '',
        url: b.url || null,
        icon: b.icon || null,
        thumbnailPath: b.thumbnailPath || null,
        thumbnailUrl: b.thumbnailUrl || null,
        layout: b.layout || 'classic',
        embedProvider: b.embedProvider || null,
        isProtected: Boolean(b.isProtected),
        signup: b.signup || null,
        tipJar: b.tipJar || null,
        coffee: b.coffee || null,
        faq: b.faq || null,
        vcard: b.vcard || null,
        animation: b.animation || null,
        badge: b.badge || null,
        youtube: b.youtube || null,
        product: b.product || null,
        booking: b.booking || null,
        countdown: b.countdown || null,
        promo: b.promo || null,
        location: b.location || null,
        download: b.download || null,
        startAt: b.startAt || null,
        endAt: b.endAt || null,
        position: b.position ?? index,
        order: b.position ?? index,
        isActive: b.isActive ?? true,
        isArchived: Boolean(b.isArchived),
        updatedAt: new Date().toISOString(),
      };

      const ref = doc(serverDb, 'users', clean, 'blocks', blockId);
      batch.set(ref, cleanBlock, { merge: true });

      if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
        const userRef = doc(serverDb, 'users', effectiveUserId, 'blocks', blockId);
        batch.set(userRef, cleanBlock, { merge: true });
      }
    });

    // Delete any existing Firestore block documents absent from current blocks array
    const existingCleanSnap = await getDocs(collection(serverDb, 'users', clean, 'blocks'));
    existingCleanSnap.docs.forEach((docSnap) => {
      if (!keepIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      const existingUserSnap = await getDocs(collection(serverDb, 'users', effectiveUserId, 'blocks'));
      existingUserSnap.docs.forEach((docSnap) => {
        if (!keepIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
        }
      });
    }

    await batch.commit();
  } catch (err) {
    console.warn('[FirebaseServer] Background saveBlocks notice:', err);
  }
}

/**
 * Background async save of subscriber contact to Firebase
 */
export async function firebaseSaveContact(
  username: string,
  contact: { id: string; email?: string | null; phone?: string | null; consentText?: string | null; source?: string | null; formTitle?: string | null }
): Promise<void> {
  if (!serverDb || !username || !contact?.id) return;
  const clean = username.toLowerCase().trim();

  try {
    await setDoc(doc(serverDb, 'users', clean, 'contacts', contact.id), {
      ...contact,
      username: clean,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[FirebaseServer] Background saveContact notice:', err);
  }
}

export async function firebaseGetContacts(username: string): Promise<any[]> {
  if (!serverDb || !username) return [];
  const clean = username.toLowerCase().trim();

  try {
    const snap = await getDocs(collection(serverDb, 'users', clean, 'contacts'));
    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch {
    return [];
  }
}

export async function firebaseDeleteContact(username: string, contactId: string): Promise<void> {
  if (!serverDb || !username || !contactId) return;
  const clean = username.toLowerCase().trim();
  try {
    await deleteDoc(doc(serverDb, 'users', clean, 'contacts', contactId));
  } catch {}
}

export async function firebaseDeleteAllContacts(username: string): Promise<void> {
  if (!serverDb || !username) return;
  const clean = username.toLowerCase().trim();
  try {
    const snap = await getDocs(collection(serverDb, 'users', clean, 'contacts'));
    if (snap.empty) return;
    const batch = writeBatch(serverDb);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch {}
}

export async function firebaseMigrateUsernameData(
  oldUsername: string,
  newUsername: string,
  userId?: string
): Promise<void> {
  if (!serverDb || !oldUsername || !newUsername) return;
  const cleanOld = oldUsername.toLowerCase().trim();
  const cleanNew = newUsername.toLowerCase().trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

  try {
    const [oldBlocksSnap, oldContactsSnap, oldClicksSnap] = await Promise.all([
      getDocs(collection(serverDb, 'users', cleanOld, 'blocks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'contacts')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'clicks')).catch(() => null),
    ]);

    const batch = writeBatch(serverDb);
    let hasWrites = false;

    if (oldBlocksSnap && !oldBlocksSnap.empty) {
      oldBlocksSnap.docs.forEach((d) => {
        hasWrites = true;
        const data = d.data() || {};
        batch.set(
          doc(serverDb!, 'users', cleanNew, 'blocks', d.id),
          { ...data, username: cleanNew, userId: userId || data.userId || 'owner' },
          { merge: true }
        );
      });
    }

    if (oldContactsSnap && !oldContactsSnap.empty) {
      oldContactsSnap.docs.forEach((d) => {
        hasWrites = true;
        const data = d.data() || {};
        batch.set(
          doc(serverDb!, 'users', cleanNew, 'contacts', d.id),
          { ...data, username: cleanNew },
          { merge: true }
        );
      });
    }

    if (oldClicksSnap && !oldClicksSnap.empty) {
      oldClicksSnap.docs.forEach((d) => {
        hasWrites = true;
        const data = d.data() || {};
        batch.set(
          doc(serverDb!, 'users', cleanNew, 'clicks', d.id),
          { ...data, username: cleanNew },
          { merge: true }
        );
      });
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('[FirebaseServer] migrateUsernameData notice:', err);
  }
}

/**
 * Background async recording of link click to Firebase
 */
export async function firebaseRecordClick(
  username: string,
  blockId: string
): Promise<void> {
  if (!serverDb || !username || !blockId) return;
  const clean = username.toLowerCase().trim();

  try {
    const clickRef = doc(serverDb, 'users', clean, 'clicks', blockId);
    const snap = await getDoc(clickRef);
    const currentCount = snap.exists() ? (snap.data().count || 0) : 0;
    await setDoc(clickRef, {
      blockId,
      username: clean,
      count: currentCount + 1,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('[FirebaseServer] Background recordClick notice:', err);
  }
}

/**
 * Releases an old username cleanly across Firebase collections when a user renames or deletes their handle.
 */
export async function firebaseReleaseUsername(
  oldUsername: string,
  userId?: string
): Promise<void> {
  if (!serverDb || !oldUsername) return;
  const cleanOld = oldUsername.toLowerCase().trim();
  if (!cleanOld) return;
  const nowIso = new Date().toISOString();

  try {
    // 1. Tombstone + attempt delete of old claim doc if unclaimed or owned by this user
    const claimRef = doc(serverDb, 'claims', cleanOld);
    const claimSnap = await getDoc(claimRef).catch(() => null);
    if (claimSnap && claimSnap.exists()) {
      const ownerId = claimSnap.data()?.userId;
      if (!userId || !ownerId || ownerId === userId || ownerId === 'owner') {
        await setDoc(claimRef, {
          username: cleanOld,
          userId: null,
          status: 'deleted',
          releasedAt: nowIso,
        }).catch(() => {});
        await deleteDoc(claimRef).catch(() => {});
      }
    }

    // 2. Delete old blocks, contacts & clicks subcollections under users/{cleanOld}/...
    const [oldBlocksSnap, oldContactsSnap, oldClicksSnap] = await Promise.all([
      getDocs(collection(serverDb, 'users', cleanOld, 'blocks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'contacts')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'clicks')).catch(() => null),
    ]);
    if ((oldBlocksSnap && !oldBlocksSnap.empty) || (oldContactsSnap && !oldContactsSnap.empty) || (oldClicksSnap && !oldClicksSnap.empty)) {
      const batch = writeBatch(serverDb);
      oldBlocksSnap?.docs.forEach((d) => batch.delete(d.ref));
      oldContactsSnap?.docs.forEach((d) => batch.delete(d.ref));
      oldClicksSnap?.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit().catch(() => {});
    }

    // 3. Tombstone + attempt delete of old user doc keyed by oldUsername
    const oldUserRef = doc(serverDb, 'users', cleanOld);
    const oldUserSnap = await getDoc(oldUserRef).catch(() => null);
    if (oldUserSnap && oldUserSnap.exists()) {
      const ownerId = oldUserSnap.data()?.userId;
      if (!userId || !ownerId || ownerId === userId || ownerId === 'owner') {
        await setDoc(oldUserRef, {
          username: cleanOld,
          userId: null,
          status: 'deleted',
          isPublished: false,
          updatedAt: nowIso,
        }).catch(() => {});
        await deleteDoc(oldUserRef).catch(() => {});
      }
    }

    // 4. Tombstone + attempt delete of any mirrored user docs still holding username == cleanOld
    const qOld = query(collection(serverDb, 'users'), where('username', '==', cleanOld));
    const qOldSnap = await getDocs(qOld).catch(() => null);
    if (qOldSnap && !qOldSnap.empty) {
      for (const d of qOldSnap.docs) {
        const ownerId = d.data()?.userId;
        if (!userId || !ownerId || ownerId === userId || ownerId === 'owner') {
          await setDoc(d.ref, {
            username: cleanOld,
            userId: null,
            status: 'deleted',
            isPublished: false,
            updatedAt: nowIso,
          }).catch(() => {});
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[FirebaseServer] releaseUsername notice:', err);
  }
}

/**
 * Lists all user profiles stored in Firebase Firestore (for SEO sitemap & audit).
 */
export async function firebaseGetAllProfiles(): Promise<any[]> {
  if (!serverDb) return [];
  try {
    const snap = await getDocs(collection(serverDb, 'users'));
    const byUsername = new Map<string, any>();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const uname = typeof data.username === 'string' ? data.username.toLowerCase().trim() : '';
      if (!uname) return;
      const existing = byUsername.get(uname);
      if (!existing || ((data.updatedAt || '') > (existing.updatedAt || ''))) {
        byUsername.set(uname, {
          ...data,
          username: uname,
        });
      }
    });
    return Array.from(byUsername.values());
  } catch {
    return [];
  }
}


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

export const serverDb =
  app &&
  firebaseConfig?.firestoreDatabaseId &&
  process.env.IVEO_DISABLE_REMOTE_DB !== '1'
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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;

  try {
    // 1. Direct doc lookup by username
    const userSnap = await getDoc(doc(serverDb, 'users', clean));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data?.status !== 'deleted') {
        return {
          ...data,
          username: String(data.username || clean).replace(/^@+/, '').toLowerCase().trim() || clean,
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
          const uUsername =
            typeof udata?.username === 'string'
              ? udata.username.replace(/^@+/, '').toLowerCase().trim()
              : '';
          if (udata?.status !== 'deleted' && (!uUsername || uUsername === clean)) {
            return {
              ...udata,
              username: clean,
            };
          }
        }
      }
    }

    // 3. Query by username attribute (including legacy @-prefixed docs)
    for (const candidate of [clean, `@${clean}`]) {
      const q = query(collection(serverDb, 'users'), where('username', '==', candidate));
      const querySnap = await getDocs(q);
      for (const d of querySnap.docs) {
        const data = d.data();
        if (data?.status === 'deleted') continue;
        return {
          ...data,
          username: clean,
        };
      }
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
export async function firebaseGetBlocks(username: string, ownerUserId?: string | null): Promise<any[]> {
  if (!serverDb || !username) return [];
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

  try {
    // 1. Try blocks subcollection under username
    let blocksSnap = await getDocs(collection(serverDb, 'users', clean, 'blocks'));
    if (!blocksSnap.empty) {
      return blocksSnap.docs
        .map((d) => d.data())
        .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
    }

    // Respect intentional empty state when user has initialized/emptied their blocks
    const cleanUserSnap = await getDoc(doc(serverDb, 'users', clean)).catch(() => null);
    if (cleanUserSnap && cleanUserSnap.exists() && cleanUserSnap.data()?.blocksInitialized === true) {
      return [];
    }

    // 2. Try under claim userId or explicit ownerUserId
    const candidateUserIds = new Set<string>();
    if (ownerUserId && ownerUserId !== clean && ownerUserId !== 'owner') {
      candidateUserIds.add(ownerUserId);
    }

    const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData.userId && claimData.userId !== clean && claimData.userId !== 'owner') {
        candidateUserIds.add(claimData.userId);
      }
    }

    for (const uid of candidateUserIds) {
      blocksSnap = await getDocs(collection(serverDb, 'users', uid, 'blocks'));
      if (!blocksSnap.empty) {
        return blocksSnap.docs
          .map((d) => d.data())
          .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const userRef = doc(serverDb, 'users', clean);

  try {
    let existingData: Record<string, any> = {};
    const hasCoreFields =
      profileData.displayName !== undefined &&
      profileData.bio !== undefined &&
      profileData.socials !== undefined &&
      profileData.vibeId !== undefined &&
      profileData.plan !== undefined;

    if (!hasCoreFields) {
      const existingSnap = await getDoc(userRef).catch(() => null);
      if (existingSnap && existingSnap.exists()) {
        existingData = existingSnap.data() || {};
      }
    }

    const effectiveUserId =
      userId ||
      profileData.userId ||
      (existingData.userId && existingData.userId !== 'owner' ? existingData.userId : 'owner');

    const resolvedStatus =
      profileData.status !== undefined
        ? profileData.status
        : profileData.isPublished === false
          ? 'unpublished'
          : profileData.isPublished === true
            ? 'active'
            : existingData.status || (existingData.isPublished === false ? 'unpublished' : 'active');

    const cleanProfile: Record<string, any> = {
      userId: effectiveUserId,
      username: clean,
      displayName:
        profileData.displayName !== undefined
          ? profileData.displayName || clean
          : existingData.displayName || clean,
      bio: profileData.bio !== undefined ? profileData.bio || '' : existingData.bio ?? '',
      avatarUrl:
        profileData.avatarUrl !== undefined
          ? profileData.avatarUrl || null
          : existingData.avatarUrl ?? null,
      avatarType:
        profileData.avatarType !== undefined
          ? profileData.avatarType
          : existingData.avatarType ||
            (profileData.avatarId ?? existingData.avatarId
              ? 'default'
              : (profileData.avatarUrl ?? existingData.avatarUrl)
                ? 'uploaded'
                : 'default'),
      avatarId:
        profileData.avatarId !== undefined ? profileData.avatarId || null : existingData.avatarId ?? null,
      vibeId:
        profileData.vibeId !== undefined ? profileData.vibeId || 'clean' : existingData.vibeId || 'clean',
      buttonShape:
        profileData.buttonShape !== undefined
          ? profileData.buttonShape
          : existingData.buttonShape !== undefined
            ? existingData.buttonShape
            : null,
      socials:
        profileData.socials !== undefined
          ? profileData.socials || {}
          : existingData.socials || {},
      socialsPosition:
        profileData.socialsPosition !== undefined
          ? profileData.socialsPosition || 'top'
          : existingData.socialsPosition || 'top',
      primaryEmail:
        profileData.primaryEmail !== undefined
          ? profileData.primaryEmail || null
          : existingData.primaryEmail ?? null,
      plan:
        profileData.plan !== undefined
          ? profileData.plan || 'free'
          : existingData.plan || 'free',
      createdAt:
        profileData.createdAt !== undefined
          ? profileData.createdAt || null
          : existingData.createdAt ?? null,
      subscription:
        profileData.subscription !== undefined
          ? profileData.subscription ?? null
          : existingData.subscription ?? null,
      status: resolvedStatus,
      isPublished:
        profileData.isPublished !== undefined
          ? profileData.isPublished !== false
          : resolvedStatus === 'active',
      hideFooter:
        profileData.hideFooter !== undefined
          ? Boolean(profileData.hideFooter)
          : Boolean(existingData.hideFooter),
      hideFromSearch:
        profileData.hideFromSearch !== undefined
          ? Boolean(profileData.hideFromSearch)
          : Boolean(existingData.hideFromSearch),
      background:
        profileData.background !== undefined
          ? profileData.background ?? null
          : existingData.background ?? null,
      googleAnalyticsId:
        profileData.googleAnalyticsId !== undefined
          ? profileData.googleAnalyticsId ?? null
          : existingData.googleAnalyticsId ?? null,
      metaPixelId:
        profileData.metaPixelId !== undefined
          ? profileData.metaPixelId ?? null
          : existingData.metaPixelId ?? null,
      whatsappNumber:
        profileData.whatsappNumber !== undefined
          ? profileData.whatsappNumber ?? null
          : existingData.whatsappNumber ?? null,
      customSeoTitle:
        profileData.customSeoTitle !== undefined
          ? profileData.customSeoTitle ?? null
          : existingData.customSeoTitle ?? null,
      customSeoDescription:
        profileData.customSeoDescription !== undefined
          ? profileData.customSeoDescription ?? null
          : existingData.customSeoDescription ?? null,
      fontSettings:
        profileData.fontSettings !== undefined
          ? profileData.fontSettings ?? null
          : existingData.fontSettings ?? null,
      buttonColors:
        profileData.buttonColors !== undefined
          ? profileData.buttonColors ?? null
          : existingData.buttonColors ?? null,
      businessCard:
        profileData.businessCard !== undefined
          ? profileData.businessCard ?? null
          : existingData.businessCard ?? null,
      layoutSettings:
        profileData.layoutSettings !== undefined
          ? profileData.layoutSettings ?? null
          : existingData.layoutSettings ?? null,
      appearance:
        profileData.appearance !== undefined
          ? profileData.appearance ?? null
          : existingData.appearance ?? null,
      ...(profileData.blocksInitialized !== undefined || existingData.blocksInitialized !== undefined
        ? { blocksInitialized: Boolean(profileData.blocksInitialized ?? existingData.blocksInitialized) }
        : {}),
      updatedAt: profileData.updatedAt || new Date().toISOString(),
    };

    if (typeof profileData.avatarData === 'string' && profileData.avatarData.length <= 350000) {
      cleanProfile.avatarData = profileData.avatarData;
    } else if (
      profileData.avatarData === null ||
      (profileData.avatarUrl !== undefined &&
        (!profileData.avatarUrl ||
          (!String(profileData.avatarUrl).startsWith('/api/avatar/') &&
            !String(profileData.avatarUrl).startsWith('data:image/'))))
    ) {
      cleanProfile.avatarData = null;
    } else if (existingData.avatarData !== undefined) {
      cleanProfile.avatarData = existingData.avatarData;
    }

    const nestedOverwritePayload: Record<string, any> = {
      updatedAt: cleanProfile.updatedAt,
    };
    if (profileData.socials !== undefined) nestedOverwritePayload.socials = cleanProfile.socials;
    if (profileData.background !== undefined) nestedOverwritePayload.background = cleanProfile.background;
    if (profileData.fontSettings !== undefined) nestedOverwritePayload.fontSettings = cleanProfile.fontSettings;
    if (profileData.buttonColors !== undefined) nestedOverwritePayload.buttonColors = cleanProfile.buttonColors;
    if (profileData.businessCard !== undefined) nestedOverwritePayload.businessCard = cleanProfile.businessCard;
    if (profileData.layoutSettings !== undefined) nestedOverwritePayload.layoutSettings = cleanProfile.layoutSettings;
    if (profileData.appearance !== undefined) nestedOverwritePayload.appearance = cleanProfile.appearance;

    // Save to users collection and explicitly overwrite nested maps so removed keys never linger
    await setDoc(userRef, cleanProfile, { merge: true });
    if (Object.keys(nestedOverwritePayload).length > 1) {
      await updateDoc(userRef, nestedOverwritePayload).catch(() => {});
    }

    // Also save claim registry record
    await setDoc(
      doc(serverDb, 'claims', clean),
      {
        username: clean,
        userId: effectiveUserId,
        claimedAt: cleanProfile.updatedAt,
      },
      { merge: true }
    );

    // Remove any stale redirect from this newly claimed handle
    await deleteDoc(doc(serverDb, 'redirects', clean)).catch(() => {});

    // If userId differs from username, mirror to users/{userId}
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      const mirrorRef = doc(serverDb, 'users', effectiveUserId);
      await setDoc(mirrorRef, cleanProfile, { merge: true });
      if (Object.keys(nestedOverwritePayload).length > 1) {
        await updateDoc(mirrorRef, nestedOverwritePayload).catch(() => {});
      }
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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
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
        embedMeta: b.embedMeta || null,
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
        bluesky: b.bluesky || null,
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

    const blocksInitTs = new Date().toISOString();
    batch.set(
      doc(serverDb, 'users', clean),
      { blocksInitialized: true, updatedAt: blocksInitTs },
      { merge: true }
    );
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      batch.set(
        doc(serverDb, 'users', effectiveUserId),
        { blocksInitialized: true, updatedAt: blocksInitTs },
        { merge: true }
      );
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
  const cleanOld = oldUsername.replace(/^@+/, '').toLowerCase().trim();
  const cleanNew = newUsername.replace(/^@+/, '').toLowerCase().trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

  try {
    const [oldBlocksSnap, oldContactsSnap, oldClicksSnap, oldAnalyticsSnap] = await Promise.all([
      getDocs(collection(serverDb, 'users', cleanOld, 'blocks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'contacts')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'clicks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'analytics')).catch(() => null),
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

    if (oldAnalyticsSnap && !oldAnalyticsSnap.empty) {
      oldAnalyticsSnap.docs.forEach((d) => {
        hasWrites = true;
        const data = d.data() || {};
        batch.set(
          doc(serverDb!, 'users', cleanNew, 'analytics', d.id),
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
 * Persists a rename redirect in Firestore so old /@handle links route cleanly across restarts.
 */
export async function firebaseSaveRedirect(
  oldUsername: string,
  newUsername: string
): Promise<void> {
  if (!serverDb || !oldUsername || !newUsername) return;
  const cleanOld = oldUsername.replace(/^@+/, '').toLowerCase().trim();
  const cleanNew = newUsername.replace(/^@+/, '').toLowerCase().trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;
  try {
    await setDoc(doc(serverDb, 'redirects', cleanOld), {
      from: cleanOld,
      to: cleanNew,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('[FirebaseServer] saveRedirect notice:', err);
  }
}

export async function firebaseGetRedirectTarget(username: string): Promise<string | null> {
  if (!serverDb || !username) return null;
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;
  try {
    const snap = await getDoc(doc(serverDb, 'redirects', clean));
    if (snap.exists()) {
      const target = String(snap.data()?.to || '').replace(/^@+/, '').toLowerCase().trim();
      if (target && target !== clean) {
        return target;
      }
    }
  } catch {}
  return null;
}

/**
 * Persists raw page_view / link_click analytics event in Firestore for durable cross-device analytics.
 */
export async function firebaseRecordAnalyticsEvent(event: {
  id: string;
  username: string;
  eventType: 'page_view' | 'link_click';
  blockId?: string | null;
  country?: string | null;
  referrer?: string | null;
  device?: string | null;
  createdAt?: string;
}): Promise<void> {
  if (!serverDb || !event?.username || !event?.id) return;
  const clean = event.username.replace(/^@+/, '').toLowerCase().trim();
  const safeId = event.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!clean || !safeId) return;

  try {
    await setDoc(doc(serverDb, 'users', clean, 'analytics', safeId), {
      id: safeId,
      username: clean,
      eventType: event.eventType,
      blockId: event.blockId || null,
      country: event.country || 'Unknown',
      referrer: event.referrer || 'direct',
      device: event.device || 'desktop',
      createdAt: event.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[FirebaseServer] Background recordAnalyticsEvent notice:', err);
  }
}

export async function firebaseGetAnalyticsEvents(
  username: string,
  fromDate: Date,
  toDate: Date
): Promise<any[]> {
  if (!serverDb || !username) return [];
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return [];

  try {
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime();
    const snap = await getDocs(collection(serverDb, 'users', clean, 'analytics'));
    return snap.docs
      .map((d) => d.data())
      .filter((ev: any) => {
        const ts = new Date(ev.createdAt || '').getTime();
        return !Number.isNaN(ts) && ts >= fromMs && ts <= toMs;
      });
  } catch (err) {
    console.warn('[FirebaseServer] getAnalyticsEvents notice:', err);
    return [];
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
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

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
  const cleanOld = oldUsername.replace(/^@+/, '').toLowerCase().trim();
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

    // 2. Delete old blocks, contacts, clicks & analytics subcollections under users/{cleanOld}/...
    const [oldBlocksSnap, oldContactsSnap, oldClicksSnap, oldAnalyticsSnap] = await Promise.all([
      getDocs(collection(serverDb, 'users', cleanOld, 'blocks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'contacts')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'clicks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'analytics')).catch(() => null),
    ]);
    if (
      (oldBlocksSnap && !oldBlocksSnap.empty) ||
      (oldContactsSnap && !oldContactsSnap.empty) ||
      (oldClicksSnap && !oldClicksSnap.empty) ||
      (oldAnalyticsSnap && !oldAnalyticsSnap.empty)
    ) {
      const batch = writeBatch(serverDb);
      oldBlocksSnap?.docs.forEach((d) => batch.delete(d.ref));
      oldContactsSnap?.docs.forEach((d) => batch.delete(d.ref));
      oldClicksSnap?.docs.forEach((d) => batch.delete(d.ref));
      oldAnalyticsSnap?.docs.forEach((d) => batch.delete(d.ref));
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

export async function firebaseGetAppearanceState(username: string): Promise<{
  appearance?: any;
  history?: any;
  themes?: any[];
} | null> {
  if (!serverDb || !username) return null;
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  try {
    const snap = await getDoc(doc(serverDb, 'users', clean, 'appearance', 'v2'));
    if (snap.exists()) {
      return snap.data() as any;
    }
  } catch {}
  return null;
}

export async function firebaseSaveAppearanceState(
  username: string,
  state: { appearance?: any; history?: any; themes?: any[] },
  userId?: string
): Promise<void> {
  if (!serverDb || !username) return;
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  const payload = {
    username: clean,
    userId: userId || 'owner',
    appearance: state.appearance ?? null,
    history: state.history ?? { undoStack: [], redoStack: [] },
    themes: Array.isArray(state.themes) ? state.themes : [],
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(serverDb, 'users', clean, 'appearance', 'v2'), payload);
    if (userId && userId !== clean && userId !== 'owner') {
      await setDoc(doc(serverDb, 'users', userId, 'appearance', 'v2'), payload).catch(() => {});
    }
  } catch {}
}



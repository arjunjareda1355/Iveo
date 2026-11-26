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
import { isDeletedPurgeExpired, isNewerTimestamp } from './profileMerge.ts';
import {
  clampNullableString,
  clampRequiredString,
  enforceAnalyticsRuleBounds,
  enforceAppearanceRuleBounds,
  enforceBlockRuleBounds,
  enforceContactRuleBounds,
  enforceProfileRuleBounds,
  sanitizeForFirestore,
} from './firebaseSanitize.ts';

export class FirebasePersistError extends Error {
  code = 'firebase_sync_failed';
  operation: string;
  causeErr?: unknown;

  constructor(operation: string, causeErr?: unknown) {
    const detail = causeErr instanceof Error ? causeErr.message : String(causeErr || 'Unknown Firestore error');
    super(`Firestore ${operation} failed: ${detail}`);
    this.name = 'FirebasePersistError';
    this.operation = operation;
    this.causeErr = causeErr;
  }
}

type WriteHook = ((operation: string) => void | Promise<void>) | null;
let writeHookForTests: WriteHook = null;

export function setFirebaseWriteHookForTests(hook: WriteHook): void {
  writeHookForTests = hook;
}

async function runWriteHook(operation: string): Promise<void> {
  if (writeHookForTests) {
    await writeHookForTests(operation);
  }
}

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
): Promise<{ claimed: boolean; isOwn?: boolean; userId?: string; status?: string }> {
  if (!serverDb || !username) return { claimed: false };
  const clean = username.replace(/^@+/, '').toLowerCase().trim();

  const evaluateClaimDoc = (data: Record<string, any>, fallbackOwnerId?: string | null) => {
    if (!data || data.status === 'deleted') return null;
    const ownerId = data.userId || fallbackOwnerId || null;
    if (data.status === 'deleted_pending' && isDeletedPurgeExpired(data)) {
      firebasePurgeAccountPermanently(clean, ownerId || undefined).catch(() => {});
      return null;
    }
    if (requestingUserId && ownerId && ownerId === requestingUserId) {
      return { claimed: true, isOwn: true, userId: ownerId, status: data.status || 'active' };
    }
    return { claimed: true, isOwn: false, userId: ownerId, status: data.status || 'active' };
  };

  // 1. Check atomic claims collection
  const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
  if (claimSnap.exists()) {
    const res = evaluateClaimDoc(claimSnap.data() || {});
    if (res) return res;
  }

  // 2. Check users collection doc keyed by username
  const userSnap = await getDoc(doc(serverDb, 'users', clean));
  if (userSnap.exists()) {
    const res = evaluateClaimDoc(userSnap.data() || {});
    if (res) return res;
  }

  // 3. Check users collection query where username matches
  const q = query(collection(serverDb, 'users'), where('username', '==', clean));
  const querySnap = await getDocs(q);
  for (const docItem of querySnap.docs) {
    const res = evaluateClaimDoc(docItem.data() || {}, docItem.id);
    if (res) return res;
  }

  return { claimed: false };
}

/**
 * Retrieves a user profile from Firebase
 */
export async function firebaseGetProfile(
  username: string,
  opts?: { includePendingDelete?: boolean }
): Promise<any | null> {
  if (!serverDb || !username) return null;
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;
  const includePendingDelete = Boolean(opts?.includePendingDelete);

  const acceptProfile = (data: Record<string, any> | undefined, resolvedUname: string) => {
    if (!data || data.status === 'deleted') return null;
    if (data.status === 'deleted_pending') {
      if (isDeletedPurgeExpired(data)) {
        firebasePurgeAccountPermanently(resolvedUname, data.userId).catch(() => {});
        return null;
      }
      if (!includePendingDelete) return null;
    }
    return {
      ...data,
      username: resolvedUname,
    };
  };

  try {
    // 1. Direct doc lookup by username
    const userSnap = await getDoc(doc(serverDb, 'users', clean));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const resolvedUname =
        String(data?.username || clean).replace(/^@+/, '').toLowerCase().trim() || clean;
      const accepted = acceptProfile(data, resolvedUname);
      if (accepted) return accepted;
      if (data?.status === 'deleted_pending' && !includePendingDelete) return null;
    }

    // 2. Check claim to find userId
    const claimSnap = await getDoc(doc(serverDb, 'claims', clean));
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData?.status === 'deleted_pending') {
        if (isDeletedPurgeExpired(claimData)) {
          firebasePurgeAccountPermanently(clean, claimData.userId).catch(() => {});
          return null;
        }
        if (!includePendingDelete) return null;
      }
      if (claimData?.status !== 'deleted' && claimData.userId && claimData.userId !== clean) {
        const userIdSnap = await getDoc(doc(serverDb, 'users', claimData.userId));
        if (userIdSnap.exists()) {
          const udata = userIdSnap.data();
          const uUsername =
            typeof udata?.username === 'string'
              ? udata.username.replace(/^@+/, '').toLowerCase().trim()
              : '';
          if (!uUsername || uUsername === clean) {
            const accepted = acceptProfile(udata, clean);
            if (accepted) return accepted;
          }
        }
      }
    }

    // 3. Query by username attribute (including legacy @-prefixed docs)
    for (const candidate of [clean, `@${clean}`]) {
      const q = query(collection(serverDb, 'users'), where('username', '==', candidate));
      const querySnap = await getDocs(q);
      for (const d of querySnap.docs) {
        const accepted = acceptProfile(d.data(), clean);
        if (accepted) return accepted;
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
  email?: string | null,
  opts?: { includePendingDelete?: boolean }
): Promise<any | null> {
  if (!serverDb || (!userId && !email)) return null;
  const includePendingDelete = opts?.includePendingDelete !== false;

  const acceptUserDoc = (data: Record<string, any> | undefined): any | null => {
    if (!data || !data.username || data.status === 'deleted') return null;
    const uname = String(data.username).replace(/^@+/, '').toLowerCase().trim();
    if (!uname) return null;
    if (data.status === 'deleted_pending') {
      if (isDeletedPurgeExpired(data)) {
        firebasePurgeAccountPermanently(uname, data.userId).catch(() => {});
        return null;
      }
      if (!includePendingDelete) return null;
    }
    return {
      ...data,
      username: uname,
    };
  };

  try {
    // 1. Direct doc lookup by userId
    if (userId) {
      const userSnap = await getDoc(doc(serverDb, 'users', userId));
      if (userSnap.exists()) {
        const accepted = acceptUserDoc(userSnap.data());
        if (accepted) return accepted;
      }

      // 2. Query users collection where userId == userId
      const qUser = query(collection(serverDb, 'users'), where('userId', '==', userId));
      const qSnap = await getDocs(qUser);
      for (const d of qSnap.docs) {
        const accepted = acceptUserDoc(d.data());
        if (accepted) return accepted;
      }

      // 3. Query claims collection where userId == userId
      const qClaims = query(collection(serverDb, 'claims'), where('userId', '==', userId));
      const claimsSnap = await getDocs(qClaims);
      if (!claimsSnap.empty) {
        const claimData = claimsSnap.docs[0].data();
        const username = String(claimData.username || claimsSnap.docs[0].id || '')
          .replace(/^@+/, '')
          .toLowerCase()
          .trim();
        if (username && claimData.status !== 'deleted') {
          if (claimData.status === 'deleted_pending' && isDeletedPurgeExpired(claimData)) {
            firebasePurgeAccountPermanently(username, userId).catch(() => {});
            return null;
          }
          const profile = await firebaseGetProfile(username, { includePendingDelete });
          if (profile) return profile;
          if (claimData.status === 'deleted_pending' && !includePendingDelete) return null;
          return {
            username,
            userId,
            displayName: username,
            status: claimData.status || 'active',
            deletedAt: claimData.deletedAt ?? null,
            purgeAt: claimData.purgeAt ?? null,
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
        const accepted = acceptUserDoc(d.data());
        if (accepted) return accepted;
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
 * Persists a user profile and claim registry document to Firestore with deep sanitization and error propagation.
 */
export async function firebaseSaveProfile(
  username: string,
  profileData: Record<string, any>,
  userId?: string
): Promise<void> {
  if (!username) return;
  await runWriteHook('saveProfile');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, 'owner');
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

    const effectiveUserId = clampRequiredString(
      userId ||
        profileData.userId ||
        (existingData.userId && existingData.userId !== 'owner' ? existingData.userId : 'owner'),
      128,
      'owner'
    );

    const resolvedStatus = clampNullableString(
      profileData.status !== undefined
        ? profileData.status
        : profileData.isPublished === false
          ? 'unpublished'
          : profileData.isPublished === true
            ? 'active'
            : existingData.status || (existingData.isPublished === false ? 'unpublished' : 'active'),
      32
    ) || 'active';

    const rawProfile: Record<string, any> = {
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
      deletedAt:
        profileData.deletedAt !== undefined
          ? profileData.deletedAt ?? null
          : resolvedStatus === 'deleted_pending'
            ? (existingData.deletedAt ?? null)
            : null,
      purgeAt:
        profileData.purgeAt !== undefined
          ? profileData.purgeAt ?? null
          : resolvedStatus === 'deleted_pending'
            ? (existingData.purgeAt ?? null)
            : null,
      updatedAt: profileData.updatedAt || new Date().toISOString(),
    };

    if (typeof profileData.avatarData === 'string' && profileData.avatarData.length <= 350000) {
      rawProfile.avatarData = profileData.avatarData;
    } else if (
      profileData.avatarData === null ||
      (profileData.avatarUrl !== undefined &&
        (!profileData.avatarUrl ||
          (!String(profileData.avatarUrl).startsWith('/api/avatar/') &&
            !String(profileData.avatarUrl).startsWith('data:image/'))))
    ) {
      rawProfile.avatarData = null;
    } else if (existingData.avatarData !== undefined) {
      rawProfile.avatarData = existingData.avatarData;
    }

    const cleanProfile = enforceProfileRuleBounds(rawProfile, clean);

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
      await updateDoc(userRef, sanitizeForFirestore(nestedOverwritePayload));
    }

    // Also save claim registry record adhering strictly to /claims rules
    await setDoc(
      doc(serverDb, 'claims', clean),
      sanitizeForFirestore({
        username: clean,
        userId: effectiveUserId,
        status: resolvedStatus,
        deletedAt: cleanProfile.deletedAt ?? null,
        purgeAt: cleanProfile.purgeAt ?? null,
        claimedAt: clampRequiredString(cleanProfile.updatedAt, 64, new Date().toISOString()),
      }),
      { merge: true }
    );

    // Remove any stale redirect from this newly claimed handle (no-op if absent)
    await deleteDoc(doc(serverDb, 'redirects', clean)).catch(() => {});

    // If userId differs from username, mirror to users/{userId}
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      const mirrorRef = doc(serverDb, 'users', effectiveUserId);
      await setDoc(mirrorRef, cleanProfile, { merge: true });
      if (Object.keys(nestedOverwritePayload).length > 1) {
        await updateDoc(mirrorRef, sanitizeForFirestore(nestedOverwritePayload));
      }
    }
  } catch (err) {
    console.error('[FirebaseServer] saveProfile failed:', err);
    throw new FirebasePersistError('saveProfile', err);
  }
}

/**
 * Persists blocks to Firestore (with batch chunking, deep sanitization, and deleted block cleanup).
 */
export async function firebaseSaveBlocks(
  username: string,
  blocks: any[],
  userId?: string
): Promise<void> {
  if (!username || !Array.isArray(blocks)) return;
  await runWriteHook('saveBlocks');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, 'owner');
  const effectiveUserId = clampRequiredString(userId || 'owner', 128, 'owner');
  const nowIso = new Date().toISOString();

  try {
    const keepIds = new Set<string>();
    const ops: Array<{ type: 'set'; ref: any; data: any } | { type: 'delete'; ref: any }> = [];

    blocks.forEach((b, index) => {
      const rawBlockId = String(b?.id || `b_${Date.now()}_${index}`).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
      const blockId = rawBlockId || `b_${index}`;
      keepIds.add(blockId);

      const cleanBlock = enforceBlockRuleBounds(
        {
          id: blockId,
          userId: effectiveUserId,
          username: clean,
          kind: b?.kind || 'link',
          title: b?.title || '',
          url: b?.url || null,
          icon: b?.icon || null,
          thumbnailPath: b?.thumbnailPath || null,
          thumbnailUrl: b?.thumbnailUrl || null,
          layout: b?.layout || 'classic',
          embedProvider: b?.embedProvider || null,
          embedMeta: b?.embedMeta || null,
          isProtected: Boolean(b?.isProtected),
          signup: b?.signup || null,
          tipJar: b?.tipJar || null,
          coffee: b?.coffee || null,
          faq: b?.faq || null,
          vcard: b?.vcard || null,
          animation: b?.animation || null,
          badge: b?.badge || null,
          youtube: b?.youtube || null,
          product: b?.product || null,
          booking: b?.booking || null,
          countdown: b?.countdown || null,
          promo: b?.promo || null,
          location: b?.location || null,
          download: b?.download || null,
          bluesky: b?.bluesky || null,
          startAt: b?.startAt || null,
          endAt: b?.endAt || null,
          position: Number.isFinite(Number(b?.position)) ? Number(b.position) : index,
          order: Number.isFinite(Number(b?.position)) ? Number(b.position) : index,
          isActive: b?.isActive ?? true,
          isArchived: Boolean(b?.isArchived),
          updatedAt: nowIso,
        },
        blockId,
        clean,
        effectiveUserId
      );

      ops.push({ type: 'set', ref: doc(serverDb!, 'users', clean, 'blocks', blockId), data: cleanBlock });
      if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
        ops.push({ type: 'set', ref: doc(serverDb!, 'users', effectiveUserId, 'blocks', blockId), data: cleanBlock });
      }
    });

    const existingCleanSnap = await getDocs(collection(serverDb, 'users', clean, 'blocks'));
    existingCleanSnap.docs.forEach((docSnap) => {
      if (!keepIds.has(docSnap.id)) {
        ops.push({ type: 'delete', ref: docSnap.ref });
      }
    });

    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      const existingUserSnap = await getDocs(collection(serverDb, 'users', effectiveUserId, 'blocks'));
      existingUserSnap.docs.forEach((docSnap) => {
        if (!keepIds.has(docSnap.id)) {
          ops.push({ type: 'delete', ref: docSnap.ref });
        }
      });
    }

    ops.push({
      type: 'set',
      ref: doc(serverDb, 'users', clean),
      data: { blocksInitialized: true, updatedAt: nowIso },
    });
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      ops.push({
        type: 'set',
        ref: doc(serverDb, 'users', effectiveUserId),
        data: { blocksInitialized: true, updatedAt: nowIso },
      });
    }

    const CHUNK = 400;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(serverDb);
      for (const op of ops.slice(i, i + CHUNK)) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data, { merge: true });
        } else {
          batch.delete(op.ref);
        }
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('[FirebaseServer] saveBlocks failed:', err);
    throw new FirebasePersistError('saveBlocks', err);
  }
}

/**
 * Persists a subscriber contact to Firestore.
 */
export async function firebaseSaveContact(
  username: string,
  contact: { id: string; email?: string | null; phone?: string | null; consentText?: string | null; source?: string | null; formTitle?: string | null }
): Promise<void> {
  if (!username || !contact?.id) return;
  await runWriteHook('saveContact');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, 'owner');
  const safeId = clampRequiredString(contact.id.replace(/[^a-zA-Z0-9._:-]/g, '_'), 128, `c_${Date.now()}`);

  try {
    const cleanContact = enforceContactRuleBounds(
      {
        ...contact,
        id: safeId,
        username: clean,
        createdAt: new Date().toISOString(),
      },
      safeId,
      clean
    );
    await setDoc(doc(serverDb, 'users', clean, 'contacts', safeId), cleanContact);
  } catch (err) {
    console.error('[FirebaseServer] saveContact failed:', err);
    throw new FirebasePersistError('saveContact', err);
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
  if (!username || !contactId) return;
  await runWriteHook('deleteContact');
  if (!serverDb) return;
  const clean = username.toLowerCase().trim();
  try {
    await deleteDoc(doc(serverDb, 'users', clean, 'contacts', contactId));
  } catch (err) {
    console.error('[FirebaseServer] deleteContact failed:', err);
    throw new FirebasePersistError('deleteContact', err);
  }
}

export async function firebaseDeleteAllContacts(username: string): Promise<void> {
  if (!username) return;
  await runWriteHook('deleteAllContacts');
  if (!serverDb) return;
  const clean = username.toLowerCase().trim();
  try {
    const snap = await getDocs(collection(serverDb, 'users', clean, 'contacts'));
    if (snap.empty) return;
    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(serverDb);
      refs.slice(i, i + 400).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  } catch (err) {
    console.error('[FirebaseServer] deleteAllContacts failed:', err);
    throw new FirebasePersistError('deleteAllContacts', err);
  }
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
  if (!oldUsername || !newUsername) return;
  await runWriteHook('saveRedirect');
  if (!serverDb) return;
  const cleanOld = clampRequiredString(oldUsername.replace(/^@+/, '').toLowerCase().trim(), 64, '');
  const cleanNew = clampRequiredString(newUsername.replace(/^@+/, '').toLowerCase().trim(), 64, '');
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;
  try {
    await setDoc(
      doc(serverDb, 'redirects', cleanOld),
      {
        from: cleanOld,
        to: cleanNew,
        updatedAt: new Date().toISOString().slice(0, 64),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[FirebaseServer] saveRedirect failed:', err);
    throw new FirebasePersistError('saveRedirect', err);
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
  const safeId = event.id.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
  if (!clean || !safeId) return;

  try {
    const payload = enforceAnalyticsRuleBounds(event, safeId, clean);
    await setDoc(doc(serverDb, 'users', clean, 'analytics', safeId), payload);
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

async function deleteDocRefsInBatches(refs: any[]): Promise<void> {
  if (!serverDb || refs.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(serverDb);
    refs.slice(i, i + CHUNK_SIZE).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/**
 * Places an account into the 3-day deletion grace period while keeping data intact
 * and locking the username so nobody else can claim it.
 */
export async function firebaseSoftDeleteAccount(
  username: string,
  userId?: string,
  deletedAt?: string,
  purgeAt?: string
): Promise<void> {
  if (!username) return;
  await runWriteHook('softDeleteAccount');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, '');
  if (!clean) return;
  const safeUserId = clampNullableString(userId, 128);
  const nowIso = clampRequiredString(deletedAt || new Date().toISOString(), 64, new Date().toISOString());
  const effectivePurgeAt = clampRequiredString(
    purgeAt || new Date(Date.parse(nowIso) + 3 * 24 * 60 * 60 * 1000).toISOString(),
    64,
    nowIso
  );

  const patch = {
    status: 'deleted_pending',
    isPublished: false,
    hideFromSearch: true,
    deletedAt: nowIso,
    purgeAt: effectivePurgeAt,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(serverDb, 'users', clean), sanitizeForFirestore({ username: clean, ...(safeUserId ? { userId: safeUserId } : {}), ...patch }), { merge: true });
    await setDoc(
      doc(serverDb, 'claims', clean),
      sanitizeForFirestore({
        username: clean,
        ...(safeUserId ? { userId: safeUserId } : {}),
        status: 'deleted_pending',
        deletedAt: nowIso,
        purgeAt: effectivePurgeAt,
      }),
      { merge: true }
    );

    if (safeUserId && safeUserId !== clean && safeUserId !== 'owner') {
      await setDoc(doc(serverDb, 'users', safeUserId), sanitizeForFirestore({ username: clean, userId: safeUserId, ...patch }), { merge: true });
    }
  } catch (err) {
    console.error('[FirebaseServer] softDeleteAccount failed:', err);
    throw new FirebasePersistError('softDeleteAccount', err);
  }
}

/**
 * Restores a soft-deleted account within the 3-day grace window.
 */
export async function firebaseReactivateAccount(
  username: string,
  userId?: string
): Promise<void> {
  if (!username) return;
  await runWriteHook('reactivateAccount');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, '');
  if (!clean) return;
  const safeUserId = clampNullableString(userId, 128);
  const nowIso = new Date().toISOString().slice(0, 64);
  const patch = {
    status: 'active',
    isPublished: true,
    hideFromSearch: false,
    deletedAt: null,
    purgeAt: null,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(serverDb, 'users', clean), sanitizeForFirestore({ username: clean, ...(safeUserId ? { userId: safeUserId } : {}), ...patch }), { merge: true });
    await setDoc(
      doc(serverDb, 'claims', clean),
      sanitizeForFirestore({
        username: clean,
        ...(safeUserId ? { userId: safeUserId } : {}),
        status: 'active',
        deletedAt: null,
        purgeAt: null,
      }),
      { merge: true }
    );

    if (safeUserId && safeUserId !== clean && safeUserId !== 'owner') {
      await setDoc(doc(serverDb, 'users', safeUserId), sanitizeForFirestore({ username: clean, userId: safeUserId, ...patch }), { merge: true });
    }
  } catch (err) {
    console.error('[FirebaseServer] reactivateAccount failed:', err);
    throw new FirebasePersistError('reactivateAccount', err);
  }
}

/**
 * Permanently deletes every Firestore document & subcollection for a purged account
 * and releases the username claim completely.
 */
export async function firebasePurgeAccountPermanently(
  username: string,
  userId?: string
): Promise<void> {
  if (!username) return;
  await runWriteHook('purgeAccountPermanently');
  if (!serverDb) return;
  const clean = username.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return;

  const subcollections = ['blocks', 'contacts', 'clicks', 'analytics', 'appearance'];
  const docIdsToWipe = new Set<string>([clean]);
  if (userId && userId !== 'owner') {
    docIdsToWipe.add(userId);
  }

  try {
    const deleteRefs: any[] = [];

    for (const parentId of docIdsToWipe) {
      const snaps = await Promise.all(
        subcollections.map((sub) => getDocs(collection(serverDb!, 'users', parentId, sub)).catch(() => null))
      );
      for (const s of snaps) {
        if (s && !s.empty) {
          s.docs.forEach((d) => deleteRefs.push(d.ref));
        }
      }
    }

    deleteRefs.push(doc(serverDb, 'claims', clean));
    deleteRefs.push(doc(serverDb, 'redirects', clean));
    deleteRefs.push(doc(serverDb, 'users', clean));

    if (userId && userId !== clean && userId !== 'owner') {
      const uidSnap = await getDoc(doc(serverDb, 'users', userId)).catch(() => null);
      if (uidSnap && uidSnap.exists()) {
        const uName = String(uidSnap.data()?.username || '').replace(/^@+/, '').toLowerCase().trim();
        if (!uName || uName === clean) {
          deleteRefs.push(uidSnap.ref);
        }
      }
    }

    for (const candidate of [clean, `@${clean}`]) {
      const qUsers = query(collection(serverDb, 'users'), where('username', '==', candidate));
      const uSnap = await getDocs(qUsers).catch(() => null);
      uSnap?.docs.forEach((d) => deleteRefs.push(d.ref));
    }

    const qRedirects = query(collection(serverDb, 'redirects'), where('to', '==', clean));
    const rSnap = await getDocs(qRedirects).catch(() => null);
    rSnap?.docs.forEach((d) => deleteRefs.push(d.ref));

    await deleteDocRefsInBatches(deleteRefs);
  } catch (err) {
    console.error('[FirebaseServer] purgeAccountPermanently failed:', err);
    throw new FirebasePersistError('purgeAccountPermanently', err);
  }
}

/**
 * Releases an old username cleanly across Firebase collections when a user renames or deletes their handle.
 */
export async function firebaseReleaseUsername(
  oldUsername: string,
  userId?: string
): Promise<void> {
  if (!oldUsername) return;
  await runWriteHook('releaseUsername');
  if (!serverDb) return;
  const cleanOld = oldUsername.replace(/^@+/, '').toLowerCase().trim();
  if (!cleanOld) return;
  const nowIso = new Date().toISOString().slice(0, 64);

  try {
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
        });
        await deleteDoc(claimRef);
      }
    }

    const [oldBlocksSnap, oldContactsSnap, oldClicksSnap, oldAnalyticsSnap, oldAppearanceSnap] = await Promise.all([
      getDocs(collection(serverDb, 'users', cleanOld, 'blocks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'contacts')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'clicks')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'analytics')).catch(() => null),
      getDocs(collection(serverDb, 'users', cleanOld, 'appearance')).catch(() => null),
    ]);
    const subRefs: any[] = [];
    oldBlocksSnap?.docs.forEach((d) => subRefs.push(d.ref));
    oldContactsSnap?.docs.forEach((d) => subRefs.push(d.ref));
    oldClicksSnap?.docs.forEach((d) => subRefs.push(d.ref));
    oldAnalyticsSnap?.docs.forEach((d) => subRefs.push(d.ref));
    oldAppearanceSnap?.docs.forEach((d) => subRefs.push(d.ref));
    await deleteDocRefsInBatches(subRefs);

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
        });
        await deleteDoc(oldUserRef);
      }
    }

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
          });
          await deleteDoc(d.ref);
        }
      }
    }
  } catch (err) {
    console.error('[FirebaseServer] releaseUsername failed:', err);
    throw new FirebasePersistError('releaseUsername', err);
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
      const uname = typeof data.username === 'string' ? data.username.replace(/^@+/, '').toLowerCase().trim() : '';
      if (!uname) return;
      if (data.status === 'deleted' || data.status === 'deleted_pending') return;
      const existing = byUsername.get(uname);
      if (!existing || isNewerTimestamp(data.updatedAt, existing.updatedAt)) {
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
  if (!username) return;
  await runWriteHook('saveAppearanceState');
  if (!serverDb) return;
  const clean = clampRequiredString(username.replace(/^@+/, '').toLowerCase().trim(), 64, 'owner');
  try {
    const ref = doc(serverDb, 'users', clean, 'appearance', 'v2');
    let prev: any = {};
    if (state.appearance === undefined || state.history === undefined || state.themes === undefined) {
      const prevSnap = await getDoc(ref).catch(() => null);
      if (prevSnap && prevSnap.exists()) {
        prev = prevSnap.data() || {};
      }
    }
    const effectiveUserId = clampRequiredString(userId || prev.userId || 'owner', 128, 'owner');
    const payload = enforceAppearanceRuleBounds({
      username: clean,
      userId: effectiveUserId,
      appearance: state.appearance !== undefined ? state.appearance : (prev.appearance ?? null),
      history: state.history !== undefined ? state.history : (prev.history ?? { undoStack: [], redoStack: [] }),
      themes: Array.isArray(state.themes)
        ? state.themes
        : Array.isArray(prev.themes)
          ? prev.themes
          : [],
      updatedAt: new Date().toISOString(),
    });
    await setDoc(ref, payload);
    if (effectiveUserId && effectiveUserId !== clean && effectiveUserId !== 'owner') {
      await setDoc(doc(serverDb, 'users', effectiveUserId, 'appearance', 'v2'), payload);
    }
  } catch (err) {
    console.error('[FirebaseServer] saveAppearanceState failed:', err);
    throw new FirebasePersistError('saveAppearanceState', err);
  }
}




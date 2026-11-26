# Firebase Firestore Data Map (Backend Storage Only)

This document inventories every Firestore collection, subcollection, field, `/firestore.rules` constraint, writer, and reader across the Iveo backend and frontend.

**Architecture Preservation Notes**
- **Authentication**: Handled exclusively by Clerk (`@clerk/react` frontend, `@clerk/backend` JWT verification when `CLERK_SECRET_KEY` is configured). Firebase Auth is NOT used.
- **Database Role**: Firestore is used strictly as persistent backend/app state storage (`firebase-applet-config.json`, `firestoreDatabaseId: "ai-studio-ivio-5d55ffdc-3211-4f2c-b6c7-1ae883435207"`).
- **Security Rules**: Governed by `/firestore.rules` (not modified).

---

## Global Rules & Document ID Validation
- Default rule: `allow read, write: if false;`
- `isValidId(id)`: string, length `1..128`, regex `^[a-zA-Z0-9._:\-]+$`, must not contain `..`.

---

## Collection / Subcollection Inventory

### 1. `/claims/{username}`
- **Purpose**: Username handle ownership lock, claim status, and 3-day deletion grace state.
- **Required fields (`hasAll`)**: `username`
- **Allowed fields (`hasOnly`)**: `['username', 'userId', 'status', 'claimedAt', 'releasedAt', 'deletedAt', 'purgeAt']`
- **Rule bounds**:
  - `username`: string, `1..64`
  - `userId`: null or string `<= 128`
  - `status`: null or string `<= 32` (`active`, `unpublished`, `deleted_pending`, `deleted`)
  - `claimedAt`, `releasedAt`, `deletedAt`, `purgeAt`: null or ISO string `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveProfile`, `firebaseSoftDeleteAccount`, `firebaseReactivateAccount`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - Called via `/api/profile`, `/api/claim`, `/api/account/delete`, `/api/account/reactivate`, `/api/cron/purge-deleted` in `api/_lib/db-handlers.ts`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseIsUsernameClaimed`, `firebaseGetProfile`, `firebaseGetProfileByUserId`, `firebaseGetBlocks`

### 2. `/redirects/{username}`
- **Purpose**: Redirect mapping from old username to new username after handle rename.
- **Required fields (`hasAll`)**: `from`, `to`, `updatedAt`
- **Allowed fields (`hasOnly`)**: `['from', 'to', 'updatedAt']`
- **Rule bounds**:
  - `from`: string, `1..64`
  - `to`: string, `1..64`
  - `updatedAt`: string, `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveRedirect`, `firebaseSaveProfile` (cleans stale redirect on reclaim), `firebasePurgeAccountPermanently`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseGetRedirectTarget`

### 3. `/users/{userId}`
*(Note: Backend stores primary document keyed by lowercase `username` AND mirrors to `users/{clerkUserId}` when `userId` differs from `username` and `'owner'`.)*
- **Purpose**: Canonical user profile, metadata, theme/appearance mirror, SEO overrides, and deletion status.
- **Rule condition**: Either (`username` is string `1..64`) OR (`blocksInitialized` is bool). No `hasOnly` restriction — nested maps (`socials`, `background`, `fontSettings`, `buttonColors`, `businessCard`, `layoutSettings`, `appearance`, `subscription`) are permitted.
- **Rule bounds**:
  - `userId`: null or string `<= 128`
  - `displayName`: null or string `<= 128`
  - `bio`: null or string `<= 500`
  - `avatarUrl`: null or string `<= 2048`
  - `avatarData`: null or string `<= 350000`
  - `primaryEmail`: null or string `<= 320`
  - `customSeoTitle`: null or string `<= 160`
  - `customSeoDescription`: null or string `<= 320`
  - `deletedAt`, `purgeAt`, `updatedAt`: null or string `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveProfile`, `firebaseSaveBlocks` (sets `blocksInitialized: true`), `firebaseSoftDeleteAccount`, `firebaseReactivateAccount`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - `src/lib/firebaseSync.ts`: `syncProfileToFirebase` (only non-destructive client mirror when authenticated)
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseIsUsernameClaimed`, `firebaseGetProfile`, `firebaseGetProfileByUserId`, `firebaseGetAllProfiles`, `firebaseGetBlocks`

### 4. `/users/{userId}/blocks/{blockId}`
- **Purpose**: Profile link cards, embeds, headings, Buy Me a Coffee (`coffee`), FAQ, vCard, products, booking, countdown, promo, location, download, and social blocks.
- **Required fields (`hasAll`)**: `id`, `kind`
- **Rule bounds**:
  - `id`: string `1..128`
  - `kind`: string `1..32`
  - `userId`: null or string `<= 128`
  - `username`: null or string `<= 64`
  - `title`: null or string `<= 256`
  - `url`: null or string `<= 2048`
  - `thumbnailUrl`: null or string `<= 2048`
  - `updatedAt`: null or string `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveBlocks` (writes all active blocks + batch deletes removed doc IDs), `firebaseMigrateUsernameData`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - `src/lib/firebaseSync.ts`: `syncBlockToFirebase`, `syncAllBlocksToFirebase`, `deleteBlockFromFirebase`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseGetBlocks`

### 5. `/users/{userId}/contacts/{contactId}`
- **Purpose**: Subscriber contacts captured via email/SMS signup blocks.
- **Required fields (`hasAll`)**: `id`
- **Rule bounds**:
  - `id`: string `1..128`
  - `username`: null or string `<= 64`
  - `email`: null or string `<= 320`
  - `phone`: null or string `<= 32`
  - `createdAt`: null or string `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveContact`, `firebaseDeleteContact`, `firebaseDeleteAllContacts`, `firebaseMigrateUsernameData`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - `src/lib/firebaseSync.ts`: `syncContactToFirebase`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseGetContacts`

### 6. `/users/{userId}/clicks/{clickId}`
- **Purpose**: Per-block cumulative click counter.
- **Required fields (`hasAll`)**: `blockId`, `count`
- **Rule bounds**:
  - `blockId`: string `1..128`
  - `count`: number `>= 0`
  - `username`: null or string `<= 64`
  - `userId`: null or string `<= 128`
  - `updatedAt`: null or string `<= 64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseRecordClick`, `firebaseMigrateUsernameData`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - `src/lib/firebaseSync.ts`: `syncClickToFirebase`
- **Readers**:
  - Direct click count read in `firebaseRecordClick` + analytics handlers

### 7. `/users/{userId}/analytics/{eventId}`
- **Purpose**: Time-series `page_view` and `link_click` analytics events.
- **Required fields (`hasAll`)**: `id`, `username`, `eventType`, `createdAt`
- **Allowed fields (`hasOnly`)**: `['id', 'username', 'eventType', 'blockId', 'country', 'referrer', 'device', 'createdAt']`
- **Rule bounds**:
  - `id`: string `1..128`, `username`: string `1..64`, `eventType`: `'page_view' | 'link_click'`
  - `blockId`: null or string `<= 128`, `country`: null or string `<= 120`, `referrer`: null or string `<= 120`
  - `device`: null or `'mobile' | 'tablet' | 'desktop' | 'other'`
  - `createdAt`: string `1..64`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseRecordAnalyticsEvent`, `firebaseMigrateUsernameData`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseGetAnalyticsEvents`

### 8. `/users/{userId}/appearance/v2`
- **Purpose**: Structured Appearance v2 tokens (`appearance`), undo/redo stack (`history`), and saved presets (`themes`, max 20).
- **Required fields (`hasAll`)**: `username`, `userId`, `updatedAt`
- **Allowed fields (`hasOnly`)**: `['username', 'userId', 'appearance', 'history', 'themes', 'updatedAt']`
- **Rule bounds**:
  - `docId` MUST equal `'v2'`
  - `username`: string `1..64`, `userId`: string `1..128`, `updatedAt`: string `<= 64`
  - `themes`: list with `size() <= 20`
- **Writers**:
  - `api/_lib/firebaseServer.ts`: `firebaseSaveAppearanceState`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently`
  - Called via `api/_lib/appearance-handlers.ts`: `persistAppearanceUpdate`, `handleCreateTheme`, `handleRenameTheme`, `handleDeleteTheme`
- **Readers**:
  - `api/_lib/firebaseServer.ts`: `firebaseGetAppearanceState`

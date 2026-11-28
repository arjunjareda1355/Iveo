# Iveo Firebase Data Map & Phase 0 Audit

This document maps every Firestore collection, subcollection, local/SQL mirror, mutation path, and public/admin reader in `iveo.site`.

---

## 1. Runtime & Auth Architecture (Fixed)
- **Authentication**: Clerk (`@clerk/react` frontend via `src/auth/ClerkRoot.tsx`, `@clerk/backend` JWT verification via `api/_lib/clerkAuth.ts`).
- **Database**: Firebase Firestore (`firebase-applet-config.json`), project `gen-lang-client-0937378729`, database ID `ai-studio-ivio-5d55ffdc-3211-4f2c-b6c7-1ae883435207`.
- **Rules**: Enforced by `/firestore.rules` (strictly unmodified). Notice `/firestore.rules` uses a global default-deny (`match /{document=**} { allow read, write: if false; }`) and explicitly allows only `/claims/{username}`, `/redirects/{username}`, `/users/{userId}` and its subcollections (`blocks`, `contacts`, `clicks`, `analytics`, `appearance`).
- **Hosting / Server**: Node.js + Express (`server.ts`, port 3000) serving Vite dev middleware or built `dist/` + SSR HTML head injection (`api/page.ts` + `api/_lib/html.ts`). All database reads/writes execute server-side in `api/_lib/firebaseServer.ts` paired with isolated per-user local/SQL store in `api/_lib/azureSql.ts`.

---

## 2. Firestore Paths & Schemas

| Firestore Path | Rules Validator | Purpose & Key Fields | Writers | Readers |
|---|---|---|---|---|
| `/claims/{username}` | `isValidClaim` | Canonical lowercase username lock (`username`, `userId`, `status`, `claimedAt`, `releasedAt`, `deletedAt`, `purgeAt`) | `firebaseSaveProfile`, `firebaseSoftDeleteAccount`, `firebaseReactivateAccount`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently` | `firebaseIsUsernameClaimed`, `firebaseGetProfile`, `firebaseGetProfileByUserId`, `firebaseGetBlocks` |
| `/redirects/{username}` | `isValidRedirect` | Handle rename canonical redirect (`from`, `to`, `updatedAt`) | `firebaseSaveRedirect` | `firebaseGetRedirectTarget` |
| `/users/{username}` | `isValidUserProfile` | Canonical creator profile (`userId`, `username`, `displayName`, `bio`, `avatarUrl`, `avatarType`, `avatarId`, `avatarData`, `vibeId`, `buttonShape`, `socials`, `socialsPosition`, `primaryEmail`, `plan`, `createdAt`, `subscription`, `status`, `isPublished`, `hideFooter`, `hideFromSearch`, `background`, `customSeoTitle`, `customSeoDescription`, `fontSettings`, `buttonColors`, `businessCard`, `layoutSettings`, `appearance`, `blocksInitialized`, `deletedAt`, `purgeAt`, `updatedAt`) | `firebaseSaveProfile`, `firebaseSaveBlocks`, `firebaseSoftDeleteAccount`, `firebaseReactivateAccount`, `firebaseReleaseUsername`, `firebasePurgeAccountPermanently` | `firebaseGetProfile`, `firebaseGetProfileByUserId`, `firebaseGetAllProfiles`, `firebaseIsUsernameClaimed`, `firebaseGetBlocks` |
| `/users/{userId}` (mirror when `userId !== username`) | `isValidUserProfile` | Mirror by Clerk `userId` for fast O(1) lookup on `/api/me` | `firebaseSaveProfile`, `firebaseSaveBlocks`, `firebaseSoftDeleteAccount`, `firebaseReactivateAccount` | `firebaseGetProfileByUserId` |
| `/users/{username}/blocks/{blockId}` (+ `{userId}` mirror) | `isValidBlock` | Ordered page items (`id`, `userId`, `username`, `kind`, `title`, `url`, `icon`, `thumbnailPath`, `thumbnailUrl`, `layout`, `embedProvider`, `embedMeta`, `isProtected`, `signup`, `tipJar`, `coffee`, `faq`, `vcard`, `animation`, `badge`, `youtube`, `product`, `booking`, `countdown`, `promo`, `location`, `download`, `bluesky`, `startAt`, `endAt`, `position`, `order`, `isActive`, `isArchived`, `updatedAt`) | `firebaseSaveBlocks` | `firebaseGetBlocks`, `handleGetBlocks`, `handleGetMe`, `handleGetPublicPage` |
| `/users/{username}/contacts/{contactId}` | `isValidContact` | Collected subscriber form entries (`id`, `username`, `email`, `phone`, `consentText`, `source`, `formTitle`, `createdAt`) | `firebaseSaveContact`, `firebaseDeleteContact`, `firebaseDeleteAllContacts` | `firebaseGetContacts` |
| `/users/{username}/clicks/{clickId}` | `isValidClick` | Per-block click counters (`blockId`, `username`, `count`, `updatedAt`) | `firebaseRecordClick` | Analytics handlers |
| `/users/{username}/analytics/{eventId}` | `isValidAnalyticsEvent` | Raw `page_view` & `link_click` events | `firebaseRecordAnalyticsEvent` | `firebaseGetAnalyticsEvents` |
| `/users/{username}/appearance/v2` (+ `{userId}` mirror) | `isValidAppearance` | Appearance v2 state, undo/redo history, saved themes (`username`, `userId`, `appearance`, `history`, `themes`, `updatedAt`) | `firebaseSaveAppearanceState` | `firebaseGetAppearanceState` |
| `/users/system.integrations` | `isValidUserProfile` (`blocksInitialized: false`, NO `username` field) | System-only SEO integrations record: AES-256-GCM encrypted GSC service account JSON (`encryptedGscBlob`, `gscMeta` redacted summary, `indexNowKey`, `updatedAt`) | `seoIntegrationsStore.ts` (Admin endpoints only) | `seoIntegrationsStore.ts` (never exposed raw to client) |
| `/users/system.integrations/blocks/{eventId}` | `isValidBlock` (`kind: 'seo_event'`) | Capped recent SEO submission / ping / validation events (`id`, `kind: 'seo_event'`, `title` = action, `url` = targetUrl, `seoEvent`, `updatedAt`) | `seoIntegrationsStore.ts` / `searchEngines.ts` | `/api/seo/admin/overview`, `/api/seo/me/overview` (scoped to caller handle) |

> **Important Rule Compliance**: `firebaseGetAllProfiles` and `firebaseGetProfile` ignore `system.integrations` and `__`-prefixed IDs so system records never appear in user directories, public pages, sitemaps, or audits.

---

## 3. Page Item Kinds (`BlockKind`)
- `link`: Standard link button (`classic` or `featured` layout, optional `thumbnailUrl`/`thumbnailPath`, `animation`, `badge`, `isProtected`, `startAt`/`endAt`)
- `header`: Section header divider (`title` only, `url: null`, no schedule/link validation)
- `divider`: Horizontal rule (`title: ''`, `url: null`)
- `embed`: Platform card or media player (`embedProvider` + `embedMeta` with `lookStyle`, `override`, `ctaLabel`, `showStats`, `banner`, `statsLabel`, etc.)
- `youtube`: Legacy/showcase YouTube channel block (`youtube` payload + `embedMeta.lookStyle`)
- `instagram`: Legacy/showcase Instagram block (`badge` + `embedMeta.lookStyle`)
- `coffee`: Buy Me a Coffee card (`coffee` payload + `embedMeta.lookStyle`)
- `bluesky`, `signup`, `tip_jar`, `faq`, `vcard`, `product`, `booking`, `countdown`, `promo`, `location`, `download`

---

## 4. Cache & Revalidation Flow
On every item mutation (`POST /api/blocks`, profile/appearance/SEO save, claim, delete):
1. Verify Clerk JWT (when `CLERK_SECRET_KEY` configured) & ownership.
2. Persist to local/SQL store AND `await awaitFirebaseWrite(firebaseSaveBlocks / firebaseSaveProfile)` sequentially before returning 200.
3. Call `invalidatePublicPageCache(username)` and `invalidateSitemapCache(reason)`.
4. Queue non-blocking async search engine ping (`notifyProfileSeoChanged` -> debounced IndexNow/Bing + throttled GSC sitemap submit).
5. Return saved authoritative state to client; client reconciles state and rolls back on non-2xx.

---

## 5. Phase 0 Root-Cause Summary
1. **Links <-> Public Page Sync (W1)**: `handleGetPublicPage` and `handleGetBlocks` skipped checking Firebase blocks once local disk `blocksInitialized` became `true`, allowing instance/disk vs Firebase drift; `saveLocalBlocks` debounced full-array writes with no server-authoritative reconciliation returned; non-2xx paths could leave stale local cache out of sync.
2. **Section Header (W2)**: Edit form in `LinksTab.tsx` lacked the `maxLength={40}`, character counter, and inline validation present in the Add composer, and `addHeader` caught errors silently without rethrowing; headers lacked `null` `url` guards in downstream helpers.
3. **Social Card Looks & Connect OAuth (W3)**:
   - `PlatformBlockEditor.tsx` `deriveInitialFromBlock` omitted `...(block.embedMeta || {})` for legacy `youtube` and `instagram` blocks, stripping saved `lookStyle`.
   - `PageRenderer.tsx` / `ShowcaseBlocks.tsx` rendered `instagram` as a hardcoded row and `youtube` without reading `embedMeta.lookStyle` / `layout.cardLook`, ignoring all 7 Card Looks while Live Preview used `EmbedBlock`.
   - `resolveSocialOAuthRedirectUri` & `resolveYouTubeOAuthRedirectUri` prioritized `SITE_URL` over the active popup caller `requestOrigin`, breaking `BroadcastChannel` / `localStorage` callback handshakes on preview/dev origins.
4. **SEO (W4)**:
   - `isSeoAdminRequest` trusted client-supplied `req.query.adminEmail` / `x-user-email` headers without Clerk JWT verification.
   - `SearchSeoCard` hid the `"Open SEO console"` button from non-admin creators instead of providing a per-user scoped SEO console.
   - `SeoAdminPage` lacked the Upload `.json` / paste textarea / Property URL / `"Save & Test GSC"` / `"Test Connection"` / `"Remove key"` UI controls and showed unorganized flat cards.
   - `searchEngines.ts` wrote GSC JSON in plaintext to `data/gsc_service_account.local.json` instead of AES-256-GCM encryption in Firebase, and `/:verificationKey.txt` only checked `process.env.INDEXNOW_KEY` instead of auto-generating & persisting a key in Firebase.

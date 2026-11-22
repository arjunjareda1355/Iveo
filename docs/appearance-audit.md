# Iveo Appearance System Audit (`v1` -> `v2`)

## 1. Tech Stack & Architecture
- **Frontend**: React 18 SPA on Vite 6, TypeScript, Tailwind CSS v4 (`src/styles/globals.css`), `react-router-dom` routing.
- **State & Persistence**: `useIvioSession` (`src/auth/useIvioSession.ts`) manages localStorage, optimistic client sync, cross-tab `BroadcastChannel('iveo_profile_sync')`, Firebase Firestore client sync (`src/lib/firebaseSync.ts`), and backend persistence via `/api/*`.
- **Backend**: Express server (`server.ts`, `api/data.ts`, `api/_lib/appearance-handlers.ts`, `api/_lib/db-handlers.ts`, `api/_lib/azureSql.ts`, `api/_lib/firebaseServer.ts`) with SSR metadata + inline hydration (`api/_lib/publicPage.ts`).
- **Pre-Refactor Audit**:
  - **Old catalogues**: 12 vibes (`src/lib/vibes.ts`), ~45 background presets (`src/lib/backgrounds.ts`), 19 Google Font options (`src/lib/fonts.ts`), 6 button styles (`solid`, `outline`, `soft`, `offset`, `glass`, `gradient`), 4 avatar shapes (`circle`, `squircle`, `rounded`, `ring`), 2 header alignments (`center`, `left`), 3 spacings (`compact`, `normal`, `airy`), and 3 widths (`compact`, `standard`, `wide`).
  - **Legacy UI issues removed**: Cramped nested scroll panels in a single `AppearanceTab.tsx`, non-functional `"Studio preview"` box and `"Mobile / Desktop"` toggle, misleading `"Text contrast"` indicator, broken yellow live-preview typography box, redundant `ButtonPreview` + duplicate `Shape` selectors, and 12 static color swatches without OKLCH gamut or contrast safety.
  - **Divergence resolved**: Preview (`PhonePage.tsx`) and live public pages (`PageRenderer.tsx`) previously interpreted button colors, backgrounds, and typography in separate code paths.

## 2. Unified `v2` Data & Token Flow
```
Profile (legacy v1 or Schema v2)
  └─> migrateLegacyProfileToAppearanceV2() [idempotent]
        └─> Schema v2 Appearance object
              └─> resolveTokens(appearance, { isPro }) [pure, shared by Preview & PageRenderer]
                    ├─> BgProfile via analyzeBackground() (48x48 grid + OKLab p05/p95 + smartScrim)
                    ├─> Page text / muted / accent / focusRing (WCAG >= 4.5 / >= 3.0)
                    ├─> FontRoles (56 Google fonts, <= 3 distinct families, Bio legibility guard)
                    ├─> ButtonTokens (12 surfaces C1–C11 compatibility, hover/pressed state shifts)
                    └─> LayoutTokens (10 avatar frames, C8/C9 layout invariants, CSS variables)
```

## 3. Entitlements & Security Boundaries
- Canonical plan resolution (`src/lib/plan.ts`) computes `isPro` identically across client and server, checking `privileged` owner bypass (`isPrivilegedEmailServer`) and active/trialing subscription dates.
- Server-side `validateAndMergeAppearancePatch` in `api/_lib/appearance-handlers.ts` rejects unauthorized writes (`401`/`403`), enforces `402 PRO_REQUIRED` on gated fields without mutating Pro fields, caps history snapshots at 20 with 2s coalescing, enforces `THEME_LIMITS` (`1` free, `10` Pro), rate-limits appearance writes (`60 req/min` -> `429`), and strips EXIF/XMP/tEXt metadata from uploaded background images (>= 1080px short side, <= 8 MB).

## 4. Migration Safety & Visual Regression Mitigation
- **Rule R1**: Existing pages without `schemaVersion: 2` preserve exact visuals upon first load by freezing legacy backgrounds (`type: "legacy"`), explicit hex colors, and setting `autoMatchButtons: false`.
- **Fallback Parity**: `appearanceToLegacyMirror()` keeps non-Appearance features (`ShareDialog`, `BusinessCardConfig`) reading synced legacy mirrors without requiring rewrites.
- **Zero Feature Loss**: Preserved onboarding `VibeTileGroup.tsx`, landing `Hero` & `VibesShowcase`, `CardLookTileGrid`, `Remove iveo branding` footer toggle, Embed/Bluesky blocks, Share/Business Card dialogs, and strict public page footer parity (`PageRenderer.tsx`).

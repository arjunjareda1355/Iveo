# Iveo Appearance System (`Schema v2`) Developer Guide

## 1. Overview
The Appearance System separates **Design Intent** (`Appearance` Schema v2 JSON) from **Computed Presentation** (`ResolvedTokens` + CSS variables). Both the Dashboard live preview (`PhonePage.tsx`) and public user profile renderer (`PageRenderer.tsx`) consume the exact same pure `resolveTokens()` pipeline so edits render identically across preview and live routes.

---

## 2. Schema v2 Structure (`src/lib/appearance/types.ts`)
- `schemaVersion`: `2`
- `vibeId`: ID in `CATALOG_VIBES` (24 vibes across 6 collections).
- `background`: Discriminated union (`preset` | `solid` | `gradient` | `image` | `legacy`) supporting grain (`0..40`), blur (`0..60`), vignette (`0..50`), tone (`-20..+20`), pattern overlays, and Pro photo backgrounds with focal coordinates, smart scrim, 8x8 luminance grid, and extracted palette.
- `typography`: `{ name, bio, button }` (`FontRole` with `family`, `weight`, `size`, `tracking`, `case`, `lineHeight`, `source`).
- `buttons`: `shape` (`square` | `rounded` | `pill` | `custom`), `radius` (`0..40`), `fill`, `text`, `border`, `borderWidth` (`0..4`), `surface` (12 surfaces), `size`, `shadow`, `align`, `icon`, `motion`, optional `gradient`, and derived `hover`/`pressed` state overrides.
- `layout`: `header` (`centered` | `editorial` | `compact` | `hero`), `avatar` (`frame` across 10 frames, `size`, `glow`), `linkLayout` (`stack` | `grid2` | `chips`), `spacing`, `width`, `entrance`, `socialIcons`.
- `locks`: Array of `AppearanceLock` keys preserved across *Surprise me* and partial Vibe/Suggestion applies.

---

## 3. Pure Engines (`src/lib/color/*` & `src/lib/appearance/resolveTokens.ts`)
- **WCAG Contrast (`contrast.ts`)**: Linearizes sRGB channels, composites translucent fills (`rgba`) over background samples, and evaluates `worstCaseContrast()` across `[darkest, lightest]` p05/p95 samples.
- **OKLab / OKLCH (`oklch.ts`, `gamut.ts`)**: Exact Björn Ottosson OKLab matrices, Euclidean `deltaE()`, chroma binary search (`reduceChromaToGamut`), tone lightness caps (`maxAllowedChroma`), and `bestText()`.
- **Background Analyzer (`analyze.ts`)**: Deterministic `48x48` rasterizer computing `BgProfile` (`meanL`, `meanC`, `meanHue`, `p05L`, `p95L`, `complexity`, `tone`, `chromatic`, `warm`, `cool`, `darkest`, `lightest`) plus minimum alpha `solveSmartScrim()`.
- **Suggestion Engines (`recipes.ts`)**:
  - `suggestButtons()`: Evaluates 12 recipes (`R1`–`R12`) against STRICT (`T1 >= 4.5`, `T3 >= 3.0`) and SOFT (`T1 >= 4.5` after slot 3) rules, scores contrast/harmony/vibe affinity/novelty, and selects 8 diverse sets.
  - `suggestFonts()`: Scores 18 curated pairings + 30 seeded combinations against background moods and button surface, limiting pairs to <= 3 distinct families and blocking `excludeFromBio` display/script fonts from Bio.
  - `suggestLayouts()`: Evaluates 12 curated recipes + seeded mutations filtered by surface compatibility `C1–C11`, C8 short-label checks, and C9 hero avatar bump.

---

## 4. Navigation & Screen Architecture
- `/dashboard/appearance`: Minimal Home with **Surprise me**, **My themes**, and 5 status rows (`Vibe`, `Background`, `Typography`, `Buttons`, `Layout`) plus preserved **Remove iveo branding**.
- `/dashboard/appearance/{vibe,background,typography,buttons,layout}`: Deep-linkable full-screen sub-screens built on `SectionScreenShell.tsx` (sticky 56px top bar, sticky <=1 secondary row, single document scroll container, sticky 64px safe-area bottom bar on mobile, desktop 360px live `VibePhone` preview, 400ms debounced autosave, and 20-step Undo/Redo).

---

## 5. How to Extend Catalogues Safely
1. **New Vibe**: Add a `CatalogVibe` entry to `CATALOG_VIBES` in `src/lib/appearance/catalog/vibes.ts` referencing a valid `backgroundId` and catalog font families. Add a test or run `tests/appearance-engines.test.ts` to verify WCAG contrast against its backdrop.
2. **New Background Preset**: Add a `CatalogBackgroundPreset` to `CATALOG_BACKGROUNDS` in `src/lib/appearance/catalog/backgrounds.ts` and ensure any blob `peakAlpha` keeps `p05L`–`p95L` spread clean for text contrast.
3. **New Font**: Append a `CatalogFont` in `src/lib/appearance/catalog/fonts.ts` with exact `googleSpec`, allowed `roles` (`N`/`B`/`T`), `weights`, and `excludeFromBio: true` for Script, Pixel, Condensed, or Roman caps display faces.
4. **New Button Surface**: Add the surface key to `ButtonSurface` (`types.ts`), `CATALOG_SURFACES`, `checkSurfaceCompatibility()`, and `buildButtonSurfaceCss()` in `src/lib/appearance/catalog/surfaces.ts`, with a free fallback in `getFreeFallbackSurface()`.

---

## 6. Migration & Rollout Runbook
- **Schema Rollout**: Legacy profiles are migrated on read via idempotent `migrateLegacyProfileToAppearanceV2()` (freezes legacy backgrounds so zero unintended visual diffs occur on live pages).
- **Caching & Sync**: Saving via `PATCH /api/appearance` updates both Azure/memory state and Firebase Firestore, mirrors legacy preferences, broadcasts updates across open tabs via `BroadcastChannel('iveo_profile_sync')`, and invalidates `/@username` SSR HTML caches (`invalidatePublicPageCache`).
- **Rollback**: Because legacy mirrors (`vibeId`, `buttonShape`, `buttonColors`, `fontSettings`, `layoutSettings`) remain written in sync alongside `appearance`, reverting the UI to read legacy fields never loses core user customizations; individual user Undo snapshots can also be popped cleanly via `POST /api/appearance/undo`.

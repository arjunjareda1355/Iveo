# Prompt: replace static section art on the iveo landing page with animated widgets

## Goal
Replace the static illustrations in **11 specific sections** of my iveo landing page with 11 ready-made animated widgets, so each animation runs inside the site exactly where the old art was. **Change nothing else on the site.**

The 11 widget files are in `./animations/` (adjust path if needed). Each is a standalone HTML file; the part to use sits between the comments `COPY FROM HERE` and `COPY TO HERE` (one `<style>`, one root `<div>`, one `<script>`). Ignore the `<body>` styling outside those comments, it is only for previewing.

## Hard rules (do not break these)
1. Touch **only** the 11 sections listed below. No edits to the header, hero, "Vibes" section, pricing, FAQ, footer, or any other component.
2. Keep each section's outer card, heading, description, PRO badge, spacing, grid and responsive behaviour exactly as they are. Replace **only the inner art container** (the grey rounded stage or phone mockup that holds the static illustration).
3. No layout shift: the widget must occupy the same space as the old art on mobile (~390px) and desktop (~1280px). The widgets use `aspect-ratio` and `cqw` units, so they size themselves from the width of their parent. Do not add padding, margins or fixed heights around them to make them fit.
4. Do not add libraries or dependencies. Do not reformat, lint-fix or reorder unrelated code. Do not rename existing classes, IDs or files.
5. Keep all widget CSS scoped under its own root class (`.iveo-claim`, `.iveo-links`, etc.). Do not write global selectors. Do not change the widgets' visual design, timing or copy unless a rule below says to.
6. Do not touch any interactive, wired-up element (see the note on "Ready when you are").

## Sections and files
| # | Where on the page | Replace this static art | Widget file | Root element |
|---|---|---|---|---|
| 1 | How it works, step 01 "Claim your name" | grey stage with `iveo.site/maya` and "Available" | `iveo-claim-name-animation.html` | `#iveoClaim` / `.iveo-claim` |
| 2 | How it works, step 02 "Add your links" | grey stage with Portfolio, Shop prints, Newsletter rows | `iveo-add-links-animation.html` | `#iveoLinks` / `.iveo-links` |
| 3 | How it works, step 03 "Choose a vibe" | grey stage with the four style tiles | `iveo-choose-vibe-animation.html` | `#iveoVibe` / `.iveo-vibe` |
| 4 | Features, "Links, arranged by hand" | grey stage with four link rows and toggles | `iveo-links-arranged-animation.html` | `#iveoArrange` / `.iveo-arrange` |
| 5 | Features, "See it as you edit" | phone mockup (Maya Ellis) | `iveo-live-preview-animation.html` | `#iveoLive` / `.iveo-live` |
| 6 | Features, "Schedule links" (PRO) | calendar grid | `iveo-schedule-links-animation.html` | `#iveoSched` / `.iveo-sched` |
| 7 | Features, "Embed what you make" (PRO) | video, track and waveform art | `iveo-embed-animation.html` | `#iveoEmbed` / `.iveo-embed` |
| 8 | Features, "A QR code for every page" | QR code card | `iveo-qr-animation.html` | `#iveoQr` / `.iveo-qr` |
| 9 | Features, "Analytics that stay readable" (PRO) | stats row and bar chart | `iveo-analytics-animation.html` | `#iveoStats` / `.iveo-stats` |
| 10 | Features, "Collect emails and numbers" (PRO) | email field and Subscribe button | `iveo-collect-animation.html` | `#iveoCollect` / `.iveo-collect` |
| 11 | "Ready when you are." dark section | claim input, Claim button and hint lines | `iveo-ready-animation.html` | `#iveoReady` / `.iveo-ready` |

Locate each section by its heading text, not by line numbers.

## Step 1: inspect before editing
- Identify the stack (plain HTML, React/Next.js, Vue, Svelte, Astro, etc.), how styles are written (CSS files, CSS modules, Tailwind, styled components) and whether the same section is rendered twice (for example one mobile and one desktop version).
- Find the 11 static art containers and show me a short list: file, element, and what you plan to replace. Then proceed.
- Take "before" screenshots at 390px and 1280px width for every section you will touch and every neighbouring section.

## Step 2: integrate (adapt to the stack)
**Plain HTML:** put the widget's `<style>`, root `<div>` and `<script>` in place of the old art. Put the `<style>` in the site's stylesheet (or keep it inline next to the markup), and keep each script as its own small file or inline block.

**React / Next.js / Vue / similar:** make one component per widget (for example `ClaimNameAnimation`) containing the same markup and CSS.
- Mark client components where needed (`'use client'` in Next.js) and keep all `window`, `matchMedia` and `IntersectionObserver` use inside effects so server rendering does not break.
- Replace `document.getElementById(...)` with refs scoped to the component, so the same widget can render twice without clashing.
- Clean up on unmount: clear the pending timeout, cancel any `requestAnimationFrame` (analytics widget), and disconnect the `IntersectionObserver`.
- Remove hard-coded IDs from the markup if you switch to refs (keep the class names).

**If a section is rendered twice** (mobile and desktop variants), make sure both instances work independently, with no duplicate IDs.

## Step 3: sync with the site (keep each widget visually native)
- **Fonts:** widgets inherit the page's sans-serif. For mono text they use a CSS variable with a fallback stack (`--ic-mono`, `--il-mono`, `--ie-mono`, `--iq-mono`, `--ist-mono`, `--is-mono`, `--ir-mono`). Point these at the site's actual mono font (the one used for `iveo.site/maya`) so the text matches.
- **Colours:** each widget declares its colours as variables at the top of its CSS (background, surface, border, ink, muted). Map them to the site's existing design tokens if tokens exist; otherwise leave the defaults. The grey stage must match the old stage colour exactly.
- **Radius and borders:** match the old art container's border radius so the corners look identical.
- **Dark section:** the "Ready when you are" widget has a transparent background on purpose. It must sit directly on the existing black section.
- **Behaviour already built in (keep it):** each animation starts only when it scrolls into view, pauses when off-screen, loops, and shows a static final state when the visitor has "reduce motion" turned on. Do not remove these.
- Optional small improvement, allowed: also pause when the browser tab is hidden (`visibilitychange`).

## Special case: "Ready when you are" (#11)
Check whether the existing input and Claim button are **functional** (wired to a form, submit handler, router or API call).
- If they are **decorative**: replace them with the widget.
- If they are **functional**: do **not** remove or modify the real form. Leave section 11 untouched and tell me, so I can decide how to handle it. Never break the real claim flow.

## Step 4: verify
1. The build/dev server runs with no errors or new console warnings.
2. At 390px and 1280px, every non-listed section is pixel-identical to the "before" screenshots.
3. Each of the 10 (or 11) animated sections occupies the same space as before (no layout shift on load or while animating).
4. Each animation starts when scrolled into view, stops when scrolled away, and restarts cleanly.
5. With "prefers-reduced-motion" enabled, each widget shows a static final state and nothing animates.
6. Navigating away and back (client-side routing) leaves no running timers or duplicate animations.
7. `git diff` touches only the files needed for these 11 sections (plus the new widget files/components). List them.

## Deliverable
- Work on a new branch, one commit per section if practical.
- Finish with a short report: files changed, anything skipped (and why), any assumptions, and the before/after screenshot comparison.
- If anything is unclear or would require changing something outside these sections, **stop and ask** instead of guessing.

# Prompt: Integrate the iveo loading animation into iveo.site

## Context
I'm building **iveo.site**, a link-in-bio app (users create a profile page with links, and visitors open it). I have a custom animated logo loader (an outline "i" that draws and erases in a loop). I want it integrated into the site as the **single, consistent loading indicator**, shown whenever content takes time to load. Look at my existing codebase first, detect the stack (plain HTML/JS, React, Next.js, Vue, etc.), and implement it idiomatically for that stack. Don't introduce new dependencies.

## The asset (use exactly as is, do not redraw or change the geometry or timing)

```html
<svg class="iveo-loader" viewBox="290 150 220 500" role="img" aria-label="Loading">
  <circle class="s d" pathLength="1" cx="401" cy="237" r="63"/>
  <path class="s" pathLength="1" d="M324 410 C324 392 332 380 348 370 L440 310 C458 298 476 306 476 330 L476 520 C476 538 468 548 452 558 L365 620 C345 633 324 622 324 595 Z"/>
</svg>
```

```css
.iveo-loader { height: auto; overflow: visible; color: currentColor; }
.iveo-loader .s {
  fill: none; stroke: currentColor; stroke-width: 9; stroke-linejoin: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: iveo-trace 2.2s ease-in-out infinite;
}
.iveo-loader .d { animation-delay: .15s; }
@keyframes iveo-trace {
  0%   { stroke-dashoffset: 1; }
  55%  { stroke-dashoffset: 0; }
  80%  { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -1; }
}
@media (prefers-reduced-motion: reduce) {
  .iveo-loader .s { animation: none; stroke-dashoffset: 0; }
}
```

Properties of the loader: transparent background (no box, no fill), colour comes from `currentColor`, loop is 2.2s and seamless.

## Build one reusable component
Create a single `Loader` component (or partial/function for non-framework sites) that renders the inline SVG above. Do **not** use an `<img>` or external file, because inline SVG lets it inherit the theme colour. Props/variants:

| Variant | Size (width) | Use |
|---|---|---|
| `xs` | 16px | inside buttons (replaces the label or icon) |
| `sm` (default) | 24px | inline in sections, cards, lists, load-more |
| `md` | 32px | centered in a content area / page section |
| `lg` | 40px | full-screen initial load (max size, never larger) |

Keep it **small and subtle**. Never exceed 40px wide anywhere. Height is automatic from the viewBox (about 2.27x the width). The loader's colour must follow the surrounding text colour, so it works in light and dark themes automatically (do not hardcode black or white; use `currentColor`, with a muted tone like 60 to 70% opacity if it fits the design).

## Where and when to show it

1. **Initial app/page load (full-screen)**
   - Shown when the page is booting and the first data (profile, links, auth/session) hasn't arrived.
   - Fixed overlay, centered, `lg` size, **transparent background** (no solid colour or blur), so any already-rendered content stays visible behind it.
   - Hide as soon as the primary content is ready.

2. **Route / page transitions**
   - When navigating between pages (dashboard, editor, analytics, settings, public profile) and the next page's data is fetching: show `md` centered in the content area, not over the header or nav.

3. **Section-level loading**
   - When one part of a page is loading (the links list, analytics charts, theme gallery, a visitor's profile links): show `sm` or `md` centered inside that container, with the container keeping a sensible min-height so the layout doesn't jump.

4. **Inline in buttons / actions**
   - On save, publish, add link, upload, delete, copy and similar actions: replace the button label with the `xs` loader, disable the button, and keep the button's width fixed (no layout shift). Restore the label when finished.

5. **Pagination / infinite scroll**
   - A `sm` loader centered at the bottom of the list while the next page is fetched.

6. **Do NOT use it for**
   - Operations that finish in under ~300ms (see timing rules below).
   - Image loading, which should use a neutral placeholder or skeleton instead.
   - Form validation errors or empty states.
   - Decorative purposes. It signals "something is loading" only.

## Timing rules (prevent flicker and stuck loaders)
- **Show delay: 300ms.** Don't render the loader until the operation has been pending for 300ms. Fast responses should never flash it.
- **Minimum visible time: 600ms** once shown, to avoid a blink-and-vanish effect.
- **Fade:** 150 to 200ms fade in and 150 to 200ms fade out (opacity only).
- **Timeout:** if loading exceeds **15 seconds**, replace the loader with a short error message ("Taking longer than expected") and a **Retry** button.
- **Concurrent requests:** use a counter (ref-count) for the global overlay, so it stays visible until **all** pending requests complete, and never stack two overlays.

## Behaviour and architecture
- Expose a simple API for the global overlay, e.g. `showLoader()` / `hideLoader()` (or a `useLoader()` hook / store / context in React, Vue or Svelte), plus a `<Loader size="sm" />` component for inline and local use.
- Wire the global overlay into: initial boot, route changes, and the central fetch/API wrapper (if one exists), so most requests are covered automatically without per-page code.
- Section-level and button-level loaders should be driven by each component's own `loading` state, not the global overlay.
- Only one instance of the global overlay in the DOM. Mount it once at the app root.
- Global overlay: `pointer-events: none` for route and section loads, so the user can still read or scroll. Use `pointer-events: auto` only for the very first boot load.
- Respect the site's z-index scale. Overlay above content, below modals and toasts.

## Accessibility
- The loading region gets `role="status"` and `aria-live="polite"`, with visually hidden text "Loading".
- Set `aria-busy="true"` on a container while its content loads.
- Honour `prefers-reduced-motion` (already in the CSS: shows the static outline).
- Don't trap keyboard focus in the loader.

## Performance
- Inline SVG and pure CSS animation only: no JS animation loops, no libraries, no extra network requests.
- No layout shift when the loader appears or disappears (reserve the space).

## Deliverables
1. The `Loader` component + the CSS (placed in the project's normal styling approach).
2. The global overlay + `showLoader` / `hideLoader` (or the hook).
3. Integration in: initial load, route transitions, the main data-fetching wrapper, at least one section-level example (the links list), and one button-level example (the save button).
4. A short summary listing every file changed and where the loader now appears.

## Acceptance checklist
- [ ] Loader never appears larger than 40px wide, and the default is 24px.
- [ ] Background is fully transparent everywhere, with content visible behind the overlay.
- [ ] Works in light and dark themes with no hardcoded colours.
- [ ] Nothing flashes for fast requests (300ms delay works).
- [ ] No layout jump when the loader shows or hides.
- [ ] Buttons keep their width while loading and are disabled.
- [ ] 15s timeout shows an error with Retry.
- [ ] Reduced-motion users see a static outline.
- [ ] The SVG geometry and animation are unchanged from the original.

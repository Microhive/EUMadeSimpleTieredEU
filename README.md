# EU Made Simple — Tiered Europe

[![Deploy to GitHub Pages](https://github.com/Microhive/EUMadeSimpleTieredEU/actions/workflows/deploy.yml/badge.svg)](https://github.com/Microhive/EUMadeSimpleTieredEU/actions/workflows/deploy.yml)

An interactive infographic exploring what a tiered European Union could look like. Countries are grouped into four integration tiers — Inner Union, European Union, Associate Membership, and Community + Friends — and displayed on an interactive world map.

**Live site:** https://microhive.github.io/EUMadeSimpleTieredEU/

![EU Made Simple — Tiered Europe screenshot](assets/screenshot.png)

---

## What it shows

The scenario proposes a multi-speed Europe where willing states can integrate faster while keeping a clear path for candidates, neighbours, and democratic friends to move closer to the European project.

| Tier | Description |
|------|-------------|
| **Inner Union** | A frontrunner group for common defence, eurozone depth, Schengen, and unified foreign policy |
| **European Union** | The shared rights and obligations of membership: institutions, budget, law, and the single market |
| **Associate Membership** | A bridge tier for candidates, close neighbours, and partners aligned with the single market path |
| **Community + Friends** | A wider democratic circle for security, climate, energy, crises, and supply chains |

This is an editorial scenario, not an official EU proposal. Source anchors: [EU countries](https://european-union.europa.eu/principles-countries-history/eu-countries_en), [EU enlargement](https://european-union.europa.eu/principles-countries-history/eu-enlargement_en), [EU values](https://european-union.europa.eu/principles-countries-history/principles-and-values_en). Map data from [Natural Earth](https://www.naturalearthdata.com/).

---

## Main features

### Tiered scenario explorer

- Four nested integration tiers with summaries, capability pills, and country flag chips.
- Cumulative tier logic: selecting EU also includes the Inner Union; selecting Associate includes EU and Inner; selecting Community + Friends includes all tiers below it.
- Country cards explain what a selected country means in the scenario and which tier it belongs to.
- Benefit pills open explanatory modals for the core ideas behind the model: open doors, shared standards, strategic weight, and forward motion.

### Interactive map

- D3 Natural Earth projection with pan, mouse-wheel zoom, and two-finger pinch zoom on mobile.
- Scene buttons focus the map on Inner, EU, Associate, Community + Friends, or the wider world.
- Countries highlight by tier, hover state, active country, and active scene.
- Country labels adapt to zoom level so they stay readable when zoomed in and less crowded when zoomed out.
- High-detail country rendering is used for selected or tiered countries, including small territories such as the Faroe Islands.
- A docked legend and editorial source disclaimer stay with the map on desktop, with responsive placement on smaller screens.

### Canvas-rendered map and flags

- Countries are painted on a canvas layer for better performance with detailed topology.
- Map flags are also rendered on canvas to avoid a large number of DOM image elements.
- Circle flag SVGs are bundled into the app instead of fetched one-by-one at runtime.
- Tiered countries appear fully visible; non-tiered countries are faded, monochrome, and shadowless.
- Flags shrink slightly when zoomed out to reduce clustering, then grow back toward full size as the user zooms in.
- Hovering a map flag shows the country label to the right of the flag.
- Hovering a tier button or tier card highlights matching flags on the map and in the tier list with a yellow ring.
- Hovering an individual tier-list flag temporarily focuses that specific flag, then restores the broader tier highlight when the pointer leaves.

### Editing and sharing tiers

- Edit mode enables drag-and-drop between tier cards and from map flags into tier cards.
- Dragging a map flag or tier-list flag shows a visual drag ghost that follows the pointer.
- Dropping a tier-list flag back onto the map removes it from the tier arrangement.
- Reset restores the original scenario arrangement.
- Clear removes every country from every tier.
- Share copies a URL whose query parameters encode the current tier arrangement.
- Opening a shared URL loads the tier arrangement from the query parameters.

### Responsive and accessible UI

- Desktop and mobile layouts use the same scenario data with different map, legend, modal, and tier-card placement.
- Mobile supports tap selection, two-finger map zoom, and a bottom-centered modal close button.
- The modal close button remains easy to find on both desktop and mobile scroll states.
- The first paint includes the core tier cards, map shell, legend, loading state, and disclaimer before app JavaScript finishes.
- Interactive controls use semantic buttons, ARIA labels, titles, and live regions where useful.
- Playwright tests cover first paint, scene tabs, country interactions, touch gestures, drag-and-drop editing, sharing, canvas rendering, flags, and modal behavior.

---

## Tech stack

- **Vite** — build tool and dev server
- **TypeScript** — typed application logic
- **D3.js** — map projection, zoom, and data binding (loaded as vendor script)
- **TopoJSON** — world topology at 110m and 50m resolution
- **Canvas 2D** — high-detail country and map-flag rendering
- **circle-flags** — bundled circular flag SVGs for country chips and map flags
- **Playwright** — browser regression tests

---

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173/

### Build

```bash
pnpm build
```

Output goes to `dist/`.

---

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via the included workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

To enable it, go to **Settings → Pages** in the repository and set **Source** to **GitHub Actions**.


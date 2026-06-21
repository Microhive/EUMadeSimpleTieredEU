# Feature Expectations

This is a quick behavioral reference for future agents working on the app.
It is distilled from `tests/map-interactions.spec.ts`; the tests remain the
source of truth when details conflict.

## Scenario Model

- The app presents four nested integration tiers: Inner Union, European Union,
  Associate Membership, and European Community + Friends.
- Tier selection is cumulative: European Union includes Inner Union; Associate
  includes European Union and Inner Union; Community + Friends includes all
  tiers.
- The active map scene controls which tier outlines remain visible. Selecting a
  country outside the active scene should add that country to the visible focus,
  not expand the map to that country's full tier path.
- Hover interactions preview map focus without committing the selection.
- Hovering a country should not change the country card.
- Clicking or tapping a country or country chip should show that country's card.
- Tapping an already focused country on mobile should restore the selected tier
  scene.

## First Paint And Loading

- Before app JavaScript finishes, the page should already show the value pills,
  tier titles, tier capability pills, tier summaries, flag skeletons, map
  legend, EU loading stars, and desktop source disclaimer.
- Map topology should be preloaded.
- While topology is pending, the map shows a loading shell with pulsing EU
  stars.
- Hydration should preserve the static tier deck nodes instead of replacing the
  whole deck.
- Loading map data should not rerender the tier cards unnecessarily.

## Tier And Scene Controls

- Clicking a desktop scene tab marks that tab active without covering the map
  with the country card.
- Hovering a scene tab previews the corresponding tier on the map, then restores
  the previous active tab when the pointer leaves.
- Hovering a scene tab must preserve an already active country outline and card.
- On small viewports, hovering tier tabs or tier cards must not scroll the page.
- On mobile, tapping a tier tab updates the country card but must not auto-scroll
  to it.
- Viewport height changes should preserve the selected tier framing.
- Hovering tier cards previews the map only; it should not render a separate
  tier description into the card area.

## Map Rendering

- The world map uses a flat, non-wrapping Mercator-style projection. Russia
  should not appear to the left of North America.
- All relevant countries should fit within the map frame at the world view.
- Antarctica is intentionally not rendered.
- Crimea is removed from Russia's rendered geometry.
- Highlighting Ukraine should also outline Crimea.
- Belgium belongs to the European Union tier by default.
- Faroe Islands has a high-detail interaction path.
- Tablet layout must keep SVG paths, canvas countries, canvas flags, and labels
  aligned with the map frame.
- A docked desktop disclaimer should stay inside the map and offset bottom
  overlays.
- The map should stay near world bounds when dragged while zoomed.

## Country Hover, Selection, And Cards

- Hovering a country adds a thick yellow country outline while keeping the
  selected tier visible.
- Country hover should also focus the corresponding map flag when map flags are
  enabled.
- Moving away from a country removes the hover outline and restores the selected
  tier state.
- Clicking a country selects it, shows its info card, outlines it, and focuses
  its map flag.
- Clicking an untiered country shows external relationship context.
- Clicking a country outside the active scene keeps the active scene outlines
  visible and adds only that selected country outline.
- Country cards for EU members separate current EU status from the proposed
  scenario tier and include official EU profile and secondary official sources.
- Microstates should appear in the Associate tier with relationship context.

## Flags

- Map flags are rendered on a canvas layer, not as many DOM image elements.
- Tier chip flags render inline SVG, not image resources.
- The map flag canvas fades in and out when enabled or disabled.
- Tier-list flags should never become monochrome; even when out of focus they
  keep their colors.
- On the map, countries in the active focus scope use colored flags.
- Tiered countries outside the active focus scope may be dimmed but should still
  communicate tier membership.
- Untiered map flags are muted, monochrome, shadowless, and visually secondary.
- Monochrome flag rendering should work in browsers that do not reliably apply
  SVG/CSS filter effects, including iOS Safari.
- Hovering a scene tab or tier card focuses the relevant flags and mutes flags
  outside that scope.
- Hovering an individual tier-list flag focuses only that country, then restores
  the broader tier focus when the pointer returns to the card.
- Hovering a map flag should highlight that flag's country, even if the flag is
  visually over another country's territory.
- Clicking a country should also highlight the corresponding map flag. This is
  important for tiny countries where the country outline is hard to see.
- Map flags should sit on the main landmass for countries with remote
  territories, such as Norway and the United States.
- Map flags shrink in the world view and grow toward full size when zoomed in.
- Some offscreen or out-of-viewport flags may be culled for performance.

## Labels

- Country labels should appear for hovered or selected countries.
- Country labels should not appear for all tier countries at low zoom just
  because a tier button is active or hovered.
- At far zoom levels, country labels may appear broadly.
- Labels should grow as the map zooms in.
- Microstate labels should be smaller than ordinary country labels.
- Labels should render above flags, and flags and labels should render above
  country outline paths.
- When map flags are enabled, labels should sit to the right of the flag.
- Rapidly hovering across flags should let old labels finish fading out instead
  of getting stuck or piling up.

## Editing And Sharing Tiers

- Edit mode enables dragging countries between tier cards.
- Dragging a map flag into a tier card adds that country as a chip.
- Dragging a tier chip between cards moves it and leaves edit mode responsive.
- Dragging a hovered map flag between tiers should still work.
- Drag operations show a drag ghost that tracks the pointer.
- Dropping or finishing a drag should clean up ghost and drop-target states.
- Clearing tiers removes every chip and can be shared.
- Query parameters replace default tier assignments on load.
- Share links encode all tier assignments, including empty tiers.
- Moving a country should update tier classes on the map.

## Touch, Zoom, And Responsive Behavior

- Single-finger drag on mobile must not pan or zoom the map; page scrolling must
  remain possible.
- Two-finger pinch on mobile zooms the map.
- Mobile pinch can zoom beyond the desktop zoom ceiling.
- Mouse wheel zooms the map on desktop.
- Benefit modals keep the close button reachable while content scrolls.
- Mobile modals keep their scroll viewport inside the dialog and can open
  centered even after the page has scrolled.

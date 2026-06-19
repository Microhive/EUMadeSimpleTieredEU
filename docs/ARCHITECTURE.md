# Architecture Notes

This project is a small interactive infographic, so the architecture should stay light. Prefer a few deep modules with clear interfaces over many shallow files.

## Module Shape

**Domain modules** live under `src/domain/`.
They own Tiered Europe concepts such as country identity, aliases, integration tiers, and scenario vocabulary. Domain modules should be usable without the DOM, D3, browser events, or CSS class names.
When mutable scenario rules are domain concepts, such as a **Tier Arrangement**, keep the mutation rules in a domain module and let feature/controller modules decide when to rerender.

**UI render modules** live under `src/ui/`.
They return markup or view data only. They may format text and attributes, but they must not attach event listeners, mutate global state, read from the DOM, call D3, or decide application behavior.

**Feature/controller modules** wire behavior.
They own event listeners, state transitions, drag behavior, map focus, modal opening, and dependency adapters such as `flagImageSrc`.

**The entry module** is `src/main.ts`.
It should stay as a bootstrap file: declare vendor globals, validate required vendor scripts, and start the app through `startTieredEuropeApp`. Do not add feature behavior, D3 orchestration, DOM event listeners, or rendering policy directly to `main.ts`.

## Component Rule

Small UI pieces are render-only. Behavior is injected by the caller after rendering.

Good:

```ts
tierDeck.innerHTML = renderTierDeck({ tiers, capabilityInfoByLabel, flagImageSrc });
tierDeck.querySelectorAll("[data-country]").forEach((button) => {
  button.addEventListener("click", () => activateCountry(button.dataset.country!, true));
});
```

Avoid:

```ts
renderTierDeckAndBindAllBehavior();
```

The exception is a larger feature module whose natural responsibility is behavior, such as tier editing or map navigation. In that case, keep the feature behavior behind a small interface and keep atom-level markup render-only.

## Deep Module Seams

Prefer modules that hide a whole local policy behind a small interface. A good module should give callers leverage and locality: deleting it should make the same complexity reappear in several places, not simply remove a pass-through file.

Good seams in this project:

- **Tier Arrangement**: owns how Countries move between Integration Tiers.
- **Scenario map features**: owns extra editorial geography, Europe clipping, and high-detail feature selection.
- **Canvas map flag layer**: owns flag visibility, hit-testing, image priming, canvas drawing, and dev hitbox metadata.
- **Country drag orchestrator**: owns pointer lifecycle, drag ghosts, Integration Tier drop targets, map-drop cleanup, and suppressed click handling for Country movement.
- **Map visual render queue**: owns requestAnimationFrame coalescing for canvas, flag, and label render requests.
- **Floating tooltip / info modal**: own DOM mechanics for reusable UI behaviour.

Avoid modules that leak implementation details through long callback lists, mutable arrays, D3 selections, canvas contexts, CSS class choreography, or ordering requirements. If a caller must know the module's internal state machine to use it correctly, deepen the module before extracting more files.

## Testing Approach

Prefer behavior tests through the public browser interface. Playwright tests should describe what a viewer or editor can do, not which internal function was called.

Use focused pure tests only when a domain module has enough behavior to justify its own interface. Do not mock internal modules; mock only browser or external seams when needed.

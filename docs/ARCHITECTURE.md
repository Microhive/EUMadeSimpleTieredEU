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

## Testing Approach

Prefer behavior tests through the public browser interface. Playwright tests should describe what a viewer or editor can do, not which internal function was called.

Use focused pure tests only when a domain module has enough behavior to justify its own interface. Do not mock internal modules; mock only browser or external seams when needed.

import type { TierId } from "../domain/tiered-europe";

type CountryDragSource = "chip" | "map-flag";

export interface MapFlagDragSource {
  id: string;
  name: string;
  src: string;
  clientX: number;
  clientY: number;
}

interface CountryDragState {
  pointerId: number;
  countryId: string;
  sourceElement: HTMLElement;
  source: CountryDragSource;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  hasMoved: boolean;
  ghost: HTMLElement | null;
  dropTier: HTMLElement | null;
  dropOnMap: boolean;
  sourceRect: DOMRectReadOnly;
  sourceImageSrc?: string;
  sourceName?: string;
}

interface CountryDragOrchestratorOptions {
  tierDeck: HTMLElement;
  mapWrap: HTMLElement;
  mapFlagLayer: HTMLElement;
  dragThresholdPx: number;
  mapFlagSizePx: number;
  mapFlagImageSizePx: number;
  isEditMode: () => boolean;
  activateCountry: (countryId: string) => void;
  moveCountryToTier: (countryId: string, targetTierId: TierId) => boolean;
  removeCountryFromTier: (countryId: string) => boolean;
  onTierArrangementChanged: () => void;
  setMapFlagDragging: (countryId: string | null) => boolean;
  onMapFlagDragStateChanged: () => void;
}

export interface CountryDragOrchestrator {
  startChipDrag(button: HTMLButtonElement, event: PointerEvent): void;
  startMapFlagDrag(flag: MapFlagDragSource, event: PointerEvent): void;
  cancel(): void;
  clearDropTargets(): void;
  isDragging(): boolean;
  consumeSuppressedClick(countryId: string): boolean;
}

export function createCountryDragOrchestrator({
  tierDeck,
  mapWrap,
  mapFlagLayer,
  dragThresholdPx,
  mapFlagSizePx,
  mapFlagImageSizePx,
  isEditMode,
  activateCountry,
  moveCountryToTier,
  removeCountryFromTier,
  onTierArrangementChanged,
  setMapFlagDragging,
  onMapFlagDragStateChanged,
}: CountryDragOrchestratorOptions): CountryDragOrchestrator {
  let countryDragState: CountryDragState | null = null;
  let suppressedClickCountryId: string | null = null;

  return {
    startChipDrag,
    startMapFlagDrag,
    cancel,
    clearDropTargets,
    isDragging: () => countryDragState !== null,
    consumeSuppressedClick,
  };

  function startChipDrag(button: HTMLButtonElement, event: PointerEvent): void {
    startCountryDrag(button, button.dataset.country!, "chip", event);
  }

  function startMapFlagDrag(flag: MapFlagDragSource, event: PointerEvent): void {
    const sourceRect = new DOMRectReadOnly(
      flag.clientX - mapFlagSizePx / 2,
      flag.clientY - mapFlagSizePx / 2,
      mapFlagSizePx,
      mapFlagSizePx,
    );

    startCountryDrag(mapFlagLayer, flag.id, "map-flag", event, {
      sourceImageSrc: flag.src,
      sourceName: flag.name,
      sourceRect,
    });
  }

  function startCountryDrag(
    sourceElement: HTMLElement,
    countryId: string,
    source: CountryDragSource,
    event: PointerEvent,
    options: {
      sourceImageSrc?: string;
      sourceName?: string;
      sourceRect?: DOMRectReadOnly;
    } = {},
  ): void {
    if (!isEditMode()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    cancel();

    const rect = options.sourceRect ?? sourceElement.getBoundingClientRect();
    countryDragState = {
      pointerId: event.pointerId,
      countryId,
      sourceElement,
      source,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      hasMoved: false,
      ghost: null,
      dropTier: null,
      dropOnMap: false,
      sourceRect: rect,
      sourceImageSrc: options.sourceImageSrc,
      sourceName: options.sourceName,
    };

    sourceElement.focus({ preventScroll: true });
    sourceElement.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent): void {
    const drag = countryDragState;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance < dragThresholdPx) return;

    event.preventDefault();

    if (!drag.hasMoved) {
      beginDragVisuals(drag);
    }

    positionDragGhost(drag, event.clientX, event.clientY);
    updateDropTarget(drag, event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent): void {
    const drag = countryDragState;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const didDrag = drag.hasMoved;
    if (didDrag) {
      event.preventDefault();
      updateDropTarget(drag, event.clientX, event.clientY);
    }

    const countryId = drag.countryId;
    const source = drag.source;
    const targetTierId = drag.dropTier?.dataset.tier as TierId | undefined;
    const dropOnMap = drag.dropOnMap;
    cleanup();

    if (!didDrag) {
      activateCountry(countryId);
      suppressNextClick(countryId);
      return;
    }

    suppressNextClick(countryId);

    if (targetTierId && moveCountryToTier(countryId, targetTierId)) {
      onTierArrangementChanged();
      return;
    }

    if (source === "chip" && dropOnMap && removeCountryFromTier(countryId)) {
      onTierArrangementChanged();
    }
  }

  function handlePointerCancel(event: PointerEvent): void {
    const drag = countryDragState;
    if (!drag || drag.pointerId !== event.pointerId) return;
    cleanup();
  }

  function beginDragVisuals(drag: CountryDragState): void {
    drag.hasMoved = true;

    const rect = drag.sourceRect;
    const ghost = drag.source === "map-flag"
      ? createMapFlagDragGhost(drag)
      : drag.sourceElement.cloneNode(true) as HTMLElement;
    ghost.classList.add(
      "country-drag-ghost",
      drag.source === "chip" ? "country-chip-drag-ghost" : "map-flag-drag-ghost",
    );
    ghost.classList.remove("is-dragging");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("tabindex", "-1");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;

    if (drag.source === "map-flag" && setMapFlagDragging(drag.countryId)) {
      onMapFlagDragStateChanged();
    }

    if (drag.source === "chip") {
      drag.sourceElement.classList.add("is-dragging");
      drag.sourceElement.setAttribute("aria-grabbed", "true");
    }
  }

  function createMapFlagDragGhost(drag: CountryDragState): HTMLElement {
    const ghost = document.createElement("span");
    ghost.className = "map-flag";
    ghost.dataset.country = drag.countryId;
    ghost.setAttribute("aria-label", drag.sourceName ?? drag.countryId);
    ghost.title = drag.sourceName ?? drag.countryId;

    if (drag.sourceImageSrc) {
      const image = document.createElement("img");
      image.src = drag.sourceImageSrc;
      image.width = mapFlagImageSizePx;
      image.height = mapFlagImageSizePx;
      image.alt = "";
      image.draggable = false;
      ghost.appendChild(image);
    }

    return ghost;
  }

  function positionDragGhost(drag: CountryDragState, clientX: number, clientY: number): void {
    if (!drag.ghost) return;
    drag.ghost.style.transform = `translate3d(${clientX - drag.offsetX}px, ${clientY - drag.offsetY}px, 0)`;
  }

  function updateDropTarget(drag: CountryDragState, clientX: number, clientY: number): void {
    const target = document.elementFromPoint(clientX, clientY);
    const dropTier = target?.closest<HTMLElement>(".tier-card") ?? null;
    const dropOnMap = !dropTier && Boolean(target?.closest(".map-wrap"));

    drag.dropTier = dropTier;
    drag.dropOnMap = dropOnMap;

    tierCards().forEach((card) => {
      card.classList.toggle("is-drop-target", card === dropTier);
    });
    mapWrap.classList.toggle("is-map-drop-target", dropOnMap);
  }

  function cancel(): void {
    if (!countryDragState) {
      clearDropTargets();
      return;
    }

    cleanup();
  }

  function cleanup(): void {
    const drag = countryDragState;
    if (!drag) return;

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);

    try {
      if (drag.sourceElement.hasPointerCapture?.(drag.pointerId)) {
        drag.sourceElement.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The source element may have been detached by a rerender.
    }

    if (drag.source === "chip") {
      drag.sourceElement.classList.remove("is-dragging");
      drag.sourceElement.setAttribute("aria-grabbed", "false");
    } else if (setMapFlagDragging(null)) {
      onMapFlagDragStateChanged();
    }

    drag.ghost?.remove();
    countryDragState = null;
    clearDropTargets();
  }

  function clearDropTargets(): void {
    tierCards().forEach((card) => card.classList.remove("is-drop-target"));
    mapWrap.classList.remove("is-map-drop-target");
  }

  function tierCards(): HTMLElement[] {
    return [...tierDeck.querySelectorAll<HTMLElement>(".tier-card")];
  }

  function suppressNextClick(countryId: string): void {
    suppressedClickCountryId = countryId;
    window.setTimeout(() => {
      if (suppressedClickCountryId === countryId) {
        suppressedClickCountryId = null;
      }
    }, 0);
  }

  function consumeSuppressedClick(countryId: string): boolean {
    if (suppressedClickCountryId !== countryId) return false;

    suppressedClickCountryId = null;
    return true;
  }
}

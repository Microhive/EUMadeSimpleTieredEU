import {
  canonicalCountryId,
  countryIdsFor,
  flagCodeFor,
  isAliasCountryId,
  selectedCountrySet,
} from "../domain/country-identity";
import { createTierArrangement } from "../domain/tier-arrangement";
import { ISO2_BY_NUMERIC } from "../domain/country-flag-codes";
import {
  benefitIconSvgById,
  benefitPills,
  capabilityInfoByLabel,
  tiers,
} from "../domain/tiered-europe-scenario";
import type {
  CountryEntry,
  CountryMeta,
  SceneKey,
  TierId,
} from "../domain/tiered-europe";
import { createFloatingTooltip } from "../ui/floating-tooltip";
import { createInfoModal } from "../ui/info-modal";
import { setupSceneTabsScale } from "../ui/scene-tabs-scale";
import {
  renderBenefitPills as renderBenefitPillsMarkup,
  renderCountryCardForCountry as renderCountryCardForCountryMarkup,
  renderCountryCardForScene as renderCountryCardForSceneMarkup,
  renderCountryCardForTier as renderCountryCardForTierMarkup,
  renderCountryGrid,
  renderLegend as renderLegendMarkup,
  renderTierDeck,
} from "../ui/tiered-europe-rendering";
import { createCanvasCountryLayer } from "../map/canvas-country-layer";
import {
  createCanvasMapFlagLayer,
  type MapFlagDatum,
} from "../map/canvas-map-flag-layer";
import {
  SCENARIO_FEATURE_TIER,
  clipFeatureToEurope,
  firstFeatureByKey,
  keyForFeature,
} from "../map/scenario-map-features";
import {
  createMapVisualRenderQueue,
  type MapVisualRenderOptions,
  type MapVisualRenderRequest,
} from "../map/map-visual-render-queue";
import { loadScenarioMapFeatureSets } from "../map/topology-loader";
import { createCountryDragOrchestrator } from "./country-drag-orchestrator";

interface StartTieredEuropeAppOptions {
  d3: any;
  topojson: any;
}

export function startTieredEuropeApp({ d3, topojson }: StartTieredEuropeAppOptions): void {
  // ─── app types ────────────────────────────────────────────────────────────────

  interface GeometryLayout {
    bounds: [[number, number], [number, number]];
    centroid: [number, number];
  }

  interface LabelDatum {
    id: string;
    text: string;
    centroid: [number, number];
    isRaised: boolean;
  }

  interface FitOptions {
    bottomPad?: number;
    topPad?: number;
    europeOnly?: boolean;
  }

  interface CardRenderOptions {
    reveal?: boolean;
  }

  interface AppState {
    features: any[];
    visualFeatures: any[];
    featureByKey: Map<string, any>;
    visualFeatureByKey: Map<string, any>;
    activeTier: TierId | null;
    activeCountry: string | null;
    hoveredCountry: string | null;
    selectedIds: Set<string>;
    scene: SceneKey;
    editMode: boolean;
    mapFlagsMode: boolean;
    userTouched: boolean;
  }


  // ─── constants ────────────────────────────────────────────────────────────────

  const ZOOM_WHEEL_DELTA_MULTIPLIER = 0.86;
  const DESKTOP_MAX_ZOOM_SCALE = 12;
  const MOBILE_MAX_ZOOM_SCALE = 16;
  const FIT_MAX_ZOOM_SCALE = 10;
  const LABEL_MIN_SCREEN_SCALE = 0.52;

  const CIRCLE_FLAG_SVGS: Record<string, string> = import.meta.glob(
    "../../node_modules/circle-flags/flags/*.svg",
    { eager: true, import: "default", query: "?url" },
  );

  const PUBLIC_BASE_URL = import.meta.env.BASE_URL;
  const COUNTRY_LIFT_TRANSFORM = "translate(-1, -0.75)";
  const CHIP_DRAG_START_THRESHOLD_PX = 4;

  // ─── derived lookups ──────────────────────────────────────────────────────────

  const tierArrangement = createTierArrangement(tiers);

  // ─── state ────────────────────────────────────────────────────────────────────

  const state: AppState = {
    features: [],
    visualFeatures: [],
    featureByKey: new Map(),
    visualFeatureByKey: new Map(),
    activeTier: null,
    activeCountry: null,
    hoveredCountry: null,
    selectedIds: new Set(),
    scene: "world",
    editMode: false,
    mapFlagsMode: false,
    userTouched: false,
  };

  applyTierAssignmentsFromQuery();

  // ─── DOM references ───────────────────────────────────────────────────────────

  const svg = d3.select("#mapSvg");
  const tierDeck = document.querySelector<HTMLElement>("#tierDeck")!;
  const sceneTabs = document.querySelector<HTMLElement>("#sceneTabs")!;
  const legend = document.querySelector<HTMLElement>("#legend")!;
  const countryCard = document.querySelector<HTMLElement>("#countryCard")!;
  const mapWrap = document.querySelector<HTMLElement>(".map-wrap")!;
  const sources = document.querySelector<HTMLElement>("#sources")!;
  const sourcesMobileMount = document.querySelector<HTMLElement>("#sourcesMobileMount")!;
  const editToggle = document.querySelector<HTMLButtonElement>("#editToggle")!;
  const editToolbar = document.querySelector<HTMLElement>("#editToolbar")!;
  const resetTiersButton = document.querySelector<HTMLButtonElement>("#resetTiersButton")!;
  const clearTiersButton = document.querySelector<HTMLButtonElement>("#clearTiersButton")!;
  const shareTiersButton = document.querySelector<HTMLButtonElement>("#shareTiersButton")!;
  const mapFlagsButton = document.querySelector<HTMLButtonElement>("#mapFlagsButton")!;
  const videoLink = document.querySelector<HTMLElement>(".video-link")!;
  const benefitModal = document.querySelector<HTMLDialogElement>("#benefitModal")!;
  const floatingTooltip = createFloatingTooltip({ resolveAssetSrc: publicAssetSrc });
  const showPillTooltip = floatingTooltip.show;
  const hidePillTooltip = floatingTooltip.hide;
  const openInfoModal = createInfoModal(benefitModal).open;
  const mapLoadingStars = document.querySelector<HTMLElement>("#mapLoadingStars")!;
  const mapCanvas = document.createElement("canvas");
  const mapFlagCanvas = document.createElement("canvas");
  const mapFlagLayer = document.createElement("div");

  mapCanvas.className = "map-canvas";
  mapCanvas.setAttribute("aria-hidden", "true");
  mapWrap.insertBefore(mapCanvas, svg.node() as SVGSVGElement);
  mapFlagCanvas.className = "map-flag-canvas";
  mapFlagCanvas.setAttribute("aria-hidden", "true");
  mapWrap.insertBefore(mapFlagCanvas, countryCard);
  mapFlagLayer.className = "map-flag-layer";
  mapFlagLayer.setAttribute("aria-label", "Country flags");
  mapFlagLayer.setAttribute("aria-hidden", "true");
  mapWrap.appendChild(mapFlagLayer);
  const EDIT_TOOLTIP_IDLE =
    "Edit the scenario tiers. Turn this on to drag country flags between tier cards and try a different arrangement.";
  const EDIT_TOOLTIP_ACTIVE =
    "Editing is on. Drag country flags between tier cards, then choose Done when the arrangement feels right.";
  const SHARE_TIERS_TOOLTIP_IDLE =
    "Copy a share link that preserves the current tier arrangement.";
  let shareFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── d3 / map setup ───────────────────────────────────────────────────────────

  const projection = d3.geoNaturalEarth1();
  const path = d3.geoPath(projection).pointRadius(4.8);
  const graticule = d3.geoGraticule10();
  function mapWheelDelta(event: any): number {
    const modeScale = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
    return -event.deltaY * modeScale * (event.ctrlKey ? 10 : 1) * ZOOM_WHEEL_DELTA_MULTIPLIER;
  }

  function maxMapZoomScale(): number {
    return window.matchMedia("(max-width: 720px), (pointer: coarse)").matches
      ? MOBILE_MAX_ZOOM_SCALE
      : DESKTOP_MAX_ZOOM_SCALE;
  }

  function syncZoomScaleExtent(): void {
    zoom.scaleExtent([1, maxMapZoomScale()]);
  }

  const zoom = d3.zoom()
    .scaleExtent([1, maxMapZoomScale()])
    .wheelDelta(mapWheelDelta)
    .filter((event: any) => {
      if (countryDrag.isDragging()) return false;
      if (state.editMode && event.type !== "wheel" && isEventOnMapFlag(event)) {
        return false;
      }
      if (event.touches !== undefined) {
        return event.touches.length >= 2;
      }
      return (!event.ctrlKey || event.type === "wheel") && !event.button;
    })
    .on("zoom", onZoom);
  const DESKTOP_LABEL_PX = 22;
  const COMPACT_LABEL_PX = 14;
  const NARROW_LABEL_PX = 12;
  const MAP_FLAG_SIZE_PX = 30;
  const MAP_FLAG_IMAGE_SIZE_PX = 24;
  const MAP_FLAG_HIT_RADIUS_PX = 20;
  const COUNTRY_LABEL_FLAG_GAP_PX = 8;
  const MAP_RESIZE_EPSILON_PX = 2;
  const MAP_FLAG_VIEWPORT_BUFFER_PX = 48;
  const countryCanvas = createCanvasCountryLayer({
    canvas: mapCanvas,
    d3,
    projection,
    pointRadius: 4.8,
    keyForFeature,
    tierForFeature,
    countryIdsFor,
  });
  const mapFlags = createCanvasMapFlagLayer({
    canvas: mapFlagCanvas,
    layer: mapFlagLayer,
    mapWrap,
    flagImageSrc,
    badgeSize: MAP_FLAG_SIZE_PX,
    imageSize: MAP_FLAG_IMAGE_SIZE_PX,
    hitRadius: MAP_FLAG_HIT_RADIUS_PX,
    viewportBuffer: MAP_FLAG_VIEWPORT_BUFFER_PX,
    onImageReady: () => queueMapFlagRender(),
  });
  const countryDrag = createCountryDragOrchestrator({
    tierDeck,
    mapWrap,
    mapFlagLayer,
    dragThresholdPx: CHIP_DRAG_START_THRESHOLD_PX,
    mapFlagSizePx: MAP_FLAG_SIZE_PX,
    mapFlagImageSizePx: MAP_FLAG_IMAGE_SIZE_PX,
    isEditMode: () => state.editMode,
    activateCountry: (countryId) => activateCountry(countryId, true),
    moveCountryToTier,
    removeCountryFromTier,
    onTierArrangementChanged: refreshTierStateAfterMove,
    setMapFlagDragging: (countryId) => mapFlags.setDragging(countryId),
    onMapFlagDragStateChanged: () => queueMapFlagRender(),
  });
  const mapVisuals = createMapVisualRenderQueue<any>({
    currentTransform: currentZoomTransform,
    render: applyMapVisualRender,
  });

  let mapLayer: any = null;
  let countryLayer: any = null;
  let hoverLayer: any = null;
  let labelLayer: any = null;
  let tierCardElements: HTMLElement[] = [];
  let countryChipElements: HTMLButtonElement[] = [];
  let geometryCache = new Map<string, GeometryLayout>();
  let highDetailFeatureByKey = new Map<string, any>();
  let width = 0;
  let height = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let mapResizeObserver: ResizeObserver | null = null;
  let sourcesResizeObserver: ResizeObserver | null = null;
  let tierDeckInteractionsBound = false;

  // ─── init ─────────────────────────────────────────────────────────────────────
  buildBenefitPills();
  buildTierCards();
  buildLegend();
  setupEditToggleTooltip();
  setupEditToolbar();
  setupMapFlagsButton();
  setupMapFlagLayerInteractions();
  setupSourcesPlacement();
  setupVideoTooltip();
  setupSceneTabsScale(sceneTabs);
  loadMap();
  // ─── benefit pill functions ───────────────────────────────────────────────────────────────────────────

  function setupEditToggleTooltip(): void {
    if (!window.matchMedia("(hover: hover)").matches) return;
    editToggle.addEventListener("mouseenter", () => showPillTooltip(editToggle));
    editToggle.addEventListener("mouseleave", () => hidePillTooltip());
    editToggle.addEventListener("focus", () => showPillTooltip(editToggle));
    editToggle.addEventListener("blur", () => hidePillTooltip());
  }

  function setupEditToolbar(): void {
    const canHover = window.matchMedia("(hover: hover)").matches;
    editToolbar.querySelectorAll<HTMLElement>("[data-tooltip]").forEach((button) => {
      if (!canHover) return;
      button.addEventListener("mouseenter", () => showPillTooltip(button));
      button.addEventListener("mouseleave", () => hidePillTooltip());
      button.addEventListener("focus", () => showPillTooltip(button));
      button.addEventListener("blur", () => hidePillTooltip());
    });

    resetTiersButton.addEventListener("click", () => {
      hidePillTooltip();
      resetTierAssignments();
    });

    clearTiersButton.addEventListener("click", () => {
      hidePillTooltip();
      clearTierAssignments();
    });

    shareTiersButton.addEventListener("click", () => {
      void copyTierShareUrl();
    });
  }

  function setupMapFlagsButton(): void {
    mapFlagsButton.addEventListener("click", () => {
      setMapFlagsMode(!state.mapFlagsMode);
    });

    mapFlagsButton.addEventListener("mouseenter", restoreScenePreview);
  }

  function setupMapFlagLayerInteractions(): void {
    mapWrap.addEventListener("pointerdown", onMapFlagPointerDown, { capture: true });
    mapWrap.addEventListener("pointermove", onMapFlagPointerMove, { capture: true });
    mapWrap.addEventListener("pointerleave", clearMapFlagHover);
    mapWrap.addEventListener("click", onMapFlagClick, { capture: true });
  }

  function setupSourcesPlacement(): void {
    const desktopSourcesQuery = window.matchMedia("(min-width: 1280px)");
    const syncSourcesPlacement = (): void => {
      const shouldDockSources = desktopSourcesQuery.matches;

      if (shouldDockSources && sources.parentElement !== mapWrap) {
        mapWrap.appendChild(sources);
      } else if (!shouldDockSources && sources.nextElementSibling !== sourcesMobileMount) {
        sourcesMobileMount.parentElement?.insertBefore(sources, sourcesMobileMount);
      }

      document.body.classList.toggle("has-map-sources-docked", shouldDockSources);
      updateSourcesOffset();
    };

    desktopSourcesQuery.addEventListener("change", syncSourcesPlacement);
    window.addEventListener("resize", updateSourcesOffset);

    if (typeof ResizeObserver !== "undefined") {
      sourcesResizeObserver = new ResizeObserver(updateSourcesOffset);
      sourcesResizeObserver.observe(sources);
    }

    syncSourcesPlacement();
  }

  function updateSourcesOffset(): void {
    if (sources.parentElement !== mapWrap) {
      mapWrap.style.setProperty("--map-disclaimer-offset", "0px");
      return;
    }

    const offset = Math.ceil(sources.getBoundingClientRect().height + 14);
    mapWrap.style.setProperty("--map-disclaimer-offset", `${offset}px`);
  }

  function onMapFlagPointerDown(event: PointerEvent): void {
    if (!state.editMode) return;
    const flag = mapFlags.hitTest(event.clientX, event.clientY);
    if (!flag) return;

    event.preventDefault();
    event.stopPropagation();
    countryDrag.startMapFlagDrag(flag, event);
  }

  function onMapFlagPointerMove(event: PointerEvent): void {
    if (countryDrag.isDragging()) return;

    const flag = mapFlags.hitTest(event.clientX, event.clientY);
    if (!flag) {
      clearMapFlagHover();
      return;
    }

    if (!mapFlags.setHovered(flag.id)) return;
    setHoveredCountry(flag.id);
  }

  function onMapFlagClick(event: MouseEvent): void {
    const flag = mapFlags.hitTest(event.clientX, event.clientY);
    if (!flag) return;

    event.preventDefault();
    event.stopPropagation();
    activateMapFlag(flag.id);
  }

  function activateMapFlag(countryId: string): void {
    if (countryDrag.consumeSuppressedClick(countryId)) return;

    const meta = metaForCountry(countryId);
    if (meta) activateCountry(meta.id, true);
  }

  function clearMapFlagHover(): void {
    const clearedId = mapFlags.clearHover();
    if (!clearedId) return;

    if (state.hoveredCountry === canonicalCountryId(clearedId)) {
      clearHoveredCountry();
    } else {
      queueMapFlagRender();
    }
  }

  function setupVideoTooltip(): void {
    if (!window.matchMedia("(hover: hover)").matches) return;
    videoLink.addEventListener("mouseenter", () => showPillTooltip(videoLink));
    videoLink.addEventListener("mouseleave", () => hidePillTooltip(260));
    videoLink.addEventListener("focus", () => showPillTooltip(videoLink));
    videoLink.addEventListener("blur", () => hidePillTooltip());
    videoLink.addEventListener("click", () => hidePillTooltip());
  }

  function buildBenefitPills(): void {
    const container = document.querySelector<HTMLElement>("#benefitPills")!;
    if (!container.querySelector(".benefit-pill")) {
      container.innerHTML = renderBenefitPillsMarkup(benefitPills, benefitIconSvgById);
    }

    const canHover = window.matchMedia("(hover: hover)").matches;

    container.querySelectorAll<HTMLButtonElement>(".benefit-pill").forEach((btn) => {
      if (canHover) {
        btn.addEventListener("mouseenter", () => showPillTooltip(btn));
        btn.addEventListener("mouseleave", () => hidePillTooltip());
        btn.addEventListener("focus", () => showPillTooltip(btn));
        btn.addEventListener("blur", () => hidePillTooltip());
      }
      btn.addEventListener("click", () => {
        hidePillTooltip();
        const pill = benefitPills.find((p) => p.id === btn.dataset.pill)!;
        openInfoModal({
          eyebrow: "Core principle",
          title: pill.title,
          modalTitle: pill.modalTitle,
          modalBody: pill.modalBody,
          keyIdea: pill.keyIdea,
          caveat: pill.caveat,
        });
      });
    });

  }
  // ─── helpers ──────────────────────────────────────────────────────────────────

  function applyTierAssignmentsFromQuery(): boolean {
    return tierArrangement.applyQuery(window.location.search, resolveCountryEntry);
  }

  function resolveCountryEntry(countryId: string): CountryEntry | null {
    const canonicalId = canonicalCountryId(countryId);
    const code = ISO2_BY_NUMERIC[canonicalId];
    if (!code || !flagImageSrc(code)) return null;

    const feature = visualFeatureForCountry(canonicalId) ?? state.featureByKey.get(canonicalId);
    const name = feature?.properties?.name ?? canonicalId;
    return [canonicalId, code, name];
  }

  function hydrateCountryCatalogFromFeatures(features: any[]): void {
    const entries = features
      .map((feature): CountryEntry | null => {
        const id = keyForFeature(feature);
        if (isAliasCountryId(id)) return null;

        const code = ISO2_BY_NUMERIC[id];
        const name = feature.properties?.name ?? id;
        if (!code || !flagImageSrc(code)) return null;

        return [id, code, name];
      })
      .filter((entry): entry is CountryEntry => entry !== null);

    tierArrangement.rememberCountryEntries(entries);
  }

  function idsFor(...tierIds: TierId[]): string[] {
    return tierArrangement.idsFor(...tierIds);
  }

  function cumulativeIdsFor(tierId: TierId): string[] {
    return tierArrangement.sceneIdsFor(tierId) ?? [];
  }

  function sceneIdsFor(scene: SceneKey): string[] | null {
    return tierArrangement.sceneIdsFor(scene);
  }

  function tierForFeature(feature: any): TierId | undefined {
    const key = keyForFeature(feature);
    return tierArrangement.directTierForCountry(key) ?? (isAliasCountryId(key) ? undefined : SCENARIO_FEATURE_TIER.get(key));
  }

  function countryClassForFeature(feature: any): string {
    const tierId = tierForFeature(feature);
    return `country${tierId ? ` tier-${tierId}` : ""}`;
  }

  function renderQualityForFeature(feature: any): "high" | "standard" {
    return highDetailFeatureByKey.get(String(keyForFeature(feature))) === feature ? "high" : "standard";
  }

  function visualFeatureForCountry(countryId: string): any | undefined {
    return state.visualFeatureByKey.get(canonicalCountryId(countryId));
  }

  function metaForCountry(countryId: string): CountryMeta | undefined {
    return tierArrangement.metaForCountry(countryId);
  }

  function flagImageSrc(code: string): string {
    return CIRCLE_FLAG_SVGS[`../../node_modules/circle-flags/flags/${flagCodeFor(code)}.svg`] ?? "";
  }

  function publicAssetSrc(assetPath: string): string {
    if (
      /^(?:https?:)?\/\//.test(assetPath) ||
      assetPath.startsWith("data:") ||
      assetPath.startsWith("blob:")
    ) {
      return assetPath;
    }
    return `${PUBLIC_BASE_URL}${assetPath.replace(/^\/+/, "")}`;
  }

  function tierCountryIdsForInteraction(): Set<string> {
    return tierArrangement.countryIdsForInteraction(window.location.search);
  }

  function layoutForFeature(feature: any): GeometryLayout | null {
    const key = keyForFeature(feature);
    const cached = geometryCache.get(key);
    if (cached) return cached;

    const centroid: [number, number] = path.centroid(feature);
    if (!centroid || centroid.some(Number.isNaN)) return null;

    const bounds = path.bounds(feature);
    const layout: GeometryLayout = { bounds, centroid };
    geometryCache.set(key, layout);
    return layout;
  }

  function setEditMode(nextEditMode: boolean): void {
    state.editMode = nextEditMode;
    syncEditModeControls();
  }

  function setMapFlagsMode(nextMapFlagsMode: boolean): void {
    state.mapFlagsMode = nextMapFlagsMode;
    syncMapFlagsControls();
    renderMapFlags();
    drawLabels();
  }

  function syncEditModeControls(): void {
    document.body.classList.toggle("is-editing-tiers", state.editMode);
    editToggle.classList.toggle("is-active", state.editMode);
    editToggle.setAttribute("aria-pressed", String(state.editMode));
    editToggle.setAttribute("aria-label", state.editMode ? "Finish editing tiers" : "Edit tiers");
    editToggle.dataset.tooltip = state.editMode ? EDIT_TOOLTIP_ACTIVE : EDIT_TOOLTIP_IDLE;
    editToggle.querySelector<HTMLElement>(".edit-toggle-label")!.textContent =
      state.editMode ? "Done" : "Edit";
    editToolbar.setAttribute("aria-hidden", String(!state.editMode));
    editToolbar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = !state.editMode;
    });

    countryChipElements.forEach((chip) => {
      chip.draggable = false;
      chip.setAttribute("aria-grabbed", "false");
    });

    tierCardElements.forEach((card) => {
      card.classList.toggle("can-drop-country", state.editMode);
      card.classList.remove("is-drop-target");
    });

    countryDrag.clearDropTargets();

    if (!state.editMode) {
      countryDrag.cancel();
    }

    syncMapFlagsControls();
    renderMapFlags();
  }

  function syncMapFlagsControls(): void {
    mapFlagsButton.classList.toggle("is-active", state.mapFlagsMode);
    mapFlagsButton.setAttribute("aria-pressed", String(state.mapFlagsMode));
    mapFlagsButton.setAttribute(
      "aria-label",
      state.mapFlagsMode ? "Hide country flags on the map" : "Show country flags on the map",
    );
    mapFlagsButton.title = state.mapFlagsMode
      ? "Hide country flags on the map"
      : "Show country flags on the map";
  }

  function resetTierAssignments(): void {
    tierArrangement.reset();
    refreshTierStateAfterMove();
  }

  function clearTierAssignments(): void {
    tierArrangement.clear();
    refreshTierStateAfterMove();
  }

  function tierShareUrl(): string {
    return tierArrangement.shareUrl(window.location.href);
  }

  async function copyTierShareUrl(): Promise<void> {
    const shareUrl = tierShareUrl();
    let copied = false;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable.");
      }
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      copied = copyTextFallback(shareUrl);
    }

    setShareButtonFeedback(copied);
  }

  function copyTextFallback(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }

    return copied;
  }

  function setShareButtonFeedback(copied: boolean): void {
    if (shareFeedbackTimer) clearTimeout(shareFeedbackTimer);

    shareTiersButton.classList.toggle("is-copied", copied);
    shareTiersButton.dataset.tooltip = copied
      ? "Share link copied."
      : "Could not copy the share link.";
    shareTiersButton.setAttribute(
      "aria-label",
      copied ? "Share link copied" : "Copy share link for current tiers",
    );

    if (shareTiersButton.matches(":hover, :focus-visible")) {
      showPillTooltip(shareTiersButton);
    }

    shareFeedbackTimer = window.setTimeout(() => {
      shareTiersButton.classList.remove("is-copied");
      shareTiersButton.dataset.tooltip = SHARE_TIERS_TOOLTIP_IDLE;
      shareTiersButton.setAttribute("aria-label", "Copy share link for current tiers");
    }, 1800);
  }

  function moveCountryToTier(countryId: string, targetTierId: TierId): boolean {
    return tierArrangement.moveCountryToTier(countryId, targetTierId);
  }

  function removeCountryFromTier(countryId: string): boolean {
    return tierArrangement.removeCountry(countryId);
  }

  function refreshTierStateAfterMove(): void {
    buildTierCards();
    syncEditModeControls();
    refreshCountryTierClasses();

    if (state.activeCountry) {
      const meta = metaForCountry(state.activeCountry);
      if (meta) {
        state.activeTier = activeTierForScene() ?? meta.tier;
        state.selectedIds = selectedCountrySet(countryIdsFor(state.activeCountry));
        renderCountryCardForCountry(meta);
      } else {
        state.activeCountry = null;
      }
    }

    if (!state.activeCountry && state.activeTier) {
      state.selectedIds = selectedCountrySet(cumulativeIdsFor(state.activeTier));
      renderCountryCardForTier(state.activeTier);
    } else if (!state.activeCountry) {
      state.selectedIds = selectedCountrySet(sceneIdsFor(state.scene) ?? cumulativeIdsFor("friends"));
    }

    updateHighlights();
    renderMapFlags();
    drawConnections();
  }

  function refreshCountryTierClasses(): void {
    if (!countryLayer) return;

    countryLayer
      .selectAll(".country")
      .attr("class", countryClassForFeature)
      .attr("data-tier", (feature: any) => tierForFeature(feature) ?? "")
      .attr("data-quality", renderQualityForFeature);
    drawLiftedCountries();
  }

  // ─── render functions ─────────────────────────────────────────────────────────

  function buildTierCards(): void {
    if (!hasRenderableTierShell()) {
      tierDeck.innerHTML = renderTierDeck({ tiers, capabilityInfoByLabel, flagImageSrc });
    } else {
      syncTierCountryGrids();
    }

    tierCardElements = [...tierDeck.querySelectorAll<HTMLElement>(".tier-card")];
    countryChipElements = [...tierDeck.querySelectorAll<HTMLButtonElement>("[data-country]")];
    syncCapabilityMetadata();
    primeCountryFlagImageStates();
    bindTierDeckInteractions();
    syncEditModeControls();
  }

  function hasRenderableTierShell(): boolean {
    return tiers.every((tier) => {
      const card = tierDeck.querySelector<HTMLElement>(`.tier-card[data-tier="${tier.id}"]`);
      return Boolean(card?.querySelector(".country-grid"));
    });
  }

  function syncTierCountryGrids(): void {
    tiers.forEach((tier) => {
      const grid = tierDeck.querySelector<HTMLElement>(`.tier-card[data-tier="${tier.id}"] .country-grid`);
      if (!grid) return;
      grid.innerHTML = renderCountryGrid(tier, flagImageSrc);
      grid.removeAttribute("aria-label");
    });
  }

  function syncCapabilityMetadata(): void {
    tierDeck.querySelectorAll<HTMLElement>("[data-cap-key]").forEach((button) => {
      const info = capabilityInfoByLabel.get(button.dataset.capKey!);
      if (info) button.dataset.tooltip = info.tooltip;
    });
  }

  function bindTierDeckInteractions(): void {
    if (tierDeckInteractionsBound) return;
    tierDeckInteractionsBound = true;

    tierDeck.addEventListener("mouseover", (event: MouseEvent) => {
      const target = event.target as Element;
      const chip = target.closest<HTMLButtonElement>("[data-country]");
      if (chip?.dataset.country) {
        activateCountry(chip.dataset.country, false);
        return;
      }

      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        showPillTooltip(capability);
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card?.dataset.tier) previewTier(card.dataset.tier as TierId);
    });

    tierDeck.addEventListener("focusin", (event: FocusEvent) => {
      const target = event.target as Element;
      const chip = target.closest<HTMLButtonElement>("[data-country]");
      if (chip?.dataset.country) {
        activateCountry(chip.dataset.country, false);
        return;
      }

      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        showPillTooltip(capability);
        return;
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card?.dataset.tier) previewTier(card.dataset.tier as TierId);
    });

    tierDeck.addEventListener("focusout", (event: FocusEvent) => {
      const capability = (event.target as Element).closest<HTMLElement>("[data-cap-key]");
      if (capability) hidePillTooltip();
    });

    tierDeck.addEventListener("mouseout", (event: MouseEvent) => {
      const target = event.target as Element;
      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        hidePillTooltip();
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card && !card.contains(event.relatedTarget as Node | null)) {
        clearSoftFocus();
      }
    });

    tierDeck.addEventListener("click", (event: MouseEvent) => {
      const target = event.target as Element;
      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability) {
        event.stopPropagation();
        hidePillTooltip();
        const info = capabilityInfoByLabel.get(capability.dataset.capKey!);
        if (info) openInfoModal({
          eyebrow: "Tier capability",
          title: info.label,
          modalTitle: info.modalTitle,
          modalBody: info.modalBody,
          keyIdea: info.keyIdea,
          caveat: info.caveat,
        });
        return;
      }

      const chip = target.closest<HTMLButtonElement>("[data-country]");
      if (!chip?.dataset.country) return;
      if (countryDrag.consumeSuppressedClick(chip.dataset.country)) return;

      activateCountry(chip.dataset.country, true);
    });

    tierDeck.addEventListener("pointerdown", (event: PointerEvent) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-country]");
      if (button) countryDrag.startChipDrag(button, event);
    });

    tierDeck.addEventListener("dragstart", (event: DragEvent) => {
      if ((event.target as Element).closest("[data-country]")) event.preventDefault();
    });
  }

  function primeCountryFlagImageStates(): void {
    countryChipElements.forEach((chip) => {
      const image = chip.querySelector<HTMLImageElement>(".chip-flag");
      if (!image) return;

      const markLoaded = (): void => {
        chip.classList.add("is-loaded");
      };

      if (image.complete) {
        markLoaded();
        return;
      }

      image.addEventListener("load", markLoaded, { once: true });
      image.addEventListener("error", markLoaded, { once: true });
    });
  }

  function syncCountryChipMetadata(): void {
    countryChipElements.forEach((chip) => {
      const countryId = chip.dataset.country;
      const meta = countryId ? metaForCountry(countryId) : undefined;
      if (!meta) return;

      chip.dataset.code = meta.code;
      chip.setAttribute("aria-label", meta.name);
      chip.title = meta.name;

      const image = chip.querySelector<HTMLImageElement>(".chip-flag");
      const nextSrc = flagImageSrc(meta.code);
      if (image && nextSrc && image.getAttribute("src") !== nextSrc) {
        chip.classList.remove("is-loaded");
        image.src = nextSrc;
      }
    });

    primeCountryFlagImageStates();
  }

  function buildLegend(): void {
    if (legend.querySelector(".legend-item")) return;
    legend.innerHTML = renderLegendMarkup(tiers);
  }

  function showMapLoadingStars(): void {
    mapLoadingStars.classList.add("is-visible");
  }

  function hideMapLoadingStars(): void {
    mapLoadingStars.classList.remove("is-visible");
  }

  // ─── map loading ──────────────────────────────────────────────────────────────

  async function loadMap(): Promise<void> {
    document.body.classList.add("is-loading");
    mapWrap.classList.remove("is-map-ready");
    mapWrap.setAttribute("aria-busy", "true");
    showMapLoadingStars();

    try {
      const featureSets = await loadScenarioMapFeatureSets({
        d3,
        topojson,
        interactionCountryIds: tierCountryIdsForInteraction(),
      });
      highDetailFeatureByKey = featureSets.highDetailFeatureByKey;
      state.features = featureSets.interactionFeatures;
      state.visualFeatures = featureSets.visualFeatures;
      state.featureByKey = firstFeatureByKey(state.features);
      state.visualFeatureByKey = firstFeatureByKey(state.visualFeatures);
      hydrateCountryCatalogFromFeatures(state.visualFeatures);
      syncCountryChipMetadata();
      render();
      setupMapResizeHandling();
      focusScene("eu", { intro: true, revealCard: false });
      mapWrap.classList.add("is-map-ready");
    } catch (error) {
      showCountryCard();
      countryCard.innerHTML = `
        <p class="eyebrow">Map unavailable</p>
        <h2>The vector map could not load</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
      `;
    } finally {
      hideMapLoadingStars();
      document.body.classList.remove("is-loading");
      mapWrap.setAttribute("aria-busy", "false");
    }
  }

  // ─── map rendering ────────────────────────────────────────────────────────────

  function setupMapResizeHandling(): void {
    if (typeof ResizeObserver !== "undefined") {
      mapResizeObserver = new ResizeObserver(onResize);
      mapResizeObserver.observe(mapWrap);
      return;
    }

    window.addEventListener("resize", onResize);
  }

  function render(): void {
    const nextSize = readMapSize();
    if (!nextSize) return;

    svg.interrupt();
    width = nextSize.width;
    height = nextSize.height;
    geometryCache = new Map();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    syncCanvasSize();

    projection.fitExtent(
      [[20, 20], [width - 20, height - 20]],
      { type: "Sphere" },
    );

    svg.selectAll("*").remove();
    syncZoomScaleExtent();
    svg.call(zoom);
    svg.on("click.restore-scene", onMapBackgroundClick);

    mapLayer = svg.append("g").attr("class", "map-layer");
    mapLayer.append("path").datum(graticule).attr("class", "graticule").attr("d", path);
    countryLayer = mapLayer.append("g").attr("class", "country-layer");
    hoverLayer = mapLayer.append("g").attr("class", "hover-layer");
    labelLayer = mapLayer.append("g").attr("class", "label-layer");

    countryLayer
      .selectAll("path")
      .data(state.features)
      .join("path")
      .attr("class", countryClassForFeature)
      .attr("d", path)
      .attr("data-country", keyForFeature)
      .attr("data-tier", (feature: any) => tierForFeature(feature) ?? "")
      .attr("data-quality", renderQualityForFeature)
      .on("mouseenter", (event: MouseEvent, feature: any) => {
        const key = keyForFeature(feature);
        if (metaForCountry(key)) setHoveredCountry(key, event.currentTarget as Element);
      })
      .on("mouseleave", clearHoveredCountry)
      .on("click", (event: MouseEvent, feature: any) => {
        event.stopPropagation();
        const key = keyForFeature(feature);
        const canonicalId = canonicalCountryId(key);
        if (state.activeCountry === canonicalId) {
          restoreSceneSelection();
          return;
        }
        if (metaForCountry(key)) activateCountry(key, true);
      });

    updateHighlights();
    svg.call(zoom.transform, d3.zoomIdentity);
    renderMapFlags();
  }

  function onResize(): void {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      const nextSize = readMapSize();
      if (!nextSize || !hasMapSizeChanged(nextSize)) return;

      const fitRequest = currentMapFitRequest();
      render();
      if (fitRequest) {
        fitToCountries(fitRequest.ids, 0, fitRequest.options);
      }
    }, 150);
  }

  function readMapSize(): { width: number; height: number } | null {
    const nextWidth = mapWrap.clientWidth;
    const nextHeight = mapWrap.clientHeight;
    if (nextWidth <= 0 || nextHeight <= 0) return null;
    return { width: nextWidth, height: nextHeight };
  }

  function hasMapSizeChanged(nextSize: { width: number; height: number }): boolean {
    return (
      Math.abs(nextSize.width - width) > MAP_RESIZE_EPSILON_PX ||
      Math.abs(nextSize.height - height) > MAP_RESIZE_EPSILON_PX
    );
  }

  function onZoom(event: any): void {
    queueMapVisualRender(event.transform);
  }

  function syncCanvasSize(): void {
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    countryCanvas.setSize({ width, height });
    syncCanvasElementSize(mapFlagCanvas, pixelWidth, pixelHeight);
  }

  function syncCanvasElementSize(canvas: HTMLCanvasElement, pixelWidth: number, pixelHeight: number): void {
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = "";
  }

  function queueMapVisualRender(
    transform: any = currentZoomTransform(),
    options: MapVisualRenderOptions = {},
  ): void {
    mapVisuals.queue(transform, options);
  }

  function queueMapFlagRender(transform: any = currentZoomTransform()): void {
    mapVisuals.queueFlags(transform);
  }

  function applyMapVisualRender(request: MapVisualRenderRequest<any>): void {
    const { transform } = request;

    if (request.includeMap) {
      if (mapLayer) mapLayer.attr("transform", transform);
      drawCanvasMap(transform);
    }

    if (request.includeFlags) {
      drawCanvasMapFlags(transform);
    }

    if (request.updateLabels) {
      updateLabelScale(transform.k);
    }
  }

  function currentZoomTransform(): any {
    const node = svg.node();
    return node ? d3.zoomTransform(node) : d3.zoomIdentity;
  }

  function drawCanvasMap(transform: any = d3.zoomIdentity): void {
    countryCanvas.draw({
      features: state.visualFeatures,
      transform,
      selectedIds: state.selectedIds,
      activeCountry: state.activeCountry,
      hoveredCountry: state.hoveredCountry,
      width,
      height,
    });
  }

  function drawCanvasMapFlags(transform: any = currentZoomTransform()): void {
    mapFlags.draw(transform, { width, height });
  }

  function countryLabelBasePx(): number {
    if (window.innerWidth <= 430) return NARROW_LABEL_PX;
    if (window.innerWidth <= 1279) return COMPACT_LABEL_PX;
    return DESKTOP_LABEL_PX;
  }

  function labelScreenPxForScale(scale: number): number {
    const zoomRange = Math.max(1, maxMapZoomScale() - 1);
    const progress = Math.max(0, Math.min(1, (scale - 1) / zoomRange));
    const easedProgress = Math.sqrt(progress);
    const scaleFactor = LABEL_MIN_SCREEN_SCALE + (1 - LABEL_MIN_SCREEN_SCALE) * easedProgress;
    return countryLabelBasePx() * scaleFactor;
  }

  function labelFontSizeForScale(scale: number): string {
    return `${labelScreenPxForScale(scale) / Math.max(1, scale)}px`;
  }

  function labelShadowOffsetForScale(scale: number): number {
    return 2.75 / scale;
  }

  function updateLabelScale(scale: number): void {
    if (!labelLayer) return;

    labelLayer
      .selectAll(".country-label, .country-label-shadow")
      .style("font-size", labelFontSizeForScale(scale))
      .attr("x", (item: LabelDatum) => labelXForScale(item, scale))
      .attr("y", (item: LabelDatum) => labelYForScale(item))
      .attr("text-anchor", labelTextAnchorFor);

    const shadowOffset = labelShadowOffsetForScale(scale);
    labelLayer
      .selectAll(".country-label-shadow")
      .attr("dx", shadowOffset)
      .attr("dy", shadowOffset);
  }

  // ─── interaction ──────────────────────────────────────────────────────────────

  function activateTier(tierId: TierId, { reveal = true }: CardRenderOptions = {}): void {
    state.activeTier = tierId;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.selectedIds = selectedCountrySet(cumulativeIdsFor(tierId));
    updateHighlights();
    renderCountryCardForTier(tierId, { reveal });
    drawConnections();
  }

  function previewTier(tierId: TierId): void {
    if (state.activeCountry) return;
    activateTier(tierId, { reveal: isCountryCardVisible() });
  }

  function activateCountry(countryId: string, shouldZoom: boolean): void {
    const canonicalId = canonicalCountryId(countryId);
    const meta = metaForCountry(countryId);
    if (!meta) return;

    state.activeCountry = canonicalId;
    state.hoveredCountry = null;
    state.activeTier = activeTierForScene() ?? meta.tier;
    state.selectedIds = selectedCountrySet(countryIdsFor(canonicalId));
    state.userTouched = true;
    updateHighlights();
    renderCountryCardForCountry(meta);
    drawConnections();

    if (shouldZoom) fitToCountries(countryIdsFor(canonicalId), 700);
  }

  function setHoveredCountry(countryId: string, target?: Element): void {
    const canonicalId = canonicalCountryId(countryId);
    if (target?.classList.contains("country")) d3.select(target).raise();
    if (state.hoveredCountry === canonicalId) return;

    state.hoveredCountry = canonicalId;
    updateHighlights();
  }

  function clearHoveredCountry(): void {
    if (!state.hoveredCountry) return;
    state.hoveredCountry = null;
    updateHighlights();
  }

  function clearSoftFocus(): void {
    if (state.activeCountry || !state.activeTier) return;
    restoreSceneSelection();
  }

  function onMapBackgroundClick(event: MouseEvent): void {
    if (!state.activeCountry) return;
    if ((event.target as Element).closest(".country")) return;
    restoreSceneSelection();
  }

  function activeTierForScene(scene: SceneKey = state.scene): TierId | null {
    return tierArrangement.hasTier(scene) ? scene : null;
  }

  function selectedIdsForScene(scene: SceneKey = state.scene): Set<string> {
    return selectedCountrySet(sceneIdsFor(scene) ?? cumulativeIdsFor("friends"));
  }

  function restoreSceneSelection(): void {
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = activeTierForScene();
    state.selectedIds = selectedIdsForScene();
    updateHighlights();
    renderCountryCardForScene(undefined, { reveal: isCountryCardVisible() });
    drawConnections();
  }

  function previewScene(scene: SceneKey): void {
    if (state.activeCountry) return;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = activeTierForScene(scene);
    state.selectedIds = selectedIdsForScene(scene);
    updateHighlights();
    renderCountryCardForScene(scene, { reveal: isCountryCardVisible() });
    drawConnections();
  }

  function restoreScenePreview(): void {
    if (state.activeCountry) return;
    restoreSceneSelection();
  }

  function updateHighlights(): void {
    if (!countryLayer) return;

    const hasSelection = state.selectedIds.size > 0;

    countryLayer.selectAll(".country").each(function (this: Element, feature: any) {
      const key = keyForFeature(feature);
      const activeIds = state.activeCountry ? countryIdsFor(state.activeCountry) : [];
      const hoveredIds = state.hoveredCountry ? countryIdsFor(state.hoveredCountry) : [];
      const isLifted = activeIds.includes(key) || hoveredIds.includes(key);
      const isSelected = state.selectedIds.has(key);
      this.classList.toggle("is-muted", hasSelection && !isSelected);
      this.classList.toggle("is-highlight", isSelected);
      this.classList.toggle("is-selected", activeIds.includes(key));
      this.classList.toggle("is-hovered", hoveredIds.includes(key));
      this.classList.toggle("is-lift-source", isLifted);
    });

    tierCardElements.forEach((card) => {
      card.classList.toggle("is-active", card.dataset.tier === state.activeTier);
    });

    countryChipElements.forEach((chip) => {
      chip.classList.toggle("is-active", state.selectedIds.has(chip.dataset.country!));
      chip.classList.toggle(
        "is-map-hovered",
        Boolean(state.hoveredCountry && canonicalCountryId(chip.dataset.country!) === state.hoveredCountry),
      );
    });

    queueMapVisualRender();
    drawLiftedCountries();
    drawLabels();
    syncMapFlagStates();
  }

  function drawLiftedCountries(): void {
    if (!hoverLayer) return;

    const featuresByKey = new Map<string, any>();
    [state.activeCountry, state.hoveredCountry].forEach((countryId) => {
      if (!countryId) return;
      countryIdsFor(countryId)
        .map((id) => visualFeatureForCountry(id) ?? state.featureByKey.get(id))
        .filter(Boolean)
        .forEach((feature) => featuresByKey.set(keyForFeature(feature), feature));
    });

    hoverLayer
      .selectAll(".country-lift")
      .data([...featuresByKey.values()], keyForFeature)
      .join(
        (enter: any) => {
          const group = enter.append("g").attr("class", "country-lift");
          group.append("path").attr("class", "country-lift-shadow").attr("d", path);
          group
            .append("path")
            .attr("class", (feature: any) => `${countryClassForFeature(feature)} country-hover-lift`)
            .attr("transform", COUNTRY_LIFT_TRANSFORM)
            .attr("d", path);
          return group;
        },
        (update: any) => {
          update.select(".country-lift-shadow").attr("d", path);
          update
            .select(".country-hover-lift")
            .attr("class", (feature: any) => `${countryClassForFeature(feature)} country-hover-lift`)
            .attr("transform", COUNTRY_LIFT_TRANSFORM)
            .attr("d", path);
          return update;
        },
        (exit: any) => exit.remove(),
      );
  }

  function renderMapFlags(): void {
    const shouldShowFlags = state.mapFlagsMode && state.visualFeatures.length > 0;
    mapFlags.setEnabled(shouldShowFlags);

    if (!shouldShowFlags) {
      queueMapFlagRender();
      return;
    }

    mapFlags.setFlags(mapFlagData());
    positionMapFlags();
    syncMapFlagStates();
    queueMapFlagRender();
  }

  function mapFlagData(): MapFlagDatum[] {
    const seen = new Set<string>();

    return state.visualFeatures
      .map((feature): MapFlagDatum | null => {
        const id = keyForFeature(feature);
        const canonicalId = canonicalCountryId(id);
        if (seen.has(canonicalId) || isAliasCountryId(id)) return null;

        const entry = tierArrangement.entryForCountry(canonicalId);
        if (!entry || !flagImageSrc(entry[1])) return null;

        const layout = layoutForFeature(feature);
        if (!layout) return null;

        seen.add(canonicalId);
        return {
          id: canonicalId,
          code: entry[1],
          name: entry[2],
          centroid: layout.centroid,
          inTierList: tierArrangement.hasDirectTier(canonicalId),
        };
      })
      .filter((item): item is MapFlagDatum => item !== null);
  }

  function syncMapFlagStates(): void {
    mapFlags.syncTierPresence((countryId) => tierArrangement.hasDirectTier(countryId));
    queueMapFlagRender();
  }

  function positionMapFlags(transform: any = currentZoomTransform()): void {
    mapFlags.position(transform, { width, height });
  }

  function isEventOnMapFlag(event: { clientX?: number; clientY?: number }): boolean {
    return mapFlags.isEventOnFlag(event);
  }

  // ─── card rendering ───────────────────────────────────────────────────────────

  function isCountryCardVisible(): boolean {
    return !countryCard.hidden;
  }

  function showCountryCard(): void {
    countryCard.hidden = false;
  }

  function renderCountryCardForTier(tierId: TierId, { reveal = true }: CardRenderOptions = {}): void {
    if (reveal) showCountryCard();
    const tier = tierArrangement.tier(tierId);
    countryCard.innerHTML = renderCountryCardForTierMarkup(tier);
  }

  function renderCountryCardForScene(
    scene: SceneKey = state.scene,
    { reveal = true }: CardRenderOptions = {},
  ): void {
    const tierId = activeTierForScene(scene);
    if (tierId) {
      renderCountryCardForTier(tierId, { reveal });
      return;
    }

    if (reveal) showCountryCard();
    countryCard.innerHTML = renderCountryCardForSceneMarkup(scene);
  }

  function renderCountryCardForCountry(meta: CountryMeta): void {
    showCountryCard();
    const tier = tierArrangement.tier(meta.tier);
    countryCard.innerHTML = renderCountryCardForCountryMarkup(meta, tier);
  }

  // ─── map overlays ─────────────────────────────────────────────────────────────

  function drawConnections(): void {}

  function drawLabels(): void {
    if (!labelLayer) return;

    const labelsById = new Map<string, LabelDatum>();
    const addLabel = (id: string, isRaised = false): void => {
      const label = labelForCountry(id, isRaised);
      if (!label) return;

      const existing = labelsById.get(label.id);
      labelsById.set(label.id, {
        ...label,
        isRaised: label.isRaised || existing?.isRaised === true,
      });
    };

    if (state.selectedIds.size <= 14) {
      [...state.selectedIds].forEach((id) => addLabel(id));
    }

    if (state.activeCountry) addLabel(state.activeCountry, true);
    if (state.hoveredCountry) addLabel(state.hoveredCountry, true);

    const labels = [...labelsById.values()];

    const currentScale: number = svg.node() ? d3.zoomTransform(svg.node()).k : 1;
    const labelShadowOffset = labelShadowOffsetForScale(currentScale);

    labelLayer
      .selectAll(".country-label-shadow")
      .data(labels, (item: LabelDatum) => item.id)
      .join("text")
      .attr("class", "country-label-shadow")
      .attr("x", (item: LabelDatum) => labelXForScale(item, currentScale))
      .attr("y", (item: LabelDatum) => labelYForScale(item))
      .attr("dx", labelShadowOffset)
      .attr("dy", labelShadowOffset)
      .attr("text-anchor", labelTextAnchorFor)
      .attr("dominant-baseline", "middle")
      .attr("transform", labelTransformFor)
      .style("font-size", labelFontSizeForScale(currentScale))
      .text((item: LabelDatum) => item.text);

    labelLayer
      .selectAll(".country-label")
      .data(labels, (item: LabelDatum) => item.id)
      .join("text")
      .attr("class", "country-label")
      .attr("x", (item: LabelDatum) => labelXForScale(item, currentScale))
      .attr("y", (item: LabelDatum) => labelYForScale(item))
      .attr("text-anchor", labelTextAnchorFor)
      .attr("dominant-baseline", "middle")
      .attr("transform", labelTransformFor)
      .style("font-size", labelFontSizeForScale(currentScale))
      .text((item: LabelDatum) => item.text)
      .raise();
  }

  function labelXForScale(item: LabelDatum, scale: number): number {
    if (!shouldPlaceLabelRightOfFlag(item)) return item.centroid[0];
    return item.centroid[0] + labelRightOfFlagOffsetForScale(scale);
  }

  function labelYForScale(item: LabelDatum): number {
    return item.centroid[1];
  }

  function labelTextAnchorFor(item: LabelDatum): "start" | "middle" {
    return shouldPlaceLabelRightOfFlag(item) ? "start" : "middle";
  }

  function labelTransformFor(item: LabelDatum): string | null {
    if (shouldPlaceLabelRightOfFlag(item)) return null;
    return item.isRaised ? COUNTRY_LIFT_TRANSFORM : null;
  }

  function shouldPlaceLabelRightOfFlag(item: LabelDatum): boolean {
    const meta = tierArrangement.metaForCountry(item.id);
    return Boolean(state.mapFlagsMode && meta && flagImageSrc(meta.code));
  }

  function labelRightOfFlagOffsetForScale(scale: number): number {
    return (MAP_FLAG_SIZE_PX / 2 + COUNTRY_LABEL_FLAG_GAP_PX) / scale;
  }

  function labelForCountry(countryId: string, isRaised = false): LabelDatum | null {
    const id = canonicalCountryId(countryId);
    if (isAliasCountryId(id)) return null;

    const feature = visualFeatureForCountry(id) ?? state.featureByKey.get(id);
    const meta = tierArrangement.metaForCountry(id);
    if (!feature || !meta) return null;

    const layout = layoutForFeature(feature);
    if (!layout) return null;

    return { id, text: meta.name, centroid: layout.centroid, isRaised };
  }

  // ─── scene management ─────────────────────────────────────────────────────────

  function focusScene(
    scene: SceneKey,
    options: { intro?: boolean; revealCard?: boolean } = {},
  ): void {
    if (options.intro && state.userTouched) return;
    const revealCard = options.revealCard ?? true;

    state.scene = scene;
    sceneTabs.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.scene === scene);
    });

    if (scene === "world") {
      state.activeTier = null;
      state.activeCountry = null;
      state.hoveredCountry = null;
      state.selectedIds = selectedCountrySet(cumulativeIdsFor("friends"));
      updateHighlights();
      drawConnections();
      renderCountryCardForScene(scene, { reveal: revealCard });
      applyZoomTransform(d3.zoomIdentity, 900);
      return;
    }

    const ids = sceneIdsFor(scene)!;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = tierArrangement.hasTier(scene) ? scene : null;
    state.selectedIds = selectedCountrySet(ids);
    updateHighlights();

    if (state.activeTier) {
      renderCountryCardForTier(state.activeTier, { reveal: revealCard });
      drawConnections();
    } else {
      renderCountryCardForScene(scene, { reveal: revealCard });
      drawConnections();
    }

    fitToCountries(ids, options.intro ? 1400 : 900, fitOptionsForScene(scene));
  }

  function fitToCountries(ids: string[], duration = 900, { bottomPad = 0, topPad = 0, europeOnly = false }: FitOptions = {}): void {
    if (!ids.length) return;

    let features = ids.map((id) => visualFeatureForCountry(id) ?? state.featureByKey.get(id)).filter(Boolean);
    if (europeOnly) {
      features = features.map(clipFeatureToEurope).filter(Boolean);
    }
    if (!features.length) return;

    const bounds = path.bounds({ type: "FeatureCollection", features });
    const dx: number = bounds[1][0] - bounds[0][0];
    const dy: number = bounds[1][1] - bounds[0][1];
    const x: number = (bounds[0][0] + bounds[1][0]) / 2;
    const y: number = (bounds[0][1] + bounds[1][1]) / 2;
    const effectiveHeight = height - bottomPad - topPad;
    const scale = Math.max(
      1,
      Math.min(FIT_MAX_ZOOM_SCALE, maxMapZoomScale(), 0.84 / Math.max(dx / width, dy / effectiveHeight)),
    );
    const translate: [number, number] = [width / 2 - scale * x, topPad + effectiveHeight / 2 - scale * y];

    applyZoomTransform(d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale), duration);
  }

  function fitOptionsForScene(scene: SceneKey = state.scene): FitOptions {
    if (scene === "world") return {};
    return {
      bottomPad: 160,
      topPad: window.innerWidth <= 720 ? 60 : 0,
      europeOnly: scene !== "friends",
    };
  }

  function currentMapFitRequest(): { ids: string[]; options?: FitOptions } | null {
    if (state.activeCountry) {
      return { ids: countryIdsFor(state.activeCountry) };
    }

    if (state.activeTier) {
      return { ids: cumulativeIdsFor(state.activeTier), options: fitOptionsForScene(state.activeTier) };
    }

    const sceneIds = sceneIdsFor(state.scene);
    if (sceneIds) {
      return { ids: sceneIds, options: fitOptionsForScene(state.scene) };
    }

    return null;
  }

  function applyZoomTransform(transform: any, duration: number): void {
    svg.interrupt();
    if (duration <= 0) {
      svg.call(zoom.transform, transform);
      return;
    }

    svg
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, transform);
  }

  // ─── event listeners ──────────────────────────────────────────────────────────

  sceneTabs.addEventListener("click", (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-scene]");
    if (!button?.dataset.scene) return;
    state.userTouched = true;
    focusScene(button.dataset.scene as SceneKey);
  });

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    sceneTabs.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        if (button.dataset.scene) previewScene(button.dataset.scene as SceneKey);
      });
    });
    sceneTabs.addEventListener("mouseleave", restoreScenePreview);
  }

  editToggle.addEventListener("click", () => {
    setEditMode(!state.editMode);
    if (window.matchMedia("(hover: hover)").matches && editToggle.matches(":hover")) {
      showPillTooltip(editToggle);
    } else {
      hidePillTooltip();
    }
  });

}

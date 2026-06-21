import {
  canonicalCountryId,
  countryIdsFor,
  flagCodeFor,
  isAliasCountryId,
  selectedCountrySet,
} from "../domain/country-identity";
import { countryContextFor } from "../domain/country-context";
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
    isMicrostate: boolean;
  }

  interface FitOptions {
    bottomPad?: number;
    topPad?: number;
    europeOnly?: boolean;
    world?: boolean;
  }

  interface CardRenderOptions {
    reveal?: boolean;
    scroll?: boolean;
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
    flagFocusIds: Set<string>;
    flagFocusScopeIds: Set<string>;
    scene: SceneKey;
    editMode: boolean;
    mapFlagsMode: boolean;
    userTouched: boolean;
  }


  // ─── constants ────────────────────────────────────────────────────────────────

  const ZOOM_WHEEL_DELTA_MULTIPLIER = 0.86;
  const DESKTOP_MAX_ZOOM_SCALE = 14;
  const MOBILE_MAX_ZOOM_SCALE = 22;
  const FIT_MAX_ZOOM_SCALE = 12;
  const LABEL_MIN_SCREEN_SCALE = 0.52;
  const MAP_TRANSLATE_EXTENT_PADDING_RATIO = 0.08;
  const COUNTRY_OUTLINE_ANIMATION_MS = 180;
  const COUNTRY_OUTLINE_ENTER_WIDTH = 1.2;
  const COUNTRY_OUTLINE_ACTIVE_WIDTH = 4.8;
  const COUNTRY_LABEL_ANIMATION_MS = 170;
  const COUNTRY_LABEL_ENTER_SCALE = 0.86;
  const ALL_COUNTRY_LABEL_MIN_ZOOM_SCALE = 12.25;
  const MICROSTATE_LABEL_SCALE = 0.72;

  const CIRCLE_FLAG_SVGS: Record<string, string> = import.meta.glob(
    "../../node_modules/circle-flags/flags/*.svg",
    { eager: true, import: "default", query: "?raw" },
  );

  const PUBLIC_BASE_URL = import.meta.env.BASE_URL;
  const CHIP_DRAG_START_THRESHOLD_PX = 4;
  const flagImageSrcCache = new Map<string, string>();

  // ─── derived lookups ──────────────────────────────────────────────────────────

  const tierArrangement = createTierArrangement(tiers);
  const MICROSTATE_COUNTRY_IDS = new Set(["020", "438", "492", "674", "336"]);

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
    flagFocusIds: new Set(),
    flagFocusScopeIds: new Set(),
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
  const countryCardBelowMapQuery = window.matchMedia("(max-width: 1279px)");
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

  const WORLD_FIT_EXCLUDED_COUNTRY_IDS = new Set(["010"]);
  const NO_WRAP_MERCATOR_ROTATION: [number, number] = [-11.5, 0];

  const projection = d3.geoMercator().rotate(NO_WRAP_MERCATOR_ROTATION);
  const path = d3.geoPath(projection).pointRadius(4.8);
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
    zoom
      .scaleExtent([1, maxMapZoomScale()])
      .translateExtent(mapTranslateExtent());
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
  const MAP_FLAG_MIN_SCALE = 0.68;
  const MAP_FLAG_FULL_SIZE_ZOOM_SCALE = 4;
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
    sizeScaleForZoom: mapFlagScaleForZoom,
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
  let hasCountryFocusIsolation = false;

  // ─── init ─────────────────────────────────────────────────────────────────────
  buildBenefitPills();
  buildTierCards();
  buildLegend();
  setupEditToggleTooltip();
  setupEditToolbar();
  setupMapFlagsButton();
  setupMapFlagLayerInteractions();
  setupCountryCardPlacement();
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

  function setupCountryCardPlacement(): void {
    const syncCountryCardPlacement = (): void => {
      if (countryCardBelowMapQuery.matches) {
        if (countryCard.parentElement === mapWrap) mapWrap.after(countryCard);
        return;
      }

      if (countryCard.parentElement !== mapWrap) {
        mapWrap.insertBefore(countryCard, mapFlagLayer);
      }
    };

    countryCardBelowMapQuery.addEventListener("change", syncCountryCardPlacement);
    syncCountryCardPlacement();
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

    hoverMapFlag(flag.id);
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

    const meta = countryCardMetaFor(countryId);
    if (meta) activateCountry(meta.id, true);
  }

  function hoverMapFlag(countryId: string): void {
    const didChangeFlagHover = mapFlags.setHovered(countryId);
    const canonicalId = canonicalCountryId(countryId);

    if (state.hoveredCountry !== canonicalId) {
      setHoveredCountry(countryId);
      return;
    }

    if (didChangeFlagHover) queueMapFlagRender();
  }

  function hoverMapFlagAtEvent(event: { clientX?: number; clientY?: number }): boolean {
    if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return false;

    const flag = mapFlags.hitTest(event.clientX, event.clientY);
    if (!flag) return false;

    hoverMapFlag(flag.id);
    return true;
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
    if (!code || !hasFlag(code)) return null;

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
        if (!code || !hasFlag(code)) return null;

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
    return state.visualFeatureByKey.get(countryId) ?? state.visualFeatureByKey.get(canonicalCountryId(countryId));
  }

  function metaForCountry(countryId: string): CountryMeta | undefined {
    return tierArrangement.metaForCountry(countryId);
  }

  function entryForCountry(countryId: string): CountryEntry | null {
    return tierArrangement.entryForCountry(countryId);
  }

  function countryCardMetaFor(countryId: string): Pick<CountryMeta, "id" | "code" | "name"> | null {
    const canonicalId = canonicalCountryId(countryId);
    const meta = metaForCountry(canonicalId);
    if (meta) return meta;

    const entry = entryForCountry(canonicalId);
    if (!entry) return null;

    const [id, code, name] = entry;
    return { id, code, name };
  }

  function flagImageSrc(code: string): string {
    const path = flagSvgPath(code);
    const cached = flagImageSrcCache.get(path);
    if (cached) return cached;

    const svg = CIRCLE_FLAG_SVGS[path];
    if (!svg) return "";

    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    flagImageSrcCache.set(path, src);
    return src;
  }

  function flagSvgMarkup(code: string): string {
    return CIRCLE_FLAG_SVGS[flagSvgPath(code)] ?? "";
  }

  function hasFlag(code: string): boolean {
    return Boolean(flagSvgMarkup(code));
  }

  function flagSvgPath(code: string): string {
    return `../../node_modules/circle-flags/flags/${flagCodeFor(code)}.svg`;
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

    const centroid: [number, number] = anchorFeatureCentroid(feature);
    if (!centroid || centroid.some(Number.isNaN)) return null;

    const bounds = path.bounds(feature);
    const layout: GeometryLayout = { bounds, centroid };
    geometryCache.set(key, layout);
    return layout;
  }

  function anchorFeatureCentroid(feature: any): [number, number] {
    return path.centroid(largestPolygonFeature(feature) ?? feature);
  }

  function largestPolygonFeature(feature: any): any | null {
    const geometry = feature?.geometry;
    if (!geometry || geometry.type !== "MultiPolygon") return null;

    let largestFeature: any | null = null;
    let largestArea = -Infinity;

    geometry.coordinates.forEach((coordinates: number[][][]) => {
      const polygonFeature = {
        ...feature,
        geometry: {
          ...geometry,
          type: "Polygon",
          coordinates,
        },
      };
      const area = path.area(polygonFeature);
      if (Number.isFinite(area) && area > largestArea) {
        largestArea = area;
        largestFeature = polygonFeature;
      }
    });

    return largestFeature;
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
      const meta = countryCardMetaFor(state.activeCountry);
      if (meta) {
        state.activeTier =
          activeTierForScene() ??
          tierArrangement.directTierForCountry(state.activeCountry) ??
          null;
        state.selectedIds = selectedCountrySet(countryIdsFor(state.activeCountry));
        renderCountryCardForCountry(meta);
      } else {
        state.activeCountry = null;
      }
    }

    if (!state.activeCountry && state.activeTier) {
      state.selectedIds = selectedCountrySet(cumulativeIdsFor(state.activeTier));
      setSelectedTierFlagScope();
      renderCountryCardForTier(state.activeTier, { reveal: shouldRevealTierSelectionCard() });
    } else if (!state.activeCountry) {
      state.selectedIds = selectedCountrySet(sceneIdsFor(state.scene) ?? cumulativeIdsFor("friends"));
      setSelectedTierFlagScope();
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
    drawCountryOutlines();
  }

  // ─── render functions ─────────────────────────────────────────────────────────

  function buildTierCards(): void {
    if (!hasRenderableTierShell()) {
      tierDeck.innerHTML = renderTierDeck({ tiers, capabilityInfoByLabel, flagSvgMarkup });
    } else {
      syncTierCountryGrids();
    }

    tierCardElements = [...tierDeck.querySelectorAll<HTMLElement>(".tier-card")];
    countryChipElements = [...tierDeck.querySelectorAll<HTMLButtonElement>("[data-country]")];
    syncCapabilityMetadata();
    syncFlagFocusHighlights();
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
      grid.innerHTML = renderCountryGrid(tier, flagSvgMarkup);
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
        focusFlagForCountry(chip.dataset.country, flagFocusScopeForElement(chip));
        return;
      }

      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        showPillTooltip(capability);
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card?.dataset.tier) {
        focusFlagsForTier(card.dataset.tier as TierId);
        previewTier(card.dataset.tier as TierId);
      }
    });

    tierDeck.addEventListener("focusin", (event: FocusEvent) => {
      const target = event.target as Element;
      const chip = target.closest<HTMLButtonElement>("[data-country]");
      if (chip?.dataset.country) {
        focusFlagForCountry(chip.dataset.country, flagFocusScopeForElement(chip));
        return;
      }

      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        showPillTooltip(capability);
        return;
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card?.dataset.tier) {
        focusFlagsForTier(card.dataset.tier as TierId);
        previewTier(card.dataset.tier as TierId);
      }
    });

    tierDeck.addEventListener("focusout", (event: FocusEvent) => {
      const capability = (event.target as Element).closest<HTMLElement>("[data-cap-key]");
      if (capability) hidePillTooltip();

      if (!tierDeck.contains(event.relatedTarget as Node | null)) {
        restoreSelectedTierFlagScope();
      } else {
        restoreFlagFocusFromElement(event.relatedTarget as Element | null);
      }
    });

    tierDeck.addEventListener("mouseout", (event: MouseEvent) => {
      const target = event.target as Element;
      const relatedTarget = event.relatedTarget as Element | null;
      const capability = target.closest<HTMLElement>("[data-cap-key]");
      if (capability && window.matchMedia("(hover: hover)").matches) {
        hidePillTooltip();
      }

      const chip = target.closest<HTMLButtonElement>("[data-country]");
      if (chip && !chip.contains(relatedTarget as Node | null)) {
        restoreFlagFocusFromElement(relatedTarget);
      }

      const card = target.closest<HTMLElement>(".tier-card");
      if (card && !card.contains(relatedTarget as Node | null)) {
        clearSoftFocus();
        restoreSelectedTierFlagScope();
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
      if (chip.querySelector(".chip-flag svg")) chip.classList.add("is-loaded");
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

      const flag = chip.querySelector<HTMLElement>(".chip-flag");
      const nextSvg = flagSvgMarkup(meta.code);
      if (flag && nextSvg && flag.innerHTML !== nextSvg) {
        chip.classList.remove("is-loaded");
        flag.innerHTML = nextSvg;
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

    projection
      .clipExtent(null)
      .fitExtent(
        [[20, 20], [width - 20, height - 20]],
        worldFitFeatureCollection(),
      );

    svg.selectAll("*").remove();
    syncZoomScaleExtent();
    svg.call(zoom);
    svg.on("click.restore-scene", onMapBackgroundClick);

    mapLayer = svg.append("g").attr("class", "map-layer");
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
        if (hoverMapFlagAtEvent(event)) return;

        const key = keyForFeature(feature);
        if (countryCardMetaFor(key)) setHoveredCountry(key);
      })
      .on("mouseleave", (event: MouseEvent) => {
        if (isEventOnMapFlag(event)) return;
        clearHoveredCountry();
      })
      .on("click", (event: MouseEvent, feature: any) => {
        event.stopPropagation();
        const key = keyForFeature(feature);
        const canonicalId = canonicalCountryId(key);
        if (state.activeCountry === canonicalId) {
          restoreSceneSelection();
          return;
        }
        if (countryCardMetaFor(key)) activateCountry(key, true);
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

  function worldFitFeatureCollection(): any {
    const features = (state.visualFeatures.length ? state.visualFeatures : state.features)
      .filter((feature) => !WORLD_FIT_EXCLUDED_COUNTRY_IDS.has(keyForFeature(feature)));
    return { type: "FeatureCollection", features };
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
      focusScopeIds: state.flagFocusScopeIds,
      hasActiveFocusIds: state.flagFocusIds.size > 0,
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

  function labelScreenPxForScale(item: LabelDatum, scale: number): number {
    const zoomRange = Math.max(1, maxMapZoomScale() - 1);
    const progress = Math.max(0, Math.min(1, (scale - 1) / zoomRange));
    const easedProgress = Math.sqrt(progress);
    const scaleFactor = LABEL_MIN_SCREEN_SCALE + (1 - LABEL_MIN_SCREEN_SCALE) * easedProgress;
    return countryLabelBasePx() * scaleFactor * (item.isMicrostate ? MICROSTATE_LABEL_SCALE : 1);
  }

  function labelFontSizeForScale(item: LabelDatum, scale: number, sizeScale = 1): string {
    return `${(labelScreenPxForScale(item, scale) * sizeScale) / Math.max(1, scale)}px`;
  }

  function labelShadowOffsetForScale(scale: number): number {
    return 2.75 / scale;
  }

  function updateLabelScale(scale: number): void {
    drawLabels(scale);
  }

  // ─── interaction ──────────────────────────────────────────────────────────────

  function activateTier(tierId: TierId, { reveal = true }: CardRenderOptions = {}): void {
    state.activeTier = tierId;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.selectedIds = selectedCountrySet(cumulativeIdsFor(tierId));
    setSelectedTierFlagScope(tierId);
    updateHighlights();
    renderCountryCardForTier(tierId, { reveal });
    drawConnections();
  }

  function previewTier(tierId: TierId): void {
    if (state.activeCountry) return;
    state.activeTier = tierId;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.selectedIds = selectedCountrySet(cumulativeIdsFor(tierId));
    updateHighlights();
    drawConnections();
  }

  function activateCountry(countryId: string, shouldZoom: boolean): void {
    const canonicalId = canonicalCountryId(countryId);
    const meta = countryCardMetaFor(countryId);
    if (!meta) return;

    const countryFeatureIds = countryIdsFor(canonicalId);
    const isInCurrentSelection = countryFeatureIds.some((id) => state.selectedIds.has(id));
    const directTierId = tierArrangement.directTierForCountry(canonicalId) ?? null;

    state.activeCountry = canonicalId;
    state.hoveredCountry = null;
    state.activeTier = isInCurrentSelection ? state.activeTier : directTierId;
    state.selectedIds = isInCurrentSelection
      ? new Set(state.selectedIds)
      : directTierId
        ? selectedCountrySet(cumulativeIdsFor(directTierId))
        : selectedCountrySet(countryFeatureIds);
    state.userTouched = true;
    setActiveCountryFlagFocus(canonicalId);
    updateHighlights();
    renderCountryCardForCountry(meta);
    drawConnections();

    if (shouldZoom) fitToCountries(countryIdsFor(canonicalId), 700);
  }

  function setHoveredCountry(countryId: string): void {
    const canonicalId = canonicalCountryId(countryId);
    const didChangeFlagHover = state.mapFlagsMode ? mapFlags.setHovered(canonicalId) : false;
    if (state.hoveredCountry === canonicalId) {
      if (didChangeFlagHover) queueMapFlagRender();
      return;
    }

    state.hoveredCountry = canonicalId;
    updateHighlights();
  }

  function clearHoveredCountry(): void {
    if (!state.hoveredCountry) return;
    state.hoveredCountry = null;
    if (state.mapFlagsMode) mapFlags.clearHover();
    updateHighlights();
  }

  function clearSoftFocus(): void {
    if (state.activeCountry || !state.activeTier) return;
    restoreSceneSelection({ scrollCard: false });
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

  function flagFocusIdsForTier(tierId: TierId): Set<string> {
    return selectedCountrySet(cumulativeIdsFor(tierId));
  }

  function flagFocusIdsForScene(scene: SceneKey): Set<string> {
    return selectedIdsForScene(scene);
  }

  function selectedTierFlagScope(scene: SceneKey = state.scene): Set<string> {
    return activeTierForScene(scene) ? selectedIdsForScene(scene) : new Set();
  }

  function setFlagFocusIds(ids: Set<string>, scopeIds: Set<string> = ids): void {
    if (setsEqual(state.flagFocusIds, ids) && setsEqual(state.flagFocusScopeIds, scopeIds)) return;

    state.flagFocusIds = ids;
    state.flagFocusScopeIds = scopeIds;
    syncFlagFocusHighlights();
  }

  function setsEqual<T>(first: ReadonlySet<T>, second: ReadonlySet<T>): boolean {
    if (first.size !== second.size) return false;
    for (const item of first) {
      if (!second.has(item)) return false;
    }
    return true;
  }

  function setSelectedTierFlagScope(scene: SceneKey = state.scene): void {
    setFlagFocusIds(new Set(), selectedTierFlagScope(scene));
  }

  function focusFlagsForTier(tierId: TierId): void {
    setFlagFocusIds(flagFocusIdsForTier(tierId));
  }

  function focusFlagsForScene(scene: SceneKey): void {
    setFlagFocusIds(flagFocusIdsForScene(scene));
  }

  function focusFlagForCountry(countryId: string, scopeIds: Set<string> = selectedCountrySet(countryIdsFor(countryId))): void {
    setFlagFocusIds(selectedCountrySet(countryIdsFor(countryId)), scopeIds);
  }

  function setActiveCountryFlagFocus(countryId: string): void {
    setFlagFocusIds(selectedCountrySet(countryIdsFor(countryId)), new Set());
  }

  function clearFlagFocus(): void {
    if (state.flagFocusIds.size === 0 && state.flagFocusScopeIds.size === 0) return;
    setFlagFocusIds(new Set());
  }

  function flagFocusScopeForElement(element: Element): Set<string> {
    const countryId = (element as HTMLElement).dataset.country;
    if (countryId) return selectedCountrySet(countryIdsFor(countryId));
    const card = element.closest<HTMLElement>(".tier-card");
    if (card?.dataset.tier) return flagFocusIdsForTier(card.dataset.tier as TierId);
    const sceneButton = element.closest<HTMLButtonElement>("[data-scene]");
    if (sceneButton?.dataset.scene) return flagFocusIdsForScene(sceneButton.dataset.scene as SceneKey);
    return new Set();
  }

  function restoreFlagFocusFromElement(element: Element | null): void {
    const sceneButton = element?.closest<HTMLButtonElement>("[data-scene]");
    if (sceneButton?.dataset.scene) {
      focusFlagsForScene(sceneButton.dataset.scene as SceneKey);
      return;
    }

    const card = element?.closest<HTMLElement>(".tier-card");
    if (card?.dataset.tier) {
      focusFlagsForTier(card.dataset.tier as TierId);
      return;
    }

    restoreSelectedTierFlagScope();
  }

  function restoreSelectedTierFlagScope(): void {
    if (state.activeCountry) {
      setActiveCountryFlagFocus(state.activeCountry);
      return;
    }

    setSelectedTierFlagScope();
  }

  function restoreSceneSelection({ scrollCard = true }: { scrollCard?: boolean } = {}): void {
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = activeTierForScene();
    state.selectedIds = selectedIdsForScene();
    setSelectedTierFlagScope();
    updateHighlights();
    renderCountryCardForScene(undefined, {
      reveal: shouldRevealTierSelectionCard(),
      scroll: scrollCard,
    });
    drawConnections();
  }

  function previewScene(scene: SceneKey): void {
    if (state.activeCountry) return;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = activeTierForScene(scene);
    state.selectedIds = selectedIdsForScene(scene);
    updateHighlights();
    renderCountryCardForScene(scene, { reveal: isCountryCardVisible(), scroll: false });
    drawConnections();
  }

  function restoreScenePreview(): void {
    if (state.activeCountry) return;
    restoreSceneSelection({ scrollCard: false });
  }

  function updateHighlights(): void {
    if (!countryLayer) return;

    const hasSelection = state.selectedIds.size > 0;

    countryLayer.selectAll(".country").each(function (this: Element, feature: any) {
      const key = keyForFeature(feature);
      const activeIds = state.activeCountry ? countryIdsFor(state.activeCountry) : [];
      const hoveredIds = state.hoveredCountry ? countryIdsFor(state.hoveredCountry) : [];
      const isSelected = state.selectedIds.has(key);
      this.classList.toggle("is-muted", hasSelection && !isSelected);
      this.classList.toggle("is-highlight", isSelected);
      this.classList.toggle("is-selected", activeIds.includes(key));
      this.classList.toggle("is-hovered", hoveredIds.includes(key));
    });

    tierCardElements.forEach((card) => {
      card.classList.toggle("is-active", card.dataset.tier === state.activeTier);
    });

    countryChipElements.forEach((chip) => {
      chip.classList.toggle("is-active", state.selectedIds.has(chip.dataset.country!));
      chip.classList.toggle("is-flag-focused", state.flagFocusIds.has(canonicalCountryId(chip.dataset.country!)));
      chip.classList.toggle(
        "is-flag-out-of-focus",
        state.flagFocusScopeIds.size > 0 && !state.flagFocusScopeIds.has(canonicalCountryId(chip.dataset.country!)),
      );
      chip.classList.toggle(
        "is-map-hovered",
        Boolean(state.hoveredCountry && canonicalCountryId(chip.dataset.country!) === state.hoveredCountry),
      );
    });

    queueMapVisualRender();
    drawCountryOutlines();
    drawLabels();
    syncMapFlagStates();
  }

  function syncFlagFocusHighlights(): void {
    countryChipElements.forEach((chip) => {
      chip.classList.toggle("is-flag-focused", state.flagFocusIds.has(canonicalCountryId(chip.dataset.country!)));
      chip.classList.toggle(
        "is-flag-out-of-focus",
        state.flagFocusScopeIds.size > 0 && !state.flagFocusScopeIds.has(canonicalCountryId(chip.dataset.country!)),
      );
    });
    mapFlags.syncFocus(state.flagFocusIds, state.flagFocusScopeIds);

    const nextCountryFocusIsolation = state.flagFocusIds.size > 0 && state.flagFocusScopeIds.size > 0;
    if (hasCountryFocusIsolation || nextCountryFocusIsolation) {
      queueMapVisualRender(currentZoomTransform(), { updateLabels: false });
    } else {
      queueMapFlagRender();
    }
    hasCountryFocusIsolation = nextCountryFocusIsolation;
    drawLabels();
  }

  function drawCountryOutlines(): void {
    if (!hoverLayer) return;

    const featuresByKey = new Map<string, any>();
    [state.activeCountry, state.hoveredCountry].forEach((countryId) => {
      if (!countryId) return;
      countryIdsFor(countryId)
        .map((id) => visualFeatureForCountry(id) ?? state.featureByKey.get(id))
        .filter(Boolean)
        .forEach((feature) => featuresByKey.set(keyForFeature(feature), feature));
    });

    const duration = motionDuration(COUNTRY_OUTLINE_ANIMATION_MS);
    const applyActiveOutline = (selection: any): void => {
      if (duration <= 0) {
        selection
          .style("opacity", 0.96)
          .style("stroke-width", `${COUNTRY_OUTLINE_ACTIVE_WIDTH}px`);
        return;
      }

      selection
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .style("opacity", 0.96)
        .style("stroke-width", `${COUNTRY_OUTLINE_ACTIVE_WIDTH}px`);
    };

    hoverLayer
      .selectAll(".country-outline")
      .data([...featuresByKey.values()], keyForFeature)
      .join(
        (enter: any) => {
          const entered = enter
            .append("path")
            .attr("class", "country-outline")
            .attr("data-country-outline", keyForFeature)
            .attr("d", path)
            .style("opacity", 0)
            .style("stroke-width", `${COUNTRY_OUTLINE_ENTER_WIDTH}px`);
          applyActiveOutline(entered);
          return entered;
        },
        (update: any) => {
          update
            .interrupt()
            .attr("class", "country-outline")
            .attr("data-country-outline", keyForFeature)
            .attr("d", path);
          applyActiveOutline(update);
          return update;
        },
        (exit: any) => {
          exit.interrupt();
          if (duration <= 0) {
            exit.remove();
            return;
          }

          exit
            .transition()
            .duration(duration)
            .ease(d3.easeCubicIn)
            .style("opacity", 0)
            .style("stroke-width", `${COUNTRY_OUTLINE_ENTER_WIDTH}px`)
            .remove();
        },
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
        if (!entry || !hasFlag(entry[1])) return null;

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
    mapFlags.syncFocus(state.flagFocusIds, state.flagFocusScopeIds);
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

  function hideCountryCard(): void {
    countryCard.hidden = true;
  }

  function shouldRevealTierSelectionCard(): boolean {
    return countryCardBelowMapQuery.matches;
  }

  function setCountryCardVisibility(visible: boolean): void {
    if (visible) {
      showCountryCard();
    } else {
      hideCountryCard();
    }
  }

  function renderCountryCardForTier(
    tierId: TierId,
    { reveal = true, scroll = true }: CardRenderOptions = {},
  ): void {
    setCountryCardVisibility(reveal);
    const tier = tierArrangement.tier(tierId);
    countryCard.innerHTML = renderCountryCardForTierMarkup(tier);
    if (reveal && scroll) revealCountryCardBelowMap();
  }

  function renderCountryCardForScene(
    scene: SceneKey = state.scene,
    { reveal = true, scroll = true }: CardRenderOptions = {},
  ): void {
    const tierId = activeTierForScene(scene);
    if (tierId) {
      renderCountryCardForTier(tierId, { reveal, scroll });
      return;
    }

    setCountryCardVisibility(reveal);
    countryCard.innerHTML = renderCountryCardForSceneMarkup(scene);
    if (reveal && scroll) revealCountryCardBelowMap();
  }

  function renderCountryCardForCountry(meta: Pick<CountryMeta, "id" | "code" | "name">): void {
    showCountryCard();
    const tierId = tierArrangement.directTierForCountry(meta.id);
    const tier = tierId ? tierArrangement.tier(tierId) : null;
    countryCard.innerHTML = renderCountryCardForCountryMarkup(
      meta,
      tier,
      countryContextFor(meta, tier),
    );
    revealCountryCardBelowMap();
  }

  function revealCountryCardBelowMap(): void {
    if (!countryCardBelowMapQuery.matches) return;

    window.requestAnimationFrame(() => {
      if (!countryCard.hidden) {
        countryCard.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  // ─── map overlays ─────────────────────────────────────────────────────────────

  function drawConnections(): void {}

  function drawLabels(scale: number = currentZoomTransform().k): void {
    if (!labelLayer) return;

    const labelsById = new Map<string, LabelDatum>();
    const addLabel = (id: string): void => {
      const label = labelForCountry(id);
      if (!label) return;

      labelsById.set(label.id, label);
    };

    state.flagFocusIds.forEach((id) => addLabel(id));

    if (scale >= ALL_COUNTRY_LABEL_MIN_ZOOM_SCALE) {
      state.visualFeatures.forEach((feature) => addLabel(keyForFeature(feature)));
    }

    if (state.activeCountry) addLabel(state.activeCountry);
    if (state.hoveredCountry) addLabel(state.hoveredCountry);

    const labels = [...labelsById.values()];
    const labelShadowOffset = labelShadowOffsetForScale(scale);
    const duration = motionDuration(COUNTRY_LABEL_ANIMATION_MS);
    const labelKey = (item: LabelDatum): string => item.id;
    const labelClass = (item: LabelDatum, baseClass: string): string => (
      item.isMicrostate ? `${baseClass} ${baseClass}--microstate` : baseClass
    );
    const applyBaseLabelAttrs = (selection: any, baseClass: string): any => selection
      .attr("class", (item: LabelDatum) => labelClass(item, baseClass))
      .attr("data-country-label", (item: LabelDatum) => item.id)
      .attr("data-microstate-label", (item: LabelDatum) => String(item.isMicrostate))
      .attr("x", (item: LabelDatum) => labelXForScale(item, scale))
      .attr("y", (item: LabelDatum) => labelYForScale(item))
      .attr("text-anchor", labelTextAnchorFor)
      .attr("dominant-baseline", "middle")
      .style("font-size", (item: LabelDatum) => labelFontSizeForScale(item, scale))
      .text((item: LabelDatum) => item.text);
    const animateLabelIn = (selection: any, finalOpacity: number): void => {
      if (duration <= 0) {
        selection.style("opacity", finalOpacity);
        return;
      }

      selection
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .style("opacity", finalOpacity)
        .style("font-size", (item: LabelDatum) => labelFontSizeForScale(item, scale));
    };
    const animateLabelOut = (selection: any): void => {
      selection.interrupt();
      if (duration <= 0) {
        selection.remove();
        return;
      }

      selection
        .transition()
        .duration(duration)
        .ease(d3.easeCubicIn)
        .style("opacity", 0)
        .style("font-size", (item: LabelDatum) => labelFontSizeForScale(item, scale, COUNTRY_LABEL_ENTER_SCALE))
        .remove();
    };

    labelLayer
      .selectAll(".country-label-shadow")
      .data(labels, labelKey)
      .join(
        (enter: any) => {
          const entered = applyBaseLabelAttrs(enter.append("text"), "country-label-shadow")
            .attr("dx", labelShadowOffset)
            .attr("dy", labelShadowOffset)
            .style("opacity", 0)
            .style("font-size", (item: LabelDatum) => labelFontSizeForScale(item, scale, COUNTRY_LABEL_ENTER_SCALE));
          animateLabelIn(entered, 0.95);
          return entered;
        },
        (update: any) => applyBaseLabelAttrs(update.interrupt(), "country-label-shadow")
          .attr("dx", labelShadowOffset)
          .attr("dy", labelShadowOffset)
          .style("opacity", 0.95),
        animateLabelOut,
      );

    labelLayer
      .selectAll(".country-label")
      .data(labels, labelKey)
      .join(
        (enter: any) => {
          const entered = applyBaseLabelAttrs(enter.append("text"), "country-label")
            .style("opacity", 0)
            .style("font-size", (item: LabelDatum) => labelFontSizeForScale(item, scale, COUNTRY_LABEL_ENTER_SCALE));
          animateLabelIn(entered, 1);
          return entered;
        },
        (update: any) => applyBaseLabelAttrs(update.interrupt(), "country-label")
          .style("opacity", 1),
        animateLabelOut,
      )
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

  function shouldPlaceLabelRightOfFlag(item: LabelDatum): boolean {
    const code = flagCodeForCountry(item.id);
    return Boolean(state.mapFlagsMode && code && hasFlag(code));
  }

  function labelRightOfFlagOffsetForScale(scale: number): number {
    const flagRadius = (MAP_FLAG_SIZE_PX * mapFlagScaleForZoom(scale)) / 2;
    return (flagRadius + COUNTRY_LABEL_FLAG_GAP_PX) / scale;
  }

  function mapFlagScaleForZoom(scale: number): number {
    const zoomRange = Math.max(1, MAP_FLAG_FULL_SIZE_ZOOM_SCALE - 1);
    const progress = Math.max(0, Math.min(1, (scale - 1) / zoomRange));
    const easedProgress = Math.sqrt(progress);
    return MAP_FLAG_MIN_SCALE + (1 - MAP_FLAG_MIN_SCALE) * easedProgress;
  }

  function flagCodeForCountry(countryId: string): string | null {
    const meta = tierArrangement.metaForCountry(countryId);
    if (meta) return meta.code;
    return tierArrangement.entryForCountry(countryId)?.[1] ?? null;
  }

  function labelForCountry(countryId: string): LabelDatum | null {
    const id = canonicalCountryId(countryId);
    if (isAliasCountryId(id)) return null;

    const feature = visualFeatureForCountry(id) ?? state.featureByKey.get(id);
    const meta = tierArrangement.metaForCountry(id);
    const entry = meta ? null : tierArrangement.entryForCountry(id);
    const name = meta?.name ?? entry?.[2] ?? feature?.properties?.name;
    if (!feature || !name) return null;

    const layout = layoutForFeature(feature);
    if (!layout) return null;

    return {
      id,
      text: name,
      centroid: layout.centroid,
      isMicrostate: MICROSTATE_COUNTRY_IDS.has(id),
    };
  }

  // ─── scene management ─────────────────────────────────────────────────────────

  function focusScene(
    scene: SceneKey,
    options: { intro?: boolean; revealCard?: boolean; scrollCard?: boolean } = {},
  ): void {
    if (options.intro && state.userTouched) return;
    const revealCard = options.revealCard ?? shouldRevealTierSelectionCard();
    const scrollCard = options.scrollCard ?? revealCard;

    state.scene = scene;
    sceneTabs.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.scene === scene);
    });

    if (scene === "world") {
      state.activeTier = null;
      state.activeCountry = null;
      state.hoveredCountry = null;
      state.selectedIds = selectedCountrySet(cumulativeIdsFor("friends"));
      setSelectedTierFlagScope(scene);
      updateHighlights();
      drawConnections();
      renderCountryCardForScene(scene, { reveal: revealCard, scroll: scrollCard });
      applyZoomTransform(d3.zoomIdentity, 900);
      return;
    }

    const ids = sceneIdsFor(scene)!;
    state.activeCountry = null;
    state.hoveredCountry = null;
    state.activeTier = tierArrangement.hasTier(scene) ? scene : null;
    state.selectedIds = selectedCountrySet(ids);
    setSelectedTierFlagScope(scene);
    updateHighlights();

    if (state.activeTier) {
      renderCountryCardForTier(state.activeTier, { reveal: revealCard, scroll: scrollCard });
      drawConnections();
    } else {
      renderCountryCardForScene(scene, { reveal: revealCard, scroll: scrollCard });
      drawConnections();
    }

    fitToCountries(ids, options.intro ? 1400 : 900, fitOptionsForScene(scene));
  }

  function fitToCountries(
    ids: string[],
    duration = 900,
    { bottomPad = 0, topPad = 0, europeOnly = false, world = false }: FitOptions = {},
  ): void {
    if (world) {
      applyZoomTransform(d3.zoomIdentity, duration);
      return;
    }

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

  function mapTranslateExtent(): [[number, number], [number, number]] {
    const xPad = width * MAP_TRANSLATE_EXTENT_PADDING_RATIO;
    const yPad = height * MAP_TRANSLATE_EXTENT_PADDING_RATIO;
    return [[-xPad, -yPad], [width + xPad, height + yPad]];
  }

  function fitOptionsForScene(scene: SceneKey = state.scene): FitOptions {
    if (scene === "world") return {};
    if (scene === "friends") return { world: true };
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

  function motionDuration(duration: number): number {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
  }

  // ─── event listeners ──────────────────────────────────────────────────────────

  sceneTabs.addEventListener("click", (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-scene]");
    if (!button?.dataset.scene) return;
    state.userTouched = true;
    focusScene(button.dataset.scene as SceneKey, { scrollCard: false });
  });

  sceneTabs.addEventListener("focusin", (event: FocusEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-scene]");
    if (button?.dataset.scene) focusFlagsForScene(button.dataset.scene as SceneKey);
  });

  sceneTabs.addEventListener("focusout", (event: FocusEvent) => {
    if (!sceneTabs.contains(event.relatedTarget as Node | null)) {
      restoreSelectedTierFlagScope();
    } else {
      restoreFlagFocusFromElement(event.relatedTarget as Element | null);
    }
  });

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    sceneTabs.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        if (!button.dataset.scene) return;
        focusFlagsForScene(button.dataset.scene as SceneKey);
        previewScene(button.dataset.scene as SceneKey);
      });
    });
    sceneTabs.addEventListener("mouseleave", () => {
      restoreScenePreview();
      restoreSelectedTierFlagScope();
    });
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

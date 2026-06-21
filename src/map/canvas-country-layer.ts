import type { TierId } from "../domain/tiered-europe";
import { TIER_COLORS } from "../ui/tier-appearance";

interface CanvasCountryLayerOptions {
  canvas: HTMLCanvasElement;
  d3: any;
  projection: any;
  pointRadius: number;
  keyForFeature: (feature: any) => string;
  tierForFeature: (feature: any) => TierId | undefined;
}

interface CanvasCountryLayerSize {
  width: number;
  height: number;
}

interface CanvasCountryLayerDrawOptions extends CanvasCountryLayerSize {
  features: any[];
  transform: any;
  selectedIds: ReadonlySet<string>;
  focusScopeIds: ReadonlySet<string>;
  hasActiveFocusIds: boolean;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface CountryVisualState {
  alpha: number;
  selectedProgress: number;
  mutedFillProgress: number;
}

interface AnimatedCountryVisualState {
  current: CountryVisualState;
  from: CountryVisualState;
  target: CountryVisualState;
  startedAt: number;
}

const BASE_FILL = "#bfd0df";
const BASE_STROKE: RgbColor & { a: number } = { r: 2, g: 52, b: 95, a: 0.78 };
const HIGHLIGHT_STROKE = "#f0b800";
const MUTED_ALPHA = 0.26;
const BASE_STROKE_WIDTH = 0.42;
const HIGHLIGHT_STROKE_WIDTH = 1.08;
const COUNTRY_STATE_ANIMATION_MS = 220;
const HIGHLIGHT_STROKE_RGB = hexToRgb(HIGHLIGHT_STROKE);
const BASE_FILL_RGB = hexToRgb(BASE_FILL);

export function createCanvasCountryLayer({
  canvas,
  d3,
  projection,
  pointRadius,
  keyForFeature,
  tierForFeature,
}: CanvasCountryLayerOptions) {
  const context = canvas.getContext("2d", { alpha: true });
  const canvasPath = context
    ? d3.geoPath(projection, context).pointRadius(pointRadius)
    : null;
  const svgPath = d3.geoPath(projection).pointRadius(pointRadius);

  let renderRevision = 0;
  let pathCache = new Map<string, Path2D>();
  let latestDrawOptions: CanvasCountryLayerDrawOptions | null = null;
  let animationFrame: number | null = null;
  const animatedStates = new Map<string, AnimatedCountryVisualState>();
  const colorCache = new Map<string, RgbColor>();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const setSize = ({ width, height }: CanvasCountryLayerSize): void => {
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
      pathCache = new Map();
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
      pathCache = new Map();
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = "";
  };

  const draw = ({
    features,
    transform,
    selectedIds,
    focusScopeIds,
    hasActiveFocusIds,
    width,
    height,
  }: CanvasCountryLayerDrawOptions): void => {
    if (!context || !canvasPath || width <= 0 || height <= 0) return;

    latestDrawOptions = {
      features,
      transform,
      selectedIds,
      focusScopeIds,
      hasActiveFocusIds,
      width,
      height,
    };
    updateAnimatedTargets(latestDrawOptions, performance.now());
    drawFrame(performance.now());
  };

  const drawFrame = (now: number): void => {
    if (!context || !canvasPath || !latestDrawOptions) return;

    const {
      features,
      transform,
      selectedIds,
      focusScopeIds,
      hasActiveFocusIds,
      width,
      height,
    } = latestDrawOptions;
    const dpr = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.scale(dpr, dpr);
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);
    drawCountries(features, selectedIds, focusScopeIds, hasActiveFocusIds, transform.k, now);
    context.restore();

    canvas.dataset.renderRevision = String(++renderRevision);
    canvas.dataset.renderTransform = `${transform.x}|${transform.y}|${transform.k}`;
    canvas.dataset.focusScopeCount = String(focusScopeIds.size);
    canvas.dataset.hasActiveFocusIds = String(hasActiveFocusIds);
    canvas.dataset.stateAnimation = hasActiveAnimations(now) ? "active" : "idle";

    if (hasActiveAnimations(now)) {
      scheduleAnimationFrame();
    } else if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };

  const drawCountries = (
    features: any[],
    selectedIds: ReadonlySet<string>,
    focusScopeIds: ReadonlySet<string>,
    hasActiveFocusIds: boolean,
    scale: number,
    now: number,
  ): void => {
    if (!context || !canvasPath) return;

    const hasSelection = selectedIds.size > 0;
    const hasActiveFocusScope = hasActiveFocusIds && focusScopeIds.size > 0;
    const strokeScale = Math.max(scale, 0.001);
    context.lineJoin = "round";

    for (const feature of features) {
      const key = keyForFeature(feature);
      const isInActiveFocusScope = hasActiveFocusScope && focusScopeIds.has(key);
      const isOutOfActiveFocusScope = hasActiveFocusScope && !focusScopeIds.has(key);
      const isSelected = selectedIds.has(key) && !isOutOfActiveFocusScope;
      const isMuted =
        isOutOfActiveFocusScope ||
        (hasSelection && !isSelected && !isInActiveFocusScope);
      const visualState = visualStateForKey(key, {
        alpha: isMuted ? MUTED_ALPHA : 1,
        selectedProgress: isSelected ? 1 : 0,
        mutedFillProgress: isOutOfActiveFocusScope ? 1 : 0,
      }, now);
      context.globalAlpha = visualState.alpha;
      context.fillStyle = fillForFeature(feature, visualState.mutedFillProgress);
      context.strokeStyle = strokeForProgress(visualState.selectedProgress);
      context.lineWidth =
        (BASE_STROKE_WIDTH +
          (HIGHLIGHT_STROKE_WIDTH - BASE_STROKE_WIDTH) * visualState.selectedProgress) /
        strokeScale;
      const featurePath = pathForFeature(feature);
      if (featurePath) {
        context.fill(featurePath);
        context.stroke(featurePath);
      } else {
        context.beginPath();
        canvasPath(feature);
        context.fill();
        context.stroke();
      }
    }

    context.globalAlpha = 1;
  };

  const pathForFeature = (feature: any): Path2D | null => {
    if (typeof Path2D === "undefined") return null;

    const key = keyForFeature(feature);
    const cached = pathCache.get(key);
    if (cached) return cached;

    const pathData = svgPath(feature);
    if (!pathData) return null;

    try {
      const featurePath = new Path2D(pathData);
      pathCache.set(key, featurePath);
      return featurePath;
    } catch {
      return null;
    }
  };

  const fillForFeature = (feature: any, mutedFillProgress: number): string => {
    const tierId = tierForFeature(feature);
    const fill = colorFor(tierId ? TIER_COLORS[tierId] : BASE_FILL);
    return rgba(
      lerp(fill.r, BASE_FILL_RGB.r, mutedFillProgress),
      lerp(fill.g, BASE_FILL_RGB.g, mutedFillProgress),
      lerp(fill.b, BASE_FILL_RGB.b, mutedFillProgress),
      1,
    );
  };

  return { setSize, draw };

  function updateAnimatedTargets(
    options: CanvasCountryLayerDrawOptions,
    now: number,
  ): void {
    const nextKeys = new Set<string>();
    const hasSelection = options.selectedIds.size > 0;
    const hasActiveFocusScope = options.hasActiveFocusIds && options.focusScopeIds.size > 0;

    for (const feature of options.features) {
      const key = keyForFeature(feature);
      const isInActiveFocusScope = hasActiveFocusScope && options.focusScopeIds.has(key);
      const isOutOfActiveFocusScope = hasActiveFocusScope && !options.focusScopeIds.has(key);
      const isSelected = options.selectedIds.has(key) && !isOutOfActiveFocusScope;
      const isMuted =
        isOutOfActiveFocusScope ||
        (hasSelection && !isSelected && !isInActiveFocusScope);
      const target: CountryVisualState = {
        alpha: isMuted ? MUTED_ALPHA : 1,
        selectedProgress: isSelected ? 1 : 0,
        mutedFillProgress: isOutOfActiveFocusScope ? 1 : 0,
      };
      nextKeys.add(key);

      const existing = animatedStates.get(key);
      if (!existing) {
        animatedStates.set(key, {
          current: target,
          from: target,
          target,
          startedAt: now,
        });
        continue;
      }

      if (countryVisualStatesEqual(existing.target, target)) continue;

      const current = prefersReducedMotion()
        ? target
        : interpolateCountryVisualState(existing, now);
      animatedStates.set(key, {
        current,
        from: current,
        target,
        startedAt: now,
      });
    }

    for (const key of animatedStates.keys()) {
      if (!nextKeys.has(key)) animatedStates.delete(key);
    }
  }

  function visualStateForKey(
    key: string,
    fallback: CountryVisualState,
    now: number,
  ): CountryVisualState {
    const state = animatedStates.get(key);
    if (!state) return fallback;

    if (prefersReducedMotion()) {
      state.current = state.target;
      return state.target;
    }

    state.current = interpolateCountryVisualState(state, now);
    return state.current;
  }

  function hasActiveAnimations(now: number): boolean {
    if (prefersReducedMotion()) return false;
    for (const state of animatedStates.values()) {
      if (animationProgress(state.startedAt, now) < 1) return true;
    }
    return false;
  }

  function scheduleAnimationFrame(): void {
    if (animationFrame !== null) return;
    animationFrame = window.requestAnimationFrame((now) => {
      animationFrame = null;
      drawFrame(now);
    });
  }

  function interpolateCountryVisualState(
    state: AnimatedCountryVisualState,
    now: number,
  ): CountryVisualState {
    const progress = easeOutCubic(animationProgress(state.startedAt, now));
    return {
      alpha: lerp(state.from.alpha, state.target.alpha, progress),
      selectedProgress: lerp(state.from.selectedProgress, state.target.selectedProgress, progress),
      mutedFillProgress: lerp(state.from.mutedFillProgress, state.target.mutedFillProgress, progress),
    };
  }

  function countryVisualStatesEqual(
    first: CountryVisualState,
    second: CountryVisualState,
  ): boolean {
    return (
      first.alpha === second.alpha &&
      first.selectedProgress === second.selectedProgress &&
      first.mutedFillProgress === second.mutedFillProgress
    );
  }

  function strokeForProgress(progress: number): string {
    return rgba(
      lerp(BASE_STROKE.r, HIGHLIGHT_STROKE_RGB.r, progress),
      lerp(BASE_STROKE.g, HIGHLIGHT_STROKE_RGB.g, progress),
      lerp(BASE_STROKE.b, HIGHLIGHT_STROKE_RGB.b, progress),
      lerp(BASE_STROKE.a, 1, progress),
    );
  }

  function colorFor(color: string): RgbColor {
    const cached = colorCache.get(color);
    if (cached) return cached;

    const parsed = hexToRgb(color);
    colorCache.set(color, parsed);
    return parsed;
  }

  function prefersReducedMotion(): boolean {
    return reducedMotionQuery.matches;
  }
}

function animationProgress(startedAt: number, now: number): number {
  return Math.max(0, Math.min(1, (now - startedAt) / COUNTRY_STATE_ANIMATION_MS));
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(
    normalized.length === 3
      ? normalized.split("").map((char) => `${char}${char}`).join("")
      : normalized,
    16,
  );

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(r: number, g: number, b: number, a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

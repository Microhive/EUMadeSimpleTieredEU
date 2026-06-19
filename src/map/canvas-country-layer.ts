import type { TierId } from "../domain/tiered-europe";
import { TIER_COLORS } from "../ui/tier-appearance";

interface CanvasCountryLayerOptions {
  canvas: HTMLCanvasElement;
  d3: any;
  projection: any;
  pointRadius: number;
  keyForFeature: (feature: any) => string;
  tierForFeature: (feature: any) => TierId | undefined;
  countryIdsFor: (countryId: string) => string[];
}

interface CanvasCountryLayerSize {
  width: number;
  height: number;
}

interface CanvasCountryLayerDrawOptions extends CanvasCountryLayerSize {
  features: any[];
  transform: any;
  selectedIds: ReadonlySet<string>;
  activeCountry: string | null;
  hoveredCountry: string | null;
}

const BASE_FILL = "#bfd0df";
const BASE_STROKE = "rgba(2, 52, 95, 0.78)";
const HIGHLIGHT_STROKE = "rgba(255, 244, 168, 0.86)";
const MUTED_ALPHA = 0.26;
const BASE_STROKE_WIDTH = 0.42;
const HIGHLIGHT_STROKE_WIDTH = 0.82;

export function createCanvasCountryLayer({
  canvas,
  d3,
  projection,
  pointRadius,
  keyForFeature,
  tierForFeature,
  countryIdsFor,
}: CanvasCountryLayerOptions) {
  const context = canvas.getContext("2d", { alpha: true });
  const canvasPath = context
    ? d3.geoPath(projection, context).pointRadius(pointRadius)
    : null;
  const svgPath = d3.geoPath(projection).pointRadius(pointRadius);

  let renderRevision = 0;
  let pathCache = new Map<string, Path2D>();

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
    activeCountry,
    hoveredCountry,
    width,
    height,
  }: CanvasCountryLayerDrawOptions): void => {
    if (!context || !canvasPath || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.scale(dpr, dpr);
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);
    drawCountries(features, selectedIds, activeCountry, hoveredCountry, transform.k);
    context.restore();

    canvas.dataset.renderRevision = String(++renderRevision);
    canvas.dataset.renderTransform = `${transform.x}|${transform.y}|${transform.k}`;
  };

  const drawCountries = (
    features: any[],
    selectedIds: ReadonlySet<string>,
    activeCountry: string | null,
    hoveredCountry: string | null,
    scale: number,
  ): void => {
    if (!context || !canvasPath) return;

    const hasSelection = selectedIds.size > 0;
    const activeIds = activeCountry ? countryIdsFor(activeCountry) : [];
    const hoveredIds = hoveredCountry ? countryIdsFor(hoveredCountry) : [];
    const strokeScale = Math.max(scale, 0.001);
    context.lineJoin = "round";

    for (const feature of features) {
      const key = keyForFeature(feature);
      const isLifted = activeIds.includes(key) || hoveredIds.includes(key);
      if (isLifted) continue;

      const isSelected = selectedIds.has(key);
      context.globalAlpha = hasSelection && !isSelected ? MUTED_ALPHA : 1;
      context.fillStyle = fillForFeature(feature);
      context.strokeStyle = isSelected ? HIGHLIGHT_STROKE : BASE_STROKE;
      context.lineWidth =
        (isSelected ? HIGHLIGHT_STROKE_WIDTH : BASE_STROKE_WIDTH) / strokeScale;
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

  const fillForFeature = (feature: any): string => {
    const tierId = tierForFeature(feature);
    return tierId ? TIER_COLORS[tierId] : BASE_FILL;
  };

  return { setSize, draw };
}

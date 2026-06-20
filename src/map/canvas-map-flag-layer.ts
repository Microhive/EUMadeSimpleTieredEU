import {
  createCanvasFlagSprites,
  type CanvasFlagBadgeVariant,
} from "./canvas-flag-sprites";

export interface MapFlagDatum {
  id: string;
  code: string;
  name: string;
  centroid: [number, number];
  inTierList: boolean;
}

export interface MapFlagHit {
  id: string;
  name: string;
  src: string;
  clientX: number;
  clientY: number;
  size: number;
}

interface MapFlagRenderItem extends MapFlagDatum {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  renderSize: number;
  renderHitRadius: number;
  src: string;
  visible: boolean;
  isFocused: boolean;
  isInFocusScope: boolean;
}

interface MapFlagDebugHitbox {
  id: string;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  size: number;
  inTierList: boolean;
  isFocused: boolean;
  isInFocusScope: boolean;
  variant: CanvasFlagBadgeVariant;
}

interface MapFlagDebugLayer extends HTMLElement {
  __mapFlagHitboxes?: MapFlagDebugHitbox[];
}

interface TransformLike {
  apply(point: [number, number]): [number, number];
  k?: number;
}

interface MapViewport {
  width: number;
  height: number;
}

interface CanvasMapFlagLayerOptions {
  canvas: HTMLCanvasElement;
  layer: HTMLElement;
  mapWrap: HTMLElement;
  flagImageSrc: (code: string) => string;
  badgeSize: number;
  imageSize: number;
  hitRadius: number;
  viewportBuffer: number;
  sizeScaleForZoom: (zoomScale: number) => number;
  onImageReady: () => void;
}

const FLAG_CANVAS_FADE_OUT_MS = 180;

export function createCanvasMapFlagLayer({
  canvas,
  layer,
  mapWrap,
  flagImageSrc,
  badgeSize,
  imageSize,
  hitRadius,
  viewportBuffer,
  sizeScaleForZoom,
  onImageReady,
}: CanvasMapFlagLayerOptions) {
  const context = canvas.getContext("2d", { alpha: true });
  const debugLayer = layer as MapFlagDebugLayer;
  const imageCache = new Map<string, HTMLImageElement>();
  const sprites = createCanvasFlagSprites({ badgeSize, imageSize });

  let enabled = false;
  let renderRevision = 0;
  let items: MapFlagRenderItem[] = [];
  let hoveredId: string | null = null;
  let draggingId: string | null = null;
  let hasActiveFocusScope = false;
  let hasActiveFocusIds = false;
  let clearTimer: ReturnType<typeof window.setTimeout> | null = null;

  const setEnabled = (nextEnabled: boolean): void => {
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }

    enabled = nextEnabled;
    layer.classList.toggle("is-visible", enabled);
    canvas.classList.toggle("is-visible", enabled);
    layer.dataset.renderMode = enabled ? "canvas" : "off";
    canvas.dataset.renderMode = enabled ? "canvas" : "off";

    if (!enabled) {
      hoveredId = null;
      draggingId = null;
      hasActiveFocusIds = false;
      hasActiveFocusScope = false;
      mapWrap.classList.remove("has-map-flag-hover");
      scheduleCanvasClear();
    }

    syncMetadata();
  };

  const setFlags = (flags: MapFlagDatum[]): void => {
    if (!enabled) {
      items = [];
      syncMetadata();
      return;
    }

    items = flags.map((flag) => {
      const src = flagImageSrc(flag.code);
      primeImage(src);
      return {
        ...flag,
        x: flag.centroid[0],
        y: flag.centroid[1],
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        renderSize: badgeSize,
        renderHitRadius: hitRadius,
        src,
        visible: true,
        isFocused: false,
        isInFocusScope: false,
      };
    });
    syncMetadata();
  };

  const syncTierPresence = (isInTierList: (countryId: string) => boolean): void => {
    items.forEach((item) => {
      item.inTierList = isInTierList(item.id);
    });
    syncMetadata();
  };

  const syncFocus = (focusedIds: ReadonlySet<string>, focusScopeIds: ReadonlySet<string>): void => {
    hasActiveFocusIds = focusedIds.size > 0;
    hasActiveFocusScope = focusScopeIds.size > 0;
    items.forEach((item) => {
      item.isFocused = focusedIds.has(item.id);
      item.isInFocusScope = focusScopeIds.has(item.id);
    });
    layer.dataset.flagFocusScopeCount = String(focusScopeIds.size);
    syncMetadata();
  };

  const position = (transform: TransformLike, viewport: MapViewport): void => {
    if (!enabled) {
      syncMetadata();
      return;
    }

    const mapRect = mapWrap.getBoundingClientRect();
    const displayScale = flagDisplayScaleForTransform(transform);
    const renderSize = badgeSize * displayScale;
    const renderHitRadius = Math.max(14, hitRadius * displayScale);

    items.forEach((item) => {
      const [screenX, screenY] = transform.apply([item.x, item.y]);
      const visible = isWithinViewport(screenX, screenY, viewport);
      item.screenX = screenX;
      item.screenY = screenY;
      item.clientX = mapRect.left + screenX;
      item.clientY = mapRect.top + screenY;
      item.renderSize = renderSize;
      item.renderHitRadius = renderHitRadius;
      item.visible = visible;
    });
    syncMetadata();
  };

  const draw = (transform: TransformLike, viewport: MapViewport): void => {
    if (!context || viewport.width <= 0 || viewport.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (!enabled) {
      canvas.dataset.renderRevision = String(++renderRevision);
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    position(transform, viewport);

    context.save();
    context.scale(dpr, dpr);

    for (const item of items) {
      if (!item.visible) continue;

      const image = primeImage(item.src);
      const sprite = sprites.spriteFor(image, badgeVariantFor(item), dpr);
      const spriteScale = item.renderSize / badgeSize;
      const cssWidth = sprite.cssWidth * spriteScale;
      const cssHeight = sprite.cssHeight * spriteScale;
      const x = Math.round(item.screenX - sprite.offsetX * spriteScale);
      const y = Math.round(item.screenY - sprite.offsetY * spriteScale);
      context.drawImage(sprite.canvas, x, y, cssWidth, cssHeight);
    }

    context.restore();
    context.globalAlpha = 1;
    context.filter = "none";
    canvas.dataset.renderRevision = String(++renderRevision);
  };

  const hitTest = (clientX: number, clientY: number): MapFlagHit | null => {
    if (!enabled || !items.length) return null;

    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (!item.visible) continue;

      const distance = Math.hypot(clientX - item.clientX, clientY - item.clientY);
      if (distance <= item.renderHitRadius) {
        return {
          id: item.id,
          name: item.name,
          src: item.src,
          clientX: item.clientX,
          clientY: item.clientY,
          size: item.renderSize,
        };
      }
    }

    return null;
  };

  const setHovered = (countryId: string | null): boolean => {
    if (hoveredId === countryId) return false;

    hoveredId = countryId;
    mapWrap.classList.toggle("has-map-flag-hover", Boolean(hoveredId));
    return true;
  };

  const clearHover = (): string | null => {
    const previousId = hoveredId;
    setHovered(null);
    return previousId;
  };

  const setDragging = (countryId: string | null): boolean => {
    if (draggingId === countryId) return false;
    draggingId = countryId;
    return true;
  };

  const isEventOnFlag = (event: { clientX?: number; clientY?: number }): boolean => {
    if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return false;
    return hitTest(event.clientX, event.clientY) !== null;
  };

  const primeImage = (src: string): HTMLImageElement | null => {
    if (!src) return null;

    const cached = imageCache.get(src);
    if (cached) return cached;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      sprites.clear();
      onImageReady();
    };
    image.src = src;
    imageCache.set(src, image);
    return image;
  };

  const clearCanvas = (): void => {
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.renderRevision = String(++renderRevision);
  };

  const scheduleCanvasClear = (): void => {
    clearTimer = window.setTimeout(() => {
      clearTimer = null;
      if (enabled) return;

      items = [];
      clearCanvas();
      syncMetadata();
    }, FLAG_CANVAS_FADE_OUT_MS);
  };

  const badgeVariantFor = (item: MapFlagRenderItem): CanvasFlagBadgeVariant => {
    if (hoveredId === item.id) return "hovered";
    if (draggingId === item.id) return "muted";
    if (item.isFocused) return "selected";
    if (hasActiveFocusScope && !item.isInFocusScope) {
      if (hasActiveFocusIds) return "muted";
      return item.inTierList ? "dimmed" : "muted";
    }
    return item.inTierList ? "normal" : "muted";
  };

  const isWithinViewport = (screenX: number, screenY: number, viewport: MapViewport): boolean => (
    screenX >= -viewportBuffer &&
    screenX <= viewport.width + viewportBuffer &&
    screenY >= -viewportBuffer &&
    screenY <= viewport.height + viewportBuffer
  );

  const flagDisplayScaleForTransform = (transform: TransformLike): number => {
    const zoomScale = typeof transform.k === "number" && Number.isFinite(transform.k)
      ? transform.k
      : 1;
    return Math.max(0.1, sizeScaleForZoom(zoomScale));
  };

  const syncMetadata = (): void => {
    const visibleFlags: MapFlagRenderItem[] = [];
    let tieredCount = 0;

    for (const item of items) {
      if (item.visible) visibleFlags.push(item);
      if (item.inTierList) tieredCount += 1;
    }

    layer.dataset.flagTotalCount = String(items.length);
    layer.dataset.flagVisibleCount = String(visibleFlags.length);
    layer.dataset.flagTieredCount = String(tieredCount);

    if (import.meta.env.DEV) {
      debugLayer.__mapFlagHitboxes = visibleFlags.map((item) => ({
        id: item.id,
        clientX: Number(item.clientX.toFixed(2)),
        clientY: Number(item.clientY.toFixed(2)),
        screenX: Number(item.screenX.toFixed(2)),
        screenY: Number(item.screenY.toFixed(2)),
        size: Number(item.renderSize.toFixed(2)),
        inTierList: item.inTierList,
        isFocused: item.isFocused,
        isInFocusScope: item.isInFocusScope,
        variant: badgeVariantFor(item),
      }));
    } else {
      delete debugLayer.__mapFlagHitboxes;
    }
  };

  return {
    setEnabled,
    setFlags,
    syncTierPresence,
    syncFocus,
    position,
    draw,
    hitTest,
    setHovered,
    clearHover,
    setDragging,
    isEventOnFlag,
  };
}

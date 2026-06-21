export type CanvasFlagBadgeVariant = "normal" | "dimmed" | "muted" | "selected" | "hovered";

export interface CanvasFlagBadgeSprite {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  offsetX: number;
  offsetY: number;
}

interface CanvasFlagSpriteOptions {
  badgeSize: number;
  imageSize: number;
}

const SPRITE_PADDING_PX = 4;
const SHADOW_OFFSET_PX = 2;
const HOVER_SHADOW_OFFSET_PX = 3;
const DIMMED_ALPHA = 0.52;
const MUTED_ALPHA = 0.28;
const MUTED_FLAG_CONTRAST = 0.82;
const MUTED_FLAG_BRIGHTNESS = 0.92;

export function createCanvasFlagSprites({ badgeSize, imageSize }: CanvasFlagSpriteOptions) {
  const cache = new Map<string, CanvasFlagBadgeSprite>();

  const clear = (): void => {
    cache.clear();
  };

  const spriteFor = (
    image: HTMLImageElement | null,
    variant: CanvasFlagBadgeVariant,
    dpr: number,
  ): CanvasFlagBadgeSprite => {
    const imageReady = Boolean(image?.complete && image.naturalWidth > 0);
    const key = imageReady ? `${image!.src}|${variant}|${dpr}` : `placeholder|${variant}|${dpr}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const sprite = renderSprite(imageReady ? image : null, variant, dpr, badgeSize, imageSize);
    cache.set(key, sprite);
    return sprite;
  };

  return { clear, spriteFor };
}

function renderSprite(
  image: HTMLImageElement | null,
  variant: CanvasFlagBadgeVariant,
  dpr: number,
  badgeSize: number,
  imageSize: number,
): CanvasFlagBadgeSprite {
  const radius = badgeSize / 2;
  const imageRadius = imageSize / 2;
  const cssWidth = badgeSize + SPRITE_PADDING_PX * 2;
  const cssHeight = cssWidth;
  const center = SPRITE_PADDING_PX + radius;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));

  const context = canvas.getContext("2d");
  if (!context) {
    return { canvas, cssWidth, cssHeight, offsetX: center, offsetY: center };
  }

  const isHovered = variant === "hovered";
  const isHighlighted = variant === "hovered" || variant === "selected";
  const isDimmed = variant === "dimmed";
  const isMuted = variant === "muted";
  const isSubdued = isDimmed || isMuted;
  context.scale(dpr, dpr);
  context.globalAlpha = isMuted ? MUTED_ALPHA : isDimmed ? DIMMED_ALPHA : 1;
  context.shadowColor = isSubdued ? "transparent" : "rgba(0, 0, 0, 0.44)";
  context.shadowOffsetX = isSubdued ? 0 : isHovered ? HOVER_SHADOW_OFFSET_PX : SHADOW_OFFSET_PX;
  context.shadowOffsetY = isSubdued ? 0 : isHovered ? HOVER_SHADOW_OFFSET_PX : SHADOW_OFFSET_PX;
  context.shadowBlur = 0;

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 248, 238, 0.92)";
  context.fill();

  context.shadowColor = "transparent";
  context.lineWidth = isHighlighted ? 3 : 2;
  context.strokeStyle = isHighlighted ? "#f0b800" : "rgba(8, 11, 15, 0.84)";
  context.stroke();

  if (image) {
    context.save();
    context.beginPath();
    context.arc(center, center, imageRadius, 0, Math.PI * 2);
    context.clip();
    drawFlagImage(context, image, center - imageRadius, center - imageRadius, imageSize, dpr, isMuted);
    context.restore();
  }

  return { canvas, cssWidth, cssHeight, offsetX: center, offsetY: center };
}

function drawFlagImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  dpr: number,
  isMuted: boolean,
): void {
  if (!isMuted) {
    context.drawImage(image, x, y, size, size);
    return;
  }

  context.drawImage(mutedFlagCanvas(image, size, dpr), x, y, size, size);
}

function mutedFlagCanvas(
  image: HTMLImageElement,
  size: number,
  dpr: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const pixelSize = Math.max(1, Math.round(size * dpr));
  canvas.width = pixelSize;
  canvas.height = pixelSize;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;

  context.drawImage(image, 0, 0, pixelSize, pixelSize);

  try {
    const imageData = context.getImageData(0, 0, pixelSize, pixelSize);
    const data = imageData.data;

    for (let index = 0; index < data.length; index += 4) {
      const gray = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
      const adjusted = clampChannel(((gray - 128) * MUTED_FLAG_CONTRAST + 128) * MUTED_FLAG_BRIGHTNESS);
      data[index] = adjusted;
      data[index + 1] = adjusted;
      data[index + 2] = adjusted;
    }

    context.putImageData(imageData, 0, 0);
  } catch {
    // If a browser ever refuses pixel access, fall back to a neutral mask so
    // muted flags never remain colorful.
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "rgb(146, 155, 160)";
    context.fillRect(0, 0, pixelSize, pixelSize);
  }

  return canvas;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

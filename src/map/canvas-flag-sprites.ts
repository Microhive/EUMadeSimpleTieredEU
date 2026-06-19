export type CanvasFlagBadgeVariant = "normal" | "muted" | "hovered";

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
  context.scale(dpr, dpr);
  context.globalAlpha = variant === "muted" ? 0.42 : 1;
  context.shadowColor = "rgba(0, 0, 0, 0.44)";
  context.shadowOffsetX = isHovered ? HOVER_SHADOW_OFFSET_PX : SHADOW_OFFSET_PX;
  context.shadowOffsetY = isHovered ? HOVER_SHADOW_OFFSET_PX : SHADOW_OFFSET_PX;
  context.shadowBlur = 0;

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 248, 238, 0.92)";
  context.fill();

  context.shadowColor = "transparent";
  context.lineWidth = isHovered ? 3 : 2;
  context.strokeStyle = isHovered ? "#f0b800" : "rgba(8, 11, 15, 0.84)";
  context.stroke();

  if (image) {
    context.save();
    context.beginPath();
    context.arc(center, center, imageRadius, 0, Math.PI * 2);
    context.clip();
    context.drawImage(
      image,
      center - imageRadius,
      center - imageRadius,
      imageSize,
      imageSize,
    );
    context.restore();
  }

  return { canvas, cssWidth, cssHeight, offsetX: center, offsetY: center };
}

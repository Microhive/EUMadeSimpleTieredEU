export interface MapVisualRenderRequest<TTransform = unknown> {
  transform: TTransform;
  includeMap: boolean;
  includeFlags: boolean;
  updateLabels: boolean;
}

export interface MapVisualRenderOptions {
  includeMap?: boolean;
  includeFlags?: boolean;
  updateLabels?: boolean;
}

export interface MapVisualRenderQueue<TTransform = unknown> {
  queue(transform?: TTransform, options?: MapVisualRenderOptions): void;
  queueFlags(transform?: TTransform): void;
}

interface MapVisualRenderQueueOptions<TTransform> {
  currentTransform: () => TTransform;
  render: (request: MapVisualRenderRequest<TTransform>) => void;
  scheduleFrame?: (callback: FrameRequestCallback) => number;
}

export function createMapVisualRenderQueue<TTransform>({
  currentTransform,
  render,
  scheduleFrame = (callback) => window.requestAnimationFrame(callback),
}: MapVisualRenderQueueOptions<TTransform>): MapVisualRenderQueue<TTransform> {
  let frame: number | null = null;
  let pending: MapVisualRenderRequest<TTransform> | null = null;

  function queue(
    transform: TTransform = currentTransform(),
    {
      includeMap = true,
      includeFlags = true,
      updateLabels = true,
    }: MapVisualRenderOptions = {},
  ): void {
    pending = {
      transform,
      includeMap: Boolean(pending?.includeMap || includeMap),
      includeFlags: Boolean(pending?.includeFlags || includeFlags),
      updateLabels: Boolean(pending?.updateLabels || updateLabels),
    };
    if (frame !== null) return;

    frame = scheduleFrame(() => {
      const request = pending;
      pending = null;
      frame = null;
      if (request) render(request);
    });
  }

  function queueFlags(transform: TTransform = currentTransform()): void {
    queue(transform, {
      includeMap: false,
      includeFlags: true,
      updateLabels: false,
    });
  }

  return { queue, queueFlags };
}

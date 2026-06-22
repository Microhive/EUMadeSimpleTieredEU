export function setupSceneTabsScale(sceneTabs: HTMLElement): void {
  const container =
    sceneTabs.closest<HTMLElement>(".map-toolbar-primary") ??
    sceneTabs.closest<HTMLElement>(".map-toolbar");
  if (!container) return;

  let frame: number | null = null;

  const scheduleUpdate = (): void => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      updateSceneTabsScale(sceneTabs, container);
    });
  };

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
  }

  window.addEventListener("resize", scheduleUpdate);
  document.fonts.ready.then(scheduleUpdate).catch(() => {});
  scheduleUpdate();
}

function updateSceneTabsScale(sceneTabs: HTMLElement, container: HTMLElement): void {
  const currentScale =
    Number.parseFloat(getComputedStyle(sceneTabs).getPropertyValue("--scene-tabs-scale")) || 1;
  const fullWidth = measureSceneTabsFullWidth(sceneTabs);
  const availableWidth = getSceneTabsAvailableWidth(sceneTabs, container);
  const nextScale = fullWidth > availableWidth ? Math.max(0.68, availableWidth / fullWidth) : 1;
  const roundedScale = Number(nextScale.toFixed(3));

  if (Math.abs(roundedScale - currentScale) > 0.001) {
    sceneTabs.style.setProperty("--scene-tabs-scale", roundedScale.toString());
  }
}

function measureSceneTabsFullWidth(sceneTabs: HTMLElement): number {
  const previousScale = sceneTabs.style.getPropertyValue("--scene-tabs-scale");

  sceneTabs.style.setProperty("--scene-tabs-scale", "1");
  const fullWidth = sceneTabs.getBoundingClientRect().width;

  if (previousScale) {
    sceneTabs.style.setProperty("--scene-tabs-scale", previousScale);
  } else {
    sceneTabs.style.removeProperty("--scene-tabs-scale");
  }

  return fullWidth;
}

function getSceneTabsAvailableWidth(sceneTabs: HTMLElement, container: HTMLElement): number {
  const toolbarStyle = getComputedStyle(container);
  const gap =
    Number.parseFloat(toolbarStyle.columnGap) ||
    Number.parseFloat(toolbarStyle.gap) ||
    0;
  const sceneTabsRect = sceneTabs.getBoundingClientRect();
  const visibleSiblings = [...container.children]
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== sceneTabs)
    .filter((child) => getComputedStyle(child).display !== "none")
    .filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.bottom > sceneTabsRect.top + 1 && rect.top < sceneTabsRect.bottom - 1;
    });
  const siblingWidth = visibleSiblings.reduce(
    (total, child) => total + child.getBoundingClientRect().width,
    0,
  );

  return Math.max(0, container.clientWidth - siblingWidth - gap * visibleSiblings.length);
}

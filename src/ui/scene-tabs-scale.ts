export function setupSceneTabsScale(sceneTabs: HTMLElement): void {
  const toolbar = sceneTabs.closest<HTMLElement>(".map-toolbar");
  if (!toolbar) return;

  let frame: number | null = null;

  const scheduleUpdate = (): void => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      updateSceneTabsScale(sceneTabs, toolbar);
    });
  };

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(toolbar);
    sceneTabs.querySelectorAll("button").forEach((button) => observer.observe(button));
  }

  window.addEventListener("resize", scheduleUpdate);
  document.fonts.ready.then(scheduleUpdate).catch(() => {});
  scheduleUpdate();
}

function updateSceneTabsScale(sceneTabs: HTMLElement, toolbar: HTMLElement): void {
  const currentScale =
    Number.parseFloat(getComputedStyle(sceneTabs).getPropertyValue("--scene-tabs-scale")) || 1;
  const fullWidth = sceneTabs.getBoundingClientRect().width / currentScale;
  const availableWidth = getSceneTabsAvailableWidth(sceneTabs, toolbar);
  const nextScale = fullWidth > availableWidth ? Math.max(0.68, availableWidth / fullWidth) : 1;
  const roundedScale = Number(nextScale.toFixed(3));

  if (Math.abs(roundedScale - currentScale) > 0.001) {
    sceneTabs.style.setProperty("--scene-tabs-scale", roundedScale.toString());
  }
}

function getSceneTabsAvailableWidth(sceneTabs: HTMLElement, toolbar: HTMLElement): number {
  const toolbarStyle = getComputedStyle(toolbar);
  const gap =
    Number.parseFloat(toolbarStyle.columnGap) ||
    Number.parseFloat(toolbarStyle.gap) ||
    0;
  const visibleSiblings = [...toolbar.children]
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== sceneTabs)
    .filter((child) => getComputedStyle(child).display !== "none");
  const siblingWidth = visibleSiblings.reduce(
    (total, child) => total + child.getBoundingClientRect().width,
    0,
  );

  return Math.max(0, toolbar.clientWidth - siblingWidth - gap * visibleSiblings.length);
}

/**
 * Playwright tests for map interaction behaviour.
 *
 * Two complementary concerns are covered:
 *
 * 1. Click/tap equivalence — every action that works via mouse click should
 *    also work via a touch tap (scene tabs, country chips, country paths).
 *
 * 2. Touch pan/zoom policy — a single-finger drag must NOT move the map
 *    (so page scrolling still works on mobile), while a two-finger pinch MUST
 *    zoom the map, and the mouse wheel MUST zoom the map on desktop.
 */
import { test, expect, devices, type Locator, type Page } from "@playwright/test";

// `defaultBrowserType` can't be overridden inside a describe block, so strip it.
const { defaultBrowserType: _d, ...desktop } = devices["Desktop Chrome"];
const { defaultBrowserType: _m, ...mobile } = devices["Pixel 5"];

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Wait for the map to render and the intro fly-in animation to complete. */
async function waitForMap(page: Page): Promise<void> {
  // Wait until at least one country <path> exists in the SVG
  await page.waitForSelector("#mapSvg [data-country]", { timeout: 15_000 });
  // The intro transition runs for 1 400 ms; wait a bit longer to be safe
  await page.waitForTimeout(1_800);
}

/** Return the current D3 zoom scale (k) stored on #mapSvg. */
async function getZoomScale(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as any).d3.zoomTransform(
        document.querySelector("#mapSvg")!
      ).k as number
  );
}

/** Return the current D3 zoom transform stored on #mapSvg. */
async function getZoomTransform(
  page: Page
): Promise<{ x: number; y: number; k: number }> {
  return page.evaluate(() => {
    const transform = (window as any).d3.zoomTransform(
      document.querySelector("#mapSvg")!
    );
    return { x: transform.x, y: transform.y, k: transform.k };
  });
}

/** Return the current D3 zoom translate-x stored on #mapSvg. */
async function getZoomX(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as any).d3.zoomTransform(
        document.querySelector("#mapSvg")!
      ).x as number
  );
}

async function getCanvasPaintStats(
  page: Page,
  selector = ".map-canvas"
): Promise<{ width: number; height: number; paintedSamples: number }> {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return { width: canvas.width, height: canvas.height, paintedSamples: 0 };

    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    let paintedSamples = 0;

    for (let y = 0; y < height; y += 24) {
      for (let x = 0; x < width; x += 24) {
        if (data[(y * width + x) * 4 + 3] > 0) paintedSamples += 1;
      }
    }

    return { width, height, paintedSamples };
  });
}

async function getCanvasRenderRevision(
  page: Page,
  selector = ".map-canvas"
): Promise<number> {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement) => {
    return Number(canvas.dataset.renderRevision ?? 0);
  });
}

async function getCanvasRenderTransform(
  page: Page
): Promise<{ x: number; y: number; k: number }> {
  return page.locator(".map-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const [x = 0, y = 0, k = 1] = (canvas.dataset.renderTransform ?? "0|0|1")
      .split("|")
      .map(Number);
    return { x, y, k };
  });
}

async function getCanvasComputedTransform(page: Page): Promise<string> {
  return page.locator(".map-canvas").evaluate((canvas) => {
    return getComputedStyle(canvas).transform;
  });
}

/**
 * Dispatch a raw touch-drag sequence directly on #mapSvg by injecting
 * TouchEvents via page.evaluate.  This bypasses the browser's native
 * touch-action handling so we can test D3's zoom filter in isolation.
 *
 * Each entry in `fingers` describes one touch point:
 *   id  — unique touch identifier
 *   x1/y1 — start position (client coords)
 *   x2/y2 — end position (client coords)
 */
async function dispatchTouchDrag(
  page: Page,
  fingers: Array<{ id: number; x1: number; y1: number; x2: number; y2: number }>
): Promise<void> {
  await page.evaluate((fingers) => {
    const el = document.querySelector("#mapSvg")!;
    const mk = (id: number, x: number, y: number): Touch =>
      new Touch({
        identifier: id,
        target: el,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        screenX: x,
        screenY: y,
        radiusX: 10,
        radiusY: 10,
        force: 1,
        rotationAngle: 0,
      });

    const start = fingers.map((f) => mk(f.id, f.x1, f.y1));
    const end = fingers.map((f) => mk(f.id, f.x2, f.y2));

    el.dispatchEvent(
      new TouchEvent("touchstart", {
        touches: start,
        targetTouches: start,
        changedTouches: start,
        bubbles: true,
        cancelable: true,
      })
    );
    el.dispatchEvent(
      new TouchEvent("touchmove", {
        touches: end,
        targetTouches: end,
        changedTouches: end,
        bubbles: true,
        cancelable: true,
      })
    );
    el.dispatchEvent(
      new TouchEvent("touchend", {
        touches: [],
        targetTouches: [],
        changedTouches: end,
        bubbles: true,
        cancelable: true,
      })
    );
  }, fingers);
}

async function dragLocatorToLocator(
  page: Page,
  source: Locator,
  target: Locator
): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Cannot drag: source or target is not visible.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 24 }
  );
  await page.mouse.up();
}

type CanvasFlagHitbox = {
  id: string;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  size: number;
  inTierList: boolean;
  isFocused: boolean;
  isInFocusScope: boolean;
  variant: "normal" | "muted" | "selected" | "hovered";
};

async function getCanvasFlagHitbox(
  page: Page,
  countryId: string
): Promise<CanvasFlagHitbox> {
  await page.waitForFunction((id) => {
    const layer = document.querySelector<HTMLElement>(".map-flag-layer");
    const flags = JSON.parse(layer?.dataset.flagHitboxes ?? "[]") as CanvasFlagHitbox[];
    return flags.some((flag) => flag.id === id);
  }, countryId);

  const flag = await page.locator(".map-flag-layer").evaluate(
    (layer, id) => {
      const flags = JSON.parse((layer as HTMLElement).dataset.flagHitboxes ?? "[]") as CanvasFlagHitbox[];
      return flags.find((item) => item.id === id) ?? null;
    },
    countryId
  );

  if (!flag) throw new Error(`Canvas flag ${countryId} is not visible.`);
  return flag;
}

async function waitForCanvasFlagVariant(
  page: Page,
  countryId: string,
  variant: CanvasFlagHitbox["variant"]
): Promise<CanvasFlagHitbox> {
  await expect
    .poll(async () => (await getCanvasFlagHitbox(page, countryId)).variant)
    .toBe(variant);
  return getCanvasFlagHitbox(page, countryId);
}

async function hoverCanvasFlag(page: Page, countryId: string): Promise<CanvasFlagHitbox> {
  const flag = await getCanvasFlagHitbox(page, countryId);
  await page.mouse.move(flag.clientX, flag.clientY);
  await page.waitForFunction((id) => {
    const layer = document.querySelector<HTMLElement>(".map-flag-layer");
    const flags = JSON.parse(layer?.dataset.flagHitboxes ?? "[]") as CanvasFlagHitbox[];
    return flags.find((item) => item.id === id)?.variant === "hovered";
  }, countryId);
  return getCanvasFlagHitbox(page, countryId);
}

async function dragCanvasFlagToLocator(
  page: Page,
  countryId: string,
  target: Locator
): Promise<void> {
  const source = await getCanvasFlagHitbox(page, countryId);
  const targetBox = await target.boundingBox();

  if (!targetBox) {
    throw new Error("Cannot drag: target is not visible.");
  }

  await page.mouse.move(source.clientX, source.clientY);
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 24 }
  );
  await expect(page.locator(".map-flag-drag-ghost")).toBeVisible();
  await page.mouse.up();
}

// ─── first paint content ─────────────────────────────────────────────────────

test.describe("first paint content", () => {
  test.use({ ...desktop, javaScriptEnabled: false });

  test("renders the value pills before app JavaScript runs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const benefitPills = page.locator("#benefitPills");

    await expect(benefitPills).toContainText("Open doors");
    await expect(benefitPills).toContainText("Progress before full membership");
    await expect(benefitPills).toContainText("Shared standards");
    await expect(benefitPills).toContainText("One foundation of values");
    await expect(benefitPills).toContainText("Strategic weight");
    await expect(benefitPills).toContainText("More reach with trusted partners");
    await expect(benefitPills).toContainText("Forward motion");
    await expect(benefitPills).toContainText("A path inward over time");
  });

  test("renders tier titles, capability pills, summaries, and flag skeletons before app JavaScript runs", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const tierDeck = page.locator("#tierDeck");

    await expect(tierDeck.locator(".tier-card")).toHaveCount(4);
    await expect(tierDeck).toContainText("Inner Union");
    await expect(tierDeck).toContainText("Foreign policy");
    await expect(tierDeck).toContainText("A frontrunner group for common defence");
    await expect(tierDeck).toContainText("European Union");
    await expect(tierDeck).toContainText("Single market");
    await expect(tierDeck).toContainText("The shared rights and obligations of membership");
    await expect(tierDeck).toContainText("Associate Membership");
    await expect(tierDeck).toContainText("Customs alignment");
    await expect(tierDeck).toContainText("A bridge tier for candidates");
    await expect(tierDeck).toContainText("European Community + Friends");
    await expect(tierDeck).toContainText("Crisis response");
    await expect(tierDeck).toContainText("A wider democratic circle");
    await expect(tierDeck.locator(".country-chip-skeleton")).toHaveCount(48);
  });

  test("renders the map legend and EU stars before app JavaScript runs", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapWrap = page.locator(".map-wrap");
    const legend = page.locator("#legend");
    const loadingStars = page.locator("#mapLoadingStars");

    await expect(legend.locator(".legend-item")).toHaveCount(4);
    await expect(legend).toContainText("Community + Friends");
    await expect(legend).toContainText("Associate");
    await expect(legend).toContainText("European Union");
    await expect(legend).toContainText("Inner Union");

    const [legendBox, mapBox, sourcesBox, sourcesParent] = await Promise.all([
      legend.boundingBox(),
      mapWrap.boundingBox(),
      page.locator("#sources").boundingBox(),
      page.locator("#sources").evaluate((element) => element.parentElement?.className ?? ""),
    ]);
    expect(legendBox).not.toBeNull();
    expect(mapBox).not.toBeNull();
    expect(legendBox!.x).toBeLessThan(mapBox!.x + 40);
    if (sourcesParent.includes("map-wrap") && sourcesBox) {
      expect(legendBox!.y + legendBox!.height).toBeLessThan(sourcesBox.y - 6);
    } else {
      expect(legendBox!.y + legendBox!.height).toBeGreaterThan(mapBox!.y + mapBox!.height - 40);
    }

    await expect(loadingStars).toBeVisible();
    await expect(loadingStars).toHaveClass(/is-visible/);
    await expect(loadingStars.locator(".map-loading-star")).toHaveCount(12);
    await expect(loadingStars.locator(".map-loading-star").first()).toHaveCSS(
      "background-color",
      "rgb(255, 204, 0)"
    );
    await expect(page.locator("#countryCard")).toBeHidden();
  });

  test("renders the desktop disclaimer inside the map before app JavaScript runs", async ({ page }) => {
    await page.route(/\/src\/main\.ts$/, (route) => route.abort());
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const sourcesParent = await page.locator("#sources").evaluate((element) => {
      return element.parentElement?.className ?? "";
    });
    expect(sourcesParent).toContain("map-wrap");

    const position = await page.locator("#sources").evaluate((element) => {
      return getComputedStyle(element).position;
    });
    expect(position).toBe("absolute");
  });
});

// ─── scene tab — click vs tap ─────────────────────────────────────────────────

test.describe("scene tab — desktop click", () => {
  test.use(desktop);

  test("clicking the EU tab marks it active and updates the country card", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    const tab = page.locator('[data-scene="eu"]');
    await tab.click();

    await expect(tab).toHaveClass(/is-active/);
    await expect(page.locator("#countryCard")).toContainText("European Union");
  });

  test("hovering another scene tab previews it without changing the selected tab", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    const euTab = page.locator('[data-scene="eu"]');
    const communityTab = page.locator('[data-scene="friends"]');
    const austria = page.locator('#mapSvg [data-country="040"]');
    const canada = page.locator('#mapSvg [data-country="124"]');
    const countryCard = page.locator("#countryCard");

    await expect(euTab).toHaveClass(/is-active/);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(canada).toHaveClass(/is-muted/);
    await expect(countryCard).toBeHidden();

    await communityTab.hover();

    await expect(canada).toHaveClass(/is-highlight/);
    await expect(countryCard).toBeHidden();

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(euTab).toHaveClass(/is-active/);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(canada).toHaveClass(/is-muted/);
    await expect(countryCard).toBeHidden();
  });

  test("hovering scene tabs preserves an active raised country", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const germany = page.locator('#mapSvg [data-country="276"]');
    const communityTab = page.locator('[data-scene="friends"]');
    const liftedCountries = page.locator("#mapSvg .hover-layer .country-hover-lift");

    await germany.click();
    await page.waitForTimeout(750);

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(germany).toHaveClass(/is-selected/);
    await expect(liftedCountries).toHaveCount(1);

    await communityTab.hover();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(germany).toHaveClass(/is-selected/);
    await expect(liftedCountries).toHaveCount(1);

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(germany).toHaveClass(/is-selected/);
    await expect(liftedCountries).toHaveCount(1);
  });
});

test.describe("scene tab — mobile tap", () => {
  // Pixel 5: hasTouch=true, viewport 393×851
  test.use(mobile);

  test("tapping the EU tab marks it active and updates the country card", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    const tab = page.locator('[data-scene="eu"]');
    await tab.tap();

    await expect(tab).toHaveClass(/is-active/);
    await expect(page.locator("#countryCard")).toContainText("European Union");
  });

  test("viewport height changes preserve the selected tier framing", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.setViewportSize({ width: 393, height: 760 });
    await page.waitForTimeout(250);

    const afterResize = await getZoomTransform(page);

    await page.locator('[data-scene="eu"]').tap();
    await page.waitForTimeout(950);

    const afterRetap = await getZoomTransform(page);
    expect(afterResize.k).toBeCloseTo(afterRetap.k, 2);
    expect(afterResize.x).toBeCloseTo(afterRetap.x, 1);
    expect(afterResize.y).toBeCloseTo(afterRetap.y, 1);
  });
});

// ─── country chip — click vs tap ─────────────────────────────────────────────

test.describe("country chip — desktop click", () => {
  test.use(desktop);

  test("clicking a country chip shows that country in the card", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    // Pick the first chip and remember its label
    const chip = page.locator("[data-country]").first();
    const name = (await chip.getAttribute("aria-label")) ?? "";
    await chip.click();

    await expect(page.locator("#countryCard")).toContainText(name, {
      ignoreCase: true,
    });
  });

  test("hovering a country chip gives its flag the focused highlight", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const chip = page.locator('.country-chip[data-country="276"]');
    await chip.hover();

    await expect(chip).toHaveClass(/is-flag-focused/);
    await expect
      .poll(() => chip.evaluate((element) => getComputedStyle(element).boxShadow))
      .toContain("rgb(240, 184, 0)");
  });
});

test.describe("benefit modal — desktop click", () => {
  test.use(desktop);

  test("keeps the close button sticky while modal content scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 480 });
    await page.goto("/");
    await waitForMap(page);

    const modal = page.locator("#benefitModal");
    const closeButton = modal.locator(".modal-close");

    await page.locator('.benefit-pill[data-pill="open-doors"]').click();
    await expect(modal).toBeVisible();
    await expect(closeButton).toHaveCSS("position", "sticky");

    const before = await closeButton.boundingBox();
    if (!before) throw new Error("Expected modal close button to be visible.");

    const scrollTop = await modal.evaluate((element: HTMLDialogElement) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    await page.waitForTimeout(80);

    const after = await closeButton.boundingBox();
    if (!after) throw new Error("Expected modal close button to remain visible after scrolling.");
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(Math.abs(after.x + after.width - before.x - before.width)).toBeLessThan(2);

    await closeButton.click();
    await expect(modal).not.toBeVisible();

    await page.locator('.benefit-pill[data-pill="shared-standards"]').click();
    await expect(modal).toBeVisible();
    await expect.poll(() => modal.evaluate((element: HTMLDialogElement) => element.scrollTop)).toBe(0);
  });
});

test.describe("benefit modal — mobile tap", () => {
  test.use(mobile);

  test("keeps the scroll viewport inside the dialog with the close button halfway outside", async ({ page }) => {
    await page.setViewportSize({ width: 449, height: 360 });
    await page.goto("/");
    await waitForMap(page);

    const modal = page.locator("#benefitModal");
    const modalInner = modal.locator(".modal-inner");
    const closeButton = modal.locator(".modal-close");

    await page.locator('.benefit-pill[data-pill="shared-standards"]').tap();
    await expect(modal).toBeVisible();
    await expect(closeButton).toHaveCSS("position", "absolute");

    const modalBox = await modal.boundingBox();
    const innerBox = await modalInner.boundingBox();
    const closeBox = await closeButton.boundingBox();
    if (!modalBox || !innerBox || !closeBox) throw new Error("Expected modal, inner viewport, and close button to be visible.");

    expect(innerBox.y).toBeGreaterThanOrEqual(modalBox.y + 2);
    expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(modalBox.y + modalBox.height - 2);
    expect(Math.abs(closeBox.x + closeBox.width / 2 - (modalBox.x + modalBox.width / 2))).toBeLessThan(2);
    expect(Math.abs(closeBox.y + closeBox.height / 2 - (modalBox.y + modalBox.height))).toBeLessThan(2);

    const scrollMetrics = await modalInner.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
      };
    });
    expect(scrollMetrics.overflowY).toBe("auto");
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

    const clipping = await modalInner.evaluate((element) => {
      const keyIdea = element.querySelector<HTMLElement>(".modal-key-idea-block");
      if (!keyIdea) throw new Error("Expected key idea block to exist.");

      element.scrollTop = 70;
      const innerRect = element.getBoundingClientRect();
      const keyIdeaRect = keyIdea.getBoundingClientRect();
      const probeX = innerRect.left + 24;
      const probeY = innerRect.bottom + 8;
      const outsideElement = document.elementFromPoint(probeX, probeY);

      return {
        innerLeft: innerRect.left,
        innerRight: innerRect.right,
        keyIdeaLeft: keyIdeaRect.left,
        keyIdeaRight: keyIdeaRect.right,
        keyIdeaTop: keyIdeaRect.top,
        keyIdeaBottom: keyIdeaRect.bottom,
        scrollTop: element.scrollTop,
        viewportTop: innerRect.top,
        viewportBottom: innerRect.bottom,
        outsideProbeHitsKeyIdea: Boolean(outsideElement?.closest(".modal-key-idea-block")),
      };
    });

    expect(clipping.scrollTop).toBeGreaterThan(0);
    expect(clipping.keyIdeaLeft).toBeGreaterThan(clipping.innerLeft);
    expect(clipping.keyIdeaRight).toBeLessThan(clipping.innerRight);
    expect(clipping.keyIdeaTop).toBeLessThan(clipping.viewportBottom);
    expect(clipping.keyIdeaBottom).toBeGreaterThan(clipping.viewportTop);
    expect(clipping.outsideProbeHitsKeyIdea).toBe(false);

    await closeButton.tap();
    await expect(modal).not.toBeVisible();

    await page.locator('.benefit-pill[data-pill="open-doors"]').tap();
    await expect(modal).toBeVisible();
    await expect.poll(() => modal.evaluate((element: HTMLDialogElement) => element.scrollTop)).toBe(0);
    await expect.poll(() => modalInner.evaluate((element) => element.scrollTop)).toBe(0);
  });

  test("opens centered in the viewport after the page has scrolled", async ({ page }) => {
    await page.setViewportSize({ width: 449, height: 640 });
    await page.goto("/");
    await waitForMap(page);

    const capability = page.locator('.tier-card[data-tier="inner"] [data-cap-key="Common defence"]');
    await capability.scrollIntoViewIfNeeded();

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);

    await capability.tap();

    const modal = page.locator("#benefitModal");
    await expect(modal).toBeVisible();

    const modalBox = await modal.boundingBox();
    const viewport = page.viewportSize();
    if (!modalBox || !viewport) throw new Error("Expected modal and viewport dimensions.");

    expect(Math.abs(modalBox.x + modalBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(modalBox.y + modalBox.height / 2 - viewport.height / 2)).toBeLessThan(2);
  });
});

test.describe("map rendering — desktop", () => {
  test.use(desktop);

  test("hydrates the static tier shell without replacing the tier deck", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const view = window as any;
      view.__tierDeckInnerHTMLWrites = 0;
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      if (!descriptor?.get || !descriptor.set) return;

      Object.defineProperty(Element.prototype, "innerHTML", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get!.call(this);
        },
        set(value) {
          if (this instanceof HTMLElement && this.id === "tierDeck") {
            view.__tierDeckInnerHTMLWrites += 1;
          }
          return descriptor.set!.call(this, value);
        },
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForMap(page);

    const tierDeckInnerHtmlWrites = await page.evaluate(() => (window as any).__tierDeckInnerHTMLWrites);
    expect(tierDeckInnerHtmlWrites).toBe(0);
  });

  test("preloads map topology and shows a loading shell until the map is ready", async ({
    page,
  }) => {
    let releaseTopology!: () => void;
    const topologyDelay = new Promise<void>((resolve) => {
      releaseTopology = resolve;
    });

    await page.route(/countries-50m\.json$/, async (route) => {
      await topologyDelay;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator('link[rel="preload"][href$="countries-110m.json"]')).toHaveCount(1);
    await expect(page.locator('link[rel="preload"][href$="countries-50m.json"]')).toHaveCount(1);
    await expect(page.locator("body")).toHaveClass(/is-loading/);
    await expect(page.locator(".map-wrap")).toHaveAttribute("aria-busy", "true");

    releaseTopology();
    await waitForMap(page);

    await expect(page.locator("body")).not.toHaveClass(/is-loading/);
    await expect(page.locator(".map-wrap")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".map-wrap")).toHaveClass(/is-map-ready/);
    await expect(page.locator("#countryCard")).toBeHidden();
  });

  test("docks the desktop disclaimer inside the map and offsets bottom overlays", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('[data-scene="eu"]').click();
    await expect(page.locator("#countryCard")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/has-map-sources-docked/);

    const sourcesParent = await page.locator("#sources").evaluate((element) => {
      return element.parentElement?.className ?? "";
    });
    expect(sourcesParent).toContain("map-wrap");

    const [sourcesBox, legendBox, countryCardBox] = await Promise.all([
      page.locator("#sources").boundingBox(),
      page.locator("#legend").boundingBox(),
      page.locator("#countryCard").boundingBox(),
    ]);

    expect(sourcesBox).not.toBeNull();
    expect(legendBox).not.toBeNull();
    expect(countryCardBox).not.toBeNull();
    expect(legendBox!.y + legendBox!.height).toBeLessThan(sourcesBox!.y - 6);
    expect(countryCardBox!.y + countryCardBox!.height).toBeLessThan(sourcesBox!.y - 6);
  });

  test("shows the pulsing EU stars while topology is pending", async ({
    page,
  }) => {
    let releaseTopology!: () => void;
    const topologyDelay = new Promise<void>((resolve) => {
      releaseTopology = resolve;
    });

    await page.route(/countries-50m\.json$/, async (route) => {
      await topologyDelay;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const loader = page.locator("#mapLoadingStars");
    const stars = loader.locator(".map-loading-star");
    await expect(loader).toBeVisible();
    await expect(loader).toHaveClass(/is-visible/);
    await expect(stars).toHaveCount(12);
    await expect(stars.first()).toHaveCSS("background-color", "rgb(255, 204, 0)");
    await expect(loader).toHaveCSS("animation-name", "eu-star-ring-breathe");
    await expect(stars.first()).toHaveCSS("animation-name", "eu-star-pulse");
    await expect(stars.first()).toHaveCSS("animation-duration", "1.1s");

    const mapBackdrop = await page.locator(".map-wrap").evaluate((element) => ({
      backgroundImage: getComputedStyle(element).backgroundImage,
      loadingOverlayImage: getComputedStyle(element, "::before").backgroundImage,
    }));
    expect(mapBackdrop.backgroundImage).not.toContain("radial-gradient");
    expect(mapBackdrop.loadingOverlayImage).not.toContain("radial-gradient");

    releaseTopology();
    await waitForMap(page);

    await expect(loader).not.toHaveClass(/is-visible/);
    await expect(page.locator("#countryCard")).toBeHidden();
  });

  test("does not rerender tier cards when topology data arrives", async ({
    page,
  }) => {
    let releaseTopology!: () => void;
    const topologyDelay = new Promise<void>((resolve) => {
      releaseTopology = resolve;
    });

    await page.route(/countries-50m\.json$/, async (route) => {
      await topologyDelay;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.tier-card[data-tier="inner"] .country-chip[data-country="276"]');

    await page.evaluate(() => {
      const view = window as any;
      view.__tierCardNodes = [...document.querySelectorAll("#tierDeck .tier-card")];
      view.__tierDeckChildListMutations = 0;
      view.__tierDeckObserver = new MutationObserver((records) => {
        view.__tierDeckChildListMutations += records.filter((record) => record.type === "childList").length;
      });
      view.__tierDeckObserver.observe(document.querySelector("#tierDeck")!, { childList: true });
    });

    releaseTopology();
    await waitForMap(page);

    const tierDeckWasStable = await page.evaluate(() => {
      const view = window as any;
      const currentTierCards = [...document.querySelectorAll("#tierDeck .tier-card")];
      view.__tierDeckObserver.disconnect();
      return (
        view.__tierDeckChildListMutations === 0 &&
        currentTierCards.length === view.__tierCardNodes.length &&
        currentTierCards.every((node, index) => node === view.__tierCardNodes[index])
      );
    });

    expect(tierDeckWasStable).toBe(true);
  });

  test("paints the high-detail country layer on canvas", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const canvas = page.locator(".map-canvas");
    await expect(canvas).toHaveCount(1);

    const stats = await getCanvasPaintStats(page);
    expect(stats.width).toBeGreaterThan(0);
    expect(stats.height).toBeGreaterThan(0);
    expect(stats.paintedSamples).toBeGreaterThan(100);

    await expect(page.locator('#mapSvg [data-country="112"]')).toHaveCSS("opacity", "0");
  });

  test("places Belgium in the European Union tier by default", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await expect(page.locator('.tier-card[data-tier="inner"] .country-chip[data-country="056"]')).toHaveCount(0);
    await expect(page.locator('.tier-card[data-tier="eu"] .country-chip[data-country="056"]')).toHaveCount(1);
    await expect(page.locator('#mapSvg [data-country="056"]')).toHaveClass(/tier-eu/);
    await expect(page.locator('#mapSvg [data-country="056"]')).not.toHaveClass(/tier-inner/);
  });

  test("adds a high-detail hover path for Faroe Islands", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const faroeIslands = page.locator('#mapSvg [data-country="234"]');
    const liftedCountries = page.locator("#mapSvg .hover-layer .country-hover-lift");

    await expect(faroeIslands).toHaveCount(1);
    await expect(faroeIslands).toHaveAttribute("data-quality", "high");

    await faroeIslands.dispatchEvent("mouseenter");

    await expect(faroeIslands).toHaveClass(/is-hovered/);
    await expect(faroeIslands).toHaveClass(/is-lift-source/);
    await expect(liftedCountries).toHaveCount(1);
  });
});

test.describe("tier editing drag — desktop", () => {
  test.use({ ...desktop, viewport: { width: 1280, height: 900 } });

  test("dragging a map flag into a tier card adds it as a chip", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#mapFlagsButton").click();
    await page.locator("#editToggle").click();

    const countryId = "112"; // Belarus
    const targetTier = "inner";
    const countryPath = page.locator(`#mapSvg [data-country="${countryId}"]`);
    const targetCard = page.locator(`.tier-card[data-tier="${targetTier}"]`);
    const targetChip = page.locator(
      `.tier-card[data-tier="${targetTier}"] .country-chip[data-country="${countryId}"]`
    );

    await expect(page.locator(".map-flag")).toHaveCount(0);
    await expect(page.locator(".map-flag-layer")).toHaveAttribute("data-render-mode", "canvas");
    await getCanvasFlagHitbox(page, countryId);
    await expect(countryPath).toHaveAttribute("data-quality", "standard");
    const standardGeometry = await countryPath.getAttribute("d");
    await expect(countryPath).toHaveCSS("opacity", "0");
    await expect(targetChip).toHaveCount(0);

    await dragCanvasFlagToLocator(page, countryId, targetCard);

    await expect(targetChip).toHaveCount(1);
    await expect(countryPath).toHaveClass(/tier-inner/);
    await expect(countryPath).toHaveAttribute("data-quality", "standard");
    expect(await countryPath.getAttribute("d")).toBe(standardGeometry);
  });

  test("dragging a tier chip between cards moves it and leaves editing responsive", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#editToggle").click();

    const countryId = "276"; // Germany
    const sourceTier = "inner";
    const targetTier = "eu";
    const sourceChip = page.locator(
      `.tier-card[data-tier="${sourceTier}"] .country-chip[data-country="${countryId}"]`
    );
    const targetCard = page.locator(`.tier-card[data-tier="${targetTier}"]`);
    const targetChip = page.locator(
      `.tier-card[data-tier="${targetTier}"] .country-chip[data-country="${countryId}"]`
    );

    await expect(sourceChip).toHaveCount(1);
    await expect(targetChip).toHaveCount(0);

    const sourceBox = await sourceChip.boundingBox();
    const targetBox = await targetCard.boundingBox();
    if (!sourceBox || !targetBox) {
      throw new Error("Cannot drag: source or target is not visible.");
    }

    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height / 2;
    const midX = startX + 18;
    const midY = startY + 18;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(midX, midY, { steps: 4 });

    const chipGhost = page.locator(".country-chip-drag-ghost");
    await expect(chipGhost).toBeVisible();
    const ghostBox = await chipGhost.boundingBox();
    if (!ghostBox) throw new Error("Expected chip drag ghost to have a bounding box.");
    expect(Math.abs(ghostBox.x + ghostBox.width / 2 - midX)).toBeLessThan(8);
    expect(Math.abs(ghostBox.y + ghostBox.height / 2 - midY)).toBeLessThan(8);

    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 24 }
    );
    await page.mouse.up();

    await expect(targetChip).toHaveCount(1);
    await expect(sourceChip).toHaveCount(0);
    await expect(page.locator(".country-drag-ghost")).toHaveCount(0);
    await expect(page.locator(".is-drop-target")).toHaveCount(0);

    await page.locator("#editToggle").click();
    await expect(page.locator("#editToggle")).toHaveAttribute("aria-pressed", "false");
  });

  test("dragging a hovered map flag between tiers still works", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#mapFlagsButton").click();
    await page.locator("#editToggle").click();

    const countryId = "276"; // Germany
    const sourceTier = "inner";
    const targetTier = "eu";
    const sourceChip = page.locator(
      `.tier-card[data-tier="${sourceTier}"] .country-chip[data-country="${countryId}"]`
    );
    const targetCard = page.locator(`.tier-card[data-tier="${targetTier}"]`);
    const targetChip = page.locator(
      `.tier-card[data-tier="${targetTier}"] .country-chip[data-country="${countryId}"]`
    );

    await hoverCanvasFlag(page, countryId);
    await page.waitForTimeout(120);
    await expect(sourceChip).toHaveCount(1);
    await expect(targetChip).toHaveCount(0);

    const flagRevisionBeforeDrag = await getCanvasRenderRevision(page, ".map-flag-canvas");
    const zoomBeforeDrag = await getZoomTransform(page);
    const source = await getCanvasFlagHitbox(page, countryId);
    const targetBox = await targetCard.boundingBox();
    if (!targetBox) {
      throw new Error("Cannot drag: target is not visible.");
    }

    await page.mouse.move(source.clientX, source.clientY);
    await page.mouse.down();
    await page.mouse.move(source.clientX + 8, source.clientY + 8, { steps: 4 });
    await expect(page.locator(".map-flag-drag-ghost")).toBeVisible();
    await expect
      .poll(() => getCanvasRenderRevision(page, ".map-flag-canvas"))
      .toBeGreaterThan(flagRevisionBeforeDrag);
    const zoomDuringDrag = await getZoomTransform(page);
    expect(zoomDuringDrag.k).toBeCloseTo(zoomBeforeDrag.k, 4);
    expect(zoomDuringDrag.x).toBeCloseTo(zoomBeforeDrag.x, 1);
    expect(zoomDuringDrag.y).toBeCloseTo(zoomBeforeDrag.y, 1);

    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 24 }
    );
    await page.mouse.up();

    await expect(targetChip).toHaveCount(1);
    await expect(sourceChip).toHaveCount(0);
    await expect(page.locator(`#mapSvg [data-country="${countryId}"]`)).toHaveClass(/tier-eu/);
  });

  test("clearing tiers removes every chip and can be shared", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://127.0.0.1:5173",
    });
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#editToggle").click();
    await page.locator("#clearTiersButton").click();

    await expect(page.locator(".country-chip")).toHaveCount(0);
    await expect(page.locator('#mapSvg [data-country="276"]')).not.toHaveClass(/tier-/);
    await expect(page.locator('#mapSvg [data-country="Crimea"]')).not.toHaveClass(/tier-/);

    await page.locator("#shareTiersButton").click();

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    const params = new URL(copiedUrl).searchParams;
    expect(params.get("inner")).toBe("");
    expect(params.get("eu")).toBe("");
    expect(params.get("associate")).toBe("");
    expect(params.get("friends")).toBe("");
  });

  test("query params replace the default tier assignments", async ({ page }) => {
    await page.goto("/?inner=276&eu=&associate=112&friends=");
    await waitForMap(page);

    await expect(page.locator('.tier-card[data-tier="inner"] .country-chip[data-country="276"]')).toHaveCount(1);
    await expect(page.locator('.tier-card[data-tier="associate"] .country-chip[data-country="112"]')).toHaveCount(1);
    await expect(page.locator('.tier-card[data-tier="eu"] .country-chip')).toHaveCount(0);
    await expect(page.locator('#mapSvg [data-country="112"]')).toHaveClass(/tier-associate/);
  });

  test("tier chip flags render inline instead of as image resources", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await expect(page.locator(".country-chip img.chip-flag")).toHaveCount(0);
    await expect(page.locator(".country-chip .chip-flag svg").first()).toBeVisible();
  });
});

test.describe("country chip — mobile tap", () => {
  test.use(mobile);

  test("tapping a country chip shows that country in the card", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    const chip = page.locator("[data-country]").first();
    const name = (await chip.getAttribute("aria-label")) ?? "";
    await chip.tap();

    await expect(page.locator("#countryCard")).toContainText(name, {
      ignoreCase: true,
    });
  });
});

// ─── map country path — click vs tap ─────────────────────────────────────────
// Germany (id "276") is large, always visible, and in the EU tier.

test.describe("map country path — desktop click", () => {
  test.use(desktop);

  test("country hover lifts the country without clearing the selected tier", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const germany = page.locator('#mapSvg [data-country="276"]');
    const austria = page.locator('#mapSvg [data-country="040"]');
    const hoverLift = page.locator("#mapSvg .hover-layer .country-hover-lift");
    const countryCard = page.locator("#countryCard");

    await expect(austria).toHaveClass(/is-highlight/);
    await expect(countryCard).toBeHidden();

    await germany.hover();

    await expect(germany).toHaveClass(/is-highlight/);
    await expect(germany).toHaveClass(/is-hovered/);
    await expect(germany).toHaveClass(/is-lift-source/);
    await expect(hoverLift).toHaveCount(1);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(austria).not.toHaveClass(/is-muted/);
    await expect(countryCard).toBeHidden();

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(germany).not.toHaveClass(/is-hovered/);
    await expect(germany).not.toHaveClass(/is-lift-source/);
    await expect(hoverLift).toHaveCount(0);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(countryCard).toBeHidden();
  });

  test("country hover does not update the card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('#mapSvg [data-country="276"]').hover();

    await expect(page.locator("#countryCard h2")).not.toContainText("Germany", {
      ignoreCase: true,
    });
  });

  test("country labels grow as the map zooms in", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('[data-scene="inner"]').click();
    await page.waitForTimeout(950);

    const germanyLabel = page.locator("#mapSvg .country-label").filter({ hasText: "Germany" }).first();
    await expect(germanyLabel).toBeVisible();

    const beforeBox = await germanyLabel.boundingBox();
    if (!beforeBox) throw new Error("Expected Germany label to have a bounding box.");

    await page.mouse.move(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2);
    await page.mouse.wheel(0, -1600);
    await page.waitForTimeout(300);

    const afterBox = await germanyLabel.boundingBox();
    if (!afterBox) throw new Error("Expected Germany label to remain visible.");
    expect(afterBox.height).toBeGreaterThan(beforeBox.height * 1.04);
  });

  test("map flags shrink in the world view and grow while zooming in", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('[data-scene="friends"]').click();
    await page.waitForTimeout(950);
    await page.locator("#mapFlagsButton").click();

    const before = await getCanvasFlagHitbox(page, "276");
    expect(before.size).toBeLessThan(30);

    await page.mouse.move(before.clientX, before.clientY);
    await page.mouse.wheel(0, -1800);
    await page.waitForTimeout(450);

    const after = await getCanvasFlagHitbox(page, "276");
    expect(after.size).toBeGreaterThan(before.size + 1);
    expect(after.size).toBeLessThanOrEqual(30);
  });

  test("map flags reflect tier presence and hover focus", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#mapFlagsButton").click();

    const germanyChip = page.locator('.country-chip[data-country="276"]');
    const austriaChip = page.locator('.country-chip[data-country="040"]');

    await expect(page.locator(".map-flag")).toHaveCount(0);
    await expect(page.locator(".map-flag-canvas")).toHaveCount(1);
    await expect(page.locator(".map-flag-layer")).toHaveAttribute("data-render-mode", "canvas");
    await expect(page.locator(".map-flag-canvas")).toHaveClass(/is-visible/);
    const flagCanvasTransition = await page.locator(".map-flag-canvas").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });
    expect(flagCanvasTransition.property).toContain("opacity");
    expect(flagCanvasTransition.duration).toContain("0.18s");

    const germanyFlag = await getCanvasFlagHitbox(page, "276");
    const austriaFlag = await getCanvasFlagHitbox(page, "040");
    const belarusFlag = await getCanvasFlagHitbox(page, "112");
    expect(germanyFlag.inTierList).toBe(true);
    expect(austriaFlag.inTierList).toBe(true);
    expect(belarusFlag.inTierList).toBe(false);
    expect(germanyFlag.isFocused).toBe(false);
    expect(austriaFlag.isFocused).toBe(false);
    expect(belarusFlag.isFocused).toBe(false);
    expect(germanyFlag.isInFocusScope).toBe(false);
    expect(austriaFlag.isInFocusScope).toBe(false);
    expect(belarusFlag.isInFocusScope).toBe(false);
    expect(germanyFlag.variant).toBe("normal");
    expect(austriaFlag.variant).toBe("normal");
    expect(belarusFlag.variant).toBe("muted");

    await page.locator('[data-scene="inner"]').hover();
    await expect(germanyChip).toHaveClass(/is-flag-focused/);
    await expect(germanyChip).not.toHaveClass(/is-flag-out-of-focus/);
    await expect(austriaChip).not.toHaveClass(/is-flag-focused/);
    await expect(austriaChip).toHaveClass(/is-flag-out-of-focus/);
    await waitForCanvasFlagVariant(page, "276", "selected");
    await waitForCanvasFlagVariant(page, "040", "muted");

    await page.locator('[data-scene="eu"]').hover();
    await expect(germanyChip).toHaveClass(/is-flag-focused/);
    await expect(austriaChip).toHaveClass(/is-flag-focused/);
    await expect(germanyChip).not.toHaveClass(/is-flag-out-of-focus/);
    await expect(austriaChip).not.toHaveClass(/is-flag-out-of-focus/);
    await waitForCanvasFlagVariant(page, "276", "selected");
    await waitForCanvasFlagVariant(page, "040", "selected");

    await page.mouse.move(1, 1);
    await waitForCanvasFlagVariant(page, "276", "normal");
    await waitForCanvasFlagVariant(page, "040", "normal");
    await expect(germanyChip).not.toHaveClass(/is-flag-focused/);
    await expect(austriaChip).not.toHaveClass(/is-flag-focused/);
    await expect(germanyChip).not.toHaveClass(/is-flag-out-of-focus/);
    await expect(austriaChip).not.toHaveClass(/is-flag-out-of-focus/);

    await page.locator('.tier-card[data-tier="inner"]').hover();
    await expect(germanyChip).toHaveClass(/is-flag-focused/);
    await expect(germanyChip).not.toHaveClass(/is-flag-out-of-focus/);
    await expect(austriaChip).not.toHaveClass(/is-flag-focused/);
    await expect(austriaChip).toHaveClass(/is-flag-out-of-focus/);
    await waitForCanvasFlagVariant(page, "276", "selected");
    await waitForCanvasFlagVariant(page, "040", "muted");

    await page.locator('.tier-card[data-tier="eu"]').hover();
    await waitForCanvasFlagVariant(page, "276", "selected");
    await waitForCanvasFlagVariant(page, "040", "selected");

    await austriaChip.hover();
    await waitForCanvasFlagVariant(page, "276", "normal");
    await waitForCanvasFlagVariant(page, "040", "selected");
    await expect(germanyChip).not.toHaveClass(/is-flag-focused/);
    await expect(germanyChip).not.toHaveClass(/is-flag-out-of-focus/);
    await expect(austriaChip).toHaveClass(/is-flag-focused/);
    await expect(austriaChip).not.toHaveClass(/is-flag-out-of-focus/);

    await page.locator('.tier-card[data-tier="eu"]').hover({ position: { x: 10, y: 10 } });
    await waitForCanvasFlagVariant(page, "276", "selected");
    await waitForCanvasFlagVariant(page, "040", "selected");
    await expect(germanyChip).toHaveClass(/is-flag-focused/);
    await expect(austriaChip).toHaveClass(/is-flag-focused/);

    const flagVisibilityStats = await page.locator(".map-flag-layer").evaluate((layer) => {
      const total = Number((layer as HTMLElement).dataset.flagTotalCount ?? 0);
      const visible = Number((layer as HTMLElement).dataset.flagVisibleCount ?? 0);
      return { total, hidden: total - visible };
    });
    expect(flagVisibilityStats.total).toBeGreaterThan(100);
    expect(flagVisibilityStats.hidden).toBeGreaterThan(0);
    expect(flagVisibilityStats.hidden).toBeLessThan(flagVisibilityStats.total);

    const flagPaintStats = await getCanvasPaintStats(page, ".map-flag-canvas");
    expect(flagPaintStats.paintedSamples).toBeGreaterThan(10);

    const hoveredBelarusFlag = await hoverCanvasFlag(page, "112");
    const belarusLabel = page.locator("#mapSvg .country-label").filter({ hasText: "Belarus" });
    await expect(belarusLabel).toBeVisible();
    const belarusLabelBox = await belarusLabel.boundingBox();
    if (!belarusLabelBox) throw new Error("Expected Belarus label to be visible.");
    expect(belarusLabelBox.x).toBeGreaterThan(hoveredBelarusFlag.clientX + hoveredBelarusFlag.size / 2 - 2);
    expect(Math.abs(belarusLabelBox.y + belarusLabelBox.height / 2 - hoveredBelarusFlag.clientY)).toBeLessThan(18);

    const hoveredGermanyFlag = await hoverCanvasFlag(page, "276");
    expect(hoveredGermanyFlag.variant).toBe("hovered");
    await page.locator('#mapSvg [data-country="276"]').hover();

    const stackOrder = await page.locator(".map-wrap").evaluate((wrap) => {
      const zIndexFor = (selector: string): number => {
        const element = wrap.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        return Number(getComputedStyle(element).zIndex);
      };

      return {
        mapCanvas: zIndexFor(".map-canvas"),
        mapSvg: zIndexFor("#mapSvg"),
        flagCanvas: zIndexFor(".map-flag-canvas"),
      };
    });
    expect(stackOrder.flagCanvas).toBeGreaterThan(stackOrder.mapSvg);
    expect(stackOrder.flagCanvas).toBeGreaterThan(stackOrder.mapCanvas);

    await expect(germanyChip).toHaveClass(/is-map-hovered/);

    const labelBox = await page.locator("#mapSvg .country-label").filter({ hasText: "Germany" }).boundingBox();
    if (!labelBox) throw new Error("Expected Germany label to be visible.");
    expect(labelBox.x).toBeGreaterThan(hoveredGermanyFlag.clientX + hoveredGermanyFlag.size / 2 - 2);
    expect(Math.abs(labelBox.y + labelBox.height / 2 - hoveredGermanyFlag.clientY)).toBeLessThan(18);

    await page.locator("#mapFlagsButton").click();
    await expect(page.locator(".map-flag-canvas")).not.toHaveClass(/is-visible/);
    await expect(page.locator(".map-flag-layer")).toHaveAttribute("data-render-mode", "off");
  });

  test("clicking a country on the map shows its info card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const germany = page.locator('#mapSvg [data-country="276"]');
    const austria = page.locator('#mapSvg [data-country="040"]');
    const liftedCountries = page.locator("#mapSvg .hover-layer .country-hover-lift");

    await germany.click();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(germany).toHaveClass(/is-selected/);
    await expect(germany).toHaveClass(/is-lift-source/);
    await expect(liftedCountries).toHaveCount(1);
    await expect
      .poll(() =>
        liftedCountries
          .first()
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("shape-rendering").toLowerCase()
          )
      )
      .toBe("geometricprecision");

    await page.waitForTimeout(750);
    await austria.hover();

    await expect(austria).toHaveClass(/is-hovered/);
    await expect(austria).toHaveClass(/is-lift-source/);
    await expect(germany).toHaveClass(/is-lift-source/);
    await expect(liftedCountries).toHaveCount(2);

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(austria).not.toHaveClass(/is-hovered/);
    await expect(austria).not.toHaveClass(/is-lift-source/);
    await expect(germany).toHaveClass(/is-lift-source/);
    await expect(liftedCountries).toHaveCount(1);
  });
});

test.describe("map country path — mobile tap", () => {
  test.use(mobile);

  test("tapping the focused country again restores the selected tier", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const germany = page.locator('#mapSvg [data-country="276"]');
    const austria = page.locator('#mapSvg [data-country="040"]');
    const liftedCountries = page.locator("#mapSvg .hover-layer .country-hover-lift");

    await germany.tap();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(austria).toHaveClass(/is-muted/);
    await expect(liftedCountries).toHaveCount(1);

    await germany.tap();

    await expect(page.locator("#countryCard h2")).toContainText("European Union");
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(liftedCountries).toHaveCount(0);
  });

  test("tapping a country on the map shows its info card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const germany = page.locator('#mapSvg [data-country="276"]');
    const liftedCountries = page.locator("#mapSvg .hover-layer .country-hover-lift");

    await germany.tap();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
    await expect(liftedCountries).toHaveCount(1);
  });
});

// ─── touch pan/zoom policy ────────────────────────────────────────────────────

test.describe("map touch pan/zoom policy", () => {
  // hasTouch=true so TouchEvent construction succeeds in the page context
  test.use(mobile);

  test("single-finger drag does not move or zoom the map", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const box = await page.locator("#mapSvg").boundingBox();
    if (!box) throw new Error("Could not get #mapSvg bounding box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const kBefore = await getZoomScale(page);
    const xBefore = await getZoomX(page);

    // Single finger drag — 120px right, 40px down
    await dispatchTouchDrag(page, [
      { id: 1, x1: cx, y1: cy, x2: cx + 120, y2: cy + 40 },
    ]);
    await page.waitForTimeout(300);

    // Both scale and translate must be unchanged
    expect(await getZoomScale(page)).toBeCloseTo(kBefore, 4);
    expect(await getZoomX(page)).toBeCloseTo(xBefore, 1);
  });

  test("two-finger pinch-out zooms the map in", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const box = await page.locator("#mapSvg").boundingBox();
    if (!box) throw new Error("Could not get #mapSvg bounding box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const kBefore = await getZoomScale(page);
    const canvasRevisionBefore = await getCanvasRenderRevision(page);

    // Two fingers start 40 px apart, spread to 200 px apart → ~5× scale
    await dispatchTouchDrag(page, [
      { id: 1, x1: cx - 20, y1: cy, x2: cx - 100, y2: cy },
      { id: 2, x1: cx + 20, y1: cy, x2: cx + 100, y2: cy },
    ]);
    await page.waitForTimeout(300);

    expect(await getZoomScale(page)).toBeGreaterThan(kBefore);
    expect(await getCanvasRenderRevision(page)).toBeGreaterThan(canvasRevisionBefore);
    expect(await getCanvasComputedTransform(page)).toBe("none");

    const zoomTransform = await getZoomTransform(page);
    const canvasRenderTransform = await getCanvasRenderTransform(page);
    expect(canvasRenderTransform.k).toBeCloseTo(zoomTransform.k, 4);
    expect(canvasRenderTransform.x).toBeCloseTo(zoomTransform.x, 1);
    expect(canvasRenderTransform.y).toBeCloseTo(zoomTransform.y, 1);
  });

  test("mobile pinch can zoom beyond the desktop ceiling", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const box = await page.locator("#mapSvg").boundingBox();
    if (!box) throw new Error("Could not get #mapSvg bounding box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await dispatchTouchDrag(page, [
      { id: 1, x1: cx - 10, y1: cy, x2: cx - 190, y2: cy },
      { id: 2, x1: cx + 10, y1: cy, x2: cx + 190, y2: cy },
    ]);
    await page.waitForTimeout(300);

    expect(await getZoomScale(page)).toBeGreaterThan(14);
    expect(await getZoomScale(page)).toBeLessThanOrEqual(22);
  });
});

// ─── mouse wheel zoom ─────────────────────────────────────────────────────────

test.describe("map mouse wheel zoom (desktop)", () => {
  test.use(desktop);

  test("scrolling the wheel over the map zooms in", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    const box = await page.locator("#mapSvg").boundingBox();
    if (!box) throw new Error("Could not get #mapSvg bounding box");

    // Position the mouse over the map centre before wheeling
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    const kBefore = await getZoomScale(page);
    const canvasRevisionBefore = await getCanvasRenderRevision(page);
    await page.mouse.wheel(0, -300); // negative deltaY = zoom in
    await page.waitForTimeout(300);

    expect(await getZoomScale(page)).toBeGreaterThan(kBefore);
    expect(await getCanvasRenderRevision(page)).toBeGreaterThan(canvasRevisionBefore);
    expect(await getCanvasComputedTransform(page)).toBe("none");

    const zoomTransform = await getZoomTransform(page);
    const canvasRenderTransform = await getCanvasRenderTransform(page);
    expect(canvasRenderTransform.k).toBeCloseTo(zoomTransform.k, 4);
    expect(canvasRenderTransform.x).toBeCloseTo(zoomTransform.x, 1);
    expect(canvasRenderTransform.y).toBeCloseTo(zoomTransform.y, 1);
  });
});

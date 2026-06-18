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
import { test, expect, devices, type Page } from "@playwright/test";

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

/** Return the current D3 zoom translate-x stored on #mapSvg. */
async function getZoomX(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as any).d3.zoomTransform(
        document.querySelector("#mapSvg")!
      ).x as number
  );
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

  test("brief country hover does not update the card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('#mapSvg [data-country="276"]').hover();
    await page.waitForTimeout(60);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(200);

    await expect(page.locator("#countryCard h2")).not.toContainText("Germany", {
      ignoreCase: true,
    });
  });

  test("clicking a country on the map shows its info card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('#mapSvg [data-country="276"]').click();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
  });
});

test.describe("map country path — mobile tap", () => {
  test.use(mobile);

  test("tapping a country on the map shows its info card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('#mapSvg [data-country="276"]').tap();

    await expect(page.locator("#countryCard h2")).toContainText("Germany", {
      ignoreCase: true,
    });
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

    // Two fingers start 40 px apart, spread to 200 px apart → ~5× scale
    await dispatchTouchDrag(page, [
      { id: 1, x1: cx - 20, y1: cy, x2: cx - 100, y2: cy },
      { id: 2, x1: cx + 20, y1: cy, x2: cx + 100, y2: cy },
    ]);
    await page.waitForTimeout(300);

    expect(await getZoomScale(page)).toBeGreaterThan(kBefore);
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
    await page.mouse.wheel(0, -300); // negative deltaY = zoom in
    await page.waitForTimeout(300);

    expect(await getZoomScale(page)).toBeGreaterThan(kBefore);
  });
});

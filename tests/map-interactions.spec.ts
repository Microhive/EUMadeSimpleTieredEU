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

    await expect(euTab).toHaveClass(/is-active/);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(canada).toHaveClass(/is-muted/);

    await communityTab.hover();

    await expect(canada).toHaveClass(/is-highlight/);
    await expect(page.locator("#countryCard h2")).toContainText("Community");

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(euTab).toHaveClass(/is-active/);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(canada).toHaveClass(/is-muted/);
    await expect(page.locator("#countryCard h2")).toContainText("European Union");
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
    const mapFlag = page.locator(`.map-flag[data-country="${countryId}"]`);
    const targetCard = page.locator(`.tier-card[data-tier="${targetTier}"]`);
    const targetChip = page.locator(
      `.tier-card[data-tier="${targetTier}"] .country-chip[data-country="${countryId}"]`
    );

    await expect(mapFlag).toBeVisible();
    await expect(targetChip).toHaveCount(0);

    await dragLocatorToLocator(page, mapFlag, targetCard);

    await expect(targetChip).toHaveCount(1);
    await expect(page.locator(`#mapSvg [data-country="${countryId}"]`)).toHaveClass(
      /tier-inner/
    );
  });

  test("dragging a tier chip between cards moves it and leaves editing responsive", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#editToggle").click();

    const countryId = "056"; // Belgium
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

    await dragLocatorToLocator(page, sourceChip, targetCard);

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
    const mapFlag = page.locator(`.map-flag[data-country="${countryId}"]`);
    const sourceChip = page.locator(
      `.tier-card[data-tier="${sourceTier}"] .country-chip[data-country="${countryId}"]`
    );
    const targetCard = page.locator(`.tier-card[data-tier="${targetTier}"]`);
    const targetChip = page.locator(
      `.tier-card[data-tier="${targetTier}"] .country-chip[data-country="${countryId}"]`
    );

    await mapFlag.hover();
    await expect(mapFlag).toBeVisible();
    await expect(sourceChip).toHaveCount(1);
    await expect(targetChip).toHaveCount(0);

    await dragLocatorToLocator(page, mapFlag, targetCard);

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

    await expect(austria).toHaveClass(/is-highlight/);

    await germany.hover();

    await expect(germany).toHaveClass(/is-highlight/);
    await expect(germany).toHaveClass(/is-hovered/);
    await expect(germany).toHaveClass(/is-lift-source/);
    await expect(hoverLift).toHaveCount(1);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(austria).not.toHaveClass(/is-muted/);
    await expect(page.locator("#countryCard h2")).toContainText("European Union");

    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);

    await expect(germany).not.toHaveClass(/is-hovered/);
    await expect(germany).not.toHaveClass(/is-lift-source/);
    await expect(hoverLift).toHaveCount(0);
    await expect(austria).toHaveClass(/is-highlight/);
    await expect(page.locator("#countryCard h2")).toContainText("European Union");
  });

  test("country hover does not update the card", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator('#mapSvg [data-country="276"]').hover();

    await expect(page.locator("#countryCard h2")).not.toContainText("Germany", {
      ignoreCase: true,
    });
  });

  test("map flags reflect tier presence and hover focus", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);

    await page.locator("#mapFlagsButton").click();

    const germanyFlag = page.locator('.map-flag[data-country="276"]');
    const belarusFlag = page.locator('.map-flag[data-country="112"]');
    const germanyChip = page.locator('.country-chip[data-country="276"]');

    await expect(germanyFlag).toHaveClass(/is-tiered/);
    await expect(belarusFlag).not.toHaveClass(/is-tiered/);

    await germanyFlag.hover();

    await expect(germanyFlag).not.toHaveClass(/is-label-backed/);
    await expect(germanyFlag).toBeVisible();
    await expect(germanyChip).toHaveClass(/is-map-hovered/);

    const flagBox = await germanyFlag.boundingBox();
    const labelBox = await page.locator("#mapSvg .country-label").filter({ hasText: "Germany" }).boundingBox();
    if (!flagBox || !labelBox) throw new Error("Expected Germany flag and label to be visible.");
    expect(labelBox.x).toBeGreaterThan(flagBox.x + flagBox.width - 2);
    expect(Math.abs(labelBox.y + labelBox.height / 2 - (flagBox.y + flagBox.height / 2))).toBeLessThan(18);
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

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const viewport = { width: 1200, height: 630 };
const socialCardPath = fileURLToPath(new URL("../assets/og-tiered-eu.png", import.meta.url));

let server;
let browser;

try {
  server = await createServer({
    logLevel: "warn",
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: false,
    },
  });

  await server.listen();
  const localUrl = server.resolvedUrls?.local.find((url) => url.includes("127.0.0.1"))
    ?? server.resolvedUrls?.local[0]
    ?? "http://127.0.0.1:5174/";

  browser = await chromium.launch();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport,
  });

  await page.goto(localUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#mapSvg [data-country]", { timeout: 15_000 });
  await page.waitForTimeout(1_900);

  const flagsButton = page.locator("#mapFlagsButton");
  if ((await flagsButton.getAttribute("aria-pressed")) !== "true") {
    await flagsButton.click();
  }

  await page.waitForFunction(() => {
    return document.querySelector(".map-flag-canvas")?.classList.contains("is-visible");
  });
  await page.waitForTimeout(500);

  await page.addStyleTag({
    content: `
      .social-card-cta {
        position: fixed;
        left: 444px;
        top: 164px;
        z-index: 1000;
        display: inline-flex;
        align-items: center;
        gap: 18px;
        min-height: 72px;
        padding: 0 14px 0 30px;
        border: 5px solid #08131d;
        outline: 5px solid #fff8ee;
        border-radius: 999px;
        background: #f0b800;
        box-shadow: 8px 8px 0 #08131d;
        color: #08131d;
        font: 900 34px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
        text-transform: uppercase;
        transform: rotate(-1.5deg);
      }

      .social-card-cta-arrow {
        display: inline-grid;
        place-items: center;
        width: 54px;
        height: 54px;
        border-radius: 999px;
        background: #08131d;
        color: #f0b800;
        font-size: 46px;
        line-height: 1;
        transform: translateY(-1px);
      }
    `,
  });
  await page.evaluate(() => {
    const cta = document.createElement("div");
    const label = document.createElement("span");
    const arrow = document.createElement("span");

    cta.className = "social-card-cta";
    cta.setAttribute("aria-hidden", "true");
    label.textContent = "Explore the map";
    arrow.className = "social-card-cta-arrow";
    arrow.textContent = "\u2192";

    cta.append(label, arrow);
    document.body.appendChild(cta);
  });

  await page.screenshot({
    path: socialCardPath,
    type: "png",
  });

  console.log(`Generated ${socialCardPath} at ${viewport.width}x${viewport.height}.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}

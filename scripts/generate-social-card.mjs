import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const viewport = { width: 1200, height: 630 };
const socialCardPath = fileURLToPath(new URL("../assets/social-card.jpg", import.meta.url));

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

  await page.screenshot({
    path: socialCardPath,
    type: "jpeg",
    quality: 92,
  });

  console.log(`Generated ${socialCardPath} at ${viewport.width}x${viewport.height}.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}

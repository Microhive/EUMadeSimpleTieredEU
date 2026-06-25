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
      .social-card-brand-lockup {
        position: fixed;
        left: 50vw;
        top: 50vh;
        z-index: 1000;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        width: 430px;
        height: 430px;
        padding: 40px;
        border: 6px solid #08131d;
        outline: 6px solid #fff8ee;
        border-radius: 50%;
        background: rgba(255, 248, 238, 0.96);
        box-shadow: 10px 10px 0 #08131d;
        color: #08131d;
        letter-spacing: 0;
        transform: translate(-50%, -50%);
      }

      .social-card-brand-lockup img {
        display: block;
        width: 340px;
        max-width: 100%;
        height: auto;
        margin: -8px auto 0;
      }

      .social-card-brand-title {
        display: block;
        width: 340px;
        padding: 11px 18px 13px;
        border: 4px solid #08131d;
        border-radius: 28px;
        background: #f0b800;
        color: #08131d;
        font: 900 30px/0.95 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        text-transform: uppercase;
      }
    `,
  });
  await page.evaluate(() => {
    const lockup = document.createElement("div");
    const logo = document.createElement("img");
    const title = document.createElement("span");

    lockup.className = "social-card-brand-lockup";
    lockup.setAttribute("aria-hidden", "true");
    logo.src = "/logo/tiered-eu-logo.svg";
    logo.alt = "";
    title.className = "social-card-brand-title";
    title.innerHTML = "What could a tiered EU<br>become?";

    lockup.append(logo, title);
    document.body.appendChild(lockup);
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

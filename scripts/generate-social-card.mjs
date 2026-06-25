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
        gap: 10px;
        width: 456px;
        height: 456px;
        padding: 42px;
        border: 6px solid #08131d;
        outline: 6px solid #fff8ee;
        border-radius: 50%;
        background: #f0b800;
        box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.72);
        color: #08131d;
        letter-spacing: 0;
        transform: translate(-50%, -50%);
      }

      .social-card-brand-lockup img {
        display: block;
        width: 142px;
        height: auto;
        margin: 0 auto 2px;
      }

      .social-card-brand-wordmark {
        display: block;
        color: #08131d;
        font: 900 78px/0.9 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -1px;
        white-space: nowrap;
      }

      .social-card-brand-dot {
        color: #fff8ee;
      }

      .social-card-brand-tagline {
        display: block;
        color: #34495f;
        font: 800 25px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }
    `,
  });
  await page.evaluate(() => {
    const lockup = document.createElement("div");
    const logo = document.createElement("img");
    const wordmark = document.createElement("span");
    const tagline = document.createElement("span");

    lockup.className = "social-card-brand-lockup";
    lockup.setAttribute("aria-hidden", "true");
    logo.src = "/logo/tiered-eu-mark.svg";
    logo.alt = "";
    wordmark.className = "social-card-brand-wordmark";
    wordmark.innerHTML = 'tiered<span class="social-card-brand-dot">.</span>eu';
    tagline.className = "social-card-brand-tagline";
    tagline.textContent = "Explore a tiered Europe";

    lockup.append(logo, wordmark, tagline);
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

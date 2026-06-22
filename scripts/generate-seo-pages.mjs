import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteOrigin = "https://tiered.eu";
const socialImageUrl = `${siteOrigin}/social-card.jpg`;
const rootTitle = "Tiered Europe Map: Interactive EU Integration Scenario | tiered.eu";
const rootDescription =
  "Explore an interactive Tiered Europe map from tiered.eu, showing how a multi-speed European Union could work across four integration tiers.";

const distDir = "dist";
const templatePath = join(distDir, "index.html");
const contentPath = join("src", "domain", "tier-page-content.json");

const [template, contentJson] = await Promise.all([
  readFile(templatePath, "utf8"),
  readFile(contentPath, "utf8"),
]);
const tierPages = JSON.parse(contentJson);

await writeFile(
  join(distDir, "index.html"),
  withRootStructuredData(template),
  "utf8",
);

await Promise.all(
  tierPages.map(async (content) => {
    const html = renderTierPageHtml(template, content);
    const routeDir = join(distDir, content.slug);

    await mkdir(routeDir, { recursive: true });
    await writeFile(join(routeDir, "index.html"), html, "utf8");
  }),
);

function withRootStructuredData(html) {
  return replaceStructuredData(html, {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "tiered.eu - Tiered Europe",
    url: `${siteOrigin}/`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    inLanguage: "en",
    description: rootDescription,
    image: socialImageUrl,
    creator: {
      "@type": "Organization",
      name: "tiered.eu",
    },
  });
}

function renderTierPageHtml(html, content) {
  const canonicalUrl = `${siteOrigin}${content.path}`;
  const title = content.seoTitle;
  const description = content.metaDescription;
  const socialTitle = `${content.title} - tiered.eu`;

  return replaceStructuredData(
    replaceTierDetail(
      replaceHeadMetadata(html, {
        title,
        description,
        canonicalUrl,
        socialTitle,
      }),
      content,
    ),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: socialTitle,
      url: canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: "tiered.eu - Tiered Europe",
        url: siteOrigin,
      },
      inLanguage: "en",
      description,
      image: socialImageUrl,
    },
  );
}

function replaceHeadMetadata(html, { title, description, canonicalUrl, socialTitle }) {
  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?>/s,
      `<meta name="description" content="${escapeAttribute(description)}">`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*>/s,
      `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}">`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*>/s,
      `<meta property="og:title" content="${escapeAttribute(socialTitle)}">`,
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?>/s,
      `<meta property="og:description" content="${escapeAttribute(description)}">`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*>/s,
      `<meta property="og:url" content="${escapeAttribute(canonicalUrl)}">`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*>/s,
      `<meta name="twitter:title" content="${escapeAttribute(socialTitle)}">`,
    )
    .replace(
      /<meta\s+name="twitter:description"[\s\S]*?>/s,
      `<meta name="twitter:description" content="${escapeAttribute(description)}">`,
    );
}

function replaceTierDetail(html, content) {
  return html.replace(
    /<section class="tier-detail" id="tierDetail" hidden><\/section>/,
    renderTierDetailMarkup(content),
  );
}

function renderTierDetailMarkup(content) {
  const visualSteps = content.visualSteps
    .map((step, index) => `
        <li class="${index === content.activeStep ? "is-active" : ""}">
          <span class="tier-detail-step-marker">${index + 1}</span>
          <span>${escapeHtml(step)}</span>
        </li>
      `)
    .join("");
  const signals = content.signals
    .map((signal) => `<li>${escapeHtml(signal)}</li>`)
    .join("");
  const sections = content.sections
    .map((section) => `
        <section class="tier-detail-section">
          <h3>${escapeHtml(section.heading)}</h3>
          <p>${escapeHtml(section.body)}</p>
        </section>
      `)
    .join("");
  const takeaways = content.takeaways
    .map((takeaway) => `<li>${escapeHtml(takeaway)}</li>`)
    .join("");

  return `<section class="tier-detail" id="tierDetail" data-tier="${escapeAttribute(content.id)}">
      <a class="tier-detail-back" href="/" data-root-link>Back to full scenario</a>
      <div class="tier-detail-header">
        <p class="eyebrow">${escapeHtml(content.eyebrow)}</p>
        <h2>${escapeHtml(content.title)}</h2>
        <p>${escapeHtml(content.intro)}</p>
      </div>
      <div class="tier-detail-visual" aria-label="${escapeAttribute(content.visualLabel)}">
        <div>
          <p class="tier-detail-visual-label">${escapeHtml(content.visualLabel)}</p>
          <ol class="tier-detail-ladder">${visualSteps}</ol>
        </div>
        <div>
          <p class="tier-detail-visual-label">Policy signals</p>
          <ul class="tier-detail-signals">${signals}</ul>
        </div>
      </div>
      <p class="tier-detail-summary">${escapeHtml(content.routeSummary)}</p>
      <div class="tier-detail-sections">${sections}</div>
      <div class="tier-detail-takeaways">
        <h3>What to remember</h3>
        <ul>${takeaways}</ul>
      </div>
    </section>`;
}

function replaceStructuredData(html, data) {
  return html.replace(
    /<script type="application\/ld\+json" id="structuredData">.*?<\/script>/s,
    `<script type="application/ld+json" id="structuredData">\n${escapeScriptJson(data)}\n    </script>`,
  );
}

function escapeScriptJson(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

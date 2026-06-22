import type {
  BenefitPill,
  CapabilityInfo,
  CountryMeta,
  SceneKey,
  Tier,
} from "../domain/tiered-europe";
import type { CountryContextInfo } from "../domain/country-context";
import { escapeAttribute, escapeHtml } from "./html";
import { MOBILE_LEGEND_LABELS, TIER_COLORS } from "./tier-appearance";

interface RenderTierDeckOptions {
  tiers: Tier[];
  capabilityInfoByLabel: ReadonlyMap<string, CapabilityInfo>;
  flagSvgMarkup: (code: string) => string;
}

type CountryCardMeta = Pick<CountryMeta, "id" | "code" | "name">;

export function capabilityLookupKey(label: string): string {
  return label.replace(/\u00a0/g, " ");
}

export function renderBenefitPills(
  pills: BenefitPill[],
  iconSvgById: Record<string, string>,
): string {
  return pills
    .map(
      (pill) =>
        `<button type="button" class="benefit-pill" data-pill="${escapeAttribute(pill.id)}" data-tooltip="${escapeAttribute(pill.tooltip)}">
          <span class="pill-icon">${iconSvgById[pill.id] ?? ""}</span>
          <strong class="pill-title">${escapeHtml(pill.title)}</strong>
          <span class="pill-short">${escapeHtml(pill.shortText)}</span>
        </button>`,
    )
    .join("");
}

export function renderTierDeck({
  tiers,
  capabilityInfoByLabel,
  flagSvgMarkup,
}: RenderTierDeckOptions): string {
  return tiers
    .map((tier) => {
      const chips = renderCountryGrid(tier, flagSvgMarkup);
      const capabilities = tier.capabilities
        .map((capability) => renderCapability(capability, capabilityInfoByLabel))
        .join("");

      return `
        <article class="tier-card" data-tier="${tier.id}" tabindex="0">
          <div class="tier-head">
            <span class="tier-number">${tier.order}</span>
            <div>
              <h2 class="tier-title">${renderTierTitleLink(tier)}</h2>
              <div class="tier-meta-row">
                <div class="capabilities">${capabilities}</div>
              </div>
            </div>
          </div>
          <p class="tier-summary">${escapeHtml(tier.summary)}</p>
          <div class="country-grid">${chips}</div>
        </article>
      `;
    })
    .join("");
}

export function tierPath(tierId: Tier["id"]): string {
  if (tierId === "inner") return "/inner-union/";
  if (tierId === "eu") return "/european-union/";
  if (tierId === "associate") return "/associate-membership/";
  return "/european-community-friends/";
}

function renderTierTitleLink(tier: Tier): string {
  return `<a href="${tierPath(tier.id)}" data-tier-link="${escapeAttribute(tier.id)}">${escapeHtml(tier.title)}</a>`;
}

export function renderCountryGrid(
  tier: Tier,
  flagSvgMarkup: (code: string) => string,
): string {
  return tier.directCountries
    .map(([id, code, name]) => renderCountryChip(id, code, name, flagSvgMarkup))
    .join("");
}

export function renderLegend(tiers: Tier[]): string {
  return tiers
    .slice()
    .reverse()
    .map(
      (tier) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${TIER_COLORS[tier.id]}"></span>
          <span class="label-full">${escapeHtml(tier.shortTitle)}</span>
          <span class="label-short">${escapeHtml(MOBILE_LEGEND_LABELS[tier.id])}</span>
        </div>
      `,
    )
    .join("");
}

export function renderCountryCardForTier(tier: Tier): string {
  return `
    <p class="eyebrow">Tier ${tier.order}</p>
    <span class="tier-pill" data-tier="${tier.id}">${escapeHtml(tier.title)}</span>
    <h2>${escapeHtml(tier.shortTitle)}</h2>
    <p>${escapeHtml(tier.summary)}</p>
  `;
}

export function renderCountryCardForScene(scene: SceneKey): string {
  if (scene === "world") {
    return `
      <p class="eyebrow">Global view</p>
      <h2>The democratic community</h2>
      <p>A tiered EU extends its circle beyond Europe, connecting with like-minded states on security, climate, energy, and trade - wherever shared values create a basis for cooperation.</p>
    `;
  }

  return `
    <p class="eyebrow">European theatre</p>
    <h2>Where the tiers overlap</h2>
    <p>Current EU members, accession-path countries, and close European partners form the main arena for a tiered future.</p>
  `;
}

export function renderCountryCardForCountry(
  meta: CountryCardMeta,
  tier: Tier | null,
  context?: CountryContextInfo,
): string {
  return `
    <p class="eyebrow">${escapeHtml(meta.code)}</p>
    ${renderCountryTierPill(tier)}
    <h2>${escapeHtml(meta.name)}</h2>
    <p>${escapeHtml(scenarioLine(meta, tier))}</p>
    ${context ? renderCountryContext(context) : ""}
  `;
}

function renderCountryChip(
  id: string,
  code: string,
  name: string,
  flagSvgMarkup: (code: string) => string,
): string {
  const safeName = escapeAttribute(name);
  return `<button type="button" class="country-chip" data-country="${escapeAttribute(id)}" data-code="${escapeAttribute(code)}" aria-label="${safeName}" title="${safeName}" draggable="false">
      <span class="chip-flag" aria-hidden="true">${flagSvgMarkup(code)}</span>
    </button>`;
}

function renderCapability(
  capability: string,
  capabilityInfoByLabel: ReadonlyMap<string, CapabilityInfo>,
): string {
  const key = capabilityLookupKey(capability);
  const info = capabilityInfoByLabel.get(key);
  if (!info) return `<span class="capability">${escapeHtml(capability)}</span>`;

  return `<button type="button" class="capability" data-cap-key="${escapeAttribute(key)}" data-tooltip="${escapeAttribute(info.tooltip)}">${escapeHtml(capability)}</button>`;
}

function renderCountryTierPill(tier: Tier | null): string {
  if (!tier) return `<span class="tier-pill tier-pill-unassigned">Not assigned</span>`;
  return `<span class="tier-pill" data-tier="${tier.id}">Tier ${tier.order}: ${escapeHtml(tier.shortTitle)}</span>`;
}

function renderCountryContext(context: CountryContextInfo): string {
  const [primaryLink, ...secondaryLinks] = context.links;
  const primaryLinkMarkup = primaryLink
    ? `<div class="country-context-links country-context-links-primary">
        ${renderCountryContextLink(primaryLink, "country-context-primary-link")}
      </div>`
    : "";
  const secondaryLinksMarkup = secondaryLinks.length
    ? `<details class="country-context-more">
        <summary>More official sources</summary>
        <div class="country-context-links country-context-links-secondary">
          ${secondaryLinks.map((link) => renderCountryContextLink(link)).join("")}
        </div>
      </details>`
    : "";

  return `
    <details class="country-context">
      <summary>Relationship context</summary>
      <div class="country-context-body">
        <span class="country-context-badge">${escapeHtml(context.label)}</span>
        <p>${escapeHtml(context.summary)}</p>
        <p>${escapeHtml(context.detail)}</p>
        ${context.sourceNote ? `<p class="country-context-note">${escapeHtml(context.sourceNote)}</p>` : ""}
        ${primaryLinkMarkup}
        ${secondaryLinksMarkup}
      </div>
    </details>
  `;
}

function renderCountryContextLink(link: { label: string; href: string }, className = ""): string {
  const classAttribute = className ? ` class="${escapeAttribute(className)}"` : "";
  return `<a${classAttribute} href="${escapeAttribute(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`;
}

function scenarioLine(meta: CountryCardMeta, tier: Tier | null): string {
  if (tier?.id === "inner") {
    return `${meta.name} is modelled as part of the frontrunner core for deeper defence, eurozone, Schengen, and foreign-policy integration.`;
  }
  if (tier?.id === "eu") {
    return `${meta.name} remains inside the full EU layer, sharing law, budget, institutions, and the single market while deeper integration continues around it.`;
  }
  if (tier?.id === "associate") {
    return `${meta.name} is shown as an associate-path country: close enough to adopt standards and market rules before full membership is settled.`;
  }
  if (!tier) {
    return `${meta.name} is not currently assigned to a scenario tier, but its EU relationship can still be explored here.`;
  }
  return `${meta.name} is shown as a democratic friend: outside the EU ladder, but connected through security, climate, technology, and crisis cooperation.`;
}

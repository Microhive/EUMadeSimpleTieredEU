import type {
  BenefitPill,
  CapabilityInfo,
  CountryMeta,
  SceneKey,
  Tier,
} from "../domain/tiered-europe";
import { escapeAttribute, escapeHtml } from "./html";
import { MOBILE_LEGEND_LABELS, TIER_COLORS } from "./tier-appearance";

interface RenderTierDeckOptions {
  tiers: Tier[];
  capabilityInfoByLabel: ReadonlyMap<string, CapabilityInfo>;
  flagImageSrc: (code: string) => string;
}

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
  flagImageSrc,
}: RenderTierDeckOptions): string {
  return tiers
    .map((tier) => {
      const chips = tier.directCountries
        .map(([id, code, name]) => renderCountryChip(id, code, name, flagImageSrc))
        .join("");
      const capabilities = tier.capabilities
        .map((capability) => renderCapability(capability, capabilityInfoByLabel))
        .join("");

      return `
        <article class="tier-card" data-tier="${tier.id}" tabindex="0">
          <div class="tier-head">
            <span class="tier-number">${tier.order}</span>
            <div>
              <h2 class="tier-title">${escapeHtml(tier.title)}</h2>
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

export function renderCountryCardForCountry(meta: CountryMeta, tier: Tier): string {
  return `
    <p class="eyebrow">${escapeHtml(meta.code)}</p>
    <span class="tier-pill" data-tier="${tier.id}">Tier ${tier.order}: ${escapeHtml(tier.shortTitle)}</span>
    <h2>${escapeHtml(meta.name)}</h2>
    <p>${escapeHtml(scenarioLine(meta, tier))}</p>
  `;
}

function renderCountryChip(
  id: string,
  code: string,
  name: string,
  flagImageSrc: (code: string) => string,
): string {
  const safeName = escapeAttribute(name);
  return `<button type="button" class="country-chip" data-country="${escapeAttribute(id)}" data-code="${escapeAttribute(code)}" aria-label="${safeName}" title="${safeName}" draggable="false">
      <img class="chip-flag" src="${flagImageSrc(code)}" width="28" height="28" alt="" loading="lazy" decoding="async" draggable="false">
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

function scenarioLine(meta: CountryMeta, tier: Tier): string {
  if (tier.id === "inner") {
    return `${meta.name} is modelled as part of the frontrunner core for deeper defence, eurozone, Schengen, and foreign-policy integration.`;
  }
  if (tier.id === "eu") {
    return `${meta.name} remains inside the full EU layer, sharing law, budget, institutions, and the single market while deeper integration continues around it.`;
  }
  if (tier.id === "associate") {
    return `${meta.name} is shown as an associate-path country: close enough to adopt standards and market rules before full membership is settled.`;
  }
  return `${meta.name} is shown as a democratic friend: outside the EU ladder, but connected through security, climate, technology, and crisis cooperation.`;
}

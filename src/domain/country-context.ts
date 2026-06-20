import type { CountryMeta, Tier } from "./tiered-europe";

export interface CountryContextLink {
  label: string;
  href: string;
}

export interface CountryContextInfo {
  label: string;
  summary: string;
  detail: string;
  links: CountryContextLink[];
  sourceNote?: string;
}

const TRADE_INDEX_URL =
  "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions_en";
const TRADE_COUNTRIES_BASE_URL =
  "https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions";
const EU_COUNTRIES_BASE_URL =
  "https://european-union.europa.eu/principles-countries-history/eu-countries";
const SINGLE_MARKET_SCOREBOARD_BASE_URL =
  "https://single-market-scoreboard.ec.europa.eu/countries";
const EUROPEAN_SEMESTER_BASE_URL =
  "https://reforms-investments.ec.europa.eu/european-semester-your-country";
const GREENLAND_PARTNERSHIP_URL =
  "https://international-partnerships.ec.europa.eu/countries/greenland_en";

const tradeArticle = (slug: string): CountryContextLink => ({
  label: "Read European Commission trade article",
  href: `${TRADE_COUNTRIES_BASE_URL}/${slug}_en`,
});

const TRADE_INDEX_LINK: CountryContextLink = {
  label: "Browse European Commission trade index",
  href: TRADE_INDEX_URL,
};

const DIRECT_TRADE_ARTICLE_BY_ID: Record<string, CountryContextLink> = {
  "012": tradeArticle("algeria"),
  "031": tradeArticle("azerbaijan"),
  "032": tradeArticle("argentina"),
  "036": tradeArticle("australia"),
  "050": tradeArticle("bangladesh"),
  "051": tradeArticle("armenia"),
  "076": tradeArticle("brazil"),
  "104": tradeArticle("myanmar"),
  "112": tradeArticle("belarus"),
  "116": tradeArticle("cambodia"),
  "124": tradeArticle("canada"),
  "144": tradeArticle("sri-lanka"),
  "152": tradeArticle("chile"),
  "156": tradeArticle("china"),
  "158": tradeArticle("taiwan"),
  "234": tradeArticle("faroe-islands"),
  "275": tradeArticle("palestine"),
  "268": tradeArticle("georgia"),
  "356": tradeArticle("india"),
  "360": tradeArticle("indonesia"),
  "364": tradeArticle("iran"),
  "368": tradeArticle("iraq"),
  "352": tradeArticle("iceland"),
  "376": tradeArticle("israel"),
  "392": tradeArticle("japan"),
  "398": tradeArticle("kazakhstan"),
  "400": tradeArticle("jordan"),
  "410": tradeArticle("south-korea"),
  "418": tradeArticle("laos"),
  "422": tradeArticle("lebanon"),
  "434": tradeArticle("libya"),
  "458": tradeArticle("malaysia"),
  "484": tradeArticle("mexico"),
  "498": tradeArticle("moldova"),
  "504": tradeArticle("morocco"),
  "554": tradeArticle("new-zealand"),
  "578": tradeArticle("norway"),
  "586": tradeArticle("pakistan"),
  "600": tradeArticle("paraguay"),
  "608": tradeArticle("philippines"),
  "643": tradeArticle("russia"),
  "702": tradeArticle("singapore"),
  "710": tradeArticle("south-africa"),
  "756": tradeArticle("switzerland"),
  "760": tradeArticle("syria"),
  "764": tradeArticle("thailand"),
  "788": tradeArticle("tunisia"),
  "792": tradeArticle("turkiye"),
  "804": tradeArticle("ukraine"),
  "818": tradeArticle("egypt"),
  "826": tradeArticle("united-kingdom"),
  "840": tradeArticle("united-states"),
  "858": tradeArticle("uruguay"),
  "862": tradeArticle("venezuela"),
  "704": tradeArticle("viet-nam"),
};

const WESTERN_BALKANS_IDS = new Set([
  "008",
  "070",
  "499",
  "688",
  "807",
  "Kosovo",
]);

const WESTERN_BALKANS_LINK: CountryContextLink = {
  label: "Read European Commission Western Balkans article",
  href: `${TRADE_COUNTRIES_BASE_URL}/western-balkans_en`,
};

const GREENLAND_LINK: CountryContextLink = {
  label: "Read European Commission Greenland partnership page",
  href: GREENLAND_PARTNERSHIP_URL,
};

const countrySlug = (countryName: string): string =>
  countryName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const euCountryProfile = (countryName: string): CountryContextLink => ({
  label: `View ${countryName}'s official EU profile`,
  href: `${EU_COUNTRIES_BASE_URL}/${countrySlug(countryName)}_en`,
});

const singleMarketProfile = (countryName: string): CountryContextLink => ({
  label: "See Single Market performance",
  href: `${SINGLE_MARKET_SCOREBOARD_BASE_URL}/${countrySlug(countryName)}_en`,
});

const semesterProfile = (countryName: string): CountryContextLink => ({
  label: "Read the latest European Semester assessment",
  href: `${EUROPEAN_SEMESTER_BASE_URL}/european-semester-documents-${countrySlug(countryName)}_en`,
});

const MICROSTATE_CONTEXT_BY_ID: Record<string, Omit<CountryContextInfo, "links">> = {
  "020": {
    label: "European microstate",
    summary:
      "Andorra is a small sovereign state outside the EU, shown here in the associate tier because its EU relationship is built around partial integration rather than full membership.",
    detail:
      "The Commission trade index does not list a standalone Andorra article. Treat it as a microstate case where customs, market access, border management, and sector-by-sector alignment matter more than classic enlargement framing.",
    sourceNote:
      "No standalone DG Trade country article is listed for Andorra on the Commission country/region index.",
  },
  "438": {
    label: "European microstate",
    summary:
      "Liechtenstein is a microstate with a much deeper market relationship than most tiny states because it participates in the EEA through EFTA.",
    detail:
      "The Commission trade index does not list a standalone Liechtenstein article. In this scenario it belongs in the associate tier as a small-state model for single-market participation without EU membership.",
    sourceNote:
      "No standalone DG Trade country article is listed for Liechtenstein on the Commission country/region index.",
  },
  "492": {
    label: "European microstate",
    summary:
      "Monaco is a sovereign microstate closely linked to France and the EU customs space, but outside EU membership.",
    detail:
      "The Commission trade index does not list a standalone Monaco article. Its useful scenario role is to show how very small European states can sit close to the EU through specific agreements and practical alignment.",
    sourceNote:
      "No standalone DG Trade country article is listed for Monaco on the Commission country/region index.",
  },
  "674": {
    label: "European microstate",
    summary:
      "San Marino is a European microstate surrounded by Italy, with a close practical relationship to the EU but no full EU membership.",
    detail:
      "The Commission trade index does not list a standalone San Marino article. It is included as an associate-tier microstate because customs alignment and market access are central to its EU relationship.",
    sourceNote:
      "No standalone DG Trade country article is listed for San Marino on the Commission country/region index.",
  },
  "336": {
    label: "European microstate",
    summary:
      "Vatican City is a sovereign microstate and enclave inside Italy, outside the EU but surrounded by the EU's legal and economic space.",
    detail:
      "The Commission trade index does not list a standalone Vatican City article. It is included to make the map's microstate treatment complete, while recognising that its EU relationship is not a normal trade-policy relationship.",
    sourceNote:
      "No standalone DG Trade country article is listed for Vatican City on the Commission country/region index.",
  },
};

type CountryContextCountry = Pick<CountryMeta, "id" | "code" | "name">;

export function countryContextFor(
  meta: CountryContextCountry,
  tier: Tier | null,
): CountryContextInfo {
  const microstate = MICROSTATE_CONTEXT_BY_ID[meta.id];
  if (microstate) {
    return {
      ...microstate,
      links: [TRADE_INDEX_LINK],
    };
  }

  if (meta.id === "304") {
    return {
      label: "Overseas country and territory",
      summary:
        "Greenland is an autonomous territory within the Kingdom of Denmark and an Overseas Country and Territory associated with the EU.",
      detail:
        "It is outside the EU itself, but the EU-Greenland partnership covers dialogue, trade and trade-related matters, fisheries, education, green growth, and Arctic cooperation.",
      links: [GREENLAND_LINK],
    };
  }

  if (meta.id === "234") {
    return {
      label: "Self-governing territory",
      summary:
        "The Faroe Islands are a self-governing territory of Denmark with their own distinct relationship to the EU.",
      detail:
        "They are neither part of the EU nor the EEA, and unlike Greenland they are not an Overseas Country and Territory. Their trade relationship with the EU is governed by a bilateral free trade agreement.",
      links: [DIRECT_TRADE_ARTICLE_BY_ID[meta.id]],
    };
  }

  if (WESTERN_BALKANS_IDS.has(meta.id)) {
    return {
      label: "Western Balkans partner",
      summary:
        `${meta.name} is part of the Western Balkans policy space, where trade, reform, and accession-path questions overlap.`,
      detail:
        "The Commission covers this group through a regional trade article rather than only through individual country pages. That makes it a useful associate-tier model for staged integration.",
      links: [WESTERN_BALKANS_LINK],
    };
  }

  const directTradeArticle = DIRECT_TRADE_ARTICLE_BY_ID[meta.id];
  if (directTradeArticle) {
    return {
      label: directArticleLabelFor(tier),
      summary:
        `The Commission publishes a dedicated trade relationship article for ${meta.name}, with facts, figures, agreements, and latest developments.`,
      detail: directArticleDetailFor(tier, meta.name),
      links: [directTradeArticle],
    };
  }

  if (tier?.id === "inner" || tier?.id === "eu") {
    return {
      label: "Current EU status",
      summary:
        `${meta.name} is a full member of the European Union. Its official EU profile covers accession, euro and Schengen status, political system, economy, representation in EU institutions, and EU funding.`,
      detail:
        `The information above describes ${meta.name}'s position today. Its placement in the ${tier.title} tier is part of this site's proposed tiered-Europe scenario.`,
      links: [
        euCountryProfile(meta.name),
        singleMarketProfile(meta.name),
        semesterProfile(meta.name),
      ],
      sourceNote:
        "Current EU status and the proposed scenario tier are presented separately.",
    };
  }

  return {
    label: "External partner",
    summary:
      `${meta.name} is outside the EU member-state layer and can be explored as an external partner in this scenario.`,
    detail:
      "The Commission country/region index is the starting point for checking whether a dedicated trade article or regional relationship article exists.",
    links: [TRADE_INDEX_LINK],
  };
}

function directArticleLabelFor(tier: Tier | null): string {
  if (tier?.id === "associate") return "Close European partner";
  if (tier?.id === "friends") return "Democratic partner";
  return "External relationship";
}

function directArticleDetailFor(tier: Tier | null, countryName: string): string {
  if (tier?.id === "associate") {
    return `${countryName} is shown in the associate tier because its relationship with the EU is close, structured, and relevant to market access, legal alignment, or accession-path questions.`;
  }
  if (tier?.id === "friends") {
    return `${countryName} is shown in the outer democratic community: a non-European or wider partner where trade, security, climate, and supply-chain cooperation can still matter to Europe.`;
  }
  return `${countryName} is linked here through the Commission's external trade relationship material.`;
}

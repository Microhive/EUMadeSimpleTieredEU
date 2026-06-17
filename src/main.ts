// ─── globals declared by vendor scripts ───────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    d3: any;
    topojson: any;
    __WORLD_ATLAS_COUNTRIES_110M__: unknown;
    __WORLD_ATLAS_COUNTRIES_50M__: unknown;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── types ────────────────────────────────────────────────────────────────────

type TierId = "inner" | "eu" | "associate" | "friends";
type SceneKey = "world" | "europe" | TierId;
type ToneId = "cream" | "sand" | "teal" | "navy";
type CountryEntry = [string, string, string]; // [numericId, isoCode, name]

interface Tier {
  id: TierId;
  order: number;
  title: string;
  shortTitle: string;
  tone: ToneId;
  summary: string;
  capabilities: string[];
  directCountries: CountryEntry[];
}

interface BenefitPill {
  id: string;
  title: string;
  shortText: string;
  tooltip: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

interface CapabilityInfo {
  label: string;
  tooltip: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

interface ModalContent {
  eyebrow: string;
  title: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

interface CountryMeta {
  id: string;
  code: string;
  name: string;
  tier: TierId;
}

interface GeometryLayout {
  bounds: [[number, number], [number, number]];
  centroid: [number, number];
}

interface LabelDatum {
  id: string;
  text: string;
  centroid: [number, number];
}

interface FitOptions {
  bottomPad?: number;
  topPad?: number;
  europeOnly?: boolean;
}

interface EuropeBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface AppState {
  features: any[];
  featureByKey: Map<string, any>;
  activeTier: TierId | null;
  activeCountry: string | null;
  selectedIds: Set<string>;
  scene: SceneKey;
  userTouched: boolean;
}

// ─── bootstrap ────────────────────────────────────────────────────────────────

const EMBEDDED_WORLD_TOPOLOGY = null;

const d3 = window.d3;
const topojson = window.topojson;

if (!d3 || !topojson) {
  throw new Error("D3 and TopoJSON must be loaded before the map app starts.");
}

// ─── constants ────────────────────────────────────────────────────────────────

const COLORS: Record<TierId, string> = {
  inner: "#053f70",
  eu: "#72bfd0",
  associate: "#f8e6a7",
  friends: "#fff8ee",
};

const CIRCLE_FLAG_SVGS: Record<string, string> = import.meta.glob(
  "../node_modules/circle-flags/flags/*.svg",
  { eager: true, import: "default", query: "?url" },
);

const TOPOLOGY_URL_110M = "countries-110m.json";
const TOPOLOGY_URL_50M = "countries-50m.json";
const UKRAINE_ID = "804";
const CRIMEA_ID = "Crimea";
const FRANCE_ID = "250";

const EUROPE_BOUNDS: EuropeBounds = {
  minLon: -31,
  maxLon: 45,
  minLat: 34,
  maxLat: 72,
};

const SCENARIO_EXTRA_FEATURES: any[] = [
  {
    type: "Feature",
    id: "470",
    properties: { name: "Malta" },
    geometry: { type: "Point", coordinates: [14.3754, 35.9375] },
  },
  {
    type: "Feature",
    id: CRIMEA_ID,
    properties: { name: "Crimea" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [33.5937,46.0967],[33.6549,46.1471],[33.6585,46.22],[33.8061,46.2078],[34.0257,46.1071],
        [34.1265,46.0898],[34.2237,46.1019],[34.3533,46.062],[34.4505,45.9665],[34.5225,45.9769],
        [34.6881,45.9769],[34.7925,45.8919],[34.7997,45.7912],[34.9473,45.7287],[35.0014,45.7339],
        [35.023,45.7009],[35.2606,45.4475],[35.3722,45.3537],[35.4586,45.3155],[35.5594,45.3103],
        [35.7502,45.3902],[35.833,45.4023],[36.013,45.3711],[36.0778,45.4249],[36.1714,45.4527],
        [36.2902,45.4561],[36.427,45.4336],[36.5746,45.3936],[36.5134,45.3034],[36.4522,45.2322],
        [36.427,45.1541],[36.3946,45.0655],[36.229,45.0256],[36.0562,45.0308],[35.869,45.0048],
        [35.8042,45.0395],[35.761,45.0707],[35.6782,45.102],[35.5702,45.1194],[35.473,45.0985],
        [35.3578,44.9787],[35.1562,44.8971],[35.0878,44.8034],[34.8861,44.8242],[34.7169,44.8069],
        [34.4685,44.7218],[34.2813,44.5378],[34.0761,44.4232],[33.9105,44.3868],[33.7557,44.3989],
        [33.6549,44.4336],[33.4497,44.5534],[33.4641,44.5968],[33.4929,44.6194],[33.5289,44.6801],
        [33.6117,44.9076],[33.6009,44.9822],[33.5541,45.0968],[33.3921,45.1871],[33.2625,45.1714],
        [33.1869,45.194],[32.9169,45.3485],[32.7729,45.3589],[32.6109,45.3277],[32.5533,45.3502],
        [32.5065,45.4041],[32.8269,45.5933],[33.1437,45.7495],[33.2805,45.7652],[33.4677,45.8381],
        [33.6657,45.9474],[33.6369,46.0325],[33.5937,46.0967],
      ]],
    },
  },
];

const SCENARIO_FEATURE_TIER = new Map<string, TierId>([[CRIMEA_ID, "associate"]]);
const FEATURE_ALIASES_BY_COUNTRY = new Map<string, string[]>([[UKRAINE_ID, [CRIMEA_ID]]]);
const PRIMARY_COUNTRY_BY_ALIAS = new Map<string, string>([[CRIMEA_ID, UKRAINE_ID]]);
const FLAG_CODE_OVERRIDES = new Map<string, string>([["UK", "GB"]]);

// ─── tier data ────────────────────────────────────────────────────────────────

const tiers: Tier[] = [
  {
    id: "friends",
    order: 1,
    title: "European Community + Friends",
    shortTitle: "Community + Friends",
    tone: "cream",
    summary:
      "A wider democratic circle for security, climate, energy, crises, and supply chains.",
    capabilities: ["Security", "Climate policy", "Energy", "Crisis response"],
    directCountries: [
      ["124", "CA", "Canada"],
      ["036", "AU", "Australia"],
      ["392", "JP", "Japan"],
      ["410", "KR", "South Korea"],
      ["554", "NZ", "New Zealand"],
    ],
  },
  {
    id: "associate",
    order: 2,
    title: "Associate Membership",
    shortTitle: "Associate",
    tone: "sand",
    summary:
      "A bridge tier for candidates, close neighbours, and partners aligned with the single market path.",
    capabilities: ["Single market access", "Customs alignment", "Budget path", "Rule of law"],
    directCountries: [
      ["804", "UA", "Ukraine"],
      ["498", "MD", "Moldova"],
      ["268", "GE", "Georgia"],
      ["008", "AL", "Albania"],
      ["070", "BA", "Bosnia and Herzegovina"],
      ["499", "ME", "Montenegro"],
      ["688", "RS", "Serbia"],
      ["807", "MK", "North Macedonia"],
      ["Kosovo", "XK", "Kosovo"],
      ["792", "TR", "Turkey"],
      ["578", "NO", "Norway"],
      ["352", "IS", "Iceland"],
      ["234", "FO", "Faroe Islands"],
      ["304", "GL", "Greenland"],
      ["756", "CH", "Switzerland"],
      ["826", "UK", "United Kingdom"],
    ],
  },
  {
    id: "eu",
    order: 3,
    title: "European Union",
    shortTitle: "European Union",
    tone: "teal",
    summary:
      "The shared rights and obligations of membership: institutions, budget, law, and the single market.",
    capabilities: ["Single market", "EU budget", "EU law", "Representation"],
    directCountries: [
      ["040", "AT", "Austria"],
      ["100", "BG", "Bulgaria"],
      ["191", "HR", "Croatia"],
      ["196", "CY", "Cyprus"],
      ["203", "CZ", "Czechia"],
      ["208", "DK", "Denmark"],
      ["233", "EE", "Estonia"],
      ["246", "FI", "Finland"],
      ["300", "GR", "Greece"],
      ["348", "HU", "Hungary"],
      ["372", "IE", "Ireland"],
      ["428", "LV", "Latvia"],
      ["440", "LT", "Lithuania"],
      ["442", "LU", "Luxembourg"],
      ["470", "MT", "Malta"],
      ["620", "PT", "Portugal"],
      ["642", "RO", "Romania"],
      ["703", "SK", "Slovakia"],
      ["705", "SI", "Slovenia"],
      ["752", "SE", "Sweden"],
    ],
  },
  {
    id: "inner",
    order: 4,
    title: "Inner Union",
    shortTitle: "Inner Union",
    tone: "navy",
    summary:
      "A frontrunner group for common defence, eurozone depth, Schengen, and unified foreign policy.",
    capabilities: ["Foreign policy", "Common defence", "Eurozone", "Schengen"],
    directCountries: [
      ["056", "BE", "Belgium"],
      ["276", "DE", "Germany"],
      ["250", "FR", "France"],
      ["380", "IT", "Italy"],
      ["724", "ES", "Spain"],
      ["528", "NL", "Netherlands"],
      ["616", "PL", "Poland"],
    ],
  },
];

// ─── benefit pills data ───────────────────────────────────────────────────────

const benefitPills: BenefitPill[] = [
  {
    id: "open-doors",
    title: "Open doors",
    shortText: "Progress before full membership",
    tooltip:
      "Not yet a member should not mean standing still. Associate membership could give candidate countries and close partners a visible way to move closer before full accession is complete.",
    modalTitle: "Make progress visible before full EU membership.",
    modalBody:
      "EU accession can take many years. A tiered model could give countries a recognised place on the European path while reforms, negotiations, and political decisions continue. This could include gradual alignment with EU rules, closer market access, customs cooperation, funding pathways, institutional preparation, and rule-of-law milestones.",
    keyIdea:
      "Countries should not be left in a vague waiting room. They should be able to show real progress, build trust, and move step by step toward deeper integration.",
    caveat:
      "This should not replace full membership for countries that qualify. It should make the road toward membership clearer and more useful.",
  },
  {
    id: "shared-standards",
    title: "Shared standards",
    shortText: "One foundation of values",
    tooltip:
      "Different tiers should not mean different values. Every closer circle should remain anchored in democracy, rule of law, human rights, and legal reliability.",
    modalTitle: "A tiered Europe still needs a common foundation.",
    modalBody:
      "A tiered model only works if the circles are connected by shared democratic and legal standards. Countries may cooperate at different depths, but the direction should remain the same.",
    keyIdea:
      "Flexibility should not become a loophole. Moving closer should require stronger alignment with the EU\u2019s values and legal order.",
    caveat:
      "Without shared standards, the tiers become purely transactional. With shared standards, they become a credible path toward trust, stability, and deeper cooperation.",
  },
  {
    id: "strategic-weight",
    title: "Strategic weight",
    shortText: "More reach with trusted partners",
    tooltip:
      "Europe can act with more weight when it cooperates beyond its borders. Security, energy, climate, supply chains, and crisis response often need partners outside the EU itself.",
    modalTitle: "Some challenges are bigger than the EU\u2019s borders.",
    modalBody:
      "A tiered Europe could make it easier to cooperate with democratic partners on issues where geography, security, trade, technology, and energy are already connected.",
    keyIdea:
      "Not every partnership needs to be a membership promise. Some countries may never join the EU, but they can still be important democratic partners.",
    caveat:
      "This outer circle should be about practical cooperation, not pretending that all partners are on the same membership path.",
  },
  {
    id: "forward-motion",
    title: "Forward motion",
    shortText: "A path inward over time",
    tooltip:
      "Tiers should be paths, not permanent labels. Countries should be able to move inward as reforms, capacity, trust, and public support grow.",
    modalTitle: "A tiered Europe should behave like a ladder.",
    modalBody:
      "The purpose of tiers is not to freeze countries into fixed categories. The purpose is to make movement possible.",
    keyIdea:
      "The map should show direction, not destiny. Tiers are useful only if countries can move closer when they are ready.",
    caveat:
      "Movement inward should not be automatic. It should depend on real reforms, mutual trust, legal alignment, and public consent.",
  },
];

// ─── capability info data ─────────────────────────────────────────────────────

const capabilityInfoList: CapabilityInfo[] = [
  // ── friends ──
  {
    label: "Security",
    tooltip:
      "Democratic partners can coordinate on shared security threats, intelligence, and resilience without full EU membership.",
    modalTitle: "Security cooperation beyond EU borders.",
    modalBody:
      "Security threats — hybrid attacks, disinformation, energy disruption, and regional conflicts — do not stop at EU borders. A wider democratic circle can coordinate responses, share intelligence, align sanctions policy, and build collective resilience. This gives both the EU and its partners more reach.",
    keyIdea:
      "Partners who share values can act together on security even from outside the EU structure.",
    caveat:
      "Outer-tier security cooperation is distinct from a common EU defence, which requires deeper integration and belongs to the inner circle.",
  },
  {
    label: "Climate\u00a0policy",
    tooltip:
      "Climate action is stronger when democratic partners beyond the EU coordinate on targets, standards, and transition costs.",
    modalTitle: "Climate cooperation works better at a wider scale.",
    modalBody:
      "Carbon pricing, clean energy investment, supply chain standards, and climate resilience all benefit from coordination across borders. A wider tier of partners aligned on climate goals can act with more collective weight — and avoid carbon leakage caused by diverging standards.",
    keyIdea:
      "Climate is a shared problem. Connecting democratic partners on climate policy gives Europe more influence and coherence.",
    caveat:
      "Outer-tier partners can align on outcomes and targets without being subject to EU climate legislation directly.",
  },
  {
    label: "Energy",
    tooltip:
      "Energy security across Europe depends on interconnected grids, diversified supply, and trusted partners beyond EU borders.",
    modalTitle: "Energy security needs a wider network.",
    modalBody:
      "A reliable energy supply depends on infrastructure, diversification, and cooperation that reaches well beyond current EU members. Outer-tier partners can be part of coordinated energy planning, grid integration, and supply agreements — reducing dependence on single sources and increasing collective resilience.",
    keyIdea:
      "Energy independence for Europe is stronger when more democratic partners are part of the shared network.",
    caveat:
      "Full energy market integration — with common rules, shared pricing, and regulatory alignment — is deeper than what this outer tier implies.",
  },
  {
    label: "Crisis\u00a0response",
    tooltip:
      "Crises rarely respect borders. A wider circle of coordinated partners helps Europe respond to health, climate, and security emergencies faster.",
    modalTitle: "Coordinated crisis response reaches further.",
    modalBody:
      "A pandemic, a regional conflict, a climate disaster, or a financial shock can spill across continents. Outer-tier partners who coordinate on emergency preparedness, supply chain resilience, mutual assistance, and information sharing can help Europe and its partners respond more effectively when it matters most.",
    keyIdea:
      "A wider democratic circle is more resilient. Partners who share values and communication channels respond better together.",
    caveat:
      "Effective crisis coordination requires trust, transparency, and compatible systems — not formal membership, but genuine commitment.",
  },
  // ── associate ──
  {
    label: "Single\u00a0market\u00a0access",
    tooltip:
      "Associate members could participate in parts of the single market before full EU membership is settled.",
    modalTitle: "Market access as a bridge to full integration.",
    modalBody:
      "Full EU single market membership comes with obligations — common rules, regulatory alignment, court oversight, and financial contributions. Associate membership could offer staged or partial access, giving countries and businesses more certainty while the accession path continues. This keeps economic momentum alive during long political processes.",
    keyIdea:
      "Economic integration should not wait for political decisions that may take years. Staged market access keeps the path moving.",
    caveat:
      "Partial access without full obligations can create uneven conditions. The terms need to be clear, reciprocal, and tied to real progress.",
  },
  {
    label: "Customs\u00a0alignment",
    tooltip:
      "Aligning with EU customs rules reduces trade friction and signals regulatory commitment on the accession path.",
    modalTitle: "Customs alignment opens the trading relationship.",
    modalBody:
      "When a country aligns its customs procedures, tariff schedules, and border management with EU standards, it reduces trade barriers, simplifies supply chains, and signals regulatory seriousness. For associate-path countries, customs alignment can come well before full single market membership and delivers real economic benefits quickly.",
    keyIdea:
      "Customs alignment is one of the most practical early steps toward economic integration — visible, measurable, and mutually beneficial.",
    caveat:
      "Alignment without membership means accepting EU trade rules without a voice in setting them. Accession is ultimately meant to resolve that asymmetry.",
  },
  {
    label: "Budget\u00a0path",
    tooltip:
      "Associate members could access EU funding streams tied to reforms, infrastructure, and rule-of-law progress.",
    modalTitle: "Funding tied to progress, not just membership.",
    modalBody:
      "EU cohesion funds, structural funds, and investment programmes are powerful tools for reform and development. An associate membership tier could open pathways to some of these resources, tied to measurable milestones rather than waiting for full accession. This makes the reform journey financially supported, not just aspirational.",
    keyIdea:
      "Countries should not have to wait for full membership to benefit from EU investment that supports the reforms they are already making.",
    caveat:
      "Budget access without full budget obligations requires careful design to maintain fairness for full members and avoid creating permanent half-memberships.",
  },
  {
    label: "Rule\u00a0of\u00a0law",
    tooltip:
      "Rule-of-law alignment is both a condition for moving closer and a genuine benefit of closer ties with the EU.",
    modalTitle: "Rule of law as the gate and the prize.",
    modalBody:
      "Independent courts, anti-corruption standards, free media, and transparent public administration are not just requirements for EU membership — they are the foundations that make deeper integration trustworthy. For associate-path countries, rule-of-law progress should unlock closer access, not just satisfy a checklist.",
    keyIdea:
      "Rule of law is the shared foundation that makes every tier of integration credible. Real progress here should open real doors.",
    caveat:
      "Rule-of-law benchmarks must be genuine and measurable — not a moveable goalpost or a tool for indefinite delay.",
  },
  // ── eu ──
  {
    label: "Single\u00a0market",
    tooltip:
      "The single market gives EU members a seamless space for goods, services, capital, and people — one of the most integrated economic areas in the world.",
    modalTitle: "The single market is the EU\u2019s core economic achievement.",
    modalBody:
      "The four freedoms — free movement of goods, services, capital, and people — give EU members access to a market of hundreds of millions with no internal tariffs or regulatory barriers. For businesses, workers, and consumers, it is the most tangible daily benefit of EU membership. It requires common rules, shared enforcement, and a common court to function.",
    keyIdea:
      "The single market is not just a trade zone. It is a shared regulatory and legal space that requires collective commitment to maintain.",
    caveat:
      "Countries in outer tiers can access parts of the single market but not all of it. Full participation requires full obligations.",
  },
  {
    label: "EU\u00a0budget",
    tooltip:
      "Full EU members contribute to and benefit from a shared budget covering agriculture, cohesion, research, and crisis response.",
    modalTitle: "A shared budget funds shared priorities.",
    modalBody:
      "The EU budget funds cohesion policy for less-developed regions, agricultural support, research and innovation programmes, infrastructure investment, and crisis response. Full members contribute based on their economic size and draw based on agreed priorities. The budget is a key expression of solidarity and a driver of long-term convergence.",
    keyIdea:
      "Shared budget means shared responsibility. Full members have obligations and entitlements that reflect their commitment to the common project.",
    caveat:
      "Budget negotiations are politically difficult. Net contributor and net recipient countries have different interests, which creates recurring tensions inside the EU.",
  },
  {
    label: "EU\u00a0law",
    tooltip:
      "EU law is directly binding on all member states and takes precedence over national law in areas of EU competence.",
    modalTitle: "EU law creates a shared legal order.",
    modalBody:
      "EU regulations apply directly and uniformly in all member states. EU directives must be transposed into national law within set deadlines. The Court of Justice of the EU is the final authority on EU law. This shared legal order is what makes the single market and other EU commitments enforceable and reliable rather than voluntary.",
    keyIdea:
      "EU law is what turns political commitments into enforceable obligations. Without it, the EU would be a club of promises rather than a functioning legal space.",
    caveat:
      "EU law limits national autonomy in areas of EU competence. This is a deliberate trade-off — pooling sovereignty to create a reliable and predictable common space.",
  },
  {
    label: "Representation",
    tooltip:
      "Full EU members have seats and votes in the European Parliament, the Council, the Commission, and the EU courts.",
    modalTitle: "Representation means a seat at the table.",
    modalBody:
      "Full EU members send elected MEPs to the European Parliament, ministers to the Council, a Commissioner to the Commission, and judges to the Court of Justice. They participate in setting the rules they must follow. This political dimension — not just obligations but democratic ownership — is the core of what makes EU membership different from any other international arrangement.",
    keyIdea:
      "You cannot have the obligations of EU law without the right to shape those rules. Representation and integration are inseparable.",
    caveat:
      "Countries in outer tiers accept EU-aligned rules without full votes in making them. This democratic asymmetry is one of the strongest arguments for accession over permanent partial membership.",
  },
  // ── inner ──
  {
    label: "Foreign\u00a0policy",
    tooltip:
      "Inner Union members could move toward a unified foreign policy — speaking with a single voice on major global issues.",
    modalTitle: "A common foreign policy gives Europe strategic weight.",
    modalBody:
      "Today, EU foreign policy is often constrained by unanimity requirements and divergent national interests. A frontrunner group of willing states could move toward qualified majority voting on foreign policy, a common diplomatic service with real authority, coordinated positions at the UN and other multilateral bodies, and unified responses to major global events.",
    keyIdea:
      "Europe\u2019s influence in the world grows when its member states speak with one voice rather than many competing ones.",
    caveat:
      "Foreign policy is closely tied to national identity and historical relationships. Deeper integration here requires sustained political trust and a genuine shift in how governments see shared interests.",
  },
  {
    label: "Common\u00a0defence",
    tooltip:
      "A frontrunner group could develop genuine common defence capabilities, command structures, and joint procurement.",
    modalTitle: "Common defence is more than coordination.",
    modalBody:
      "A real common defence goes beyond sharing intelligence or running joint exercises. It means common command structures, pooled procurement and industrial capacity, mutual defence guarantees, joint operational planning, and a shared budget for military capability. This is the most integrated form of European security cooperation.",
    keyIdea:
      "Genuine common defence capacity would give Europe the ability to act — and deter — without depending entirely on US or NATO leadership.",
    caveat:
      "Common defence requires profound political trust and democratic accountability. It must be designed to complement NATO commitments, not create confusion about obligations and command.",
  },
  {
    label: "Eurozone",
    tooltip:
      "Sharing a currency deepens economic integration and requires close fiscal and monetary coordination between members.",
    modalTitle: "The eurozone is the EU\u2019s deepest economic integration.",
    modalBody:
      "Countries in the eurozone share a currency, a central bank, and increasingly common fiscal rules. Monetary policy is set collectively. Exchange rate risk disappears for internal trade. For the eurozone to function well, members need aligned economic structures, a shared fiscal backstop, robust crisis mechanisms, and genuine political commitment to the common currency project.",
    keyIdea:
      "Sharing a currency means sharing economic fate. It requires — and reinforces — closer integration across fiscal, regulatory, and political dimensions.",
    caveat:
      "Eurozone membership removes a key tool of economic adjustment — the exchange rate. It works best when members have strong institutions, aligned economic cycles, and genuine solidarity mechanisms.",
  },
  {
    label: "Schengen",
    tooltip:
      "The Schengen area removes border checks between members, making free movement a lived experience rather than just a legal right.",
    modalTitle: "Schengen makes borders invisible for people.",
    modalBody:
      "Within the Schengen area, people can cross borders between participating countries without passport checks. This is one of the most tangible expressions of European integration — free movement not just as a legal principle but as a daily reality for hundreds of millions of people living, working, and travelling across the continent.",
    keyIdea:
      "Schengen makes Europe feel like a single space. It requires deep trust in each member\u2019s border management, identity systems, and internal security.",
    caveat:
      "Schengen requires robust external border management and cooperation on internal security. It can come under pressure during migration crises, and temporary reintroduction of border checks has occurred.",
  },
];

const capabilityInfoByLabel = new Map<string, CapabilityInfo>(
  capabilityInfoList.map((c) => [c.label.replace(/\u00a0/g, " "), c]),
);

// ─── derived lookups ──────────────────────────────────────────────────────────

const tierById = new Map<TierId, Tier>(tiers.map((tier) => [tier.id, tier]));
const countryMeta = new Map<string, CountryMeta>();
const directTierByCountry = new Map<string, TierId>();

for (const tier of tiers) {
  for (const [id, code, name] of tier.directCountries) {
    countryMeta.set(id, { id, code, name, tier: tier.id });
    directTierByCountry.set(id, tier.id);
  }
}

const cumulativeTierIds: Record<TierId, string[]> = {
  inner: idsFor("inner"),
  eu: idsFor("inner", "eu"),
  associate: idsFor("inner", "eu", "associate"),
  friends: idsFor("inner", "eu", "associate", "friends"),
};

const scenes: Record<SceneKey, string[] | null> = {
  world: null,
  europe: idsFor("inner", "eu", "associate"),
  inner: cumulativeTierIds.inner,
  eu: cumulativeTierIds.eu,
  associate: cumulativeTierIds.associate,
  friends: cumulativeTierIds.friends,
};

// ─── state ────────────────────────────────────────────────────────────────────

const state: AppState = {
  features: [],
  featureByKey: new Map(),
  activeTier: null,
  activeCountry: null,
  selectedIds: new Set(),
  scene: "world",
  userTouched: false,
};

// ─── DOM references ───────────────────────────────────────────────────────────

const svg = d3.select("#mapSvg");
const tierDeck = document.querySelector<HTMLElement>("#tierDeck")!;
const sceneTabs = document.querySelector<HTMLElement>("#sceneTabs")!;
const legend = document.querySelector<HTMLElement>("#legend")!;
const countryCard = document.querySelector<HTMLElement>("#countryCard")!;
const mapWrap = document.querySelector<HTMLElement>(".map-wrap")!;
const benefitModal = document.querySelector<HTMLDialogElement>("#benefitModal")!;

// ─── d3 / map setup ───────────────────────────────────────────────────────────

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath(projection).pointRadius(4.8);
const graticule = d3.geoGraticule10();
const zoom = d3.zoom()
  .scaleExtent([1, 12])
  .filter((event: any) => {
    if (event.touches !== undefined) {
      return event.touches.length >= 2;
    }
    return (!event.ctrlKey || event.type === "wheel") && !event.button;
  })
  .on("zoom", onZoom);
const BASE_LABEL_PX = 22;

let mapLayer: any = null;
let countryLayer: any = null;
let labelLayer: any = null;
let tierCardElements: HTMLElement[] = [];
let countryChipElements: HTMLButtonElement[] = [];
let geometryCache = new Map<string, GeometryLayout>();
let width = 0;
let height = 0;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

// ─── init ─────────────────────────────────────────────────────────────────────
buildBenefitPills();
buildTierCards();
buildLegend();
loadMap();
// ─── benefit pill functions ───────────────────────────────────────────────────────────────────────────

const pillTooltipEl: HTMLDivElement = (() => {
  const el = document.createElement("div");
  el.className = "pill-tooltip";
  el.setAttribute("role", "tooltip");
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
})();

let pillTooltipTimer: ReturnType<typeof setTimeout> | null = null;

function showPillTooltip(anchor: HTMLElement): void {
  if (pillTooltipTimer) { clearTimeout(pillTooltipTimer); pillTooltipTimer = null; }
  const text = anchor.dataset.tooltip ?? "";
  if (!text) return;
  pillTooltipEl.textContent = text;
  pillTooltipEl.classList.add("is-visible");
  const r = anchor.getBoundingClientRect();
  const TOOLTIP_W = 280;
  let left = r.left + r.width / 2 - TOOLTIP_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_W - 8));
  pillTooltipEl.style.left = `${left}px`;
  pillTooltipEl.style.top = `${r.bottom + 10}px`;
}

function hidePillTooltip(): void {
  if (pillTooltipTimer) clearTimeout(pillTooltipTimer);
  pillTooltipTimer = setTimeout(() => pillTooltipEl.classList.remove("is-visible"), 100);
}

function openInfoModal(content: ModalContent): void {
  benefitModal.querySelector<HTMLElement>("#modalEyebrow")!.textContent = content.eyebrow;
  benefitModal.querySelector<HTMLElement>(".modal-title")!.textContent = content.title;
  benefitModal.querySelector<HTMLElement>(".modal-subtitle")!.textContent = content.modalTitle;
  benefitModal.querySelector<HTMLElement>(".modal-body")!.textContent = content.modalBody;
  benefitModal.querySelector<HTMLElement>(".modal-key-idea")!.textContent = content.keyIdea;
  benefitModal.querySelector<HTMLElement>(".modal-caveat")!.textContent = content.caveat;
  benefitModal.showModal();
}

function buildBenefitPills(): void {
  const container = document.querySelector<HTMLElement>("#benefitPills")!;
  container.innerHTML = benefitPills
    .map(
      (pill) =>
        `<button type="button" class="benefit-pill" data-pill="${pill.id}" data-tooltip="${escapeAttribute(pill.tooltip)}">
          <strong class="pill-title">${pill.title}</strong>
          <span class="pill-short">${pill.shortText}</span>
        </button>`,
    )
    .join("");

  const canHover = window.matchMedia("(hover: hover)").matches;

  container.querySelectorAll<HTMLButtonElement>(".benefit-pill").forEach((btn) => {
    if (canHover) {
      btn.addEventListener("mouseenter", () => showPillTooltip(btn));
      btn.addEventListener("mouseleave", () => hidePillTooltip());
      btn.addEventListener("focus", () => showPillTooltip(btn));
      btn.addEventListener("blur", () => hidePillTooltip());
    }
    btn.addEventListener("click", () => {
      hidePillTooltip();
      const pill = benefitPills.find((p) => p.id === btn.dataset.pill)!;
      openInfoModal({
        eyebrow: "Core principle",
        title: pill.title,
        modalTitle: pill.modalTitle,
        modalBody: pill.modalBody,
        keyIdea: pill.keyIdea,
        caveat: pill.caveat,
      });
    });
  });

  benefitModal.querySelector<HTMLButtonElement>(".modal-close")!.addEventListener("click", () => {
    benefitModal.close();
  });

  benefitModal.addEventListener("click", (e) => {
    if (e.target === benefitModal) benefitModal.close();
  });
}
// ─── helpers ──────────────────────────────────────────────────────────────────

function idsFor(...tierIds: TierId[]): string[] {
  return tierIds.flatMap((tierId) => tierById.get(tierId)!.directCountries.map(([id]) => id));
}

function keyForFeature(feature: any): string {
  return feature.id || feature.properties?.name;
}

function tierForFeature(feature: any): TierId | undefined {
  const key = keyForFeature(feature);
  return (
    directTierByCountry.get(key) ??
    SCENARIO_FEATURE_TIER.get(key) ??
    directTierByCountry.get(canonicalCountryId(key))
  );
}

function canonicalCountryId(countryId: string): string {
  return PRIMARY_COUNTRY_BY_ALIAS.get(countryId) ?? countryId;
}

function countryIdsFor(countryId: string): string[] {
  const canonicalId = canonicalCountryId(countryId);
  return [canonicalId, ...(FEATURE_ALIASES_BY_COUNTRY.get(canonicalId) ?? [])];
}

function expandedCountryIds(ids: string[]): string[] {
  return ids.flatMap((id) => countryIdsFor(id));
}

function selectedCountrySet(ids: string[]): Set<string> {
  return new Set(expandedCountryIds(ids));
}

function metaForCountry(countryId: string): CountryMeta | undefined {
  return countryMeta.get(canonicalCountryId(countryId));
}

function isAliasCountryId(countryId: string): boolean {
  return PRIMARY_COUNTRY_BY_ALIAS.has(countryId);
}

function flagCodeFor(code: string): string {
  return (FLAG_CODE_OVERRIDES.get(code) ?? code).toLowerCase();
}

function flagImageSrc(code: string): string {
  return CIRCLE_FLAG_SVGS[`../node_modules/circle-flags/flags/${flagCodeFor(code)}.svg`] ?? "";
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function withScenarioFeatures(features: any[]): any[] {
  const existingKeys = new Set(features.map(keyForFeature));
  const normalizedFeatures = features.map((feature) => {
    if (keyForFeature(feature) !== FRANCE_ID) return feature;
    return featureWithEuropeanPolygons(feature);
  });
  const missingFeatures = SCENARIO_EXTRA_FEATURES.filter(
    (feature) => !existingKeys.has(keyForFeature(feature)),
  );
  return missingFeatures.length ? normalizedFeatures.concat(missingFeatures) : normalizedFeatures;
}

function featureWithEuropeanPolygons(feature: any): any {
  if (feature.geometry?.type !== "MultiPolygon") return feature;

  const coordinates = feature.geometry.coordinates.filter(
    (polygon: number[][][]) => polygonIntersectsBounds(polygon, EUROPE_BOUNDS),
  );
  if (!coordinates.length) return feature;

  return { ...feature, geometry: { ...feature.geometry, coordinates } };
}

function polygonIntersectsBounds(polygon: number[][][], bounds: EuropeBounds): boolean {
  const points = polygon.flat();
  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  return (
    Math.max(...longitudes) >= bounds.minLon &&
    Math.min(...longitudes) <= bounds.maxLon &&
    Math.max(...latitudes) >= bounds.minLat &&
    Math.min(...latitudes) <= bounds.maxLat
  );
}

function clipFeatureToEurope(feature: any): any | null {
  const geom = feature?.geometry;
  if (!geom) return feature;

  if (geom.type === "Point") {
    const [lon, lat]: [number, number] = geom.coordinates;
    return lon >= EUROPE_BOUNDS.minLon && lon <= EUROPE_BOUNDS.maxLon &&
           lat >= EUROPE_BOUNDS.minLat && lat <= EUROPE_BOUNDS.maxLat
      ? feature : null;
  }

  if (geom.type === "Polygon") {
    return polygonIntersectsBounds(geom.coordinates, EUROPE_BOUNDS) ? feature : null;
  }

  if (geom.type === "MultiPolygon") {
    const coordinates = geom.coordinates.filter(
      (poly: number[][][]) => polygonIntersectsBounds(poly, EUROPE_BOUNDS),
    );
    if (!coordinates.length) return null;
    if (coordinates.length === geom.coordinates.length) return feature;
    return { ...feature, geometry: { ...geom, coordinates } };
  }

  return feature;
}

function layoutForFeature(feature: any): GeometryLayout | null {
  const key = keyForFeature(feature);
  const cached = geometryCache.get(key);
  if (cached) return cached;

  const centroid: [number, number] = path.centroid(feature);
  if (!centroid || centroid.some(Number.isNaN)) return null;

  const bounds = path.bounds(feature);
  const layout: GeometryLayout = { bounds, centroid };
  geometryCache.set(key, layout);
  return layout;
}

// ─── render functions ─────────────────────────────────────────────────────────

function buildTierCards(): void {
  tierDeck.innerHTML = tiers
    .map((tier) => {
      const chips = tier.directCountries
        .map(([id, code, name]) => {
          const safeName = escapeAttribute(name);
          return `<button type="button" class="country-chip" data-country="${id}" data-code="${code}" aria-label="${safeName}" title="${safeName}">
              <img class="chip-flag" src="${flagImageSrc(code)}" width="28" height="28" alt="" loading="lazy" decoding="async">
            </button>`;
        })
        .join("");
      const caps = tier.capabilities
        .map((capability) => {
          const key = capability.replace(/\u00a0/g, " ");
          const info = capabilityInfoByLabel.get(key);
          if (!info) return `<span class="capability">${capability}</span>`;
          return `<button type="button" class="capability" data-cap-key="${escapeAttribute(key)}" data-tooltip="${escapeAttribute(info.tooltip)}">${capability}</button>`;
        })
        .join("");

      return `
        <article class="tier-card" data-tier="${tier.id}" tabindex="0">
          <div class="tier-head">
            <span class="tier-number">${tier.order}</span>
            <div>
              <h2 class="tier-title">${tier.title}</h2>
              <div class="tier-meta-row">
                <div class="capabilities">${caps}</div>
              </div>
            </div>
          </div>
          <p class="tier-summary">${tier.summary}</p>
          <div class="country-grid">${chips}</div>
        </article>
      `;
    })
    .join("");

  tierCardElements = [...tierDeck.querySelectorAll<HTMLElement>(".tier-card")];
  countryChipElements = [...tierDeck.querySelectorAll<HTMLButtonElement>("[data-country]")];

  tierCardElements.forEach((card) => {
    card.addEventListener("mouseenter", () => activateTier(card.dataset.tier as TierId));
    card.addEventListener("focusin", () => activateTier(card.dataset.tier as TierId));
    card.addEventListener("mouseleave", clearSoftFocus);
  });

  countryChipElements.forEach((button) => {
    button.addEventListener("mouseenter", () => activateCountry(button.dataset.country!, false));
    button.addEventListener("focus", () => activateCountry(button.dataset.country!, false));
    button.addEventListener("click", () => activateCountry(button.dataset.country!, true));
  });

  const canHoverCap = window.matchMedia("(hover: hover)").matches;
  tierDeck.querySelectorAll<HTMLButtonElement>("[data-cap-key]").forEach((btn) => {
    if (canHoverCap) {
      btn.addEventListener("mouseenter", () => showPillTooltip(btn));
      btn.addEventListener("mouseleave", () => hidePillTooltip());
      btn.addEventListener("focus", () => showPillTooltip(btn));
      btn.addEventListener("blur", () => hidePillTooltip());
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      hidePillTooltip();
      const info = capabilityInfoByLabel.get(btn.dataset.capKey!);
      if (info) openInfoModal({
        eyebrow: "Tier capability",
        title: info.label,
        modalTitle: info.modalTitle,
        modalBody: info.modalBody,
        keyIdea: info.keyIdea,
        caveat: info.caveat,
      });
    });
  });
}

function buildLegend(): void {
  const mobileLabels: Record<TierId, string> = {
    inner: "Inner Union",
    eu: "EU",
    associate: "Associate",
    friends: "Community",
  };

  legend.innerHTML = tiers
    .slice()
    .reverse()
    .map(
      (tier) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${COLORS[tier.id]}"></span>
          <span class="label-full">${tier.shortTitle}</span>
          <span class="label-short">${mobileLabels[tier.id]}</span>
        </div>
      `,
    )
    .join("");
}

// ─── map loading ──────────────────────────────────────────────────────────────

async function loadMixedFeatures(): Promise<any[]> {
  const tieredIds = new Set(countryMeta.keys());

  const [result110, result50] = await Promise.allSettled([
    window.__WORLD_ATLAS_COUNTRIES_110M__
      ? Promise.resolve(window.__WORLD_ATLAS_COUNTRIES_110M__)
      : d3.json(TOPOLOGY_URL_110M),
    window.__WORLD_ATLAS_COUNTRIES_50M__
      ? Promise.resolve(window.__WORLD_ATLAS_COUNTRIES_50M__)
      : d3.json(TOPOLOGY_URL_50M),
  ]);

  const topo110 = result110.status === "fulfilled" ? result110.value as any : null;
  const topo50  = result50.status  === "fulfilled" ? result50.value  as any : null;

  if (!topo110 && !topo50) {
    if (EMBEDDED_WORLD_TOPOLOGY) {
      const t: any = EMBEDDED_WORLD_TOPOLOGY;
      return topojson.feature(t, t.objects.countries).features;
    }
    throw new Error("No map topology could be loaded.");
  }

  // If only one loaded, fall back to it entirely.
  if (!topo50) return topojson.feature(topo110, topo110.objects.countries).features;
  if (!topo110) return topojson.feature(topo50,  topo50.objects.countries).features;

  // Both loaded — merge: high-detail 50m for tiered countries, 110m for everything else.
  const features110: any[] = topojson.feature(topo110, topo110.objects.countries).features;
  const features50:  any[] = topojson.feature(topo50,  topo50.objects.countries).features;

  // Build the 50m lookup keeping only the FIRST feature per id.
  // Some territories share a parent id (e.g. Ashmore and Cartier Is. reuse
  // Australia's "036"), so the Map constructor would silently overwrite the
  // main landmass with a tiny outlier if we used the last entry.
  const by50 = new Map<string, any>();
  for (const f of features50) {
    const id = String(f.id);
    if (!by50.has(id)) by50.set(id, f);
  }

  const merged = features110.map((f) => {
    const id = String(f.id);
    return tieredIds.has(id) && by50.has(id) ? by50.get(id) : f;
  });

  // Add tiered countries that exist in 50m but are absent from 110m (e.g. Malta).
  const in110 = new Set(features110.map((f) => String(f.id)));
  for (const f of features50) {
    if (tieredIds.has(String(f.id)) && !in110.has(String(f.id))) {
      merged.push(f);
    }
  }

  return merged;
}

async function loadMap(): Promise<void> {
  document.body.classList.add("is-loading");

  try {
    state.features = withScenarioFeatures(await loadMixedFeatures());
    state.featureByKey = new Map(state.features.map((feature) => [keyForFeature(feature), feature]));
    render();
    window.addEventListener("resize", onResize);
    focusScene("eu");
  } catch (error) {
    countryCard.innerHTML = `
      <p class="eyebrow">Map unavailable</p>
      <h2>The vector map could not load</h2>
      <p>${error instanceof Error ? error.message : String(error)}</p>
    `;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

// ─── map rendering ────────────────────────────────────────────────────────────

function render(): void {
  width = mapWrap.clientWidth;
  height = mapWrap.clientHeight;
  geometryCache = new Map();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  projection.fitExtent(
    [[20, 20], [width - 20, height - 20]],
    { type: "Sphere" },
  );

  svg.selectAll("*").remove();
  svg.call(zoom);

  mapLayer = svg.append("g").attr("class", "map-layer");
  countryLayer = mapLayer.append("g").attr("class", "country-layer");
  labelLayer = mapLayer.append("g").attr("class", "label-layer");

  mapLayer.append("path").datum(graticule).attr("class", "graticule").attr("d", path);

  countryLayer
    .selectAll("path")
    .data(state.features)
    .join("path")
    .attr("class", (feature: any) => {
      const tierId = tierForFeature(feature);
      return `country${tierId ? ` tier-${tierId}` : ""}`;
    })
    .attr("d", path)
    .attr("data-country", keyForFeature)
    .attr("data-tier", (feature: any) => tierForFeature(feature) ?? "")
    .on("mouseenter", (_event: MouseEvent, feature: any) => {
      const key = keyForFeature(feature);
      if (metaForCountry(key)) activateCountry(key, false);
    })
    .on("mouseleave", clearSoftFocus)
    .on("click", (_event: MouseEvent, feature: any) => {
      const key = keyForFeature(feature);
      if (metaForCountry(key)) activateCountry(key, true);
    });

  updateHighlights();
  svg.call(zoom.transform, d3.zoomIdentity);
}

function onResize(): void {
  if (resizeTimer !== null) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const activeIds = new Set(state.selectedIds);
    render();
    if (activeIds.size) fitToCountries([...activeIds], 0);
  }, 150);
}

function onZoom(event: any): void {
  if (mapLayer) mapLayer.attr("transform", event.transform);
  if (labelLayer) {
    labelLayer
      .selectAll(".country-label")
      .style("font-size", `${BASE_LABEL_PX / event.transform.k}px`);
  }
}

// ─── interaction ──────────────────────────────────────────────────────────────

function activateTier(tierId: TierId): void {
  state.activeTier = tierId;
  state.activeCountry = null;
  state.selectedIds = selectedCountrySet(cumulativeTierIds[tierId]);
  updateHighlights();
  renderCountryCardForTier(tierId);
  drawConnections();
}

function activateCountry(countryId: string, shouldZoom: boolean): void {
  const canonicalId = canonicalCountryId(countryId);
  const meta = metaForCountry(countryId);
  if (!meta) return;

  state.activeCountry = canonicalId;
  state.activeTier = meta.tier;
  state.selectedIds = selectedCountrySet([canonicalId]);
  state.userTouched = true;
  updateHighlights();
  renderCountryCardForCountry(meta);
  drawConnections();

  if (shouldZoom) fitToCountries(countryIdsFor(canonicalId), 700);
}

function clearSoftFocus(): void {
  if (state.activeCountry) return;
  if (!state.activeTier) return;

  state.activeTier = null;
  state.selectedIds = selectedCountrySet(scenes[state.scene] ?? []);
  updateHighlights();
}

function updateHighlights(): void {
  if (!countryLayer) return;

  const hasSelection = state.selectedIds.size > 0;

  countryLayer.selectAll(".country").each(function (this: Element, feature: any) {
    const key = keyForFeature(feature);
    const activeIds = state.activeCountry ? countryIdsFor(state.activeCountry) : [];
    const isSelected = state.selectedIds.has(key);
    this.classList.toggle("is-muted", hasSelection && !isSelected);
    this.classList.toggle("is-highlight", isSelected);
    this.classList.toggle("is-selected", activeIds.includes(key));
  });

  tierCardElements.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.tier === state.activeTier);
  });

  countryChipElements.forEach((chip) => {
    chip.classList.toggle("is-active", state.selectedIds.has(chip.dataset.country!));
  });

  drawLabels();
}

// ─── card rendering ───────────────────────────────────────────────────────────

function renderCountryCardForTier(tierId: TierId): void {
  const tier = tierById.get(tierId)!;
  countryCard.innerHTML = `
    <p class="eyebrow">Tier ${tier.order}</p>
    <span class="tier-pill" data-tier="${tier.id}">${tier.title}</span>
    <h2>${tier.shortTitle}</h2>
    <p>${tier.summary}</p>
  `;
}

function renderCountryCardForCountry(meta: CountryMeta): void {
  const tier = tierById.get(meta.tier)!;
  countryCard.innerHTML = `
    <p class="eyebrow">${meta.code}</p>
    <span class="tier-pill" data-tier="${tier.id}">Tier ${tier.order}: ${tier.shortTitle}</span>
    <h2>${meta.name}</h2>
    <p>${scenarioLine(meta, tier)}</p>
  `;
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

// ─── map overlays ─────────────────────────────────────────────────────────────

function drawConnections(): void {}

function drawLabels(): void {
  if (!labelLayer) return;

  const labels: LabelDatum[] =
    state.selectedIds.size <= 14
      ? [...state.selectedIds]
          .map((id): LabelDatum | null => {
            if (isAliasCountryId(id)) return null;
            const feature = state.featureByKey.get(id);
            const meta = countryMeta.get(id);
            if (!feature || !meta) return null;
            const layout = layoutForFeature(feature);
            if (!layout) return null;
            return { id, text: meta.name, centroid: layout.centroid };
          })
          .filter((item): item is LabelDatum => item !== null)
      : [];

  const currentScale: number = svg.node() ? d3.zoomTransform(svg.node()).k : 1;

  labelLayer
    .selectAll(".country-label")
    .data(labels, (item: LabelDatum) => item.id)
    .join("text")
    .attr("class", "country-label")
    .attr("x", (item: LabelDatum) => item.centroid[0])
    .attr("y", (item: LabelDatum) => item.centroid[1])
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", `${BASE_LABEL_PX / currentScale}px`)
    .text((item: LabelDatum) => item.text);
}

// ─── scene management ─────────────────────────────────────────────────────────

function focusScene(scene: SceneKey, options: { intro?: boolean } = {}): void {
  if (options.intro && state.userTouched) return;

  state.scene = scene;
  sceneTabs.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scene === scene);
  });

  if (scene === "world") {
    state.activeTier = null;
    state.activeCountry = null;
    state.selectedIds = new Set();
    updateHighlights();
    drawConnections();
    countryCard.innerHTML = `
      <p class="eyebrow">Global view</p>
      <h2>The democratic community</h2>
      <p>A tiered EU extends its circle beyond Europe, connecting with like-minded states on security, climate, energy, and trade — wherever shared values create a basis for cooperation.</p>
    `;
    svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity);
    return;
  }

  const ids = scenes[scene]!;
  state.activeCountry = null;
  state.activeTier = tierById.has(scene as TierId) ? (scene as TierId) : null;
  state.selectedIds = selectedCountrySet(ids);
  updateHighlights();

  if (state.activeTier) {
    renderCountryCardForTier(state.activeTier);
    drawConnections();
  } else {
    countryCard.innerHTML = `
      <p class="eyebrow">European theatre</p>
      <h2>Where the tiers overlap</h2>
      <p>Current EU members, accession-path countries, and close European partners form the main arena for a tiered future.</p>
    `;
    drawConnections();
  }

  const topPad = window.innerWidth <= 720 ? 60 : 0;
  const europeOnly = scene !== "friends";
  fitToCountries(ids, options.intro ? 1400 : 900, { bottomPad: 160, topPad, europeOnly });
}

function fitToCountries(ids: string[], duration = 900, { bottomPad = 0, topPad = 0, europeOnly = false }: FitOptions = {}): void {
  if (!ids.length) return;

  let features = ids.map((id) => state.featureByKey.get(id)).filter(Boolean);
  if (europeOnly) {
    features = features.map(clipFeatureToEurope).filter(Boolean);
  }
  if (!features.length) return;

  const bounds = path.bounds({ type: "FeatureCollection", features });
  const dx: number = bounds[1][0] - bounds[0][0];
  const dy: number = bounds[1][1] - bounds[0][1];
  const x: number = (bounds[0][0] + bounds[1][0]) / 2;
  const y: number = (bounds[0][1] + bounds[1][1]) / 2;
  const effectiveHeight = height - bottomPad - topPad;
  const scale = Math.max(1, Math.min(10, 0.84 / Math.max(dx / width, dy / effectiveHeight)));
  const translate: [number, number] = [width / 2 - scale * x, topPad + effectiveHeight / 2 - scale * y];

  svg
    .transition()
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

// ─── event listeners ──────────────────────────────────────────────────────────

sceneTabs.addEventListener("click", (event: MouseEvent) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-scene]");
  if (!button?.dataset.scene) return;
  state.userTouched = true;
  focusScene(button.dataset.scene as SceneKey);
});

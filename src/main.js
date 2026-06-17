const EMBEDDED_WORLD_TOPOLOGY = null;

const d3 = window.d3;
const topojson = window.topojson;

if (!d3 || !topojson) {
  throw new Error("D3 and TopoJSON must be loaded before the map app starts.");
}

const COLORS = {
  inner: "#053f70",
  eu: "#72bfd0",
  associate: "#f8e6a7",
  friends: "#fff8ee",
};

const CIRCLE_FLAG_SVGS = import.meta.glob("../node_modules/circle-flags/flags/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});
const MAP_TOPOLOGY_URLS = ["countries-110m.json", "countries-50m.json"];
const MAX_CONNECTIONS = 12;
const UKRAINE_ID = "804";
const CRIMEA_ID = "Crimea";
const FRANCE_ID = "250";
const EUROPE_BOUNDS = {
  minLon: -31,
  maxLon: 45,
  minLat: 34,
  maxLat: 72,
};
const SCENARIO_EXTRA_FEATURES = [
  {
    type: "Feature",
    id: "470",
    properties: { name: "Malta" },
    geometry: { type: "Point", coordinates: [14.3754, 35.9375] },
  },
  {
    type: "Feature",
    id: "Crimea",
    properties: { name: "Crimea" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [32.42, 45.29],
          [32.76, 45.44],
          [33.45, 45.95],
          [34.28, 46.17],
          [35.25, 46.02],
          [36.55, 45.36],
          [36.38, 44.9],
          [35.16, 44.42],
          [33.72, 44.44],
          [32.73, 44.62],
          [32.42, 45.29],
        ],
      ],
    },
  },
];
const SCENARIO_FEATURE_TIER = new Map([[CRIMEA_ID, "associate"]]);
const FEATURE_ALIASES_BY_COUNTRY = new Map([[UKRAINE_ID, [CRIMEA_ID]]]);
const PRIMARY_COUNTRY_BY_ALIAS = new Map([[CRIMEA_ID, UKRAINE_ID]]);
const FLAG_CODE_OVERRIDES = new Map([["UK", "GB"]]);

const tiers = [
  {
    id: "friends",
    order: 1,
    title: "European Community + Friends",
    shortTitle: "Community + Friends",
    tone: "cream",
    summary:
      "A wider democratic circle for security, climate, energy, crises, and supply chains.",
    capabilities: ["Security", "Climate policy", "Energy", "Crisis response"],
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
    capabilities: ["Single market access", "Customs alignment", "Budget path", "Rule of law"],
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
    capabilities: ["Single market", "EU budget", "EU law", "Representation"],
    directCountries: [
      ["040", "AT", "Austria"],
      ["056", "BE", "Belgium"],
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
    capabilities: ["Foreign policy", "Common defence", "Eurozone", "Schengen"],
    directCountries: [
      ["276", "DE", "Germany"],
      ["250", "FR", "France"],
      ["380", "IT", "Italy"],
      ["724", "ES", "Spain"],
      ["528", "NL", "Netherlands"],
      ["616", "PL", "Poland"],
    ],
  },
];

const tierById = new Map(tiers.map((tier) => [tier.id, tier]));
const countryMeta = new Map();
const directTierByCountry = new Map();

for (const tier of tiers) {
  for (const [id, code, name] of tier.directCountries) {
    countryMeta.set(id, { id, code, name, tier: tier.id });
    directTierByCountry.set(id, tier.id);
  }
}

const cumulativeTierIds = {
  inner: idsFor("inner"),
  eu: idsFor("inner", "eu"),
  associate: idsFor("inner", "eu", "associate"),
  friends: idsFor("inner", "eu", "associate", "friends"),
};

const scenes = {
  world: null,
  europe: idsFor("inner", "eu", "associate"),
  inner: cumulativeTierIds.inner,
  eu: cumulativeTierIds.eu,
  associate: cumulativeTierIds.associate,
  friends: cumulativeTierIds.friends,
};

const state = {
  features: [],
  featureByKey: new Map(),
  activeTier: null,
  activeCountry: null,
  selectedIds: new Set(),
  scene: "world",
  userTouched: false,
};

const svg = d3.select("#mapSvg");
const tierDeck = document.querySelector("#tierDeck");
const sceneTabs = document.querySelector("#sceneTabs");
const legend = document.querySelector("#legend");
const countryCard = document.querySelector("#countryCard");
const mapWrap = document.querySelector(".map-wrap");

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath(projection).pointRadius(4.8);
const graticule = d3.geoGraticule10();
const zoom = d3.zoom().scaleExtent([1, 12]).on("zoom", onZoom);
let mapLayer;
let countryLayer;
let connectionLayer;
let labelLayer;
let tierCardElements = [];
let countryChipElements = [];
let geometryCache = new Map();
let width = 0;
let height = 0;
let resizeTimer = null;

buildTierCards();
buildLegend();
loadMap();

function idsFor(...tierIds) {
  return tierIds.flatMap((tierId) => tierById.get(tierId).directCountries.map(([id]) => id));
}

function keyForFeature(feature) {
  return feature.id || feature.properties?.name;
}

function tierForFeature(feature) {
  const key = keyForFeature(feature);
  return (
    directTierByCountry.get(key) ||
    SCENARIO_FEATURE_TIER.get(key) ||
    directTierByCountry.get(canonicalCountryId(key))
  );
}

function canonicalCountryId(countryId) {
  return PRIMARY_COUNTRY_BY_ALIAS.get(countryId) || countryId;
}

function countryIdsFor(countryId) {
  const canonicalId = canonicalCountryId(countryId);
  return [canonicalId, ...(FEATURE_ALIASES_BY_COUNTRY.get(canonicalId) || [])];
}

function expandedCountryIds(ids) {
  return ids.flatMap((id) => countryIdsFor(id));
}

function selectedCountrySet(ids) {
  return new Set(expandedCountryIds(ids));
}

function metaForCountry(countryId) {
  return countryMeta.get(canonicalCountryId(countryId));
}

function isAliasCountryId(countryId) {
  return PRIMARY_COUNTRY_BY_ALIAS.has(countryId);
}

function flagCodeFor(code) {
  return (FLAG_CODE_OVERRIDES.get(code) || code).toLowerCase();
}

function flagImageSrc(code) {
  return CIRCLE_FLAG_SVGS[`../node_modules/circle-flags/flags/${flagCodeFor(code)}.svg`] || "";
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function withScenarioFeatures(features) {
  const existingKeys = new Set(features.map(keyForFeature));
  const normalizedFeatures = features.map((feature) => {
    if (keyForFeature(feature) !== FRANCE_ID) return feature;
    return featureWithEuropeanPolygons(feature);
  });
  const missingFeatures = SCENARIO_EXTRA_FEATURES.filter((feature) => !existingKeys.has(keyForFeature(feature)));
  return missingFeatures.length ? normalizedFeatures.concat(missingFeatures) : normalizedFeatures;
}

function featureWithEuropeanPolygons(feature) {
  if (feature.geometry?.type !== "MultiPolygon") return feature;

  const coordinates = feature.geometry.coordinates.filter((polygon) => polygonIntersectsBounds(polygon, EUROPE_BOUNDS));
  if (!coordinates.length) return feature;

  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates,
    },
  };
}

function polygonIntersectsBounds(polygon, bounds) {
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

function layoutForFeature(feature) {
  const key = keyForFeature(feature);
  const cached = geometryCache.get(key);
  if (cached) return cached;

  const centroid = path.centroid(feature);
  if (!centroid || centroid.some(Number.isNaN)) return null;

  const bounds = path.bounds(feature);
  const layout = { bounds, centroid };
  geometryCache.set(key, layout);
  return layout;
}

function buildTierCards() {
  tierDeck.innerHTML = tiers
    .map((tier) => {
      const chips = tier.directCountries
        .map(
          ([id, code, name]) => {
            const safeName = escapeAttribute(name);
            return `<button type="button" class="country-chip" data-country="${id}" data-code="${code}" aria-label="${safeName}" title="${safeName}">
              <img class="chip-flag" src="${flagImageSrc(code)}" width="28" height="28" alt="" loading="lazy" decoding="async">
            </button>`;
          },
        )
        .join("");
      const caps = tier.capabilities
        .map((capability) => `<span class="capability">${capability}</span>`)
        .join("");

      return `
        <article class="tier-card" data-tier="${tier.id}" tabindex="0">
          <div class="tier-head">
            <span class="tier-number">${tier.order}</span>
            <div>
              <h2 class="tier-title">${tier.title}</h2>
              <p class="tier-meta">${tier.directCountries.length} scenario countries</p>
            </div>
          </div>
          <p class="tier-summary">${tier.summary}</p>
          <div class="capabilities">${caps}</div>
          <div class="country-grid">${chips}</div>
        </article>
      `;
    })
    .join("");

  tierCardElements = [...tierDeck.querySelectorAll(".tier-card")];
  countryChipElements = [...tierDeck.querySelectorAll("[data-country]")];

  tierCardElements.forEach((card) => {
    card.addEventListener("mouseenter", () => activateTier(card.dataset.tier));
    card.addEventListener("focusin", () => activateTier(card.dataset.tier));
    card.addEventListener("mouseleave", clearSoftFocus);
  });

  countryChipElements.forEach((button) => {
    button.addEventListener("mouseenter", () => activateCountry(button.dataset.country, false));
    button.addEventListener("focus", () => activateCountry(button.dataset.country, false));
    button.addEventListener("click", () => activateCountry(button.dataset.country, true));
  });
}

function buildLegend() {
  legend.innerHTML = tiers
    .slice()
    .reverse()
    .map(
      (tier) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${COLORS[tier.id]}"></span>
          <span>${tier.shortTitle}</span>
        </div>
      `,
    )
    .join("");
}

async function loadTopology() {
  if (window.__WORLD_ATLAS_COUNTRIES_110M__) return window.__WORLD_ATLAS_COUNTRIES_110M__;
  if (window.__WORLD_ATLAS_COUNTRIES_50M__) return window.__WORLD_ATLAS_COUNTRIES_50M__;

  for (const url of MAP_TOPOLOGY_URLS) {
    try {
      const topology = await d3.json(url);
      if (topology) return topology;
    } catch {
      // Try the next map source before falling back to the embedded data.
    }
  }

  if (EMBEDDED_WORLD_TOPOLOGY) return EMBEDDED_WORLD_TOPOLOGY;
  throw new Error("No map topology could be loaded.");
}

async function loadMap() {
  document.body.classList.add("is-loading");

  try {
    const topology = await loadTopology();
    state.features = withScenarioFeatures(topojson.feature(topology, topology.objects.countries).features);
    state.featureByKey = new Map(state.features.map((feature) => [keyForFeature(feature), feature]));
    render();
    window.addEventListener("resize", onResize);
    setTimeout(() => focusScene("europe", { intro: true }), 900);
    setTimeout(() => focusScene("inner", { intro: true }), 2200);
    setTimeout(() => focusScene("friends", { intro: true }), 3600);
  } catch (error) {
    countryCard.innerHTML = `
      <p class="eyebrow">Map unavailable</p>
      <h2>The vector map could not load</h2>
      <p>${error.message}</p>
    `;
  } finally {
    document.body.classList.remove("is-loading");
  }
}

function render() {
  width = mapWrap.clientWidth;
  height = mapWrap.clientHeight;
  geometryCache = new Map();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  projection.fitExtent(
    [
      [20, 20],
      [width - 20, height - 20],
    ],
    { type: "Sphere" },
  );

  svg.selectAll("*").remove();
  svg.call(zoom);

  mapLayer = svg.append("g").attr("class", "map-layer");
  connectionLayer = mapLayer.append("g").attr("class", "connection-layer");
  countryLayer = mapLayer.append("g").attr("class", "country-layer");
  labelLayer = mapLayer.append("g").attr("class", "label-layer");

  mapLayer.append("path").datum(graticule).attr("class", "graticule").attr("d", path);

  countryLayer
    .selectAll("path")
    .data(state.features)
    .join("path")
    .attr("class", (feature) => {
      const tierId = tierForFeature(feature);
      return `country${tierId ? ` tier-${tierId}` : ""}`;
    })
    .attr("d", path)
    .attr("data-country", keyForFeature)
    .attr("data-tier", (feature) => tierForFeature(feature) || "")
    .on("mouseenter", (event, feature) => {
      const key = keyForFeature(feature);
      if (metaForCountry(key)) {
        activateCountry(key, false);
      }
    })
    .on("mouseleave", clearSoftFocus)
    .on("click", (event, feature) => {
      const key = keyForFeature(feature);
      if (metaForCountry(key)) {
        activateCountry(key, true);
      }
    });

  updateHighlights();
  svg.call(zoom.transform, d3.zoomIdentity);
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const activeIds = new Set(state.selectedIds);
    render();
    if (activeIds.size) {
      fitToCountries([...activeIds], 0);
    }
  }, 150);
}

function onZoom(event) {
  if (mapLayer) {
    mapLayer.attr("transform", event.transform);
  }
}

function activateTier(tierId) {
  state.activeTier = tierId;
  state.activeCountry = null;
  state.selectedIds = selectedCountrySet(cumulativeTierIds[tierId]);
  updateHighlights();
  renderCountryCardForTier(tierId);
  drawConnections([...tierById.get(tierId).directCountries.map(([id]) => id)]);
}

function activateCountry(countryId, shouldZoom) {
  const canonicalId = canonicalCountryId(countryId);
  const meta = metaForCountry(countryId);
  if (!meta) return;

  state.activeCountry = canonicalId;
  state.activeTier = meta.tier;
  state.selectedIds = selectedCountrySet([canonicalId]);
  state.userTouched = true;
  updateHighlights();
  renderCountryCardForCountry(meta);
  drawConnections(countryIdsFor(canonicalId));

  if (shouldZoom) {
    fitToCountries(countryIdsFor(canonicalId), 700);
  }
}

function clearSoftFocus() {
  if (state.activeCountry) return;
  if (!state.activeTier) return;

  state.activeTier = null;
  state.selectedIds = selectedCountrySet(scenes[state.scene] || []);
  updateHighlights();
}

function updateHighlights() {
  if (!countryLayer) return;

  const hasSelection = state.selectedIds.size > 0;

  countryLayer.selectAll(".country").each(function (feature) {
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
    chip.classList.toggle("is-active", state.selectedIds.has(chip.dataset.country));
  });

  drawLabels();
}

function renderCountryCardForTier(tierId) {
  const tier = tierById.get(tierId);
  countryCard.innerHTML = `
    <p class="eyebrow">Tier ${tier.order}</p>
    <span class="tier-pill" data-tier="${tier.id}">${tier.title}</span>
    <h2>${tier.shortTitle}</h2>
    <p>${tier.summary}</p>
  `;
}

function renderCountryCardForCountry(meta) {
  const tier = tierById.get(meta.tier);
  countryCard.innerHTML = `
    <p class="eyebrow">${meta.code}</p>
    <span class="tier-pill" data-tier="${tier.id}">Tier ${tier.order}: ${tier.shortTitle}</span>
    <h2>${meta.name}</h2>
    <p>${scenarioLine(meta, tier)}</p>
  `;
}

function scenarioLine(meta, tier) {
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

function drawConnections(ids) {
  if (!connectionLayer) return;

  const brussels = projection([4.3517, 50.8503]);
  const valid = ids
    .map((id) => state.featureByKey.get(id))
    .filter(Boolean)
    .slice(0, MAX_CONNECTIONS);

  const paths = valid
    .map((feature) => {
      const layout = layoutForFeature(feature);
      if (!layout) return null;
      const { centroid } = layout;
      const dx = centroid[0] - brussels[0];
      const dy = centroid[1] - brussels[1];
      const lift = Math.min(140, Math.max(38, Math.hypot(dx, dy) * 0.18));
      const midX = brussels[0] + dx * 0.5;
      const midY = brussels[1] + dy * 0.5 - lift;
      return {
        feature,
        d: `M${brussels[0]},${brussels[1]} Q${midX},${midY} ${centroid[0]},${centroid[1]}`,
        centroid,
      };
    })
    .filter(Boolean);

  connectionLayer
    .selectAll(".connection")
    .data(paths, (item) => keyForFeature(item.feature))
    .join(
      (enter) => enter.append("path").attr("class", "connection"),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr("class", "connection")
    .attr("d", (item) => item.d);

  connectionLayer
    .selectAll(".hub-dot")
    .data(paths.length ? [brussels] : [])
    .join(
      (enter) => enter.append("circle").attr("class", "hub-dot").attr("r", 5),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr("class", "hub-dot")
    .attr("cx", brussels[0])
    .attr("cy", brussels[1]);

  connectionLayer
    .selectAll(".country-dot")
    .data(paths, (item) => keyForFeature(item.feature))
    .join(
      (enter) => enter.append("circle").attr("class", "country-dot").attr("r", 3.5),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr("class", "country-dot")
    .attr("cx", (item) => item.centroid[0])
    .attr("cy", (item) => item.centroid[1]);
}

function drawLabels() {
  if (!labelLayer) return;

  const labels =
    state.selectedIds.size <= 14
      ? [...state.selectedIds]
          .map((id) => {
            if (isAliasCountryId(id)) return null;
            const feature = state.featureByKey.get(id);
            const meta = countryMeta.get(id);
            if (!feature || !meta) return null;
            const layout = layoutForFeature(feature);
            if (!layout) return null;
            return { id, text: meta.name, centroid: layout.centroid };
          })
          .filter(Boolean)
      : [];

  labelLayer
    .selectAll(".country-label")
    .data(labels, (item) => item.id)
    .join("text")
    .attr("class", "country-label")
    .classed("is-compact", state.scene === "inner" || state.activeTier === "inner")
    .attr("x", (item) => item.centroid[0] + 8)
    .attr("y", (item) => item.centroid[1] - 8)
    .text((item) => item.text);
}

function focusScene(scene, options = {}) {
  if (options.intro && state.userTouched) return;

  state.scene = scene;
  sceneTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scene === scene);
  });

  if (scene === "world") {
    state.activeTier = null;
    state.activeCountry = null;
    state.selectedIds = new Set();
    updateHighlights();
    drawConnections([]);
    svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity);
    return;
  }

  const ids = scenes[scene];
  state.activeCountry = null;
  state.activeTier = tierById.has(scene) ? scene : null;
  state.selectedIds = selectedCountrySet(ids);
  updateHighlights();

  if (state.activeTier) {
    renderCountryCardForTier(state.activeTier);
    drawConnections(tierById.get(state.activeTier).directCountries.map(([id]) => id));
  } else {
    countryCard.innerHTML = `
      <p class="eyebrow">European theatre</p>
      <h2>Where the tiers overlap</h2>
      <p>Current EU members, accession-path countries, and close European partners form the main arena for a tiered future.</p>
    `;
    drawConnections(idsFor("associate"));
  }

  fitToCountries(ids, options.intro ? 1400 : 900);
}

function fitToCountries(ids, duration = 900) {
  if (!ids || !ids.length) return;
  const features = ids.map((id) => state.featureByKey.get(id)).filter(Boolean);
  if (!features.length) return;

  const bounds = path.bounds({ type: "FeatureCollection", features });
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const x = (bounds[0][0] + bounds[1][0]) / 2;
  const y = (bounds[0][1] + bounds[1][1]) / 2;
  const scale = Math.max(1, Math.min(10, 0.84 / Math.max(dx / width, dy / height)));
  const translate = [width / 2 - scale * x, height / 2 - scale * y];

  svg
    .transition()
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

sceneTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scene]");
  if (!button) return;
  state.userTouched = true;
  focusScene(button.dataset.scene);
});

document.querySelector(".zoom-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-zoom]");
  if (!button) return;
  state.userTouched = true;

  if (button.dataset.zoom === "reset") {
    focusScene("world");
    return;
  }

  const factor = button.dataset.zoom === "in" ? 1.35 : 0.74;
  svg.transition().duration(260).call(zoom.scaleBy, factor);
});


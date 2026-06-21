import { CRIMEA_ID, FRANCE_ID } from "../domain/country-identity";
import type { TierId } from "../domain/tiered-europe";

export interface MapFeatureSets {
  interactionFeatures: any[];
  visualFeatures: any[];
}

interface EuropeBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const EUROPE_BOUNDS: EuropeBounds = {
  minLon: -31,
  maxLon: 45,
  minLat: 34,
  maxLat: 72,
};

const RUSSIA_ID = "643";
const EXCLUDED_MAP_FEATURE_IDS = new Set(["010"]);

const CRIMEA_BOUNDS: EuropeBounds = {
  minLon: 32,
  maxLon: 37,
  minLat: 44,
  maxLat: 47,
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

export const SCENARIO_FEATURE_TIER = new Map<string, TierId>([[CRIMEA_ID, "associate"]]);

export function keyForFeature(feature: any): string {
  return String(feature.id ?? feature.properties?.name ?? "");
}

export function firstFeatureByKey(features: any[]): Map<string, any> {
  const byKey = new Map<string, any>();
  for (const feature of features) {
    const key = keyForFeature(feature);
    if (!byKey.has(key)) byKey.set(key, feature);
  }
  return byKey;
}

export function withHighDetailInteractionFeatures(
  baseFeatures: any[],
  detailFeatures: any[],
  interactionCountryIds: ReadonlySet<string>,
): any[] {
  const baseByKey = firstFeatureByKey(baseFeatures);
  const detailByKey = firstFeatureByKey(detailFeatures);
  const missingFeatures = [...interactionCountryIds]
    .filter((id) => !baseByKey.has(id))
    .map((id) => detailByKey.get(id))
    .filter(Boolean);

  return missingFeatures.length ? baseFeatures.concat(missingFeatures) : baseFeatures;
}

export function withScenarioFeatures(features: any[]): any[] {
  const includedFeatures = features.filter(
    (feature) => !EXCLUDED_MAP_FEATURE_IDS.has(keyForFeature(feature)),
  );
  const existingKeys = new Set(includedFeatures.map(keyForFeature));
  const normalizedFeatures = includedFeatures.map(featureWithScenarioAdjustments);
  const missingFeatures = SCENARIO_EXTRA_FEATURES.filter(
    (feature) => !existingKeys.has(keyForFeature(feature)),
  );
  return missingFeatures.length ? normalizedFeatures.concat(missingFeatures) : normalizedFeatures;
}

export function clipFeatureToEurope(feature: any): any | null {
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

function featureWithScenarioAdjustments(feature: any): any {
  const key = keyForFeature(feature);
  if (key === FRANCE_ID) return featureWithEuropeanPolygons(feature);
  if (key === RUSSIA_ID) return featureWithoutCrimea(feature);
  return feature;
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

function featureWithoutCrimea(feature: any): any {
  if (feature.geometry?.type !== "MultiPolygon") return feature;

  const coordinates = feature.geometry.coordinates.filter(
    (polygon: number[][][]) => !polygonCenterWithinBounds(polygon, CRIMEA_BOUNDS),
  );
  if (coordinates.length === feature.geometry.coordinates.length) return feature;

  return { ...feature, geometry: { ...feature.geometry, coordinates } };
}

function polygonCenterWithinBounds(polygon: number[][][], bounds: EuropeBounds): boolean {
  const points = polygon.flat();
  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  const centerLon = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;

  return (
    centerLon >= bounds.minLon &&
    centerLon <= bounds.maxLon &&
    centerLat >= bounds.minLat &&
    centerLat <= bounds.maxLat
  );
}

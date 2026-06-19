import {
  firstFeatureByKey,
  type MapFeatureSets,
  withHighDetailInteractionFeatures,
  withScenarioFeatures,
} from "./scenario-map-features";

interface LoadScenarioMapFeatureSetsOptions {
  d3: any;
  topojson: any;
  interactionCountryIds: ReadonlySet<string>;
  embeddedWorldTopology?: unknown;
}

interface LoadedScenarioMapFeatureSets extends MapFeatureSets {
  highDetailFeatureByKey: Map<string, any>;
}

const TOPOLOGY_URL_110M = "countries-110m.json";
const TOPOLOGY_URL_50M = "countries-50m.json";

export async function loadScenarioMapFeatureSets({
  d3,
  topojson,
  interactionCountryIds,
  embeddedWorldTopology = null,
}: LoadScenarioMapFeatureSetsOptions): Promise<LoadedScenarioMapFeatureSets> {
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
    if (embeddedWorldTopology) {
      const topology: any = embeddedWorldTopology;
      const features: any[] = withScenarioFeatures(
        topojson.feature(topology, topology.objects.countries).features,
      );
      return {
        interactionFeatures: features,
        visualFeatures: features,
        highDetailFeatureByKey: firstFeatureByKey(features),
      };
    }
    throw new Error("No map topology could be loaded.");
  }

  if (!topo50) {
    const features110: any[] = withScenarioFeatures(
      topojson.feature(topo110, topo110.objects.countries).features,
    );
    return {
      interactionFeatures: features110,
      visualFeatures: features110,
      highDetailFeatureByKey: new Map(),
    };
  }

  if (!topo110) {
    const features50: any[] = withScenarioFeatures(
      topojson.feature(topo50, topo50.objects.countries).features,
    );
    return {
      interactionFeatures: features50,
      visualFeatures: features50,
      highDetailFeatureByKey: firstFeatureByKey(features50),
    };
  }

  const features110: any[] = withScenarioFeatures(
    topojson.feature(topo110, topo110.objects.countries).features,
  );
  const features50: any[] = withScenarioFeatures(
    topojson.feature(topo50, topo50.objects.countries).features,
  );

  // Keep only the first 50m feature per id. Some territories share a parent id,
  // so a plain Map constructor could replace a main landmass with a small outlier.
  const highDetailFeatureByKey = firstFeatureByKey(features50);

  return {
    interactionFeatures: withHighDetailInteractionFeatures(
      features110,
      features50,
      interactionCountryIds,
    ),
    visualFeatures: features50,
    highDetailFeatureByKey,
  };
}

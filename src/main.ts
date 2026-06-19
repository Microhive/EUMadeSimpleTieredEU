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

import { startTieredEuropeApp } from "./app/tiered-europe-app";

const d3 = window.d3;
const topojson = window.topojson;

if (!d3 || !topojson) {
  throw new Error("D3 and TopoJSON must be loaded before the map app starts.");
}

startTieredEuropeApp({ d3, topojson });

import type { TierId } from "../domain/tiered-europe";

export const TIER_COLORS: Record<TierId, string> = {
  inner: "#053f70",
  eu: "#72bfd0",
  associate: "#f8e6a7",
  friends: "#fff8ee",
};

export const MOBILE_LEGEND_LABELS: Record<TierId, string> = {
  inner: "Inner Union",
  eu: "EU",
  associate: "Associate",
  friends: "Community",
};

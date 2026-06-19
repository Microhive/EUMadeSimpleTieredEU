export const UKRAINE_ID = "804";
export const CRIMEA_ID = "Crimea";
export const FRANCE_ID = "250";

export const FEATURE_ALIASES_BY_COUNTRY = new Map<string, string[]>([
  [UKRAINE_ID, [CRIMEA_ID]],
]);

export const PRIMARY_COUNTRY_BY_ALIAS = new Map<string, string>([
  [CRIMEA_ID, UKRAINE_ID],
]);

export const FLAG_CODE_OVERRIDES = new Map<string, string>([["UK", "GB"]]);

export function canonicalCountryId(countryId: string): string {
  return PRIMARY_COUNTRY_BY_ALIAS.get(countryId) ?? countryId;
}

export function countryIdsFor(countryId: string): string[] {
  const canonicalId = canonicalCountryId(countryId);
  return [canonicalId, ...(FEATURE_ALIASES_BY_COUNTRY.get(canonicalId) ?? [])];
}

export function expandedCountryIds(ids: string[]): string[] {
  return ids.flatMap((id) => countryIdsFor(id));
}

export function selectedCountrySet(ids: string[]): Set<string> {
  return new Set(expandedCountryIds(ids));
}

export function isAliasCountryId(countryId: string): boolean {
  return PRIMARY_COUNTRY_BY_ALIAS.has(countryId);
}

export function flagCodeFor(code: string): string {
  return (FLAG_CODE_OVERRIDES.get(code) ?? code).toLowerCase();
}

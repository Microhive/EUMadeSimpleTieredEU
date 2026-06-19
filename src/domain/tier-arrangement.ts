import {
  canonicalCountryId,
  isAliasCountryId,
} from "./country-identity";
import type { CountryEntry, CountryMeta, SceneKey, Tier, TierId } from "./tiered-europe";

const SHARE_TIER_PARAM_IDS: readonly TierId[] = ["inner", "eu", "associate", "friends"];

const CUMULATIVE_TIER_ORDER: Record<TierId, TierId[]> = {
  inner: ["inner"],
  eu: ["inner", "eu"],
  associate: ["inner", "eu", "associate"],
  friends: ["inner", "eu", "associate", "friends"],
};

type CountryEntryResolver = (countryId: string) => CountryEntry | null;

export interface TierArrangement {
  readonly tiers: Tier[];
  applyQuery(search: string, resolveCountryEntry: CountryEntryResolver): boolean;
  clear(): void;
  countryIdsForInteraction(search: string): Set<string>;
  directTierForCountry(countryId: string): TierId | undefined;
  entryForCountry(countryId: string, resolveCountryEntry?: CountryEntryResolver): CountryEntry | null;
  hasDirectTier(countryId: string): boolean;
  hasTier(tierId: string): tierId is TierId;
  idsFor(...tierIds: TierId[]): string[];
  metaForCountry(countryId: string): CountryMeta | undefined;
  rememberCountryEntries(entries: CountryEntry[]): void;
  removeCountry(countryId: string): boolean;
  reset(): void;
  sceneIdsFor(scene: SceneKey): string[] | null;
  shareUrl(currentHref: string): string;
  tier(tierId: TierId): Tier;
  moveCountryToTier(countryId: string, targetTierId: TierId): boolean;
}

export function createTierArrangement(tiers: Tier[]): TierArrangement {
  const tierById = new Map<TierId, Tier>(tiers.map((tier) => [tier.id, tier]));
  const countryMeta = new Map<string, CountryMeta>();
  const directTierByCountry = new Map<string, TierId>();
  const countryCatalog = new Map<string, CountryEntry>();
  const originalTierCountries = new Map<TierId, CountryEntry[]>(
    tiers.map((tier) => [tier.id, tier.directCountries.map(copyCountryEntry)]),
  );

  syncLookups();

  function syncLookups(): void {
    countryMeta.clear();
    directTierByCountry.clear();

    for (const tier of tiers) {
      for (const entry of tier.directCountries) {
        const [id, code, name] = entry;
        countryCatalog.set(id, copyCountryEntry(entry));
        countryMeta.set(id, { id, code, name, tier: tier.id });
        directTierByCountry.set(id, tier.id);
      }
    }
  }

  function queryAssignments(search: string): Map<TierId, string[]> | null {
    const params = new URLSearchParams(search);
    if (!SHARE_TIER_PARAM_IDS.some((tierId) => params.has(tierId))) return null;

    const assignedCountries = new Set<string>();
    const assignments = new Map<TierId, string[]>();

    SHARE_TIER_PARAM_IDS.forEach((tierId) => {
      const ids = params
        .getAll(tierId)
        .flatMap((value) => value.split(","))
        .map((value) => canonicalCountryId(value.trim()))
        .filter((value) => value.length > 0)
        .filter((value) => {
          if (assignedCountries.has(value)) return false;
          assignedCountries.add(value);
          return true;
        });

      assignments.set(tierId, ids);
    });

    return assignments;
  }

  function tierCountryIdsFromQuery(search: string): string[] {
    const assignments = queryAssignments(search);
    if (!assignments) return [];
    return [...assignments.values()].flat();
  }

  function replaceTierCountryEntry(entry: CountryEntry): void {
    tiers.forEach((tier) => {
      const index = tier.directCountries.findIndex(([id]) => id === entry[0]);
      if (index >= 0) tier.directCountries[index] = copyCountryEntry(entry);
    });

    const meta = countryMeta.get(entry[0]);
    if (meta) {
      meta.code = entry[1];
      meta.name = entry[2];
    }
  }

  function rememberCountryEntry(entry: CountryEntry): void {
    const [id, , name] = entry;
    if (isAliasCountryId(id)) return;

    const existing = countryCatalog.get(id);
    if (existing) {
      if (existing[2] === id && name !== id) {
        countryCatalog.set(id, copyCountryEntry(entry));
        replaceTierCountryEntry(entry);
      }
      return;
    }

    countryCatalog.set(id, copyCountryEntry(entry));
  }

  function entryForCountry(
    countryId: string,
    resolveCountryEntry?: CountryEntryResolver,
  ): CountryEntry | null {
    const canonicalId = canonicalCountryId(countryId);
    const catalogEntry = countryCatalog.get(canonicalId);
    if (catalogEntry) return copyCountryEntry(catalogEntry);

    const resolvedEntry = resolveCountryEntry?.(canonicalId) ?? null;
    if (!resolvedEntry) return null;

    countryCatalog.set(canonicalId, copyCountryEntry(resolvedEntry));
    return copyCountryEntry(resolvedEntry);
  }

  function idsFor(...tierIds: TierId[]): string[] {
    return tierIds.flatMap((tierId) => tierById.get(tierId)!.directCountries.map(([id]) => id));
  }

  function cumulativeIdsFor(tierId: TierId): string[] {
    return idsFor(...CUMULATIVE_TIER_ORDER[tierId]);
  }

  return {
    tiers,
    applyQuery(search, resolveCountryEntry) {
      const assignments = queryAssignments(search);
      if (!assignments) return false;

      tiers.forEach((tier) => {
        tier.directCountries = [];
      });

      SHARE_TIER_PARAM_IDS.forEach((tierId) => {
        const tier = tierById.get(tierId)!;
        tier.directCountries = (assignments.get(tierId) ?? [])
          .map((id) => entryForCountry(id, resolveCountryEntry))
          .filter((entry): entry is CountryEntry => entry !== null);
      });

      syncLookups();
      return true;
    },
    clear() {
      tiers.forEach((tier) => {
        tier.directCountries = [];
      });
      syncLookups();
    },
    countryIdsForInteraction(search) {
      const ids = new Set<string>();

      tiers.forEach((tier) => {
        tier.directCountries.forEach(([id]) => ids.add(canonicalCountryId(id)));
      });
      originalTierCountries.forEach((entries) => {
        entries.forEach(([id]) => ids.add(canonicalCountryId(id)));
      });
      tierCountryIdsFromQuery(search).forEach((id) => ids.add(canonicalCountryId(id)));

      return ids;
    },
    directTierForCountry(countryId) {
      return directTierByCountry.get(canonicalCountryId(countryId));
    },
    entryForCountry,
    hasDirectTier(countryId) {
      return directTierByCountry.has(canonicalCountryId(countryId));
    },
    hasTier(tierId): tierId is TierId {
      return tierById.has(tierId as TierId);
    },
    idsFor,
    metaForCountry(countryId) {
      return countryMeta.get(canonicalCountryId(countryId));
    },
    rememberCountryEntries(entries) {
      entries.forEach(rememberCountryEntry);
    },
    removeCountry(countryId) {
      const canonicalId = canonicalCountryId(countryId);
      const sourceTierId = directTierByCountry.get(canonicalId);
      if (!sourceTierId) return false;

      const sourceTier = tierById.get(sourceTierId)!;
      const sourceIndex = sourceTier.directCountries.findIndex(([id]) => id === canonicalId);
      if (sourceIndex < 0) return false;

      sourceTier.directCountries.splice(sourceIndex, 1);
      directTierByCountry.delete(canonicalId);
      countryMeta.delete(canonicalId);
      return true;
    },
    reset() {
      tiers.forEach((tier) => {
        tier.directCountries = (originalTierCountries.get(tier.id) ?? []).map(copyCountryEntry);
      });
      syncLookups();
    },
    sceneIdsFor(scene) {
      if (scene === "world") return null;
      if (scene === "europe") return idsFor("inner", "eu", "associate");
      return cumulativeIdsFor(scene);
    },
    shareUrl(currentHref) {
      const url = new URL(currentHref);

      SHARE_TIER_PARAM_IDS.forEach((tierId) => {
        const tier = tierById.get(tierId)!;
        url.searchParams.set(tierId, tier.directCountries.map(([id]) => canonicalCountryId(id)).join(","));
      });

      return url.toString();
    },
    tier(tierId) {
      return tierById.get(tierId)!;
    },
    moveCountryToTier(countryId, targetTierId) {
      const canonicalId = canonicalCountryId(countryId);
      const sourceTierId = directTierByCountry.get(canonicalId);
      if (sourceTierId === targetTierId) return false;

      let entry: CountryEntry | undefined;
      if (sourceTierId) {
        const sourceTier = tierById.get(sourceTierId)!;
        const sourceIndex = sourceTier.directCountries.findIndex(([id]) => id === canonicalId);
        if (sourceIndex < 0) return false;
        [entry] = sourceTier.directCountries.splice(sourceIndex, 1);
      } else {
        const catalogEntry = countryCatalog.get(canonicalId);
        if (!catalogEntry) return false;
        entry = copyCountryEntry(catalogEntry);
      }

      const targetTier = tierById.get(targetTierId)!;
      targetTier.directCountries.push(entry);
      directTierByCountry.set(canonicalId, targetTierId);

      const meta = countryMeta.get(canonicalId);
      if (meta) {
        meta.tier = targetTierId;
      } else {
        const [id, code, name] = entry;
        countryMeta.set(canonicalId, { id, code, name, tier: targetTierId });
      }

      return true;
    },
  };
}

function copyCountryEntry([id, code, name]: CountryEntry): CountryEntry {
  return [id, code, name];
}

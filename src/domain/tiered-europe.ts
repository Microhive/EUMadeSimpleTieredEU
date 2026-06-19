export type TierId = "inner" | "eu" | "associate" | "friends";
export type SceneKey = "world" | "europe" | TierId;
export type ToneId = "cream" | "sand" | "teal" | "navy";
export type CountryEntry = [string, string, string]; // [numericId, isoCode, name]

export interface Tier {
  id: TierId;
  order: number;
  title: string;
  shortTitle: string;
  tone: ToneId;
  summary: string;
  capabilities: string[];
  directCountries: CountryEntry[];
}

export interface BenefitPill {
  id: string;
  title: string;
  shortText: string;
  tooltip: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

export interface CapabilityInfo {
  label: string;
  tooltip: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

export interface ModalContent {
  eyebrow: string;
  title: string;
  modalTitle: string;
  modalBody: string;
  keyIdea: string;
  caveat: string;
}

export interface CountryMeta {
  id: string;
  code: string;
  name: string;
  tier: TierId;
}

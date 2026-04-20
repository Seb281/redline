/**
 * Sample-contract catalog exposed to the compare page picker.
 *
 * Mirrors the six EU samples that the main upload page offers via
 * `handleDemo`, but re-exports them through a single indexed map so the
 * slot card can render a dropdown without importing six text modules
 * by name.
 */

import type { UploadResponse } from "@/types";
import {
  SAMPLE_CONTRACT_TEXT as NL_TEXT,
  SAMPLE_UPLOAD_RESPONSE as NL_UPLOAD,
} from "@/data/sample-contracts/nl-freelance";
import {
  FR_EMPLOYMENT_TEXT,
  FR_EMPLOYMENT_UPLOAD,
} from "@/data/sample-contracts/fr-employment";
import {
  DE_SAAS_DPA_TEXT,
  DE_SAAS_DPA_UPLOAD,
} from "@/data/sample-contracts/de-saas-dpa";
import {
  ES_SAAS_SERVICES_TEXT,
  ES_SAAS_SERVICES_UPLOAD,
} from "@/data/sample-contracts/es-saas-services";
import {
  IT_EMPLOYMENT_TEXT,
  IT_EMPLOYMENT_UPLOAD,
} from "@/data/sample-contracts/it-employment";
import {
  PL_DISTRIBUTION_TEXT,
  PL_DISTRIBUTION_UPLOAD,
} from "@/data/sample-contracts/pl-distribution";

/** Stable identifier used in sessionStorage keys and picker <option> values. */
export type SampleId = "nl" | "fr" | "de" | "es" | "it" | "pl";

/**
 * One entry per sample. `label` is a translation key resolved under the
 * `Compare.samples.*` namespace by the caller — the catalog itself is
 * framework-agnostic so it can be reused in tests and SSR.
 */
export interface SampleEntry {
  id: SampleId;
  labelKey:
    | "nl_freelance"
    | "fr_employment"
    | "de_saas_dpa"
    | "es_saas_services"
    | "it_employment"
    | "pl_distribution";
  text: string;
  upload: UploadResponse;
}

/** Ordered list — the picker renders samples in this order. */
export const SAMPLE_ENTRIES: readonly SampleEntry[] = [
  {
    id: "nl",
    labelKey: "nl_freelance",
    text: NL_TEXT,
    upload: NL_UPLOAD,
  },
  {
    id: "fr",
    labelKey: "fr_employment",
    text: FR_EMPLOYMENT_TEXT,
    upload: FR_EMPLOYMENT_UPLOAD,
  },
  {
    id: "de",
    labelKey: "de_saas_dpa",
    text: DE_SAAS_DPA_TEXT,
    upload: DE_SAAS_DPA_UPLOAD,
  },
  {
    id: "es",
    labelKey: "es_saas_services",
    text: ES_SAAS_SERVICES_TEXT,
    upload: ES_SAAS_SERVICES_UPLOAD,
  },
  {
    id: "it",
    labelKey: "it_employment",
    text: IT_EMPLOYMENT_TEXT,
    upload: IT_EMPLOYMENT_UPLOAD,
  },
  {
    id: "pl",
    labelKey: "pl_distribution",
    text: PL_DISTRIBUTION_TEXT,
    upload: PL_DISTRIBUTION_UPLOAD,
  },
] as const;

/** Lookup by id; returns `undefined` for an unknown id. */
export function getSample(id: string): SampleEntry | undefined {
  return SAMPLE_ENTRIES.find((s) => s.id === id);
}

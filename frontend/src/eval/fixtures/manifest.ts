/**
 * SP-10 Arc 1 Phase 4 — eval corpus manifest.
 *
 * Canonical mapping from contract slug (the JSON filename stem) to its
 * source text + the analysis-time defaults used during the original
 * capture. Frozen fixtures are keyed by slug, so both the freeze
 * harness and the loader read this file to stay in lockstep.
 *
 * Adding a new sample contract means: (1) export the text constant
 * from `src/data/sample-contracts/*`, (2) add a manifest entry here,
 * (3) regenerate the fixture via `FREEZE_FIXTURES=1 pnpm test`
 * against a live Mistral key, (4) hand-review the golden questions
 * that reference it.
 */

import { SAMPLE_CONTRACT_TEXT as NL_TEXT } from "@/data/sample-contracts/nl-freelance";
import { FR_COMMERCIAL_LEASE_TEXT } from "@/data/sample-contracts/fr-commercial-lease";
import { DE_EMPLOYMENT_TEXT } from "@/data/sample-contracts/de-employment";
import { ES_SAAS_SERVICES_TEXT } from "@/data/sample-contracts/es-saas-services";
import { IT_EMPLOYMENT_TEXT } from "@/data/sample-contracts/it-employment";
import { PL_DISTRIBUTION_TEXT } from "@/data/sample-contracts/pl-distribution";
import type { AnalysisMode } from "@/types";

export interface FixtureSource {
  /** Filename stem — `{slug}.json` under this directory. */
  slug: string;
  /** Stable label for logs + EVAL.md tables. */
  label: string;
  /** Raw contract text fed to Pass 0. */
  text: string;
  /** Role used during Pass 2 risk framing. Must match the capture run. */
  userRole: string;
  /** Analysis mode used during the capture run. */
  mode: AnalysisMode;
  /** Whether citations were requested during the capture run. */
  withCitations: boolean;
}

/**
 * Six EU jurisdictions × diverse contract archetypes — chosen so the
 * eval spans DE/NL/FR/ES/IT/PL statute shortlists and mixes
 * employment, freelance, SaaS, commercial lease, and distribution
 * flavours.
 */
export const FIXTURES: FixtureSource[] = [
  {
    slug: "nl-freelance",
    label: "NL freelance services",
    text: NL_TEXT,
    userRole: "Contractor",
    mode: "fast",
    withCitations: true,
  },
  {
    slug: "fr-commercial-lease",
    label: "FR commercial lease",
    text: FR_COMMERCIAL_LEASE_TEXT,
    userRole: "Preneur",
    mode: "fast",
    withCitations: true,
  },
  {
    slug: "de-employment",
    label: "DE employment",
    text: DE_EMPLOYMENT_TEXT,
    userRole: "Arbeitnehmer",
    mode: "fast",
    withCitations: true,
  },
  {
    slug: "es-saas-services",
    label: "ES SaaS services",
    text: ES_SAAS_SERVICES_TEXT,
    userRole: "Customer",
    mode: "fast",
    withCitations: true,
  },
  {
    slug: "it-employment",
    label: "IT employment",
    text: IT_EMPLOYMENT_TEXT,
    userRole: "Employee",
    mode: "fast",
    withCitations: true,
  },
  {
    slug: "pl-distribution",
    label: "PL distribution",
    text: PL_DISTRIBUTION_TEXT,
    userRole: "Distributor",
    mode: "fast",
    withCitations: true,
  },
];

/** All slugs in manifest order — stable iteration contract for the harness. */
export const FIXTURE_SLUGS = FIXTURES.map((f) => f.slug);

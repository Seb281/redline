/**
 * SP-10 Arc 1 Phase 4 — fixture shape tripwire.
 *
 * Runs on every `pnpm test`. Rejects any committed fixture that does
 * not conform to the current `AnalyzeResponse` schema. If the pipeline
 * schema changes (new required field, renamed enum value, removed
 * property), the tripwire fails here and the operator regenerates the
 * fixtures — keeping the eval corpus honest rather than letting it
 * silently drift.
 *
 * Skipped cleanly when no fixtures are yet committed (the test suite
 * still passes in fresh checkouts before the freeze harness has run).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  contractOverviewSchema,
  analyzedClauseSchema,
} from "@/lib/analyzer";
import { MISTRAL_EMBED_DIM } from "@/types";
import { loadAllFixtures } from "./load";

const reasoningEffortEnum = z.enum(["low", "medium", "high"]);

const analysisSummarySchema = z.object({
  total_clauses: z.number().int().nonnegative(),
  risk_breakdown: z.object({
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    informational: z.number().int().nonnegative(),
  }),
  top_risks: z.array(z.string()),
});

const provenanceSchema = z.object({
  provider: z.string(),
  model: z.string(),
  snapshot: z.string(),
  region: z.string(),
  reasoning_effort_per_pass: z.object({
    overview: reasoningEffortEnum,
    extraction: reasoningEffortEnum,
    risk: reasoningEffortEnum,
    think_hard: reasoningEffortEnum,
  }),
  prompt_template_version: z.string(),
  timestamp: z.string(),
  redaction_location: z.enum(["client", "server"]).optional(),
  text_source: z.enum(["native", "ocr", "hybrid"]).optional(),
  analysis_locale: z.string().optional(),
  schema_version: z.string().optional(),
});

const clauseEmbeddingSchema = z.object({
  clause_index: z.number().int().nonnegative(),
  embedding: z
    .array(z.number())
    .length(MISTRAL_EMBED_DIM, {
      message: `embedding must be ${MISTRAL_EMBED_DIM}-dim`,
    }),
});

const fixtureShapeSchema = z.object({
  overview: contractOverviewSchema,
  summary: analysisSummarySchema,
  clauses: z.array(analyzedClauseSchema).min(1),
  provenance: provenanceSchema,
  clause_embeddings: z.array(clauseEmbeddingSchema).optional(),
});

const { fixtures, stray } = loadAllFixtures();

describe("eval fixtures shape tripwire", () => {
  it("rejects stray JSON files not listed in the manifest", () => {
    // A stray file would silently widen the eval corpus; fail loud.
    expect(stray).toEqual([]);
  });

  if (fixtures.length === 0) {
    it.skip("no fixtures committed yet — run FREEZE_FIXTURES=1 pnpm test", () => {});
    return;
  }

  for (const { slug, value } of fixtures) {
    it(`${slug} conforms to AnalyzeResponse`, () => {
      const result = fixtureShapeSchema.safeParse(value);
      if (!result.success) {
        // Surface the full Zod error path on failure — without it the
        // assertion message is useless for debugging a wide schema.
        throw new Error(
          `fixture ${slug} failed schema:\n${JSON.stringify(result.error.format(), null, 2)}`,
        );
      }
      expect(result.success).toBe(true);
    });
  }

  it("every clause has a matching embedding when embeddings are present", () => {
    for (const { slug, value } of fixtures) {
      if (!value.clause_embeddings) continue;
      expect(
        value.clause_embeddings.length,
        `${slug}: embedding count must match clause count`,
      ).toBe(value.clauses.length);

      // Indices must be a permutation of [0, N).
      const indices = value.clause_embeddings
        .map((e) => e.clause_index)
        .sort((a, b) => a - b);
      const expected = Array.from({ length: value.clauses.length }, (_, i) => i);
      expect(indices, `${slug}: embedding indices must cover every clause`).toEqual(
        expected,
      );
    }
  });
});

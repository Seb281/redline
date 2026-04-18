/**
 * Rehydrate every user-facing string field on an analyzed clause so the
 * UI sees the real party names / emails instead of `⟦PARTY_A⟧`-style
 * tokens. Lives on the client — SP-1.6 moved redaction out of the
 * server route, so the token map never leaves the browser.
 *
 * Only operates on *complete* clause objects — streamed partials from
 * `elementStream` are delivered as whole objects by the AI SDK, so we
 * never rehydrate a half-formed token. Fields not present in `tokenMap`
 * are left as-is (defensive: if the LLM leaks a stray token past what
 * the scrubber registered, it is preserved verbatim rather than throwing).
 */

import type { AnalyzedClause } from "@/types";
import { rehydrate } from "./index";

export function rehydrateClause(
  c: AnalyzedClause,
  tokenMap: Map<string, string>,
): AnalyzedClause {
  return {
    ...c,
    clause_text: rehydrate(c.clause_text, tokenMap),
    title: rehydrate(c.title, tokenMap),
    plain_english: rehydrate(c.plain_english, tokenMap),
    risk_explanation: rehydrate(c.risk_explanation, tokenMap),
    negotiation_suggestion: c.negotiation_suggestion
      ? rehydrate(c.negotiation_suggestion, tokenMap)
      : null,
    unusual_explanation: c.unusual_explanation
      ? rehydrate(c.unusual_explanation, tokenMap)
      : null,
    applicable_law: c.applicable_law
      ? {
          ...c.applicable_law,
          observation: rehydrate(c.applicable_law.observation, tokenMap),
        }
      : null,
    citations: c.citations?.map((cit) => ({
      ...cit,
      quoted_text: rehydrate(cit.quoted_text, tokenMap),
    })),
  };
}

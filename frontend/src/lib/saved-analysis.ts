/**
 * SP-10 Arc 1 Phase 5 — saved-analysis hydration helper.
 *
 * Reconstruct an `AnalyzeResponse` from the `SavedAnalysis` shape the
 * backend returns on `GET /api/analyses/{id}`. Pulled out of
 * `/history/[id]/page.tsx` so it can be unit-tested without mounting
 * the full client component (which drags in auth context, i18n,
 * routing, and the chat panel).
 *
 * Two legacy-compat behaviours worth preserving:
 *   - Pre-SP-1 Phase 5 rows have no provenance. The migration seeds the
 *     column with `'{}'::jsonb`, so *either* missing or empty-object
 *     triggers the `legacyProvenance` placeholder.
 *   - Pre-SP-10 rows have no `clause_embeddings` (backend returns `null`
 *     or omits the key). The hydrated `AnalyzeResponse` must then also
 *     omit the field so `buildChatContext` falls through to BM25-only
 *     without a spurious empty-array short-circuit.
 */
import { legacyProvenance } from "@/lib/analyzer";
import type { AnalyzeResponse, SavedAnalysis } from "@/types";

/**
 * Reconstruct the `AnalyzeResponse` shape used by `ReportView` and
 * `ChatPanel` from the `SavedAnalysis` wire shape returned by the
 * backend. Keeps retention metadata out — that is UI chrome, not
 * pipeline data.
 */
export function hydrateSavedAnalysis(
  saved: SavedAnalysis,
): AnalyzeResponse {
  const hasProvenance =
    saved.provenance && Object.keys(saved.provenance).length > 0;

  const hydrated: AnalyzeResponse = {
    overview: saved.overview,
    summary: saved.summary,
    clauses: saved.clauses,
    provenance: hasProvenance ? saved.provenance! : legacyProvenance(),
  };

  if (saved.clause_embeddings && saved.clause_embeddings.length > 0) {
    hydrated.clause_embeddings = saved.clause_embeddings;
  }

  return hydrated;
}

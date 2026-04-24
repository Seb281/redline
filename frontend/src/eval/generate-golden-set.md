# SP-10 Arc 1 golden set — generation methodology

This document records how `frontend/src/eval/golden-questions.ts` was
produced. It is referenced from `frontend/EVAL.md` so readers of the
eval numbers can judge the provenance of the questions that produced
them.

## Disclosure

**The golden question set is LLM-generated.** Every entry was drafted
by Claude Opus 4.7 (`claude-opus-4-7`) in a Claude Code session on
2026-04-22, separate from the in-pipeline Mistral family that the
retriever itself is being measured against. The generating model was
given each frozen fixture's clause list (title, category, plain-English
summary, truncated `clause_text`) and asked for 8 questions per
contract following the tier rubric below.

Using a non-Mistral model for authorship is deliberate: if the
generator and the retriever shared a family, we would be measuring
cluster-bias as much as retrieval quality.

**Review status.** At first check-in each entry carries
`reviewed_by: "claude-opus-4-7"` — i.e. generating-model self-check
only. A follow-up human-review pass by the project owner will bump
`reviewed_by` to their initials and update `reviewed_at`. Until that
pass lands, any EVAL.md baseline numbers sourced from this set are
clearly labelled `pre-human-review`.

**Cross-model sanity check (deferred).** The plan calls for 10/48
questions to be re-posed to a third model family or human reviewer to
catch intra-cluster agreement. This is parked until after first
human review — re-running the sanity check before human review would
mostly surface drafting artefacts rather than retrieval-signal
questions.

## Tier definitions (verbatim prompt given to the model)

- `easy` — a competent keyword-overlap retriever should find the
  answer. Question vocabulary overlaps noticeably with the target
  clause's words (e.g. "probation period" → clause titled
  "Probationary period").
- `medium` — the question is conceptually about the clause but uses
  different vocabulary than the clause text. Vector search should win
  here; BM25 will struggle (e.g. "Can I work for a competitor
  afterwards?" → clause titled "Non-compete clause" whose body uses
  "exercer toute activité ... auprès de ... concurrente").
- `hard` — the answer depends on more than one clause, or on a
  cross-reference, or requires implicit legal reasoning
  (e.g. asking about an obligation that is expressed as a right in
  the counterparty's clause).

Target mix per fixture: **3 easy / 3 medium / 2 hard**. Rationale: a
6:4 split in favour of easy+medium keeps the recall numbers
interpretable (the set is not dominated by multi-clause hard
questions), while two hard entries per contract is enough to
differentiate hybrid+rerank from plain hybrid once Arc 2 lands.

## Expected-clause mapping

Each entry carries `expected_clause_indices: number[]` — the positional
indices of every clause that independently answers the question, as
read from the frozen fixture on disk. Multi-index entries only appear
on `hard` questions where more than one clause is load-bearing.

Indices are positional within the fixture's `clauses` array. They are
stable across re-runs because fixtures are frozen (see
`freeze.test.ts`); if a fixture is ever re-captured, the golden set
must be re-reviewed since clause indices may shift.

## Output schema

Frozen to `frontend/src/eval/golden-questions.ts` as a typed constant:

```ts
interface GoldenQuestion {
  id: string;                       // stable slug, e.g. "nl-freelance-q1"
  fixture: string;                  // manifest slug
  question: string;                 // natural-language query
  expected_clause_indices: number[];
  tier: "easy" | "medium" | "hard";
  rationale: string;                // one-line why this tier was chosen
  reviewed_by: string;              // model id or reviewer initials
  reviewed_at: string;              // ISO date
}
```

## What lives where

| File                                         | Role                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `frontend/src/eval/generate-golden-set.md`   | This doc — methodology, review status, tier rubric             |
| `frontend/src/eval/golden-questions.ts`      | Frozen typed question set                                      |
| `frontend/src/eval/golden-questions.test.ts` | Structural tripwire (counts, index-bounds, unique ids)         |
| `frontend/src/eval/harness.ts`               | Runs a retriever against the set; computes recall@k + MRR      |
| `frontend/src/eval/harness.test.ts`          | CI gate — hybrid recall@5 must not regress below stored baseline |
| `frontend/EVAL.md`                           | Methodology pointer + corpus/golden-set stats + baseline table |

## Changelog

- **2026-04-22** — initial 48-question set committed, generator
  `claude-opus-4-7`, pre-human-review.
- **2026-04-24** — human review pass by project owner (`SG`).
  `reviewed_by` flipped on every entry; `baseline.json` rows sourced
  from this set now carry `golden_set_review_status:
  "human-reviewed:SG:2026-04-24"`.

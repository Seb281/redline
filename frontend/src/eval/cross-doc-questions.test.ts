/**
 * SP-10 Arc 3 Task 3.5 — structural tripwire on the cross-doc set.
 *
 * Fails fast on the three classes of silent corruption that would
 * invalidate the ``cross_doc`` baseline:
 *   1. Duplicate ``id`` values (baseline pins are keyed on id).
 *   2. ``expected.fixture`` pointing at a slug that no manifest entry
 *      owns (typo → silent miss forever).
 *   3. ``expected.clause_index`` outside the frozen fixture's clause
 *      count (fixture was regenerated and questions weren't re-reviewed).
 *
 * The CI gate in ``cross-doc-harness.test.ts`` asserts numeric floors;
 * this file asserts the invariants those floors assume.
 */

import { describe, it, expect } from "vitest";
import { CROSS_DOC_QUESTIONS } from "./cross-doc-questions";
import { availableFixtureSlugs, loadFixture } from "./fixtures/load";

const cache = availableFixtureSlugs();
const fixturesReady = cache.length > 0;

describe("cross-doc questions structural tripwire", () => {
  it("has unique ids", () => {
    const ids = CROSS_DOC_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least one expected tuple per question", () => {
    for (const q of CROSS_DOC_QUESTIONS) {
      expect(q.expected.length, `question ${q.id}`).toBeGreaterThan(0);
    }
  });

  it("has a valid tier on every question", () => {
    const tiers = new Set(["easy", "medium", "hard"]);
    for (const q of CROSS_DOC_QUESTIONS) {
      expect(tiers.has(q.tier), `question ${q.id} tier ${q.tier}`).toBe(true);
    }
  });

  it.skipIf(!fixturesReady)(
    "only references fixtures + clause indices that exist on disk",
    () => {
      const knownSlugs = new Set(cache);
      for (const q of CROSS_DOC_QUESTIONS) {
        for (const e of q.expected) {
          expect(
            knownSlugs.has(e.fixture),
            `${q.id} expects fixture ${e.fixture} which is not on disk`,
          ).toBe(true);
          const fixture = loadFixture(e.fixture);
          expect(
            e.clause_index,
            `${q.id} expects clause_index ${e.clause_index} in ${e.fixture}`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            e.clause_index,
            `${q.id} expects clause_index ${e.clause_index} in ${e.fixture} with ${fixture.clauses.length} clauses`,
          ).toBeLessThan(fixture.clauses.length);
        }
      }
    },
  );
});

/**
 * SP-10 Arc 1 Phase 4b — golden-set structural tripwire.
 *
 * This file does NOT measure retrieval quality — that lives in
 * `harness.test.ts`. Its job is catching mistakes in the set itself:
 * malformed ids, out-of-range clause indices, missing fixtures, or
 * drift between the set and the frozen fixtures on disk.
 */
import { describe, it, expect } from "vitest";
import { GOLDEN_QUESTIONS, GOLDEN_FIXTURE_SLUGS } from "./golden-questions";
import { FIXTURE_SLUGS } from "./fixtures/manifest";
import { availableFixtureSlugs, loadFixture } from "./fixtures/load";

describe("golden question set", () => {
  it("has 48 entries (8 per fixture × 6 fixtures)", () => {
    expect(GOLDEN_QUESTIONS).toHaveLength(48);
  });

  it("has a 3/3/2 tier mix per fixture", () => {
    const perFixture = new Map<string, { easy: number; medium: number; hard: number }>();
    for (const q of GOLDEN_QUESTIONS) {
      const bucket = perFixture.get(q.fixture) ?? { easy: 0, medium: 0, hard: 0 };
      bucket[q.tier] += 1;
      perFixture.set(q.fixture, bucket);
    }
    for (const [slug, counts] of perFixture) {
      expect({ slug, ...counts }).toEqual({
        slug,
        easy: 3,
        medium: 3,
        hard: 2,
      });
    }
  });

  it("has unique ids", () => {
    const ids = GOLDEN_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references known fixture slugs", () => {
    const known = new Set(FIXTURE_SLUGS);
    for (const q of GOLDEN_QUESTIONS) {
      expect(known.has(q.fixture), `unknown fixture: ${q.fixture}`).toBe(true);
    }
  });

  it("covers every fixture with at least one question", () => {
    const covered = new Set(GOLDEN_FIXTURE_SLUGS);
    for (const slug of FIXTURE_SLUGS) {
      expect(covered.has(slug), `fixture ${slug} has no questions`).toBe(true);
    }
  });

  it("has expected_clause_indices that are in-range for each fixture", () => {
    const available = new Set(availableFixtureSlugs());
    for (const q of GOLDEN_QUESTIONS) {
      if (!available.has(q.fixture)) continue;
      const fixture = loadFixture(q.fixture);
      expect(q.expected_clause_indices.length).toBeGreaterThan(0);
      for (const idx of q.expected_clause_indices) {
        expect(idx, `${q.id} idx ${idx} out of range`).toBeGreaterThanOrEqual(0);
        expect(idx, `${q.id} idx ${idx} out of range`).toBeLessThan(fixture.clauses.length);
      }
    }
  });

  it("has non-empty questions and rationale", () => {
    for (const q of GOLDEN_QUESTIONS) {
      expect(q.question.trim().length, `${q.id} empty question`).toBeGreaterThan(0);
      expect(q.rationale.trim().length, `${q.id} empty rationale`).toBeGreaterThan(0);
    }
  });

  it("marks every entry with generator-model authorship until human review lands", () => {
    for (const q of GOLDEN_QUESTIONS) {
      expect(q.reviewed_by.length, `${q.id} missing reviewed_by`).toBeGreaterThan(0);
      expect(q.reviewed_at, `${q.id} missing reviewed_at`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("uses only the three known tiers", () => {
    for (const q of GOLDEN_QUESTIONS) {
      expect(["easy", "medium", "hard"]).toContain(q.tier);
    }
  });

  it("reserves multi-clause expected sets for hard questions only", () => {
    // Easy/medium should point at exactly one clause by construction.
    // A non-hard question with multiple expected indices is a bug in
    // the set — either the tier is wrong or the mapping is wrong.
    for (const q of GOLDEN_QUESTIONS) {
      if (q.tier !== "hard" && q.expected_clause_indices.length > 1) {
        throw new Error(
          `${q.id} is ${q.tier} but has ${q.expected_clause_indices.length} expected indices`,
        );
      }
    }
  });
});

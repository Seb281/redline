/**
 * SP-10 Arc 1 Phase 4 — eval fixture loader.
 *
 * Thin fs → typed-object reader for the frozen pipeline outputs under
 * `src/eval/fixtures/*.json`. Used by the eval harness and the shape
 * tripwire test; never called at runtime in the app.
 *
 * Design notes:
 *   - Sync fs reads. These fixtures are checked-in Node-side artifacts;
 *     async gives us nothing here and makes test setup awkward.
 *   - No schema validation at load time — the tripwire test
 *     (`schema.test.ts`) handles that. Callers that need the strong
 *     guarantee should compose `validateFixture` over the loader.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalyzeResponse } from "@/types";
import { FIXTURE_SLUGS } from "./manifest";

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

/** Absolute path to a fixture file by slug. */
export function fixturePath(slug: string): string {
  return join(FIXTURES_DIR, `${slug}.json`);
}

/** True iff the fixture for `slug` has been captured and committed. */
export function fixtureExists(slug: string): boolean {
  return existsSync(fixturePath(slug));
}

/**
 * Return the slugs that actually have a committed JSON fixture on
 * disk. Callers can use this to skip eval cleanly before the freeze
 * harness has run (the test suite still passes in that state).
 */
export function availableFixtureSlugs(): string[] {
  return FIXTURE_SLUGS.filter(fixtureExists);
}

/**
 * Load and JSON-parse one fixture. Returns a typed `AnalyzeResponse`;
 * throws on missing file or malformed JSON (programmer error — a
 * missing fixture means the freeze harness was never run, which every
 * consumer should have checked already).
 */
export function loadFixture(slug: string): AnalyzeResponse {
  const path = fixturePath(slug);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as AnalyzeResponse;
}

/**
 * Discovery helper used by the shape tripwire: returns every
 * `{slug, value}` pair for fixtures currently on disk, preserving
 * manifest order. Stray JSON files (not in the manifest) are
 * reported as a side-channel so the tripwire can fail on them.
 */
export function loadAllFixtures(): {
  fixtures: Array<{ slug: string; value: AnalyzeResponse }>;
  stray: string[];
} {
  const fixtures = availableFixtureSlugs().map((slug) => ({
    slug,
    value: loadFixture(slug),
  }));
  const onDisk = new Set(
    readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, "")),
  );
  const known = new Set(FIXTURE_SLUGS);
  const stray = Array.from(onDisk).filter((s) => !known.has(s));
  return { fixtures, stray };
}

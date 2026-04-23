#!/usr/bin/env node
/**
 * One-shot utility: backfill `cross_refs` on legacy eval fixtures.
 *
 * Fixtures were frozen in Task 1.5a, before `cross_refs` was added to
 * `analyzedClauseSchema` in Task 2.2. A full re-freeze via live Mistral
 * is the "correct" regeneration path (captures LLM-emitted prose refs
 * the regex cannot), but it costs a live key + tokens; regex-only
 * backfill is reproducible and catches every structural reference
 * (Section, §, Schedule, Artikel, etc.) — the majority of what the
 * graph traversal will consume.
 *
 * The regex rule table here is a byte-copy of
 * `src/lib/retrieval/cross-refs-extract.ts` so the backfill is exactly
 * what a fresh pipeline run would produce for the structural half of
 * the hybrid tagger. Kept inline to avoid pulling a .ts loader into
 * the Node script surface for a one-shot backfill.
 *
 * Run once after the Task 2.2 schema change. Safe to re-run; it never
 * replaces existing non-empty arrays.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, "../src/eval/fixtures");
const SLUGS = [
  "de-saas-dpa",
  "es-saas-services",
  "fr-employment",
  "it-employment",
  "nl-freelance",
  "pl-distribution",
];

const NUMERIC_TAIL = String.raw`\d+(?:\.\d+)*`;
const SCHEDULE_ID = String.raw`[A-Z0-9]+(?:\.\d+)*`;

const RULES = [
  { pattern: new RegExp(String.raw`\bSection\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Section" },
  { pattern: new RegExp(String.raw`\bClause\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Clause" },
  { pattern: new RegExp(String.raw`\bArt(?:icle|\.)?\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Article" },
  { pattern: new RegExp(String.raw`\bParagraph\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Paragraph" },
  { pattern: new RegExp(String.raw`\b(?:Schedule|Annexe?|Appendix|Exhibit)\s+${SCHEDULE_ID}\b`, "g") },
  { pattern: new RegExp(String.raw`\bArtikel\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Artikel" },
  { pattern: new RegExp(String.raw`\bAbschnitt\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Abschnitt" },
  { pattern: new RegExp(String.raw`\bAbsatz\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Absatz" },
  { pattern: new RegExp(String.raw`\bZiffer\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Ziffer" },
  { pattern: new RegExp(String.raw`§\s*${NUMERIC_TAIL}\b`, "g") },
  { pattern: new RegExp(String.raw`\bArtículo\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Artículo" },
  { pattern: new RegExp(String.raw`\bArticolo\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Articolo" },
  { pattern: new RegExp(String.raw`\bArtykuł\s+${NUMERIC_TAIL}\b`, "gi"), keyword: "Artykuł" },
];

function canonicalize(match, rule) {
  if (!rule.keyword) return match.trim();
  const firstSpace = match.search(/\s/);
  if (firstSpace === -1) return rule.keyword;
  return `${rule.keyword} ${match.slice(firstSpace + 1).trim()}`;
}

function extractCrossRefsFromText(text) {
  const seen = new Set();
  const out = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const canonical = canonicalize(m[0], rule);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        out.push(canonical);
      }
    }
  }
  return out;
}

for (const slug of SLUGS) {
  const path = resolve(FIXTURE_DIR, `${slug}.json`);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  let touched = 0;
  for (const clause of doc.clauses ?? []) {
    const existing = Array.isArray(clause.cross_refs) ? clause.cross_refs : [];
    if (existing.length > 0) continue;
    const derived = extractCrossRefsFromText(clause.clause_text ?? "");
    clause.cross_refs = derived;
    if (derived.length > 0) touched += 1;
  }
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`${slug}: backfilled ${touched} clauses with refs`);
}

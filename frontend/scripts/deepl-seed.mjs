#!/usr/bin/env node
/**
 * SP-7 Layer A — seed non-EN catalogs from `messages/en.json` via DeepL.
 *
 * Reads `messages/en.json`, translates every leaf string into FR, DE, NL,
 * ES, IT, and writes the result to `messages/{locale}.json`. Preserves
 * next-intl ICU placeholders (`{name}`) and rich-text tags
 * (`<strong>…</strong>`, `<code>…</code>`, `<email></email>`, etc.) via
 * DeepL's `tag_handling=xml` + `ignore_tags` support.
 *
 * Usage:
 *   DEEPL_API_KEY=xxxx node scripts/deepl-seed.mjs            # translate all
 *   DEEPL_API_KEY=xxxx node scripts/deepl-seed.mjs fr de      # subset
 *
 * Notes:
 * - Uses DeepL free endpoint `api-free.deepl.com` by default. Set
 *   `DEEPL_API_HOST=https://api.deepl.com` for a Pro key.
 * - ICU `plural`/`select` blocks (e.g. `{count, plural, one {...}}`) are
 *   flattened into a single `<icu>…</icu>` span so DeepL leaves them
 *   alone — the nested inner strings need manual polish afterwards if
 *   you want the locale grammar exactly right.
 * - Merges on top of any existing non-EN catalog so hand-authored
 *   overrides survive a re-seed. Protection is explicit via
 *   `_meta.handAuthored` — a sorted array of dotted key paths the
 *   seed must never overwrite (e.g. `["Header.logOut", "Footer.brand"]`).
 *   To freeze a hand-polished value, add its path to that array in
 *   the locale JSON and the next re-seed will skip it. The old
 *   "differs-from-EN" heuristic was dropped because it mis-fired on
 *   brand names that happen to equal the EN source and on bad MT
 *   that happened to echo EN.
 * - DeepL is an EU-based (Cologne, DE) provider.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");

const TARGETS = {
  fr: "FR",
  de: "DE",
  nl: "NL",
  es: "ES",
  it: "IT",
};

const DEEPL_HOST = process.env.DEEPL_API_HOST ?? "https://api-free.deepl.com";
const DEEPL_KEY = process.env.DEEPL_API_KEY;

if (!DEEPL_KEY) {
  console.error(
    "error: DEEPL_API_KEY env var is required (get a free key at https://www.deepl.com/pro-api).",
  );
  process.exit(1);
}

const args = process.argv.slice(2).filter(Boolean);
const localesToRun = args.length ? args : Object.keys(TARGETS);
for (const l of localesToRun) {
  if (!TARGETS[l]) {
    console.error(`error: unknown locale '${l}' (valid: ${Object.keys(TARGETS).join(", ")})`);
    process.exit(1);
  }
}

/**
 * Walk a nested structure, yielding every leaf string with its path.
 * Recurses into both objects and arrays — array elements are yielded
 * with numeric indices so that `setAt` can round-trip them.
 */
function* walkStrings(node, trail = []) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const next = [...trail, i];
      const value = node[i];
      if (typeof value === "string") {
        yield { path: next, value };
      } else if (value && typeof value === "object") {
        yield* walkStrings(value, next);
      }
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const next = [...trail, key];
    if (typeof value === "string") {
      yield { path: next, value };
    } else if (value && typeof value === "object") {
      yield* walkStrings(value, next);
    }
  }
}

/**
 * Set a value at a nested path, creating objects or arrays as needed.
 * A numeric key step creates an array; a string key step creates a
 * plain object.
 */
function setAt(obj, trail, value) {
  let cursor = obj;
  for (let i = 0; i < trail.length - 1; i++) {
    const k = trail[i];
    const nextIsIndex = typeof trail[i + 1] === "number";
    if (cursor[k] == null || typeof cursor[k] !== "object") {
      cursor[k] = nextIsIndex ? [] : {};
    }
    cursor = cursor[k];
  }
  cursor[trail[trail.length - 1]] = value;
}

/**
 * Shield next-intl placeholders + ICU blocks from DeepL.
 *
 * Returns the protected string + a restore function. Strategy:
 *  1. Replace `{count, plural, …}` / `{x, select, …}` blocks with
 *     `<icu id="N"/>` self-closing tags (regex matches balanced braces
 *     at the outermost level only).
 *  2. Replace bare `{name}` placeholders with `<ph id="N"/>`.
 *  3. Leave existing rich-text tags (<strong>, <code>, …) intact —
 *     DeepL's `tag_handling=xml` will step over them.
 */
/** Brace-balanced scan that walks an ICU string once, peeling complex
 * blocks (plural/select/selectordinal) and bare placeholders into
 * opaque XML tags DeepL will leave alone. */
function shield(input) {
  const store = [];
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    // Find the matching closing brace.
    let depth = 0;
    let end = i;
    for (let j = i; j < input.length; j++) {
      if (input[j] === "{") depth++;
      else if (input[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (depth !== 0) {
      // Unbalanced; bail on shielding this occurrence.
      out += ch;
      i++;
      continue;
    }
    const block = input.slice(i, end + 1);
    const inner = block.slice(1, -1).trim();
    // Detect ICU function vs bare placeholder. ICU form has 2+ commas
    // at the top level AND a known function keyword as second arg.
    const firstComma = inner.indexOf(",");
    const isIcuFn =
      firstComma > 0 &&
      /^(plural|select|selectordinal|number|date|time)\b/.test(
        inner.slice(firstComma + 1).trimStart(),
      );
    const id = store.length;
    if (isIcuFn) {
      store.push(block);
      out += `<icu id="${id}"/>`;
    } else if (/^[a-zA-Z0-9_]+$/.test(inner)) {
      store.push(block);
      out += `<ph id="${id}"/>`;
    } else {
      // Unknown structure — leave as-is so DeepL sees raw braces.
      out += block;
    }
    i = end + 1;
  }
  // Escape bare ampersands (not part of an entity) so DeepL's XML
  // parser doesn't choke on strings like "Redact & export".
  const escaped = out.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, "&amp;");
  return {
    shielded: escaped,
    restore: (translated) =>
      translated
        .replace(/&amp;/g, "&")
        .replace(/<ph id="(\d+)"\s*\/>/g, (_m, n) => store[Number(n)])
        .replace(/<icu id="(\d+)"\s*\/>/g, (_m, n) => store[Number(n)]),
  };
}

/** POST a batch to DeepL and return translated texts in input order. */
async function translateBatch(texts, targetLang) {
  const body = new URLSearchParams();
  body.append("target_lang", targetLang);
  body.append("source_lang", "EN");
  body.append("tag_handling", "xml");
  body.append("ignore_tags", "ph,icu,code");
  body.append("preserve_formatting", "1");
  for (const t of texts) body.append("text", t);

  const res = await fetch(`${DEEPL_HOST}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DeepL ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return json.translations.map((t) => t.text);
}

/**
 * DeepL accepts up to 50 text items per request. Chunk accordingly;
 * also cap per-chunk payload at ~30kB to stay well below the 128kB
 * body limit.
 */
function chunk(items, maxItems = 50, maxBytes = 30_000) {
  const out = [];
  let batch = [];
  let bytes = 0;
  for (const item of items) {
    const itemBytes = Buffer.byteLength(item, "utf8");
    if (batch.length >= maxItems || bytes + itemBytes > maxBytes) {
      if (batch.length) out.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(item);
    bytes += itemBytes;
  }
  if (batch.length) out.push(batch);
  return out;
}

async function seedLocale(locale, en) {
  const target = TARGETS[locale];
  const entries = [...walkStrings(en)];

  const shielded = entries.map((e) => shield(e.value));
  const batches = chunk(shielded.map((s) => s.shielded));

  const translated = [];
  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(`  ${locale}: batch ${i + 1}/${batches.length} (${batches[i].length} strings)… `);
    const result = await translateBatch(batches[i], target);
    translated.push(...result);
    console.log("ok");
  }

  // Load existing catalog so hand-edited values survive re-seed.
  const existingPath = path.join(MESSAGES_DIR, `${locale}.json`);
  let existing = {};
  try {
    const raw = await readFile(existingPath, "utf8");
    existing = raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  // Explicit protection: any path listed in `_meta.handAuthored` is
  // never rewritten. All other keys are refreshed from DeepL so that
  // a fix to the English source automatically propagates. Unknown
  // paths in the list are kept as-is so authors can freeze a key
  // before committing its translation.
  const meta = existing._meta ?? {};
  const handAuthored = new Set(
    Array.isArray(meta.handAuthored)
      ? meta.handAuthored.filter((p) => typeof p === "string")
      : [],
  );

  let protectedCount = 0;
  entries.forEach((entry, i) => {
    const pathStr = entry.path.join(".");
    if (handAuthored.has(pathStr)) {
      protectedCount++;
      return;
    }
    const restored = shielded[i].restore(translated[i]);
    setAt(existing, entry.path, restored);
  });

  // Keep the sidecar tidy so diffs stay readable.
  if (handAuthored.size > 0) {
    existing._meta = {
      ...meta,
      handAuthored: [...handAuthored].sort(),
    };
  }

  await writeFile(existingPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  const protectedNote = protectedCount
    ? ` (${protectedCount} hand-authored key${protectedCount === 1 ? "" : "s"} preserved)`
    : "";
  console.log(`  ${locale}: wrote ${existingPath}${protectedNote}`);
}

async function main() {
  const enRaw = await readFile(path.join(MESSAGES_DIR, "en.json"), "utf8");
  const en = JSON.parse(enRaw);

  const totalStrings = [...walkStrings(en)].length;
  const estChars = JSON.stringify(en).length;
  console.log(
    `seeding ${localesToRun.length} locales from en.json (${totalStrings} strings, ~${estChars} chars per target)`,
  );

  for (const locale of localesToRun) {
    console.log(`\n→ ${locale.toUpperCase()}`);
    await seedLocale(locale, en);
  }
  console.log("\ndone.");
}

main().catch((err) => {
  console.error("\nseed failed:", err.message);
  process.exit(1);
});

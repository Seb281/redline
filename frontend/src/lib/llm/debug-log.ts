/**
 * Dev-only diagnostic logger for the Mistral analysis pipeline.
 *
 * Double env gate — emits only when BOTH:
 *   - `NODE_ENV !== "production"` (safety against accidental prod enablement)
 *   - `REDLINE_DEBUG_PIPELINE === "1"` (explicit opt-in per dev run)
 *
 * Privacy defense-in-depth: any free-form string value is clamped to 40
 * characters with a trailing ellipsis. Metrics should be counts, durations,
 * booleans, or short enum-like strings (pass name, mode, jurisdiction
 * country). Never pass contract text, clause text, or prompts.
 */

const MAX_STRING_LEN = 40;

export type Pass = "overview" | "redact" | "extraction" | "pass2";

export type MetricValue = number | boolean | string;

function clamp(value: string): string {
  if (value.length <= MAX_STRING_LEN) return value;
  return value.slice(0, MAX_STRING_LEN) + "\u2026";
}

function render(value: MetricValue): string {
  if (typeof value === "string") return clamp(value);
  return String(value);
}

export function logPass(
  pass: Pass,
  metrics: Record<string, MetricValue>,
): void {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.REDLINE_DEBUG_PIPELINE !== "1") return;
  const pairs = Object.entries(metrics)
    .map(([k, v]) => `${k}=${render(v)}`)
    .join(" ");
  try {
    console.log(`[redline-debug] pass=${pass} ${pairs}`);
  } catch {
    // Logger failures must never break the pipeline.
  }
}

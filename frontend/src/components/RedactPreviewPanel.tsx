/**
 * Kind-level redaction preview for the /redact flow.
 *
 * WHY a new component instead of reusing RedactionPreview:
 * The analyzer's RedactionPreview works at per-token granularity (toggle
 * individual "john.doe@acme.com" ON/OFF) and carries party-rename inputs.
 * The redact-export preview works at per-KIND granularity (toggle the whole
 * EMAIL kind ON/OFF) because the user is about to download a redacted PDF
 * — fine-grained per-instance control adds friction without value here, and
 * the data shapes (TokenRange[] vs Map<string,string> + Party[]) don't
 * compose cleanly. Keeping this separate preserves single-responsibility on
 * both sides.
 */

"use client";

import { useMemo, useState } from "react";
import type { TokenKind, TokenRange } from "@/lib/redact-export/types";

interface RedactPreviewPanelProps {
  /** All tokens produced by the tokenizer; user can disable whole kinds. */
  tokens: TokenRange[];
  /** Full contract text — used to render the inline scrubbed preview. */
  fullText: string;
  /** Fires with the set of *disabled* kinds when user confirms. */
  onConfirm: (disabledKinds: Set<TokenKind>) => void;
  /** Fires when the user backs out — resets the hook to idle. */
  onCancel: () => void;
}

/** Human-readable plural label per kind. */
function kindLabel(kind: TokenKind): string {
  switch (kind) {
    case "PERSON":
      return "People";
    case "ORG":
      return "Organisations";
    case "EMAIL":
      return "Email addresses";
    case "PHONE":
      return "Phone numbers";
    case "IBAN":
      return "IBANs";
    case "VAT":
      return "VAT numbers";
    case "ADDRESS":
      return "Addresses";
    case "POSTCODE":
      return "Postcodes";
    case "ID_NUMBER":
      return "ID numbers";
    case "DOB":
      return "Dates of birth";
    case "BANK":
      return "Bank details";
    case "COMPANY_REG":
      return "Company registrations";
    case "URL":
      return "URLs";
    case "DATE":
      return "Dates";
    case "MONEY":
      return "Amounts";
    default:
      return "Other";
  }
}

interface KindGroup {
  kind: TokenKind;
  tokens: TokenRange[];
}

/**
 * Group tokens by kind, sorted by descending match count so the most
 * impactful categories are visible without scrolling.
 */
function groupTokensByKind(tokens: TokenRange[]): KindGroup[] {
  const map = new Map<TokenKind, TokenRange[]>();
  for (const t of tokens) {
    const list = map.get(t.kind) ?? [];
    list.push(t);
    map.set(t.kind, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([kind, toks]) => ({ kind, tokens: toks }));
}

/**
 * Render the contract text with all active tokens replaced by their labels.
 * Returns the first `maxChars` characters of the scrubbed string so the
 * inline preview stays bounded and fast to compute.
 */
function buildScrubbed(
  fullText: string,
  tokens: TokenRange[],
  disabledKinds: Set<TokenKind>,
  maxChars = 800,
): string {
  // Only consider tokens whose kind is not disabled.
  const active = tokens
    .filter((t) => !disabledKinds.has(t.kind))
    .sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  const preview = fullText.slice(0, maxChars + 500); // slight over-read

  for (const t of active) {
    if (t.start >= preview.length) break;
    if (t.start < cursor) continue; // overlapping — skip
    result += preview.slice(cursor, t.start);
    result += `[${t.label}]`;
    cursor = t.end;
  }
  result += preview.slice(cursor);
  return result.slice(0, maxChars);
}

/** Kind-level toggle preview for the redact-export flow. */
export function RedactPreviewPanel({
  tokens,
  fullText,
  onConfirm,
  onCancel,
}: RedactPreviewPanelProps) {
  // Disabled = kinds that the user has turned OFF (their tokens will NOT be
  // redacted). Default is all kinds enabled (nothing disabled).
  const [disabledKinds, setDisabledKinds] = useState<Set<TokenKind>>(
    new Set(),
  );
  const [showInline, setShowInline] = useState(false);

  const groups = useMemo(() => groupTokensByKind(tokens), [tokens]);

  const toggleKind = (kind: TokenKind) => {
    setDisabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const activeCount = tokens.filter((t) => !disabledKinds.has(t.kind)).length;
  const totalCount = tokens.length;

  const scrubbed = useMemo(
    () => buildScrubbed(fullText, tokens, disabledKinds),
    [fullText, tokens, disabledKinds],
  );

  return (
    <div
      className="mb-7 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] px-6 py-5 theme-transition"
      data-testid="redact-preview-panel"
    >
      <p className="mb-1 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
        Review what will be redacted
      </p>
      <h3 className="mb-2 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        Before building your redacted PDF
      </h3>
      <p className="mb-5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        Toggle a category to remove it from redaction. All categories are on by default.
      </p>

      {/* Kind-level toggle rows */}
      <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] divide-y divide-[var(--border-primary)]">
        {groups.length === 0 && (
          <p className="px-4 py-4 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
            No sensitive entities detected in this document.
          </p>
        )}
        {groups.map(({ kind, tokens: kindTokens }) => {
          const isDisabled = disabledKinds.has(kind);
          // Show up to 3 example originals as a visual hint.
          const examples = kindTokens
            .slice(0, 3)
            .map((t) => t.original)
            .join(", ");
          const suffix =
            kindTokens.length > 3 ? ` +${kindTokens.length - 3} more` : "";
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              aria-pressed={!isDisabled}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)] ${
                isDisabled ? "opacity-50" : ""
              }`}
            >
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span
                    className={`text-[12px] font-semibold uppercase tracking-[1.5px] font-[var(--font-body)] ${
                      isDisabled
                        ? "text-[var(--text-muted)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {kindLabel(kind)}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
                    · {kindTokens.length}
                  </span>
                </span>
                <span className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)] truncate max-w-[400px]">
                  {examples}
                  {suffix}
                </span>
              </span>
              {/* Toggle pill */}
              <span
                aria-hidden="true"
                className={`relative ml-4 inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
                  isDisabled
                    ? "bg-[var(--border-secondary)]"
                    : "bg-[var(--accent)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    isDisabled ? "translate-x-0.5" : "translate-x-[18px]"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline text preview */}
      <button
        type="button"
        onClick={() => setShowInline((v) => !v)}
        className="mt-4 text-[13px] text-[var(--text-tertiary)] underline-offset-2 hover:underline"
      >
        {showInline ? "▾" : "▸"} {showInline ? "Hide" : "Show"} preview
      </button>
      {showInline && (
        <pre className="mt-2 max-h-[200px] overflow-y-auto rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-[12px] font-[var(--font-mono)] text-[var(--text-secondary)] whitespace-pre-wrap">
          {scrubbed}
          {fullText.length > 800 && (
            <span className="italic text-[var(--text-muted)]">
              {"\n"}… (first 800 chars shown)
            </span>
          )}
        </pre>
      )}

      <p className="mt-4 text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        {activeCount} of {totalCount} matches will be redacted ·{" "}
        {totalCount - activeCount} skipped
      </p>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(new Set(disabledKinds))}
          className="rounded border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Redact → Build PDF
        </button>
      </div>
    </div>
  );
}

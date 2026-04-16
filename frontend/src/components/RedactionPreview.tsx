/**
 * Pre-flight redaction preview shown between Pass 0 and role selection.
 *
 * Users see every PII entity the LLM will see as a token. Can toggle
 * individual false positives off — disabled entities revert to their
 * original values in the text sent to Pass 1/Pass 2.
 *
 * Layout C (hybrid, picked in brainstorming): grouped legend on top,
 * collapsible inline text below for the auditors who want to see the
 * exact string that will hit the model.
 */

"use client";

import { useMemo, useState } from "react";

interface RedactionPreviewProps {
  raw: string;
  scrubbed: string;
  tokenMap: Map<string, string>;
  /** Fires with the subset of tokens the user wants to keep masked. */
  onConfirm: (activeTokens: Map<string, string>) => void;
  /** Fires when the user backs out — resets the whole run (Pass 0 is eaten). */
  onCancel: () => void;
}

interface GroupedEntity {
  token: string;
  original: string;
}

interface KindGroup {
  kind: string;
  label: string;
  entities: GroupedEntity[];
}

/** Map the internal kind code to a human-friendly plural label. */
function kindLabel(kind: string): string {
  switch (kind) {
    case "PARTY":
      return "Parties";
    case "EMAIL":
      return "Emails";
    case "PHONE":
      return "Phones";
    case "IBAN":
      return "IBANs";
    case "VAT":
      return "VATs";
    case "FR":
      return "French SSN";
    case "DE":
      return "German tax ID";
    default:
      return kind;
  }
}

/**
 * Pull the `KIND` prefix from a token like `⟦EMAIL_1⟧` or `⟦PARTY_A⟧`.
 * PARTY_A → "PARTY", EMAIL_1 → "EMAIL", FR_SSN_1 → "FR".
 */
function tokenKind(token: string): string {
  const inner = token.slice(1, -1);
  return inner.split("_")[0];
}

function groupByKind(tokenMap: Map<string, string>): KindGroup[] {
  const buckets = new Map<string, GroupedEntity[]>();
  for (const [token, original] of tokenMap) {
    const kind = tokenKind(token);
    const list = buckets.get(kind) ?? [];
    list.push({ token, original });
    buckets.set(kind, list);
  }
  return Array.from(buckets.entries()).map(([kind, entities]) => ({
    kind,
    label: kindLabel(kind),
    entities,
  }));
}

export function RedactionPreview({
  scrubbed,
  tokenMap,
  onConfirm,
  onCancel,
}: RedactionPreviewProps) {
  const groups = useMemo(() => groupByKind(tokenMap), [tokenMap]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  const [showInline, setShowInline] = useState(false);

  const toggleEntity = (token: string) => {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const toggleKind = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const activeCount = tokenMap.size - disabled.size;
  const allDisabled = activeCount === 0 && tokenMap.size > 0;

  const handleConfirm = () => {
    const active = new Map<string, string>();
    for (const [token, original] of tokenMap) {
      if (!disabled.has(token)) active.set(token, original);
    }
    onConfirm(active);
  };

  return (
    <div
      className="mb-7 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] px-6 py-5 theme-transition"
      data-testid="redaction-preview"
    >
      <p className="mb-1 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
        Review what will be masked
      </p>
      <h3 className="mb-2 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        Before deeper analysis
      </h3>
      <p className="mb-5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        These values will be replaced with tokens like{" "}
        <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-[var(--font-mono)] text-[13px]">
          &#x27E6;PARTY_A&#x27E7;
        </code>{" "}
        before the contract is sent to the model. Click a row to keep an
        entity visible.
      </p>

      <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] divide-y divide-[var(--border-primary)]">
        {groups.map((group) => {
          const expanded = expandedKinds.has(group.kind);
          const examples = group.entities
            .slice(0, 2)
            .map((e) => e.original)
            .join(", ");
          const suffix =
            group.entities.length > 2
              ? `, +${group.entities.length - 2} more`
              : "";
          return (
            <div key={group.kind}>
              <button
                type="button"
                onClick={() => toggleKind(group.kind)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)] font-[var(--font-body)]">
                    {group.label}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
                    · {group.entities.length}
                  </span>
                  <span className="text-[13px] italic text-[var(--text-muted)] font-[var(--font-body)]">
                    {examples}
                    {suffix}
                  </span>
                </span>
                <span className="text-[var(--text-muted)]" aria-hidden="true">
                  {expanded ? "\u25BE" : "\u25B8"}
                </span>
              </button>
              {expanded && (
                <div className="border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
                  <ul className="flex flex-col gap-1.5">
                    {group.entities.map((ent) => {
                      const isDisabled = disabled.has(ent.token);
                      return (
                        <li key={ent.token}>
                          <button
                            type="button"
                            onClick={() => toggleEntity(ent.token)}
                            aria-label={`${isDisabled ? "Re-enable" : "Disable"} ${ent.original}`}
                            className={`w-full text-left font-[var(--font-mono)] text-[13px] transition-opacity ${
                              isDisabled
                                ? "opacity-50 line-through"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {ent.original}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowInline((v) => !v)}
        className="mt-4 text-[13px] text-[var(--text-tertiary)] underline-offset-2 hover:underline"
      >
        {showInline ? "\u25BE" : "\u25B8"} {showInline ? "Hide" : "Show"} inline text
      </button>
      {showInline && (
        <pre className="mt-2 max-h-[200px] overflow-y-auto rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-[12px] font-[var(--font-mono)] text-[var(--text-secondary)] whitespace-pre-wrap">
          {renderInlineWithDisabled(scrubbed, tokenMap, disabled)}
        </pre>
      )}

      <p className="mt-4 text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        {activeCount} items will be masked · {disabled.size} unredacted
      </p>
      {allDisabled && (
        <p className="mt-2 rounded border border-[var(--risk-medium-border)] bg-[var(--risk-medium-bg)] px-3 py-2 text-[13px] text-[var(--risk-medium)] font-[var(--font-body)]">
          No redactions active — raw contract text will be sent to the model.
        </p>
      )}

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
          onClick={handleConfirm}
          className="rounded border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Confirm → Next
        </button>
      </div>
    </div>
  );
}

/**
 * Render the scrubbed text with disabled tokens swapped back to their
 * original values. Used inside the collapsible inline-text disclosure
 * so the user can audit exactly what the model will see.
 */
function renderInlineWithDisabled(
  scrubbed: string,
  tokenMap: Map<string, string>,
  disabled: Set<string>,
): string {
  let out = scrubbed;
  for (const token of disabled) {
    const original = tokenMap.get(token);
    if (original === undefined) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), original);
  }
  return out;
}

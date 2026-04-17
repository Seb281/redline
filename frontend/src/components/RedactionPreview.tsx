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
 *
 * SP-1.9 Phase 6: the parties block has editable label inputs so the
 * user can rename tokens (e.g. "PARTY_A" → "PROVIDER") before the text
 * hits the model. `editableLabels` is held by the hook; `onEditLabel`
 * lets this component trigger normalise + disambiguate logic there.
 */

"use client";

import { useMemo, useState } from "react";
import type { Party } from "@/types";

interface RedactionPreviewProps {
  raw: string;
  scrubbed: string;
  tokenMap: Map<string, string>;
  /** Parties from Pass 0, parallel to `editableLabels`. */
  parties: Party[];
  /** Canonical labels held by the hook — this component renders them and calls `onEditLabel` to mutate. */
  editableLabels: string[];
  /** User edited a label in row `index`. Hook normalizes + disambiguates. */
  onEditLabel: (index: number, rawLabel: string) => void;
  /** Fires with the set of tokens the user wants to LEAVE visible (disabled). */
  onConfirm: (disabled: Set<string>) => void;
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

/**
 * Map the internal kind code to a human-friendly plural label.
 * NOTE: "PARTY" is intentionally absent — semantic party labels
 * (PROVIDER, TENANT, etc.) are rendered in the dedicated parties block
 * above the groups list and should not appear here.
 */
function kindLabel(kind: string): string {
  switch (kind) {
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
  parties,
  editableLabels,
  onEditLabel,
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

  // Tokens that map to party labels — excluded from the generic kind-groups
  // block below; shown instead in the dedicated editable parties block.
  const partyTokens = useMemo(
    () =>
      new Set<string>(
        parties
          .map((_, i) => editableLabels[i])
          .filter(Boolean)
          .map((label) => `\u27E6${label}\u27E7`),
      ),
    [parties, editableLabels],
  );

  /** Non-party kind groups — party tokens are displayed in their own block. */
  const nonPartyGroups = useMemo(
    () => groups.filter((g) => g.entities.every((e) => !partyTokens.has(e.token))),
    [groups, partyTokens],
  );

  /** True if any party label field is empty — gates the Confirm button. */
  const hasEmpty = editableLabels.some((l) => !l);
  const canConfirm = !hasEmpty;

  /** Emit the set of tokens the user wants to leave visible (disabled). */
  const handleConfirm = () => {
    onConfirm(disabled);
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

      {/* Parties block — one editable label input per party */}
      {parties.length > 0 && (
        <div className="mb-4 rounded border border-[var(--border-primary)] bg-[var(--bg-card)]">
          <p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)] font-[var(--font-body)]">
            Parties ({parties.length})
          </p>
          <ul className="divide-y divide-[var(--border-primary)]">
            {parties.map((party, i) => {
              const label = editableLabels[i] ?? "";
              const isDuplicate = /_\d+$/.test(label);
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="text"
                    data-testid="party-label-input"
                    value={label}
                    onChange={(e) => onEditLabel(i, e.target.value)}
                    className="w-44 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 font-mono text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    aria-label={`Label for ${party.name}`}
                  />
                  <span aria-hidden="true">→</span>
                  <span className="flex-1 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">{party.name}</span>
                  <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text-tertiary)]">
                    {label ? `\u27E6${label}\u27E7` : "—"}
                  </code>
                  {isDuplicate && (
                    <span className="ml-2 text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
                      Distinguished from row above
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {hasEmpty && (
            <p className="px-4 pb-3 text-[12px] text-[var(--risk-medium)] font-[var(--font-body)]">
              Label required — every party must have a label before continuing.
            </p>
          )}
        </div>
      )}

      {/* Kind-groups block — non-party PII tokens only */}
      <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] divide-y divide-[var(--border-primary)]">
        {nonPartyGroups.map((group) => {
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
          disabled={!canConfirm}
          className="rounded border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

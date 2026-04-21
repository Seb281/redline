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
import { useTranslations } from "next-intl";
import { BorderedCard } from "@/components/ui/BorderedCard";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";
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
  entities: GroupedEntity[];
}

/**
 * Pull the `KIND` prefix from a token like `⟦EMAIL_1⟧` or `⟦PARTY_A⟧`.
 * Strips only the trailing `_N` counter (or `_A` letter suffix for party
 * tokens), so compound kinds like `FR_SSN`, `ID_NUMBER`, `COMPANY_REG`
 * survive intact. Falls back to the whole inner string when no counter
 * suffix is present.
 */
function tokenKind(token: string): string {
  const inner = token.slice(1, -1);
  const match = inner.match(/^(.*)_[A-Z0-9]+$/);
  return match ? match[1] : inner;
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
  const t = useTranslations("RedactionPreview");
  const kindLabel = (kind: string): string => t(`kinds.${kind}`);
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
    <BorderedCard
      tone="ink"
      padding="lg"
      className="mb-8"
      data-testid="redaction-preview"
    >
      <MonoLabel tone="red" className="block">
        {t("label")}
      </MonoLabel>
      <h3 className="mt-3 font-serif text-[28px] font-light leading-[1.05] tracking-[-0.01em] text-ink md:text-[32px]">
        {t("heading")}
      </h3>
      <p className="t-reading mt-3 max-w-[60ch] text-[15px] text-ink-2">
        {t("description")}
      </p>

      {/* Parties block — one editable label input per party */}
      {parties.length > 0 && (
        <div className="mt-6 border border-paper-edge bg-paper">
          <div className="border-b border-paper-edge px-4 py-2.5">
            <MonoLabel tone="ink">
              {t("parties", { count: parties.length })}
            </MonoLabel>
          </div>
          <ul className="divide-y divide-paper-edge">
            {parties.map((party, i) => {
              const label = editableLabels[i] ?? "";
              // Collision suffix from `disambiguateLabels` is always `_2`, `_3`, …
              // Matching `_[2-9]\d*$` avoids false positives on labels whose
              // normalized form naturally ends in `_1` (e.g. "Partner 1").
              const isDuplicate = /_[2-9]\d*$/.test(label);
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <input
                    type="text"
                    data-testid="party-label-input"
                    value={label}
                    onChange={(e) => onEditLabel(i, e.target.value)}
                    className="w-44 border border-ink bg-paper px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[1px] text-ink focus:border-red-accent focus:outline-none"
                    aria-label={t("aria.labelFor", { name: party.name })}
                  />
                  <span aria-hidden="true" className="font-mono text-[11px] text-ink-muted">
                    →
                  </span>
                  <span className="flex-1 font-serif text-[15px] text-ink-2">
                    {party.name}
                  </span>
                  <code className="bg-paper-2 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">
                    {label ? `\u27E6${label}\u27E7` : "—"}
                  </code>
                  {isDuplicate && (
                    <span className="w-full font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
                      {t("duplicateWarning")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {hasEmpty && (
            <p className="border-t border-paper-edge px-4 py-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
              {t("labelRequired")}
            </p>
          )}
        </div>
      )}

      {/* Kind-groups block — non-party PII tokens only */}
      {nonPartyGroups.length > 0 && (
        <div className="mt-6 border border-paper-edge bg-paper divide-y divide-paper-edge">
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
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-paper-2"
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <MonoLabel tone="ink">{kindLabel(group.kind)}</MonoLabel>
                    <span className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
                      · {group.entities.length}
                    </span>
                    <span className="t-reading text-[14px] text-ink-2">
                      {examples}
                      {suffix}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted" aria-hidden="true">
                    {expanded ? "\u25BE" : "\u25B8"}
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-paper-edge bg-paper-2 px-4 py-3">
                    <ul className="flex flex-col gap-1.5">
                      {group.entities.map((ent) => {
                        const isDisabled = disabled.has(ent.token);
                        return (
                          <li key={ent.token}>
                            <button
                              type="button"
                              onClick={() => toggleEntity(ent.token)}
                              aria-label={t(isDisabled ? "aria.reEnableEntity" : "aria.disableEntity", { text: ent.original })}
                              className={`w-full text-left font-mono text-[12px] transition-colors ${
                                isDisabled
                                  ? "text-ink-muted line-through"
                                  : "text-ink hover:text-red-accent"
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
      )}

      <button
        type="button"
        onClick={() => setShowInline((v) => !v)}
        className="mt-5 font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
      >
        {showInline ? "\u25BE " : "\u25B8 "}
        {showInline ? t("hideInline") : t("showInline")}
      </button>
      {showInline && (
        <>
          {parties.length > 0 && (
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
              {t("partyNote")}
            </p>
          )}
          <pre className="mt-2 max-h-[200px] overflow-y-auto border border-paper-edge bg-paper-2 p-3 font-mono text-[12px] text-ink-2 whitespace-pre-wrap">
            {renderInlineWithDisabled(scrubbed, tokenMap, disabled)}
          </pre>
        </>
      )}

      <div className="mt-5 border-t border-paper-edge pt-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-2">
          {t("activeCount", { active: activeCount, disabled: disabled.size })}
        </p>
        {allDisabled && (
          <p className="mt-2 border border-red-accent bg-paper px-3 py-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
            {t("noRedactions")}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="md" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {t("confirmNext")}
        </Button>
      </div>
    </BorderedCard>
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

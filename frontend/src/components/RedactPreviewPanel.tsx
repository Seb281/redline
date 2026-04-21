/**
 * Kind-level redaction preview for the /redact flow.
 *
 * Works at per-KIND granularity (toggle the whole EMAIL kind ON/OFF)
 * rather than the analyzer's per-token granularity. The user is about
 * to download a redacted PDF — fine-grained per-instance control adds
 * friction without value, and the data shapes (TokenRange[] vs
 * Map<string,string> + Party[]) don't compose cleanly with the
 * analyzer's RedactionPreview. Keeping it separate preserves
 * single-responsibility on both sides.
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { TokenKind, TokenRange } from "@/lib/redact-export/types";
import {
  BorderedCard,
  Button,
  Kicker,
  MonoLabel,
  Toggle,
} from "@/components/ui";

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
  const active = tokens
    .filter((t) => !disabledKinds.has(t.kind))
    .sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  const preview = fullText.slice(0, maxChars + 500);

  for (const t of active) {
    if (t.start >= preview.length) break;
    if (t.start < cursor) continue;
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
  const t = useTranslations("RedactPreviewPanel");
  const kindLabel = (kind: TokenKind): string => t(`kinds.${kind}`);
  // Disabled = kinds turned OFF (their tokens will NOT be redacted).
  // Default = all kinds enabled (empty disabled set).
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
    <BorderedCard
      tone="red"
      padding="md"
      className="mb-8"
      data-testid="redact-preview-panel"
    >
      <Kicker tone="red">{t("label")}</Kicker>
      <h3 className="mt-3 mb-2 font-serif text-[26px] font-light leading-tight text-ink">
        {t("heading")}
      </h3>
      <p className="mb-5 t-reading text-[15px] italic text-ink-2">
        {t("description")}
      </p>

      {/* Kind-level toggle rows */}
      <div className="border border-paper-edge bg-paper">
        {groups.length === 0 && (
          <p className="m-0 px-4 py-4 font-serif text-[15px] italic text-ink-muted">
            {t("noEntities")}
          </p>
        )}
        {groups.map(({ kind, tokens: kindTokens }, idx) => {
          const isEnabled = !disabledKinds.has(kind);
          const examples = kindTokens
            .slice(0, 3)
            .map((tok) => tok.original)
            .join(", ");
          const suffix =
            kindTokens.length > 3 ? ` +${kindTokens.length - 3} more` : "";
          return (
            <div
              key={kind}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                idx > 0 ? "border-t border-paper-edge" : ""
              } ${isEnabled ? "" : "opacity-50"}`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <MonoLabel tone={isEnabled ? "ink" : "muted"}>
                    {kindLabel(kind)}
                  </MonoLabel>
                  <span className="font-mono text-[11px] text-ink-muted">
                    · {kindTokens.length}
                  </span>
                </div>
                <span className="truncate font-serif text-[13px] italic text-ink-muted max-w-[440px]">
                  {examples}
                  {suffix}
                </span>
              </div>
              <Toggle
                checked={isEnabled}
                onChange={() => toggleKind(kind)}
                label={kindLabel(kind)}
              />
            </div>
          );
        })}
      </div>

      {/* Inline text preview */}
      <button
        type="button"
        onClick={() => setShowInline((v) => !v)}
        className="mt-4 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
      >
        {showInline ? t("hidePreview") : t("showPreview")}
      </button>
      {showInline && (
        <pre className="mt-3 max-h-[220px] overflow-y-auto border border-paper-edge bg-paper-2 p-3 font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap">
          {scrubbed}
          {fullText.length > 800 && (
            <span className="italic text-ink-muted">
              {"\n"}
              {t("truncNote")}
            </span>
          )}
        </pre>
      )}

      <p className="mt-4 m-0 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
        {t("countText", {
          active: activeCount,
          total: totalCount,
          skipped: totalCount - activeCount,
        })}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-paper-edge pt-5">
        <Button variant="ghost" size="md" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onConfirm(new Set(disabledKinds))}
        >
          {t("buildPdf")}
        </Button>
      </div>
    </BorderedCard>
  );
}

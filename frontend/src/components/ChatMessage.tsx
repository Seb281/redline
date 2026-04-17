/**
 * Individual chat message bubble — user or assistant.
 *
 * SP-1.9: Assistant messages may cite party names (⟦PROVIDER⟧). By
 * default we prettify those tokens into readable labels ("Provider")
 * so screenshots are privacy-safe. When the user flips the global
 * "Show real names" toggle we rehydrate to the legal party name.
 * PII tokens (⟦EMAIL_1⟧ etc.) are never rehydrated here — the client
 * does not hold their originals.
 */

import { useMemo } from "react";
import type { UIMessage } from "ai";
import { rehydrate } from "@/lib/redaction";
import {
  heuristicLabels,
  normalizeLabel,
  disambiguateLabels,
} from "@/lib/redaction/role-heuristics";
import { useRehydrate } from "@/contexts/RehydrateContext";
import type { Party } from "@/types";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  /**
   * Parties from the analysis (SP-1.9 shape: Party[]).
   * The chat route scrubs names with semantic role tokens; we rebuild
   * the same token map here to replace any tokens the assistant echoed
   * back before display. PII tokens (⟦EMAIL_1⟧ etc.) are NOT rehydrated
   * because the client doesn't hold their originals.
   */
  parties?: Party[];
  /**
   * Contract type forwarded from Pass 0 so the heuristic pipeline can
   * derive the same labels used during redaction.
   */
  contractType?: string;
}

/**
 * Replace every `⟦LABEL⟧` token in `text` with a title-cased
 * human-readable form (`⟦PROVIDER⟧` → `Provider`). Used as the
 * privacy-default display mode — no legal names surface unless the
 * user explicitly flips the rehydrate toggle.
 */
function prettifyTokens(text: string): string {
  return text.replace(/\u27E6([A-Z0-9_]+)\u27E7/g, (_, label: string) =>
    label
      .split("_")
      .filter(Boolean)
      .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
      .join(" "),
  );
}

/** Renders a single chat message with role-appropriate styling. */
export function ChatMessage({
  message,
  isStreaming,
  parties = [],
  contractType = "",
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const { rehydrate: showRealNames } = useRehydrate();

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    if (parties.length === 0) return m;
    const heuristic = heuristicLabels(contractType, parties.length);
    const seeded = parties.map((p, i) =>
      normalizeLabel(p.role_label ?? "") || heuristic[i],
    );
    const labels = disambiguateLabels(seeded);
    parties.forEach((p, i) => {
      if (p.name && p.name.trim() && labels[i]) {
        m.set(`\u27E6${labels[i]}\u27E7`, p.name);
      }
    });
    return m;
  }, [parties, contractType]);

  const rawText = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

  // Rehydrate to legal names when toggled on; otherwise show prettified
  // role labels so a screenshot can't leak party identity.
  const textContent = showRealNames
    ? rehydrate(rawText, partyMap)
    : prettifyTokens(rawText);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-[15px] leading-relaxed font-[var(--font-body)] ${
          isUser
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)]"
        }`}
      >
        <p className="whitespace-pre-wrap">{textContent}</p>
        {isStreaming && !isUser && (
          <span className="inline-block ml-0.5 w-1.5 h-4 bg-[var(--text-muted)] animate-pulse" />
        )}
      </div>
    </div>
  );
}

/** Individual chat message bubble — user or assistant. */

import { useMemo } from "react";
import type { UIMessage } from "ai";
import { rehydrate } from "@/lib/redaction";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
  /**
   * Party names from the analysis. The chat route scrubs these out of
   * the LLM input; we rebuild the same PARTY_A..PARTY_H token map here
   * to replace any tokens the assistant echoed back before display. PII
   * tokens (⟦EMAIL_1⟧ etc.) are NOT rehydrated because the client
   * doesn't hold their originals — those stay visible as tokens and the
   * user can look them up in the clause card.
   */
  parties?: string[];
}

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Renders a single chat message with role-appropriate styling. */
export function ChatMessage({ message, isStreaming, parties = [] }: ChatMessageProps) {
  const isUser = message.role === "user";

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    parties.slice(0, LABELS.length).forEach((name, i) => {
      if (name && name.trim()) m.set(`\u27E6PARTY_${LABELS[i]}\u27E7`, name);
    });
    return m;
  }, [parties]);

  const rawText = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
  const textContent = partyMap.size ? rehydrate(rawText, partyMap) : rawText;

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

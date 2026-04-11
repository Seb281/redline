/** Individual chat message bubble — user or assistant. */

import type { UIMessage } from "ai";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

/** Renders a single chat message with role-appropriate styling. */
export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

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

/**
 * Slide-out chat panel for asking follow-up questions about a contract.
 *
 * Uses the Vercel AI SDK useChat hook to stream responses from /api/chat,
 * grounded with RAG-selected clauses from the analysis. Enforces a
 * 10-message limit per session.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AnalyzeResponse } from "@/types";
import { ChatMessage } from "@/components/ChatMessage";

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  analysis: AnalyzeResponse;
  /** Pre-populated question triggered by "Ask about this" on a clause. */
  initialQuestion: string | null;
  onInitialQuestionConsumed: () => void;
}

/** Collapsible right-side chat panel for contract follow-up questions. */
export function ChatPanel({
  isOpen,
  onToggle,
  analysis,
  initialQuestion,
  onInitialQuestionConsumed,
}: ChatPanelProps) {
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { analysis },
    }),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Auto-scroll to bottom when new messages arrive. */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Focus input when panel opens. */
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /** Handle pre-populated question from "Ask about this" on a clause card. */
  useEffect(() => {
    if (initialQuestion && isOpen && status === "ready") {
      sendMessage({ text: initialQuestion });
      onInitialQuestionConsumed();
    }
  }, [initialQuestion, isOpen, status, sendMessage, onInitialQuestionConsumed]);

  /** Submit message from textarea. */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputRef.current?.value.trim();
      if (!text || status !== "ready") return;
      sendMessage({ text });
      if (inputRef.current) inputRef.current.value = "";
    },
    [sendMessage, status]
  );

  /** Submit on Enter (Shift+Enter for newline). */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <>
      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={onToggle}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-[var(--border-primary)] bg-[var(--bg-primary)] transition-transform duration-300 sm:w-[400px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
            Ask about this contract
          </h2>
          <button
            type="button"
            onClick={onToggle}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Close chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-[15px] text-[var(--text-muted)] font-[var(--font-body)] mb-3">
                Ask follow-up questions about your contract
              </p>
              <div className="space-y-2 text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
                <p>&ldquo;Is the non-compete clause enforceable?&rdquo;</p>
                <p>&ldquo;What should I negotiate first?&rdquo;</p>
                <p>&ldquo;Summarize the key risks&rdquo;</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={status === "streaming" && msg === messages[messages.length - 1] && msg.role === "assistant"}
              parties={analysis.overview.parties}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border-primary)] px-5 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2.5">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={messages.length >= 10 ? "Chat limit reached" : "Ask a question..."}
              disabled={messages.length >= 10}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] font-[var(--font-body)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none theme-transition"
            />
            <button
              type="submit"
              disabled={status !== "ready" || messages.length >= 10}
              className="rounded bg-[var(--accent)] px-4 py-2.5 text-[15px] font-medium text-white font-[var(--font-body)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
          {messages.length >= 10 && (
            <p className="mt-2 text-[13px] text-[var(--accent)] font-[var(--font-body)]">
              Chat limit reached. Start a new analysis to continue.
            </p>
          )}
          {status === "streaming" && (
            <button
              type="button"
              onClick={() => stop()}
              className="mt-2 text-[13px] text-[var(--text-muted)] font-[var(--font-body)] hover:underline"
            >
              Stop generating
            </button>
          )}
          {messages.length > 0 && status === "ready" && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="mt-2 text-[13px] text-[var(--text-muted)] font-[var(--font-body)] hover:underline"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>
    </>
  );
}

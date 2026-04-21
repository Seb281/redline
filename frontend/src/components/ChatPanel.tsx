/**
 * Slide-out chat panel for asking follow-up questions about a contract.
 *
 * Uses the Vercel AI SDK useChat hook to stream responses from /api/chat,
 * grounded with RAG-selected clauses from the analysis. Enforces a
 * 10-message limit per session.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AnalyzeResponse } from "@/types";
import { ChatMessage } from "@/components/ChatMessage";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";

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
  const t = useTranslations("ChatPanel");
  // SP-7 Layer B' — forward the UI locale in every chat POST so the
  // route can resolve it into an effective analysis locale (subject to
  // `ANALYSIS_LOCALE_OVERRIDE` on the server).
  const locale = useLocale();
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { analysis, locale },
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
    [sendMessage, status],
  );

  /** Submit on Enter (Shift+Enter for newline). */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  return (
    <>
      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 sm:hidden"
          onClick={onToggle}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-ink bg-paper transition-transform duration-300 sm:w-[420px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Header — editorial masthead */}
        <header className="border-b-2 border-ink px-5 pb-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <MonoLabel tone="red" className="block">
                Q&amp;A
              </MonoLabel>
              <h2 className="mt-2 font-serif text-[24px] font-light leading-tight tracking-[-0.01em] text-ink">
                {t("heading")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
              aria-label={t("close")}
            >
              ×
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <p className="t-reading mb-4 text-[15px] text-ink-2">
                {t("empty")}
              </p>
              <ul className="space-y-1.5 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
                <li>&ldquo;{t("example1")}&rdquo;</li>
                <li>&ldquo;{t("example2")}&rdquo;</li>
                <li>&ldquo;{t("example3")}&rdquo;</li>
              </ul>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={
                status === "streaming" &&
                msg === messages[messages.length - 1] &&
                msg.role === "assistant"
              }
              parties={analysis.overview.parties}
              contractType={analysis.overview.contract_type}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-ink px-5 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={
                messages.length >= 10 ? t("placeholderLimit") : t("placeholder")
              }
              disabled={messages.length >= 10}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none border border-paper-edge bg-paper-2 px-3 py-2 font-serif text-[15px] text-ink placeholder:font-mono placeholder:text-[12px] placeholder:uppercase placeholder:tracking-[1.2px] placeholder:text-ink-muted focus:border-red-accent focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={status !== "ready" || messages.length >= 10}
            >
              {t("send")}
            </Button>
          </form>
          {messages.length >= 10 && (
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
              {t("limitReached")}
            </p>
          )}
          <div className="mt-2 flex gap-4">
            {status === "streaming" && (
              <button
                type="button"
                onClick={() => stop()}
                className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
              >
                {t("stopGenerating")}
              </button>
            )}
            {messages.length > 0 && status === "ready" && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
              >
                {t("clearChat")}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

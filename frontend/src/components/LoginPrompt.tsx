/** Inline email input for magic link login — used in save flow and history page. */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

interface LoginPromptProps {
  /** Message shown above the email input. */
  message?: string;
}

type LoginState = "idle" | "submitting" | "sent" | "error";

/**
 * Compact login form that sends a magic link email.
 *
 * Renders inline (not as a modal) per the design spec. After submission,
 * shows a "check your inbox" message. The user verifies in a new tab;
 * the parent detects authentication via AuthContext's window-focus
 * recheck and adjusts the UI accordingly.
 */
export function LoginPrompt({ message }: LoginPromptProps) {
  const t = useTranslations("LoginPrompt");
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;

      setState("submitting");
      setError(null);

      try {
        await login(email.trim());
        setState("sent");
      } catch (err) {
        setState("error");
        setError(
          err instanceof Error ? err.message : t("failed"),
        );
      }
    },
    [email, login, t],
  );

  if (state === "sent") {
    return (
      <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-4 text-center theme-transition">
        <p className="text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
          {t("inboxHeading")}
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
          {t.rich("inboxBody", {
            email,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setEmail("");
          }}
          className="mt-3 text-sm text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          {t("useDifferentEmail")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-4 theme-transition">
      {message && (
        <p className="mb-3 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {message}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] font-[var(--font-body)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="rounded bg-[var(--text-primary)] px-4 py-2 text-[15px] font-medium text-[var(--bg-primary)] font-[var(--font-body)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {state === "submitting" ? t("sending") : t("logIn")}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-[var(--accent)] font-[var(--font-body)]">
          {error}
        </p>
      )}
    </div>
  );
}

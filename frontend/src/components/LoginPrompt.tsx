/** Inline email input for magic link login — used in save flow and history page. */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";

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
        setError(err instanceof Error ? err.message : t("failed"));
      }
    },
    [email, login, t],
  );

  if (state === "sent") {
    return (
      <div className="border border-ink bg-paper px-5 py-4 text-center">
        <MonoLabel tone="red" className="block">
          {t("inboxHeading")}
        </MonoLabel>
        <p className="mt-2 t-reading text-[15px] text-ink-2">
          {t.rich("inboxBody", {
            email,
            strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
          })}
        </p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setEmail("");
          }}
          className="mt-3 font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
        >
          {t("useDifferentEmail")}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-ink bg-paper px-5 py-4">
      {message && (
        <p className="t-reading mb-3 text-[15px] text-ink-2">{message}</p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          className="flex-1 border border-paper-edge bg-paper-2 px-3 py-2 font-serif text-[15px] text-ink placeholder:font-mono placeholder:text-[12px] placeholder:uppercase placeholder:tracking-[1.2px] placeholder:text-ink-muted focus:border-red-accent focus:outline-none"
        />
        <Button type="submit" variant="primary" size="md" disabled={state === "submitting"}>
          {state === "submitting" ? t("sending") : t("logIn")}
        </Button>
      </form>
      {error && (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Typed-confirmation modal for account deletion — SP-6.
 *
 * The destructive endpoint is guarded server-side (the backend
 * re-checks the email match), but a matching client-side gate keeps
 * the UI honest: the primary button stays disabled until the user
 * types their own email. Pressing Escape or clicking the backdrop
 * dismisses the modal so a stray click cannot commit the deletion.
 *
 * Editorial treatment: ink-drenched backdrop, paper body inside a 2px
 * red-accent BorderedCard so the destructive boundary reads at a glance.
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BorderedCard, Button, MonoLabel } from "@/components/ui";

interface DeleteAccountModalProps {
  /** The email address the user must type to confirm. */
  email: string;
  /** Controls visibility. */
  open: boolean;
  /** Called when the user cancels or closes the modal. */
  onCancel: () => void;
  /** Called when the user confirms. Resolves when the server returns. */
  onConfirm: (confirm: string) => Promise<void>;
}

/** Modal rendered via a fixed overlay (no portal — scoped to page). */
export function DeleteAccountModal({
  email,
  open,
  onCancel,
  onConfirm,
}: DeleteAccountModalProps) {
  const t = useTranslations("DeleteAccountModal");
  const [input, setInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = input.trim().toLowerCase() === email.trim().toLowerCase();

  /** Dismiss on Escape — cheap keyboard safety net. */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, isDeleting, onCancel]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(input.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedFallback"));
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <BorderedCard
        tone="red"
        padding="md"
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <MonoLabel tone="red" className="block">
          {t("title")}
        </MonoLabel>
        <h2
          id="delete-account-title"
          className="mt-2 m-0 font-serif text-[24px] font-light italic leading-tight text-ink"
        >
          {t("title")}
        </h2>
        <p className="mt-3 t-reading text-[15px] text-ink-2">{t("body")}</p>
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
          {t.rich("typeToConfirm", {
            email,
            strong: (chunks) => (
              <strong className="font-mono font-semibold text-ink">
                {chunks}
              </strong>
            ),
          })}
        </p>

        <form onSubmit={handleSubmit} className="mt-3">
          <input
            type="email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={email}
            autoFocus
            disabled={isDeleting}
            className="w-full border border-paper-edge bg-paper-2 px-3 py-2 font-serif text-[15px] text-ink placeholder:font-mono placeholder:text-[12px] placeholder:uppercase placeholder:tracking-[1.2px] placeholder:text-ink-muted focus:border-red-accent focus:outline-none disabled:opacity-50"
            data-testid="delete-confirm-input"
          />

          {error && (
            <p
              className="mt-2 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={onCancel}
              disabled={isDeleting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              disabled={!matches || isDeleting}
              data-testid="delete-confirm-button"
            >
              {isDeleting ? t("deleting") : t("confirm")}
            </Button>
          </div>
        </form>
      </BorderedCard>
    </div>
  );
}

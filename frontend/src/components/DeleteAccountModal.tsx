/**
 * Typed-confirmation modal for account deletion — SP-6.
 *
 * The destructive endpoint is guarded server-side (the backend
 * re-checks the email match), but a matching client-side gate keeps
 * the UI honest: the primary button stays disabled until the user
 * types their own email. Pressing Escape or clicking the backdrop
 * dismisses the modal so a stray click cannot commit the deletion.
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
      setError(
        err instanceof Error ? err.message : t("failedFallback"),
      );
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <div
        className="max-w-md rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6 shadow-lg theme-transition"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-account-title"
          className="mb-2 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]"
        >
          {t("title")}
        </h2>
        <p className="mb-4 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {t("body")}
        </p>
        <p className="mb-3 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
          {t.rich("typeToConfirm", {
            email,
            strong: (chunks) => (
              <strong className="text-[var(--text-primary)]">{chunks}</strong>
            ),
          })}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={email}
            autoFocus
            disabled={isDeleting}
            className="w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] font-[var(--font-body)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
            data-testid="delete-confirm-input"
          />

          {error && (
            <p
              className="mt-2 text-sm text-[var(--accent)] font-[var(--font-body)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded border border-[var(--border-primary)] px-4 py-2 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!matches || isDeleting}
              data-testid="delete-confirm-button"
              className="rounded bg-[var(--accent)] px-4 py-2 text-[15px] font-medium text-white font-[var(--font-body)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? t("deleting") : t("confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

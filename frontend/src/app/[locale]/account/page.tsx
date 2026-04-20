/**
 * Account page — SP-6 DSAR surface.
 *
 * Two self-serve GDPR rights:
 *   - Art 15 access  → "Export my data" triggers a JSON bundle download.
 *   - Art 17 erasure → typed-confirmation modal hard-deletes the account.
 *
 * Client-side because it relies on AuthContext + the file-download
 * trick in `exportAccount()`. Anonymous visitors fall through to the
 * shared `LoginPrompt` — there's nothing to access or erase until a
 * user is signed in.
 */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { deleteAccount, exportAccount } from "@/lib/api";

export default function AccountPage() {
  const t = useTranslations("Account");
  const { user, isAuthenticated, isLoading: authLoading, recheck } = useAuth();
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  /** Trigger the DSAR bundle download. */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportAccount();
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : t("exportFailedFallback"),
      );
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  /**
   * Submit the typed-confirmation deletion and clean up client state.
   *
   * After the backend returns 200 it has already cleared the session
   * cookie; we still call `recheck()` so the AuthContext drops its
   * cached user object, then redirect home so the stale /account URL
   * doesn't bounce the user back to a login prompt that would feel
   * like the deletion "failed".
   */
  const handleDelete = useCallback(
    async (confirm: string) => {
      await deleteAccount(confirm);
      await recheck();
      router.push("/");
    },
    [recheck, router],
  );

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="mb-2 text-center text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("title")}
        </h1>
        <p className="mb-6 text-center text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("loginPrompt")}
        </p>
        <LoginPrompt />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-9 sm:px-7">
      <Link
        href="/"
        className="mb-6 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        {t("backHome")}
      </Link>

      <h1 className="mb-2 text-[28px] font-normal leading-tight text-[var(--text-primary)] font-[var(--font-heading)]">
        {t("title")}
      </h1>
      <p className="mb-8 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t.rich("signedInAs", {
          email: user?.email ?? "",
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>

      {/* Export — GDPR Art 15 */}
      <section
        className="mb-6 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition"
        aria-labelledby="export-heading"
      >
        <h2
          id="export-heading"
          className="mb-2 text-[17px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]"
        >
          {t("exportHeading")}
        </h2>
        <p className="mb-4 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {t("exportBody")}
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          data-testid="export-button"
          className="rounded bg-[var(--text-primary)] px-4 py-2 text-[15px] font-medium text-[var(--bg-primary)] font-[var(--font-body)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {isExporting ? t("exportPreparing") : t("exportAction")}
        </button>
        {exportError && (
          <p
            className="mt-3 text-sm text-[var(--accent)] font-[var(--font-body)]"
            role="alert"
          >
            {exportError}
          </p>
        )}
      </section>

      {/* Delete — GDPR Art 17 */}
      <section
        className="rounded border border-[var(--accent)] bg-[var(--bg-card)] p-5 theme-transition"
        aria-labelledby="delete-heading"
      >
        <h2
          id="delete-heading"
          className="mb-2 text-[17px] font-semibold text-[var(--accent)] font-[var(--font-heading)]"
        >
          {t("deleteHeading")}
        </h2>
        <p className="mb-4 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {t("deleteBody")}
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-testid="delete-open-button"
          className="rounded border border-[var(--accent)] px-4 py-2 text-[15px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white"
        >
          {t("deleteAction")}
        </button>
      </section>

      {modalOpen && (
        <DeleteAccountModal
          email={user?.email ?? ""}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}

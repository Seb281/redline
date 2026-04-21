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
 *
 * Editorial treatment: Masthead + BorderedCard sections — tone="edge"
 * for the Art 15 export block, tone="red" for the Art 17 deletion block
 * so the danger boundary is immediately legible.
 */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { deleteAccount, exportAccount } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import {
  BorderedCard,
  Button,
  Kicker,
  Masthead,
  SectionHead,
} from "@/components/ui";

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
      <main>
        <PageShell width="md" className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-paper-edge border-t-ink" />
        </PageShell>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main>
        <PageShell width="sm" className="pb-16">
          <Masthead
            meta="ACCOUNT"
            title={t("title")}
            lede={t("loginPrompt")}
          />
          <div className="mt-10">
            <LoginPrompt />
          </div>
        </PageShell>
      </main>
    );
  }

  return (
    <main>
      <PageShell width="md" className="pb-16">
        <Masthead
          meta="ACCOUNT"
          title={t("title")}
          lede={t.rich("signedInAs", {
            email: user?.email ?? "",
            strong: (chunks) => (
              <span className="font-serif not-italic text-ink">{chunks}</span>
            ),
          })}
        />

        {/* Export — GDPR Art 15 */}
        <section className="mt-10" aria-labelledby="export-heading">
          <SectionHead number="§ 15">{t("exportHeading")}</SectionHead>
          <BorderedCard tone="edge" padding="md" className="mt-4">
            <p className="t-reading m-0 text-[16px] text-ink-2">
              {t("exportBody")}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={handleExport}
                disabled={isExporting}
                data-testid="export-button"
              >
                {isExporting ? t("exportPreparing") : t("exportAction")}
              </Button>
              {exportError && (
                <p
                  className="m-0 font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent"
                  role="alert"
                >
                  {exportError}
                </p>
              )}
            </div>
          </BorderedCard>
        </section>

        {/* Delete — GDPR Art 17 */}
        <section className="mt-10" aria-labelledby="delete-heading">
          <div className="mb-4">
            <Kicker tone="red">{t("deleteHeading")}</Kicker>
          </div>
          <BorderedCard tone="red" padding="md">
            <h2
              id="delete-heading"
              className="m-0 font-serif text-[24px] font-light italic leading-tight text-red-accent"
            >
              {t("deleteHeading")}
            </h2>
            <p className="mt-3 t-reading text-[16px] text-ink-2">
              {t("deleteBody")}
            </p>
            <div className="mt-5">
              <Button
                variant="danger"
                size="md"
                onClick={() => setModalOpen(true)}
                data-testid="delete-open-button"
              >
                {t("deleteAction")}
              </Button>
            </div>
          </BorderedCard>
        </section>

        {modalOpen && (
          <DeleteAccountModal
            email={user?.email ?? ""}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onConfirm={handleDelete}
          />
        )}
      </PageShell>
    </main>
  );
}

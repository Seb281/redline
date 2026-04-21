/** Privacy policy page — GDPR Article 13 disclosures. */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/PageShell";
import { Masthead, SectionHead } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@example.com";

/** Inline monospace pill used in body prose. */
const code = (chunks: React.ReactNode) => (
  <code className="bg-paper-2 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
    {chunks}
  </code>
);

/** Editorial accent link used for the privacy contact email. */
function InlineLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
    >
      {children}
    </a>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const emailLink = <InlineLink href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</InlineLink>;

  return (
    <main>
      <PageShell width="sm" className="pb-16">
        <Link
          href="/trust"
          className="mt-6 inline-block font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
        >
          ← {t("back")}
        </Link>

        <Masthead
          meta="PRIVACY"
          title={t("title")}
          lede={t("lastUpdated")}
        />

        <Section title={t("whoWeAre")}>
          <p>{t.rich("whoWeAreBody", { email: () => emailLink })}</p>
        </Section>

        <Section title={t("whatDataTitle")}>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
            <li>
              <strong className="text-ink">{t("contractTextLabel")}</strong> —{" "}
              {t("contractTextBody")}
            </li>
            <li>
              <strong className="text-ink">{t("themePrefLabel")}</strong>{" "}
              {t.rich("themePrefBody", { code })}
            </li>
            <li>
              <strong className="text-ink">{t("cookieDismissLabel")}</strong>{" "}
              {t.rich("cookieDismissBody", { code })}
            </li>
          </ul>
          <p className="mt-3">{t("noCookies")}</p>
        </Section>

        <Section title={t("legalBasisTitle")}>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
            <li>
              <strong className="text-ink">
                {t("legalBasisContractLabel")}
              </strong>{" "}
              — {t("legalBasisContractBody")}
            </li>
            <li>
              <strong className="text-ink">{t("legalBasisPrefLabel")}</strong>{" "}
              — {t("legalBasisPrefBody")}
            </li>
          </ul>
        </Section>

        <Section title={t("processorsTitle")}>
          <p className="mb-3">
            {t.rich("processorsIntro", {
              link: (chunks) => (
                <Link
                  href="/data-residency"
                  className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
            <li>
              <strong className="text-ink">{t("mistralLabel")}</strong>{" "}
              {t.rich("mistralBody", {
                code,
                dpa: (chunks) => (
                  <InlineLink
                    href="https://legal.mistral.ai/terms/data-processing-addendum"
                    external
                  >
                    {chunks}
                  </InlineLink>
                ),
                privacy: (chunks) => (
                  <InlineLink
                    href="https://legal.mistral.ai/terms/privacy-policy"
                    external
                  >
                    {chunks}
                  </InlineLink>
                ),
              })}
            </li>
            <li>
              <strong className="text-ink">{t("vercelLabel")}</strong>{" "}
              {t.rich("vercelBody", {
                privacy: (chunks) => (
                  <InlineLink
                    href="https://vercel.com/legal/privacy-policy"
                    external
                  >
                    {chunks}
                  </InlineLink>
                ),
              })}
            </li>
            <li>
              <strong className="text-ink">{t("railwayLabel")}</strong>{" "}
              {t.rich("railwayBody", {
                privacy: (chunks) => (
                  <InlineLink href="https://railway.com/legal/privacy" external>
                    {chunks}
                  </InlineLink>
                ),
              })}
            </li>
          </ul>
        </Section>

        <Section title={t("retentionTitle")}>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-muted">
            <li>
              <strong className="text-ink">
                {t("retentionContractLabel")}
              </strong>{" "}
              — {t("retentionContractBody")}
            </li>
            <li>
              <strong className="text-ink">{t("retentionSavedLabel")}</strong>{" "}
              — {t("retentionSavedBody")}
            </li>
            <li>
              <strong className="text-ink">{t("retentionLocalLabel")}</strong>{" "}
              — {t("retentionLocalBody")}
            </li>
          </ul>
        </Section>

        <Section title={t("transfersTitle")}>
          <p>{t("transfersAI")}</p>
          <p className="mt-3">{t("transfersOperational")}</p>
        </Section>

        <Section title={t("rightsTitle")}>
          <p>{t("rightsIntro")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-ink-muted">
            <li>{t("rightAccess")}</li>
            <li>{t("rightRectify")}</li>
            <li>{t("rightErasure")}</li>
            <li>{t("rightRestrict")}</li>
            <li>{t("rightPortability")}</li>
            <li>{t("rightObject")}</li>
            <li>{t("rightComplain")}</li>
          </ul>
          <p className="mt-3">
            {t.rich("rightsNoStorage", {
              code,
              link: (chunks) => (
                <Link
                  href="/account"
                  className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p className="mt-3">
            {t.rich("rightsContact", { email: () => emailLink })}
          </p>
        </Section>

        <Section title={t("aiActTitle")}>
          <p>
            {t.rich("aiActBody", {
              link: (chunks) => (
                <Link
                  href="/transparency"
                  className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </Section>

        <Section title={t("changesTitle")}>
          <p>{t("changesBody")}</p>
        </Section>
      </PageShell>
    </main>
  );
}

/** Editorial section — SectionHead on a 1px ink rule, then prose below. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <SectionHead>{title}</SectionHead>
      <div className="mt-4 t-reading text-[16px] leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

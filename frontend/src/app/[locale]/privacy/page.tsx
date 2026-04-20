/** Privacy policy page — GDPR Article 13 disclosures. */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

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

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
  const emailLink = (
    <a
      href={`mailto:${PRIVACY_EMAIL}`}
      className="text-[var(--accent)] hover:underline"
    >
      {PRIVACY_EMAIL}
    </a>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <Link
        href="/"
        className="mb-6 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        {t("back")}
      </Link>

      <h1 className="mb-2 text-[32px] font-normal leading-tight text-[var(--text-primary)] font-[var(--font-heading)]">
        {t("title")}
      </h1>
      <p className="mb-9 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t("lastUpdated")}
      </p>

      <Section title={t("whoWeAre")}>
        <p>{t.rich("whoWeAreBody", { email: () => emailLink })}</p>
      </Section>

      <Section title={t("whatDataTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{t("contractTextLabel")}</strong> — {t("contractTextBody")}
          </li>
          <li>
            <strong>{t("themePrefLabel")}</strong>{" "}
            {t.rich("themePrefBody", { code })}
          </li>
          <li>
            <strong>{t("cookieDismissLabel")}</strong>{" "}
            {t.rich("cookieDismissBody", { code })}
          </li>
        </ul>
        <p className="mt-3">{t("noCookies")}</p>
      </Section>

      <Section title={t("legalBasisTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{t("legalBasisContractLabel")}</strong> —{" "}
            {t("legalBasisContractBody")}
          </li>
          <li>
            <strong>{t("legalBasisPrefLabel")}</strong> —{" "}
            {t("legalBasisPrefBody")}
          </li>
        </ul>
      </Section>

      <Section title={t("processorsTitle")}>
        <p className="mb-3">
          {t.rich("processorsIntro", {
            link: (chunks) => (
              <Link
                href="/data-residency"
                className="text-[var(--accent)] hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{t("mistralLabel")}</strong>{" "}
            {t.rich("mistralBody", {
              code,
              dpa: (chunks) => (
                <ExtLink href="https://legal.mistral.ai/terms/data-processing-addendum">
                  {chunks}
                </ExtLink>
              ),
              privacy: (chunks) => (
                <ExtLink href="https://legal.mistral.ai/terms/privacy-policy">
                  {chunks}
                </ExtLink>
              ),
            })}
          </li>
          <li>
            <strong>{t("vercelLabel")}</strong>{" "}
            {t.rich("vercelBody", {
              privacy: (chunks) => (
                <ExtLink href="https://vercel.com/legal/privacy-policy">
                  {chunks}
                </ExtLink>
              ),
            })}
          </li>
          <li>
            <strong>{t("railwayLabel")}</strong>{" "}
            {t.rich("railwayBody", {
              privacy: (chunks) => (
                <ExtLink href="https://railway.com/legal/privacy">
                  {chunks}
                </ExtLink>
              ),
            })}
          </li>
        </ul>
      </Section>

      <Section title={t("retentionTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{t("retentionContractLabel")}</strong> —{" "}
            {t("retentionContractBody")}
          </li>
          <li>
            <strong>{t("retentionSavedLabel")}</strong> —{" "}
            {t("retentionSavedBody")}
          </li>
          <li>
            <strong>{t("retentionLocalLabel")}</strong> —{" "}
            {t("retentionLocalBody")}
          </li>
        </ul>
      </Section>

      <Section title={t("transfersTitle")}>
        <p>{t("transfersAI")}</p>
        <p className="mt-3">{t("transfersOperational")}</p>
      </Section>

      <Section title={t("rightsTitle")}>
        <p>{t("rightsIntro")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
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
                className="text-[var(--accent)] hover:underline"
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
                className="text-[var(--accent)] hover:underline"
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
    </main>
  );
}

/** Reusable section with heading. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {title}
      </h2>
      <div className="text-[15px] leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]">
        {children}
      </div>
    </section>
  );
}

/** External link — opens in new tab with security attributes. */
function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] hover:underline"
    >
      {children}
    </a>
  );
}

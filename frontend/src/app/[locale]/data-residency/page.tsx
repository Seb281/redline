/**
 * Data residency page — lists every third-party data flow with region
 * and legal basis. Rendered from the typed `DATA_FLOWS` config so it
 * stays in sync with reality; adding a processor there surfaces it
 * here automatically.
 *
 * The page leads with the default EU-only story (Mistral + Vercel +
 * Railway), then shows the optional flows that only activate when the
 * operator enables a specific feature (DB auth, email magic-link).
 * Grouping matters — "contract text stays in the EU" is a trust
 * statement, and burying it in a flat list would weaken that claim.
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DATA_FLOWS, type DataFlow } from "@/lib/data-flows";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DataResidency" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function DataResidencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DataResidency");
  const defaults = DATA_FLOWS.filter((f) => f.group === "default");
  const optional = DATA_FLOWS.filter((f) => f.group === "optional");
  const fieldLabels = {
    data: t("data"),
    legalBasis: t("legalBasis"),
    notes: t("notes"),
    policies: t("policies"),
    privacyPolicy: t("privacyPolicy"),
    dpa: t("dpa"),
  };
  /**
   * Resolve localized copy for a single flow. Falls back to the EN
   * source on `DataFlow` when the locale omits the `flows.{key}`
   * namespace — next-intl's `mergeMessages` already handles deep
   * fallback, but consult the config directly as a defensive second
   * layer so a missing key never crashes the page.
   */
  const localizeFlow = (flow: DataFlow) => {
    const base = `flows.${flow.translationKey}`;
    const categories = t.raw(`${base}.dataCategories`);
    return {
      purpose: t(`${base}.purpose`),
      notes: t(`${base}.notes`),
      dataCategories: Array.isArray(categories)
        ? (categories as string[])
        : flow.dataCategories,
    };
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <Link
        href="/privacy"
        className="mb-6 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        {t("back")}
      </Link>

      <h1 className="mb-2 text-[32px] font-normal leading-tight text-[var(--text-primary)] font-[var(--font-heading)]">
        {t("title")}
      </h1>
      <p className="mb-9 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t("description")}
      </p>

      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("defaultTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("defaultDesc")}
        </p>
        <div className="space-y-4">
          {defaults.map((flow) => (
            <DataFlowCard
              key={flow.provider}
              flow={flow}
              labels={fieldLabels}
              localized={localizeFlow(flow)}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("optionalTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("optionalDesc")}
        </p>
        <div className="space-y-4">
          {optional.map((flow) => (
            <DataFlowCard
              key={flow.provider}
              flow={flow}
              labels={fieldLabels}
              localized={localizeFlow(flow)}
            />
          ))}
        </div>
      </section>

      <p className="mb-4 text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t.rich("configNote", {
          code: (chunks) => <code>{chunks}</code>,
        })}
      </p>
      <p className="mb-3 text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t("i18nNote")}
      </p>
      <p className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t.rich("transparencyNote", {
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
    </main>
  );
}

interface FieldLabels {
  data: string;
  legalBasis: string;
  notes: string;
  policies: string;
  privacyPolicy: string;
  dpa: string;
}

interface LocalizedFlow {
  purpose: string;
  notes: string;
  dataCategories: string[];
}

/** One processor card — heading, region pill, then the audit fields. */
function DataFlowCard({
  flow,
  labels,
  localized,
}: {
  flow: DataFlow;
  labels: FieldLabels;
  localized: LocalizedFlow;
}) {
  return (
    <article
      className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-5 theme-transition"
      data-testid={`data-flow-${flow.provider.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {flow.provider}
        </h3>
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[12px] font-medium text-[var(--text-secondary)] font-[var(--font-body)]">
          {flow.region}
        </span>
      </header>

      <p className="mb-3 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
        {localized.purpose}
      </p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <Field label={labels.data}>
          <ul className="list-disc space-y-1 pl-5 marker:text-[var(--text-muted)]">
            {localized.dataCategories.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Field>
        <Field label={labels.legalBasis}>{flow.legalBasis}</Field>
        {flow.notes && <Field label={labels.notes}>{localized.notes}</Field>}
        <Field label={labels.policies}>
          <ExtLink href={flow.privacyPolicyUrl}>{labels.privacyPolicy}</ExtLink>
          {flow.dpaUrl && (
            <>
              <span className="mx-2 text-[var(--text-muted)]">·</span>
              <ExtLink href={flow.dpaUrl}>{labels.dpa}</ExtLink>
            </>
          )}
        </Field>
      </dl>
    </article>
  );
}

/** One definition-list row — label column, content column. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[var(--text-muted)] font-[var(--font-body)]">
        {label}
      </dt>
      <dd className="text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
        {children}
      </dd>
    </>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
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

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
import { PageShell } from "@/components/PageShell";
import {
  BorderedCard,
  Masthead,
  MonoLabel,
  SectionHead,
} from "@/components/ui";

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
    <main>
      <PageShell width="md" className="pb-16">
        <Link
          href="/trust"
          className="mt-6 inline-block font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
        >
          ← {t("back")}
        </Link>

        <Masthead
          meta="DATA RESIDENCY"
          title={t("title")}
          lede={t("description")}
        />

        <section className="mt-12">
          <SectionHead>{t("defaultTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("defaultDesc")}
          </p>
          <div className="mt-5 flex flex-col gap-5">
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

        <section className="mt-12">
          <SectionHead>{t("optionalTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("optionalDesc")}
          </p>
          <div className="mt-5 flex flex-col gap-5">
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

        <div className="mt-12 flex flex-col gap-3 border-t border-paper-edge pt-6 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
          <p className="m-0">
            {t.rich("configNote", {
              code: (chunks) => (
                <code className="bg-paper-2 px-1.5 py-0.5 text-ink normal-case">
                  {chunks}
                </code>
              ),
            })}
          </p>
          <p className="m-0">{t("i18nNote")}</p>
          <p className="m-0">
            {t.rich("transparencyNote", {
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
        </div>
      </PageShell>
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

/**
 * One processor card — provider name as serif headline, region as mono
 * kicker, body fields as a definition list. 1px edge border; no
 * rounded corners.
 */
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
    <BorderedCard
      tone="edge"
      padding="md"
      data-testid={`data-flow-${flow.provider.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="m-0 font-serif text-[22px] font-light leading-tight text-ink">
          {flow.provider}
        </h3>
        <span className="inline-block border border-paper-edge bg-paper-2 px-2 py-[1px] font-mono text-[10.5px] font-semibold uppercase tracking-[1.2px] text-ink-2">
          {flow.region}
        </span>
      </header>

      <p className="mt-3 t-reading text-[15px] text-ink-2">
        {localized.purpose}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <Field label={labels.data}>
          <ul className="list-disc space-y-1 pl-5 marker:text-ink-muted">
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
              <span className="mx-2 text-ink-muted">·</span>
              <ExtLink href={flow.dpaUrl}>{labels.dpa}</ExtLink>
            </>
          )}
        </Field>
      </dl>
    </BorderedCard>
  );
}

/** Definition-list row — mono label column, serif-ish value column. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt>
        <MonoLabel tone="muted">{label}</MonoLabel>
      </dt>
      <dd className="m-0 t-reading text-[14.5px] text-ink-2">{children}</dd>
    </>
  );
}

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
      className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
    >
      {children}
    </a>
  );
}

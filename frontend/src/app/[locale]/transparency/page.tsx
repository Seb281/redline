/**
 * SP-9 — AI Act transparency page.
 *
 * Renders the static posture artifact: how Redline maps to AI Act Art
 * 13 / Art 50, the five-stage LLM pipeline, the operator rollback
 * levers a deployer can flip at runtime, and the known limitations.
 *
 * Driven by the typed config in `src/lib/transparency-config.ts` so
 * the list cannot drift from the receipt endpoint, which serialises
 * the same arrays. All copy resolves through the `Transparency` i18n
 * namespace; factual data (article numbers, env-var names) stays on
 * the config because it does not translate.
 *
 * Mirror of `/data-residency` — same server-component pattern,
 * `setRequestLocale` then `getTranslations` then plain JSX.
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  AI_ACT_ARTICLES,
  LIMITATIONS,
  OPERATOR_LEVERS,
  PIPELINE_STEPS,
} from "@/lib/transparency-config";
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
  const t = await getTranslations({ locale, namespace: "Transparency" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TransparencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Transparency");

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
          meta="AI ACT TRANSPARENCY"
          title={t("title")}
          lede={t("description")}
        />

        {/* AI Act article map --------------------------------------------- */}
        <section className="mt-12">
          <SectionHead>{t("aiActTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("aiActDesc")}
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {AI_ACT_ARTICLES.map((article) => (
              <BorderedCard
                key={article.translationKey}
                tone="edge"
                padding="md"
                data-testid={`ai-act-${article.translationKey}`}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="m-0 font-serif text-[20px] font-light leading-tight text-ink">
                    {t(`articles.${article.translationKey}.title`)}
                  </h3>
                  <span className="inline-block border border-paper-edge bg-paper-2 px-2 py-[1px] font-mono text-[10.5px] font-semibold uppercase tracking-[1.2px] text-ink-2">
                    {article.reference}
                  </span>
                </header>
                <p className="mt-3 t-reading text-[15px] text-ink-2">
                  {t(`articles.${article.translationKey}.body`)}
                </p>
                <p className="mt-3 m-0">
                  <code className="bg-paper-2 px-2 py-0.5 font-mono text-[11.5px] uppercase tracking-[1.2px] text-ink">
                    {article.surface}
                  </code>
                </p>
              </BorderedCard>
            ))}
          </div>
        </section>

        {/* Pipeline diagram ----------------------------------------------- */}
        <section className="mt-12">
          <SectionHead>{t("pipelineTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("pipelineDesc")}
          </p>
          <PipelineDiagram
            labels={PIPELINE_STEPS.map((step) => ({
              key: step.translationKey,
              label: t(`pipelineSteps.${step.translationKey}.label`),
              isLlmCall: step.isLlmCall,
            }))}
            llmBadge={t("pipelineLlmBadge")}
            localBadge={t("pipelineLocalBadge")}
          />
          <dl className="mt-6 flex flex-col gap-4">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.translationKey}
                className="border-b border-paper-edge pb-3 last:border-b-0"
              >
                <dt>
                  <MonoLabel tone={step.isLlmCall ? "red" : "ink"}>
                    {t(`pipelineSteps.${step.translationKey}.label`)}
                  </MonoLabel>
                </dt>
                <dd className="m-0 mt-1 t-reading text-[14.5px] text-ink-2">
                  {t(`pipelineSteps.${step.translationKey}.desc`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Operator levers ------------------------------------------------- */}
        <section className="mt-12">
          <SectionHead>{t("leversTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("leversDesc")}
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {OPERATOR_LEVERS.map((lever) => (
              <BorderedCard
                key={lever.translationKey}
                tone="edge"
                padding="md"
                data-testid={`operator-lever-${lever.translationKey}`}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="m-0 font-serif text-[18px] font-light leading-tight text-ink">
                    {t(`levers.${lever.translationKey}.label`)}
                  </h3>
                  <code className="bg-paper-2 px-2 py-0.5 font-mono text-[11.5px] text-ink">
                    {lever.envVar}
                    {lever.defaultValue !== null && (
                      <span className="ml-2 text-ink-muted">
                        = {lever.defaultValue}
                      </span>
                    )}
                  </code>
                </header>
                <p className="mt-3 t-reading text-[15px] text-ink-2">
                  {t(`levers.${lever.translationKey}.desc`)}
                </p>
              </BorderedCard>
            ))}
          </div>
        </section>

        {/* Limitations ---------------------------------------------------- */}
        <section className="mt-12">
          <SectionHead>{t("limitationsTitle")}</SectionHead>
          <p className="mt-3 t-reading text-[15px] italic text-ink-2">
            {t("limitationsDesc")}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 t-reading text-[15px] leading-relaxed text-ink-2 marker:text-ink-muted">
            {LIMITATIONS.map((limitation) => (
              <li
                key={limitation.translationKey}
                data-testid={`limitation-${limitation.translationKey}`}
              >
                {t(`limitations.${limitation.translationKey}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* Receipt summary ------------------------------------------------ */}
        <section className="mt-12">
          <BorderedCard tone="ink" padding="md">
            <MonoLabel tone="red" className="block">
              {t("receiptTitle")}
            </MonoLabel>
            <p className="mt-2 m-0 t-reading text-[15px] text-ink-2">
              {t("receiptDesc")}
            </p>
          </BorderedCard>
        </section>

        {/* Cross-links + disclaimer -------------------------------------- */}
        <section className="mt-12 border-t border-paper-edge pt-6">
          <MonoLabel tone="muted">{t("crossLinksTitle")}</MonoLabel>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[1.2px]">
            <li>
              <Link
                href="/privacy"
                className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
              >
                {t("crossLinkPrivacy")}
              </Link>
            </li>
            <li>
              <Link
                href="/data-residency"
                className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
              >
                {t("crossLinkDataResidency")}
              </Link>
            </li>
          </ul>
        </section>

        <p className="mt-6 font-serif text-[13px] italic text-ink-muted">
          {t("notProductionMark")}
        </p>
      </PageShell>
    </main>
  );
}

/**
 * Hand-rolled SVG pipeline diagram. Rectilinear nodes (no rounded rx)
 * connected by thin ink lines with arrow heads. LLM steps carry a
 * red-accent stroke + red-accent badge so the on-device-vs-remote split
 * reads at a glance.
 */
function PipelineDiagram({
  labels,
  llmBadge,
  localBadge,
}: {
  labels: ReadonlyArray<{ key: string; label: string; isLlmCall: boolean }>;
  llmBadge: string;
  localBadge: string;
}) {
  const nodeWidth = 150;
  const nodeHeight = 72;
  const gap = 24;
  const totalWidth = labels.length * nodeWidth + (labels.length - 1) * gap;
  const totalHeight = nodeHeight + 24;

  return (
    <div
      className="mt-5 overflow-x-auto border border-paper-edge bg-paper p-4"
      data-testid="pipeline-diagram"
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="img"
        aria-label="Pipeline diagram"
        className="h-auto w-full min-w-[700px]"
      >
        {labels.map((node, i) => {
          const x = i * (nodeWidth + gap);
          const y = 12;
          return (
            <g key={node.key} data-testid={`pipeline-node-${node.key}`}>
              <rect
                x={x}
                y={y}
                width={nodeWidth}
                height={nodeHeight}
                className={
                  node.isLlmCall
                    ? "fill-paper-2 stroke-red-accent"
                    : "fill-paper stroke-ink"
                }
                strokeWidth={1.5}
              />
              <text
                x={x + nodeWidth / 2}
                y={y + 28}
                textAnchor="middle"
                className="fill-ink text-[12px]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {node.label}
              </text>
              <text
                x={x + nodeWidth / 2}
                y={y + 52}
                textAnchor="middle"
                className={
                  node.isLlmCall
                    ? "fill-red-accent text-[10px] uppercase"
                    : "fill-ink-muted text-[10px] uppercase"
                }
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "1.2px",
                }}
              >
                {node.isLlmCall ? llmBadge : localBadge}
              </text>
              {i < labels.length - 1 && (
                <path
                  d={`M ${x + nodeWidth} ${y + nodeHeight / 2} L ${x + nodeWidth + gap} ${y + nodeHeight / 2}`}
                  className="stroke-ink-muted"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                  fill="none"
                />
              )}
            </g>
          );
        })}
        <defs>
          <marker
            id="arrowhead"
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={4}
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" className="fill-ink-muted" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

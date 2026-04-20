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

      {/* AI Act article map --------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("aiActTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("aiActDesc")}
        </p>
        <div className="space-y-4">
          {AI_ACT_ARTICLES.map((article) => (
            <article
              key={article.translationKey}
              data-testid={`ai-act-${article.translationKey}`}
              className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-5 theme-transition"
            >
              <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[17px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                  {t(`articles.${article.translationKey}.title`)}
                </h3>
                <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[12px] font-medium text-[var(--text-secondary)] font-[var(--font-body)]">
                  {article.reference}
                </span>
              </header>
              <p className="text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {t(`articles.${article.translationKey}.body`)}
              </p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[1.5px] text-[var(--text-muted)] font-[var(--font-body)]">
                <code className="font-[var(--font-mono)] normal-case">
                  {article.surface}
                </code>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pipeline diagram ----------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("pipelineTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
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
        <dl className="mt-6 space-y-3">
          {PIPELINE_STEPS.map((step) => (
            <div key={step.translationKey}>
              <dt className="text-[13px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
                {t(`pipelineSteps.${step.translationKey}.label`)}
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {t(`pipelineSteps.${step.translationKey}.desc`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Operator levers ------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("leversTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("leversDesc")}
        </p>
        <div className="space-y-4">
          {OPERATOR_LEVERS.map((lever) => (
            <article
              key={lever.translationKey}
              data-testid={`operator-lever-${lever.translationKey}`}
              className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-5 theme-transition"
            >
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                  {t(`levers.${lever.translationKey}.label`)}
                </h3>
                <code className="text-[12px] text-[var(--text-secondary)] font-[var(--font-mono)]">
                  {lever.envVar}
                  {lever.defaultValue !== null && (
                    <span className="ml-2 text-[var(--text-muted)]">
                      = {lever.defaultValue}
                    </span>
                  )}
                </code>
              </header>
              <p className="text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {t(`levers.${lever.translationKey}.desc`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Limitations ---------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("limitationsTitle")}
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("limitationsDesc")}
        </p>
        <ul className="space-y-3 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {LIMITATIONS.map((limitation) => (
            <li
              key={limitation.translationKey}
              data-testid={`limitation-${limitation.translationKey}`}
              className="leading-relaxed"
            >
              {t(`limitations.${limitation.translationKey}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* Receipt summary ------------------------------------------------ */}
      <section className="mb-10 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-5 theme-transition">
        <h2 className="mb-2 text-[18px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("receiptTitle")}
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {t("receiptDesc")}
        </p>
      </section>

      {/* Cross-links + disclaimer -------------------------------------- */}
      <section className="mb-6">
        <h2 className="mb-3 text-[14px] font-semibold uppercase tracking-[1.5px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("crossLinksTitle")}
        </h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-[var(--font-body)]">
          <li>
            <Link
              href="/privacy"
              className="text-[var(--accent)] hover:underline"
            >
              {t("crossLinkPrivacy")}
            </Link>
          </li>
          <li>
            <Link
              href="/data-residency"
              className="text-[var(--accent)] hover:underline"
            >
              {t("crossLinkDataResidency")}
            </Link>
          </li>
        </ul>
      </section>

      <p className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
        {t("notProductionMark")}
      </p>
    </main>
  );
}

/**
 * Hand-rolled SVG pipeline diagram. Matches the `RiskChart` /
 * `RiskRadar` approach — no chart library, just declarative geometry.
 *
 * Layout: equal-width boxes laid out horizontally on wide viewports and
 * stacked vertically on narrow ones, connected by chevron arrows. The
 * `isLlmCall` flag picks a distinct fill so readers can see at a glance
 * which steps leave the device.
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
      className="overflow-x-auto rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition"
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
                rx={8}
                className={
                  node.isLlmCall
                    ? "fill-[var(--bg-secondary)] stroke-[var(--accent)]"
                    : "fill-[var(--bg-primary)] stroke-[var(--border-primary)]"
                }
                strokeWidth={1.5}
              />
              <text
                x={x + nodeWidth / 2}
                y={y + 28}
                textAnchor="middle"
                className="fill-[var(--text-primary)] text-[12px] font-[var(--font-body)]"
              >
                {node.label}
              </text>
              <text
                x={x + nodeWidth / 2}
                y={y + 52}
                textAnchor="middle"
                className={
                  node.isLlmCall
                    ? "fill-[var(--accent)] text-[10px] font-[var(--font-body)] uppercase tracking-[1.5px]"
                    : "fill-[var(--text-muted)] text-[10px] font-[var(--font-body)] uppercase tracking-[1.5px]"
                }
              >
                {node.isLlmCall ? llmBadge : localBadge}
              </text>
              {i < labels.length - 1 && (
                <path
                  d={`M ${x + nodeWidth} ${y + nodeHeight / 2} L ${x + nodeWidth + gap} ${y + nodeHeight / 2}`}
                  className="stroke-[var(--text-muted)]"
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
            <path d="M0,0 L8,4 L0,8 z" className="fill-[var(--text-muted)]" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

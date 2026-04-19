/**
 * Data residency page — lists every third-party data flow with region
 * and legal basis. Rendered from the typed `DATA_FLOWS` config so it
 * stays in sync with reality; adding a processor there surfaces it
 * here automatically.
 *
 * The page leads with the default EU-only story (Mistral + Vercel +
 * Railway), then shows the optional flows that only activate when the
 * operator enables a specific feature (DB auth, email magic-link, or
 * the OpenAI rollback). Grouping matters — "we don't send your data
 * to the US by default" is a trust statement, and burying it in a
 * flat list would weaken that claim.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { DATA_FLOWS, type DataFlow } from "@/lib/data-flows";

export const metadata: Metadata = {
  title: "Data residency — Redline",
  description:
    "Every third-party data flow Redline touches, where it runs, and the legal basis under GDPR.",
};

export default function DataResidencyPage() {
  const defaults = DATA_FLOWS.filter((f) => f.group === "default");
  const optional = DATA_FLOWS.filter((f) => f.group === "optional");

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <Link
        href="/privacy"
        className="mb-6 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        &larr; Back to Privacy Policy
      </Link>

      <h1 className="mb-2 text-[32px] font-normal leading-tight text-[var(--text-primary)] font-[var(--font-heading)]">
        Data residency
      </h1>
      <p className="mb-9 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        Every third-party service Redline touches, what data flows there,
        and the region it runs in. In the default configuration, contract
        analysis stays within the European Union.
      </p>

      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          Default data flows
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          These processors are involved every time you use Redline.
        </p>
        <div className="space-y-4">
          {defaults.map((flow) => (
            <DataFlowCard key={flow.provider} flow={flow} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
          Optional data flows
        </h2>
        <p className="mb-5 text-[14px] text-[var(--text-muted)] font-[var(--font-body)]">
          These processors only come into play when a specific feature —
          saved history, magic-link sign-in, or the non-default LLM
          rollback — is enabled by the operator.
        </p>
        <div className="space-y-4">
          {optional.map((flow) => (
            <DataFlowCard key={flow.provider} flow={flow} />
          ))}
        </div>
      </section>

      <p className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
        This page is rendered directly from the typed{" "}
        <code>frontend/src/lib/data-flows.ts</code> config so it tracks
        the live configuration without manual drift.
      </p>
    </main>
  );
}

/** One processor card — heading, region pill, then the audit fields. */
function DataFlowCard({ flow }: { flow: DataFlow }) {
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
        {flow.purpose}
      </p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <Field label="Data">
          <ul className="list-disc space-y-1 pl-5 marker:text-[var(--text-muted)]">
            {flow.dataCategories.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Field>
        <Field label="Legal basis">{flow.legalBasis}</Field>
        {flow.notes && <Field label="Notes">{flow.notes}</Field>}
        <Field label="Policies">
          <ExtLink href={flow.privacyPolicyUrl}>Privacy Policy</ExtLink>
          {flow.dpaUrl && (
            <>
              <span className="mx-2 text-[var(--text-muted)]">·</span>
              <ExtLink href={flow.dpaUrl}>Data Processing Addendum</ExtLink>
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

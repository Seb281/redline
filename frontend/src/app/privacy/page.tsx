/** Privacy policy page — GDPR Article 13 disclosures. */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Redline",
  description: "How Redline handles your data, what we process, and your rights under GDPR.",
};

const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@example.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <Link
        href="/"
        className="mb-6 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        &larr; Back to Redline
      </Link>

      <h1 className="mb-2 text-[32px] font-normal leading-tight text-[var(--text-primary)] font-[var(--font-heading)]">
        Privacy Policy
      </h1>
      <p className="mb-9 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        Last updated: 12 April 2026
      </p>

      {/* 1. Identity & Contact */}
      <Section title="Who we are">
        <p>
          Redline is operated by Sebastian Giupana, an individual developer. For
          privacy inquiries, contact{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="text-[var(--accent)] hover:underline">
            {PRIVACY_EMAIL}
          </a>.
        </p>
      </Section>

      {/* 2. What data we process */}
      <Section title="What data we process">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Contract text</strong> — When you upload a contract (PDF or
            DOCX), the extracted text is sent to a third-party AI provider for
            analysis. See &ldquo;Third-party processors&rdquo; below.
          </li>
          <li>
            <strong>Theme preference</strong> — Your dark/light mode choice is
            stored in your browser&apos;s <code>localStorage</code> under the key{" "}
            <code>redline-theme</code>.
          </li>
          <li>
            <strong>Cookie banner dismissal</strong> — Whether you have dismissed
            the cookie banner is stored in <code>localStorage</code> under the key{" "}
            <code>redline-cookie-dismissed</code>.
          </li>
        </ul>
        <p className="mt-3">
          We do not use cookies. We do not collect personal information, create
          user accounts, or run analytics or tracking scripts.
        </p>
      </Section>

      {/* 3. Purpose & Legal Basis */}
      <Section title="Purpose and legal basis">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Contract analysis</strong> — Processing is necessary to
            provide the service you request (GDPR Art. 6(1)(b) — performance of
            a contract).
          </li>
          <li>
            <strong>Theme preference &amp; banner dismissal</strong> — Legitimate
            interest in providing a functional user experience (GDPR Art.
            6(1)(f)). These are strictly necessary for the interface to work as
            expected.
          </li>
        </ul>
      </Section>

      {/* 4. Third-party processors */}
      <Section title="Third-party processors">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>OpenAI</strong> (GPT-4.1-nano) — Contract text is sent to
            OpenAI&apos;s API for clause extraction and risk analysis. OpenAI
            processes this data under their{" "}
            <ExtLink href="https://openai.com/policies/data-processing-addendum">
              Data Processing Addendum
            </ExtLink>{" "}
            and{" "}
            <ExtLink href="https://openai.com/privacy">Privacy Policy</ExtLink>.
          </li>
          <li>
            <strong>Vercel</strong> — Frontend hosting.{" "}
            <ExtLink href="https://vercel.com/legal/privacy-policy">
              Privacy Policy
            </ExtLink>.
          </li>
          <li>
            <strong>Railway</strong> — Backend hosting.{" "}
            <ExtLink href="https://railway.com/legal/privacy">
              Privacy Policy
            </ExtLink>.
          </li>
        </ul>
      </Section>

      {/* 5. Data retention */}
      <Section title="Data retention">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Contract text</strong> — Processed in-memory and discarded
            after the analysis response is returned. Not stored on any server, not
            logged, not used for model training.
          </li>
          <li>
            <strong>localStorage data</strong> — Persists in your browser until
            you clear it. No server-side copy exists.
          </li>
        </ul>
      </Section>

      {/* 6. International data transfers */}
      <Section title="International data transfers">
        <p>
          OpenAI processes data in the United States under their Data Processing
          Addendum, which includes Standard Contractual Clauses (SCCs) as the
          transfer mechanism. Vercel and Railway may process data outside the EU
          under their respective data processing agreements.
        </p>
      </Section>

      {/* 7. Your rights */}
      <Section title="Your rights">
        <p>Under GDPR, you have the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access your personal data</li>
          <li>Rectify inaccurate data</li>
          <li>Request erasure of your data</li>
          <li>Restrict processing</li>
          <li>Data portability</li>
          <li>Object to processing</li>
          <li>Lodge a complaint with a supervisory authority</li>
        </ul>
        <p className="mt-3">
          Since we do not store any personal data on our servers, most of these
          rights are satisfied by default — there is nothing to access, correct,
          or delete. Your <code>localStorage</code> data is entirely under your
          control in your browser.
        </p>
        <p className="mt-3">
          For any requests, contact{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="text-[var(--accent)] hover:underline">
            {PRIVACY_EMAIL}
          </a>.
        </p>
      </Section>

      {/* 8. Changes */}
      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. The &ldquo;Last
          updated&rdquo; date at the top of the page reflects the most recent
          revision. Material changes will be reflected by an updated date.
        </p>
      </Section>
    </main>
  );
}

/** Reusable section with heading. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

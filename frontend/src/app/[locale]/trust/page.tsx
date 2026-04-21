/**
 * Trust hub — single landing that orients visitors across the three
 * compliance surfaces (privacy policy, data residency audit, AI Act
 * transparency artefact).
 *
 * Kept intentionally lean: Masthead + three editorial teaser cards. The
 * hub does not duplicate the content of the sub-pages; it only explains
 * what lives where so a reader can follow the thread that matters to
 * them first. Server component (no client state, just i18n + links).
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/PageShell";
import { BorderedCard, Kicker, Masthead, MonoLabel } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Trust" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TrustPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Trust");

  return (
    <main>
      <PageShell width="md" className="pb-16">
        <Masthead meta={t("meta")} title={t("title")} lede={t("lede")} />

        <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <TeaserCard
            href="/privacy"
            kicker={t("privacyKicker")}
            title={t("privacyTitle")}
            body={t("privacyBody")}
            cta={t("privacyCta")}
          />
          <TeaserCard
            href="/data-residency"
            kicker={t("residencyKicker")}
            title={t("residencyTitle")}
            body={t("residencyBody")}
            cta={t("residencyCta")}
          />
          <TeaserCard
            href="/transparency"
            kicker={t("transparencyKicker")}
            title={t("transparencyTitle")}
            body={t("transparencyBody")}
            cta={t("transparencyCta")}
          />
        </section>
      </PageShell>
    </main>
  );
}

/**
 * Editorial teaser card — kicker + serif headline + reading-body copy +
 * mono affordance. Entire card is an anchor so the target is as large
 * as the affordance suggests.
 */
function TeaserCard({
  href,
  kicker,
  title,
  body,
  cta,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link href={href} className="group block no-underline">
      <BorderedCard
        tone="edge"
        padding="md"
        className="flex h-full flex-col gap-4 transition-colors hover:border-ink"
      >
        <Kicker tone="red">{kicker}</Kicker>
        <h2 className="m-0 font-serif text-[22px] font-light leading-tight tracking-[-0.005em] text-ink">
          {title}
        </h2>
        <p className="t-reading m-0 flex-1 text-[15px] text-ink-2">{body}</p>
        <MonoLabel
          tone="ink"
          className="mt-auto inline-flex items-center gap-2 group-hover:text-red-accent"
        >
          {cta} →
        </MonoLabel>
      </BorderedCard>
    </Link>
  );
}

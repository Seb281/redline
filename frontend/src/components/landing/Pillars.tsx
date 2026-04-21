/**
 * Pillars — three bordered cards enumerating the product's foundations.
 *
 * Card line-height is hand-tuned so titles wrap on two lines without
 * colliding into the body copy below (per handoff note).
 */

import { useTranslations } from "next-intl";
import { BorderedCard } from "@/components/ui/BorderedCard";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { SectionHead } from "@/components/ui/SectionHead";

export function Pillars() {
  const t = useTranslations("Landing.Pillars");
  const cards = [
    {
      kicker: t("p1Kicker"),
      title: t("p1Title"),
      body: t("p1Body"),
    },
    {
      kicker: t("p2Kicker"),
      title: t("p2Title"),
      body: t("p2Body"),
    },
    {
      kicker: t("p3Kicker"),
      title: t("p3Title"),
      body: t("p3Body"),
    },
  ];
  return (
    <section className="mt-20">
      <SectionHead>{t("title")}</SectionHead>
      <div className="mt-6 grid grid-cols-1 gap-0 md:grid-cols-3 md:gap-5">
        {cards.map((c) => (
          <BorderedCard key={c.title} padding="lg" className="flex flex-col gap-4">
            <MonoLabel tone="red">{c.kicker}</MonoLabel>
            <h3 className="font-serif text-[26px] leading-[1.25] tracking-[-0.01em] text-ink m-0 mb-7 max-w-[18ch]">
              {c.title}
            </h3>
            <p className="t-reading text-ink-2 m-0">{c.body}</p>
          </BorderedCard>
        ))}
      </div>
    </section>
  );
}

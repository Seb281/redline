/**
 * HowItReads — numbered 3-step flow shown on a horizontal rule.
 *
 * Steps: Parse, Structure, Explain. Large Fraunces numerals sit above
 * mono kickers and short Newsreader bodies. Each step is a grid cell
 * separated by 1px paper-edge rules (vertical on desktop, horizontal
 * stacked on mobile).
 */

import { useTranslations } from "next-intl";
import { SectionHead } from "@/components/ui/SectionHead";
import { MonoLabel } from "@/components/ui/MonoLabel";

export function HowItReads() {
  const t = useTranslations("Landing.HowItReads");
  const steps = [
    { n: "01", kicker: t("s1Kicker"), body: t("s1Body") },
    { n: "02", kicker: t("s2Kicker"), body: t("s2Body") },
    { n: "03", kicker: t("s3Kicker"), body: t("s3Body") },
  ];
  return (
    <section className="mt-20">
      <SectionHead>{t("title")}</SectionHead>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-paper-edge">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-5 px-0 py-6 md:px-6 md:first:pl-0 md:last:pr-0">
            <span className="font-serif text-[42px] leading-none text-ink">
              {s.n}
            </span>
            <div className="flex flex-col gap-2">
              <MonoLabel tone="muted">{s.kicker}</MonoLabel>
              <p className="t-reading text-ink-2 m-0 max-w-[28ch]">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
